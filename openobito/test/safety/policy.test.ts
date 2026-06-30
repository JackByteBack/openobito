import { describe, it, expect } from "vitest";
import { ToolPolicyEngine } from "../../src/safety/policy.js";

describe("ToolPolicyEngine — classify()", () => {
  const engine = new ToolPolicyEngine();

  it("auto-allows safe reads in all security levels", () => {
    expect(engine.classify("read_file", "strict")).toBe("allow");
    expect(engine.classify("read_file", "moderate")).toBe("allow");
    expect(engine.classify("read_file", "relaxed")).toBe("allow");
    expect(engine.classify("git_log", "strict")).toBe("allow");
    expect(engine.classify("list_directory", "strict")).toBe("allow");
  });

  it("requires approval for writes in strict mode", () => {
    expect(engine.classify("write_file", "strict")).toBe("require_approval");
    expect(engine.classify("shell_exec", "strict")).toBe("require_approval");
    expect(engine.classify("git_push", "strict")).toBe("require_approval");
  });

  it("allows more in relaxed mode", () => {
    expect(engine.classify("write_file", "relaxed")).toBe("allow");
    expect(engine.classify("git_commit", "relaxed")).toBe("allow");
    expect(engine.classify("web_fetch", "relaxed")).toBe("allow");
  });

  it("denies unknown tools (fail-closed) in all modes", () => {
    expect(engine.classify("unknown_tool", "strict")).toBe("deny");
    expect(engine.classify("unknown_tool", "moderate")).toBe("deny");
    expect(engine.classify("unknown_tool", "relaxed")).toBe("deny");
    expect(engine.classify("rm_file", "relaxed")).toBe("deny");
  });

  it("permanently denies dangerous tools regardless of security level", () => {
    expect(engine.classify("format_disk", "relaxed")).toBe("deny");
    expect(engine.classify("wipe_filesystem", "relaxed")).toBe("deny");
    expect(engine.classify("kill_process", "relaxed")).toBe("deny");
  });

  it("user policy overrides builtin (except permanent deny)", () => {
    const custom = new ToolPolicyEngine([
      { toolName: "write_file", action: "allow", riskLevel: "low" },
    ]);
    expect(custom.classify("write_file", "strict")).toBe("allow");
  });

  it("user policy cannot override permanent deny", () => {
    const custom = new ToolPolicyEngine([
      { toolName: "format_disk", action: "allow", riskLevel: "low" },
    ]);
    expect(custom.classify("format_disk", "relaxed")).toBe("deny");
  });
});

describe("ToolPolicyEngine — buildSession()", () => {
  const engine = new ToolPolicyEngine();

  it("builds an immutable session snapshot", () => {
    const session = engine.buildSession("sess-1", "agent-1", ["read_file", "write_file", "unknown_tool"], "strict");

    expect(session.sessionId).toBe("sess-1");
    expect(session.securityLevel).toBe("strict");
    expect(session.decisions.get("read_file")).toBe("allow");
    expect(session.decisions.get("write_file")).toBe("require_approval");
    expect(session.decisions.get("unknown_tool")).toBe("deny");
    expect(session.createdAt).toBeGreaterThan(0);
  });

  it("renders a non-empty boundary prompt", () => {
    const session = engine.buildSession("sess-2", "agent-1", ["read_file", "shell_exec"], "strict");
    expect(session.boundaryPrompt).toContain("[SAFETY BOUNDARY");
    expect(session.boundaryPrompt).toContain("read_file");
    expect(session.boundaryPrompt).toContain("shell_exec");
  });

  it("session decisions are frozen (cannot be mutated)", () => {
    const session = engine.buildSession("sess-3", "agent-1", ["read_file"], "strict");
    expect(() => {
      (session.decisions as Map<string, string>).set("read_file", "deny");
    }).toThrow();
  });
});

describe("ToolPolicyEngine — getRiskLevel()", () => {
  const engine = new ToolPolicyEngine();

  it("returns correct risk levels for known tools", () => {
    expect(engine.getRiskLevel("read_file")).toBe("low");
    expect(engine.getRiskLevel("write_file")).toBe("medium");
    expect(engine.getRiskLevel("shell_exec")).toBe("high");
    expect(engine.getRiskLevel("delete_file")).toBe("high");
  });

  it("returns high for unknown tools", () => {
    expect(engine.getRiskLevel("mystery_tool")).toBe("high");
  });
});
