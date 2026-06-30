import { useState, useCallback } from "react";
import { useInterval } from "./useInterval.js";
import type { ThinkingState, ThinkingStep } from "../types.js";

// ─── Thinking-panel state machine ─────────────────────────────────────────────
// Parses <thinking>…</thinking> from streamed output, drives the live duration
// timer, and exposes collapse / visibility toggles for /show-thinking etc.

const THINK_OPEN = "<thinking>";
const THINK_CLOSE = "</thinking>";

export interface ThinkingApi {
  state: ThinkingState;
  start: () => void;
  stop: () => void;
  /** Feed the full accumulated stream buffer; extracts thinking + steps. */
  ingest: (buffer: string) => void;
  setStep: (id: string, status: ThinkingStep["status"]) => void;
  addStep: (label: string) => string;
  toggleCollapsed: () => void;
  setVisible: (visible: boolean) => void;
  reset: () => void;
}

function emptyState(visible: boolean): ThinkingState {
  return {
    active: false,
    collapsed: false,
    visible,
    startedAt: null,
    durationMs: null,
    steps: [],
    rawContent: "",
  };
}

/** Pull the text inside the first <thinking> block (open or closed). */
function extractThinking(buffer: string): string {
  const open = buffer.indexOf(THINK_OPEN);
  if (open === -1) return "";
  const start = open + THINK_OPEN.length;
  const close = buffer.indexOf(THINK_CLOSE, start);
  return (close === -1 ? buffer.slice(start) : buffer.slice(start, close)).trim();
}

/** Turn reasoning text into tree steps — one per non-empty line. */
function deriveSteps(raw: string): ThinkingStep[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .map((label, i) => ({
      id: `auto-${i}`,
      label,
      status: "done" as const,
    }));
}

export function useThinking(initialVisible = true): ThinkingApi {
  const [state, setState] = useState<ThinkingState>(() => emptyState(initialVisible));

  // Live duration ticker while active.
  useInterval(
    () => {
      setState((s) =>
        s.active && s.startedAt !== null
          ? { ...s, durationMs: Date.now() - s.startedAt }
          : s
      );
    },
    state.active ? 100 : null
  );

  const start = useCallback(() => {
    setState((s) => ({
      ...s,
      active: true,
      startedAt: Date.now(),
      durationMs: 0,
      steps: [],
      rawContent: "",
    }));
  }, []);

  const stop = useCallback(() => {
    setState((s) => ({
      ...s,
      active: false,
      durationMs: s.startedAt !== null ? Date.now() - s.startedAt : s.durationMs,
    }));
  }, []);

  const ingest = useCallback((buffer: string) => {
    const raw = extractThinking(buffer);
    if (!raw) return;
    setState((s) => ({ ...s, rawContent: raw, steps: deriveSteps(raw) }));
  }, []);

  const setStep = useCallback((id: string, status: ThinkingStep["status"]) => {
    setState((s) => ({
      ...s,
      steps: s.steps.map((step) => (step.id === id ? { ...step, status } : step)),
    }));
  }, []);

  const addStep = useCallback((label: string): string => {
    const id = `step-${Date.now()}-${Math.floor(performance.now())}`;
    setState((s) => ({
      ...s,
      steps: [...s.steps, { id, label, status: "active" }],
    }));
    return id;
  }, []);

  const toggleCollapsed = useCallback(() => {
    setState((s) => ({ ...s, collapsed: !s.collapsed }));
  }, []);

  const setVisible = useCallback((visible: boolean) => {
    setState((s) => ({ ...s, visible }));
  }, []);

  const reset = useCallback(() => {
    setState((s) => emptyState(s.visible));
  }, []);

  return {
    state,
    start,
    stop,
    ingest,
    setStep,
    addStep,
    toggleCollapsed,
    setVisible,
    reset,
  };
}
