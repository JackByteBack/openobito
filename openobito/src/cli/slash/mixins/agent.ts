import type { GConstructor } from "../types.js";
import { output, err, OK } from "../types.js";
import type { BaseCLI } from "../base.js";

// ─── Agent Control mixin ───────────────────────────────────────────────────────
// /stop /pause /resume /retry /undo /clear
// /think /show-thinking /hide-thinking /reset-memory

export function AgentMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["stop"],
          description: "Stop the agent mid-response (same as Ctrl+C)",
          usage: "/stop",
          handler: async (_args, ctx) => {
            ctx.interrupt();
            return output("Agent stopped.");
          },
        },
        {
          path: ["pause"],
          description: "Pause the agent loop",
          usage: "/pause",
          handler: async (_args, _ctx) => output("Pause requested — feature coming soon."),
        },
        {
          path: ["resume"],
          description: "Resume a paused agent loop",
          usage: "/resume",
          handler: async (_args, _ctx) => output("Resume requested — feature coming soon."),
        },
        {
          path: ["retry"],
          description: "Re-send the last user message",
          usage: "/retry",
          handler: async (_args, _ctx) =>
            output("Retry — re-sending last message… (wired in Phase 2)"),
        },
        {
          path: ["undo"],
          description: "Remove the last exchange (user + assistant messages)",
          usage: "/undo",
          handler: async (_args, _ctx) =>
            output("Undo last exchange — wired in Phase 2."),
        },
        {
          path: ["clear"],
          description: "Clear the current session transcript",
          usage: "/clear",
          handler: async (_args, ctx) => {
            ctx.clearMessages();
            return OK;
          },
        },
        {
          path: ["think"],
          description: "Ask the agent to think for N seconds before replying",
          usage: "/think [seconds]",
          handler: async (args, _ctx) => {
            const secs = parseInt(args[0] ?? "5", 10);
            if (isNaN(secs) || secs < 1 || secs > 120)
              return err("Seconds must be 1–120.");
            return output(`Agent will allocate up to ${secs}s of thinking time.`);
          },
          complete: async () => ["5", "10", "15", "30", "60"],
        },
        {
          path: ["show-thinking"],
          description: "Show the reasoning / thinking panel",
          usage: "/show-thinking",
          handler: async (_args, ctx) => {
            ctx.print("__SHOW_THINKING__");
            return OK;
          },
        },
        {
          path: ["hide-thinking"],
          description: "Hide the reasoning / thinking panel",
          usage: "/hide-thinking",
          handler: async (_args, ctx) => {
            ctx.print("__HIDE_THINKING__");
            return OK;
          },
        },
        {
          path: ["reset-memory"],
          description: "Clear the agent's key-value memory store",
          usage: "/reset-memory",
          handler: async (_args, ctx) => {
            const db = ctx.db;
            db.prepare("DELETE FROM memory").run();
            return output("Agent memory cleared.");
          },
        },
        {
          path: ["agent"],
          description: "List or run agent workflows",
          usage: "/agent [list|info|run]",
          handler: async (args, _ctx) => {
            const sub = args[0];
            if (!sub) return err("Usage: /agent [list|info|run]");
            const { readdirSync, existsSync } = await import("fs");
            const { homedir } = await import("os");
            const { join } = await import("path");
            const agentsDir = join(homedir(), ".openagent", "agents");
            if (!existsSync(agentsDir)) return output("No agent workflows found.");
            if (sub === "list") {
              const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
              return output(files.length ? files.map((f) => `  ${f}`).join("\n") : "No agent workflows.");
            }
            if (sub === "info") {
              const name = args[1];
              if (!name) return err("Usage: /agent info <name>");
              const { readFileSync } = await import("fs");
              const file = join(agentsDir, name.endsWith(".md") ? name : `${name}.md`);
              if (!existsSync(file)) return err(`Agent workflow not found: ${name}`);
              return output(readFileSync(file, "utf8"));
            }
            if (sub === "run") {
              return output("Agent workflow execution coming in Phase 2. Use /agent info to view definitions.");
            }
            return err("Usage: /agent [list|info|run]");
          },
          complete: async () => ["list", "info", "run"],
        },
        {
          path: ["agent", "list"],
          description: "List available agent workflows",
          usage: "/agent list",
          handler: async (_args, _ctx) => {
            const { readdirSync, existsSync } = await import("fs");
            const { homedir } = await import("os");
            const { join } = await import("path");
            const agentsDir = join(homedir(), ".openagent", "agents");
            if (!existsSync(agentsDir)) return output("No agent workflows.");
            const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
            return output(files.length ? files.map((f) => `  ${f.replace(/\.md$/, "")}`).join("\n") : "No agent workflows.");
          },
        },
        {
          path: ["agent", "info"],
          description: "Show details of an agent workflow",
          usage: "/agent info <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /agent info <name>");
            const { readFileSync, existsSync } = await import("fs");
            const { homedir } = await import("os");
            const { join } = await import("path");
            const file = join(homedir(), ".openagent", "agents", name.endsWith(".md") ? name : `${name}.md`);
            if (!existsSync(file)) return err(`Agent workflow not found: ${name}`);
            return output(readFileSync(file, "utf8"));
          },
        },
        {
          path: ["agent", "run"],
          description: "Run an agent workflow",
          usage: "/agent run <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /agent run <name>");
            return output(`Agent workflow "${name}" — execution coming in Phase 2.`);
          },
        },
      ]);
    }
  };
}
