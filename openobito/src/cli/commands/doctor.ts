import type { Command } from "commander";
import chalk from "chalk";
import { DoctorSystem, renderReport, repair } from "../../health/index.js";

export function registerDoctorCommand(program: Command): void {
  const doctor = program
    .command("doctor")
    .description("Run diagnostics and health checks")
    .option("--json", "Output results as JSON");

  doctor
    .command("diagnose")
    .description("Run full diagnostic battery")
    .option("--json", "Output results as JSON")
    .action(async (opts) => {
      await runDoctorDiagnose({ json: opts.json === true });
    });

  doctor
    .command("repair")
    .description("Show auto-fix hints for detected issues")
    .action(async () => {
      await runDoctorRepair();
    });

  doctor
    .action(async (opts) => {
      await runDoctorDiagnose({ json: opts.json === true });
    });

  program
    .command("health")
    .description("Alias for doctor — run health checks")
    .option("--json", "Output results as JSON")
    .action(async (opts) => {
      await runDoctorDiagnose({ json: opts.json === true });
    });
}

async function runDoctorDiagnose(opts: { json?: boolean } = {}): Promise<void> {
  const system = new DoctorSystem();
  const report = await system.run();

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log();
  console.log(renderReport(report));
  console.log();

  const s = report.summary;
  if (s.error > 0) {
    console.log(chalk.red(`  ${s.error} error(s) found — fix before running commands.`));
    console.log(chalk.gray("  Run: openagent doctor repair\n"));
  } else if (s.warn > 0) {
    console.log(chalk.yellow(`  ${s.warn} warning(s) — non-blocking.`));
    console.log(chalk.gray("  Run: openagent doctor repair\n"));
  } else {
    console.log(chalk.green("  All checks passed!\n"));
  }
}

async function runDoctorRepair(): Promise<void> {
  const system = new DoctorSystem();
  const report = await system.run();

  const issues = report.items.filter(
    (i) => i.severity === "error" || i.severity === "warn",
  );

  if (issues.length === 0) {
    console.log(chalk.green("\n  No issues to repair.\n"));
    return;
  }

  console.log(chalk.cyan.bold("\nRepair suggestions:\n"));
  await repair(issues);
  console.log();
}
