import { describe, it, expect } from "vitest";
import { parseCronExpression, nextRunTime, cronMatches } from "../../src/cron/parser.js";

describe("CronParser", () => {
  it("parses valid 5-field expression", () => {
    const result = parseCronExpression("0 9 * * 1-5");
    expect(result.minute).toBeDefined();
    expect(result.hour).toBeDefined();
    expect(result.raw).toBe("0 9 * * 1-5");
  });

  it("rejects invalid expression", () => {
    expect(() => parseCronExpression("invalid")).toThrow("expected 5 fields");
  });

  it("rejects expression with wrong field count", () => {
    expect(() => parseCronExpression("0 9 * * * *")).toThrow("expected 5 fields");
  });

  it("computes next run time for daily job", () => {
    const parsed = parseCronExpression("0 9 * * *");
    const next = nextRunTime(parsed, new Date("2024-06-15T10:00:00Z"));
    expect(next.getTime()).toBeGreaterThan(new Date("2024-06-15T10:00:00Z").getTime());
  });

  it("handles wildcard fields", () => {
    const result = parseCronExpression("* * * * *");
    expect(result.raw).toBe("* * * * *");
  });

  it("cronMatches checks if expression matches a date", () => {
    const parsed = parseCronExpression("30 9 * * *");
    // Use local time to avoid TZ issues with cronMatches
    const date = new Date(2024, 5, 15, 9, 30, 0);
    expect(cronMatches(parsed, date)).toBe(true);
  });
});
