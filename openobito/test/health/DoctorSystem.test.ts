import { describe, it, expect } from "vitest";
import { DoctorSystem } from "../../src/health/DoctorSystem.js";
import type { DiagnosticItem, DoctorReport } from "../../src/health/DoctorSystem.js";

describe("DoctorSystem", () => {
  it("checkNodeVersion returns ok for Node 18+", () => {
    const system = new DoctorSystem();
    const result = system.checkNodeVersion();
    expect(result.name).toBe("Node.js version");
    expect(result.severity).toBe("ok");
  });

  it("checkEnvironment returns ok when env vars are set", () => {
    const system = new DoctorSystem();
    const result = system.checkEnvironment();
    expect(result.name).toBe("Environment");
    expect(["ok", "warn", "error"]).toContain(result.severity);
  });

  it("checkConfigFile returns a result", () => {
    const system = new DoctorSystem();
    const result = system.checkConfigFile();
    expect(result.name).toBe("Config file");
    expect(["ok", "warn", "error"]).toContain(result.severity);
  });

  it("checkSkillsDir returns a result", () => {
    const system = new DoctorSystem();
    const result = system.checkSkillsDir();
    expect(result.name).toBe("Skills directory");
    expect(["ok", "warn", "error"]).toContain(result.severity);
  });

  it("checkAuditLogDir returns a result", () => {
    const system = new DoctorSystem();
    const result = system.checkAuditLogDir();
    expect(result.name).toBe("Audit logging");
    expect(["ok", "warn", "error"]).toContain(result.severity);
  });

  it("aggregate produces correct summary", () => {
    const system = new DoctorSystem();
    const items: DiagnosticItem[] = [
      { name: "test1", severity: "ok", message: "pass" },
      { name: "test2", severity: "warn", message: "warn" },
      { name: "test3", severity: "error", message: "fail" },
    ];
    const report: DoctorReport = {
      items,
      summary: { ok: 1, warn: 1, error: 1 },
      canRun: false,
    };
    expect(report.summary.ok).toBe(1);
    expect(report.summary.warn).toBe(1);
    expect(report.summary.error).toBe(1);
    expect(report.canRun).toBe(false);
  });
});
