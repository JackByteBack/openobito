import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

export function BackupMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["backup"],
          description: "Create and manage backups",
          usage: "/backup [create|list|restore|delete|prune]",
          handler: async (args, ctx) => {
            const sub = args[0] ?? "list";
            const { BackupSystem } = await import("../../../backup/index.js");
            const backup = new BackupSystem();
            if (sub === "create") {
              const name = args.slice(1).join(" ") || undefined;
              const result = backup.createFull(ctx.configPath.replace("config.yaml", "openagent.db"), name);
              return output(`Backup created: ${result.id}  "${result.name}"  (${(result.sizeBytes / 1024).toFixed(1)}KB)`);
            }
            if (sub === "list") {
              const list = backup.list();
              if (!list.length) return output("No backups. Use /backup create.");
              return output(list.map((b) =>
                `  ${b.id.padEnd(20)} ${b.type.padEnd(8)} ${(b.sizeBytes / 1024).toFixed(1).padStart(7)}KB  ${new Date(b.createdAt).toLocaleString()}`
              ).join("\n"));
            }
            if (sub === "restore") {
              const id = args[1];
              if (!id) return err("Usage: /backup restore <id>");
              try {
                const restored = backup.restore(id, ctx.configPath.replace("config.yaml", "openagent.db"));
                return output(`Restored from ${id} — files: ${restored.join(", ")}`);
              } catch (e) { return err(String(e)); }
            }
            if (sub === "delete") {
              const id = args[1];
              if (!id) return err("Usage: /backup delete <id>");
              backup.delete(id);
              return output(`Deleted backup: ${id}`);
            }
            if (sub === "prune") {
              const keep = parseInt(args[1] ?? "5", 10);
              const removed = backup.prune(keep);
              return output(`Pruned ${removed} backup(s).`);
            }
            return err("Usage: /backup [create|list|restore|delete|prune]");
          },
          complete: async () => ["create", "list", "restore", "delete", "prune"],
        },
        {
          path: ["backup", "create"],
          description: "Create a full backup",
          usage: "/backup create [name]",
          handler: async (args, ctx) => {
            const { BackupSystem } = await import("../../../backup/index.js");
            const backup = new BackupSystem();
            const name = args.join(" ") || undefined;
            const result = backup.createFull(ctx.configPath.replace("config.yaml", "openagent.db"), name);
            return output(`Backup created: ${result.id}  (${(result.sizeBytes / 1024).toFixed(1)}KB)`);
          },
        },
        {
          path: ["backup", "list"],
          description: "List all backups",
          usage: "/backup list",
          handler: async () => {
            const { BackupSystem } = await import("../../../backup/index.js");
            const backups = new BackupSystem().list();
            if (!backups.length) return output("No backups.");
            return output(backups.map((b) =>
              `  ${b.id.slice(0, 16).padEnd(18)} ${b.type.padEnd(8)} ${(b.sizeBytes / 1024).toFixed(1).padStart(6)}KB  ${new Date(b.createdAt).toLocaleDateString()}`
            ).join("\n"));
          },
        },
        {
          path: ["backup", "restore"],
          description: "Restore from a backup",
          usage: "/backup restore <id>",
          handler: async (args, ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /backup restore <id>");
            const { BackupSystem } = await import("../../../backup/index.js");
            try {
              const restored = new BackupSystem().restore(id, ctx.configPath.replace("config.yaml", "openagent.db"));
              return output(`Restored: ${restored.join(", ")}`);
            } catch (e) { return err(String(e)); }
          },
        },
        {
          path: ["backup", "delete"],
          description: "Delete a backup",
          usage: "/backup delete <id>",
          handler: async (args) => {
            const id = args[0];
            if (!id) return err("Usage: /backup delete <id>");
            const { BackupSystem } = await import("../../../backup/index.js");
            new BackupSystem().delete(id);
            return output(`Deleted: ${id}`);
          },
        },
        {
          path: ["backup", "prune"],
          description: "Keep N most recent backups, delete the rest",
          usage: "/backup prune [N]",
          handler: async (args) => {
            const keep = parseInt(args[0] ?? "5", 10);
            const { BackupSystem } = await import("../../../backup/index.js");
            const removed = new BackupSystem().prune(keep);
            return output(`Pruned ${removed} backup(s).`);
          },
        },
      ]);
    }
  };
}
