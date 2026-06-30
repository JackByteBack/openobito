import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

// ─── Git Integration mixin ────────────────────────────────────────────────────
// /git status|diff|log|branch|checkout|commit|push|pull

async function git(subcmd: string, timeout = 10000): Promise<string> {
  const { execSync } = await import("child_process");
  return execSync(`git ${subcmd}`, { encoding: "utf8", timeout, maxBuffer: 5_242_880 }).trim();
}

const GIT_SUBCOMMANDS = ["status", "diff", "log", "branch", "checkout", "commit", "push", "pull"];

export function GitMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["git", "status"],
          description: "Show git status",
          usage: "/git status",
          handler: async () => {
            try { return output(await git("status --short --branch")); }
            catch { return err("Not a git repository or git not installed."); }
          },
        },
        {
          path: ["git", "diff"],
          description: "Show git diff (optionally for a file)",
          usage: "/git diff [<file>]",
          handler: async (args) => {
            const file = args[0] ? `-- "${args[0]}"` : "";
            try { return output((await git(`diff ${file}`)) || "(no changes)"); }
            catch (e) { return err(String(e)); }
          },
        },
        {
          path: ["git", "log"],
          description: "Show git log",
          usage: "/git log [--limit <n>]",
          handler: async (args) => {
            const limIdx = args.indexOf("--limit");
            const n = limIdx >= 0 ? parseInt(args[limIdx + 1] ?? "10", 10) : 10;
            try { return output(await git(`log --oneline -${n}`)); }
            catch (e) { return err(String(e)); }
          },
          complete: async () => ["--limit"],
        },
        {
          path: ["git", "branch"],
          description: "List branches or create one",
          usage: "/git branch [<name>]",
          handler: async (args) => {
            try {
              if (args[0]) {
                await git(`checkout -b "${args[0]}"`);
                return output(`Created and switched to branch: ${args[0]}`);
              }
              return output(await git("branch -v"));
            } catch (e) { return err(String(e)); }
          },
        },
        {
          path: ["git", "checkout"],
          description: "Checkout a branch",
          usage: "/git checkout <branch>",
          handler: async (args) => {
            const branch = args[0];
            if (!branch) return err("Usage: /git checkout <branch>");
            try {
              await git(`checkout "${branch}"`);
              return output(`Switched to: ${branch}`);
            } catch (e) { return err(String(e)); }
          },
          complete: async () => {
            try { return (await git("branch --format=%(refname:short)")).split("\n").filter(Boolean); }
            catch { return []; }
          },
        },
        {
          path: ["git", "commit"],
          description: "Commit staged changes",
          usage: '/git commit "<message>"',
          handler: async (args) => {
            const msg = args.join(" ").trim();
            if (!msg) return err('Usage: /git commit "<message>"');
            try {
              const out = await git(`commit -m "${msg.replace(/"/g, '\\"')}"`);
              return output(out);
            } catch (e) { return err(String(e)); }
          },
        },
        {
          path: ["git", "push"],
          description: "Push to remote",
          usage: "/git push",
          handler: async () => {
            try { return output(await git("push", 30000)); }
            catch (e) { return err(String(e)); }
          },
        },
        {
          path: ["git", "pull"],
          description: "Pull from remote",
          usage: "/git pull",
          handler: async () => {
            try { return output(await git("pull", 30000)); }
            catch (e) { return err(String(e)); }
          },
        },
        // top-level /git → show status
        {
          path: ["git"],
          description: "Git integration commands",
          usage: `/git <${GIT_SUBCOMMANDS.join("|")}>`,
          handler: async () => {
            try { return output(await git("status --short --branch")); }
            catch { return err("Not a git repository or git not installed."); }
          },
          complete: async () => GIT_SUBCOMMANDS,
        },
      ]);
    }
  };
}
