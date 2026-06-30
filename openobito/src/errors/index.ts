export class CLIError extends Error {
  readonly code: string;
  readonly fix: string | undefined;

  constructor(code: string, message: string, fix?: string) {
    super(message);
    this.name = "CLIError";
    this.code = code;
    this.fix = fix;
  }

  format(): string {
    let out = `\u274C ${this.code}\n  Message: ${this.message}`;
    if (this.fix) out += `\n  Fix: ${this.fix}`;
    out += `\n  Learn more: /help ${this.code.toLowerCase()}`;
    return out;
  }
}

export class SystemError extends Error {
  readonly code: string;

  constructor(code: string, message: string, public readonly original?: Error) {
    super(message);
    this.name = "SystemError";
    this.code = code;
  }
}

export class SecurityError extends Error {
  readonly code: string;
  readonly detail: string | undefined;

  constructor(code: string, message: string, detail?: string) {
    super(message);
    this.name = "SecurityError";
    this.code = code;
    this.detail = detail;
  }

  format(): string {
    let out = `\u274C ${this.code}\n  Message: ${this.message}`;
    if (this.detail) out += `\n  Detail: ${this.detail}`;
    return out;
  }
}

export class RecoverableError extends Error {
  readonly code: string;
  readonly retryAfter: number;

  constructor(code: string, message: string, retryAfterMs = 1000) {
    super(message);
    this.name = "RecoverableError";
    this.code = code;
    this.retryAfter = retryAfterMs;
  }
}

const ERROR_CODES: Record<string, { message: string; fix?: string }> = {
  NODE_VERSION: { message: "Node.js 18+ required", fix: "Install Node.js 18+ from nodejs.org" },
  OLLAMA_NOT_RUNNING: { message: "Ollama is not running", fix: "Run: ollama serve" },
  OLLAMA_UNREACHABLE: { message: "Cannot connect to Ollama", fix: "Check model.base_url in config" },
  MODEL_NOT_FOUND: { message: "Model not installed", fix: "Run: ollama pull <model>" },
  MODEL_FAILED: { message: "Model returned an error", fix: "Try a different model or reduce max_tokens" },
  TOOL_DENIED: { message: "Tool execution denied by policy" },
  TOOL_FAILED: { message: "Tool execution failed" },
  PERMISSION_DENIED: { message: "Permission denied", fix: "Change security.level in config" },
  CONFIG_INVALID: { message: "Configuration validation failed", fix: "Run: openagent config validate" },
  CONFIG_KEY_UNKNOWN: { message: "Unknown config key", fix: "Run: openagent config schema" },
  DB_ERROR: { message: "Database error" },
  SESSION_NOT_FOUND: { message: "Session not found" },
  MEMORY_FULL: { message: "Memory storage is full", fix: "Increase memory.max_sessions in config" },
  SKILL_NOT_FOUND: { message: "Skill not found" },
  SKILL_FAILED: { message: "Skill execution failed" },
  PLUGIN_NOT_FOUND: { message: "Plugin not found" },
  PLUGIN_FAILED: { message: "Plugin execution failed" },
  NETWORK_BLOCKED: { message: "Network access is blocked", fix: "Set network.allow_outbound to true" },
  RATE_LIMITED: { message: "Rate limit exceeded", fix: "Wait before retrying" },
  DISK_FULL: { message: "Not enough disk space", fix: "Free up disk space" },
  INTERNAL: { message: "Internal error" },
};

export function errorCode(code: string, extra?: string): CLIError {
  const def = ERROR_CODES[code];
  if (!def) return new CLIError(code, extra || "Unknown error");
  return new CLIError(code, extra ? `${def.message}: ${extra}` : def.message, def.fix);
}

let _shuttingDown = false;

export function setupGlobalErrorHandler(): void {
  process.on("uncaughtException", (err) => {
    console.error("\n\u274C Uncaught exception:", err.message);
    if (process.env.DEBUG) console.error(err.stack);
    gracefulShutdown(1);
  });

  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error("\n\u274C Unhandled rejection:", msg);
    if (process.env.DEBUG && reason instanceof Error) console.error(reason.stack);
    gracefulShutdown(1);
  });

  process.on("SIGTERM", () => gracefulShutdown(0));
  process.on("SIGINT", () => gracefulShutdown(0));
}

export async function gracefulShutdown(exitCode: number): Promise<void> {
  if (_shuttingDown) return;
  _shuttingDown = true;

  try {
    const { closeDb } = await import("../storage/index.js");
    closeDb();
  } catch {
    // ignore
  }

  process.exit(exitCode);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; onRetry?: (error: Error, attempt: number) => void } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      if (!(err instanceof RecoverableError)) throw err;
      options.onRetry?.(err, attempt);
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Unreachable");
}
