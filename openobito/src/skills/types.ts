// ─── Skill system types ───────────────────────────────────────────────────────
// Mirrors opencode/packages/schema/src/skill.ts with OpenAgent extensions.

// ── Source types (where a skill lives) ──────────────────────────────────────

export interface DirectorySource {
  type: "directory";
  path: string; // absolute path to skill folder
}

export interface UrlSource {
  type: "url";
  url: string; // remote SKILL.md URL
}

export interface EmbeddedSource {
  type: "embedded";
  skill: SkillInfo; // bundled inline (no file I/O)
}

export type SkillSource = DirectorySource | UrlSource | EmbeddedSource;

// ── Skill front-matter (YAML header in SKILL.md) ─────────────────────────────

export interface SkillFrontmatter {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  platforms?: string[];
  metadata?: {
    tags?: string[];
    related_skills?: string[];
    [key: string]: unknown;
  };
}

// ── Runtime skill record ─────────────────────────────────────────────────────

export interface SkillInfo {
  // Identity
  name: string;
  description: string;
  version: string;
  author: string;

  // Where it lives
  source: SkillSource;
  location: string; // absolute path (same as source.path for directory sources)

  // Content
  content: string; // full SKILL.md text (injected into agent context)
  frontmatter: SkillFrontmatter;
  tags: string[];
  relatedSkills: string[];

  // TUI integration
  slash: boolean; // accessible via /skills use <name>

  // Usage tracking (persisted to SQLite)
  usageCount: number;
  lastUsed?: Date | undefined;
  rating?: number | undefined; // 1–5
  autoImproving: boolean; // SkillImprover is watching this skill
}

// ── Filter for SkillRegistry.list() ─────────────────────────────────────────

export interface SkillFilter {
  tag?: string;
  source?: SkillSource["type"];
  minRating?: number;
  hasBeenUsed?: boolean;
  autoImproving?: boolean;
}

// ── Toolset distributions (from hermes/toolset_distributions.py) ─────────────
// Maps tool name → probability (0–100) that the agent picks it for this task type.

export type DistributionMap = Record<string, number>;

export interface ToolsetDistribution {
  name: string;
  description: string;
  toolsets: DistributionMap;
}

// ── Match result from SkillMatcher ───────────────────────────────────────────

export interface SkillMatch {
  skill: SkillInfo;
  score: number; // 0–1 relevance score
  reason: string; // "keyword match: 'review'", "tag match: debugging"
}

// ── Skill improvement result ─────────────────────────────────────────────────

export interface ImprovementResult {
  skill: SkillInfo;
  previousContent: string;
  newContent: string;
  changesSummary: string;
}
