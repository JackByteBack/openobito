import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";
import type { CommandRegistry } from "../registry.js";

// ─── Help & Documentation mixin ───────────────────────────────────────────────
// /help /tutorial /examples /docs /changelog /version /about

const VERSION = "0.1.0";
const CHANGELOG = `
v0.1.0 (current)
  • Initial release: Ollama adapter, SQLite sessions, 4-panel Ink TUI
  • Slash command system with 100+ commands across 17 categories
  • Permission policy engine (Allow/RequireApproval/Deny)
  • Skills system (SKILL.md folder pattern)
  • Agent memory (key-value, persisted)
`.trim();

const TUTORIAL_TEXT = `
OpenAgent Tutorial
──────────────────
1. Start chatting:  just type and press Enter
2. Switch model:    /model <name>  or  /m <name>
3. List models:     /model list
4. Clear session:   /clear
5. View history:    /sessions
6. Skills:          /skills   →  /skills use <name>
7. Show thinking:   /show-thinking
8. Memory:          /memory add <fact>
9. Run a command:   /exec ls -la
10. Get help:       /help <command>

Keyboard shortcuts:
  Tab        → autocomplete
  ↑ / ↓     → history navigation
  Ctrl+R     → reverse search
  Ctrl+C     → stop agent
  Ctrl+L     → clear screen
`.trim();

const EXAMPLES = `
Examples
────────
Chat:         What are the top 3 sorting algorithms?
Files:        /file read src/index.ts
Git:          /git status   /git log --limit 5
Shell:        /exec find . -name "*.ts" | wc -l
Context:      /context load CONTEXT.md
Memory:       /memory add "user prefers TypeScript"
Session:      /save "refactor session"  →  /load --latest
Skills:       /skills use code_review
Config:       /config set model.temperature 0.5
`.trim();

export function HelpMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["help"],
          description: "Show help for all commands or a specific one",
          usage: "/help [<command>]",
          aliases: ["/h", "/?"],
          handler: async (args, _ctx) => {
            const registry: CommandRegistry = this.registry;

            if (args.length > 0) {
              const detail = registry.helpFor(args);
              return detail ? output(detail) : err(`No help for: /${args.join(" ")}`);
            }

            // Group by top-level path[0].
            const all = registry.listAll();
            const groups = new Map<string, typeof all>();
            for (const cmd of all) {
              const top = cmd.path[0]!;
              if (!groups.has(top)) groups.set(top, []);
              groups.get(top)!.push(cmd);
            }

            const lines = ["Commands (type /help <cmd> for detail):\n"];
            for (const [group, cmds] of [...groups.entries()].sort()) {
              const root = cmds.find((c) => c.path.length === 1);
              const desc = root?.description ?? "";
              const aliases =
                root?.aliases && root.aliases.length > 0
                  ? `  (${root.aliases.join(", ")})`
                  : "";
              lines.push(`  /${group.padEnd(18)} ${desc}${aliases}`);
            }
            lines.push("\nUse /help <command> for more detail and flags.");
            return output(lines.join("\n"));
          },
          complete: async (_ctx) => {
            return this.registry.listAll().map((c) => c.path.join(" "));
          },
        },
        {
          path: ["tutorial"],
          description: "Show a getting-started tutorial",
          usage: "/tutorial",
          handler: async () => output(TUTORIAL_TEXT),
        },
        {
          path: ["examples"],
          description: "Show usage examples",
          usage: "/examples",
          handler: async () => output(EXAMPLES),
        },
        {
          path: ["docs"],
          description: "Open documentation",
          usage: "/docs",
          handler: async () =>
            output(
              "Documentation: https://github.com/openagent-dev/openagent/wiki\n" +
                "API reference: https://github.com/openagent-dev/openagent/tree/main/docs"
            ),
        },
        {
          path: ["changelog"],
          description: "Show version changelog",
          usage: "/changelog",
          handler: async () => output(CHANGELOG),
        },
        {
          path: ["version"],
          description: "Show current version",
          usage: "/version [check]",
          handler: async (args) => {
            if (args[0] === "check")
              return output(`Current: v${VERSION}\nCheck https://github.com/openagent-dev/openagent/releases`);
            return output(`OpenAgent v${VERSION}`);
          },
          complete: async () => ["check"],
        },
        {
          path: ["about"],
          description: "About OpenAgent",
          usage: "/about",
          handler: async () =>
            output(
              [
                `OpenAgent v${VERSION}`,
                "Your local AI agent. Safe, smart, always offline.",
                "",
                "• 100% local — runs on Ollama, no API keys",
                "• SQLite persistence — sessions, memory, audit log",
                "• Permission system — Allow/RequireApproval/Deny per tool",
                "• Ink TUI — 4-panel layout with streaming output",
                "",
                "GitHub: https://github.com/openagent-dev/openagent",
                "License: MIT",
              ].join("\n")
            ),
        },
      ]);
    }
  };
}
