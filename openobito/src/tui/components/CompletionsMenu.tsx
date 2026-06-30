import React from "react";
import { Box, Text } from "ink";
import { colors } from "../colors.js";
import type { Completion } from "../types.js";

interface CompletionsMenuProps {
  candidates: Completion[];
  selectedIndex: number;
  maxVisible?: number;
}

const kindColor: Record<Completion["kind"], string> = {
  command: colors.primary,
  model: colors.accent,
  skill: colors.success,
};

/** Dropdown of autocomplete candidates (Hermes CompletionsMenu equivalent). */
export function CompletionsMenu({ candidates, selectedIndex, maxVisible = 6 }: CompletionsMenuProps) {
  if (candidates.length === 0) return null;

  // Window around the selection so long lists stay bounded.
  const start = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxVisible / 2), candidates.length - maxVisible)
  );
  const window = candidates.slice(start, start + maxVisible);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.border}
      paddingX={1}
    >
      {window.map((c, i) => {
        const realIndex = start + i;
        const selected = realIndex === selectedIndex;
        return (
          <Box key={c.value}>
            <Text color={selected ? colors.primary : colors.textDim}>
              {selected ? "❯ " : "  "}
            </Text>
            <Text color={kindColor[c.kind]} bold={selected}>
              {c.value}
            </Text>
            {c.description && (
              <Text color={colors.thinking} dimColor>
                {"  "}
                {c.description}
              </Text>
            )}
          </Box>
        );
      })}
      {candidates.length > maxVisible && (
        <Text color={colors.thinking} dimColor>
          {`  … ${candidates.length - maxVisible} more`}
        </Text>
      )}
    </Box>
  );
}
