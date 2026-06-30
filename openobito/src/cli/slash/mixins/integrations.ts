import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";
import { INTEGRATIONS } from "../complete.js";

// ─── Integrations mixin (Phase 3 stubs) ──────────────────────────────────────
// /integrate /gateway /telegram /discord /slack

export function IntegrationsMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["integrate"],
          description: "Manage third-party integrations",
          usage: "/integrate [list|add] [<service>]",
          handler: async (args, _ctx) => {
            const sub = args[0];
            if (!sub || sub === "list")
              return output(
                `Available integrations:\n${INTEGRATIONS.map((i) => `  ${i}`).join("\n")}\n\nUse /integrate add <service> to connect.`
              );
            if (sub === "add") {
              const svc = args[1];
              if (!svc) return err("Usage: /integrate add <service>");
              return output(`Setting up ${svc}… (Phase 3 feature)`);
            }
            return err(`Unknown subcommand: ${sub}`);
          },
          complete: async () => ["list", "add", ...INTEGRATIONS],
        },
        {
          path: ["integrate", "list"],
          description: "List available integrations",
          usage: "/integrate list",
          handler: async () =>
            output(INTEGRATIONS.map((i) => `  ${i}`).join("\n")),
        },
        {
          path: ["integrate", "add"],
          description: "Connect a new integration",
          usage: "/integrate add <service>",
          handler: async (args) => {
            const svc = args[0];
            if (!svc) return err("Usage: /integrate add <service>");
            return output(`Integration: ${svc} — coming in Phase 3.`);
          },
          complete: async () => [...INTEGRATIONS],
        },
        {
          path: ["gateway"],
          description: "Manage the OpenAgent API gateway",
          usage: "/gateway <start|stop|status>",
          handler: async (args) => {
            const sub = args[0];
            switch (sub) {
              case "start": return output("Gateway starting… (Phase 3)");
              case "stop": return output("Gateway stopping… (Phase 3)");
              case "status": return output("Gateway status: not running (Phase 3)");
              default: return err("Usage: /gateway <start|stop|status>");
            }
          },
          complete: async () => ["start", "stop", "status"],
        },
        {
          path: ["telegram"],
          description: "Connect a Telegram bot token",
          usage: "/telegram <token>",
          handler: async (args) => {
            const token = args[0];
            if (!token) return err("Usage: /telegram <bot_token>");
            return output(`Telegram bot token stored. Gateway integration in Phase 3.`);
          },
        },
        {
          path: ["discord"],
          description: "Connect a Discord bot token",
          usage: "/discord <token>",
          handler: async (args) => {
            const token = args[0];
            if (!token) return err("Usage: /discord <bot_token>");
            return output(`Discord token stored. Integration in Phase 3.`);
          },
        },
        {
          path: ["slack"],
          description: "Connect a Slack token",
          usage: "/slack <token>",
          handler: async (args) => {
            const token = args[0];
            if (!token) return err("Usage: /slack <bot_token>");
            return output(`Slack token stored. Integration in Phase 3.`);
          },
        },
      ]);
    }
  };
}
