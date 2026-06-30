import { describe, it, expect } from "vitest";
import { SkillMatcher } from "../../src/skills/matcher.js";
import { SkillRegistry } from "../../src/skills/registry.js";

describe("SkillMatcher", () => {
  it("finds best skill by matching input", () => {
    const registry = new SkillRegistry();
    registry.register({
      name: "code-review",
      description: "Review code changes",
      tags: ["coding", "review", "git"],
      risk: "low",
      source: "builtin",
      path: "/skills/code-review/SKILL.md",
    });
    registry.register({
      name: "git-workflow",
      description: "Git workflow automation",
      tags: ["git", "automation"],
      risk: "medium",
      source: "builtin",
      path: "/skills/git-workflow/SKILL.md",
    });

    const matcher = new SkillMatcher(registry);
    const matched = matcher.match("review my code");
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0]?.name).toBe("code-review");
  });

  it("returns empty for no match", () => {
    const registry = new SkillRegistry();
    registry.register({
      name: "git-workflow",
      description: "Git workflow automation",
      tags: ["git", "automation"],
      risk: "medium",
      source: "builtin",
      path: "/skills/git-workflow/SKILL.md",
    });

    const matcher = new SkillMatcher(registry);
    const matched = matcher.match("cooking pasta");
    expect(matched).toHaveLength(0);
  });
});
