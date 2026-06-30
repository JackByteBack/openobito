import type Database from "better-sqlite3";
import { memorySet, memoryGet, memoryDelete, memoryAll } from "../storage/index.js";

// ─── Agent memory (key-value, persisted in SQLite) ───────────────────────────

export class AgentMemory {
  constructor(private db: Database.Database) {}

  set(key: string, value: string): void {
    memorySet(this.db, key, value);
  }

  get(key: string): string | null {
    return memoryGet(this.db, key);
  }

  delete(key: string): void {
    memoryDelete(this.db, key);
  }

  all(): Record<string, string> {
    return memoryAll(this.db);
  }

  toContextString(): string {
    const entries = Object.entries(this.all());
    if (entries.length === 0) return "";
    const lines = entries.map(([k, v]) => `- ${k}: ${v}`);
    return `[Agent Memory]\n${lines.join("\n")}`;
  }
}
