// Layer 4 — Sandboxed Execution
// Wraps spawnSync with timeout, memory limits, env filtering, and allowed-dir checks.

import { spawnSync } from "child_process";
import { resolve } from "path";
import { homedir } from "os";
import type { SandboxOptions, SandboxResult } from "./types.js";

// ─── Environment filtering ────────────────────────────────────────────────────

// Variables that must never be passed to child processes
const BLOCKED_ENV_PATTERNS: RegExp[] = [
  /AWS_ACCESS_KEY/i,
  /AWS_SECRET/i,
  /AWS_SESSION_TOKEN/i,
  /API_KEY/i,
  /APIKEY/i,
  /GITHUB_TOKEN/i,
  /GH_TOKEN/i,
  /GITLAB_TOKEN/i,
  /NPM_TOKEN/i,
  /PYPI_TOKEN/i,
  /DOCKER_PASSWORD/i,
  /HEROKU_API_KEY/i,
  /PASSWORD/i,
  /PASSWD/i,
  /SECRET/i,
  /PRIVATE_KEY/i,
  /AUTH_TOKEN/i,
  /ACCESS_TOKEN/i,
  /REFRESH_TOKEN/i,
  /JWT_SECRET/i,
  /DATABASE_URL/i,
  /DB_PASSWORD/i,
  /REDIS_URL/i,
  /STRIPE_KEY/i,
  /OPENAI_API_KEY/i,
  /ANTHROPIC_API_KEY/i,
];

export function filterEnv(
  source: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(source)) {
    if (val === undefined) continue;
    if (BLOCKED_ENV_PATTERNS.some((re) => re.test(key))) continue;
    out[key] = val;
  }
  return out;
}

// ─── Allowed directories ──────────────────────────────────────────────────────

const ALLOWED_BASE_DIRS = [
  process.cwd(),
  resolve(homedir(), ".openagent"),
  resolve(homedir(), "Desktop"),
  resolve(homedir(), "Documents"),
  resolve(homedir(), "Downloads"),
  resolve(homedir(), "projects"),
  resolve(homedir(), "dev"),
  resolve(homedir(), "code"),
  "/tmp",
  "/var/tmp",
];

export function isAllowedCwd(dir: string): boolean {
  const abs = resolve(dir);
  return ALLOWED_BASE_DIRS.some(
    (allowed) => abs === allowed || abs.startsWith(allowed + "/")
  );
}

// ─── Sandbox defaults ─────────────────────────────────────────────────────────

export const SANDBOX_DEFAULTS: Required<Omit<SandboxOptions, "env" | "cwd">> = {
  timeout: 5_000,         // 5 second hard limit
  maxBuffer: 524_288,     // 512 KB output cap
};

// ─── sandboxExec ─────────────────────────────────────────────────────────────

export function sandboxExec(
  cmd: string,
  opts: SandboxOptions = {}
): SandboxResult {
  const timeout = opts.timeout ?? SANDBOX_DEFAULTS.timeout;
  const maxBuffer = opts.maxBuffer ?? SANDBOX_DEFAULTS.maxBuffer;
  const cwd = opts.cwd ?? process.cwd();

  // Validate CWD is within allowed dirs
  if (!isAllowedCwd(cwd)) {
    return {
      stdout: "",
      stderr: `Sandbox violation: cwd "${cwd}" is outside allowed directories.`,
      exitCode: 1,
      timedOut: false,
      durationMs: 0,
    };
  }

  const env = opts.env ?? filterEnv();

  const t0 = Date.now();
  const result = spawnSync("/bin/sh", ["-c", cmd], {
    cwd,
    env,
    timeout,
    maxBuffer,
    encoding: "utf8",
  });
  const durationMs = Date.now() - t0;

  const timedOut = result.signal === "SIGTERM" || result.error?.message?.includes("ETIMEDOUT") || false;
  const stdout = (result.stdout ?? "").slice(0, maxBuffer);
  const stderr = (result.stderr ?? "").slice(0, maxBuffer);
  const exitCode = result.status ?? (timedOut ? 124 : 1);

  return { stdout, stderr, exitCode, timedOut, durationMs };
}

// Async wrapper — thin shim that runs sandboxExec in next tick to avoid
// blocking the event loop on long commands (spawnSync is inherently blocking;
// for truly non-blocking execution, use spawn() with a Promise wrapper instead).
export async function sandboxExecAsync(
  cmd: string,
  opts: SandboxOptions = {}
): Promise<SandboxResult> {
  return new Promise((resolve_) => {
    setImmediate(() => resolve_(sandboxExec(cmd, opts)));
  });
}
