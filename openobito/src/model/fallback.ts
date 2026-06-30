import type { Message, ModelConfig, ModelResponse } from "../types/index.js";
import type { ModelAdapter } from "./adapter.js";
import { OllamaAdapter } from "./ollama.js";

// ─── Fallback chain (Hermes-inspired) ────────────────────────────────────────
// Tries each adapter in order; falls through on error.

export class FallbackChain implements ModelAdapter {
  readonly name = "fallback-chain";
  private adapters: ModelAdapter[];
  private active: ModelAdapter | null = null;

  constructor(public readonly config: ModelConfig, extras: ModelAdapter[] = []) {
    this.adapters = [new OllamaAdapter(config), ...extras];
  }

  async isAvailable(): Promise<boolean> {
    for (const adapter of this.adapters) {
      if (await adapter.isAvailable()) {
        this.active = adapter;
        return true;
      }
    }
    return false;
  }

  async listModels(): Promise<string[]> {
    const a = await this.getActive();
    return a.listModels();
  }

  async chat(messages: Message[], systemPrompt?: string): Promise<ModelResponse> {
    const errors: Error[] = [];
    for (const adapter of this.adapters) {
      try {
        if (await adapter.isAvailable()) {
          this.active = adapter;
          return await adapter.chat(messages, systemPrompt);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    throw new AggregateError(errors, "All model adapters failed");
  }

  async chatStream(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<ModelResponse> {
    const errors: Error[] = [];
    for (const adapter of this.adapters) {
      try {
        if (await adapter.isAvailable()) {
          this.active = adapter;
          return await adapter.chatStream(messages, systemPrompt, onChunk);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    throw new AggregateError(errors, "All model adapters failed during stream");
  }

  getActiveName(): string | null {
    return this.active?.name ?? null;
  }

  private async getActive(): Promise<ModelAdapter> {
    if (this.active) return this.active;
    await this.isAvailable();
    if (!this.active) throw new Error("No model adapter available");
    return this.active;
  }
}
