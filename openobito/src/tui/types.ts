import type { Message } from "../types/index.js";

// ─── TUI-specific view models ─────────────────────────────────────────────────

/** A single reasoning step shown in the ThinkingPanel tree. */
export interface ThinkingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
}

/** State for the collapsible thinking panel. */
export interface ThinkingState {
  active: boolean;
  collapsed: boolean;
  visible: boolean; // toggled via /show-thinking · /hide-thinking
  startedAt: number | null;
  durationMs: number | null;
  steps: ThinkingStep[];
  rawContent: string; // captured <thinking>…</thinking> text
}

export type ToolStatus = "queued" | "running" | "success" | "error";

/** State for a single tool invocation row in the ToolExecutionPanel. */
export interface ToolExecutionState {
  id: string;
  name: string;
  status: ToolStatus;
  /** 0–100; undefined when indeterminate. */
  progress?: number;
  detail?: string;
}

/** Header bar metrics. */
export interface HeaderInfo {
  version: string;
  model: string;
  skills: number;
  memoryTokens: number; // approximate, rendered as e.g. "2.1k"
}

/** A keyboard hint rendered in the StatusBar. */
export interface KeyHint {
  keys: string;
  label: string;
}

/** Autocomplete candidate for the InputBox completions menu. */
export interface Completion {
  value: string;
  kind: "command" | "model" | "skill";
  description?: string;
}

/** Top-level props for the root <App>. */
export interface AppViewState {
  header: HeaderInfo;
  messages: Message[];
  streamBuffer: string;
  thinking: ThinkingState;
  tools: ToolExecutionState[];
  isBusy: boolean;
}
