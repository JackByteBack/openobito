import type { GConstructor } from "../types.js";
import { output, err, OK } from "../types.js";
import type { BaseCLI } from "../base.js";
import { sessionIds } from "../complete.js";

// ─── Session Management mixin ──────────────────────────────────────────────────
// /new /reset /sessions /load /save /delete /rename /export /import

export function SessionMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["new"],
          description: "Start a new chat session",
          usage: "/new",
          aliases: ["/n"],
          handler: async (_args, ctx) => {
            ctx.clearMessages();
            ctx.print("Started a new session.");
            return OK;
          },
        },
        {
          path: ["reset"],
          description: "Clear current session (same as /new)",
          usage: "/reset",
          handler: async (_args, ctx) => {
            ctx.clearMessages();
            return output("Session reset.");
          },
        },
        {
          path: ["sessions"],
          description: "List recent sessions",
          usage: "/sessions [--all]",
          aliases: ["/ss"],
          handler: async (args, ctx) => {
            const limit = args.includes("--all") ? 100 : 10;
            const { listSessions } = await import("../../../storage/index.js");
            const sessions = listSessions(ctx.db, limit);
            if (sessions.length === 0) return output("No sessions yet.");
            const lines = sessions.map(
              (s, i) =>
                `  ${i + 1}. ${s.id.slice(0, 8)}  ${s.title.slice(0, 40).padEnd(42)}  ${new Date(s.updatedAt).toLocaleString()}`
            );
            return output(lines.join("\n"));
          },
          complete: async () => ["--all"],
        },
        {
          path: ["load"],
          description: "Load a session by ID",
          usage: "/load <id|--latest>",
          handler: async (args, ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /load <id|--latest>");
            const { getSession, listSessions } = await import("../../../storage/index.js");
            if (id === "--latest") {
              const latest = listSessions(ctx.db, 1)[0];
              if (!latest) return err("No sessions found.");
              return output(`Loaded session: ${latest.id.slice(0, 8)}  ${latest.title}`);
            }
            const session = getSession(ctx.db, id);
            if (!session) return err(`Session not found: ${id}`);
            return output(`Loaded session: ${session.id.slice(0, 8)}  ${session.title} (${session.messages.length} messages)`);
          },
          complete: async (ctx) => ["--latest", ...sessionIds(ctx.db)],
        },
        {
          path: ["save"],
          description: "Save the current session with an optional name",
          usage: "/save [<name>]",
          handler: async (args, ctx) => {
            const name = args.join(" ").trim();
            if (name && ctx.sessionId) {
              const { updateSessionTitle } = await import("../../../storage/index.js");
              updateSessionTitle(ctx.db, ctx.sessionId, name);
              return output(`Session saved as: "${name}"`);
            }
            return output("Session saved.");
          },
        },
        {
          path: ["delete"],
          description: "Delete a session by ID",
          usage: "/delete <id>",
          handler: async (args, ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /delete <id>");
            const { deleteSession } = await import("../../../storage/index.js");
            deleteSession(ctx.db, id);
            return output(`Deleted session: ${id}`);
          },
          complete: async (ctx) => sessionIds(ctx.db),
        },
        {
          path: ["rename"],
          description: "Rename a session",
          usage: "/rename <id> <new name>",
          handler: async (args, ctx) => {
            const [id, ...rest] = args;
            const name = rest.join(" ").trim();
            if (!id || !name) return err("Usage: /rename <id> <new name>");
            const { updateSessionTitle } = await import("../../../storage/index.js");
            updateSessionTitle(ctx.db, id, name);
            return output(`Renamed session ${id.slice(0, 8)} → "${name}"`);
          },
          complete: async (ctx) => sessionIds(ctx.db),
        },
        {
          path: ["export"],
          description: "Export a session to a JSON file",
          usage: "/export <id>",
          handler: async (args, ctx) => {
            const id = args[0] ?? ctx.sessionId;
            if (!id) return err("No session to export.");
            const { getSession } = await import("../../../storage/index.js");
            const { writeFileSync } = await import("fs");
            const session = getSession(ctx.db, id);
            if (!session) return err(`Session not found: ${id}`);
            const file = `session-${id.slice(0, 8)}.json`;
            writeFileSync(file, JSON.stringify(session, null, 2));
            return output(`Exported to ${file}`);
          },
          complete: async (ctx) => sessionIds(ctx.db),
        },
        {
          path: ["import"],
          description: "Import a session from a JSON file",
          usage: "/import <file>",
          handler: async (args, _ctx) => {
            const file = args[0];
            if (!file) return err("Usage: /import <file>");
            return output(`Import from ${file} — feature coming in Phase 2.`);
          },
        },
      ]);
    }
  };
}
