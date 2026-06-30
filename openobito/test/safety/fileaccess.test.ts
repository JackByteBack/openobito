import { describe, it, expect } from "vitest";
import { FileAccessControl } from "../../src/safety/fileaccess.js";
import { isAlwaysBlocked, isProtectedPath } from "../../src/safety/fileaccess.js";
import { homedir } from "os";
import { resolve } from "path";

const HOME = homedir();
const fac = new FileAccessControl(resolve(HOME, ".openagent"));

describe("FileAccessControl — checkRead()", () => {
  it("allows normal project file reads", () => {
    const r = fac.checkRead("./src/index.ts");
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBeFalsy();
  });

  it("allows SSH dir reads with approval flag", () => {
    const r = fac.checkRead(HOME + "/.ssh/config");
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(true);
  });

  it("blocks /sys reads", () => {
    const r = fac.checkRead("/sys/kernel/debug");
    expect(r.allowed).toBe(false);
  });

  it("blocks /proc reads", () => {
    const r = fac.checkRead("/proc/1/cmdline");
    expect(r.allowed).toBe(false);
  });
});

describe("FileAccessControl — checkWrite()", () => {
  it("allows normal project file writes", () => {
    const r = fac.checkWrite("./dist/bundle.js");
    expect(r.allowed).toBe(true);
  });

  it("blocks /etc writes", () => {
    const r = fac.checkWrite("/etc/hosts");
    expect(r.allowed).toBe(false);
  });

  it("blocks SSH private key writes", () => {
    const r = fac.checkWrite(HOME + "/.ssh/id_rsa");
    expect(r.allowed).toBe(false);
  });

  it("blocks .env writes (protected)", () => {
    const r = fac.checkWrite("./.env");
    expect(r.allowed).toBe(false);
  });

  it("flags dangerous extensions as require_approval", () => {
    const r = fac.checkWrite("./deploy.sh");
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(true);
  });

  it("flags .exe writes as require_approval", () => {
    const r = fac.checkWrite("./program.exe");
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(true);
  });
});

describe("FileAccessControl — checkDelete()", () => {
  it("requires approval for all deletions", () => {
    const r = fac.checkDelete("./tmp/file.txt");
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(true);
  });

  it("blocks deletion of protected paths", () => {
    const r = fac.checkDelete(HOME + "/.ssh/id_rsa");
    expect(r.allowed).toBe(false);
  });

  it("blocks deletion of /etc files", () => {
    const r = fac.checkDelete("/etc/hosts");
    expect(r.allowed).toBe(false);
  });
});

describe("isAlwaysBlocked()", () => {
  it("blocks system directories", () => {
    expect(isAlwaysBlocked("/etc/hosts")).toBe(true);
    expect(isAlwaysBlocked("/sys/kernel")).toBe(true);
    expect(isAlwaysBlocked("/proc/1")).toBe(true);
    expect(isAlwaysBlocked("/root/.bashrc")).toBe(true);
    expect(isAlwaysBlocked("/boot/grub")).toBe(true);
  });

  it("allows user project paths", () => {
    expect(isAlwaysBlocked(HOME + "/projects/foo")).toBe(false);
    expect(isAlwaysBlocked(process.cwd() + "/src")).toBe(false);
  });
});

describe("isProtectedPath()", () => {
  it("detects .env files", () => {
    expect(isProtectedPath(resolve(".", ".env"))).toBe(true);
    expect(isProtectedPath(resolve(".", ".env.local"))).toBe(true);
    expect(isProtectedPath(resolve(".", ".env.production"))).toBe(true);
  });

  it("detects SSH/AWS/kube dirs", () => {
    expect(isProtectedPath(HOME + "/.ssh/id_rsa")).toBe(true);
    expect(isProtectedPath(HOME + "/.aws/credentials")).toBe(true);
    expect(isProtectedPath(HOME + "/.kube/config")).toBe(true);
  });

  it("allows normal project files", () => {
    expect(isProtectedPath(resolve(".", "src/index.ts"))).toBe(false);
    expect(isProtectedPath(resolve(".", "README.md"))).toBe(false);
  });
});
