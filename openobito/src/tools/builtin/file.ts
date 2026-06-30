import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "fs";
import { resolve, join } from "path";
import type { RegisteredTool } from "../registry.js";

export const readFileTool: RegisteredTool = {
  schema: {
    name: "read_file",
    description: "Read the contents of a file at the given path.",
    parameters: {
      path: { type: "string", description: "Absolute or relative file path", required: true },
    },
  },
  async handler({ path }) {
    const resolved = resolve(String(path));
    if (!existsSync(resolved)) return `File not found: ${resolved}`;
    const stat = statSync(resolved);
    if (stat.size > 1_000_000) return `File too large (${stat.size} bytes). Max 1 MB.`;
    return readFileSync(resolved, "utf8");
  },
};

export const writeFileTool: RegisteredTool = {
  schema: {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist.",
    parameters: {
      path: { type: "string", description: "File path to write", required: true },
      content: { type: "string", description: "Content to write", required: true },
    },
  },
  async handler({ path, content }) {
    const resolved = resolve(String(path));
    writeFileSync(resolved, String(content), "utf8");
    return `Written ${String(content).length} bytes to ${resolved}`;
  },
};

export const listDirectoryTool: RegisteredTool = {
  schema: {
    name: "list_directory",
    description: "List files and directories at the given path.",
    parameters: {
      path: { type: "string", description: "Directory path", required: true },
      recursive: { type: "boolean", description: "List recursively (max 2 levels)", required: false },
    },
  },
  async handler({ path, recursive = false }) {
    const resolved = resolve(String(path));
    if (!existsSync(resolved)) return `Directory not found: ${resolved}`;

    function listDir(dir: string, depth = 0): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      const lines: string[] = [];
      for (const e of entries) {
        const prefix = "  ".repeat(depth);
        const name = e.isDirectory() ? `${e.name}/` : e.name;
        lines.push(`${prefix}${name}`);
        if (recursive && e.isDirectory() && depth < 2) {
          lines.push(...listDir(join(dir, e.name), depth + 1));
        }
      }
      return lines;
    }

    return listDir(resolved).join("\n");
  },
};
