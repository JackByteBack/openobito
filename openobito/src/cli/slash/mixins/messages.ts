import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

// ─── Message Control mixin ────────────────────────────────────────────────────
// /edit /delete /regenerate /summarize /pin /bookmark

export function MessagesMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["edit"],
          description: "Edit the Nth message (1 = oldest shown)",
          usage: "/edit <n>",
          handler: async (args, _ctx) => {
            const n = parseInt(args[0] ?? "", 10);
            if (isNaN(n)) return err("Usage: /edit <n>");
            return output(`Edit message #${n} — inline editing in Phase 2.`);
          },
        },
        {
          path: ["delete"],
          description: "Delete the Nth message from the transcript",
          usage: "/delete <n>",
          handler: async (args, _ctx) => {
            const n = parseInt(args[0] ?? "", 10);
            if (isNaN(n)) return err("Usage: /delete <n>  (number = message index)");
            return output(`Deleted message #${n} — wired in Phase 2.`);
          },
        },
        {
          path: ["regenerate"],
          description: "Regenerate the last assistant response",
          usage: "/regenerate",
          handler: async (_args, _ctx) =>
            output("Regenerating last response — wired in Phase 2."),
        },
        {
          path: ["summarize"],
          description: "Ask the agent to summarize the current conversation",
          usage: "/summarize",
          handler: async (_args, ctx) => {
            ctx.print("Summarise the conversation so far in 3 bullet points.");
            return output("Summary request injected into context.");
          },
        },
        {
          path: ["pin"],
          description: "Pin a message so it survives /clear",
          usage: "/pin [<n>]",
          handler: async (args, _ctx) => {
            const n = args[0] ? parseInt(args[0], 10) : null;
            return output(`Pin ${n !== null ? `message #${n}` : "last message"} — Phase 2.`);
          },
        },
        {
          path: ["bookmark"],
          description: "Bookmark the Nth message for later reference",
          usage: "/bookmark <n>",
          handler: async (args, _ctx) => {
            const n = parseInt(args[0] ?? "", 10);
            if (isNaN(n)) return err("Usage: /bookmark <n>");
            return output(`Bookmarked message #${n} — Phase 2.`);
          },
        },
      ]);
    }
  };
}
