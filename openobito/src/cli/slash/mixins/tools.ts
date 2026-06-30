import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";
import { toolNames } from "../complete.js";

// ─── Tools & Execution mixin ───────────────────────────────────────────────────
// /tools /exec /shell /run-script

export function ToolsMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["tools"],
          description: "List registered tools",
          usage: "/tools [--enabled|info|enable|disable|audit]",
          handler: async (args, ctx) => {
            const { createDefaultRegistry } = await import(
              "../../../tools/index.js"
            );
            const reg = createDefaultRegistry();
            const list = reg.list();
            const flag = args[0];
            if (!flag || flag === "--enabled") {
              return output(
                `Tools (${list.length}):\n` +
                  list
                    .map((t) => {
                      const policy = ctx.config.permissions.policies.find(
                        (p) => p.toolName === t.schema.name
                      );
                      const action = policy?.action ?? ctx.config.permissions.defaultAction;
                      const icon =
                        action === "allow"
                          ? "✓"
                          : action === "deny"
                            ? "✗"
                            : "?";
                      return `  ${icon} ${t.schema.name.padEnd(22)} ${t.schema.description}`;
                    })
                    .join("\n")
              );
            }
            return err(`Unknown flag: ${flag}`);
          },
          complete: async () => ["--enabled", "info", "enable", "disable", "audit"],
        },
        {
          path: ["tools", "info"],
          description: "Show details about a tool",
          usage: "/tools info <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /tools info <name>");
            const { createDefaultRegistry } = await import("../../../tools/index.js");
            const tool = createDefaultRegistry().get(name);
            if (!tool) return err(`Tool not found: ${name}`);
            const params = Object.entries(tool.schema.parameters)
              .map(([k, v]) => `  ${k}: ${v.type}${v.required ? " (required)" : ""} — ${v.description}`)
              .join("\n");
            return output(`${tool.schema.name}\n${tool.schema.description}\n\nParameters:\n${params}`);
          },
          complete: async () => toolNames(),
        },
        {
          path: ["tools", "enable"],
          description: "Allow a tool (override policy to allow)",
          usage: "/tools enable <name>",
          handler: async (args, ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /tools enable <name>");
            const existing = ctx.config.permissions.policies.find(
              (p) => p.toolName === name
            );
            if (existing) existing.action = "allow";
            else
              ctx.config.permissions.policies.push({
                toolName: name,
                action: "allow",
                riskLevel: "low",
              });
            return output(`Tool enabled: ${name}`);
          },
          complete: async () => toolNames(),
        },
        {
          path: ["tools", "disable"],
          description: "Deny a tool (override policy to deny)",
          usage: "/tools disable <name>",
          handler: async (args, ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /tools disable <name>");
            const existing = ctx.config.permissions.policies.find(
              (p) => p.toolName === name
            );
            if (existing) existing.action = "deny";
            else
              ctx.config.permissions.policies.push({
                toolName: name,
                action: "deny",
                riskLevel: "low",
              });
            return output(`Tool disabled: ${name}`);
          },
          complete: async () => toolNames(),
        },
        {
          path: ["tools", "audit"],
          description: "Show recent tool execution audit log",
          usage: "/tools audit",
          handler: async (_args, ctx) => {
            const rows = ctx.db
              .prepare(
                "SELECT tool_name, action, risk_level, approved, timestamp FROM audit_log ORDER BY timestamp DESC LIMIT 20"
              )
              .all() as Array<{
                tool_name: string;
                action: string;
                risk_level: string;
                approved: number;
                timestamp: number;
              }>;
            if (rows.length === 0) return output("No tool executions yet.");
            return output(
              rows
                .map(
                  (r) =>
                    `  ${r.approved ? "✓" : "✗"} ${r.tool_name.padEnd(18)} ${r.action.padEnd(16)} ${r.risk_level.padEnd(8)} ${new Date(r.timestamp).toLocaleTimeString()}`
                )
                .join("\n")
            );
          },
        },
        {
          path: ["exec"],
          description: "Execute a shell command directly",
          usage: "/exec [--safe|--timeout <s>|--dry-run] <command>",
          detail: "Flags:\n  --safe      reject if not in allowlist\n  --timeout N  kill after N seconds\n  --dry-run   print command, do not run",
          handler: async (args, _ctx) => {
            let cmd = args.join(" ");
            const dryRun = args.includes("--dry-run");
            const safe = args.includes("--safe");
            const timeoutIdx = args.indexOf("--timeout");
            const timeout =
              timeoutIdx >= 0 ? parseInt(args[timeoutIdx + 1] ?? "10", 10) * 1000 : 10000;

            cmd = cmd
              .replace(/--dry-run\s*/g, "")
              .replace(/--safe\s*/g, "")
              .replace(/--timeout\s+\d+\s*/g, "")
              .trim();

            if (!cmd) return err("Usage: /exec <command>");
            if (dryRun) return output(`[dry-run] Would execute: ${cmd}`);
            if (safe && /[;&|`$()]/.test(cmd))
              return err("Command rejected by --safe: shell metacharacters detected.");

            const { execSync } = await import("child_process");
            try {
              const out = execSync(cmd, { encoding: "utf8", timeout, maxBuffer: 1_048_576 });
              return output(out.trim() || "(no output)");
            } catch (e: unknown) {
              if (e && typeof e === "object" && "stdout" in e) {
                const ex = e as { stdout: string; stderr: string; status: number };
                return output(`Exit ${ex.status}:\n${ex.stdout}\n${ex.stderr}`.trim());
              }
              return err(String(e));
            }
          },
          complete: async () => ["--safe", "--timeout", "--dry-run"],
        },
        {
          path: ["shell"],
          description: "Launch an interactive sub-shell",
          usage: "/shell",
          handler: async (_args, _ctx) => {
            const { execSync } = await import("child_process");
            const sh = process.env["SHELL"] ?? "/bin/sh";
            execSync(sh, { stdio: "inherit" });
            return output("Returned from shell.");
          },
        },
        {
          path: ["run-script"],
          description: "Execute a script file",
          usage: "/run-script <file>",
          handler: async (args, _ctx) => {
            const file = args[0];
            if (!file) return err("Usage: /run-script <file>");
            const { execSync } = await import("child_process");
            try {
              const out = execSync(`bash "${file}"`, {
                encoding: "utf8",
                timeout: 60000,
                maxBuffer: 10_485_760,
              });
              return output(out.trim());
            } catch (e) {
              return err(`Script failed: ${String(e)}`);
            }
          },
        },
      ]);
    }
  };
}
