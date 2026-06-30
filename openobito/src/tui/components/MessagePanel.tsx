import React from "react";
import { Box, Text } from "ink";
import { colors, roleColors } from "../colors.js";
import type { Message } from "../../types/index.js";

interface MessagePanelProps {
  messages: Message[];
  streamBuffer: string;
}

/** Strip <thinking>…</thinking> blocks — those render in the ThinkingPanel. */
function stripThinking(content: string): string {
  return content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
}

function roleLabel(msg: Message): { text: string; color: string } | null {
  switch (msg.role) {
    case "user":
      return { text: "You", color: roleColors.user };
    case "assistant":
      return { text: "Assistant", color: colors.text };
    case "tool":
      return { text: `Tool:${msg.toolName ?? "?"}`, color: roleColors.tool };
    case "system":
      return null; // system messages are not rendered inline
  }
}

function MessageItem({ msg }: { msg: Message }) {
  const label = roleLabel(msg);
  if (!label) return null;

  const body = msg.role === "assistant" ? stripThinking(msg.content) : msg.content;
  if (!body) return null;

  const isError = body.startsWith("Error:") || msg.content.startsWith("Tool error:");
  const bodyColor = isError
    ? roleColors.error
    : msg.role === "tool"
      ? colors.accent
      : msg.role === "user"
        ? colors.text
        : colors.text;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={label.color} bold>
        {label.text}
      </Text>
      <Box paddingLeft={2}>
        <Text color={bodyColor} wrap="wrap">
          {body}
        </Text>
      </Box>
    </Box>
  );
}

/** Scrollable conversation transcript with color-coded roles + live stream. */
export function MessagePanel({ messages, streamBuffer }: MessagePanelProps) {
  const visible = messages.filter((m) => m.role !== "system");
  const liveBody = stripThinking(streamBuffer);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((msg) => (
        <MessageItem key={msg.id} msg={msg} />
      ))}

      {liveBody && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={colors.text} bold>
            Assistant
          </Text>
          <Box paddingLeft={2}>
            <Text color={colors.text} wrap="wrap">
              {liveBody}
              <Text color={colors.primary}>▋</Text>
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
