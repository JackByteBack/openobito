// ─── Plugin System Types ──────────────────────────────────────────────────────

export type PluginRiskLevel = "low" | "medium" | "high";

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  risk: PluginRiskLevel;
  tools: string[];
  hooks: string[];
  entry: string;
}

export interface PluginTool {
  name: string;
  description: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  dir: string;
  enabled: boolean;
  tools: PluginTool[];
  installedAt: number;
}

export interface PluginQuery {
  query?: string;
  category?: string;
  risk?: PluginRiskLevel;
}
