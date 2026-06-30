import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

export function HistoryMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["history"],
          description: "Show conversation history",
          usage: "/history [show|search|clear|export] [--limit N] [--id <session-id>]",
          handler: async (args, ctx) => {
            const sub = args[0] ?? "show";
            if (sub === "show") {
              const limitIdx = args.indexOf("--limit");
              const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "20", 10) : 20;
              const idIdx = args.indexOf("--id");
              const sessionId = idIdx >= 0 ? args[idIdx + 1] : ctx.sessionId;
              if (!sessionId) return err("No active session. Use --id to specify a session.");
              const { getSession } = await import("../../../storage/index.js");
              const session = getSession(ctx.db, sessionId);
              if (!session) return err(`Session not found: ${sessionId}`);
              const msgs = session.messages.slice(-limit);
              if (!msgs.length) return output("No messages in this session.");
              return output(
                msgs.map((m) => {
                  const role = m.role === "user" ? "You" : m.role === "assistant" ? "AI" : "Tool";
                  const content = typeof m.content === "string" ? m.content.slice(0, 200) : JSON.stringify(m.content).slice(0, 200);
                  return `[${role}] ${content}`;
                }).join("\n\n")
              );
            }
            if (sub === "search") {
              const query = args.filter((a) => !a.startsWith("--")).slice(1).join(" ");
              if (!query) return err("Usage: /history search <query>");
              const rows = ctx.db.prepare(
                `SELECT m.content, m.role, s.title, m.session_id
                 FROM messages m JOIN sessions s ON m.session_id = s.id
                 WHERE m.content LIKE ? ORDER BY m.created_at DESC LIMIT 15`
              ).all(`%${query}%`) as Array<{ content: string; role: string; title: string; session_id: string }>;
              if (!rows.length) return output(`No messages matching "${query}".`);
              return output(
                rows.map((r) =>
                  `[${r.role}] ${r.title.slice(0, 30).padEnd(32)} ${r.content.slice(0, 120)}`
                ).join("\n\n")
              );
            }
            if (sub === "clear") {
              ctx.clearMessages();
              return output("Conversation history cleared for this session.");
            }
            if (sub === "export") {
              const idIdx = args.indexOf("--id");
              const sessionId = idIdx >= 0 ? args[idIdx + 1] : ctx.sessionId;
              if (!sessionId) return err("No session specified.");
              const { getSession } = await import("../../../storage/index.js");
              const session = getSession(ctx.db, sessionId);
              if (!session) return err(`Session not found: ${sessionId}`);
              const { writeFileSync } = await import("fs");
              const file = `history-${sessionId.slice(0, 8)}.json`;
              writeFileSync(file, JSON.stringify(session.messages, null, 2));
              return output(`History exported to ${file} (${session.messages.length} messages)`);
            }
            return err("Usage: /history [show|search|clear|export]");
          },
          complete: async () => ["show", "search", "clear", "export", "--limit", "--id"],
        },
        {
          path: ["history", "show"],
          description: "Show recent messages in current session",
          usage: "/history show [--limit N]",
          handler: async (args, ctx) => {
            const limitIdx = args.indexOf("--limit");
            const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "20", 10) : 20;
            if (!ctx.sessionId) return err("No active session.");
            const { getSession } = await import("../../../storage/index.js");
            const session = getSession(ctx.db, ctx.sessionId);
            if (!session) return err("Session not found.");
            return output(
              session.messages.slice(-limit).map((m) =>
                `[${m.role === "user" ? "You" : m.role === "assistant" ? "AI" : "Tool"}] ${typeof m.content === "string" ? m.content.slice(0, 200) : JSON.stringify(m.content).slice(0, 200)}`
              ).join("\n\n") || "(empty session)"
            );
          },
          complete: async () => ["--limit"],
        },
        {
          path: ["history", "search"],
          description: "Search across all session history",
          usage: "/history search <query>",
          handler: async (args, ctx) => {
            const query = args.filter((a) => !a.startsWith("--")).join(" ");
            if (!query) return err("Usage: /history search <query>");
            const rows = ctx.db.prepare(
              `SELECT m.content, m.role, s.title, m.session_id
               FROM messages m JOIN sessions s ON m.session_id = s.id
               WHERE m.content LIKE ? ORDER BY m.created_at DESC LIMIT 15`
            ).all(`%${query}%`) as Array<{ content: string; role: string; title: string; session_id: string }>;
            return output(
              rows.length
                ? rows.map((r) => `[${r.role}] ${r.title.slice(0, 30)}: ${r.content.slice(0, 120)}`).join("\n\n")
                : `No matches for "${query}".`
            );
          },
        },
        {
          path: ["history", "clear"],
          description: "Clear current session history",
          usage: "/history clear",
          handler: async (_args, ctx) => {
            ctx.clearMessages();
            return output("Session history cleared.");
          },
        },
        {
          path: ["history", "export"],
          description: "Export session history to JSON file",
          usage: "/history export [--id <session-id>]",
          handler: async (args, ctx) => {
            const idIdx = args.indexOf("--id");
            const sessionId = idIdx >= 0 ? args[idIdx + 1] : ctx.sessionId;
            if (!sessionId) return err("No session specified.");
            const { getSession } = await import("../../../storage/index.js");
            const session = getSession(ctx.db, sessionId);
            if (!session) return err("Session not found.");
            const { writeFileSync } = await import("fs");
            const file = `history-${sessionId.slice(0, 8)}.json`;
            writeFileSync(file, JSON.stringify(session.messages, null, 2));
            return output(`Exported ${session.messages.length} messages to ${file}`);
          },
          complete: async () => ["--id"],
        },
      ]);
    }
  };
}
