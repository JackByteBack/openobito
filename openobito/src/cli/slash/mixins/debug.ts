import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

// ─── Debug & Advanced mixin ────────────────────────────────────────────────────
// /debug /profile /cli-mode /repl /batch

let debugEnabled = false;
let traceEnabled = false;

export function DebugMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["debug"],
          description: "Toggle debug mode",
          usage: "/debug [on|off|trace]",
          handler: async (args) => {
            const sub = args[0];
            if (!sub) return output(`Debug: ${debugEnabled ? "on" : "off"}  Trace: ${traceEnabled ? "on" : "off"}`);
            if (sub === "on") { debugEnabled = true; return output("Debug mode ON."); }
            if (sub === "off") { debugEnabled = false; traceEnabled = false; return output("Debug mode OFF."); }
            if (sub === "trace") { traceEnabled = !traceEnabled; return output(`Trace: ${traceEnabled ? "on" : "off"}`); }
            return err("Usage: /debug [on|off|trace]");
          },
          complete: async () => ["on", "off", "trace"],
        },
        {
          path: ["debug", "on"],
          description: "Enable debug mode",
          usage: "/debug on",
          handler: async () => { debugEnabled = true; return output("Debug ON."); },
        },
        {
          path: ["debug", "off"],
          description: "Disable debug mode",
          usage: "/debug off",
          handler: async () => { debugEnabled = false; return output("Debug OFF."); },
        },
        {
          path: ["debug", "trace"],
          description: "Toggle trace logging",
          usage: "/debug trace",
          handler: async () => {
            traceEnabled = !traceEnabled;
            return output(`Trace: ${traceEnabled ? "on" : "off"}`);
          },
        },
        {
          path: ["profile"],
          description: "Show Node.js runtime profile",
          usage: "/profile",
          handler: async () => {
            const m = process.memoryUsage();
            const uptime = process.uptime().toFixed(1);
            return output(
              [
                `Uptime:      ${uptime}s`,
                `Heap used:   ${(m.heapUsed / 1e6).toFixed(1)} MB`,
                `Heap total:  ${(m.heapTotal / 1e6).toFixed(1)} MB`,
                `External:    ${(m.external / 1e6).toFixed(1)} MB`,
                `RSS:         ${(m.rss / 1e6).toFixed(1)} MB`,
                `Node:        ${process.version}`,
                `Platform:    ${process.platform}`,
              ].join("\n")
            );
          },
        },
        {
          path: ["cli-mode"],
          description: "Switch to simple CLI output mode (no TUI)",
          usage: "/cli-mode",
          handler: async () =>
            output("CLI-mode toggle — restart with OPENAGENT_NO_TUI=1 to disable the TUI."),
        },
        {
          path: ["repl"],
          description: "Drop into a Node.js REPL",
          usage: "/repl",
          handler: async () => {
            const repl = await import("repl");
            const server = repl.start({ prompt: "openagent> ", useGlobal: false });
            return new Promise<ReturnType<typeof output>>((resolve) => {
              server.on("exit", () => resolve(output("Exited REPL.")));
            });
          },
        },
        {
          path: ["batch"],
          description: "Run slash commands from a file, one per line",
          usage: "/batch <file>",
          handler: async (args, ctx) => {
            const file = args[0];
            if (!file) return err("Usage: /batch <file>");
            const { readFileSync, existsSync } = await import("fs");
            if (!existsSync(file)) return err(`File not found: ${file}`);
            const lines = readFileSync(file, "utf8")
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l && !l.startsWith("#"));

            const results: string[] = [];
            for (const line of lines) {
              const { globalRegistry } = await import("../registry.js");
              const result = await globalRegistry.dispatch(line, ctx);
              if (result.text) results.push(`${line}\n→ ${result.text}`);
            }
            return output(results.join("\n\n") || "Batch complete (no output).");
          },
        },
      ]);
    }
  };
}
