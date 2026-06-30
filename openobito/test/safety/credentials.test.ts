import { describe, it, expect } from "vitest";
import {
  detectCredentials,
  detectCredentialsInParams,
  isCredentialKey,
  sanitize,
  encrypt,
  decrypt,
  SessionMemory,
} from "../../src/safety/credentials.js";
import { randomBytes } from "node:crypto";

describe("detectCredentials()", () => {
  it("detects API keys", () => {
    const hits = detectCredentials("api_key=sk-proj-abc123def456ghi789jkl012");
    expect(hits.some((h) => h.type === "api_key")).toBe(true);
  });

  it("detects AWS access key IDs", () => {
    const hits = detectCredentials("AKIAIOSFODNN7EXAMPLE");
    expect(hits.some((h) => h.type === "aws_access_key")).toBe(true);
  });

  it("detects JWT tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const hits = detectCredentials(jwt);
    expect(hits.some((h) => h.type === "jwt")).toBe(true);
  });

  it("detects private key headers", () => {
    const hits = detectCredentials("-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...");
    expect(hits.some((h) => h.type === "private_key")).toBe(true);
  });

  it("detects Bearer tokens", () => {
    const hits = detectCredentials("Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(hits.some((h) => h.type === "bearer")).toBe(true);
  });

  it("returns empty for clean text", () => {
    const hits = detectCredentials("Hello, world! This is a normal sentence.");
    expect(hits).toHaveLength(0);
  });
});

describe("detectCredentialsInParams()", () => {
  it("finds credentials in nested params", () => {
    const hits = detectCredentialsInParams({
      command: "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
      env: "production",
    });
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("isCredentialKey()", () => {
  it("flags credential key names", () => {
    expect(isCredentialKey("password")).toBe(true);
    expect(isCredentialKey("api_key")).toBe(true);
    expect(isCredentialKey("auth_token")).toBe(true);
    expect(isCredentialKey("JWT_SECRET")).toBe(true);
    expect(isCredentialKey("private_key")).toBe(true);
  });

  it("passes safe key names", () => {
    expect(isCredentialKey("username")).toBe(false);
    expect(isCredentialKey("email")).toBe(false);
    expect(isCredentialKey("count")).toBe(false);
    expect(isCredentialKey("theme")).toBe(false);
  });
});

describe("sanitize()", () => {
  it("redacts API keys from text", () => {
    const out = sanitize("api_key=sk-proj-abc123def456");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("sk-proj");
  });

  it("leaves clean text unchanged", () => {
    const clean = "This is a normal message without any secrets.";
    expect(sanitize(clean)).toBe(clean);
  });
});

describe("AES-256-GCM encrypt/decrypt", () => {
  it("round-trips correctly", () => {
    const key = randomBytes(32);
    const plaintext = "Hello, secret world! 🔐";
    const payload = encrypt(plaintext, key);

    expect(payload.algorithm).toBe("aes-256-gcm");
    expect(payload.iv).toHaveLength(24);
    expect(payload.tag).toHaveLength(32);
    expect(payload.data).not.toBe(plaintext);

    const recovered = decrypt(payload, key);
    expect(recovered).toBe(plaintext);
  });

  it("fails with wrong key", () => {
    const key1 = randomBytes(32);
    const key2 = randomBytes(32);
    const payload = encrypt("secret", key1);
    expect(() => decrypt(payload, key2)).toThrow();
  });

  it("rejects wrong key length", () => {
    const key = randomBytes(16);
    expect(() => encrypt("secret", key)).toThrow();
  });
});

describe("SessionMemory", () => {
  it("stores and retrieves values", () => {
    const mem = new SessionMemory();
    mem.set("name", "Alice");
    expect(mem.get("name")).toBe("Alice");
  });

  it("blocks credential key names", () => {
    const mem = new SessionMemory();
    expect(() => mem.set("password", "hunter2")).toThrow(/credential/i);
    expect(() => mem.set("api_key", "secret")).toThrow();
  });

  it("delete removes a key", () => {
    const mem = new SessionMemory();
    mem.set("color", "blue");
    mem.delete("color");
    expect(mem.get("color")).toBeUndefined();
  });

  it("clear() empties all entries", () => {
    const mem = new SessionMemory();
    mem.set("a", "1");
    mem.set("b", "2");
    mem.clear();
    expect(mem.size).toBe(0);
  });
});
