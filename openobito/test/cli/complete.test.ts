import { describe, it, expect } from "vitest";
import { CONFIG_KEYS, CONFIG_VALUES, PERSONALITIES, THEMES } from "../../src/cli/slash/complete.js";

describe("Autocomplete", () => {
  it("has config keys defined", () => {
    expect(CONFIG_KEYS.length).toBeGreaterThan(0);
    expect(CONFIG_KEYS).toContain("model.temperature");
    expect(CONFIG_KEYS).toContain("model.model");
  });

  it("has config values for known keys", () => {
    expect(CONFIG_VALUES["ui.theme"]).toBeDefined();
    expect(CONFIG_VALUES["ui.theme"]?.length).toBeGreaterThan(0);
    expect(CONFIG_VALUES["model.temperature"]).toBeDefined();
  });

  it("has personalities defined", () => {
    expect(PERSONALITIES.length).toBeGreaterThan(0);
    expect(PERSONALITIES).toContain("helpful");
    expect(PERSONALITIES).toContain("concise");
  });

  it("has themes defined", () => {
    expect(THEMES.length).toBeGreaterThan(0);
  });
});
