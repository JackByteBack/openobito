import type { ToolPolicy, ToolPolicyAction, TaskRiskLevel, OpenAgentConfig } from "../types/index.js";

// ─── Policy Engine ───────────────────────────────────────────────────────────
// Inspired by OpenHuman's agent_tool_policy engine

const RISK_ORDER: TaskRiskLevel[] = ["low", "medium", "high", "critical"];

export function riskScore(level: TaskRiskLevel): number {
  return RISK_ORDER.indexOf(level);
}

export function compareRisk(a: TaskRiskLevel, b: TaskRiskLevel): number {
  return riskScore(a) - riskScore(b);
}

export class PolicyEngine {
  private policies: Map<string, ToolPolicy>;
  private defaultAction: ToolPolicyAction;

  constructor(config: OpenAgentConfig["permissions"]) {
    this.defaultAction = config.defaultAction;
    this.policies = new Map(config.policies.map((p) => [p.toolName, p]));
  }

  resolve(toolName: string): ToolPolicy {
    const policy = this.policies.get(toolName);
    if (policy) return policy;
    return {
      toolName,
      action: this.defaultAction,
      riskLevel: "medium",
      reason: "Default policy",
    };
  }

  isAllowed(toolName: string): boolean {
    return this.resolve(toolName).action === "allow";
  }

  isDenied(toolName: string): boolean {
    return this.resolve(toolName).action === "deny";
  }

  requiresApproval(toolName: string): boolean {
    return this.resolve(toolName).action === "require_approval";
  }

  isHidden(toolName: string): boolean {
    return this.resolve(toolName).action === "hide_from_prompt";
  }

  getVisibleTools(toolNames: string[]): string[] {
    return toolNames.filter((name) => !this.isHidden(name));
  }

  addPolicy(policy: ToolPolicy): void {
    this.policies.set(policy.toolName, policy);
  }

  removePolicy(toolName: string): void {
    this.policies.delete(toolName);
  }

  listPolicies(): ToolPolicy[] {
    return Array.from(this.policies.values());
  }
}

// ─── Approval prompt helper ──────────────────────────────────────────────────

export interface ApprovalRequest {
  toolName: string;
  riskLevel: TaskRiskLevel;
  arguments: Record<string, unknown>;
  reason?: string | undefined;
}

export function formatApprovalPrompt(req: ApprovalRequest): string {
  const riskColors: Record<TaskRiskLevel, string> = {
    low: "🟢",
    medium: "🟡",
    high: "🟠",
    critical: "🔴",
  };
  const icon = riskColors[req.riskLevel];
  const args = JSON.stringify(req.arguments, null, 2);
  return (
    `${icon} Tool approval required\n` +
    `  Tool:  ${req.toolName}\n` +
    `  Risk:  ${req.riskLevel.toUpperCase()}\n` +
    (req.reason ? `  Note:  ${req.reason}\n` : "") +
    `  Args:\n${args.split("\n").map((l) => `    ${l}`).join("\n")}`
  );
}
