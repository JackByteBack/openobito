import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import { createSession, insertMessage, getMessages, updateSessionTitle } from "../storage/index.js";
import type { Message, Session } from "../types/index.js";

// ─── Session manager ─────────────────────────────────────────────────────────

export class SessionManager {
  constructor(
    private db: Database.Database,
    private model: string
  ) {}

  create(title = "New Session"): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      title,
      model: this.model,
      createdAt: now,
      updatedAt: now,
      messages: [],
      status: "idle",
    };
    createSession(this.db, {
      id: session.id,
      title: session.title,
      model: session.model,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
    return session;
  }

  addMessage(session: Session, msg: Omit<Message, "id" | "timestamp">): Message {
    const full: Message = { ...msg, id: randomUUID(), timestamp: Date.now() };
    session.messages.push(full);
    insertMessage(this.db, session.id, full);
    return full;
  }

  setTitle(session: Session, title: string): void {
    session.title = title;
    updateSessionTitle(this.db, session.id, title);
  }

  makeTitleFromFirstMessage(content: string): string {
    const words = content.trim().split(/\s+/).slice(0, 6).join(" ");
    return words.length > 50 ? words.slice(0, 47) + "…" : words;
  }
}
