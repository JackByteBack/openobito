import type { ParsedCronExpression, CronField } from "./types.js";

// ─── Cron expression parser ───────────────────────────────────────────────────

const FIELD_RANGES = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 6 },
} as const;

type FieldName = keyof typeof FIELD_RANGES;

function parseField(raw: string, range: { min: number; max: number }): CronField {
  if (raw === "*") return { value: "*" };

  if (raw.startsWith("*/")) {
    const step = parseInt(raw.slice(2), 10);
    if (isNaN(step) || step <= 0) throw new Error(`Invalid step in cron field: ${raw}`);
    return { value: "*", step };
  }

  if (raw.includes("-")) {
    const [startStr, endStr] = raw.split("-");
    const start = parseInt(startStr!, 10);
    const end = parseInt(endStr!, 10);
    if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range in cron field: ${raw}`);
    if (start < range.min || end > range.max || start > end) {
      throw new Error(`Range out of bounds in cron field: ${raw} (valid: ${range.min}-${range.max})`);
    }
    return { value: start, range: { min: start, max: end } };
  }

  const value = parseInt(raw, 10);
  if (isNaN(value)) throw new Error(`Invalid cron field value: ${raw}`);
  if (value < range.min || value > range.max) {
    throw new Error(`Cron field value ${value} out of range ${range.min}-${range.max}`);
  }
  return { value };
}

export function parseCronExpression(expr: string): ParsedCronExpression {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression "${expr}": expected 5 fields, got ${parts.length}`);
  }

  const [minuteRaw, hourRaw, domRaw, monthRaw, dowRaw] = parts as [string, string, string, string, string];

  return {
    minute: parseField(minuteRaw, FIELD_RANGES.minute),
    hour: parseField(hourRaw, FIELD_RANGES.hour),
    dayOfMonth: parseField(domRaw, FIELD_RANGES.dayOfMonth),
    month: parseField(monthRaw, FIELD_RANGES.month),
    dayOfWeek: parseField(dowRaw, FIELD_RANGES.dayOfWeek),
    raw: expr,
  };
}

function matchesField(field: CronField, value: number): boolean {
  if (field.value === "*") {
    if (field.step !== undefined) return value % field.step === 0;
    return true;
  }
  if (field.range !== undefined) return value >= field.range.min && value <= field.range.max;
  return field.value === value;
}

export function cronMatches(parsed: ParsedCronExpression, date: Date): boolean {
  return (
    matchesField(parsed.minute, date.getMinutes()) &&
    matchesField(parsed.hour, date.getHours()) &&
    matchesField(parsed.dayOfMonth, date.getDate()) &&
    matchesField(parsed.month, date.getMonth() + 1) &&
    matchesField(parsed.dayOfWeek, date.getDay())
  );
}

export function nextRunTime(parsed: ParsedCronExpression, after: Date = new Date()): Date {
  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 60 * 24 * 366; i++) {
    if (cronMatches(parsed, next)) return next;
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error(`Could not compute next run time for expression: ${parsed.raw}`);
}
