import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";
import type { CronJob } from "../../../cron/types.js";

let schedulerInstance: Awaited<ReturnType<typeof import("../../../cron/scheduler.js").CronScheduler.prototype.listJobs>> | null = null;

async function getScheduler() {
  const { CronScheduler } = await import("../../../cron/scheduler.js");
  const s = new CronScheduler(async (job) => ({ output: `Ran: ${job.name}`, toolsExecuted: 0 }), { tickIntervalMs: 60000 });
  s.start();
  return s;
}

export function CronMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["cron"],
          description: "Manage scheduled cron jobs",
          usage: "/cron [list|add|remove|pause|resume|run|history]",
          handler: async (args, _ctx) => {
            const sub = args[0];
            if (!sub) {
              const scheduler = await getScheduler();
              const jobs = scheduler.listJobs();
              if (!jobs.length) return output("No cron jobs scheduled. Use /cron add '<expr>' '<prompt>'");
              return output(
                "Cron jobs:\n" +
                  jobs.map((j) =>
                    `  ${j.status === "active" ? "▶" : j.status === "paused" ? "⏸" : "✓"} ${j.id.slice(0, 8).padEnd(10)} ${j.expression.padEnd(14)} ${j.name} (${j.runCount} runs)`
                  ).join("\n")
              );
            }
            return err("Usage: /cron [list|add|remove|pause|resume|run|history]");
          },
          complete: async () => ["list", "add", "remove", "pause", "resume", "run", "history"],
        },
        {
          path: ["cron", "list"],
          description: "List all scheduled cron jobs",
          usage: "/cron list",
          handler: async () => {
            const scheduler = await getScheduler();
            const jobs = scheduler.listJobs();
            if (!jobs.length) return output("No cron jobs.");
            return output(
              jobs.map((j) =>
                `  ${j.status === "active" ? "▶" : j.status === "paused" ? "⏸" : "✓"} ${j.id.slice(0, 8).padEnd(10)} ${j.expression.padEnd(14)} ${j.name.padEnd(20)} ${j.runCount} runs${j.nextRunAt ? ` next: ${new Date(j.nextRunAt).toLocaleString()}` : ""}`
              ).join("\n")
            );
          },
        },
        {
          path: ["cron", "add"],
          description: "Add a new cron job",
          usage: "/cron add <expression> <prompt> [--name <name>] [--max-runs N]",
          detail: "Cron expression: 5-field format (minute hour day month weekday).\nExample: '0 9 * * 1-5' for weekdays at 9am",
          handler: async (args, _ctx) => {
            const nameIdx = args.indexOf("--name");
            const maxRunsIdx = args.indexOf("--max-runs");
            const name = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
            const maxRuns = maxRunsIdx >= 0 ? parseInt(args[maxRunsIdx + 1] ?? "0", 10) : undefined;

            let marker = 1;
            if (nameIdx >= 0) marker = Math.min(marker, nameIdx);
            if (maxRunsIdx >= 0) marker = Math.min(marker, maxRunsIdx);
            const expr = args.slice(1, marker).join(" ");
            const prompt = args.slice(marker).filter((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--")).join(" ");

            if (!expr || !prompt) return err("Usage: /cron add '<expression>' '<prompt>' [--name <name>]");

            const scheduler = await getScheduler();
            try {
              const job = scheduler.addJob({
                id: crypto.randomUUID(),
                name: name ?? prompt.slice(0, 30),
                expression: expr,
                prompt,
                timeoutMs: 300000,
                tags: [],
              });
              return output(`Cron job added: ${job.id.slice(0, 8)} — ${job.name} (${job.expression})`);
            } catch (e) {
              return err(`Invalid cron expression: ${String(e)}`);
            }
          },
          complete: async () => ["--name", "--max-runs"],
        },
        {
          path: ["cron", "remove"],
          description: "Remove a cron job",
          usage: "/cron remove <id>",
          handler: async (args, _ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /cron remove <id>");
            const scheduler = await getScheduler();
            const removed = scheduler.removeJob(id);
            return removed ? output(`Removed cron job: ${id}`) : err(`Cron job not found: ${id}`);
          },
        },
        {
          path: ["cron", "pause"],
          description: "Pause a cron job",
          usage: "/cron pause <id>",
          handler: async (args, _ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /cron pause <id>");
            const scheduler = await getScheduler();
            scheduler.pauseJob(id);
            return output(`Paused cron job: ${id}`);
          },
        },
        {
          path: ["cron", "resume"],
          description: "Resume a paused cron job",
          usage: "/cron resume <id>",
          handler: async (args, _ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /cron resume <id>");
            const scheduler = await getScheduler();
            scheduler.resumeJob(id);
            return output(`Resumed cron job: ${id}`);
          },
        },
        {
          path: ["cron", "run"],
          description: "Manually trigger a cron job now",
          usage: "/cron run <id>",
          handler: async (args, _ctx) => {
            const id = args[0];
            if (!id) return err("Usage: /cron run <id>");
            const job = (await getScheduler()).getJob(id);
            return job ? output(`Executing "${job.name}" now… (async)`) : err(`Cron job not found: ${id}`);
          },
        },
        {
          path: ["cron", "history"],
          description: "Show run history for cron jobs",
          usage: "/cron history [<id>]",
          handler: async (args, _ctx) => {
            const id = args[0];
            const scheduler = await getScheduler();
            const runs = scheduler.listRuns(id);
            if (!runs.length) return output("No cron job runs yet.");
            return output(
              runs.slice(-20).reverse().map((r) => {
                const dur = r.finishedAt ? `${r.finishedAt - r.startedAt}ms` : "";
                return `  ${r.success ? "✓" : "✗"} ${r.jobId.slice(0, 8).padEnd(10)} ${new Date(r.startedAt).toLocaleString()} ${dur}`;
              }).join("\n")
            );
          },
        },
      ]);
    }
  };
}
