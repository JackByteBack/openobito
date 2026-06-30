import { describe, it, expect, vi } from "vitest";
import { OllamaAdapter } from "../../src/model/ollama.js";

describe("OllamaAdapter", () => {
  const config = {
    provider: "ollama" as const,
    model: "llama3.2",
    baseUrl: "http://localhost:11434",
    temperature: 0.7,
    maxTokens: 2048,
    contextLength: 8192,
  };

  it("reports unavailable when fetch fails", async () => {
    const adapter = new OllamaAdapter(config);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("fetch failed"));
    expect(await adapter.isAvailable()).toBe(false);
  });

  it("reports available when fetch succeeds", async () => {
    const adapter = new OllamaAdapter(config);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [{ name: "llama3.2" }] }), { status: 200 }),
    );
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("returns model list from /api/tags", async () => {
    const adapter = new OllamaAdapter(config);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [{ name: "llama3.2" }, { name: "mistral:latest" }] }), { status: 200 }),
    );
    const models = await adapter.listModels();
    expect(models).toEqual(["llama3.2", "mistral:latest"]);
  });

  it("returns empty list on fetch error", async () => {
    const adapter = new OllamaAdapter(config);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));
    const models = await adapter.listModels();
    expect(models).toEqual([]);
  });

  it("throws on chat error", async () => {
    const adapter = new OllamaAdapter(config);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("not found", { status: 404 }),
    );
    await expect(adapter.chat([{ id: "1", role: "user", content: "hi", timestamp: 0 }]))
      .rejects.toThrow("Ollama error 404");
  });
});
