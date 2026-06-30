import type { Message } from "../types/index.js";
import type { ModelAdapter } from "../model/adapter.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { PolicyEngine } from "../permissions/index.js";
import type Database from "better-sqlite3";
import { runAgentLoop } from "./loop.js";
import type { AgentDefinition } from "./definition.js";
import { globalBus } from "./events.js";

// ─── Multi-agent Delegation (OpenHuman-inspired) ──────────────────────────────

export interface SubAgentTask {
  id: string;
  prompt: string;
  agentDefinition: AgentDefinition;
  parentSessionId: string;
  context?: Message[] | undefined;
}

export interface SubAgentResult {
  taskId: string;
  agentName: string;
  response: string;
  toolsExecuted: number;
  success: boolean;
  error?: string | undefined;
  durationMs: number;
}

export interface DelegationOptions {
  model: ModelAdapter;
  tools: ToolRegistry;
  policy: PolicyEngine;
  db: Database.Database;
  maxConcurrent?: number;
}

// ─── DelegationManager ───────────────────────────────────────────────────────

export class DelegationManager {
  private readonly maxConcurrent: number;
  private activeCount = 0;

  constructor(private readonly opts: DelegationOptions) {
    this.maxConcurrent = opts.maxConcurrent ?? 4;
  }

  async run(task: SubAgentTask): Promise<SubAgentResult> {
    const start = Date.now();
    const subSessionId = `${task.parentSessionId}:sub:${task.id}`;

    globalBus.emit("agent.delegate_start", task.parentSessionId, {
      taskId: task.id,
      agentName: task.agentDefinition.name,
    });

    const messages: Message[] = [
      ...(task.context ?? []),
      {
        id: crypto.randomUUID(),
        role: "user",
        content: task.prompt,
        timestamp: Date.now(),
      },
    ];

    try {
      const result = await runAgentLoop(messages, {
        model: this.opts.model,
        tools: this.opts.tools,
        policy: this.opts.policy,
        db: this.opts.db,
        sessionId: subSessionId,
        stream: false,
      });

      const duration = Date.now() - start;
      globalBus.emit("agent.delegate_done", task.parentSessionId, {
        taskId: task.id,
        durationMs: duration,
        success: true,
      });

      return {
        taskId: task.id,
        agentName: task.agentDefinition.name,
        response: result.message.content,
        toolsExecuted: result.toolsExecuted,
        success: true,
        durationMs: duration,
      };
    } catch (err) {
      const duration = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);

      globalBus.emit("agent.delegate_error", task.parentSessionId, {
        taskId: task.id,
        error,
      });

      return {
        taskId: task.id,
        agentName: task.agentDefinition.name,
        response: "",
        toolsExecuted: 0,
        success: false,
        error,
        durationMs: duration,
      };
    }
  }

  async runAll(tasks: SubAgentTask[]): Promise<SubAgentResult[]> {
    const results: SubAgentResult[] = [];
    const queue = [...tasks];

    const runNext = async (): Promise<void> => {
      const task = queue.shift();
      if (!task) return;

      this.activeCount++;
      const result = await this.run(task);
      this.activeCount--;
      results.push(result);

      if (queue.length > 0) {
        await runNext();
      }
    };

    const slots = Math.min(this.maxConcurrent, tasks.length);
    await Promise.all(Array.from({ length: slots }, runNext));
    return results;
  }

  get active(): number {
    return this.activeCount;
  }
}

// ─── Convenience helper ───────────────────────────────────────────────────────

export function createTask(
  prompt: string,
  agentDef: AgentDefinition,
  parentSessionId: string,
  context?: Message[]
): SubAgentTask {
  return {
    id: crypto.randomUUID(),
    prompt,
    agentDefinition: agentDef,
    parentSessionId,
    context,
  };
}
