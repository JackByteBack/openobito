import { z } from "zod";

export const RuleSchema = z.object({
  action: z.string(),
  resource: z.string(),
  effect: z.enum(["allow", "deny", "ask"]),
});

export const FallbackProviderSchema = z.object({
  provider: z.string(),
  model: z.string(),
});

export const ColorSchema = z.object({
  primary: z.string().default("#00D9FF"),
  accent: z.string().default("#7C3AED"),
}).default({});

const AppSchema = z.object({
  theme: z.enum(["hermes", "dark", "light", "custom"]).default("hermes"),
  language: z.string().default("en"),
  telemetry: z.literal(false).default(false),
  auto_update: z.boolean().default(false),
  version: z.string().optional(),
}).optional().default({}).transform(v => ({ ...v, telemetry: false }));

const ModelSectionSchema = z.object({
  backend: z.enum(["ollama"]).default("ollama"),
  base_url: z.string().default("http://localhost:11434"),
  primary: z.string().default("mistral:latest"),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().default(2048),
  context_length: z.number().optional(),
  fallback: z.array(FallbackProviderSchema).default([]),
}).optional().default({});

const StorageSectionSchema = z.object({
  path: z.string(),
  max_sessions: z.number().default(100),
}).optional().default({ path: "", max_sessions: 100 });

export const InternalConfigSchema = z.object({
  app: AppSchema,
  model: ModelSectionSchema,
  network: z.object({
    allow_outbound: z.boolean().default(false),
    allow_web_search: z.boolean().default(false),
    air_gap: z.boolean().default(false),
  }).optional().default({}),
  reasoning: z.object({
    show_thinking: z.boolean().default(true),
    thinking_time: z.enum(["fast", "balanced", "deep", "auto"]).default("auto"),
  }).optional().default({}),
  memory: z.object({
    enabled: z.boolean().default(true),
    max_sessions: z.number().default(100),
    context_strategy: z.enum(["sliding", "summarize", "semantic", "adaptive"]).default("adaptive"),
    encrypt: z.boolean().default(false),
  }).optional().default({}),
  security: z.object({
    level: z.enum(["strict", "moderate", "relaxed"]).default("strict"),
    sandbox: z.boolean().default(true),
    audit_logging: z.boolean().default(true),
    require_approval: z.boolean().default(true),
    allowed_dirs: z.array(z.string()).default(["."]),
    rules: z.array(RuleSchema).default([]),
  }).optional().default({}),
  ui: z.object({
    colors: ColorSchema,
    streaming: z.boolean().default(true),
    show_token_count: z.boolean().default(true),
    syntax_highlighting: z.boolean().default(true),
  }).optional().default({}),
  personality: z.enum(["helpful", "concise", "detailed", "sherlock", "creative"]).default("helpful"),
  storage: StorageSectionSchema,
  plugins: z.array(z.string()).default([]),
});

const compatModelTransform = z.object({
  backend: z.string(),
  base_url: z.string(),
  primary: z.string(),
  temperature: z.number(),
  max_tokens: z.number(),
  context_length: z.number().optional(),
  fallback: z.array(FallbackProviderSchema),
}).transform(v => ({
  ...v,
  provider: v.backend as "ollama" | "openai-compat",
  model: v.primary,
  baseUrl: v.base_url,
  maxTokens: v.max_tokens,
  ...(v.context_length !== undefined ? { contextLength: v.context_length } : {}),
}));

const compatSecurityTransform = z.object({
  level: z.enum(["strict", "moderate", "relaxed"]),
  sandbox: z.boolean(),
  audit_logging: z.boolean(),
  require_approval: z.boolean(),
  allowed_dirs: z.array(z.string()),
  rules: z.array(RuleSchema),
}).transform(v => ({
  ...v,
  defaultAction: v.level === "relaxed" ? "allow" as const
    : v.level === "moderate" ? "require_approval" as const
    : "require_approval" as const,
  policies: v.rules.map(r => ({
    toolName: r.action,
    action: r.effect === "ask" ? "require_approval" as const
      : r.effect as "allow" | "deny",
    riskLevel: r.effect === "deny" ? "critical" as const
      : r.effect === "ask" ? "high" as const
      : "low" as const,
  })),
}));

const compatStorageTransform = z.object({
  path: z.string(),
  max_sessions: z.number(),
}).transform(v => ({
  ...v,
  dbPath: v.path,
}));

export const ConfigSchema = InternalConfigSchema.transform(v => {
  const model = compatModelTransform.parse(v.model);
  const security = compatSecurityTransform.parse(v.security);
  const storage = compatStorageTransform.parse(v.storage);

  const rawTheme = v.app?.theme ?? "hermes";
  const uiTheme = (rawTheme === "hermes" ? "dark" : rawTheme) as "dark" | "light" | "auto";

  return {
    ...v,
    model,
    security,
    storage: {
      ...storage,
      maxSessions: storage.max_sessions,
    },
    // Compat shims: keep old field names working for existing code
    permissions: {
      defaultAction: security.defaultAction,
      policies: security.policies,
    },
    ui: {
      ...v.ui,
      theme: uiTheme,
      showTimestamps: false as boolean,
      streamOutput: v.ui.streaming,
    },
  };
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ValidationResult {
  path: string;
  message: string;
  fix?: string;
}

export const SCHEMA_KEYS: Record<string, string> = {
  "app.theme": "string: hermes | dark | light | custom",
  "app.language": "string: en | ...",
  "app.version": "string",
  "model.backend": "string: ollama",
  "model.base_url": "string: http://localhost:11434",
  "model.primary": "string: mistral:latest",
  "model.temperature": "number: 0.0–2.0",
  "model.max_tokens": "number: 2048",
  "model.fallback": "array[{provider, model}]",
  "network.allow_outbound": "boolean: false",
  "network.allow_web_search": "boolean: false",
  "network.air_gap": "boolean: false",
  "reasoning.show_thinking": "boolean: true",
  "reasoning.thinking_time": "string: fast | balanced | deep | auto",
  "memory.enabled": "boolean: true",
  "memory.max_sessions": "number: 100",
  "memory.context_strategy": "string: sliding | summarize | semantic | adaptive",
  "memory.encrypt": "boolean: false",
  "security.level": "string: strict | moderate | relaxed",
  "security.sandbox": "boolean: true",
  "security.audit_logging": "boolean: true",
  "security.require_approval": "boolean: true",
  "security.allowed_dirs": "string[]: ['.']",
  "security.rules": "array[{action, resource, effect}]",
  "ui.colors.primary": "string: #00D9FF",
  "ui.colors.accent": "string: #7C3AED",
  "ui.streaming": "boolean: true",
  "ui.show_token_count": "boolean: true",
  "ui.syntax_highlighting": "boolean: true",
  "personality": "string: helpful | concise | detailed | sherlock | creative",
  "plugins": "string[]",
};
