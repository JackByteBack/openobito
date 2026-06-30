import { execFile } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, parse as parsePath } from "node:path";
import { promisify } from "node:util";
import { loadConfig, getConfigDir, getConfigFile } from "../config/index.js";
import { sandboxExecAsync } from "../safety/sandbox.js";
import type { OpenAgentConfig } from "../types/index.js";

export type Severity = "ok" | "warn" | "error";

export interface DiagnosticItem {
  name: string;
  severity: Severity;
  message: string;
  fix?: string;
}

export interface DoctorReport {
  items: DiagnosticItem[];
  summary: { ok: number; warn: number; error: number };
  canRun: boolean;
}

type CommandOutput = { stdout: string; stderr: string };

const execFileAsync = promisify(execFile);
const OLLAMA_TIMEOUT_MS = 3_000;
const STALE_SQLITE_SIDECAR_SECONDS = 30;
const DISK_WARN_MB = 512;
const DISK_ERROR_MB = 100;

function ok(name: string, message: string): DiagnosticItem {
  return { name, severity: "ok", message };
}

function warn(name: string, message: string, fix?: string): DiagnosticItem {
  return fix === undefined ? { name, severity: "warn", message } : { name, severity: "warn", message, fix };
}

function error(name: string, message: string, fix?: string): DiagnosticItem {
  return fix === undefined ? { name, severity: "error", message } : { name, severity: "error", message, fix };
}

function formatUnknownError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function modelBase(model: string): string {
  return model.split(":")[0] ?? model;
}

