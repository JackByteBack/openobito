import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { AgentMemory } from "../../src/agent/memory.js";

describe("AgentMemory", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "openobito-test-"));
    db = new Database(join(tmpDir, "test.db"));
    db.exec("CREATE TABLE IF NOT EXISTS memory (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)");
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("stores and retrieves values", () => {
    const mem = new AgentMemory(db);
    mem.set("key1", "value1");
    expect(mem.get("key1")).toBe("value1");
  });

  it("returns null for missing keys", () => {
    const mem = new AgentMemory(db);
    expect(mem.get("nonexistent")).toBeNull();
  });

  it("deletes values", () => {
    const mem = new AgentMemory(db);
    mem.set("key1", "value1");
    mem.delete("key1");
    expect(mem.get("key1")).toBeNull();
  });

  it("lists all values", () => {
    const mem = new AgentMemory(db);
    mem.set("a", "1");
    mem.set("b", "2");
    const all = mem.all();
    expect(all["a"]).toBe("1");
    expect(all["b"]).toBe("2");
    expect(Object.keys(all)).toHaveLength(2);
  });

  it("produces context string", () => {
    const mem = new AgentMemory(db);
    mem.set("language", "typescript");
    const ctx = mem.toContextString();
    expect(ctx).toContain("language");
    expect(ctx).toContain("typescript");
  });
});
