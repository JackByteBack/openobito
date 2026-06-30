import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { colors } from "../colors.js";
import type { ThinkingState, ThinkingStep } from "../types.js";

interface ThinkingPanelProps {
  state: ThinkingState;
}

function stepGlyph(status: ThinkingStep["status"]): { glyph: string; color: string } {
  switch (status) {
    case "active":
      return { glyph: "◐", color: colors.primary };
    case "done":
      return { glyph: "✓", color: colors.success };
    default:
      return { glyph: "○", color: colors.thinking };
  }
}

function StepRow({ step, isLast }: { step: ThinkingStep; isLast: boolean }) {
  const branch = isLast ? "└─" : "├─";
  const { glyph, color } = stepGlyph(step.status);
  return (
    <Box>
      <Text color={colors.thinking}>{branch} </Text>
      <Text color={color}>{glyph} </Text>
      <Text color={step.status === "pending" ? colors.thinking : colors.textDim}>
        {step.label}
      </Text>
    </Box>
  );
}

/**
 * Collapsible reasoning panel.
 * Header: "💭 Thinking (1.2s)" with a spinner while active.
 * Body: tree of reasoning steps (├─ … └─), hidden when collapsed.
 */
export function ThinkingPanel({ state }: ThinkingPanelProps) {
  // Hidden entirely when the user toggled it off, or there's nothing to show.
  if (!state.visible) return null;
  if (!state.active && state.steps.length === 0 && !state.rawContent) return null;

  const seconds = state.durationMs !== null ? (state.durationMs / 1000).toFixed(1) : "0.0";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {state.active ? (
          <Text color={colors.primary}>
            <Spinner type="dots" />
          </Text>
        ) : (
          <Text color={colors.thinking}>💭</Text>
        )}
        <Text color={colors.thinking}> Thinking </Text>
        <Text color={colors.textDim}>({seconds}s)</Text>
        {state.collapsed && state.steps.length > 0 && (
          <Text color={colors.thinking} dimColor>
            {"  "}[{state.steps.length} steps · space to expand]
          </Text>
        )}
      </Box>

      {!state.collapsed &&
        state.steps.map((step, i) => (
          <StepRow key={step.id} step={step} isLast={i === state.steps.length - 1} />
        ))}
    </Box>
  );
}
