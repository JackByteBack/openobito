import type { CronJob, CronJobRun } from "./types.js";
import { parseCronExpression, nextRunTime } from "./parser.js";
import { globalBus } from "../agent/events.js";

// ─── Cron Scheduler ───────────────────────────────────────────────────────────

export type CronJobRunner = (job: CronJob) => Promise<{ output: string; toolsExecuted: number }>;

export interface SchedulerOptions {
  tickIntervalMs?: number;
  maxConcurrent?: number;
  timeoutMs?: number;
}

export class CronScheduler {
  private readonly jobs = new Map<string, CronJob>();
  private readonly runs: CronJobRun[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeJobs = new Set<string>();
  private readonly tickIntervalMs: number;
  private readonly maxConcurrent: number;
  private readonly defaultTimeoutMs: number;

  constructor(
    private readonly runner: CronJobRunner,
    opts: SchedulerOptions = {}
  ) {
    this.tickIntervalMs = opts.tickIntervalMs ?? 60_000;
    this.maxConcurrent = opts.maxConcurrent ?? 3;
    this.defaultTimeoutMs = opts.timeoutMs ?? 300_000;
  }

  addJob(job: Omit<CronJob, "runCount" | "failCount" | "status" | "createdAt">): CronJob {
    parseCronExpression(job.expression); // validate

    const full: CronJob = {
      ...job,
      runCount: 0,
      failCount: 0,
      status: "active",
      createdAt: Date.now(),
      nextRunAt: nextRunTime(parseCronExpression(job.expression)).getTime(),
    };

    this.jobs.set(full.id, full);
    globalBus.emit("cron.job_added", "scheduler", { jobId: full.id, name: full.name });
    return full;
  }

  removeJob(jobId: string): boolean {
    const removed = this.jobs.delete(jobId);
    if (removed) globalBus.emit("cron.job_removed", "scheduler", { jobId });
    return removed;
  }

  pauseJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) job.status = "paused";
  }

  resumeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === "paused") {
      job.status = "active";
      job.nextRunAt = nextRunTime(parseCronExpression(job.expression)).getTime();
    }
  }

  getJob(jobId: string): CronJob | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  listRuns(jobId?: string): CronJobRun[] {
    if (jobId) return this.runs.filter((r) => r.jobId === jobId);
    return [...this.runs];
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.tickIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now();

    const due = Array.from(this.jobs.values()).filter(
      (job) =>
        job.status === "active" &&
        !this.activeJobs.has(job.id) &&
        job.nextRunAt !== undefined &&
        job.nextRunAt <= now
    );

    const available = this.maxConcurrent - this.activeJobs.size;
    const toRun = due.slice(0, available);

    for (const job of toRun) {
      void this.runJob(job);
    }
  }

  private async runJob(job: CronJob): Promise<void> {
    if (this.activeJobs.has(job.id)) return;
    this.activeJobs.add(job.id);

    const run: CronJobRun = {
      jobId: job.id,
      runId: crypto.randomUUID(),
      startedAt: Date.now(),
      success: false,
      toolsExecuted: 0,
    };

    job.lastRunAt = run.startedAt;
    job.runCount++;

    globalBus.emit("cron.job_start", "scheduler", { jobId: job.id, runId: run.runId });

    const timeoutMs = job.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Cron job "${job.name}" timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      const result = await Promise.race([this.runner(job), timeoutPromise]);
      run.finishedAt = Date.now();
      run.success = true;
      run.output = result.output;
      run.toolsExecuted = result.toolsExecuted;

      globalBus.emit("cron.job_done", "scheduler", {
        jobId: job.id,
        runId: run.runId,
        durationMs: run.finishedAt - run.startedAt,
      });
    } catch (err) {
      run.finishedAt = Date.now();
      run.success = false;
      run.error = err instanceof Error ? err.message : String(err);
      job.failCount++;

      globalBus.emit("cron.job_error", "scheduler", {
        jobId: job.id,
        runId: run.runId,
        error: run.error,
      });
    } finally {
      this.activeJobs.delete(job.id);
      this.runs.push(run);

      if (this.runs.length > 1000) this.runs.shift();

      if (job.maxRuns !== undefined && job.runCount >= job.maxRuns) {
        job.status = "completed";
      } else if (job.status === "active") {
        job.nextRunAt = nextRunTime(parseCronExpression(job.expression)).getTime();
      }
    }
  }
}
