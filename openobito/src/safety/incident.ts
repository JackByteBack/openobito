// Layer 9 — Incident Detection (OpenHuman doctor pattern)
// Monitors audit events for anomalous behavior and generates security incidents.

import type { AuditEntry, SecurityEvent, IncidentType, DiagnosticReport } from "./types.js";
import { detectCredentialsInParams } from "./credentials.js";
import { isBlockedCommand } from "./blocklist.js";
import { randomBytes } from "node:crypto";

function shortId(): string {
  return randomBytes(4).toString("hex");
}

// Detection thresholds
const RAPID_DELETION_THRESHOLD = 5;   // 5 file deletes within this window
const RAPID_DELETION_WINDOW_MS = 60_000;

export class IncidentDetector {
  // In-memory ring buffer of recent audit entries (up to 1000)
  private recentEntries: AuditEntry[] = [];
  private readonly MAX_BUFFER = 1000;

  // Feed an audit entry into the detector. Returns any triggered incidents.
  analyze(entry: AuditEntry): SecurityEvent[] {
    this.recentEntries.push(entry);
    if (this.recentEntries.length > this.MAX_BUFFER) {
      this.recentEntries.shift();
    }

    const events: SecurityEvent[] = [];

    // Check: blocked command attempted
    if (!entry.approved && entry.action === "deny") {
      const cmd = String(
        entry.parameters["command"] ?? entry.parameters["cmd"] ?? ""
      );
      if (cmd && isBlockedCommand(cmd).blocked) {
        events.push(this.makeEvent(entry, "blocked_command", "critical",
          `Blocked command attempted: ${cmd.slice(0, 80)}`,
          { command: cmd, toolName: entry.toolName }
        ));
      }
    }

    // Check: credential leak in parameters
    const credHits = detectCredentialsInParams(entry.parameters);
    if (credHits.length > 0) {
      events.push(this.makeEvent(entry, "credential_leak", "critical",
        `Potential credential exposure in tool parameters: ${credHits.map((c) => c.type).join(", ")}`,
        { detections: credHits, toolName: entry.toolName }
      ));
    }

    // Check: privilege escalation (sudo/su in shell commands)
    const rawCmd = String(entry.parameters["command"] ?? entry.parameters["cmd"] ?? "");
    if (rawCmd && this.detectPrivilegeEscalation(rawCmd)) {
      events.push(this.makeEvent(entry, "privilege_escalation", "critical",
        `Privilege escalation attempt detected in: ${rawCmd.slice(0, 80)}`,
        { command: rawCmd }
      ));
    }

    // Check: rapid deletion
    if (entry.toolName === "delete_file" || entry.toolName === "shell_exec") {
      const deletionEvents = this.detectRapidDeletion(entry.sessionId, entry.timestamp);
      if (deletionEvents) {
        events.push(this.makeEvent(entry, "rapid_deletion", "high",
          `Rapid file deletion detected: ${deletionEvents} deletes in 60 seconds`,
          { count: deletionEvents, sessionId: entry.sessionId }
        ));
      }
    }

    // Check: rate limit abuse (many denied/rate-limited entries in quick succession)
    if (entry.error?.includes("rate limit")) {
      const abuseCount = this.countRateLimitHits(entry.sessionId, entry.timestamp);
      if (abuseCount >= 5) {
        events.push(this.makeEvent(entry, "rate_limit_abuse", "medium",
          `Rate limit abuse: ${abuseCount} rate-limited requests in 60 seconds`,
          { count: abuseCount }
        ));
      }
    }

    // Check: unknown network requests (web_fetch to non-approved hosts)
    if (entry.toolName === "web_fetch" && entry.action === "deny") {
      events.push(this.makeEvent(entry, "unknown_network", "medium",
        `Denied network request to: ${String(entry.parameters["url"] ?? "unknown")}`,
        { url: entry.parameters["url"] }
      ));
    }

    return events;
  }

  detectPrivilegeEscalation(cmd: string): boolean {
    return (
      /^\s*sudo\s/.test(cmd) ||
      /^\s*su\s*(-\s*)?$/.test(cmd) ||
      /chmod\s+777\s+\//.test(cmd) ||
      /chown\s+root/.test(cmd) ||
      /pkexec\s/.test(cmd) ||
      /doas\s/.test(cmd)
    );
  }