function modelMatches(installed: string, configured: string): boolean {
  if (installed === configured) return true;
  if (installed.includes(":") && configured.includes(":")) return false;
  return modelBase(installed) === modelBase(configured);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function displayBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function primaryModel(config: OpenAgentConfig): string {
  const modelConfig = config.model as OpenAgentConfig["model"] & { primary?: string };
  return (modelConfig.primary?.trim() || modelConfig.model).trim();
}

function configDirWithoutCreating(): string {
  const home = homedir();
  switch (process.platform) {
    case "win32":
      return join(process.env["LOCALAPPDATA"] || home, "openagent");
    case "darwin":
      return join(home, "Library", "Application Support", "openagent");
    case "linux":
      return join(process.env["XDG_CONFIG_HOME"] || join(home, ".config"), "openagent");
    default:
      return join(home, ".openagent");
  }
}

function configFileWithoutCreating(): string {
  return join(configDirWithoutCreating(), "config.yaml");
}

async function runCommand(command: string, args: string[], timeout = 5_000): Promise<CommandOutput> {
  const result = await execFileAsync(command, args, {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    maxBuffer: 512 * 1024,
  });

  return {
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
  };
}

export class DoctorSystem {
  private readonly configFileExistedAtStart: boolean;
  private readonly configFilePathAtStart: string;
  private configCache: OpenAgentConfig | undefined;

  constructor() {
    this.configFilePathAtStart = configFileWithoutCreating();
    this.configFileExistedAtStart = existsSync(this.configFilePathAtStart);
  }

  async run(): Promise<DoctorReport> {
    const checks = await Promise.all([
      this.checkNodeVersion(),
      this.checkOllamaRunning(),
      this.checkModelInstalled(),
      this.checkDiskSpace(),
      this.checkMemoryDB(),
      this.checkDBRowCount(),
      this.checkConfigFile(),
      this.checkSkillsDir(),
      this.checkAuditLogDir(),
      this.checkGitInstalled(),
      this.checkEnvironment(),
      this.checkSandbox(),
    ]);

    return this.aggregate(checks);
  }

  checkNodeVersion(): DiagnosticItem {
    const major = parseInt(process.versions.node, 10);
    return {
      name: "Node.js version",
      severity: major >= 18 ? "ok" : "error",
      message: `Node.js v${process.versions.node} (>=18 required)`,
      ...(major < 18 ? { fix: "Install Node.js 18+ from nodejs.org" } : {}),
    };
  }

  async checkOllamaRunning(): Promise<DiagnosticItem> {
    const baseUrl = normalizeBaseUrl(this.config.model.baseUrl);
    const tagsUrl = `${baseUrl}/api/tags`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
      const res = await fetch(tagsUrl, { signal: controller.signal });
      if (!res.ok) {
        return error("Ollama", `Returned HTTP ${res.status} at ${displayBaseUrl(baseUrl)}`, "Run: ollama serve");
      }
      return ok("Ollama", `Running at ${displayBaseUrl(baseUrl)}`);
    } catch {
      return error("Ollama", "Not running", "Run: ollama serve");
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkModelInstalled(): Promise<DiagnosticItem> {
    const model = primaryModel(this.config);
    if (model.length === 0) {
      return error("Model", "No primary model configured", "Set model.model in config.yaml");
    }

    const baseUrl = normalizeBaseUrl(this.config.model.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      if (!res.ok) {
        return warn("Model", `Could not verify ${model}; Ollama returned HTTP ${res.status}`);
      }

      const body = (await res.json()) as { models?: Array<{ name?: string }> };
      const models = body.models ?? [];
      const installed = models.some((entry) => typeof entry.name === "string" && modelMatches(entry.name, model));

      if (installed) {
        return ok("Model", `${model} installed`);
      }

      return error("Model", `${model} not installed`, `Run: ollama pull ${model}`);
    } catch {
      return warn("Model", `Could not verify ${model}; Ollama unreachable`, "Start Ollama, then run doctor again");
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkDiskSpace(): Promise<DiagnosticItem> {
    try {
      const freeMB = process.platform === "win32"
        ? await this.availableDiskSpaceMbWindows(getConfigDir())
        : await this.availableDiskSpaceMbUnix(getConfigDir());

      if (freeMB === undefined) return warn("Disk", "Could not determine free space");
      return this.diskResult(freeMB);
    } catch {
      return warn("Disk", "Could not check disk space");
    }
  }

  async checkMemoryDB(): Promise<DiagnosticItem> {
    const dbPath = this.databasePath();
    const staleSidecars = this.staleSqliteSidecars(dbPath);

    if (!existsSync(dbPath)) {
      return warn("SQLite", `${basename(dbPath)} not found yet`, "Start a chat to create the session database");
    }

    try {
      const count = await this.queryMessageCount(dbPath);
      if (staleSidecars.length > 0) {
        return warn(
          "SQLite",
          `${basename(dbPath)} readable (${count} messages); stale ${staleSidecars.join(", ")} present`,
          "Close OpenAgent, then remove stale SQLite -shm/-wal files if they remain",
        );
      }
      return ok("SQLite", `${basename(dbPath)} found; messages table readable`);
    } catch (err) {
      return error(
        "SQLite",
        `DB probe failed at ${dbPath}: ${formatUnknownError(err)}`,
        "Run: npm rebuild better-sqlite3; if the DB is corrupt, move sessions.db aside",
      );
    }
  }

  async checkDBRowCount(): Promise<DiagnosticItem> {
    const dbPath = this.databasePath();
    if (!existsSync(dbPath)) {
      return warn("Messages", "No database to query");
    }

    try {
      const count = await this.queryMessageCount(dbPath);
      return ok("Messages", `${count} stored`);
    } catch (err) {
      return error(
        "Messages",
        `Could not query messages: ${formatUnknownError(err)}`,
        "Run: npm rebuild better-sqlite3; if needed, move sessions.db aside to rebuild",
      );
    }
  }

  checkConfigFile(): DiagnosticItem {
    const filePath = this.configFilePathAtStart;
    if (this.configFileExistedAtStart || existsSync(filePath)) {
      return this.configFileExistedAtStart
        ? ok("Config file", filePath)
        : warn("Config file", `Created default config at ${filePath}`, "Review config.yaml if you need custom settings");
    }
    return warn("Config file", "Not yet created", "Run OpenAgent once or create ~/.openagent/config.yaml");
  }

  checkSkillsDir(): DiagnosticItem {
    const skillsDir = join(getConfigDir(), "skills");
    if (!existsSync(skillsDir)) {
      return warn("Skills directory", "Not initialized", "Run: openagent doctor repair");
    }

    const expected = ["builtin", "installed", "custom", "user-generated"];
    const missing = expected.filter((name) => !existsSync(join(skillsDir, name)));
    if (missing.length > 0) {
      return warn(
        "Skills directory",
        `Missing subdirectories: ${missing.join(", ")}`,
        "Run: openagent doctor repair",
      );
    }

    return ok("Skills directory", "Ready");
  }

  checkAuditLogDir(): DiagnosticItem {
    const auditDir = join(getConfigDir(), "audit_logs");
    if (existsSync(auditDir)) {
      return ok("Audit logging", "Active");
    }
    return warn("Audit logging", "Audit log directory not created", "Run: openagent doctor repair");
  }

  async checkGitInstalled(): Promise<DiagnosticItem> {
    try {
      const { stdout } = await runCommand("git", ["--version"]);
      const version = stdout.trim().split(/\r?\n/)[0] ?? "git found";
      return ok("Git", version);
    } catch (err) {
      return warn("Git", `Not available (${formatUnknownError(err)})`, "Install git from https://git-scm.com");
    }
  }

  checkEnvironment(): DiagnosticItem {
    const home = process.env["HOME"] || process.env["USERPROFILE"];
    const shell = process.env["SHELL"] || process.env["ComSpec"];
    const user = process.env["USER"] || process.env["USERNAME"];

    const missingRequired: string[] = [];
    const missingOptional: string[] = [];
    const present: string[] = [];

    if (home) present.push("HOME");
    else missingRequired.push(process.platform === "win32" ? "USERPROFILE" : "HOME");

    if (shell) present.push("SHELL");
    else missingOptional.push(process.platform === "win32" ? "ComSpec" : "SHELL");

    if (user) present.push("USER");
    else missingOptional.push(process.platform === "win32" ? "USERNAME" : "USER");

    if (missingRequired.length > 0) {
      return error("Environment", `Missing: ${missingRequired.join(", ")}`, "Ensure your home directory environment variable is set");
    }

    if (missingOptional.length > 0) {
      return warn("Environment", `Missing: ${missingOptional.join(", ")}; ${present.join(", ")} set`);
    }

    return ok("Environment", `${present.join(", ")} set`);
  }

  async checkSandbox(): Promise<DiagnosticItem> {
    const probe = "openagent_sandbox_test";
    try {
      const result = await sandboxExecAsync(`echo "${probe}"`, {
        cwd: process.cwd(),
        timeout: 3_000,
        maxBuffer: 4_096,
      });

      if (result.exitCode === 0 && result.stdout.trim() === probe) {
        return ok("Sandbox", "Operational");
      }

      return error(
        "Sandbox",
        `Unexpected result (exit ${result.exitCode}): ${(result.stderr || result.stdout).trim() || "no output"}`,
        "Check sandbox shell execution",
      );
    } catch (err) {
      return error("Sandbox", `Shell execution failed: ${formatUnknownError(err)}`, "Check your shell environment");
    }
  }

  async repair(items: DiagnosticItem[], print: (line: string) => void = console.log): Promise<void> {
    const issues = items.filter((item) => item.severity === "error" || item.severity === "warn");

    for (const item of issues) {
      if (item.name === "Ollama" && item.fix?.includes("ollama serve")) {
        print("  💡 Start Ollama with: ollama serve");
        continue;
      }

      if (item.name.includes("Model")) {
        const model = primaryModel(this.config);
        print(`  💡 Install model with: ollama pull ${model}`);
        continue;
      }

      if (item.name === "Config file") {
        loadConfig();
        print(`  💡 Config file ready at: ${getConfigFile()}`);
        continue;
      }

      if (item.name === "Skills directory") {
        const skillsDir = join(getConfigDir(), "skills");
        for (const dir of ["builtin", "installed", "custom", "user-generated"]) {
          mkdirSync(join(skillsDir, dir), { recursive: true });
        }
        print(`  💡 Created skills directories under: ${skillsDir}`);
        continue;
      }

      if (item.name === "Audit logging") {
        const auditDir = join(getConfigDir(), "audit_logs");
        mkdirSync(auditDir, { recursive: true });
        print(`  💡 Created audit log directory: ${auditDir}`);
        continue;
      }

      if (item.name === "Git") {
        print("  💡 Install git from: https://git-scm.com");
        continue;
      }

      if (item.fix) {
        print(`  💡 ${item.name}: ${item.fix}`);
      }
    }
  }

  private get config(): OpenAgentConfig {
    this.configCache ??= loadConfig();
    return this.configCache;
  }

  private databasePath(): string {
    return this.config.storage.path || join(getConfigDir(), "sessions.db");
  }

  private diskResult(freeMB: number): DiagnosticItem {
    const freeGB = (freeMB / 1024).toFixed(1);
    if (freeMB < DISK_ERROR_MB) {
      return error("Disk", `Critically low: ${freeGB}GB free`, "Free up disk space");
    }
    if (freeMB < DISK_WARN_MB) {
      return warn("Disk", `Low: ${freeGB}GB free`, "Free up disk space");
    }
    return ok("Disk", `${freeGB}GB free`);
  }

  private async availableDiskSpaceMbUnix(dir: string): Promise<number | undefined> {
    const { stdout } = await runCommand("df", ["-m", dir]);
    const lastLine = stdout
      .trim()
      .split(/\r?\n/)
      .reverse()
      .find((line) => line.trim().length > 0);
    if (!lastLine) return undefined;

    const parts = lastLine.trim().split(/\s+/);
    const available = parts[3];
    if (available === undefined) return undefined;

    const value = Number.parseInt(available, 10);
    return Number.isFinite(value) ? value : undefined;
  }

  private async availableDiskSpaceMbWindows(dir: string): Promise<number | undefined> {
    const root = parsePath(dir).root;
    const drive = root.match(/^[A-Za-z]:/)?.[0]?.slice(0, 1);
    if (!drive) return undefined;

    const { stdout } = await runCommand("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `(Get-PSDrive -Name ${drive} -ErrorAction Stop).Free`,
    ]);
    const bytes = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(bytes) ? Math.floor(bytes / (1024 * 1024)) : undefined;
  }

  private staleSqliteSidecars(dbPath: string): string[] {
    const dbName = basename(dbPath);
    const dbDir = dirname(dbPath);
    const stale: string[] = [];

    for (const sidecar of [`${dbName}-shm`, `${dbName}-wal`]) {
      const sidecarPath = join(dbDir, sidecar);
      if (!existsSync(sidecarPath)) continue;

      const ageSeconds = (Date.now() - statSync(sidecarPath).mtimeMs) / 1000;
      if (ageSeconds > STALE_SQLITE_SIDECAR_SECONDS) {
        stale.push(`${sidecar} (${Math.round(ageSeconds)}s old)`);
      }
    }

    return stale;
  }

  private async queryMessageCount(dbPath: string): Promise<number> {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const row = db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count?: number | bigint } | undefined;
      const count = row?.count ?? 0;
      return typeof count === "bigint" ? Number(count) : count;
    } finally {
      db.close();
    }
  }

  private aggregate(items: DiagnosticItem[]): DoctorReport {
    const summary = { ok: 0, warn: 0, error: 0 };

    for (const item of items) {
      summary[item.severity]++;
    }

    return {
      items,
      summary,
      canRun: summary.error === 0,
    };
  }
}

const ICON_OK = "✅";
const ICON_WARN = "⚠️";
const ICON_ERROR = "❌";
const ICON_HOSPITAL = "🏥";
const BOX_WIDTH = 56;

function severityIcon(item: DiagnosticItem): string {
  if (item.severity === "ok") return ICON_OK;
  if (item.severity === "warn") return ICON_WARN;
  return ICON_ERROR;
}

function wrapLine(content: string): string[] {
  if (content.length <= BOX_WIDTH) return [content];

  const lines: string[] = [];
  let rest = content;
  while (rest.length > BOX_WIDTH) {
    const slice = rest.slice(0, BOX_WIDTH + 1);
    const breakAt = slice.lastIndexOf(" ");
    const end = breakAt > 12 ? breakAt : BOX_WIDTH;
    lines.push(rest.slice(0, end));
    rest = rest.slice(end).trimStart();
  }
  if (rest.length > 0) lines.push(rest);
  return lines;
}

function pushBoxLine(lines: string[], content = ""): void {
  for (const part of wrapLine(content)) {
    lines.push(`│ ${part.padEnd(BOX_WIDTH)} │`);
  }
}

export function renderReport(report: DoctorReport): string {
  const lines: string[] = [];
  const rendered = new Set<DiagnosticItem>();

  lines.push(`┌${"─".repeat(BOX_WIDTH + 2)}┐`);
  pushBoxLine(lines, `${ICON_HOSPITAL} OpenAgent Health Report`);
  lines.push(`├${"─".repeat(BOX_WIDTH + 2)}┤`);

  const byName = new Map(report.items.map((item) => [item.name, item]));

  function group(title: string, itemNames: string[]): void {
    const items = itemNames
      .map((name) => byName.get(name))
      .filter((item): item is DiagnosticItem => item !== undefined);
    if (items.length === 0) return;

    pushBoxLine(lines, title);
    for (const item of items) {
      rendered.add(item);
      pushBoxLine(lines, ` ${severityIcon(item)} ${item.name}: ${item.message}`);
      if (item.fix) pushBoxLine(lines, `    Fix: ${item.fix}`);
    }
    pushBoxLine(lines);
  }

  group("System", ["Node.js version", "Disk", "Environment", "Git"]);
  group("Ollama", ["Ollama", "Model"]);
  group("Database", ["SQLite", "Messages"]);
  group("Security", ["Config file", "Skills directory", "Audit logging", "Sandbox"]);

  const remaining = report.items.filter((item) => !rendered.has(item));
  if (remaining.length > 0) {
    group("Other", remaining.map((item) => item.name));
  }

  lines.push(`├${"─".repeat(BOX_WIDTH + 2)}┤`);

  const s = report.summary;
  pushBoxLine(lines, `Summary: ${ICON_OK} ${s.ok} OK  ${ICON_WARN} ${s.warn} Warning  ${ICON_ERROR} ${s.error} Error`);

  if (report.canRun) {
    const suggestions = s.warn;
    pushBoxLine(
      lines,
      suggestions > 0
        ? `Status: Ready to use (${suggestions} suggestion${suggestions === 1 ? "" : "s"})`
        : "Status: Ready to use",
    );
  } else {
    pushBoxLine(lines, "Status: Blocked - fix errors first");
  }

  lines.push(`└${"─".repeat(BOX_WIDTH + 2)}┘`);
  return lines.join("\n");
}

export async function repair(items: DiagnosticItem[]): Promise<void> {
  await new DoctorSystem().repair(items);
}
