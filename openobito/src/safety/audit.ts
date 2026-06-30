// Layer 5 — Comprehensive Audit Logging
// Daily rotating JSONL files at ~/.openagent/audit_logs/YYYY-MM-DD.jsonl
// Separate files for security events and errors.

import { appendFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { randomBytes } from "node:crypto";
import type { AuditEntry, SecurityEvent, ErrorLogEntry } from "./types.js";

function shortId(): string {
  return randomBytes(4).toString("hex");
}

function datestamp(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export class AuditLogger {
  private readonly logDir: string;

  constructor(configDir: string) {
    this.logDir = resolve(configDir, "audit_logs");
    mkdirSync(this.logDir, { recursive: true });
  }

  // Layer 5 core: log every tool action
  log(entry: Omit<AuditEntry, "id" | "date">): AuditEntry {
    const full: AuditEntry = {
      id: shortId(),
      date: datestamp(entry.timestamp),
      ...entry,
    };
    this.append(this.dailyPath(entry.timestamp), full);
    return full;
  }

  // Layer 9: security incidents
  logSecurityEvent(event: Omit<SecurityEvent, "id">): SecurityEvent {
    const full: SecurityEvent = { id: shortId(), ...event };
    this.append(this.securityPath(), full);
    return full;
  }

  // General error log
  logError(entry: Omit<ErrorLogEntry, "id">): ErrorLogEntry {
    const full: ErrorLogEntry = { id: shortId(), ...entry };
    this.append(this.errorPath(), full);
    return full;
  }

  // Query audit entries for a date range. Returns entries sorted newest-first.
  query(opts: {
    sessionId?: string;
    toolName?: string;
    dangerousOnly?: boolean;
    limit?: number;
    startDate?: string;
    endDate?: string;
  } = {}): AuditEntry[] {
    const files = this.auditFiles().filter((f) => {
      if (opts.startDate && f < opts.startDate) return false;
      if (opts.endDate && f > opts.endDate) return false;
      return true;
    });

    const entries: AuditEntry[] = [];
    for (const file of files.reverse()) {
      const path = resolve(this.logDir, `${file}.jsonl`);
      if (!existsSync(path)) continue;
      const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const e = JSON.parse(line) as AuditEntry;
          if (opts.sessionId && e.sessionId !== opts.sessionId) continue;
          if (opts.toolName && e.toolName !== opts.toolName) continue;
          if (opts.dangerousOnly && e.riskLevel !== "high" && e.riskLevel !== "critical") continue;
          entries.push(e);
        } catch { /* malformed line */ }
      }
      if (opts.limit && entries.length >= opts.limit) break;
    }

    if (opts.limit) return entries.slice(0, opts.limit);
    return entries;
  }

  // Query security events
  querySecurityEvents(opts: { sessionId?: string; limit?: number } = {}): SecurityEvent[] {
    const path = this.securityPath();
    if (!existsSync(path)) return [];
    const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
    const events: SecurityEvent[] = [];
    for (const line of lines.reverse()) {
      try {
        const e = JSON.parse(line) as SecurityEvent;
        if (opts.sessionId && e.sessionId !== opts.sessionId) continue;
        events.push(e);
        if (opts.limit && events.length >= opts.limit) break;
      } catch { /* skip */ }
    }
    return events;
  }

  // Export all entries for a session as JSON
  export(sessionId?: string): string {
    const entries = sessionId
      ? this.query({ sessionId })
      : this.query({ limit: 1000 });
    return JSON.stringify(entries, null, 2);
  }

  // Return the most recent N audit entries for the given session
  recent(sessionId: string, limit = 100): AuditEntry[] {
    return this.query({ sessionId, limit });
  }

  getLogDir(): string {
    return this.logDir;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private append(path: string, entry: object): void {
    appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
  }

  private dailyPath(ts = Date.now()): string {
    return resolve(this.logDir, `${datestamp(ts)}.jsonl`);
  }

  private securityPath(): string {
    return resolve(this.logDir, "security_events.jsonl");
  }

  private errorPath(): string {
    return resolve(this.logDir, "error_log.jsonl");
  }

  private approvalHistoryPath(): string {
    return resolve(this.logDir, "approval_history.jsonl");
  }

  // Log an approval decision (for the approval_history.json equivalent)
  logApproval(entry: {
    timestamp: number;
    sessionId: string;
    toolName: string;
    approved: boolean;
    reply: "once" | "always" | "reject";
  }): void {
    this.append(this.approvalHistoryPath(), entry);
  }

  private auditFiles(): string[] {
    if (!existsSync(this.logDir)) return [];
    return readdirSync(this.logDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.replace(".jsonl", ""))
      .sort();
  }
}