  private detectRapidDeletion(sessionId: string, now: number): number | null {
    const cutoff = now - RAPID_DELETION_WINDOW_MS;
    const count = this.recentEntries.filter(
      (e) =>
        e.sessionId === sessionId &&
        e.timestamp >= cutoff &&
        (e.toolName === "delete_file" ||
          (e.toolName === "shell_exec" && /\brm\s/.test(String(e.parameters["command"] ?? ""))))
    ).length;
    return count >= RAPID_DELETION_THRESHOLD ? count : null;
  }

  private countRateLimitHits(sessionId: string, now: number): number {
    const cutoff = now - 60_000;
    return this.recentEntries.filter(
      (e) =>
        e.sessionId === sessionId &&
        e.timestamp >= cutoff &&
        e.error?.includes("rate limit")
    ).length;
  }

  private makeEvent(
    entry: AuditEntry,
    type: IncidentType,
    severity: SecurityEvent["severity"],
    description: string,
    details: Record<string, unknown>
  ): SecurityEvent {
    return {
      id: shortId(),
      timestamp: entry.timestamp,
      sessionId: entry.sessionId,
      type,
      severity,
      description,
      details,
    };
  }

  // Full diagnostic report for a session (like OpenHuman's doctor.report())
  runDiagnostic(sessionId: string, recentAudit: AuditEntry[]): DiagnosticReport {
    const sessionEntries = recentAudit.filter((e) => e.sessionId === sessionId);
    const allEvents: SecurityEvent[] = [];

    for (const entry of sessionEntries) {
      allEvents.push(...this.analyze(entry));
    }

    const incidentsByType: Partial<Record<IncidentType, number>> = {};
    for (const e of allEvents) {
      incidentsByType[e.type] = (incidentsByType[e.type] ?? 0) + 1;
    }

    const highSeverityCount = allEvents.filter(
      (e) => e.severity === "high" || e.severity === "critical"
    ).length;

    const recentBlocked = sessionEntries
      .filter((e) => e.action === "deny")
      .slice(-5)
      .map((e) => `${e.toolName} (${e.riskLevel})`);

    const recommendations = this.buildRecommendations(incidentsByType, sessionEntries);

    return {
      sessionId,
      timestamp: Date.now(),
      totalEvents: allEvents.length,
      incidentsByType,
      highSeverityCount,
      recentBlocked,
      recommendations,
    };
  }

  private buildRecommendations(
    incidents: Partial<Record<IncidentType, number>>,
    entries: AuditEntry[]
  ): string[] {
    const recs: string[] = [];

    if (incidents["privilege_escalation"]) {
      recs.push("Privilege escalation detected — review shell_exec usage and restrict sudo.");
    }
    if (incidents["credential_leak"]) {
      recs.push("Credentials detected in tool parameters — audit what is being passed to shell_exec.");
    }
    if (incidents["rapid_deletion"]) {
      recs.push("Rapid deletion detected — review delete_file calls and consider rate-limiting.");
    }
    if (incidents["blocked_command"]) {
      recs.push("Blocked commands were attempted — review agent prompts for dangerous patterns.");
    }
    if (incidents["rate_limit_abuse"]) {
      recs.push("Rate limit abuse detected — consider lowering per-session tool call limits.");
    }

    const highRiskCount = entries.filter(
      (e) => e.riskLevel === "high" || e.riskLevel === "critical"
    ).length;
    if (highRiskCount > 10) {
      recs.push(`${highRiskCount} high/critical risk operations — consider switching to 'strict' security level.`);
    }

    const unapprovedCount = entries.filter((e) => !e.approved).length;
    if (unapprovedCount > 5) {
      recs.push(`${unapprovedCount} denied/unapproved operations — review tool policies.`);
    }

    if (recs.length === 0) recs.push("No issues detected in this session.");
    return recs;
  }

  // Flush the in-memory buffer (call on session end)
  flush(): void {
    this.recentEntries = [];
  }
}
