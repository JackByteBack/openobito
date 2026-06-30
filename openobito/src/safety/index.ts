// SafetySystem — composes all 9 security layers into a single gate.
//
// Usage:
//   const safety = new SafetySystem({ configDir, sessionId, securityLevel, userPolicies });
//   const check = await safety.check("write_file", { path: "foo.ts", content: "..." });
//   if (check.hardBlocked)       return displayError(check.hardBlockReason);
//   if (check.rateLimited)       return displayError("Rate limit exceeded");
//   if (check.accessDenied)      return displayError(check.accessDenyReason);
//   if (check.requiresApproval)  {
//     const result = await safety.approval.requestApproval(...);
//     if (!result.approved) return;
//   }
//   // Safe to execute
//   const result = await tool.handler(args);
//   safety.audit.log({ ..., approved: true, durationMs: ... });

import { resolve } from "path";
import { homedir } from "os";
import type {
  TaskRiskLevel,
  ToolPolicyAction,
  SecurityLevel,
  SafetyCheckResult,
  ToolPolicySession,
  ApprovalRequest,
  AuditEntry,
  SecurityEvent,
  DiagnosticReport,
} from "./types.js";
import type { ToolPolicy } from "../types/index.js";
import { ToolPolicyEngine } from "./policy.js";
import { ApprovalSystem, type Prompter } from "./approval.js";
import { AuditLogger } from "./audit.js";
import { RateLimiter } from "./ratelimit.js";
import { FileAccessControl } from "./fileaccess.js";
import { IncidentDetector } from "./incident.js";
import { isBlockedCommand, isBlockedWritePath } from "./blocklist.js";
import { detectCredentialsInParams } from "./credentials.js";

export { ToolPolicyEngine } from "./policy.js";
export { ApprovalSystem, formatApprovalPrompt } from "./approval.js";
export { AuditLogger } from "./audit.js";
export { RateLimiter } from "./ratelimit.js";
export { FileAccessControl } from "./fileaccess.js";
export { IncidentDetector } from "./incident.js";
export { isBlockedCommand, isBlockedWritePath, isBlockedReadPath, isSafeReadOnlyCommand } from "./blocklist.js";
export { detectCredentials, detectCredentialsInParams, sanitize, encrypt, decrypt, SessionMemory } from "./credentials.js";
export { sandboxExec, sandboxExecAsync, filterEnv, isAllowedCwd } from "./sandbox.js";
export type * from "./types.js";

// ─── SafetySystem ─────────────────────────────────────────────────────────────

export interface SafetySystemOptions {
  configDir?: string;
  sessionId: string;
  agentId?: string;
  securityLevel?: SecurityLevel;
  userPolicies?: ToolPolicy[];
  tools?: string[];
  prompter?: Prompter;
}

export class SafetySystem {
  readonly policy: ToolPolicyEngine;
  readonly approval: ApprovalSystem;
  readonly audit: AuditLogger;
  readonly rateLimit: RateLimiter;
  readonly fileAccess: FileAccessControl;
  readonly incident: IncidentDetector;

  private readonly sessionId: string;
  private readonly agentId: string;
  private readonly securityLevel: SecurityLevel;
  private readonly configDir: string;
  private policySession: ToolPolicySession | null = null;

  constructor(opts: SafetySystemOptions) {
    this.configDir = opts.configDir ?? resolve(homedir(), ".openagent");
    this.sessionId = opts.sessionId;
    this.agentId = opts.agentId ?? "openagent";
    this.securityLevel = opts.securityLevel ?? "strict";

    this.policy = new ToolPolicyEngine(opts.userPolicies ?? []);
    this.approval = new ApprovalSystem(opts.prompter);
    this.audit = new AuditLogger(this.configDir);
    this.rateLimit = new RateLimiter();
    this.fileAccess = new FileAccessControl(this.configDir);
    this.incident = new IncidentDetector();

    if (opts.tools?.length) {
      this.policySession = this.policy.buildSession(
        this.sessionId,
        this.agentId,
        opts.tools,
        this.securityLevel
      );
    }
  }

  // ─── Main gate ─────────────────────────────────────────────────────────────

