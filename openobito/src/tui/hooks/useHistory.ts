import { useState, useCallback, useRef } from "react";
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

// ─── Command history (Hermes FileHistory equivalent) ─────────────────────────
// Persists submitted lines to a file and lets the input box walk ↑/↓ through
// them. Also supports Ctrl+R reverse-search over the loaded entries.

export interface HistoryApi {
  /** Record a new entry (skips blanks and consecutive duplicates). */
  push: (entry: string) => void;
  /** Move back one entry (↑). Returns the entry or null at the boundary. */
  prev: (current: string) => string | null;
  /** Move forward one entry (↓). Returns the entry or "" past the newest. */
  next: () => string | null;
  /** Reset the navigation cursor (call after a submit). */
  reset: () => void;
  /** Reverse search: newest match containing `query`, or null. */
  search: (query: string) => string | null;
  entries: string[];
}

function loadHistory(filePath: string): string[] {
  try {
    if (!existsSync(filePath)) return [];
    return readFileSync(filePath, "utf8")
      .split("\n")
      .map((l) => l.trimEnd())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function useHistory(filePath: string): HistoryApi {
  const [entries, setEntries] = useState<string[]>(() => loadHistory(filePath));
  // cursor === entries.length means "editing a fresh line" (past the newest entry)
  const cursor = useRef(entries.length);

  const push = useCallback(
    (entry: string) => {
      const trimmed = entry.trim();
      if (!trimmed) return;
      setEntries((prev) => {
        if (prev[prev.length - 1] === trimmed) {
          cursor.current = prev.length;
          return prev;
        }
        const updated = [...prev, trimmed];
        cursor.current = updated.length;
        try {
          mkdirSync(dirname(filePath), { recursive: true });
          appendFileSync(filePath, trimmed + "\n", "utf8");
        } catch {
          /* history persistence is best-effort */
        }
        return updated;
      });
    },
    [filePath]
  );

  const prev = useCallback(
    (_current: string): string | null => {
      if (entries.length === 0) return null;
      cursor.current = Math.max(0, cursor.current - 1);
      return entries[cursor.current] ?? null;
    },
    [entries]
  );

  const next = useCallback((): string | null => {
    if (entries.length === 0) return null;
    cursor.current = Math.min(entries.length, cursor.current + 1);
    if (cursor.current >= entries.length) return "";
    return entries[cursor.current] ?? null;
  }, [entries]);

  const reset = useCallback(() => {
    cursor.current = entries.length;
  }, [entries.length]);

  const search = useCallback(
    (query: string): string | null => {
      if (!query) return null;
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e && e.includes(query)) return e;
      }
      return null;
    },
    [entries]
  );

  return { push, prev, next, reset, search, entries };
}
