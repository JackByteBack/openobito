import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

// ─── Usage & Analytics mixin ───────────────────────────────────────────────────
// /usage /stats /insights

export function UsageMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["usage"],
          description: "Show token and session usage summary",
          usage: "/usage [--detailed]",
          handler: async (args, ctx) => {
            const detailed = args.includes("--detailed");
            const rows = ctx.db
              .prepare("SELECT COUNT(*) as sessions FROM sessions")
              .get() as { sessions: number };
            const msgs = ctx.db
              .prepare("SELECT COUNT(*) as n FROM messages")
              .get() as { n: number };
            const audit = ctx.db
              .prepare("SELECT COUNT(*) as n FROM audit_log")
              .get() as { n: number };
            const lines = [
              `Sessions:      ${rows.sessions}`,
              `Messages:      ${msgs.n}`,
              `Tool runs:     ${audit.n}`,
            ];
            if (detailed) {
              const tools = ctx.db
                .prepare(
                  "SELECT tool_name, COUNT(*) as n FROM audit_log GROUP BY tool_name ORDER BY n DESC LIMIT 10"
                )
                .all() as Array<{ tool_name: string; n: number }>;
              if (tools.length > 0) {
                lines.push("\nTop tools:");
                for (const t of tools) lines.push(`  ${t.tool_name}: ${t.n}x`);
              }
            }
            return output(lines.join("\n"), { sessions: rows.sessions, messages: msgs.n });
          },
          complete: async () => ["--detailed"],
        },
        {
          path: ["stats"],
          description: "Show session statistics",
          usage: "/stats [sessions]",
          handler: async (args, ctx) => {
            const sub = args[0];
            if (sub === "sessions") {
              const rows = ctx.db
                .prepare(
                  "SELECT title, (SELECT COUNT(*) FROM messages WHERE session_id = sessions.id) as n " +
                    "FROM sessions ORDER BY updated_at DESC LIMIT 5"
                )
                .all() as Array<{ title: string; n: number }>;
              return output(
                "Recent sessions by message count:\n" +
                  rows.map((r) => `  ${r.title.slice(0, 35).padEnd(36)} ${r.n} msgs`).join("\n")
              );
            }
            const total = ctx.db.prepare("SELECT COUNT(*) as n FROM sessions").get() as { n: number };
            const approved = ctx.db
              .prepare("SELECT COUNT(*) as n FROM audit_log WHERE approved = 1")
              .get() as { n: number };
            const denied = ctx.db
              .prepare("SELECT COUNT(*) as n FROM audit_log WHERE approved = 0")
              .get() as { n: number };
            return output(
              [
                `Total sessions:    ${total.n}`,
                `Tools approved:    ${approved.n}`,
                `Tools denied:      ${denied.n}`,
              ].join("\n")
            );
          },
          complete: async () => ["sessions"],
        },
        {
          path: ["insights"],
          description: "Show usage insights over a date range",
          usage: "/insights [--days <n>]",
          handler: async (args, ctx) => {
            const daysIdx = args.indexOf("--days");
            const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1] ?? "7", 10) : 7;
            const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
            const newSessions = ctx.db
              .prepare("SELECT COUNT(*) as n FROM sessions WHERE created_at > ?")
              .get(cutoff) as { n: number };
            const newMsgs = ctx.db
              .prepare(
                "SELECT COUNT(*) as n FROM messages m JOIN sessions s ON m.session_id = s.id WHERE s.created_at > ?"
              )
              .get(cutoff) as { n: number };
            return output(
              [
                `Insights (last ${days} days):`,
                `  New sessions: ${newSessions.n}`,
                `  New messages: ${newMsgs.n}`,
              ].join("\n")
            );
          },
          complete: async () => ["--days"],
        },
      ]);
    }
  };
}
