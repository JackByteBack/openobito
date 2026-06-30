import { useMemo, useState, useCallback } from "react";
import type { Completion } from "../types.js";

// ─── Tab autocomplete (Hermes CompletionsMenu equivalent) ─────────────────────
// Completes slash-commands, model names (@model), and skill names (/skill arg).

export interface AutocompleteSource {
  commands: string[]; // e.g. ["/help", "/clear", "/skills", "/show-thinking"]
  models: string[]; // e.g. ["mistral", "llama3.2"]
  skills: string[]; // e.g. ["file_read", "analyze_code"]
}

export interface AutocompleteApi {
  candidates: Completion[];
  selectedIndex: number;
  isOpen: boolean;
  /** Recompute candidates for the current input + cursor. */
  update: (input: string) => void;
  /** Move selection (Tab / arrow). */
  cycle: (dir: 1 | -1) => void;
  /** Accept current selection; returns the new full input string. */
  accept: (input: string) => string;
  close: () => void;
}

/** Extract the token currently being typed (last whitespace-delimited word). */
function currentToken(input: string): string {
  const parts = input.split(/\s/);
  return parts[parts.length - 1] ?? "";
}

function buildCandidates(token: string, src: AutocompleteSource): Completion[] {
  if (token.startsWith("/")) {
    return src.commands
      .filter((c) => c.startsWith(token))
      .map((value) => ({ value, kind: "command" as const }));
  }
  if (token.startsWith("@")) {
    const q = token.slice(1).toLowerCase();
    return src.models
      .filter((m) => m.toLowerCase().startsWith(q))
      .map((value) => ({ value: "@" + value, kind: "model" as const }));
  }
  if (token.length >= 1) {
    const q = token.toLowerCase();
    return src.skills
      .filter((s) => s.toLowerCase().startsWith(q))
      .map((value) => ({ value, kind: "skill" as const, description: "skill" }));
  }
  return [];
}

export function useAutocomplete(src: AutocompleteSource): AutocompleteApi {
  const [token, setToken] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const candidates = useMemo(
    () => (isOpen ? buildCandidates(token, src) : []),
    [isOpen, token, src]
  );

  const update = useCallback((input: string) => {
    const tok = currentToken(input);
    setToken(tok);
    setSelectedIndex(0);
    setIsOpen(tok.length > 0 && (tok.startsWith("/") || tok.startsWith("@") || tok.length >= 2));
  }, []);

  const cycle = useCallback(
    (dir: 1 | -1) => {
      setSelectedIndex((i) => {
        const n = candidates.length;
        if (n === 0) return 0;
        return (i + dir + n) % n;
      });
    },
    [candidates.length]
  );

  const accept = useCallback(
    (input: string): string => {
      const chosen = candidates[selectedIndex];
      if (!chosen) return input;
      const idx = input.lastIndexOf(token);
      const next = idx >= 0 ? input.slice(0, idx) + chosen.value : chosen.value;
      setIsOpen(false);
      return next;
    },
    [candidates, selectedIndex, token]
  );

  const close = useCallback(() => setIsOpen(false), []);

  return { candidates, selectedIndex, isOpen, update, cycle, accept, close };
}
