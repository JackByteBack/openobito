import { describe, it, expect } from "vitest";
import { RateLimiter } from "../../src/safety/ratelimit.js";

describe("RateLimiter", () => {
  it("allows first consumption", () => {
    const rl = new RateLimiter();
    const result = rl.consume("commands");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("tracks tool_calls per message", () => {
    const rl = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      expect(rl.consume("tool_calls").allowed).toBe(true);
    }
    expect(rl.consume("tool_calls").allowed).toBe(false);
    rl.resetMessageCounter();
    expect(rl.consume("tool_calls").allowed).toBe(true);
  });

  it("checkAndConsumeTool validates all buckets", () => {
    const rl = new RateLimiter();
    const result = rl.checkAndConsumeTool("shell_exec");
    expect(result.allowed).toBe(true);
  });

  it("blocks after exceeding limit", () => {
    const rl = new RateLimiter();
    const bucket = "file_delete";
    for (let i = 0; i < 10; i++) {
      rl.consume(bucket);
    }
    expect(rl.consume(bucket).allowed).toBe(false);
  });

  it("resets a bucket", () => {
    const rl = new RateLimiter();
    rl.consume("network");
    rl.reset("network");
    expect(rl.consume("network").allowed).toBe(true);
  });

  it("returns snapshot of all buckets", () => {
    const rl = new RateLimiter();
    rl.consume("commands");
    const snap = rl.snapshot();
    expect(snap).toHaveProperty("commands");
    expect(snap).toHaveProperty("tool_calls");
    expect(snap["commands"]?.count).toBe(1);
  });

  it("check returns result without consuming", () => {
    const rl = new RateLimiter();
    const before = rl.check("commands");
    expect(before.allowed).toBe(true);
    const snap = rl.snapshot();
    expect(snap["commands"]?.count).toBe(0);
  });
});
