// Layer 7 — File Access Control
// Protected read-only paths, blocked dirs, dangerous extensions, auto-backup.

import { resolve, extname, dirname, basename } from "path";
import { homedir } from "os";
import { existsSync, copyFileSync, mkdirSync, statSync } from "fs";
import type { AccessResult } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOME = homedir();

// These paths are read-only; any write/delete attempt requires approval at minimum.
// Indexed as prefix strings for fast matching after resolve().
const PROTECTED_PREFIX_PATTERNS: RegExp[] = [
  new RegExp(`^${escapeRe(HOME + "/.ssh")}`),
  new RegExp(`^${escapeRe(HOME + "/.aws")}`),
  new RegExp(`^${escapeRe(HOME + "/.kube")}`),
  new RegExp(`^${escapeRe(HOME + "/.gnupg")}`),
  new RegExp(`^${escapeRe(HOME + "/.config/gh")}`),
];

// .env files anywhere
const PROTECTED_FILENAME_PATTERNS: RegExp[] = [
  /^\.env(\.|$)/,           // .env, .env.local, .env.production …
  /^\.netrc$/,
  /^\.npmrc$/,
  /^\.pypirc$/,
];

// Directories that are always blocked (no read or write)
const ALWAYS_BLOCKED_DIRS = [
  "/etc",
  "/sys",
  "/proc",
  "/root",
  "/boot",
  "/dev",
  "C:\\Windows",
  "C:\\System32",
];

// Extensions blocked for writes (executable/script files)
const DANGEROUS_WRITE_EXTENSIONS = new Set([
  ".exe", ".dll", ".sys", ".drv",   // Windows executables/drivers
  ".sh", ".bash", ".zsh", ".fish",  // Shell scripts
  ".bat", ".cmd", ".ps1", ".psm1",  // Windows scripts
  ".vbs", ".js", ".wsf",            // Windows script host
  ".app", ".dmg", ".pkg",           // macOS packages
  ".deb", ".rpm", ".snap",          // Linux packages
]);

// Maximum file size for reads: 100 MB
export const MAX_READ_BYTES = 100 * 1024 * 1024;

// Backup directory within the openagent config dir
const BACKUP_SUBDIR = "backups";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── FileAccessControl ────────────────────────────────────────────────────────

export class FileAccessControl {
  private configDir: string;

  constructor(configDir: string) {
    this.configDir = configDir;
  }

  checkRead(filePath: string): AccessResult {
    const abs = resolve(filePath);

    if (isAlwaysBlocked(abs)) {
      return { allowed: false, reason: `Blocked directory: ${abs}` };
    }

    try {
      const st = statSync(abs);
      if (st.size > MAX_READ_BYTES) {
        return { allowed: false, reason: `File too large: ${(st.size / 1024 / 1024).toFixed(1)} MB (max 100 MB)` };
      }
    } catch {
      // file doesn't exist — let the tool handle it
    }

    if (isProtectedPath(abs)) {
      return { allowed: true, requiresApproval: true, reason: "Protected path — read allowed but logged" };
    }

    return { allowed: true };
  }

  checkWrite(filePath: string): AccessResult {
    const abs = resolve(filePath);

    if (isAlwaysBlocked(abs)) {
      return { allowed: false, reason: `Blocked directory: ${abs}` };
    }

    if (isProtectedPath(abs)) {
      return { allowed: false, reason: `Protected path (read-only): ${abs}` };
    }

    const ext = extname(abs).toLowerCase();
    if (DANGEROUS_WRITE_EXTENSIONS.has(ext)) {
      return { allowed: true, requiresApproval: true, reason: `Dangerous extension ${ext} — write requires approval` };
    }

    return { allowed: true };
  }

  checkDelete(filePath: string): AccessResult {
    const abs = resolve(filePath);

    if (isAlwaysBlocked(abs)) {
      return { allowed: false, reason: `Blocked directory: ${abs}` };
    }

    if (isProtectedPath(abs)) {
      return { allowed: false, reason: `Protected path — deletion blocked: ${abs}` };
    }

    // Deletes always require approval (can't be undone without the backup)
    return { allowed: true, requiresApproval: true, reason: "File deletion requires approval" };
  }

  // Create a timestamped backup before a destructive operation.
  // Returns the backup path, or throws if the backup fails.
  backup(filePath: string): string {
    const abs = resolve(filePath);
    if (!existsSync(abs)) return abs; // nothing to back up

    const backupDir = resolve(this.configDir, BACKUP_SUBDIR, dateStamp());
    mkdirSync(backupDir, { recursive: true });

    const safeName = abs.replace(/[/\\:]/g, "_").replace(/^_+/, "");
    const backupPath = resolve(backupDir, safeName);
    copyFileSync(abs, backupPath);
    return backupPath;
  }

  // Check whether a directory listing is allowed.
  checkList(dirPath: string): AccessResult {
    const abs = resolve(dirPath);
    if (isAlwaysBlocked(abs)) {
      return { allowed: false, reason: `Blocked directory: ${abs}` };
    }
    return { allowed: true };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAlwaysBlocked(abs: string): boolean {
  return ALWAYS_BLOCKED_DIRS.some((dir) =>
    abs === dir || abs.startsWith(dir + "/") || abs.startsWith(dir + "\\")
  );
}

function isProtectedPath(abs: string): boolean {
  const name = basename(abs);
  if (PROTECTED_FILENAME_PATTERNS.some((re) => re.test(name))) return true;
  if (PROTECTED_PREFIX_PATTERNS.some((re) => re.test(abs))) return true;
  return false;
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Exported for tests
export { isAlwaysBlocked, isProtectedPath };
