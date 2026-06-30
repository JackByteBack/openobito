import { describe, it, expect } from "vitest";
import { PolicyEngine } from "../../src/permissions/index.js";
import type { OpenAgentConfig } from "../../src/types/index.js";

const basePermissions: OpenAgentConfig["permissions"] = {
  defaultAction: "require_approval",
  policies: [
    { toolName: "read_file", action: "allow", riskLevel: "low" },
    { toolName: "shell_exec", action: "require_approval", riskLevel: "high" },
    { toolName: "delete_file", action: "deny", riskLevel: "critical" },
    { toolName: "internal_tool", action: "hide_from_prompt", riskLevel: "low" },
  ],
};

describe("PolicyEngine", () => {
  it("resolves allow policy correctly", () => {
    const engine = new PolicyEngine(basePermissions);
    expect(engine.isAllowed("read_file")).toBe(true);
    expect(engine.isDenied("read_file")).toBe(false);
    expect(engine.requiresApproval("read_file")).toBe(false);
  });

  it("resolves deny policy correctly", () => {
    const engine = new PolicyEngine(basePermissions);
    expect(engine.isDenied("delete_file")).toBe(true);
    expect(engine.isAllowed("delete_file")).toBe(false);
  });

  it("resolves require_approval policy correctly", () => {
    const engine = new PolicyEngine(basePermissions);
    expect(engine.requiresApproval("shell_exec")).toBe(true);
  });

  it("resolves hidden tools", () => {
    const engine = new PolicyEngine(basePermissions);
    expect(engine.isHidden("internal_tool")).toBe(true);
  });

  it("falls back to default action for unknown tools", () => {
    const engine = new PolicyEngine(basePermissions);
    expect(engine.requiresApproval("unknown_tool")).toBe(true);
    expect(engine.isDenied("unknown_tool")).toBe(false);
  });

  it("filters hidden tools from visible list", () => {
    const engine = new PolicyEngine(basePermissions);
    const visible = engine.getVisibleTools(["read_file", "shell_exec", "internal_tool"]);
    expect(visible).toContain("read_file");
    expect(visible).toContain("shell_exec");
    expect(visible).not.toContain("internal_tool");
  });

  it("supports dynamic policy changes", () => {
    const engine = new PolicyEngine(basePermissions);
    engine.addPolicy({ toolName: "new_tool", action: "allow", riskLevel: "low" });
    expect(engine.isAllowed("new_tool")).toBe(true);
    engine.removePolicy("new_tool");
    expect(engine.requiresApproval("new_tool")).toBe(true);
  });
});