  // check() runs all layers synchronously (no I/O).
  // Approval (if needed) is handled separately by the caller.
  check(
    toolName: string,
    args: Record<string, unknown>
  ): SafetyCheckResult {
    const riskLevel = this.policy.getRiskLevel(toolName);
    let action = this.policy.classify(toolName, this.securityLevel);

    // Layer 3: hard blocks (override everything)
    const cmdArg = String(args["command"] ?? args["cmd"] ?? "");
    if (cmdArg) {
      const cmdBlock = isBlockedCommand(cmdArg);
      if (cmdBlock.blocked) {
        return {
          action: "deny",
          riskLevel: "critical",
          hardBlocked: true,
          ...(cmdBlock.reason !== undefined ? { hardBlockReason: cmdBlock.reason } : {}),
          requiresApproval: false,
          rateLimited: false,
          accessDenied: false,
          credentialWarnings: [],
        };
      }
    }

    const pathArg = String(args["path"] ?? args["file"] ?? args["dest"] ?? "");
    if (pathArg && (toolName === "write_file" || toolName === "delete_file")) {
      const pathBlock = isBlockedWritePath(pathArg);
      if (pathBlock.blocked) {
        return {
          action: "deny",
          riskLevel: "critical",
          hardBlocked: true,
          ...(pathBlock.reason !== undefined ? { hardBlockReason: pathBlock.reason } : {}),
          requiresApproval: false,
          rateLimited: false,
          accessDenied: false,
          credentialWarnings: [],
        };
      }
    }

    // Layer 6: rate limiting
    const rlResult = this.rateLimit.checkAndConsumeTool(toolName);
    if (!rlResult.allowed) {
      return {
        action: "deny",
        riskLevel,
        hardBlocked: false,
        requiresApproval: false,
        rateLimited: true,
        accessDenied: false,
        credentialWarnings: [],
      };
    }

    // Layer 7: file access control
    if (pathArg) {
      const fileCheck =
        toolName === "write_file" ? this.fileAccess.checkWrite(pathArg)
        : toolName === "delete_file" ? this.fileAccess.checkDelete(pathArg)
        : toolName === "read_file" ? this.fileAccess.checkRead(pathArg)
        : toolName === "list_directory" ? this.fileAccess.checkList(pathArg)
        : { allowed: true };

      if (!fileCheck.allowed) {
        return {
          action: "deny",
          riskLevel,
          hardBlocked: false,
          requiresApproval: false,
          rateLimited: false,
          accessDenied: true,
          ...(fileCheck.reason !== undefined ? { accessDenyReason: fileCheck.reason } : {}),
          credentialWarnings: [],
        };
      }
      if (fileCheck.requiresApproval) {
        action = "require_approval";
      }
    }

    // Layer 8: credential detection in args
    const credentialWarnings = detectCredentialsInParams(args);

    return {
      action,
      riskLevel,
      hardBlocked: false,
      requiresApproval: action === "require_approval",
      rateLimited: false,
      accessDenied: false,
      credentialWarnings,
    };
  }

  // execute() runs check + optional approval + the tool function + audit log + incident detection.
  async execute<T>(
    toolName: string,
    args: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<{ result?: T; blocked: boolean; reason?: string }> {
    const checkResult = this.check(toolName, args);
    const t0 = Date.now();

    // Hard block or access denied: log and refuse immediately
    if (checkResult.hardBlocked || checkResult.accessDenied || checkResult.rateLimited) {
      const reason = checkResult.hardBlockReason ?? checkResult.accessDenyReason ??
        (checkResult.rateLimited ? "Rate limit exceeded" : "Denied");
      const entry = this.logAction(toolName, args, checkResult.action, checkResult.riskLevel, false, t0, reason);
      this.processIncidents(entry);
      return { blocked: true, reason };
    }

    // Policy deny (unknown tool or user policy)
    if (checkResult.action === "deny") {
      const entry = this.logAction(toolName, args, "deny", checkResult.riskLevel, false, t0, "Policy deny");
      this.processIncidents(entry);
      return { blocked: true, reason: `Tool "${toolName}" is denied by policy` };
    }

    // Approval required
    if (checkResult.requiresApproval) {
      const pathArg = String(args["path"] ?? args["file"] ?? "");
      const approvalReq: ApprovalRequest = {
        sessionId: this.sessionId,
        toolName,
        riskLevel: checkResult.riskLevel,
        arguments: args,
        ...(pathArg ? { filesAffected: [pathArg] } : {}),
      };
      const approvalResult = await this.approval.requestApproval(approvalReq);
      this.audit.logApproval({
        timestamp: Date.now(),
        sessionId: this.sessionId,
        toolName,
        approved: approvalResult.approved,
        reply: approvalResult.reply,
      });

      if (!approvalResult.approved) {
        const entry = this.logAction(toolName, args, "deny", checkResult.riskLevel, false, t0, "User denied");
        this.processIncidents(entry);
        return { blocked: true, reason: "Approval denied by user" };
      }
    }

    // Execute
    let result: T;
    let error: string | undefined;
    try {
      result = await fn();
    } catch (e) {
      error = String(e);
      const entry = this.logAction(toolName, args, checkResult.action, checkResult.riskLevel, false, t0, error);
      this.processIncidents(entry);
      throw e;
    }

    const entry = this.logAction(toolName, args, checkResult.action, checkResult.riskLevel, true, t0);
    this.processIncidents(entry);
    return { result: result!, blocked: false };
  }

  // Build or return the cached policy session
  buildPolicySession(tools: string[]): ToolPolicySession {
    this.policySession = this.policy.buildSession(
      this.sessionId,
      this.agentId,
      tools,
      this.securityLevel
    );
    return this.policySession;
  }

  getPolicySession(): ToolPolicySession | null {
    return this.policySession;
  }

  getBoundaryPrompt(): string {
    return this.policySession?.boundaryPrompt ?? "";
  }

  // Run full session diagnostic (like /doctor)
  runDiagnostic(): DiagnosticReport {
    const recent = this.audit.recent(this.sessionId, 500);
    return this.incident.runDiagnostic(this.sessionId, recent);
  }

  // Reset approval standing (on /new or session switch)
  onNewSession(): void {
    this.approval.reset();
    this.rateLimit.resetMessageCounter();
    this.incident.flush();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private logAction(
    toolName: string,
    args: Record<string, unknown>,
    action: ToolPolicyAction,
    riskLevel: TaskRiskLevel,
    approved: boolean,
    t0: number,
    error?: string
  ): AuditEntry {
    return this.audit.log({
      timestamp: Date.now(),
      sessionId: this.sessionId,
      toolName,
      parameters: args,
      action,
      riskLevel,
      approved,
      durationMs: Date.now() - t0,
      ...(error !== undefined ? { error } : {}),
    });
  }

  private processIncidents(entry: AuditEntry): void {
    const events: SecurityEvent[] = this.incident.analyze(entry);
    for (const evt of events) {
      this.audit.logSecurityEvent(evt);
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createSafetySystem(opts: SafetySystemOptions): SafetySystem {
  return new SafetySystem(opts);
}
