import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "../colors.js";
import { CompletionsMenu } from "./CompletionsMenu.js";
import type { HistoryApi } from "../hooks/useHistory.js";
import type { AutocompleteApi } from "../hooks/useAutocomplete.js";

interface InputBoxProps {
  history: HistoryApi;
  autocomplete: AutocompleteApi;
  /** Disabled while the agent is busy (input is read-only). */
  busy: boolean;
  onSubmit: (value: string) => void;
}

/**
 * Multiline input with command history, tab-autocomplete, and Ctrl+R search.
 * Mirrors Hermes' prompt_toolkit input area + CompletionsMenu + FileHistory.
 *
 * Terminal note: most terminals cannot distinguish Shift+Enter from Enter.
 * Convention used here:
 *   - Enter            → submit (when completions closed)
 *   - Tab              → accept completion / cycle
 *   - a trailing "\"   → newline continuation (multiline entry)
 *   - Ctrl+R           → reverse history search
 */
export function InputBox({ history, autocomplete, busy, onSubmit }: InputBoxProps) {
  const [value, setValue] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const commit = useCallback(
    (text: string) => {
      const trimmed = text.replace(/\\\s*$/, "").trim();
      if (!trimmed) return;
      history.push(trimmed);
      history.reset();
      setValue("");
      autocomplete.close();
      onSubmit(trimmed);
    },
    [history, autocomplete, onSubmit]
  );

  useInput(
    (input, key) => {
      if (busy) return;

      // ── Reverse history search (Ctrl+R) ──────────────────────────────
      if (searchMode) {
        if (key.escape) {
          setSearchMode(false);
          setSearchQuery("");
          return;
        }
        if (key.return) {
          const match = history.search(searchQuery);
          setSearchMode(false);
          setSearchQuery("");
          if (match) setValue(match);
          return;
        }
        if (key.backspace || key.delete) {
          setSearchQuery((q) => q.slice(0, -1));
          return;
        }
        if (input) setSearchQuery((q) => q + input);
        return;
      }

      if (key.ctrl && input === "r") {
        setSearchMode(true);
        setSearchQuery("");
        return;
      }

      // ── Autocomplete navigation ──────────────────────────────────────
      if (key.tab) {
        if (autocomplete.isOpen) {
          if (autocomplete.candidates.length === 1) {
            const next = autocomplete.accept(value);
            setValue(next);
            autocomplete.update(next);
          } else {
            autocomplete.cycle(key.shift ? -1 : 1);
          }
        } else {
          autocomplete.update(value);
        }
        return;
      }

      if (autocomplete.isOpen && key.return) {
        const next = autocomplete.accept(value);
        setValue(next);
        return;
      }

      // ── History navigation (↑ / ↓) ───────────────────────────────────
      if (key.upArrow) {
        const prev = history.prev(value);
        if (prev !== null) setValue(prev);
        return;
      }
      if (key.downArrow) {
        const next = history.next();
        if (next !== null) setValue(next);
        return;
      }

      // ── Editing ───────────────────────────────────────────────────────
      if (key.return) {
        // Trailing backslash → newline continuation (multiline).
        if (value.endsWith("\\")) {
          setValue((v) => v.slice(0, -1) + "\n");
          return;
        }
        commit(value);
        return;
      }

      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
        autocomplete.update(value.slice(0, -1));
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        const next = value + input;
        setValue(next);
        autocomplete.update(next);
      }
    },
    { isActive: true }
  );

  const lines = value.split("\n");

  return (
    <Box flexDirection="column">
      {autocomplete.isOpen && (
        <CompletionsMenu
          candidates={autocomplete.candidates}
          selectedIndex={autocomplete.selectedIndex}
        />
      )}

      <Box
        borderStyle="round"
        borderColor={busy ? colors.border : colors.primary}
        paddingX={1}
        flexDirection="column"
      >
        {searchMode ? (
          <Box>
            <Text color={colors.accent}>(reverse-i-search)`</Text>
            <Text color={colors.text}>{searchQuery}</Text>
            <Text color={colors.accent}>': </Text>
            <Text color={colors.textDim}>{history.search(searchQuery) ?? ""}</Text>
          </Box>
        ) : (
          lines.map((line, i) => (
            <Box key={i}>
              <Text color={colors.primary}>{i === 0 ? "> " : "  "}</Text>
              <Text color={busy ? colors.thinking : colors.text}>
                {busy && i === 0 && !value ? "(agent is working…)" : line}
                {!busy && i === lines.length - 1 && <Text color={colors.primary}>▋</Text>}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
