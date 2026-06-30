import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";
import { PERSONALITIES, THEMES } from "../complete.js";

// ─── Personality & style mixin ────────────────────────────────────────────────
// /personality /style /tone /theme

const PERSONALITY_PROMPTS: Record<string, string> = {
  helpful:
    "You are a helpful assistant. Be clear, direct, and concise.",
  concise:
    "You are extremely concise. Never use more words than necessary. Bullet-point by default.",
  detailed:
    "You are thorough and detailed. Explain reasoning step-by-step. Show your work.",
  sherlock:
    "You reason like Sherlock Holmes. Observe, deduce, and explain your inference chain.",
  creative:
    "You are creative and inventive. Think laterally, offer unexpected solutions.",
  technical:
    "You are a seasoned engineer. Be precise, use technical terminology, show code examples.",
  friendly:
    "You are warm and encouraging. Use a conversational, supportive tone.",
};

let activePersonality = "helpful";

export function PersonalityMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["personality"],
          description: "Show or set the agent personality",
          usage: "/personality [<name>|list]",
          handler: async (args, _ctx) => {
            if (args.length === 0) return output(`Active personality: ${activePersonality}`);
            const name = args[0]!;
            if (name === "list") {
              return output(
                "Personalities:\n" +
                  PERSONALITIES.map(
                    (p) => `  ${p === activePersonality ? "❯" : " "} ${p}`
                  ).join("\n")
              );
            }
            if (!(name in PERSONALITY_PROMPTS))
              return err(
                `Unknown personality: ${name}\nChoose: ${PERSONALITIES.join(", ")}`
              );
            activePersonality = name;
            return output(
              `Personality set to: ${name}\n${PERSONALITY_PROMPTS[name]}`
            );
          },
          complete: async () => ["list", ...PERSONALITIES],
        },
        ...PERSONALITIES.map((p) => ({
          path: ["personality", p],
          description: `Set personality to ${p}`,
          usage: `/personality ${p}`,
          handler: async (_args: string[], _ctx: Parameters<typeof this.registerMany>[0][number]["handler"] extends (...args: infer A) => unknown ? A[1] : never) => {
            activePersonality = p;
            return output(`Personality: ${p}\n${PERSONALITY_PROMPTS[p]}`);
          },
        })),
        {
          path: ["style"],
          description: "Alias for /personality",
          usage: "/style [<name>]",
          handler: async (args, _ctx) => {
            if (args.length === 0) return output(`Style/personality: ${activePersonality}`);
            const name = args[0]!;
            if (!(name in PERSONALITY_PROMPTS))
              return err(`Unknown style: ${name}`);
            activePersonality = name;
            return output(`Style set to: ${name}`);
          },
          complete: async () => [...PERSONALITIES],
        },
        {
          path: ["tone"],
          description: "Alias for /personality (tone variant)",
          usage: "/tone [<name>]",
          handler: async (args, _ctx) => {
            if (args.length === 0) return output(`Tone: ${activePersonality}`);
            const name = args[0]!;
            activePersonality = name in PERSONALITY_PROMPTS ? name : activePersonality;
            return output(`Tone set to: ${activePersonality}`);
          },
          complete: async () => [...PERSONALITIES],
        },
        {
          path: ["theme"],
          description: "Show or switch the TUI colour theme",
          usage: "/theme [list|<name>]",
          handler: async (args, ctx) => {
            if (args.length === 0)
              return output(`Active theme: ${ctx.config.ui.theme}`);
            const name = args[0]!;
            if (name === "list")
              return output(
                "Themes:\n" +
                  THEMES.map(
                    (t) => `  ${t === ctx.config.ui.theme ? "❯" : " "} ${t}`
                  ).join("\n")
              );
            if (!(THEMES as readonly string[]).includes(name))
              return err(`Unknown theme: ${name}\nChoose: ${THEMES.join(", ")}`);
            ctx.config.ui.theme = name as "dark" | "light" | "auto";
            const { saveConfig } = await import("../../../config/index.js");
            saveConfig(ctx.config);
            return output(`Theme set to: ${name} (restart to apply)`);
          },
          complete: async () => ["list", ...THEMES],
        },
        ...THEMES.map((t) => ({
          path: ["theme", t],
          description: `Switch to ${t} theme`,
          usage: `/theme ${t}`,
          handler: async (_args: string[], ctx: Parameters<typeof this.registerMany>[0][number]["handler"] extends (...args: infer A) => unknown ? A[1] : never) => {
            ctx.config.ui.theme = t as "dark" | "light" | "auto";
            const { saveConfig } = await import("../../../config/index.js");
            saveConfig(ctx.config);
            return output(`Theme: ${t}`);
          },
        })),
      ]);
    }
  };
}
