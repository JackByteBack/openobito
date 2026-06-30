import type { Message } from "../types/index.js";
import type { ModelAdapter } from "../model/adapter.js";

// ─── Context Compression (Hermes-inspired) ────────────────────────────────────

export type CompressionStrategy = "sliding_window" | "summarize" | "hybrid";

export interface CompressorConfig {
  strategy: CompressionStrategy;
  maxTokens: number;
  triggerFraction: number;
  minMessages: number;
  summaryMaxTokens: number;
}

export const DEFAULT_COMPRESSOR_CONFIG: CompressorConfig = {
  strategy: "hybrid",
  maxTokens: 4096,
  triggerFraction: 0.75,
  minMessages: 10,
  summaryMaxTokens: 512,
};

export interface CompressionResult {
  messages: Message[];
  compressed: boolean;
  originalCount: number;
  resultCount: number;
  strategy: CompressionStrategy;
}

// ─── Token estimation ─────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function totalTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

// ─── Compressor ───────────────────────────────────────────────────────────────

export class ContextCompressor {
  constructor(
    private readonly config: CompressorConfig = DEFAULT_COMPRESSOR_CONFIG,
    private readonly model?: ModelAdapter
  ) {}

  shouldCompress(messages: Message[]): boolean {
    const tokens = totalTokens(messages);
    const threshold = this.config.maxTokens * this.config.triggerFraction;
    return tokens > threshold;
  }

  async compress(messages: Message[]): Promise<CompressionResult> {
    if (!this.shouldCompress(messages)) {
      return {
        messages,
        compressed: false,
        originalCount: messages.length,
        resultCount: messages.length,
        strategy: this.config.strategy,
      };
    }

    const originalCount = messages.length;

    switch (this.config.strategy) {
      case "sliding_window":
        return this.slidingWindow(messages, originalCount);
      case "summarize":
        return this.summarize(messages, originalCount);
      case "hybrid":
      default:
        return this.hybrid(messages, originalCount);
    }
  }

  private slidingWindow(messages: Message[], originalCount: number): CompressionResult {
    const min = this.config.minMessages;
    const budget = this.config.maxTokens * this.config.triggerFraction;

    // Always keep system messages and the last min messages
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    let kept = nonSystem.slice(-min);
    let tokens = totalTokens([...systemMessages, ...kept]);
    let i = nonSystem.length - min - 1;

    while (i >= 0 && tokens < budget) {
      const msg = nonSystem[i]!;
      const msgTokens = estimateTokens(msg.content);
      if (tokens + msgTokens > budget) break;
      kept = [msg, ...kept];
      tokens += msgTokens;
      i--;
    }

    const result = [...systemMessages, ...kept];
    return {
      messages: result,
      compressed: true,
      originalCount,
      resultCount: result.length,
      strategy: "sliding_window",
    };
  }

  private async summarize(messages: Message[], originalCount: number): Promise<CompressionResult> {
    if (!this.model) {
      return this.slidingWindow(messages, originalCount);
    }

    const min = this.config.minMessages;
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const toSummarize = nonSystem.slice(0, -min);
    const toKeep = nonSystem.slice(-min);

    if (toSummarize.length === 0) {
      return this.slidingWindow(messages, originalCount);
    }

    const summaryPrompt = [
      "Summarize the following conversation history concisely. Preserve key decisions, facts, and context needed to continue the conversation.",
      "",
      toSummarize.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n"),
    ].join("\n");

    const summaryResponse = await this.model.chat(
      [{ id: crypto.randomUUID(), role: "user", content: summaryPrompt, timestamp: Date.now() }],
      "You are a conversation summarizer. Be concise and factual."
    );

    const summaryMessage: Message = {
      id: crypto.randomUUID(),
      role: "system",
      content: `[Context summary — ${toSummarize.length} prior messages compressed]\n${summaryResponse.content}`,
      timestamp: Date.now(),
    };

    const result = [...systemMessages, summaryMessage, ...toKeep];
    return {
      messages: result,
      compressed: true,
      originalCount,
      resultCount: result.length,
      strategy: "summarize",
    };
  }

  private async hybrid(messages: Message[], originalCount: number): Promise<CompressionResult> {
    const summarized = await this.summarize(messages, originalCount);
    if (!this.shouldCompress(summarized.messages)) {
      return { ...summarized, strategy: "hybrid" };
    }
    const windowed = this.slidingWindow(summarized.messages, originalCount);
    return { ...windowed, strategy: "hybrid" };
  }
}
