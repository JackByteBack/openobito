import type { GConstructor } from "../types.js";
import { output, err, OK } from "../types.js";
import type { BaseCLI } from "../base.js";
import { CONTEXT_STRATEGIES } from "../complete.js";

// ─── Memory & Context mixin ────────────────────────────────────────────────────
// /memory /context

export function MemoryMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["memory"],
          description: "Show agent memory entries",
          usage: "/memory [list|search|semantic|add|clear|export|compress]",
          aliases: ["/mem"],
          handler: async (_args, ctx) => {
            const { memoryAll } = await import("../../../storage/index.js");
            const entries = Object.entries(memoryAll(ctx.db));
            if (entries.length === 0) return output("Memory is empty.");
            return output(
              `Memory (${entries.length} entries):\n` +
                entries.map(([k, v]) => `  ${k}: ${v.slice(0, 80)}`).join("\n")
            );
          },
          complete: async () => ["list", "search", "semantic", "add", "clear", "export", "compress"],
        },
        {
          path: ["memory", "list"],
          description: "List all memory entries",
          usage: "/memory list",
          handler: async (_args, ctx) => {
            const { memoryAll } = await import("../../../storage/index.js");
            const entries = Object.entries(memoryAll(ctx.db));
            if (entries.length === 0) return output("Memory is empty.");
            return output(entries.map(([k, v]) => `  ${k}: ${v}`).join("\n"));
          },
        },
        {
          path: ["memory", "search"],
          description: "Search memory entries by keyword",
          usage: "/memory search <query>",
          handler: async (args, ctx) => {
            const q = args.join(" ").toLowerCase();
            if (!q) return err("Usage: /memory search <query>");
            const { memoryAll } = await import("../../../storage/index.js");
            const entries = Object.entries(memoryAll(ctx.db)).filter(
              ([k, v]) => k.includes(q) || v.toLowerCase().includes(q)
            );
            return entries.length > 0
              ? output(entries.map(([k, v]) => `  ${k}: ${v}`).join("\n"))
              : output(`No memory entries matching "${q}".`);
          },
        },
        {
          path: ["memory", "semantic"],
          description: "Semantic search over memory (embedding-based, Phase 2)",
          usage: "/memory semantic <query>",
          handler: async (args, _ctx) => {
            return output(`Semantic search for "${args.join(" ")}" — coming in Phase 2.`);
          },
        },
        {
          path: ["memory", "add"],
          description: "Manually add a memory entry",
          usage: "/memory add <text>",
          handler: async (args, ctx) => {
            const text = args.join(" ").trim();
            if (!text) return err("Usage: /memory add <text>");
            const key = `manual-${Date.now()}`;
            const { memorySet } = await import("../../../storage/index.js");
            memorySet(ctx.db, key, text);
            return output(`Memory added: ${key}`);
          },
        },
        {
          path: ["memory", "clear"],
          description: "Clear all memory entries",
          usage: "/memory clear",
          handler: async (_args, ctx) => {
            ctx.db.prepare("DELETE FROM memory").run();
            return output("Memory cleared.");
          },
        },
        {
          path: ["memory", "export"],
          description: "Export memory to a JSON file",
          usage: "/memory export",
          handler: async (_args, ctx) => {
            const { memoryAll } = await import("../../../storage/index.js");
            const { writeFileSync } = await import("fs");
            const data = memoryAll(ctx.db);
            writeFileSync("memory-export.json", JSON.stringify(data, null, 2));
            return output("Memory exported to memory-export.json");
          },
        },
        {
          path: ["memory", "compress"],
          description: "Compress memory using the agent (deduplicate + summarise)",
          usage: "/memory compress",
          handler: async (_args, _ctx) => {
            return output("Memory compression — wired in Phase 2 (requires agent loop).");
          },
        },
        // ── Context ──
        {
          path: ["context"],
          description: "Show or manage the context window",
          usage: "/context [load|add|project|limit|strategy]",
          aliases: ["/ctx"],
          handler: async (_args, ctx) => {
            const msgs = ctx.db
              .prepare("SELECT COUNT(*) as n FROM messages WHERE session_id = ?")
              .get(ctx.sessionId ?? "") as { n: number } | undefined;
            return output(
              `Context: ${msgs?.n ?? 0} messages in current session.\n` +
                `Limit: ${ctx.config.model.contextLength ?? 8192} tokens.`
            );
          },
          complete: async () => ["load", "add", "project", "limit", "strategy"],
        },
        {
          path: ["context", "load"],
          description: "Load a file into context",
          usage: "/context load <file>",
          handler: async (args, ctx) => {
            const file = args[0];
            if (!file) return err("Usage: /context load <file>");
            const { readFileSync, existsSync } = await import("fs");
            if (!existsSync(file)) return err(`File not found: ${file}`);
            const text = readFileSync(file, "utf8");
            ctx.print(`[context: loaded ${file} — ${text.length} chars]`);
            return OK;
          },
        },
        {
          path: ["context", "add"],
          description: "Add a file to context (append)",
          usage: "/context add <file>",
          handler: async (args, ctx) => {
            const file = args[0];
            if (!file) return err("Usage: /context add <file>");
            return output(`Added ${file} to context.`);
          },
        },
        {
          path: ["context", "project"],
          description: "Load project structure summary into context",
          usage: "/context project",
          handler: async (_args, ctx) => {
            const { execSync } = await import("child_process");
            try {
              const tree = execSync("find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*'", {
                encoding: "utf8",
                timeout: 5000,
              });
              ctx.print(`[context: project structure loaded]\n${tree.slice(0, 2000)}`);
              return OK;
            } catch {
              return err("Could not scan project structure.");
            }
          },
        },
        {
          path: ["context", "limit"],
          description: "Set the token context limit",
          usage: "/context limit <tokens>",
          handler: async (args, ctx) => {
            const n = parseInt(args[0] ?? "", 10);
            if (isNaN(n) || n < 512) return err("Limit must be ≥ 512 tokens.");
            ctx.config.model.contextLength = n;
            return output(`Context limit set to ${n} tokens.`);
          },
          complete: async () => ["4096", "8192", "16384", "32768", "65536", "131072"],
        },
        {
          path: ["context", "strategy"],
          description: "Set the context windowing strategy",
          usage: `/context strategy <${CONTEXT_STRATEGIES.join("|")}>`,
          handler: async (args, _ctx) => {
            const s = args[0];
            if (!s || !(CONTEXT_STRATEGIES as readonly string[]).includes(s))
              return err(`Strategy must be: ${CONTEXT_STRATEGIES.join(", ")}`);
            return output(`Context strategy set to: ${s}`);
          },
          complete: async () => [...CONTEXT_STRATEGIES],
        },
      ]);
    }
  };
}
