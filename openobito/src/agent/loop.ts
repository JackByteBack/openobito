import type { Message, Session, ToolCall } from "../types/index.js";
import type { ModelAdapter } from "../model/adapter.js";
import type { ToolRegistry } from "../tools/registry.js";
import { PolicyEngine, formatApprovalPrompt } from "../permissions/index.js";
import { logAudit } from "../storage/index.js";
import type Database from "better-sqlite3";
import { globalBus } from "./events.js";
import type { AgentDefinition } from "./definition.js";
import { DEFAULT_AGENT_DEFINITION } from "./definition.js";

// ─── Agent reasoning loop ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are OpenAgent, a helpful AI assistant running locally on the user's machine.
You have access to tools that let you read files, list directories, run shell commands, and fetch URLs.
Always ask for clarification when a request is ambiguous.
Never take destructive actions without explicit confirmation.
Be concise and factual.`;

export interface LoopOptions {
  model: ModelAdapter;
  tools: ToolRegistry;
  policy: PolicyEngine;
  db: Database.Database;
  sessionId: string;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
  onApprovalRequired?: (prompt: string) => Promise<boolean>;
  agentDefinition?: AgentDefinition;
}

export interface LoopResult {
  message: Message;
  toolsExecuted: number;
  stopped: boolean;
  stopReason?: "max_rounds" | "circuit_breaker" | "hard_reject" | undefined;
}

// ─── Circuit breaker state ────────────────────────────────────────────────────

type CircuitBreakerReason = "repeat_failure" | "no_progress" | "hard_reject";

interface CircuitBreakerState {
  consecutiveFailures: number;
  consecutiveNoProgress: number;
  tripped: boolean;
  reason?: CircuitBreakerReason | undefined;
}

function createCircuitBreakerState(): CircuitBreakerState {
  return { consecutiveFailures: 0, consecutiveNoProgress: 0, tripped: false };
}

function checkCircuitBreaker(
  state: CircuitBreakerState,
  def: AgentDefinition
): CircuitBreakerReason | null {
  if (state.consecutiveFailures >= def.circuitBreakers.repeatFailureThreshold) {
    return "repeat_failure";
  }
  if (state.consecutiveNoProgress >= def.circuitBreakers.noProgressThreshold) {
    return "no_progress";
  }
  return null;
}

// ─── Main loop ────────────────────────────────────────────────────────────────

export async function runAgentLoop(
  messages: Message[],
  opts: LoopOptions
): Promise<LoopResult> {
  const {
    model,
    tools,
    policy,
    db,
    sessionId,
    stream = false,
    onChunk,
    onApprovalRequired,
    agentDefinition = DEFAULT_AGENT_DEFINITION,
  } = opts;

  const visibleTools = policy.getVisibleTools(tools.list().map((t) => t.schema.name));
  const toolSchemas = tools.schemas().filter((s) => visibleTools.includes(s.name));

  globalBus.emit("model.thinking", sessionId, { model: model.config.model });

  let fullContent = "";
  let toolsExecuted = 0;
  const MAX_TOOL_ROUNDS = Math.min(agentDefinition.maxSteps, 50);
  const cb = createCircuitBreakerState();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const trippedReason = checkCircuitBreaker(cb, agentDefinition);
    if (trippedReason) {
      globalBus.emit("agent.circuit_breaker", sessionId, { reason: trippedReason, round });
      const fallback: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent || `[Stopped: circuit breaker tripped (${trippedReason})]`,
        timestamp: Date.now(),
      };
      return { message: fallback, toolsExecuted, stopped: true, stopReason: "circuit_breaker" };
    }

    let response;
    try {
      if (stream && onChunk) {
        response = await model.chatStream(messages, SYSTEM_PROMPT, onChunk);
        fullContent = response.content;
      } else {
        response = await model.chat(messages, SYSTEM_PROMPT);
        fullContent = response.content;
      }
      cb.consecutiveFailures = 0;
    } catch (err) {
      cb.consecutiveFailures++;
      globalBus.emit("agent.model_error", sessionId, {
        round,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      break;
    }

    // Track progress: if the model produced the same content as last round, that's no-progress
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: fullContent,
      timestamp: Date.now(),
    };
    messages = [...messages, assistantMsg];

    let progressMade = false;

    for (const call of response.toolCalls) {
      const resolved = policy.resolve(call.name);

      if (resolved.action === "deny") {
        globalBus.emit("tool.denied", sessionId, { toolName: call.name });
        logAudit(db, {
          sessionId,
          toolName: call.name,
          action: "deny",
          riskLevel: resolved.riskLevel,
          approved: false,
        });
        const denyMsg: Message = {
          id: crypto.randomUUID(),
          role: "tool",
          content: `Tool "${call.name}" is denied by policy.`,
          timestamp: Date.now(),
          toolCallId: call.id,
          toolName: call.name,
        };
        messages = [...messages, denyMsg];
        cb.consecutiveFailures++;
        continue;
      }

      if (resolved.action === "require_approval") {
        // readonly agents never get approval — they can't execute write/network tools
        if (agentDefinition.autonomy === "readonly") {
          const denyMsg: Message = {
            id: crypto.randomUUID(),
            role: "tool",
            content: `Tool "${call.name}" requires approval but agent is in readonly mode.`,
            timestamp: Date.now(),
            toolCallId: call.id,
            toolName: call.name,
          };
          messages = [...messages, denyMsg];
          cb.consecutiveFailures++;
          continue;
        }

        if (onApprovalRequired) {
          globalBus.emit("tool.approval_required", sessionId, { toolName: call.name });
          const prompt = formatApprovalPrompt({
            toolName: call.name,
            riskLevel: resolved.riskLevel,
            arguments: call.arguments,
            reason: resolved.reason,
          });
          const approved = await onApprovalRequired(prompt);
          logAudit(db, {
            sessionId,
            toolName: call.name,
            action: "require_approval",
            riskLevel: resolved.riskLevel,
            approved,
            payload: call.arguments,
          });

          if (!approved) {
            const denyMsg: Message = {
              id: crypto.randomUUID(),
              role: "tool",
              content: `User denied tool "${call.name}".`,
              timestamp: Date.now(),
              toolCallId: call.id,
              toolName: call.name,
            };
            messages = [...messages, denyMsg];
            // Hard reject: user said no — stop the loop
            const finalMsg: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: fullContent || `[Stopped: user denied "${call.name}"]`,
              timestamp: Date.now(),
            };
            return { message: finalMsg, toolsExecuted, stopped: true, stopReason: "hard_reject" };
          }
        }
      }

      globalBus.emit("tool.call", sessionId, call);
      const result = await tools.execute(call);
      globalBus.emit("tool.result", sessionId, result);
      toolsExecuted++;
      progressMade = true;
      cb.consecutiveFailures = 0;

      logAudit(db, {
        sessionId,
        toolName: call.name,
        action: resolved.action,
        riskLevel: resolved.riskLevel,
        approved: true,
        payload: call.arguments,
        result: result.content.slice(0, 500),
      });

      const toolMsg: Message = {
        id: crypto.randomUUID(),
        role: "tool",
        content: result.content,
        timestamp: Date.now(),
        toolCallId: result.toolCallId,
        toolName: call.name,
      };
      messages = [...messages, toolMsg];
    }

    if (!progressMade) {
      cb.consecutiveNoProgress++;
    } else {
      cb.consecutiveNoProgress = 0;
    }
  }

  globalBus.emit("model.done", sessionId, { content: fullContent });

  const finalMsg: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: fullContent,
    timestamp: Date.now(),
  };

  return { message: finalMsg, toolsExecuted, stopped: false };
}
