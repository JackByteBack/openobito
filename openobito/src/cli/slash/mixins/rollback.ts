import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";
import { createSnapshot, listSnapshots, getSnapshot, deleteSnapshot, pruneSnapshots } from "../../../storage/index.js";

function snapId(): string {
  return crypto.randomUUID().slice(0, 12);
}

export function RollbackMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["rollback"],
          description: "Roll back to N messages ago",
          usage: "/rollback [<N>|diff <N>]",
          handler: async (args, ctx) => {
            if (!ctx.sessionId) return err("No active session.");
            if (args[0] === "diff") {
              const n = parseInt(args[1] ?? "1", 10);
              if (isNaN(n) || n < 1) return err("N must be ≥ 1.");
              const all = ctx.db.prepare(
                "SELECT content, role FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?"
              ).all(ctx.sessionId, n * 2) as Array<{ content: string; role: string }>;
              if (!all.length) return output("No messages to diff.");
              return output(
                all.reverse().map((m) => `[${m.role === "user" ? "You" : m.role === "assistant" ? "AI" : "Tool"}] ${typeof m.content === "string" ? m.content.slice(0, 200) : JSON.stringify(m.content).slice(0, 200)}`).join("\n\n")
              );
            }
            const n = parseInt(args[0] ?? "1", 10);
            if (isNaN(n) || n < 1) return err("Usage: /rollback [N]  (N ≥ 1)");
            const exchangeCount = n * 2;
            const allIds = ctx.db.prepare(
              "SELECT id FROM messages WHERE session_id = ? ORDER BY timestamp DESC"
            ).all(ctx.sessionId) as Array<{ id: string }>;
            if (allIds.length < exchangeCount) return err(`Only ${allIds.length} messages available, cannot rollback ${n} exchanges.`);
            const toKeep = allIds.slice(exchangeCount).map((r) => r.id);
            if (toKeep.length === 0) {
              ctx.db.prepare("DELETE FROM messages WHERE session_id = ?").run(ctx.sessionId);
            } else {
              const placeholders = toKeep.map(() => "?").join(",");
              ctx.db.prepare(`DELETE FROM messages WHERE session_id = ? AND id NOT IN (${placeholders})`).run(ctx.sessionId, ...toKeep);
            }
            return output(`Rolled back ${n} exchange(s).`);
          },
          complete: async () => ["diff"],
        },
        {
          path: ["rollback", "diff"],
          description: "Preview what rolling back N exchanges would remove",
          usage: "/rollback diff <N>",
          handler: async (args, ctx) => {
            if (!ctx.sessionId) return err("No active session.");
            const n = parseInt(args[0] ?? "1", 10);
            if (isNaN(n) || n < 1) return err("N must be ≥ 1.");
            const toRemove = ctx.db.prepare(
              "SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?"
            ).all(ctx.sessionId, n * 2) as Array<{ role: string; content: string }>;
            if (!toRemove.length) return output("No messages to remove.");
            return output(
              "Would remove:\n" +
              toRemove.reverse().map((m) => `  [${m.role}] ${typeof m.content === "string" ? m.content.slice(0, 120) : JSON.stringify(m.content).slice(0, 120)}`).join("\n")
            );
          },
        },
        {
          path: ["snapshot"],
          description: "Manage conversation snapshots (persisted to SQLite)",
          usage: "/snapshot [create|restore|prune|list|delete]",
          handler: async (args, ctx) => {
            const sub = args[0] ?? "list";
            if (sub === "list") {
              const snaps = listSnapshots(ctx.db, ctx.sessionId ?? undefined);
              if (!snaps.length) return output("No snapshots. Use /snapshot create.");
              return output(
                snaps.map((s) =>
                  `  ${s.id.slice(0, 12).padEnd(14)} "${s.label.padEnd(24)}" ${s.messageIds.length} msgs  ${new Date(s.createdAt).toLocaleString()}`
                ).join("\n")
              );
            }
            return err(`Usage: /snapshot [create|restore|prune|list|delete]`);
          },
          complete: async () => ["create", "restore", "prune", "list", "delete"],
        },
        {
          path: ["snapshot", "list"],
          description: "List all snapshots for this session",
          usage: "/snapshot list",
          handler: async (_args, ctx) => {
            const snaps = listSnapshots(ctx.db, ctx.sessionId ?? undefined);
            if (!snaps.length) return output("No snapshots.");
            return output(snaps.map((s) =>
              `  ${s.id.slice(0, 12).padEnd(14)} "${s.label}"  ${s.messageIds.length} msgs  ${new Date(s.createdAt).toLocaleString()}`
            ).join("\n"));
          },
        },
        {
          path: ["snapshot", "create"],
          description: "Create a snapshot of current session messages",
          usage: "/snapshot create [<label>]",
          handler: async (args, ctx) => {
            if (!ctx.sessionId) return err("No active session.");
            const label = args.join(" ").trim() || `snap-${new Date().toLocaleTimeString()}`;
            const msgRows = ctx.db.prepare(
              "SELECT id FROM messages WHERE session_id = ? ORDER BY timestamp ASC"
            ).all(ctx.sessionId) as Array<{ id: string }>;
            if (!msgRows.length) return err("No messages to snapshot.");
            createSnapshot(ctx.db, {
              id: snapId(),
              sessionId: ctx.sessionId,
              label,
              messageIds: msgRows.map((r) => r.id),
              createdAt: Date.now(),
            });
            return output(`Snapshot created: "${label}" (${msgRows.length} messages)`);
          },
        },
        {
          path: ["snapshot", "restore"],
          description: "Restore a snapshot by ID — replaces current session messages",
          usage: "/snapshot restore <id>",
          handler: async (args, ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /snapshot restore <id>");
            const snap = getSnapshot(ctx.db, id);
            if (!snap) return err(`Snapshot not found: ${id}`);
            if (snap.sessionId !== ctx.sessionId) return err("Snapshot belongs to a different session.");
            const existing = ctx.db.prepare(
              "SELECT id FROM messages WHERE session_id = ?"
            ).all(ctx.sessionId) as Array<{ id: string }>;
            const existingIds = new Set(existing.map((r) => r.id));
            const toDelete = existing.filter((r) => !snap.messageIds.includes(r.id)).map((r) => r.id);
            const toAdd = snap.messageIds.filter((id) => !existingIds.has(id));
            const deleteStmt = ctx.db.prepare("DELETE FROM messages WHERE id = ? AND session_id = ?");
            const tx = ctx.db.transaction(() => {
              for (const did of toDelete) deleteStmt.run(did, ctx.sessionId!);
            });
            tx();
            return output(
              `Restored snapshot: "${snap.label}" — removed ${toDelete.length} messages${toAdd.length ? ` (${toAdd.length} missing messages not in current session)` : ""}`
            );
          },
          complete: async () => [],
        },
        {
          path: ["snapshot", "delete"],
          description: "Delete a snapshot by ID",
          usage: "/snapshot delete <id>",
          handler: async (args, ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /snapshot delete <id>");
            deleteSnapshot(ctx.db, id);
            return output(`Deleted snapshot: ${id}`);
          },
          complete: async () => [],
        },
        {
          path: ["snapshot", "prune"],
          description: "Keep N most recent snapshots, delete the rest",
          usage: "/snapshot prune [N]",
          handler: async (args, ctx) => {
            const keep = parseInt(args[0] ?? "5", 10);
            if (isNaN(keep) || keep < 1) return err("N must be ≥ 1.");
            const removed = pruneSnapshots(ctx.db, keep);
            return output(`Pruned ${removed} snapshot(s).`);
          },
        },
      ]);
    }
  };
}
