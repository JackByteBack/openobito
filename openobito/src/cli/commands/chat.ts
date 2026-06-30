import { render } from "ink";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { join } from "path";
import readline from "readline";
import type { Command } from "commander";
import { loadConfig, getConfigDir } from "../../config/index.js";
import { getDb, memoryAll } from "../../storage/index.js";
import { FallbackChain } from "../../model/index.js";
import { createDefaultRegistry } from "../../tools/index.js";
import { SafetySystem } from "../../safety/index.js";
import { PolicyEngine } from "../../permissions/index.js";
import { SessionManager, runAgentLoop, globalBus, ContextCompressor } from "../../agent/index.js";
import { CronScheduler } from "../../cron/scheduler.js";
import { App } from "../../tui/components/App.js";
import { useThinking } from "../../tui/hooks/useThinking.js";
import type { AppViewState, ToolExecutionState } from "../../tui/types.js";
import type { AutocompleteSource } from "../../tui/hooks/useAutocomplete.js";
import type { Session, ToolCall, ToolResult } from "../../types/index.js";
// Slash command system — lazy-imported so the registry is populated before use.
import { globalRegistry, allCommandPaths, type CommandContext } from "../slash/index.js";

import type { OpenAgentConfig } from "../../types/index.js";

interface ContainerProps {
  session: Session;
  config: OpenAgentConfig;
  model: FallbackChain;
  tools: ReturnType<typeof createDefaultRegistry>;
  policy: PolicyEngine;
  safety: SafetySystem;
  compressor: ContextCompressor;
  cron: CronScheduler;
  db: ReturnType<typeof getDb>;
  sessionMgr: SessionManager;
  version: string;
  modelName: string;
  approval: (prompt: string) => Promise<boolean>;
}

