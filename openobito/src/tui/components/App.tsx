import React, { useCallback } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import { HeaderBar } from "./HeaderBar.js";
import { ThinkingPanel } from "./ThinkingPanel.js";
import { MessagePanel } from "./MessagePanel.js";
import { ToolExecutionPanel } from "./ToolExecutionPanel.js";
import { InputBox } from "./InputBox.js";
import { StatusBar } from "./StatusBar.js";
import { useHistory } from "../hooks/useHistory.js";
import { useAutocomplete } from "../hooks/useAutocomplete.js";
import type { AutocompleteSource } from "../hooks/useAutocomplete.js";
import type { ThinkingApi } from "../hooks/useThinking.js";
import { colors } from "../colors.js";
import type { AppViewState } from "../types.js";

interface AppProps {
  state: AppViewState;
  thinking: ThinkingApi;
  historyFile: string;
  completionSource: AutocompleteSource;
  onSubmit: (input: string) => void;
  /** Called on Ctrl+C while the agent is busy — interrupt the current run. */
  onInterrupt: () => void;
  /** Called on Ctrl+L — clear the transcript. */
  onClear: () => void;
}

/**
 * Root TUI layout (4 regions, Hermes HSplit equivalent):
 *   HeaderBar  →  [Thinking · Messages · Tools]  →  InputBox  →  StatusBar
 *
 * Global keybindings live here; per-field editing lives in <InputBox>.
 */
export function App({
  state,
  thinking,
  historyFile,
  completionSource,
  onSubmit,
  onInterrupt,
  onClear,
}: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const history = useHistory(historyFile);
  const autocomplete = useAutocomplete(completionSource);

  useInput((input, key) => {
    // Ctrl+C: interrupt if busy, otherwise quit.
    if (key.ctrl && input === "c") {
      if (state.isBusy) onInterrupt();
      else exit();
      return;
    }
    // Ctrl+D: quit when idle.
    if (key.ctrl && input === "d" && !state.isBusy) {
      exit();
      return;
    }
    // Ctrl+L: clear screen + transcript.
    if (key.ctrl && input === "l") {
      stdout?.write("\x1b[2J\x1b[H");
      onClear();
      return;
    }
    // Space toggles the thinking panel collapse (only when input is idle/empty).
    if (input === " " && state.thinking.active && !state.isBusy) {
      thinking.toggleCollapsed();
      return;
    }
  });

  const handleSubmit = useCallback(
    (value: string) => {
      onSubmit(value);
    },
    [onSubmit]
  );

  return (
    <Box flexDirection="column" width="100%">
      <HeaderBar info={state.header} />

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        <ThinkingPanel state={state.thinking} />
        <MessagePanel messages={state.messages} streamBuffer={state.streamBuffer} />
        <ToolExecutionPanel tools={state.tools} />
      </Box>

      <InputBox
        history={history}
        autocomplete={autocomplete}
        busy={state.isBusy}
        onSubmit={handleSubmit}
      />

      <StatusBar message={state.isBusy ? "agent is working — Ctrl+C to stop" : undefined} />
    </Box>
  );
}
