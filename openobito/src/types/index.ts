// ─── Shared domain types ───────────────────────────────────────────────────

export type Role = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolName?: string;
}

// ─── Model types ───────────────────────────────────────────────────────────

export interface ModelConfig {
  provider: "ollama" | "openai-compat";
  model: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
  contextLength?: number;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: { promptTokens: number; completionTokens: number };
  finishReason: "stop" | "tool_call" | "length" | "error";
}

// ─── Tool types ─────────────────────────────────────────────────────────────

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  enum?: string[];
  items?: ToolParameter;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

// ─── Session types ──────────────────────────────────────────────────────────

export type SessionStatus = "idle" | "thinking" | "executing" | "waiting" | "error";

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  model: string;
  messages: Message[];
  status: SessionStatus;
}

// ─── Permission types (OpenHuman-inspired) ──────────────────────────────────

export type TaskRiskLevel = "low" | "medium" | "high" | "critical";
export type ToolPolicyAction = "allow" | "require_approval" | "deny" | "hide_from_prompt";

export interface ToolPolicy {
  toolName: string;
  action: ToolPolicyAction;
  riskLevel: TaskRiskLevel;
  reason?: string;
}

// ─── Config types ───────────────────────────────────────────────────────────

export interface OpenAgentConfig {
  model: ModelConfig;
  permissions: {
    defaultAction: ToolPolicyAction;
    policies: ToolPolicy[];
  };
  storage: {
    path: string;
    maxSessions: number;
  };
  ui: {
    theme: "dark" | "light" | "auto";
    showTimestamps: boolean;
    streamOutput: boolean;
  };
  plugins: string[];
}
