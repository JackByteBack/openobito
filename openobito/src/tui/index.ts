// ─── Components ───────────────────────────────────────────────────────────────
export { App } from "./components/App.js";
export { HeaderBar } from "./components/HeaderBar.js";
export { ThinkingPanel } from "./components/ThinkingPanel.js";
export { MessagePanel } from "./components/MessagePanel.js";
export { ToolExecutionPanel } from "./components/ToolExecutionPanel.js";
export { InputBox } from "./components/InputBox.js";
export { CompletionsMenu } from "./components/CompletionsMenu.js";
export { StatusBar, DEFAULT_HINTS } from "./components/StatusBar.js";

// ─── Theme ──────────────────────────────────────────────────────────────────
export { colors, roleColors, riskColors, riskColor } from "./colors.js";
export type { ColorName } from "./colors.js";

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useInterval, useHistory, useAutocomplete, useThinking } from "./hooks/index.js";
export type { HistoryApi, AutocompleteApi, AutocompleteSource, ThinkingApi } from "./hooks/index.js";

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  ThinkingStep,
  ThinkingState,
  ToolStatus,
  ToolExecutionState,
  HeaderInfo,
  KeyHint,
  Completion,
  AppViewState,
} from "./types.js";
