import { execSync } from "child_process";
import type { RegisteredTool } from "../registry.js";

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  /mkfs/,
  /dd\s+if=/,
  />\s*\/dev\/(sda|hda|nvme)/,
  /shutdown/,
  /reboot/,
  /format\s+c:/i,
];

function isSafeCommand(cmd: string): boolean {
  return !BLOCKED_PATTERNS.some((p) => p.test(cmd));
}

export const shellExecTool: RegisteredTool = {
  schema: {
    name: "shell_exec",
    description:
      "Execute a shell command and return stdout/stderr. High-risk; always requires approval.",
    parameters: {
      command: { type: "string", description: "Shell command to execute", required: true },
      timeout_ms: {
        type: "number",
        description: "Timeout in milliseconds (default 10000)",
        required: false,
      },
    },
  },
  async handler({ command, timeout_ms = 10000 }) {
    const cmd = String(command);
    if (!isSafeCommand(cmd)) {
      return `Blocked: command matches a dangerous pattern.`;
    }

    try {
      const output = execSync(cmd, {
        timeout: Number(timeout_ms),
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      });
      return output.trim() || "(no output)";
    } catch (err: unknown) {
      if (err && typeof err === "object" && "stdout" in err) {
        const e = err as { stdout: string; stderr: string; status: number };
        const out = (e.stdout ?? "").trim();
        const errOut = (e.stderr ?? "").trim();
        return `Exit ${e.status ?? 1}\n${out}\n${errOut}`.trim();
      }
      return `Error: ${String(err)}`;
    }
  },
};
