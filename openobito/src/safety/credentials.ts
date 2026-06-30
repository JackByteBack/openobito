// Layer 8 — Memory & Credential Protection
// Pattern detection, AES-256-GCM encryption at rest, session isolation.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { CredentialDetection, EncryptedPayload } from "./types.js";

// ─── Detection patterns ───────────────────────────────────────────────────────

interface DetectionPattern {
  type: string;
  pattern: RegExp;
}

const CREDENTIAL_PATTERNS: DetectionPattern[] = [
  { type: "password",       pattern: /(?:password|passwd|pwd)\s*[:=]\s*(['"]?)(\S+)\1/gi },
  { type: "api_key",        pattern: /(?:api[-_]?key|apikey)\s*[:=]\s*(['"]?)([A-Za-z0-9\-_.~+/]{16,})\1/gi },
  { type: "token",          pattern: /(?:token|auth[-_]?token|access[-_]?token)\s*[:=]\s*(['"]?)([A-Za-z0-9\-_.~+/]{16,})\1/gi },
  { type: "jwt",            pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { type: "bearer",         pattern: /Bearer\s+([A-Za-z0-9\-_.~+/]{20,})/g },
  { type: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/g },
  { type: "aws_secret",     pattern: /(?:aws[-_]?secret|secret[-_]?access[-_]?key)\s*[:=]\s*(['"]?)([A-Za-z0-9/+]{40})\1/gi },
  { type: "private_key",    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { type: "credit_card",    pattern: /\b(?:4\d{15}|5[1-5]\d{14}|3[47]\d{13}|6011\d{12})\b/g },
  { type: "ssn",            pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "github_token",   pattern: /gh[pousr]_[A-Za-z0-9_]{36}/g },
  { type: "slack_token",    pattern: /xox[boaprs]-[0-9a-zA-Z\-]{10,}/g },
];

// Patterns to block from being stored in memory or logs at all
const STORAGE_BLOCK_KEYWORDS = [
  "password", "api_key", "token", "jwt", "bearer",
  "credit_card", "ssn", "private_key", "rsa", "secret",
  "passwd", "passphrase", "pin", "cvv", "social_security",
];

export function detectCredentials(text: string): CredentialDetection[] {
  const findings: CredentialDetection[] = [];
  for (const { type, pattern } of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      findings.push({ type, match: redactMatch(m[0]), offset: m.index });
    }
  }
  return findings;
}

// Detect if a parameter map contains values that look like credentials.
export function detectCredentialsInParams(params: Record<string, unknown>): CredentialDetection[] {
  const text = JSON.stringify(params);
  return detectCredentials(text);
}

// Check if a key name suggests credential storage (for blocking memory writes).
export function isCredentialKey(key: string): boolean {
  const lower = key.toLowerCase();
  return STORAGE_BLOCK_KEYWORDS.some((kw) => lower.includes(kw));
}

// Replace detected credential values with [REDACTED] in a string.
export function sanitize(text: string): string {
  let out = text;
  for (const { pattern } of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

// ─── AES-256-GCM Encryption ───────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;

export function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  if (key.length !== KEY_BYTES) throw new Error(`Key must be ${KEY_BYTES} bytes`);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: ALGORITHM,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
  };
}

export function decrypt(payload: EncryptedPayload, key: Buffer): string {
  if (key.length !== KEY_BYTES) throw new Error(`Key must be ${KEY_BYTES} bytes`);
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const data = Buffer.from(payload.data, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

// Derive a 32-byte key from a passphrase using scrypt.
// salt should be stored alongside the encrypted data.
export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  // Use synchronous scrypt (safe here — called once at session init)
  const { scryptSync } = require("node:crypto");
  return scryptSync(passphrase, salt, KEY_BYTES) as Buffer;
}

export function generateSalt(): Buffer {
  return randomBytes(16);
}

// ─── Session memory isolation ─────────────────────────────────────────────────

// A per-session in-memory credential store. Contents never cross session boundaries.
// Items expire after 30 days (maxAgeMs).
export class SessionMemory {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();
  private readonly maxAgeMs: number;

  constructor(maxAgeDays = 30) {
    this.maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  }

  set(key: string, value: string): void {
    if (isCredentialKey(key)) {
      throw new Error(`Blocked: key "${key}" matches a credential pattern and cannot be stored.`);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.maxAgeMs });
  }

  get(key: string): string | undefined {
    this.prune();
    return this.store.get(key)?.value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  // Remove expired entries
  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }

  get size(): number {
    this.prune();
    return this.store.size;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function redactMatch(match: string): string {
  if (match.length <= 8) return "****";
  return match.slice(0, 4) + "****" + match.slice(-4);
}
