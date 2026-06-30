import type { TaskRiskLevel, ToolPolicyAction } from "../types/index.js";

export type { TaskRiskLevel, ToolPolicyAction };

// ─── Core permission types ────────────────────────────────────────────────────

// OpenCode-inspired reply options for approval prompts
export type ApprovalReply = "once" | "always" | "reject";

// Three-tier security configuration (configurable per session)
export type SecurityLevel = "strict" | "moderate" | "relaxed";

// ─── Audit types (Layer 5) ────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: number;
  date: string;
  sessionId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  action: ToolPolicyAction;
  riskLevel: TaskRiskLevel;
  approved: boolean;
  approvedBy?: ApprovalReply | undefined;
  durationMs?: number | undefined;
  error?: string | undefined;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  toolName?: string;
  error: string;
  stack?: string;
}

// ─── Incident types (Layer 9) ─────────────────────────────────────────────────

export type IncidentType =
  | "privilege_escalation"
  | "credential_leak"
  | "rapid_deletion"
  | "unknown_network"
  | "rate_limit_abuse"
  | "anomalous_behavior"
  | "blocked_command"
  | "protected_file_access";

export interface SecurityEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  type: IncidentType;
  severity: TaskRiskLevel;
  description: string;
  details: Record<string, unknown>;
}

export interface DiagnosticReport {
  sessionId: string;
  timestamp: number;
  totalEvents: number;
  incidentsByType: Partial<Record<IncidentType, number>>;
  highSeverityCount: number;
  recentBlocked: string[];
  recommendations: string[];
}

// ─── Policy session (Layer 1) ─────────────────────────────────────────────────

// Immutable, per-session snapshot of tool policy decisions.
// Built once at session start; callers cannot mutate it.
export interface ToolPolicySession {
  readonly sessionId: string;
  readonly agentId: string;
  readonly securityLevel: SecurityLevel;
  readonly decisions: ReadonlyMap<string, ToolPolicyAction>;
  readonly boundaryPrompt: string;
  readonly createdAt: number;
}

// ─── Approval types (Layer 2) ─────────────────────────────────────────────────

export interface ApprovalRequest {
  sessionId: string;
  toolName: string;
  riskLevel: TaskRiskLevel;
  arguments: Record<string, unknown>;
  filesAffected?: string[] | undefined;
  reason?: string | undefined;
}

export interface ApprovalResult {
  approved: boolean;
  reply: ApprovalReply;
}

// ─── Sandbox types (Layer 4) ──────────────────────────────────────────────────

export interface SandboxOptions {
  timeout?: number;
  maxBuffer?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

// ─── File access types (Layer 7) ─────────────────────────────────────────────

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

// ─── Credential types (Layer 8) ───────────────────────────────────────────────

export interface CredentialDetection {
  type: string;
  match: string;
  offset: number;
}

export interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
  algorithm: "aes-256-gcm";
}

// ─── SafetySystem gate result ─────────────────────────────────────────────────

export interface SafetyCheckResult {
  action: ToolPolicyAction;
  riskLevel: TaskRiskLevel;
  hardBlocked: boolean;
  hardBlockReason?: string | undefined;
  requiresApproval: boolean;
  rateLimited: boolean;
  accessDenied: boolean;
  accessDenyReason?: string | undefined;
  credentialWarnings: CredentialDetection[];
}
