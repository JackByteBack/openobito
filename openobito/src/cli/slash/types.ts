import type { OpenAgentConfig } from "../../types/index.js";
import type Database from "better-sqlite3";

// ─── Command context ─────────────────────────────────────────────────────────
// Everything a command handler might need — passed by reference so each
// command can read/mutate live session state.

export interface CommandContext {
  config: OpenAgentConfig;
  db: Database.Database;
  sessionId: string | null;
  /** Mutable session messages — commands may clear or trim these. */
  clearMessages: () => void;
  /** Signal the agent loop to abort the current run. */
  interrupt: () => void;
  /** Refresh the TUI (re-render). */
  refresh: () => void;
  /** Print text to the TUI message panel (role = "system"). */
  print: (text: string) => void;
  /** Config file path, for /config edit. */
  configPath: string;
}

// ─── CommandResult ────────────────────────────────────────────────────────────

export type CommandResultKind =
  | "ok" // silent success
  | "output" // text to display
  | "error" // user-facing error
  | "exit"; // request process exit

export interface CommandResult {
  kind: CommandResultKind;
  text?: string;
  /** Attach structured data for callers that can use it (e.g. /usage → chart). */
  data?: unknown;
}

export const OK: CommandResult = { kind: "ok" };

export function output(text: string, data?: unknown): CommandResult {
  return { kind: "output", text, data };
}

export function err(text: string): CommandResult {
  return { kind: "error", text };
}

// ─── Completion context ───────────────────────────────────────────────────────

export interface CompletionContext {
  config: OpenAgentConfig;
  db: Database.Database;
  /** The full input line (e.g. "/model dow"). */
  line: string;
  /** Already-split tokens (e.g. ["model", "dow"]). */
  tokens: string[];
}

// ─── Command descriptor ────────────────────────────────────────────────────────
// Registered into the CommandRegistry for every leaf command.

export interface SlashCommand {
  /** Full command path, no leading slash (e.g. ["model", "list"]). */
  path: string[];
  /** Short description for /help listing. */
  description: string;
  /** Full usage line (e.g. "/model list [--local|--remote]"). */
  usage: string;
  /** Longer help text shown by "/help <command>". */
  detail?: string;
  /** Short aliases for the full path (e.g. ["/m"] for /model). */
  aliases?: string[];
  /** Execute the command. */
  handler: (args: string[], ctx: CommandContext) => Promise<CommandResult>;
  /** Return candidate completions for the current token. */
  complete?: (ctx: CompletionContext) => Promise<string[]>;
}

// ─── Mixin constructor helper ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GConstructor<T = object> = new (...args: any[]) => T;
