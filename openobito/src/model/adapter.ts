import type { Message, ModelConfig, ModelResponse } from "../types/index.js";

// ─── Model adapter interface ──────────────────────────────────────────────────

export interface ModelAdapter {
  readonly name: string;
  readonly config: ModelConfig;
  chat(messages: Message[], systemPrompt?: string): Promise<ModelResponse>;
  chatStream(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<ModelResponse>;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<string[]>;
}
