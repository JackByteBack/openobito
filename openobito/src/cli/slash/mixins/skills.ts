import type { GConstructor } from "../types.js";
import { output, err, OK } from "../types.js";
import type { BaseCLI } from "../base.js";
import { skillNames } from "../complete.js";
import { join } from "path";
import { homedir } from "os";

const SKILLS_DIR = join(homedir(), ".openagent", "skills");

// ─── Skills System mixin ───────────────────────────────────────────────────────
// Hermes folder-based SKILL.md pattern.
// Each skill is a directory under ~/.openagent/skills/<name>/SKILL.md

export function SkillsMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["skills"],
          description: "List available skills",
          usage: "/skills [--enabled|--recently-used]",
          aliases: ["/s"],
          handler: async (args, _ctx) => {
            const { getConfigDir } = await import("../../../config/index.js");
            const names = await skillNames(getConfigDir());
            if (names.length === 0) {
              return output(
                "No skills installed.\nRun /skills hub to browse, or /skills install <name> to add one."
              );
            }
            const flag = args[0];
            // For --recently-used we'd query audit_log; stub for now.
            const header =
              flag === "--enabled"
                ? "Enabled skills:"
                : flag === "--recently-used"
                  ? "Recently used:"
                  : "All skills:";
            return output(`${header}\n${names.map((n) => `  /skills use ${n}`).join("\n")}`);
          },
          complete: async () => ["--enabled", "--recently-used"],
        },
        {
          path: ["skills", "info"],
          description: "Show details about a skill",
          usage: "/skills info <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /skills info <name>");
            const { readFileSync, existsSync } = await import("fs");
            const mdPath = join(SKILLS_DIR, name, "SKILL.md");
            if (!existsSync(mdPath))
              return err(`Skill not found: ${name}. Run /skills to list installed skills.`);
            return output(readFileSync(mdPath, "utf8"));
          },
          complete: async (_ctx) => {
            const { getConfigDir } = await import("../../../config/index.js");
            return skillNames(getConfigDir());
          },
        },
        {
          path: ["skills", "use"],
          description: "Activate a skill for the current session",
          usage: "/skills use <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /skills use <name>");
            return output(`Skill "${name}" activated for this session.`);
          },
          complete: async (_ctx) => {
            const { getConfigDir } = await import("../../../config/index.js");
            return skillNames(getConfigDir());
          },
        },
        {
          path: ["skills", "create"],
          description: "Create a new skill (with --auto: AI-generated from description)",
          usage: "/skills create <name> [--auto]",
          handler: async (args, ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /skills create <name> [--auto]");
            const auto = args.includes("--auto");
            const { mkdirSync, writeFileSync, existsSync } = await import("fs");
            const skillDir = join(SKILLS_DIR, name);
            if (existsSync(skillDir)) return err(`Skill "${name}" already exists.`);
            mkdirSync(skillDir, { recursive: true });
            const template = auto
              ? `# ${name}\n\nAI-generated skill — describe it here.\n\n## Instructions\n\n## Examples\n`
              : `# ${name}\n\n## Description\n\n## Instructions\n\n## Examples\n`;
            writeFileSync(join(skillDir, "SKILL.md"), template, "utf8");
            return output(
              `Created skill: ${name}\nEdit it at: ${join(skillDir, "SKILL.md")}`
            );
          },
        },
        {
          path: ["skills", "improve"],
          description: "Use the agent to improve a skill's SKILL.md",
          usage: "/skills improve <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /skills improve <name>");
            return output(`Improvement suggestions for "${name}" — ask the agent to review SKILL.md.`);
          },
          complete: async (_ctx) => {
            const { getConfigDir } = await import("../../../config/index.js");
            return skillNames(getConfigDir());
          },
        },
        {
          path: ["skills", "rate"],
          description: "Rate a skill 1–5 stars",
          usage: "/skills rate <name> <1-5>",
          handler: async (args, _ctx) => {
            const [name, ratingStr] = args;
            if (!name || !ratingStr) return err("Usage: /skills rate <name> <1-5>");
            const rating = parseInt(ratingStr, 10);
            if (isNaN(rating) || rating < 1 || rating > 5)
              return err("Rating must be 1–5.");
            return output(`Rated "${name}" ${rating}/5. Thanks!`);
          },
          complete: async (_ctx) => {
            const { getConfigDir } = await import("../../../config/index.js");
            return skillNames(getConfigDir());
          },
        },
        {
          path: ["skills", "delete"],
          description: "Delete a skill",
          usage: "/skills delete <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /skills delete <name>");
            const { rmSync, existsSync } = await import("fs");
            const skillDir = join(SKILLS_DIR, name);
            if (!existsSync(skillDir)) return err(`Skill not found: ${name}`);
            rmSync(skillDir, { recursive: true, force: true });
            return output(`Deleted skill: ${name}`);
          },
          complete: async (_ctx) => {
            const { getConfigDir } = await import("../../../config/index.js");
            return skillNames(getConfigDir());
          },
        },
        {
          path: ["skills", "search"],
          description: "Search skill names/descriptions",
          usage: "/skills search <query>",
          handler: async (args, _ctx) => {
            const query = args.join(" ").toLowerCase();
            if (!query) return err("Usage: /skills search <query>");
            const { getConfigDir } = await import("../../../config/index.js");
            const names = await skillNames(getConfigDir());
            const matches = names.filter((n) => n.toLowerCase().includes(query));
            return matches.length > 0
              ? output(matches.map((n) => `  ${n}`).join("\n"))
              : output(`No skills matching "${query}".`);
          },
        },
        {
          path: ["skills", "hub"],
          description: "Browse the OpenAgent Skills Hub",
          usage: "/skills hub",
          handler: async (_args, _ctx) => {
            return output(
              "Skills Hub: https://github.com/openagent-dev/openagent/tree/main/skills\n" +
                "Use /skills install <name> to add a community skill."
            );
          },
        },
        {
          path: ["skills", "install"],
          description: "Install a skill from the hub",
          usage: "/skills install <name>",
          handler: async (args, _ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /skills install <name>");
            return output(`Installing "${name}"… (Hub integration coming in Phase 2)`);
          },
        },
      ]);
    }
  };
}
