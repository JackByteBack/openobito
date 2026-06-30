import { describe, it, expect, vi } from "vitest";
import { FallbackChain } from "../../src/model/fallback.js";
import { OllamaAdapter } from "../../src/model/ollama.js";

describe("FallbackChain", () => {
  const config = {
    provider: "ollama" as const,
    model: "llama3.2",
    baseUrl: "http://localhost:11434",
  };

  it("uses primary adapter when available", async () => {
    vi.spyOn(OllamaAdapter.prototype, "isAvailable").mockResolvedValue(true);
    const chain = new FallbackChain(config);
    expect(await chain.isAvailable()).toBe(true);
    expect(chain.getActiveName()).toBe("ollama");
  });

  it("falls through when primary is unavailable", async () => {
    const primaryMock = vi.spyOn(OllamaAdapter.prototype, "isAvailable");
    primaryMock.mockResolvedValueOnce(false);
    primaryMock.mockResolvedValueOnce(true);

    const fallback = new OllamaAdapter({ ...config, model: "mistral" });
    vi.spyOn(fallback, "isAvailable").mockResolvedValue(true);

    const chain = new FallbackChain(config, [fallback]);
    expect(await chain.isAvailable()).toBe(true);
  });

  it("returns false when all adapters fail", async () => {
    vi.spyOn(OllamaAdapter.prototype, "isAvailable").mockResolvedValue(false);
    const fallback = new OllamaAdapter({ ...config, model: "mistral" });
    vi.spyOn(fallback, "isAvailable").mockResolvedValue(false);

    const chain = new FallbackChain(config, [fallback]);
    expect(await chain.isAvailable()).toBe(false);
  });

  it("returns null name when not available", () => {
    const chain = new FallbackChain(config);
    expect(chain.getActiveName()).toBeNull();
  });
});
