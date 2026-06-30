// ─── Shared completion resolver helpers ───────────────────────────────────────
// Each mixin imports only what it needs from here; no circular deps because
// this file only imports types, never the registry or BaseCLI.

import type { OpenAgentConfig } from "../../types/index.js";
import type Database from "better-sqlite3";

/** Fetch the list of locally installed Ollama models. */
export async function completeOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return [];
    const data = (await res.json()) as { models: Array<{ name: string }> };
    return data.models.map((m) => m.name);
  } catch {
    return [];
  }
}

/** All known config keys (dot-path). */
export const CONFIG_KEYS = [
  "model.model",
  "model.baseUrl",
  "model.temperature",
  "model.maxTokens",
  "model.contextLength",
  "permissions.defaultAction",
  "ui.theme",
  "ui.showTimestamps",
  "ui.streamOutput",
  "storage.maxSessions",
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

/** All valid config values for a given key. */
export const CONFIG_VALUES: Partial<Record<string, string[]>> = {
  "ui.theme": ["dark", "light", "auto"],
  "permissions.defaultAction": ["allow", "require_approval", "deny"],
  "ui.showTimestamps": ["true", "false"],
  "ui.streamOutput": ["true", "false"],
  "model.temperature": ["0.0", "0.2", "0.5", "0.7", "1.0"],
};

/** Known personalities. */
export const PERSONALITIES = [
  "helpful",
  "concise",
  "detailed",
  "sherlock",
  "creative",
  "technical",
  "friendly",
] as const;

/** Known themes. */
export const THEMES = ["dark", "light", "hermes", "gruvbox", "nord", "catppuccin"] as const;

/** Known context strategies. */
export const CONTEXT_STRATEGIES = ["sliding", "summarize", "semantic"] as const;

/** Known integration services. */
export const INTEGRATIONS = ["telegram", "discord", "slack", "github", "jira", "notion"] as const;

/** Recent session IDs from the database (top 20). */
export function sessionIds(db: Database.Database): string[] {
  try {
    const rows = db
      .prepare("SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 20")
      .all() as Array<{ id: string }>;
    return rows.map((r) => r.id.slice(0, 8));
  } catch {
    return [];
  }
}

/** All registered tool names from the registry (lazy import to avoid circular). */
export async function toolNames(): Promise<string[]> {
  const { createDefaultRegistry } = await import("../../tools/index.js");
  return createDefaultRegistry()
    .list()
    .map((t) => t.schema.name);
}

/** All skill names from disk (lazy). */
export async function skillNames(configDir: string): Promise<string[]> {
  const { readdirSync, existsSync } = await import("fs");
  const { join } = await import("path");
  const skillsDir = join(configDir, "skills");
  if (!existsSync(skillsDir)) return [];
  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}
