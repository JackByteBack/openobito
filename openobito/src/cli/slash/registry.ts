import type { SlashCommand, CommandContext, CommandResult, CompletionContext } from "./types.js";
import { err, output } from "./types.js";

// ─── Command registry ─────────────────────────────────────────────────────────

export class CommandRegistry {
  private commands = new Map<string, SlashCommand>();
  private aliasMap = new Map<string, string>(); // alias key → canonical key

  // ── Registration ────────────────────────────────────────────────────────────

  register(cmd: SlashCommand): void {
    const key = cmd.path.join(" ");
    this.commands.set(key, cmd);
    for (const alias of cmd.aliases ?? []) {
      const clean = alias.replace(/^\//, "");
      this.aliasMap.set(clean, key);
    }
  }

  registerAll(commands: SlashCommand[]): void {
    for (const cmd of commands) this.register(cmd);
  }

  // ── Lookup ───────────────────────────────────────────────────────────────────

  private resolve(tokens: string[]): SlashCommand | null {
    // Try longest-prefix match first (e.g. ["model","list"] before ["model"]).
    for (let len = tokens.length; len >= 1; len--) {
      const key = tokens.slice(0, len).join(" ");
      const cmd = this.commands.get(key) ?? this.commands.get(this.aliasMap.get(key) ?? "");
      if (cmd) return cmd;
    }
    return null;
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────

  async dispatch(input: string, ctx: CommandContext): Promise<CommandResult> {
    const trimmed = input.startsWith("/") ? input.slice(1).trim() : input.trim();
    if (!trimmed) return err("Empty command. Type /help for a list.");

    const tokens = tokenize(trimmed);
    const cmd = this.resolve(tokens);

    if (!cmd) {
      const suggestion = this.suggest(tokens[0] ?? "");
      const hint = suggestion ? `  Did you mean /${suggestion}?` : "";
      return err(`Unknown command: /${tokens[0] ?? ""}${hint}`);
    }

    const consumed = cmd.path.length;
    const args = tokens.slice(consumed);

    try {
      return await cmd.handler(args, ctx);
    } catch (e) {
      return err(`/${cmd.path.join(" ")} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────────

  async complete(line: string, ctx: CompletionContext): Promise<string[]> {
    const bare = line.startsWith("/") ? line.slice(1) : line;
    const tokens = tokenize(bare);

    if (tokens.length === 0) return this.allTopLevel();

    // If the last char is a space the user is starting a new argument.
    const inArg = line.endsWith(" ");
    const lookup = inArg ? tokens : tokens.slice(0, -1);
    const partial = inArg ? "" : (tokens[tokens.length - 1] ?? "");

    const cmd = lookup.length > 0 ? this.resolve(lookup) : null;

    // Delegate to per-command completer when we have a full path match.
    if (cmd?.complete) {
      const argCandidates = await cmd.complete({ ...ctx, tokens, line });
      return argCandidates
        .filter((c) => c.startsWith(partial))
        .map((c) => `/${cmd.path.join(" ")} ${c}`.trim());
    }

    // Otherwise complete the path itself.
    const prefix = lookup.join(" ");
    const candidates: string[] = [];
    for (const [key] of this.commands) {
      if (key.startsWith(prefix ? prefix + " " : "") || key === prefix) {
        const next = key.slice(prefix ? prefix.length + 1 : 0).split(" ")[0];
        if (next) candidates.push(next);
      }
    }
    const unique = [...new Set(candidates)].filter((c) => c.startsWith(partial));

    const scope = lookup.length > 0 ? "/" + lookup.join(" ") + " " : "/";
    return unique.map((c) => scope + c);
  }

  // ── Help ──────────────────────────────────────────────────────────────────────

  helpFor(path: string[]): string | null {
    const cmd = this.resolve(path);
    if (!cmd) return null;
    const aliasLine =
      cmd.aliases && cmd.aliases.length > 0 ? `\nAliases: ${cmd.aliases.join(", ")}` : "";
    return (
      `Usage: ${cmd.usage}\n${cmd.description}` +
      (cmd.detail ? `\n\n${cmd.detail}` : "") +
      aliasLine
    );
  }

  listAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  listByCategory(prefix: string): SlashCommand[] {
    return Array.from(this.commands.values()).filter((c) => c.path[0] === prefix);
  }

  // ── Fuzzy suggestion (Levenshtein on top-level tokens) ───────────────────────

  suggest(partial: string): string | null {
    const topLevel = this.allTopLevel();
    let best: string | null = null;
    let bestDist = Infinity;
    for (const c of topLevel) {
      const d = levenshtein(partial, c);
      if (d < bestDist && d <= 2) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private allTopLevel(): string[] {
    const seen = new Set<string>();
    for (const [key] of this.commands) seen.add(key.split(" ")[0]!);
    for (const [alias] of this.aliasMap) seen.add(alias.split(" ")[0]!);
    return [...seen].sort();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

export const globalRegistry = new CommandRegistry();
