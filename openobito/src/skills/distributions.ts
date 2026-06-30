// ─── Toolset distributions ────────────────────────────────────────────────────
// Inspired by hermes-agent/toolset_distributions.py.
// Each distribution maps tool_name → probability (0–100) of being selected
// when the agent is operating in that task mode.
//
// Higher % = agent prefers picking that tool for this type of task.
// The SkillMatcher uses these to recommend skills based on user intent.

import type { ToolsetDistribution } from "./types.js";

export const DISTRIBUTIONS: Record<string, ToolsetDistribution> = {
  // ── Code-focused ──────────────────────────────────────────────────────────

  coding: {
    name: "coding",
    description: "General software development: read, write, analyze, test",
    toolsets: {
      read_file:      100,
      list_directory: 100,
      write_file:      90,
      shell_exec:      85, // npm test, tsc, eslint
      git_diff:        80,
      git_status:      75,
      git_log:         50,
    },
  },

  debugging: {
    name: "debugging",
    description: "Trace errors, reproduce bugs, find root causes",
    toolsets: {
      read_file:      100,
      shell_exec:      95, // run tests, repro commands
      list_directory:  80,
      git_diff:        70, // recent changes
      git_log:         65,
      write_file:      40, // add debug instrumentation
    },
  },

  refactoring: {
    name: "refactoring",
    description: "Improve code structure without changing behavior",
    toolsets: {
      read_file:      100,
      list_directory:  95,
      write_file:      90,
      shell_exec:      85, // run tests after each step
      git_diff:        60,
      git_status:      55,
    },
  },

  reviewing: {
    name: "reviewing",
    description: "Code review, audit, quality assessment",
    toolsets: {
      read_file:      100,
      list_directory:  90,
      git_diff:        80,
      shell_exec:      60, // run linters
      web_fetch:       20, // check library docs
    },
  },

  testing: {
    name: "testing",
    description: "Write and run tests, check coverage",
    toolsets: {
      read_file:      100,
      write_file:      95,
      shell_exec:      95, // npm test, coverage
      list_directory:  80,
      git_status:      40,
    },
  },

  // ── Git / version control ─────────────────────────────────────────────────

  git: {
    name: "git",
    description: "Git operations, commits, branches, PR management",
    toolsets: {
      shell_exec:     100, // all git commands
      read_file:       70,
      list_directory:  50,
      git_status:     100,
      git_diff:       100,
      git_log:        100,
      git_commit:      90,
      git_checkout:    80,
      git_push:        70,
    },
  },

  // ── Documentation ─────────────────────────────────────────────────────────

  writing: {
    name: "writing",
    description: "Write README, docs, comments, API references",
    toolsets: {
      read_file:      100,
      write_file:      90,
      list_directory:  80,
      web_fetch:       40, // reference external docs
      shell_exec:      30, // find exports, grep for patterns
    },
  },

  // ── Research / analysis ───────────────────────────────────────────────────

  research: {
    name: "research",
    description: "Web research, fetch docs, analyze external resources",
    toolsets: {
      web_fetch:       90,
      shell_exec:      60,
      read_file:       70,
      list_directory:  40,
    },
  },

  analysis: {
    name: "analysis",
    description: "Analyze project structure, map dependencies",
    toolsets: {
      read_file:      100,
      list_directory: 100,
      shell_exec:      80, // find, wc, dependency tools
      git_log:         50,
      git_diff:        40,
    },
  },

  // ── Safe / minimal ────────────────────────────────────────────────────────

  readonly: {
    name: "readonly",
    description: "Read-only exploration, no writes or execution",
    toolsets: {
      read_file:      100,
      list_directory: 100,
      git_status:      70,
      git_log:         70,
      git_diff:        70,
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return tools sorted by probability for a given distribution. */
export function rankedTools(distributionName: string): Array<[string, number]> {
  const dist = DISTRIBUTIONS[distributionName];
  if (!dist) return [];
  return Object.entries(dist.toolsets).sort((a, b) => b[1] - a[1]);
}

/** Sample tools from a distribution using per-tool probability roll. */
export function sampleTools(distributionName: string): string[] {
  const dist = DISTRIBUTIONS[distributionName];
  if (!dist) return [];

  const selected: string[] = [];
  for (const [tool, prob] of Object.entries(dist.toolsets)) {
    if (Math.random() * 100 < prob) selected.push(tool);
  }

  // Guarantee at least one tool (highest-probability fallback)
  if (selected.length === 0) {
    const top = Object.entries(dist.toolsets).sort((a, b) => b[1] - a[1])[0];
    if (top) selected.push(top[0]);
  }

  return selected;
}

/** Detect which distribution best matches a user's task description. */
export function inferDistribution(taskDescription: string): string {
  const lower = taskDescription.toLowerCase();

  if (/\b(debug|error|crash|stack trace|exception|failing|broken)\b/.test(lower)) return "debugging";
  if (/\b(review|audit|check|inspect|quality|lint)\b/.test(lower)) return "reviewing";
  if (/\b(test|spec|coverage|tdd|unit test|integration)\b/.test(lower)) return "testing";
  if (/\b(refactor|clean up|simplify|restructure|extract)\b/.test(lower)) return "refactoring";
  if (/\b(commit|branch|pr |pull request|merge|push|git)\b/.test(lower)) return "git";
  if (/\b(readme|docs|document|comment|jsdoc|tsdoc)\b/.test(lower)) return "writing";
  if (/\b(research|search|fetch|look up|find out)\b/.test(lower)) return "research";
  if (/\b(analyze|structure|architecture|map|explore)\b/.test(lower)) return "analysis";

  return "coding"; // default
}
