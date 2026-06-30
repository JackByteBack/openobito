import type { Command } from "commander";
import chalk from "chalk";
import { execSync } from "child_process";
import yaml from "js-yaml";
import { getConfigManager, getConfigFile, SCHEMA_KEYS } from "../../config/index.js";

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("View and edit configuration");

  configCmd
    .command("show")
    .description("Show current configuration")
    .action(() => showConfig());

  configCmd
    .command("edit")
    .description("Open config in editor")
    .action(() => editConfig());

  configCmd
    .command("set <key> <value>")
    .description("Set a config value (e.g., model.temperature 0.5)")
    .action((key: string, value: string) => setConfig(key, value));

  configCmd
    .command("get <key>")
    .description("Get a config value (e.g., model.primary)")
    .action((key: string) => getConfig(key));

  configCmd
    .command("reset")
    .description("Reset config to defaults")
    .action(() => resetConfig());

  configCmd
    .command("validate")
    .description("Validate configuration and show errors")
    .action(() => validateConfig());

  configCmd
    .command("schema")
    .description("Show all available config keys with types")
    .action(() => showSchema());

  configCmd
    .action(() => showConfig());

  program
    .command("settings")
    .description("Alias for config")
    .action(() => showConfig());
}

function showConfig(): void {
  const mgr = getConfigManager();
  const config = mgr.load();
  const filePath = getConfigFile();

  console.log(chalk.cyan(`\nConfig file: ${filePath}\n`));
  console.log(chalk.gray("---\n"));

  const dump = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: true,
  });
  console.log(dump);
}

function editConfig(): void {
  const filePath = getConfigFile();
  const editor = process.env["EDITOR"]
    || process.env["VISUAL"]
    || "nano";
  try {
    execSync(`${editor} "${filePath}"`, { stdio: "inherit" });
  } catch {
    console.error(chalk.red(`Failed to open editor. Try: nano "${filePath}"`));
  }
}

function setConfig(key: string, value: string): void {
  const mgr = getConfigManager();
  const parsed = coerceValue(value);

  const err = mgr.set(key, parsed);
  if (err) {
    console.error(chalk.red(`  ${err}`));
    const hint = SCHEMA_KEYS[key];
    if (hint) console.log(chalk.gray(`  Expected: ${hint}`));
    process.exit(1);
  }

  console.log(chalk.green(`  ${key} = ${JSON.stringify(parsed)}`));
}

function getConfig(key: string): void {
  const mgr = getConfigManager();
  const val = mgr.get(key);
  if (val === undefined) {
    console.log(chalk.yellow(`  ${key}: (not set)`));
    return;
  }
  console.log(JSON.stringify(val, null, 2));
}

function resetConfig(): void {
  console.log(chalk.yellow("\n  This will reset all configuration to defaults."));
  console.log(chalk.yellow("  Your data files will not be affected.\n"));

  const mgr = getConfigManager();
  mgr.reset();
  console.log(chalk.green("  Configuration reset to defaults.\n"));
}

function validateConfig(): void {
  const mgr = getConfigManager();
  const errors = mgr.validate();

  if (errors.length === 0) {
    console.log(chalk.green("\n  Configuration is valid.\n"));
    return;
  }

  console.log(chalk.yellow(`\n  ${errors.length} validation issue(s):\n`));
  for (const err of errors) {
    const path = chalk.cyan(err.path);
    console.log(`  ${path}: ${err.message}`);
    if (err.fix) {
      console.log(`    Fix: ${chalk.gray(err.fix)}`);
    }
  }
  console.log();
}

function showSchema(): void {
  console.log(chalk.cyan("\nAvailable config keys:\n"));
  const keys = Object.keys(SCHEMA_KEYS).sort();
  for (const key of keys) {
    const type = SCHEMA_KEYS[key]!;
    console.log(`  ${chalk.cyan(key.padEnd(30))} ${chalk.gray(type)}`);
  }
  console.log();
}

function coerceValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}
