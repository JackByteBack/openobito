// ─── Cron types ───────────────────────────────────────────────────────────────

export type CronJobStatus = "active" | "paused" | "completed" | "failed";

export interface CronJob {
  id: string;
  name: string;
  expression: string;
  prompt: string;
  status: CronJobStatus;
  createdAt: number;
  lastRunAt?: number | undefined;
  nextRunAt?: number | undefined;
  runCount: number;
  failCount: number;
  maxRuns?: number | undefined;
  timeoutMs: number;
  tags: string[];
}

export interface CronJobRun {
  jobId: string;
  runId: string;
  startedAt: number;
  finishedAt?: number | undefined;
  success: boolean;
  output?: string | undefined;
  error?: string | undefined;
  toolsExecuted: number;
}

export interface CronField {
  value: number | "*";
  step?: number | undefined;
  range?: { min: number; max: number } | undefined;
}

export interface ParsedCronExpression {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
  raw: string;
}
