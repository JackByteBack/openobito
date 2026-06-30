import chalk from "chalk";
import { loadConfig, getConfigFile } from "../config/index.js";
import { OllamaAdapter } from "../model/ollama.js";
import { existsSync } from "fs";
import { execSync } from "child_process";

// ─── Doctor diagnostics module (OpenHuman-inspired) ─────────────────────────

interface DiagResult {
  name: string;
  status: "ok" | "warn" | "fail";
  message: string;
  detail?: string;
}

async function checkNodeVersion(): Promise<DiagResult> {
  const [major] = process.version.slice(1).split(".").map(Number);
  if ((major ?? 0) >= 18) {
    return { name: "Node.js version", status: "ok", message: process.version };
  }
  return {
    name: "Node.js version",
    status: "fail",
    message: `${process.version} — requires >=18`,
    detail: "Install Node.js 18+ from https://nodejs.org",
  };
}

async function checkOllama(baseUrl: string): Promise<DiagResult> {
  try {
    const adapter = new OllamaAdapter({
      provider: "ollama",
      model: "llama3.2",
      baseUrl,
    });
    const available = await adapter.isAvailable();
    if (available) {
      const models = await adapter.listModels();
      return {
        name: "Ollama",
        status: "ok",
        message: `Running at ${baseUrl} (${models.length} model${models.length !== 1 ? "s" : ""})`,
        detail: models.slice(0, 5).join(", "),
      };
    }
    return {
      name: "Ollama",
      status: "fail",
      message: `Not reachable at ${baseUrl}`,
      detail: "Run: ollama serve",
    };
  } catch (err) {
    return {
      name: "Ollama",
      status: "fail",
      message: `Error: ${String(err)}`,
    };
  }
}

async function checkModel(baseUrl: string, modelName: string): Promise<DiagResult> {
  try {
    const adapter = new OllamaAdapter({ provider: "ollama", model: modelName, baseUrl });
    const models = await adapter.listModels();
    const found = models.some((m) => m === modelName || m.startsWith(modelName + ":"));
    if (found) {
      return { name: `Model: ${modelName}`, status: "ok", message: "Installed" };
    }
    return {
      name: `Model: ${modelName}`,
      status: "warn",
      message: "Not installed",
      detail: `Run: ollama pull ${modelName}`,
    };
  } catch {
    return { name: `Model: ${modelName}`, status: "warn", message: "Could not check" };
  }
}

async function checkConfigFile(): Promise<DiagResult> {
  const path = getConfigFile();
  if (existsSync(path)) {
    return { name: "Config file", status: "ok", message: path };
  }
  return {
    name: "Config file",
    status: "warn",
    message: "Not yet created",
    detail: "Will be created on first run",
  };
}

async function checkSqlite(): Promise<DiagResult> {
  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(":memory:");
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");
    db.close();
    return { name: "better-sqlite3", status: "ok", message: "Working" };
  } catch (err) {
    return {
      name: "better-sqlite3",
      status: "fail",
      message: `Native module error: ${String(err)}`,
      detail: "Run: npm rebuild better-sqlite3",
    };
  }
}

function formatResult(r: DiagResult): string {
  const icon = r.status === "ok" ? chalk.green("✓") : r.status === "warn" ? chalk.yellow("⚠") : chalk.red("✗");
  const label = chalk.bold(r.name.padEnd(22));
  const msg = r.status === "ok" ? chalk.gray(r.message) : r.status === "warn" ? chalk.yellow(r.message) : chalk.red(r.message);
  let line = `  ${icon}  ${label} ${msg}`;
  if (r.detail) {
    line += `\n       ${chalk.gray(r.detail)}`;
  }
  return line;
}

export async function runDiagnostics(opts: { json?: boolean } = {}): Promise<void> {
  const config = loadConfig();

  if (!opts.json) {
    console.log(chalk.cyan.bold("\nOpenAgent · Doctor\n"));
    console.log(chalk.gray("Checking your environment...\n"));
  }

  const checks = await Promise.all([
    checkNodeVersion(),
    checkSqlite(),
    checkConfigFile(),
    checkOllama(config.model.baseUrl),
    checkModel(config.model.baseUrl, config.model.model),
  ]);

  if (opts.json) {
    console.log(JSON.stringify(checks, null, 2));
    return;
  }

  for (const r of checks) {
    console.log(formatResult(r));
  }

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  console.log();
  if (failCount === 0 && warnCount === 0) {
    console.log(chalk.green.bold("  Everything looks good! 🎉"));
  } else {
    if (failCount > 0) console.log(chalk.red(`  ${failCount} check(s) failed.`));
    if (warnCount > 0) console.log(chalk.yellow(`  ${warnCount} warning(s).`));
    console.log(chalk.gray("\n  Run `openagent doctor` again after fixing issues."));
  }
  console.log();
}
