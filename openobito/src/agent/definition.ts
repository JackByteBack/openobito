import type { ToolPolicyAction } from "../types/index.js";

// ─── Agent Definition System (OpenHuman-inspired) ────────────────────────────

export type AutonomyTier = "readonly" | "supervised" | "full";

export interface AgentToolOverride {
  toolName: string;
  action: ToolPolicyAction;
  reason?: string | undefined;
}

export interface CircuitBreakerConfig {
  repeatFailureThreshold: number;
  noProgressThreshold: number;
}

export interface AgentDefinition {
  name: string;
  description: string;
  autonomy: AutonomyTier;
  maxSteps: number;
  toolOverrides: AgentToolOverride[];
  circuitBreakers: CircuitBreakerConfig;
  tags: string[];
}

const DEFAULT_CIRCUIT_BREAKERS: CircuitBreakerConfig = {
  repeatFailureThreshold: 3,
  noProgressThreshold: 6,
};

export const DEFAULT_AGENT_DEFINITION: AgentDefinition = {
  name: "default",
  description: "Default OpenAgent with supervised autonomy",
  autonomy: "supervised",
  maxSteps: 100,
  toolOverrides: [],
  circuitBreakers: DEFAULT_CIRCUIT_BREAKERS,
  tags: [],
};

// ─── Registry ────────────────────────────────────────────────────────────────

export class AgentDefinitionRegistry {
  private readonly definitions = new Map<string, AgentDefinition>();

  constructor() {
    this.register(DEFAULT_AGENT_DEFINITION);
  }

  register(def: AgentDefinition): void {
    this.definitions.set(def.name, def);
  }

  get(name: string): AgentDefinition | undefined {
    return this.definitions.get(name);
  }

  getOrDefault(name: string): AgentDefinition {
    return this.definitions.get(name) ?? DEFAULT_AGENT_DEFINITION;
  }

  list(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  unregister(name: string): boolean {
    if (name === "default") return false;
    return this.definitions.delete(name);
  }
}

// ─── Built-in definitions ─────────────────────────────────────────────────────

export const BUILTIN_DEFINITIONS: AgentDefinition[] = [
  {
    name: "readonly",
    description: "Read-only agent: can only read files and run safe commands",
    autonomy: "readonly",
    maxSteps: 50,
    toolOverrides: [
      { toolName: "write_file", action: "deny", reason: "readonly agent" },
      { toolName: "shell_exec", action: "deny", reason: "readonly agent" },
      { toolName: "web_fetch", action: "require_approval", reason: "readonly agent" },
    ],
    circuitBreakers: DEFAULT_CIRCUIT_BREAKERS,
    tags: ["safe", "audit", "research"],
  },
  {
    name: "supervised",
    description: "Supervised agent: asks before destructive or irreversible actions",
    autonomy: "supervised",
    maxSteps: 100,
    toolOverrides: [
      { toolName: "shell_exec", action: "require_approval" },
      { toolName: "write_file", action: "require_approval" },
      { toolName: "web_fetch", action: "require_approval" },
    ],
    circuitBreakers: DEFAULT_CIRCUIT_BREAKERS,
    tags: ["default", "balanced"],
  },
  {
    name: "full",
    description: "Full autonomy agent: runs all steps without approval gates",
    autonomy: "full",
    maxSteps: 200,
    toolOverrides: [],
    circuitBreakers: {
      repeatFailureThreshold: 5,
      noProgressThreshold: 10,
    },
    tags: ["autonomous", "trusted"],
  },
];

export function createDefaultRegistry(): AgentDefinitionRegistry {
  const registry = new AgentDefinitionRegistry();
  for (const def of BUILTIN_DEFINITIONS) {
    registry.register(def);
  }
  return registry;
}
