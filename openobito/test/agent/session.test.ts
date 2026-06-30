import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { SessionManager } from "../../src/agent/session.js";
import { SCHEMA_SQL } from "../../src/storage/schema.js";

describe("SessionManager", () => {
  let db: Database.Database;
  let mgr: SessionManager;

  beforeAll(() => {
    db = new Database(":memory:");
    db.exec(SCHEMA_SQL);
    mgr = new SessionManager(db, "llama3.2");
  });

  afterAll(() => {
    db.close();
  });

  it("creates a new session", () => {
    const session = mgr.create("Test");
    expect(session.id).toBeTruthy();
    expect(session.title).toBe("Test");
    expect(session.model).toBe("llama3.2");
    expect(session.messages).toEqual([]);
    expect(session.status).toBe("idle");
  });

  it("adds a message to a session", () => {
    const session = mgr.create();
    const msg = mgr.addMessage(session, { role: "user", content: "hello" });
    expect(msg.id).toBeTruthy();
    expect(msg.content).toBe("hello");
    expect(session.messages).toHaveLength(1);
  });

  it("generates title from first message", () => {
    const title = mgr.makeTitleFromFirstMessage("what is the meaning of life?");
    expect(title).toBe("what is the meaning of life?");
  });

  it("truncates long titles", () => {
    const long = "a ".repeat(100);
    const title = mgr.makeTitleFromFirstMessage(long);
    expect(title.length).toBeLessThanOrEqual(50);
    expect(title).toContain("a");
  });

  it("sets session title", () => {
    const session = mgr.create("Initial");
    mgr.setTitle(session, "Updated");
    expect(session.title).toBe("Updated");
  });
});
