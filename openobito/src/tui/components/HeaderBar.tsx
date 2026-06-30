import React from "react";
import { Box, Text } from "ink";
import { colors } from "../colors.js";
import type { HeaderInfo } from "../types.js";

interface HeaderBarProps {
  info: HeaderInfo;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Divider() {
  return <Text color={colors.border}> │ </Text>;
}

/** Top header bar: openagent vX │ model │ Skills: N │ Memory: Nk */
export function HeaderBar({ info }: HeaderBarProps) {
  return (
    <Box
      paddingX={1}
      borderStyle="single"
      borderColor={colors.border}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text color={colors.primary} bold>
        openagent
      </Text>
      <Text color={colors.textDim}> v{info.version}</Text>
      <Divider />
      <Text color={colors.accent}>{info.model}</Text>
      <Divider />
      <Text color={colors.text}>Skills: </Text>
      <Text color={colors.success}>{info.skills}</Text>
      <Divider />
      <Text color={colors.text}>Memory: </Text>
      <Text color={colors.success}>{formatTokens(info.memoryTokens)}</Text>
    </Box>
  );
}
