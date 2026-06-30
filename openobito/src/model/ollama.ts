import type { Message, ModelConfig, ModelResponse, ToolSchema } from "../types/index.js";
import type { ModelAdapter } from "./adapter.js";

// ─── Ollama HTTP adapter ──────────────────────────────────────────────────────

interface OllamaChatMessage {
  role: string;
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    num_ctx?: number;
  };
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
  done_reason?: string;
  eval_count?: number;
  prompt_eval_count?: number;
}

interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

export class OllamaAdapter implements ModelAdapter {
  readonly name = "ollama";
  readonly config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = (await res.json()) as OllamaTagsResponse;
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  async chat(messages: Message[], systemPrompt?: string): Promise<ModelResponse> {
    const body: OllamaChatRequest = {
      model: this.config.model,
      messages: this.toOllamaMessages(messages, systemPrompt),
      stream: false,
      options: this.buildOptions(),
    };

    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as OllamaChatResponse;
    return {
      content: data.message.content,
      finishReason: data.done_reason === "stop" ? "stop" : "stop",
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
      },
    };
  }

  async chatStream(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<ModelResponse> {
    const body: OllamaChatRequest = {
      model: this.config.model,
      messages: this.toOllamaMessages(messages, systemPrompt),
      stream: true,
      options: this.buildOptions(),
    };

    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama stream error ${res.status}: ${text}`);
    }

    if (!res.body) {
      throw new Error("Ollama: response body is null");
    }

    let fullContent = "";
    let usage = { promptTokens: 0, completionTokens: 0 };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as OllamaChatResponse;
          const delta = chunk.message?.content ?? "";
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
          if (chunk.done) {
            usage = {
              promptTokens: chunk.prompt_eval_count ?? 0,
              completionTokens: chunk.eval_count ?? 0,
            };
          }
        } catch {
          // partial JSON line, skip
        }
      }
    }

    return { content: fullContent, finishReason: "stop", usage };
  }

  private buildOptions(): NonNullable<OllamaChatRequest["options"]> {
    const opts: NonNullable<OllamaChatRequest["options"]> = {};
    if (this.config.temperature !== undefined) opts.temperature = this.config.temperature;
    if (this.config.maxTokens !== undefined) opts.num_predict = this.config.maxTokens;
    if (this.config.contextLength !== undefined) opts.num_ctx = this.config.contextLength;
    return opts;
  }

  private toOllamaMessages(
    messages: Message[],
    systemPrompt?: string
  ): OllamaChatMessage[] {
    const result: OllamaChatMessage[] = [];
    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }
    for (const m of messages) {
      if (m.role === "tool") continue; // Ollama doesn't support tool messages directly
      result.push({ role: m.role, content: m.content });
    }
    return result;
  }
}
