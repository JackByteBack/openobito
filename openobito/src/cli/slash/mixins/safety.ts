import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

export function SafetyMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["safety"],
          description: "Show safety system status overview",
          usage: "/safety [status|policy|audit|check]",
          handler: async (args, ctx) => {
            const sub = args[0] ?? "status";
            if (sub === "status") {
              const rows = ctx.db.prepare(
                "SELECT action, risk_level, COUNT(*) as cnt FROM audit_log GROUP BY action, risk_level ORDER BY cnt DESC LIMIT 10"
              ).all() as Array<{ action: string; risk_level: string; cnt: number }>;
              const summary = rows.length
                ? rows.map((r) => `  ${r.action.padEnd(20)} ${r.risk_level.padEnd(10)} ${r.cnt}`).join("\n")
                : "  (no audit entries yet)";
              return output(
                [
                  `Default action: ${ctx.config.permissions.defaultAction ?? "require_approval"}`,
                  `Policies: ${ctx.config.permissions.policies.length} tool overrides`,
                  "",
                  "Audit summary:",
                  summary,
                ].join("\n")
              );
            }
            if (sub === "policy") {
              const policies = ctx.config.permissions?.policies ?? [];
              if (!policies.length) return output("No custom policies. Default: require_approval for all tools.");
              return output(
                "Tool policies:\n" +
                  policies.map((p) => `  ${p.action.padEnd(20)} ${p.toolName.padEnd(22)} ${p.riskLevel}`).join("\n")
              );
            }
            if (sub === "audit") {
              const rows = ctx.db.prepare(
                "SELECT tool_name, action, approved, timestamp FROM audit_log ORDER BY timestamp DESC LIMIT 30"
              ).all() as Array<{ tool_name: string; action: string; approved: number; timestamp: number }>;
              if (!rows.length) return output("No audit entries yet.");
              return output(
                rows.map((r) =>
                  `  ${r.approved ? "✓" : "✗"} ${r.tool_name.padEnd(20)} ${r.action.padEnd(16)} ${new Date(r.timestamp).toLocaleString()}`
                ).join("\n")
              );
            }
            if (sub === "check") {
              const target = args[1] ?? "write_file";
              const { SafetySystem } = await import("../../../safety/index.js");
              const safety = new SafetySystem({ sessionId: ctx.sessionId ?? "anon" });
              const result = safety.check(target, { path: "/tmp/test.txt" });
              const lines = [
                `Tool:        ${target}`,
                `Action:      ${result.action}`,
                `Risk:        ${result.riskLevel}`,
                `Blocked:     ${result.hardBlocked ? "YES — " + (result.hardBlockReason ?? "") : "no"}`,
                `Rate-limit:  ${result.rateLimited ? "YES" : "no"}`,
                `Access:      ${result.accessDenied ? "DENIED — " + (result.accessDenyReason ?? "") : "ok"}`,
                `Credentials: ${result.credentialWarnings?.length ? result.credentialWarnings.join(", ") : "none detected"}`,
              ];
              return output(lines.join("\n"));
            }
            return err("Usage: /safety [status|policy|audit|check]");
          },
          complete: async () => ["status", "policy", "audit", "check"],
        },
        {
          path: ["safety", "status"],
          description: "Show safety system status",
          usage: "/safety status",
          handler: async (_args, ctx) => {
            const rows = ctx.db.prepare(
              "SELECT action, COUNT(*) as cnt FROM audit_log GROUP BY action"
            ).all() as Array<{ action: string; cnt: number }>;
            return output(
              [
                  `Default action: ${ctx.config.permissions.defaultAction}`,
                  `Policies: ${ctx.config.permissions.policies.length} overrides`,
                `Audit entries: ${rows.reduce((s, r) => s + r.cnt, 0)}`,
              ].join("\n")
            );
          },
        },
        {
          path: ["safety", "policy"],
          description: "Show current tool policies",
          usage: "/safety policy",
          handler: async (_args, ctx) => {
            const policies = ctx.config.permissions?.policies ?? [];
            if (!policies.length) return output("Default policy: require_approval for all tools.");
            return output(policies.map((p) => `  ${p.action.padEnd(20)} ${p.toolName}`).join("\n"));
          },
        },
        {
          path: ["safety", "audit"],
          description: "Show recent audit log entries",
          usage: "/safety audit [--last N]",
          handler: async (args, ctx) => {
            const lastIdx = args.indexOf("--last");
            const limit = lastIdx >= 0 ? parseInt(args[lastIdx + 1] ?? "20", 10) : 20;
            const rows = ctx.db.prepare(
              "SELECT tool_name, action, approved, timestamp FROM audit_log ORDER BY timestamp DESC LIMIT ?"
            ).all(limit) as Array<{ tool_name: string; action: string; approved: number; timestamp: number }>;
            if (!rows.length) return output("No audit entries.");
            return output(rows.map((r) =>
              `  ${r.approved ? "✓" : "✗"} ${r.tool_name.padEnd(20)} ${r.action.padEnd(16)} ${new Date(r.timestamp).toLocaleString()}`
            ).join("\n"));
          },
          complete: async () => ["--last"],
        },
        {
          path: ["safety", "check"],
          description: "Test what policy would apply to a tool",
          usage: "/safety check <tool-name>",
          handler: async (args, _ctx) => {
            const target = args[0];
            if (!target) return err("Usage: /safety check <tool-name>");
            const { SafetySystem } = await import("../../../safety/index.js");
            const safety = new SafetySystem({ sessionId: "cli" });
            const result = safety.check(target, { path: "/tmp/test.txt" });
            return output(
              [
                `Tool:  ${target}`,
                `Rule:  ${result.action}`,
                `Risk:  ${result.riskLevel}`,
                `Block: ${result.hardBlocked ? "YES" : "no"}`,
              ].join("\n")
            );
          },
          complete: async () => ["read_file", "write_file", "shell_exec", "fetch_url", "list_directory"],
        },
      ]);
    }
  };
}
