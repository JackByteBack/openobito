import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import {
  createSession,
  getSession,
  listSessions,
  insertMessage,
  getMessages,
  memorySet,
  memoryGet,
  memoryAll,
  logAudit,
} from "../../src/storage/index.js";
import { SCHEMA_SQL } from "../../src/storage/schema.js";

describe("Storage", () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
  });

  afterAll(() => {
    db.close();
  });

  it("creates and retrieves a session", () => {
    createSession(db, {
      id: "test-session-1",
      title: "Test Session",
      model: "llama3.2",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const session = getSession(db, "test-session-1");
    expect(session).not.toBeNull();
    expect(session?.title).toBe("Test Session");
  });

  it("lists sessions ordered by updated_at", () => {
    createSession(db, {
      id: "test-session-2",
      title: "Older Session",
      model: "mistral",
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
    });
    const sessions = listSessions(db, 10);
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0]?.updatedAt).toBeGreaterThanOrEqual(sessions[1]?.updatedAt ?? 0);
  });

  it("inserts and retrieves messages", () => {
    insertMessage(db, "test-session-1", {
      id: "msg-1",
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    });
    insertMessage(db, "test-session-1", {
      id: "msg-2",
      role: "assistant",
      content: "Hi there",
      timestamp: Date.now() + 1,
    });
    const messages = getMessages(db, "test-session-1");
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0]?.content).toBe("Hello");
    expect(messages[1]?.content).toBe("Hi there");
  });

  it("stores and retrieves memory", () => {
    memorySet(db, "key1", "value1");
    expect(memoryGet(db, "key1")).toBe("value1");
    expect(memoryGet(db, "nonexistent")).toBeNull();
  });

  it("lists all memory entries", () => {
    memorySet(db, "key2", "value2");
    const all = memoryAll(db);
    expect(all["key1"]).toBe("value1");
    expect(all["key2"]).toBe("value2");
  });

  it("logs audit entries", () => {
    expect(() =>
      logAudit(db, {
        sessionId: "test-session-1",
        toolName: "read_file",
        action: "allow",
        riskLevel: "low",
        approved: true,
      }),
    ).not.toThrow();
  });
});
