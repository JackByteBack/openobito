import type { SkillInfo, SkillMatch } from "./types.js";
import type { SkillRegistry } from "./registry.js";
import { inferDistribution } from "./distributions.js";

// ─── Skill matcher ────────────────────────────────────────────────────────────
// Combines keyword matching, tag matching, and distribution inference to
// suggest the top N most relevant skills for a user's input.

const KEYWORD_MAP: Record<string, string[]> = {
  "code-reviewer": [
    "review", "audit", "check my code", "look at my code", "code quality",
    "security", "vulnerabilities", "best practices", "feedback on",
  ],
  "debug-assistant": [
    "debug", "error", "crash", "exception", "failing", "broken", "not working",
    "stack trace", "why is", "what's wrong", "fix this bug", "traceback",
  ],
  "refactor-helper": [
    "refactor", "clean up", "simplify", "restructure", "extract", "improve code",
    "technical debt", "rewrite", "reorganize",
  ],
  "test-writer": [
    "test", "spec", "unit test", "integration test", "tdd", "coverage",
    "write tests", "add tests", "jest", "vitest", "mocha",
  ],
  "git-helper": [
    "git", "commit", "branch", "pr", "pull request", "merge", "push",
    "conventional commits", "changelog", "release", "tag",
  ],
  "doc-writer": [
    "readme", "docs", "document", "jsdoc", "tsdoc", "docstring", "comment",
    "api reference", "write docs", "explain this function",
  ],
  "file-analyzer": [
    "analyze", "understand", "explore", "map", "structure", "architecture",
    "dependencies", "what does this do", "how does this work", "codebase overview",
  ],
};

export class SkillMatcher {
  constructor(private registry: SkillRegistry) {}

  /**
   * Match user input to skills. Returns top 3 most relevant skills.
   * Combines keyword signals + tag signals + distribution inference.
   */
  match(userInput: string, limit = 3): SkillInfo[] {
    return this.matchWithReasons(userInput, limit).map((m) => m.skill);
  }

  matchWithReasons(userInput: string, limit = 3): SkillMatch[] {
    const lower = userInput.toLowerCase();
    const scores = new Map<string, { score: number; reasons: string[] }>();

    const bump = (name: string, delta: number, reason: string) => {
      const prev = scores.get(name) ?? { score: 0, reasons: [] };
      scores.set(name, {
        score: prev.score + delta,
        reasons: [...prev.reasons, reason],
      });
    };

    // ── 1. Keyword map matching ─────────────────────────────────────────────
    for (const [skillName, keywords] of Object.entries(KEYWORD_MAP)) {
      if (!this.registry.has(skillName)) continue;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          bump(skillName, kw.includes(" ") ? 1.0 : 0.7, `keyword: "${kw}"`);
          break; // one match per skill per input is enough
        }
      }
    }

    // ── 2. Tag matching ─────────────────────────────────────────────────────
    const inputTokens = lower.split(/\s+/).filter(Boolean);
    for (const skill of this.registry.list()) {
      for (const tag of skill.tags) {
        if (inputTokens.some((t) => tag.toLowerCase().includes(t) || t.includes(tag.toLowerCase()))) {
          bump(skill.name, 0.5, `tag: "${tag}"`);
        }
      }
    }

    // ── 3. Distribution-based matching ─────────────────────────────────────
    const dist = inferDistribution(userInput);
    const distToSkill: Record<string, string> = {
      debugging:   "debug-assistant",
      reviewing:   "code-reviewer",
      testing:     "test-writer",
      refactoring: "refactor-helper",
      git:         "git-helper",
      writing:     "doc-writer",
      analysis:    "file-analyzer",
    };
    const distSkill = distToSkill[dist];
    if (distSkill && this.registry.has(distSkill)) {
      bump(distSkill, 0.4, `distribution: ${dist}`);
    }

    // ── 4. Registry fuzzy search for unmatched terms ────────────────────────
    const registryMatches = this.registry.searchWithReasons(userInput, 3);
    for (const { skill, score, reason } of registryMatches) {
      if (score > 0.3) bump(skill.name, score * 0.3, `registry: ${reason}`);
    }

    // ── Rank and return ─────────────────────────────────────────────────────
    const ranked: SkillMatch[] = [];
    for (const [name, { score, reasons }] of scores.entries()) {
      const skill = this.registry.get(name);
      if (!skill) continue;
      ranked.push({ skill, score, reason: reasons.slice(0, 2).join(", ") });
    }

    return ranked
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
