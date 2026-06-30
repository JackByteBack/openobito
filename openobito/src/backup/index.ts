import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, statSync, writeFileSync, readFileSync } from "fs";
import { join, resolve, basename } from "path";
import { homedir } from "os";
import Database from "better-sqlite3";

// ─── Backup & Disaster Recovery ───────────────────────────────────────────────

export interface BackupManifest {
  id: string;
  name: string;
  type: "full" | "session" | "config" | "skills";
  createdAt: number;
  sizeBytes: number;
  files: string[];
}

const BACKUPS_DIR = resolve(homedir(), ".openagent", "backups");
const CONFIG_DIR = resolve(homedir(), ".openagent");

export class BackupSystem {
  private backups: BackupManifest[] = [];

  constructor() {
    if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
    this.scanExisting();
  }

  private scanExisting(): void {
    for (const entry of readdirSync(BACKUPS_DIR)) {
      const manifestPath = join(BACKUPS_DIR, entry, "backup.json");
      if (!existsSync(manifestPath)) continue;
      try {
        this.backups.push(JSON.parse(readFileSync(manifestPath, "utf8")));
      } catch {
        continue;
      }
    }
  }

  list(): BackupManifest[] {
    return [...this.backups].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): BackupManifest | undefined {
    return this.backups.find((b) => b.id === id);
  }

  createFull(dbPath: string, name?: string): BackupManifest {
    const id = `backup-${Date.now().toString(36)}`;
    const dir = join(BACKUPS_DIR, id);
    mkdirSync(dir, { recursive: true });

    const files: string[] = [];

    // Backup SQLite database
    if (existsSync(dbPath)) {
      const dbCopy = join(dir, "openagent.db");
      copyFileSync(dbPath, dbCopy);
      files.push("openagent.db");
    }

    // Backup config
    const configPath = join(CONFIG_DIR, "config.yaml");
    if (existsSync(configPath)) {
      copyFileSync(configPath, join(dir, "config.yaml"));
      files.push("config.yaml");
    }

    // Backup skills
    const skillsDir = join(CONFIG_DIR, "skills");
    if (existsSync(skillsDir)) {
      const skillsBackup = join(dir, "skills");
      mkdirSync(skillsBackup, { recursive: true });
      this.copyRecursive(skillsDir, skillsBackup);
      files.push("skills/");
    }

    const manifest: BackupManifest = {
      id,
      name: name ?? `Backup ${new Date().toLocaleDateString()}`,
      type: "full",
      createdAt: Date.now(),
      sizeBytes: this.dirSize(dir),
      files,
    };

    writeFileSync(join(dir, "backup.json"), JSON.stringify(manifest, null, 2));
    this.backups.push(manifest);
    return manifest;
  }

  createSessionBackup(db: Database.Database, sessionId: string): BackupManifest {
    const id = `session-${sessionId.slice(0, 8)}-${Date.now().toString(36)}`;
    const dir = join(BACKUPS_DIR, id);
    mkdirSync(dir, { recursive: true });

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    const messages = db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC").all(sessionId);
    const data = { session, messages };

    const file = join(dir, "session.json");
    writeFileSync(file, JSON.stringify(data, null, 2));

    const manifest: BackupManifest = {
      id,
      name: `Session ${sessionId.slice(0, 8)}`,
      type: "session",
      createdAt: Date.now(),
      sizeBytes: statSync(file).size,
      files: ["session.json"],
    };

    writeFileSync(join(dir, "backup.json"), JSON.stringify(manifest, null, 2));
    this.backups.push(manifest);
    return manifest;
  }

  restore(id: string, dbPath?: string): string[] {
    const backup = this.get(id);
    if (!backup) throw new Error(`Backup not found: ${id}`);

    const dir = join(BACKUPS_DIR, id);
    const restored: string[] = [];

    if (backup.type === "full" || backup.type === "config") {
      const configBackup = join(dir, "config.yaml");
      if (existsSync(configBackup)) {
        const configTarget = join(CONFIG_DIR, "config.yaml");
        copyFileSync(configBackup, configTarget);
        restored.push(configTarget);
      }

      if (dbPath && existsSync(join(dir, "openagent.db"))) {
        copyFileSync(join(dir, "openagent.db"), dbPath);
        restored.push(dbPath);
      }

      const skillsBackup = join(dir, "skills");
      if (existsSync(skillsBackup)) {
        const skillsTarget = join(CONFIG_DIR, "skills");
        if (existsSync(skillsTarget)) rmSync(skillsTarget, { recursive: true });
        this.copyRecursive(skillsBackup, skillsTarget);
        restored.push(skillsTarget);
      }
    }

    return restored;
  }

  delete(id: string): boolean {
    const backup = this.get(id);
    if (!backup) return false;
    const dir = join(BACKUPS_DIR, id);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    this.backups = this.backups.filter((b) => b.id !== id);
    return true;
  }

  prune(keep: number): number {
    const sorted = [...this.backups].sort((a, b) => b.createdAt - a.createdAt);
    if (sorted.length <= keep) return 0;
    const toDelete = sorted.slice(keep);
    for (const b of toDelete) this.delete(b.id);
    return toDelete.length;
  }

  private copyRecursive(src: string, dest: string): void {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      const stat = statSync(srcPath);
      if (stat.isDirectory()) {
        this.copyRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  private dirSize(dir: string): number {
    let size = 0;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) size += this.dirSize(path);
      else size += stat.size;
    }
    return size;
  }
}

export function createBackupSystem(): BackupSystem {
  return new BackupSystem();
}
