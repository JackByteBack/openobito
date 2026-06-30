import { existsSync, readdirSync, readFileSync, statSync, watch } from "fs";
import { join, resolve, basename } from "path";
import type { SkillInfo, SkillFrontmatter, SkillSource } from "./types.js";

// ─── YAML front-matter parser (no deps) ──────────────────────────────────────
// Parses the --- delimited YAML block at the top of SKILL.md.
// Only handles the subset we actually use: strings, string arrays, booleans.

function parseFrontmatter(raw: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {} as SkillFrontmatter, body: raw };

  const yamlBlock = match[1] ?? "";
  const body = match[2] ?? "";
  const fm: Record<string, unknown> = {};

  let currentKey: string | null = null;
  let inArray = false;
  let arrayBuffer: string[] = [];

  for (const line of yamlBlock.split(/\r?\n/)) {
    // Array item
    if (inArray && /^\s+-\s+/.test(line)) {
      arrayBuffer.push(line.replace(/^\s+-\s+/, "").replace(/^['"]|['"]$/g, "").trim());
      continue;
    }
    // End of array
    if (inArray && !/^\s+-\s+/.test(line) && line.trim() !== "") {
      if (currentKey) fm[currentKey] = arrayBuffer;
      inArray = false;
      arrayBuffer = [];
    }

    // key: value
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kvMatch) continue;

    currentKey = kvMatch[1] ?? "";
    const raw = (kvMatch[2] ?? "").trim();

    if (raw === "" || raw === "|" || raw === ">") {
      // Will be populated by following lines — skip for now
      continue;
    }
    if (raw === "[") {
      inArray = true;
      arrayBuffer = [];
      continue;
    }
    // Inline array [a, b, c]
    if (raw.startsWith("[") && raw.endsWith("]")) {
      fm[currentKey] = raw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      continue;
    }
    // Boolean
    if (raw === "true") { fm[currentKey] = true; continue; }
    if (raw === "false") { fm[currentKey] = false; continue; }
    // String (strip quotes)
    fm[currentKey] = raw.replace(/^['"]|['"]$/g, "");
  }

  // Flush trailing array
  if (inArray && currentKey) fm[currentKey] = arrayBuffer;

  // Handle nested metadata block (simple: only one level deep)
  // metadata: key: value lines become metadata.key = value
  const metaMatch = yamlBlock.match(/^metadata:\s*$([\s\S]*?)(?=^\w|\z)/m);
  if (metaMatch) {
    const meta: Record<string, unknown> = {};
    for (const line of (metaMatch[1] ?? "").split(/\r?\n/)) {
      const inner = line.match(/^\s+(\w[\w-]*):\s*(.*)$/);
      if (!inner) continue;
      const k = inner[1] ?? "";
      const v = (inner[2] ?? "").trim();
      if (v.startsWith("[")) {
        meta[k] = v
          .slice(1, v.endsWith("]") ? -1 : v.length)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      } else {
        meta[k] = v.replace(/^['"]|['"]$/g, "");
      }
    }
    fm["metadata"] = meta;
  }

  return { frontmatter: fm as unknown as SkillFrontmatter, body };
}

// ─── Skill loader ─────────────────────────────────────────────────────────────

export class SkillLoader {
  private watchers: Map<string, ReturnType<typeof watch>> = new Map();

  /**
   * Discover all skills under the given root directories.
   * Each directory is searched for subdirs containing a SKILL.md.
   * Search priority: builtin → installed → custom → user-generated.
   */
  discover(dirs: string[]): SkillInfo[] {
    const skills: SkillInfo[] = [];
    const seen = new Set<string>(); // avoid duplicate names (first wins)

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;

      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }

      for (const entry of entries) {
        const skillDir = join(dir, entry);
        try {
          if (!statSync(skillDir).isDirectory()) continue;
        } catch {
          continue;
        }

        const skillMdPath = join(skillDir, "SKILL.md");
        if (!existsSync(skillMdPath)) continue;

        try {
          const skill = this.load(skillDir);
          if (seen.has(skill.name)) continue;
          seen.add(skill.name);
          skills.push(skill);
        } catch {
          // skip malformed skill dirs silently
        }
      }
    }

    return skills;
  }

  /**
   * Load a single skill from its directory.
   * Reads SKILL.md (required) and DESCRIPTION.md (optional).
   */
  load(skillDirPath: string): SkillInfo {
    const absPath = resolve(skillDirPath);
    const skillMdPath = join(absPath, "SKILL.md");

    if (!existsSync(skillMdPath)) {
      throw new Error(`No SKILL.md found at: ${absPath}`);
    }

    const rawContent = readFileSync(skillMdPath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(rawContent);

    // Fallback name from directory name when frontmatter omits it
    const name = frontmatter.name ?? basename(absPath);
    const description = frontmatter.description ?? this.extractDescription(body);

    // Read optional DESCRIPTION.md for a richer human-readable description
    const descMdPath = join(absPath, "DESCRIPTION.md");
    let humanDescription = description;
    if (existsSync(descMdPath)) {
      const raw = readFileSync(descMdPath, "utf-8");
      const { frontmatter: descFm } = parseFrontmatter(raw);
      if (descFm.description) humanDescription = descFm.description as string;
    }

    const source: SkillSource = { type: "directory", path: absPath };

    return {
      name,
      description: humanDescription || description,
      version: (frontmatter.version as string) ?? "1.0.0",
      author: (frontmatter.author as string) ?? "Unknown",
      source,
      location: absPath,
      content: rawContent,
      frontmatter,
      tags: (frontmatter.metadata?.tags as string[]) ?? [],
      relatedSkills: (frontmatter.metadata?.related_skills as string[]) ?? [],
      slash: true, // all directory skills are /skills use accessible
      usageCount: 0,
      lastUsed: undefined as unknown as Date | undefined,
      rating: undefined,
      autoImproving: false,
    };
  }

  /**
   * Re-discover skills from a directory list. Useful after creating / editing skills.
   */
  reload(dirs: string[]): SkillInfo[] {
    return this.discover(dirs);
  }

  /**
   * Watch skill directories for changes and call onChange when any SKILL.md is modified.
   * Debounced to avoid multiple fires on a single save.
   */
  watch(dirs: string[], onChange: (changedDir: string) => void): void {
    for (const dir of dirs) {
      if (!existsSync(dir) || this.watchers.has(dir)) continue;

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const watcher = watch(dir, { recursive: true }, (_event, filename) => {
        if (!filename?.endsWith("SKILL.md") && !filename?.endsWith("DESCRIPTION.md")) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => onChange(dir), 150);
      });
      this.watchers.set(dir, watcher);
    }
  }

  /** Stop all file watchers. */
  unwatch(): void {
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private extractDescription(body: string): string {
    // Try to grab the first non-empty line after a "## Description" heading
    const match = body.match(/##\s+Description\s*\n+([^\n#]+)/);
    if (match) return match[1]?.trim() ?? "";
    // Else return the first non-heading, non-empty line
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (t && !t.startsWith("#")) return t;
    }
    return "";
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const globalLoader = new SkillLoader();
