// Layer 6 — Rate Limiting (sliding-window counters)

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  bucket: string;
}

interface Window {
  timestamps: number[];
  windowMs: number;
  max: number;
}

// Rate limit buckets and their thresholds
export const RATE_LIMIT_CONFIGS: Record<string, { windowMs: number; max: number }> = {
  commands:          { windowMs: 60_000,     max: 60   },  // 60/min
  commands_hourly:   { windowMs: 3_600_000,  max: 1000 },  // 1000/hr
  file_delete:       { windowMs: 3_600_000,  max: 10   },  // 10 deletes/hr
  file_write:        { windowMs: 60_000,     max: 30   },  // 30 writes/min
  git_push:          { windowMs: 3_600_000,  max: 20   },  // 20 pushes/hr
  network:           { windowMs: 60_000,     max: 10   },  // 10 requests/min
  tool_calls:        { windowMs: 0,          max: 10   },  // 10 per agent message (reset manually)
  shell_exec:        { windowMs: 60_000,     max: 20   },  // 20 shell execs/min
};

// Map tool names to their rate-limit bucket(s)
const TOOL_BUCKETS: Record<string, string[]> = {
  shell_exec:      ["commands", "commands_hourly", "shell_exec"],
  write_file:      ["commands", "commands_hourly", "file_write"],
  delete_file:     ["commands", "commands_hourly", "file_delete"],
  web_fetch:       ["commands", "commands_hourly", "network"],
  git_push:        ["commands", "commands_hourly", "git_push"],
  git_commit:      ["commands", "commands_hourly"],
  read_file:       ["commands", "commands_hourly"],
  list_directory:  ["commands", "commands_hourly"],
};

export class RateLimiter {
  private windows: Map<string, Window> = new Map();
  private messageToolCount = 0;

  private getOrCreate(bucket: string): Window {
    let w = this.windows.get(bucket);
    if (!w) {
      const cfg = RATE_LIMIT_CONFIGS[bucket] ?? { windowMs: 60_000, max: 60 };
      w = { timestamps: [], windowMs: cfg.windowMs, max: cfg.max };
      this.windows.set(bucket, w);
    }
    return w;
  }

  private prune(w: Window): void {
    if (w.windowMs === 0) return;
    const cutoff = Date.now() - w.windowMs;
    w.timestamps = w.timestamps.filter((t) => t > cutoff);
  }

  check(bucket: string): RateLimitResult {
    if (bucket === "tool_calls") {
      return {
        allowed: this.messageToolCount < (RATE_LIMIT_CONFIGS["tool_calls"]?.max ?? 10),
        remaining: Math.max(0, (RATE_LIMIT_CONFIGS["tool_calls"]?.max ?? 10) - this.messageToolCount),
        resetAt: 0,
        bucket,
      };
    }
    const w = this.getOrCreate(bucket);
    this.prune(w);
    const remaining = Math.max(0, w.max - w.timestamps.length);
    const resetAt = w.timestamps.length > 0
      ? (w.timestamps[0] ?? 0) + w.windowMs
      : Date.now() + w.windowMs;
    return { allowed: remaining > 0, remaining, resetAt, bucket };
  }

  consume(bucket: string): RateLimitResult {
    if (bucket === "tool_calls") {
      this.messageToolCount++;
      const max = RATE_LIMIT_CONFIGS["tool_calls"]?.max ?? 10;
      return {
        allowed: this.messageToolCount <= max,
        remaining: Math.max(0, max - this.messageToolCount),
        resetAt: 0,
        bucket,
      };
    }
    const w = this.getOrCreate(bucket);
    this.prune(w);
    if (w.timestamps.length >= w.max) {
      const resetAt = (w.timestamps[0] ?? 0) + w.windowMs;
      return { allowed: false, remaining: 0, resetAt, bucket };
    }
    w.timestamps.push(Date.now());
    const remaining = w.max - w.timestamps.length;
    const resetAt = (w.timestamps[0] ?? 0) + w.windowMs;
    return { allowed: true, remaining, resetAt, bucket };
  }

  // Check AND consume all buckets for a tool. Returns first failure if any.
  checkAndConsumeTool(toolName: string): RateLimitResult {
    const buckets = TOOL_BUCKETS[toolName] ?? ["commands", "commands_hourly"];
    const allBuckets = [...buckets, "tool_calls"];

    // Check all first (don't consume if any would fail)
    for (const bucket of allBuckets) {
      const result = this.check(bucket);
      if (!result.allowed) return result;
    }

    // Consume all
    let last: RateLimitResult = { allowed: true, remaining: 999, resetAt: 0, bucket: "commands" };
    for (const bucket of allBuckets) {
      last = this.consume(bucket);
    }
    return last;
  }

  reset(bucket: string): void {
    this.windows.delete(bucket);
  }

  // Call at the start of each agent message turn
  resetMessageCounter(): void {
    this.messageToolCount = 0;
  }

  snapshot(): Record<string, { count: number; max: number; resetAt: number }> {
    const out: Record<string, { count: number; max: number; resetAt: number }> = {};
    for (const [bucket, w] of this.windows) {
      this.prune(w);
      const resetAt = w.timestamps.length > 0 ? (w.timestamps[0] ?? 0) + w.windowMs : Date.now();
      out[bucket] = { count: w.timestamps.length, max: w.max, resetAt };
    }
    out["tool_calls"] = {
      count: this.messageToolCount,
      max: RATE_LIMIT_CONFIGS["tool_calls"]?.max ?? 10,
      resetAt: 0,
    };
    return out;
  }
}
