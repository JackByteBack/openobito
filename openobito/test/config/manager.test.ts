import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigManager } from "../../src/config/manager.js";

// Note: ConfigManager reads from the real user config dir (~/Library/Application Support/openagent/).
// These tests check that the basic API works but are lenient about default values
// since an existing config file may override them.

describe("ConfigManager", () => {
  it("loads config and has expected keys", () => {
    const mgr = new ConfigManager();
    expect(mgr.get("model.primary")).toBeTruthy();
    expect(mgr.get("model.base_url")).toBeTruthy();
    expect(mgr.get("model.temperature")).toStrictEqual(expect.any(Number));
    expect(mgr.get("app.telemetry")).toBe(false);
  });

  it("rejects out-of-range temperature", () => {
    const mgr = new ConfigManager();
    const err = mgr.set("model.temperature", 3.0);
    expect(err).not.toBeNull();
    expect(err).toContain("Validation error");
  });

  it("rejects invalid enum values", () => {
    const mgr = new ConfigManager();
    const err = mgr.set("app.theme", "neon");
    expect(err).not.toBeNull();
  });

  it("never allows telemetry to be true", () => {
    const mgr = new ConfigManager();
    expect(mgr.get("app.telemetry")).toBe(false);
  });

  it("returns config file path", () => {
    const mgr = new ConfigManager();
    expect(mgr.configPath()).toContain("config.yaml");
    expect(mgr.configDir()).toContain("openagent");
  });
});
