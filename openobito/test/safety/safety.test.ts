// Integration test: SafetySystem gate (all 9 layers together)
import { describe, it, expect, beforeEach } from "vitest";
import { tmpdir } from "os";
import { resolve } from "path";
import { SafetySystem } from "../../src/safety/index.js";

function makeSystem(level: "strict" | "moderate" | "relaxed" = "strict") {
  return new SafetySystem({
    configDir: resolve(tmpdir(), "openagent-test-" + Math.random().toString(36).slice(2)),
    sessionId: "test-session",
    agentId: "test-agent",
    securityLevel: level,
    tools: ["read_file", "write_file", "shell_exec", "delete_file", "unknown_tool"],
  });
}

describe("SafetySystem.check() — Layer 1 (Default Deny)", () => {
  let safety: SafetySystem;

  beforeEach(() => { safety = makeSystem(); });

  it("allows read_file in strict mode", () => {
    const r = safety.check("read_file", { path: "README.md" });
    expect(r.action).toBe("allow");
    expect(r.hardBlocked).toBe(false);
  });

  it("requires approval for write_file in strict mode", () => {
    const r = safety.check("write_file", { path: "output.txt", content: "hello" });
    expect(r.requiresApproval).toBe(true);
    expect(r.hardBlocked).toBe(false);
  });

  it("denies unknown tools (fail-closed)", () => {
    const r = safety.check("unknown_tool", {});
    expect(r.action).toBe("deny");
    expect(r.hardBlocked).toBe(false);
  });
});

describe("SafetySystem.check() — Layer 3 (Hard Blocks)", () => {
  let safety: SafetySystem;

  beforeEach(() => { safety = makeSystem("relaxed"); });

  it("hard-blocks rm -rf / even in relaxed mode", () => {
    const r = safety.check("shell_exec", { command: "rm -rf /" });
    expect(r.hardBlocked).toBe(true);
    expect(r.hardBlockReason).toMatch(/filesystem/i);
  });

  it("hard-blocks fork bombs", () => {
    const r = safety.check("shell_exec", { command: ":(){ :|:& };:" });
    expect(r.hardBlocked).toBe(true);
  });

  it("hard-blocks writes to /etc/hosts", () => {
    const r = safety.check("write_file", { path: "/etc/hosts", content: "hacked" });
    expect(r.hardBlocked).toBe(true);
  });

  it("hard-blocks writes to SSH private key", () => {
    const r = safety.check("write_file", { path: "/home/user/.ssh/id_rsa", content: "fake" });
    expect(r.hardBlocked).toBe(true);
  });
});

describe("SafetySystem.check() — Layer 6 (Rate Limiting)", () => {
  it("rate-limits after 10 tool_calls per message", () => {
    const safety = makeSystem();
    for (let i = 0; i < 10; i++) {
      safety.rateLimit.consume("tool_calls");
    }
    const r = safety.check("read_file", { path: "foo.ts" });
    expect(r.rateLimited).toBe(true);
  });

  it("allows after resetMessageCounter()", () => {
    const safety = makeSystem();
    for (let i = 0; i < 10; i++) {
      safety.rateLimit.consume("tool_calls");
    }
    safety.rateLimit.resetMessageCounter();
    const r = safety.check("read_file", { path: "foo.ts" });
    expect(r.rateLimited).toBe(false);
  });
});

describe("SafetySystem.check() — Layer 7 (File Access)", () => {
  it("denies access to always-blocked dirs", () => {
    const safety = makeSystem();
    const r = safety.check("read_file", { path: "/sys/kernel" });
    // /sys is blocked at read level too
    expect(r.accessDenied).toBe(true);
  });

  it("denies writes to protected paths", () => {
    const safety = makeSystem();
    const r = safety.check("write_file", { path: "./.env" });
    expect(r.accessDenied).toBe(true);
  });
});

describe("SafetySystem.check() — Layer 8 (Credential Detection)", () => {
  it("flags AWS key in shell command", () => {
    const safety = makeSystem();
    const r = safety.check("shell_exec", {
      command: "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE && deploy.sh",
    });
    expect(r.credentialWarnings.length).toBeGreaterThan(0);
    expect(r.credentialWarnings.some((w) => w.type === "aws_access_key")).toBe(true);
  });

  it("returns no warnings for clean args", () => {
    const safety = makeSystem();
    const r = safety.check("read_file", { path: "src/index.ts" });
    expect(r.credentialWarnings).toHaveLength(0);
  });
});

describe("SafetySystem — policy session", () => {
  it("buildPolicySession() creates immutable snapshot", () => {
    const safety = makeSystem();
    const session = safety.buildPolicySession(["read_file", "write_file", "unknown_tool"]);
    expect(session.decisions.get("read_file")).toBe("allow");
    expect(session.decisions.get("write_file")).toBe("require_approval");
    expect(session.decisions.get("unknown_tool")).toBe("deny");
  });

  it("getBoundaryPrompt() returns non-empty string after buildPolicySession()", () => {
    const safety = makeSystem();
    safety.buildPolicySession(["read_file"]);
    expect(safety.getBoundaryPrompt()).toContain("[SAFETY BOUNDARY");
  });
});

describe("SafetySystem — execute()", () => {
  it("executes allowed tool and returns result", async () => {
    const safety = makeSystem("relaxed");
    const { result, blocked } = await safety.execute(
      "read_file",
      { path: "README.md" },
      async () => "file contents"
    );
    expect(blocked).toBe(false);
    expect(result).toBe("file contents");
  });

  it("blocks hard-blocked tool without calling fn", async () => {
    const safety = makeSystem("relaxed");
    let called = false;
    const { blocked } = await safety.execute(
      "shell_exec",
      { command: "rm -rf /" },
      async () => { called = true; return "output"; }
    );
    expect(blocked).toBe(true);
    expect(called).toBe(false);
  });

  it("blocks denied tool", async () => {
    const safety = makeSystem("strict");
    const { blocked } = await safety.execute(
      "unknown_tool",
      {},
      async () => "output"
    );
    expect(blocked).toBe(true);
  });
});
