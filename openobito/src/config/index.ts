import { ConfigManager, createConfigManager } from "./manager.js";
import { ConfigSchema, type Config, type ValidationResult, SCHEMA_KEYS } from "./schema.js";
import type { OpenAgentConfig, ModelConfig } from "../types/index.js";

export { ConfigManager, ConfigSchema, ConfigSchema as Schema };
export type { Config, ValidationResult };
export { SCHEMA_KEYS };

let _manager: ConfigManager | null = null;

function manager(): ConfigManager {
  if (!_manager) _manager = createConfigManager();
  return _manager;
}

function toModelConfig(m: Config["model"]): ModelConfig {
  return {
    provider: m.backend as "ollama",
    model: m.primary,
    baseUrl: m.base_url,
    temperature: m.temperature,
    maxTokens: m.max_tokens,
    contextLength: 8192,
  };
}

function toPermissions(s: Config["security"]): OpenAgentConfig["permissions"] {
  return {
    defaultAction: s.level === "relaxed" ? "allow"
      : s.level === "moderate" ? "require_approval"
      : "require_approval" as const,
    policies: s.rules.map(r => ({
      toolName: r.action,
      action: r.effect === "ask" ? "require_approval"
        : r.effect === "deny" ? "deny"
        : "allow" as const,
      riskLevel: r.effect === "deny" ? "critical"
        : r.effect === "ask" ? "high"
        : "low" as const,
    })),
  };
}

function toLegacyConfig(c: Config): OpenAgentConfig {
  return {
    model: toModelConfig(c.model),
    permissions: toPermissions(c.security),
    storage: {
      path: c.storage.path,
      maxSessions: c.storage.max_sessions,
    },
    ui: {
      theme: c.app.theme === "hermes" ? "dark" as const
        : c.app.theme === "custom" ? "dark" as const
        : c.app.theme as "dark" | "light" | "auto",
      showTimestamps: c.ui.show_token_count,
      streamOutput: c.ui.streaming,
    },
    plugins: c.plugins,
  };
}

export function loadConfig(): OpenAgentConfig {
  const cfg = manager().load();
  return toLegacyConfig(cfg);
}

export function saveConfig(config?: OpenAgentConfig): void {
  if (config) {
    const mgr = manager();
    const current = mgr.load();
    if (config.model) {
      if (config.model.model) current.model.primary = config.model.model;
      if (config.model.baseUrl) current.model.base_url = config.model.baseUrl;
      if (config.model.temperature !== undefined) current.model.temperature = config.model.temperature;
    }
    if (config.storage) {
      current.storage.path = config.storage.path;
    }
    if (config.ui) {
      const themeMap: Record<string, "hermes" | "dark" | "light" | "custom"> = {
        dark: "dark", light: "light", auto: "hermes",
      };
      current.app.theme = themeMap[config.ui.theme] ?? "hermes";
      current.ui.streaming = config.ui.streamOutput;
      current.ui.show_token_count = config.ui.showTimestamps;
    }
    mgr.save();
    return;
  }
  manager().save();
}

export function getConfigManager(): ConfigManager {
  return manager();
}

export function getConfigDir(): string {
  return manager().configDir();
}

export function getConfigFile(): string {
  return manager().configPath();
}

export function ensureConfigDir(): void {
  manager().load();
}