/** Stateful React container: owns view state, drives the agent loop, wires events. */
function ChatContainer(props: ContainerProps) {
  const { session, config, model, tools, policy, safety, compressor, cron, db, sessionMgr, version, modelName, approval } = props;

  const thinking = useThinking(true);
  const [messages, setMessages] = useState(session.messages);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [toolStates, setToolStates] = useState<ToolExecutionState[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const streamRef = useRef("");
  const abortRef = useRef(false);

  // Subscribe to agent events → tool execution panel.
  useEffect(() => {
    const offCall = globalBus.on<ToolCall>("tool.call", (e) => {
      setToolStates((prev) => [
        ...prev,
        { id: e.data.id, name: e.data.name, status: "running", progress: 0 },
      ]);
    });
    const offResult = globalBus.on<ToolResult>("tool.result", (e) => {
      setToolStates((prev) =>
        prev.map((t) =>
          t.id === e.data.toolCallId
            ? { ...t, status: e.data.isError ? "error" : "success", progress: 100 }
            : t
        )
      );
    });
    return () => {
      offCall();
      offResult();
    };
  }, []);

  const completionSource: AutocompleteSource = {
    commands: allCommandPaths(),
    models: [modelName],
    skills: tools.list().map((t) => t.schema.name),
  };

  const memoryTokens = Object.values(memoryAll(db)).join("").length;

  // Build the CommandContext that every slash-command handler receives.
  const makeCtx = useCallback((): CommandContext => ({
    config,
    db,
    sessionId: session.id,
    clearMessages: () => { session.messages = []; setMessages([]); },
    interrupt: () => { abortRef.current = true; thinking.stop(); setIsBusy(false); setStreamBuffer(""); },
    refresh: () => setMessages([...session.messages]),
    print: (text) => {
      // Special sentinels from AgentMixin
      if (text === "__SHOW_THINKING__") { thinking.setVisible(true); return; }
      if (text === "__HIDE_THINKING__") { thinking.setVisible(false); return; }
      sessionMgr.addMessage(session, { role: "system", content: text });
      setMessages([...session.messages]);
    },
    configPath: getConfigDir() + "/config.yaml",
  }), [config, db, session, sessionMgr, thinking]);

  const handleSubmit = useCallback(
    async (input: string) => {
      if (input.startsWith("/")) {
        const result = await globalRegistry.dispatch(input, makeCtx());
        if (result.kind === "output" || result.kind === "error") {
          const role = result.kind === "error" ? "system" : "system";
          const prefix = result.kind === "error" ? "Error: " : "";
          sessionMgr.addMessage(session, { role, content: prefix + (result.text ?? "") });
          setMessages([...session.messages]);
        }
        if (result.kind === "exit") process.exit(0);
        return;
      }

      const userMsg = sessionMgr.addMessage(session, { role: "user", content: input });
      setMessages([...session.messages]);
      if (session.messages.filter((m) => m.role === "user").length === 1) {
        sessionMgr.setTitle(session, sessionMgr.makeTitleFromFirstMessage(input));
      }

      abortRef.current = false;
      setIsBusy(true);
      setToolStates([]);
      thinking.start();
      streamRef.current = "";
      setStreamBuffer("");

      try {
        const compressed = await compressor.compress(session.messages);
        const result = await runAgentLoop(compressed.messages, {
          model,
          tools,
          policy,
          db,
          sessionId: session.id,
          stream: true,
          onChunk: (chunk) => {
            if (abortRef.current) return;
            streamRef.current += chunk;
            setStreamBuffer(streamRef.current);
            thinking.ingest(streamRef.current);
          },
          onApprovalRequired: approval,
        });
        if (!abortRef.current) {
          sessionMgr.addMessage(session, { role: "assistant", content: result.message.content });
        }
      } catch (err) {
        sessionMgr.addMessage(session, {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        thinking.stop();
        setIsBusy(false);
        setStreamBuffer("");
        setMessages([...session.messages]);
      }
    },
    [session, model, tools, policy, db, sessionMgr, thinking, approval, makeCtx]
  );

  const handleInterrupt = useCallback(() => {
    abortRef.current = true;
    thinking.stop();
    setIsBusy(false);
    setStreamBuffer("");
  }, [thinking]);

  const handleClear = useCallback(() => {
    session.messages = [];
    setMessages([]);
    setToolStates([]);
  }, [session]);

  const state: AppViewState = {
    header: {
      version,
      model: modelName,
      skills: tools.list().length,
      memoryTokens,
    },
    messages,
    streamBuffer,
    thinking: thinking.state,
    tools: toolStates,
    isBusy,
  };

  return React.createElement(App, {
    state,
    thinking,
    historyFile: join(getConfigDir(), "history"),
    completionSource,
    onSubmit: handleSubmit,
    onInterrupt: handleInterrupt,
    onClear: handleClear,
  });
}

export function registerChatCommand(program: Command): void {
  program
    .command("chat", { isDefault: true })
    .description("Start an interactive chat session with your local AI agent")
    .option("-m, --model <model>", "Override model name")
    .option("--no-stream", "Disable streaming output")
    .action(async (opts) => {
      const config = loadConfig();
      if (opts.model) config.model.model = opts.model as string;

      const db = getDb(config.storage.path);
      const model = new FallbackChain(config.model);
      const tools = createDefaultRegistry();
      const policy = new PolicyEngine(config.permissions);
      const safety = new SafetySystem({
        sessionId: crypto.randomUUID(),
        configDir: getConfigDir(),
        securityLevel: "strict",
        userPolicies: config.permissions.policies,
        tools: tools.list().map((t) => t.schema.name),
      });
      const compressor = new ContextCompressor({
        strategy: "hybrid",
        maxTokens: config.model.maxTokens ?? 4096,
        triggerFraction: 0.75,
        minMessages: 10,
        summaryMaxTokens: 512,
      });
      const sessionMgr = new SessionManager(db, config.model.model);

      const cron = new CronScheduler(
        async (job) => {
          const result = await runAgentLoop(
            [{ id: crypto.randomUUID(), role: "user", content: job.prompt, timestamp: Date.now() }],
            { model, tools, policy, db, sessionId: session.id }
          );
          return { output: result.message.content, toolsExecuted: result.toolsExecuted };
        },
        { tickIntervalMs: 60000, maxConcurrent: 3, timeoutMs: 300000 }
      );
      cron.start();

      const available = await model.isAvailable();
      if (!available) {
        console.error(
          `\nCannot connect to Ollama at ${config.model.baseUrl}\n` +
            "  Run `ollama serve` to start, or `openagent doctor` to diagnose.\n"
        );
        process.exit(1);
      }

      const session = sessionMgr.create();

      const approval = async (prompt: string): Promise<boolean> => {
        process.stdout.write("\n" + prompt + "\n");
        return new Promise((resolve) => {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl.question("Allow? [y/N] ", (ans) => {
            rl.close();
            resolve(ans.toLowerCase().startsWith("y"));
          });
        });
      };

      render(
        React.createElement(ChatContainer, {
          session,
          config,
          model,
          tools,
          policy,
          safety,
          compressor,
          cron,
          db,
          sessionMgr,
          version: "0.1.0",
          modelName: config.model.model,
          approval,
        })
      );
    });
}
