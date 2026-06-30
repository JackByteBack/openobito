// Layer 2 — Approval System
// OpenHuman RequireApproval + OpenCode reply ("once" | "always" | "reject").
// Supports pluggable prompter so the Ink.js TUI can inject its own dialog.

import type { ApprovalRequest, ApprovalResult, ApprovalReply, TaskRiskLevel } from "./types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

// A Prompter receives the formatted prompt string and returns the raw user input.
export type Prompter = (prompt: string) => Promise<string>;

// ─── Default readline prompter (TTY fallback) ─────────────────────────────────

async function readlinePrompter(prompt: string): Promise<string> {
  // Guard: auto-deny in non-interactive environments
  if (!process.stdin.isTTY) return "d";

  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const RISK_ICONS: Record<TaskRiskLevel, string> = {
  low:      "🟢",
  medium:   "🟡",
  high:     "🟠",
  critical: "🔴",
};

export function formatApprovalPrompt(req: ApprovalRequest): string {
  const icon = RISK_ICONS[req.riskLevel];
  const argLines = JSON.stringify(req.arguments, null, 2)
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");
  const filesLine = req.filesAffected?.length
    ? `  Files:  ${req.filesAffected.join(", ")}\n`
    : "";

  return (
    `\n🚨 APPROVAL REQUIRED\n` +
    `${"─".repeat(50)}\n` +
    `  Tool:   ${req.toolName}\n` +
    `  Risk:   ${icon} ${req.riskLevel.toUpperCase()}\n` +
    filesLine +
    (req.reason ? `  Reason: ${req.reason}\n` : "") +
    `  Args:\n${argLines}\n` +
    `${"─".repeat(50)}\n` +
    `  [A]pprove once  [L]ways approve  [D]eny  [N]ever approve\n` +
    `> `
  );
}

// ─── ApprovalSystem ───────────────────────────────────────────────────────────

export class ApprovalSystem {
  private readonly alwaysApproved = new Set<string>();
  private readonly neverApproved = new Set<string>();
  private readonly prompter: Prompter;

  constructor(prompter: Prompter = readlinePrompter) {
    this.prompter = prompter;
  }

  async requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
    // Fast-path: already decided for this session
    if (this.alwaysApproved.has(req.toolName)) {
      return { approved: true, reply: "always" };
    }
    if (this.neverApproved.has(req.toolName)) {
      return { approved: false, reply: "reject" };
    }

    const prompt = formatApprovalPrompt(req);
    const raw = await this.prompter(prompt);
    return this.parseReply(raw, req.toolName);
  }

  // Parse raw keypress into a decision
  private parseReply(raw: string, toolName: string): ApprovalResult {
    const key = raw.toLowerCase().trim();

    if (key === "a" || key === "approve" || key === "y" || key === "yes") {
      return { approved: true, reply: "once" };
    }
    if (key === "l" || key === "always") {
      this.alwaysApproved.add(toolName);
      return { approved: true, reply: "always" };
    }
    if (key === "n" || key === "never") {
      this.neverApproved.add(toolName);
      return { approved: false, reply: "reject" };
    }
    // Default: deny
    return { approved: false, reply: "reject" };
  }

  // Programmatic approval (used by tests and non-interactive contexts)
  approve(toolName: string, reply: ApprovalReply = "once"): ApprovalResult {
    if (reply === "always") this.alwaysApproved.add(toolName);
    return { approved: true, reply };
  }

  deny(toolName: string, reply: ApprovalReply = "reject"): ApprovalResult {
    if (reply === "reject") this.neverApproved.add(toolName);
    return { approved: false, reply };
  }

  // Check if a tool has a standing session-level decision
  getStanding(toolName: string): "always" | "never" | null {
    if (this.alwaysApproved.has(toolName)) return "always";
    if (this.neverApproved.has(toolName)) return "never";
    return null;
  }

  // List all standing decisions
  listStanding(): { tool: string; decision: "always" | "never" }[] {
    const out: { tool: string; decision: "always" | "never" }[] = [];
    for (const t of this.alwaysApproved) out.push({ tool: t, decision: "always" });
    for (const t of this.neverApproved) out.push({ tool: t, decision: "never" });
    return out;
  }

  // Reset all session-level decisions (called on /new or session change)
  reset(): void {
    this.alwaysApproved.clear();
    this.neverApproved.clear();
  }

  // Replace the standing for a specific tool
  setStanding(toolName: string, decision: "always" | "never" | null): void {
    this.alwaysApproved.delete(toolName);
    this.neverApproved.delete(toolName);
    if (decision === "always") this.alwaysApproved.add(toolName);
    if (decision === "never") this.neverApproved.add(toolName);
  }
}
