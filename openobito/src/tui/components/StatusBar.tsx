import React from "react";
import { Box, Text } from "ink";
import { colors } from "../colors.js";
import type { KeyHint } from "../types.js";

interface StatusBarProps {
  hints?: KeyHint[];
  /** Optional transient status message shown on the left. */
  message?: string | undefined;
}

export const DEFAULT_HINTS: KeyHint[] = [
  { keys: "Tab", label: "autocomplete" },
  { keys: "↑↓", label: "history" },
  { keys: "Ctrl+R", label: "search" },
  { keys: "Ctrl+C", label: "stop" },
  { keys: "Ctrl+L", label: "clear" },
];

function Hint({ hint }: { hint: KeyHint }) {
  return (
    <Text>
      <Text color={colors.accent}>{hint.keys}</Text>
      <Text color={colors.textDim}>: {hint.label}</Text>
    </Text>
  );
}

/** Bottom status bar with keyboard-shortcut hints (Hermes-style). */
export function StatusBar({ hints = DEFAULT_HINTS, message }: StatusBarProps) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>{message && <Text color={colors.thinking}>{message}</Text>}</Box>
      <Box>
        {hints.map((hint, i) => (
          <Box key={hint.keys}>
            <Hint hint={hint} />
            {i < hints.length - 1 && <Text color={colors.border}>{"  "}</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
