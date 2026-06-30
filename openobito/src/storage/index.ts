import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { SCHEMA_SQL } from "./schema.js";
import type { Message, Session } from "../types/index.js";

export type { Database };

let _db: Database.Database | null = null;

export function getDb(dbPath: string): Database.Database {
  if (_db) return _db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.exec(SCHEMA_SQL);
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}

// ─── Session operations ──────────────────────────────────────────────────────

export function createSession(db: Database.Database, session: Omit<Session, "messages" | "status">): void {
  db.prepare(
    `INSERT INTO sessions (id, title, model, created_at, updated_at)
     VALUES (@id, @title, @model, @createdAt, @updatedAt)`
  ).run({
    id: session.id,
    title: session.title,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}

export function getSession(db: Database.Database, id: string): Session | null {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;

  const messages = getMessages(db, id);
  return {
    id: row["id"] as string,
    title: row["title"] as string,
    model: row["model"] as string,
    createdAt: row["created_at"] as number,
    updatedAt: row["updated_at"] as number,
    messages,
    status: "idle",
  };
}

export function listSessions(db: Database.Database, limit = 20): Session[] {
  const rows = db
    .prepare(`SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row["id"] as string,
    title: row["title"] as string,
    model: row["model"] as string,
    createdAt: row["created_at"] as number,
    updatedAt: row["updated_at"] as number,
    messages: [],
    status: "idle" as const,
  }));
}

export function updateSessionTitle(db: Database.Database, id: string, title: string): void {
  db.prepare(`UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`).run(
    title,
    Date.now(),
    id
  );
}

export function deleteSession(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
}

// ─── Message operations ──────────────────────────────────────────────────────

export function insertMessage(db: Database.Database, sessionId: string, msg: Message): void {
  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, tool_call_id, tool_name, timestamp)
     VALUES (@id, @sessionId, @role, @content, @toolCallId, @toolName, @timestamp)`
  ).run({
    id: msg.id,
    sessionId,
    role: msg.role,
    content: msg.content,
    toolCallId: msg.toolCallId ?? null,
    toolName: msg.toolName ?? null,
    timestamp: msg.timestamp,
  });

  db.prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(Date.now(), sessionId);
}

export function getMessages(db: Database.Database, sessionId: string): Message[] {
  const rows = db
    .prepare(`SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC`)
    .all(sessionId) as Record<string, unknown>[];

  return rows.map((row) => {
    const msg: Message = {
      id: row["id"] as string,
      role: row["role"] as Message["role"],
      content: row["content"] as string,
      timestamp: row["timestamp"] as number,
    };
    const toolCallId = row["tool_call_id"] as string | null;
    const toolName = row["tool_name"] as string | null;
    if (toolCallId) msg.toolCallId = toolCallId;
    if (toolName) msg.toolName = toolName;
    return msg;
  });
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export function logAudit(
  db: Database.Database,
  entry: {
    sessionId?: string;
    toolName: string;
    action: string;
    riskLevel: string;
    approved: boolean;
    payload?: unknown;
    result?: unknown;
  }
): void {
  db.prepare(
    `INSERT INTO audit_log (session_id, tool_name, action, risk_level, approved, payload, result, timestamp)
     VALUES (@sessionId, @toolName, @action, @riskLevel, @approved, @payload, @result, @timestamp)`
  ).run({
    sessionId: entry.sessionId ?? null,
    toolName: entry.toolName,
    action: entry.action,
    riskLevel: entry.riskLevel,
    approved: entry.approved ? 1 : 0,
    payload: entry.payload ? JSON.stringify(entry.payload) : null,
    result: entry.result ? JSON.stringify(entry.result) : null,
    timestamp: Date.now(),
  });
}

// ─── Memory (key-value) ──────────────────────────────────────────────────────

export function memorySet(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO memory (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, Date.now());
}

export function memoryGet(db: Database.Database, key: string): string | null {
  const row = db.prepare(`SELECT value FROM memory WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function memoryDelete(db: Database.Database, key: string): void {
  db.prepare(`DELETE FROM memory WHERE key = ?`).run(key);
}

export function memoryAll(db: Database.Database): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM memory`).all() as Array<{
    key: string;
    value: string;
  }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ─── Snapshot operations ─────────────────────────────────────────────────────

export interface SnapshotRecord {
  id: string;
  sessionId: string;
  label: string;
  messageIds: string[];
  createdAt: number;
}

export function createSnapshot(db: Database.Database, snapshot: SnapshotRecord): void {
  db.prepare(
    `INSERT INTO snapshots (id, session_id, label, message_ids, created_at)
     VALUES (@id, @sessionId, @label, @messageIds, @createdAt)`
  ).run({
    id: snapshot.id,
    sessionId: snapshot.sessionId,
    label: snapshot.label,
    messageIds: JSON.stringify(snapshot.messageIds),
    createdAt: snapshot.createdAt,
  });
}

export function listSnapshots(db: Database.Database, sessionId?: string): SnapshotRecord[] {
  const query = sessionId
    ? `SELECT * FROM snapshots WHERE session_id = ? ORDER BY created_at DESC`
    : `SELECT * FROM snapshots ORDER BY created_at DESC`;
  const rows = db.prepare(query).all(sessionId ? [sessionId] : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row["id"] as string,
    sessionId: row["session_id"] as string,
    label: row["label"] as string,
    messageIds: JSON.parse(row["message_ids"] as string) as string[],
    createdAt: row["created_at"] as number,
  }));
}

export function getSnapshot(db: Database.Database, id: string): SnapshotRecord | null {
  const row = db.prepare(`SELECT * FROM snapshots WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row["id"] as string,
    sessionId: row["session_id"] as string,
    label: row["label"] as string,
    messageIds: JSON.parse(row["message_ids"] as string) as string[],
    createdAt: row["created_at"] as number,
  };
}

export function deleteSnapshot(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM snapshots WHERE id = ?`).run(id);
}

export function pruneSnapshots(db: Database.Database, keep: number): number {
  const all = db.prepare(`SELECT id FROM snapshots ORDER BY created_at DESC`).all() as Array<{ id: string }>;
  if (all.length <= keep) return 0;
  const toDelete = all.slice(keep).map((r) => r.id);
  const stmt = db.prepare(`DELETE FROM snapshots WHERE id = ?`);
  const removed = db.transaction(() => {
    for (const id of toDelete) stmt.run(id);
    return toDelete.length;
  })();
  return removed;
}

// ─── Backup operations ────────────────────────────────────────────────────────

export interface BackupRecord {
  id: string;
  name: string;
  type: "full" | "session" | "config" | "skills";
  path: string;
  sizeBytes: number;
  createdAt: number;
}

export function createBackup(db: Database.Database, backup: BackupRecord): void {
  db.prepare(
    `INSERT INTO backups (id, name, type, path, size_bytes, created_at)
     VALUES (@id, @name, @type, @path, @sizeBytes, @createdAt)`
  ).run(backup);
}

export function listBackups(db: Database.Database, type?: string): BackupRecord[] {
  const query = type
    ? `SELECT * FROM backups WHERE type = ? ORDER BY created_at DESC`
    : `SELECT * FROM backups ORDER BY created_at DESC`;
  const rows = db.prepare(query).all(type ? [type] : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row["id"] as string,
    name: row["name"] as string,
    type: row["type"] as BackupRecord["type"],
    path: row["path"] as string,
    sizeBytes: row["size_bytes"] as number,
    createdAt: row["created_at"] as number,
  }));
}

export function deleteBackup(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM backups WHERE id = ?`).run(id);
}
