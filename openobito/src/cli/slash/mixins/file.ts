import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

// ─── File Operations mixin ────────────────────────────────────────────────────
// /file /project

export function FileMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["file"],
          description: "Show or operate on files",
          usage: "/file <path|list|search|read>",
          handler: async (args, _ctx) => {
            const path = args[0];
            if (!path) return err("Usage: /file <path>");
            const { readFileSync, existsSync, statSync } = await import("fs");
            if (!existsSync(path)) return err(`Not found: ${path}`);
            const stat = statSync(path);
            if (stat.isDirectory())
              return output(`${path} is a directory. Use /file list ${path}`);
            if (stat.size > 1_000_000)
              return err(`File too large (${stat.size} bytes). Max 1 MB.`);
            return output(readFileSync(path, "utf8"));
          },
        },
        {
          path: ["file", "list"],
          description: "List files in a directory",
          usage: "/file list [<dir>]",
          handler: async (args, _ctx) => {
            const dir = args[0] ?? ".";
            const { readdirSync, statSync } = await import("fs");
            try {
              const entries = readdirSync(dir, { withFileTypes: true });
              return output(
                entries
                  .map((e) => `  ${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
                  .join("\n")
              );
            } catch (e) { return err(String(e)); }
          },
        },
        {
          path: ["file", "search"],
          description: "Search for files matching a glob pattern",
          usage: "/file search <pattern>",
          handler: async (args, _ctx) => {
            const pattern = args[0];
            if (!pattern) return err("Usage: /file search <pattern>");
            const { execSync } = await import("child_process");
            try {
              const out = execSync(
                `find . -name "${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*"`,
                { encoding: "utf8", timeout: 10000 }
              );
              return output(out.trim() || `No files matching: ${pattern}`);
            } catch { return err("find failed."); }
          },
        },
        {
          path: ["file", "read"],
          description: "Read a file and print its contents",
          usage: "/file read <path>",
          handler: async (args, _ctx) => {
            const path = args[0];
            if (!path) return err("Usage: /file read <path>");
            const { readFileSync, existsSync } = await import("fs");
            if (!existsSync(path)) return err(`Not found: ${path}`);
            return output(readFileSync(path, "utf8"));
          },
        },
        {
          path: ["project"],
          description: "Show project info",
          usage: "/project [detect|structure|config]",
          handler: async (args, _ctx) => {
            const sub = args[0];
            if (sub === "detect" || !sub) {
              const { existsSync } = await import("fs");
              const { execSync } = await import("child_process");
              const hasPkg = existsSync("package.json");
              const hasCargo = existsSync("Cargo.toml");
              const hasGo = existsSync("go.mod");
              const hasPy = existsSync("pyproject.toml") || existsSync("setup.py");
              const isGit = existsSync(".git");
              const kinds = [
                hasPkg && "Node.js",
                hasCargo && "Rust",
                hasGo && "Go",
                hasPy && "Python",
                isGit && "git",
              ]
                .filter(Boolean)
                .join(", ");
              return output(`Project type: ${kinds || "unknown"}`);
            }
            if (sub === "structure") {
              const { execSync } = await import("child_process");
              try {
                const tree = execSync(
                  "find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' | head -60",
                  { encoding: "utf8", timeout: 5000 }
                );
                return output(tree.trim());
              } catch { return err("Could not scan structure."); }
            }
            if (sub === "config") {
              const { existsSync, readFileSync } = await import("fs");
              if (existsSync("package.json"))
                return output(readFileSync("package.json", "utf8"));
              return err("No project config file found.");
            }
            return err(`Unknown subcommand: ${sub}`);
          },
          complete: async () => ["detect", "structure", "config"],
        },
        {
          path: ["project", "detect"],
          description: "Detect project type",
          usage: "/project detect",
          handler: async (_args, _ctx) => {
            const { existsSync } = await import("fs");
            const types = [
              existsSync("package.json") && "Node.js",
              existsSync("Cargo.toml") && "Rust",
              existsSync("go.mod") && "Go",
              existsSync("pyproject.toml") && "Python",
            ]
              .filter(Boolean)
              .join(", ");
            return output(`Detected: ${types || "unknown"}`);
          },
        },
        {
          path: ["project", "structure"],
          description: "Print directory tree",
          usage: "/project structure",
          handler: async () => {
            const { execSync } = await import("child_process");
            try {
              const out = execSync(
                "find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' | head -80",
                { encoding: "utf8", timeout: 5000 }
              );
              return output(out.trim());
            } catch { return err("Could not scan."); }
          },
        },
        {
          path: ["project", "config"],
          description: "Show the project config file",
          usage: "/project config",
          handler: async () => {
            const { existsSync, readFileSync } = await import("fs");
            if (existsSync("package.json")) return output(readFileSync("package.json", "utf8"));
            if (existsSync("Cargo.toml")) return output(readFileSync("Cargo.toml", "utf8"));
            return err("No config found.");
          },
        },
      ]);
    }
  };
}
