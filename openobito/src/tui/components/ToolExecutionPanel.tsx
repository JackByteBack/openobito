import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { colors } from "../colors.js";
import type { ToolExecutionState, ToolStatus } from "../types.js";

interface ToolExecutionPanelProps {
  tools: ToolExecutionState[];
}

const BAR_WIDTH = 8;

/** Render a [▓▓░░] style progress bar for a 0–100 value. */
function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return (
    <Text>
      <Text color={colors.border}>[</Text>
      <Text color={colors.primary}>{"▓".repeat(filled)}</Text>
      <Text color={colors.border}>{"░".repeat(empty)}</Text>
      <Text color={colors.border}>] </Text>
      <Text color={colors.textDim}>{clamped}%</Text>
    </Text>
  );
}

function StatusIcon({ status }: { status: ToolStatus }) {
  switch (status) {
    case "success":
      return <Text color={colors.success}>✓</Text>;
    case "error":
      return <Text color={colors.error}>✗</Text>;
    case "running":
      return (
        <Text color={colors.primary}>
          <Spinner type="dots" />
        </Text>
      );
    default:
      return <Text color={colors.thinking}>○</Text>;
  }
}

function ToolRow({ tool }: { tool: ToolExecutionState }) {
  return (
    <Box>
      <StatusIcon status={tool.status} />
      <Text color={colors.accent}> {tool.name} </Text>
      {tool.status === "running" && tool.progress !== undefined && (
        <ProgressBar progress={tool.progress} />
      )}
      {tool.detail && (
        <Text color={colors.textDim} dimColor>
          {"  "}
          {tool.detail}
        </Text>
      )}
    </Box>
  );
}

/** "⚙️ Tools: file_read ✓  analyze_code [▓▓░░] 40%" inline status panel. */
export function ToolExecutionPanel({ tools }: ToolExecutionPanelProps) {
  if (tools.length === 0) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={colors.accent}>⚙️ Tools</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={1}>
        {tools.map((tool) => (
          <ToolRow key={tool.id} tool={tool} />
        ))}
      </Box>
    </Box>
  );
}
