// ─── OpenAgentCLI: all mixins composed (Hermes CLICommandsMixin pattern) ──────
// Each mixin is a function TBase → class extends TBase; applyMixins stacks them.
// No mixin imports this file → no circular deps.

import { BaseCLI, applyMixins } from "./base.js";
import { globalRegistry } from "./registry.js";

import { ModelMixin } from "./mixins/model.js";
import { SessionMixin } from "./mixins/session.js";
import { SkillsMixin } from "./mixins/skills.js";
import { AgentMixin } from "./mixins/agent.js";
import { ConfigMixin } from "./mixins/config.js";
import { PersonalityMixin } from "./mixins/personality.js";
import { MemoryMixin } from "./mixins/memory.js";
import { UsageMixin } from "./mixins/usage.js";
import { ToolsMixin } from "./mixins/tools.js";
import { GitMixin } from "./mixins/git.js";
import { FileMixin } from "./mixins/file.js";
import { IntegrationsMixin } from "./mixins/integrations.js";
import { HelpMixin } from "./mixins/help.js";
import { HealthMixin } from "./mixins/health.js";
import { DebugMixin } from "./mixins/debug.js";
import { MessagesMixin } from "./mixins/messages.js";
import { RollbackMixin } from "./mixins/rollback.js";
import { SafetyMixin } from "./mixins/safety.js";
import { CronMixin } from "./mixins/cron.js";
import { ExitMixin } from "./mixins/exit.js";
import { HistoryMixin } from "./mixins/history.js";
import { BackupMixin } from "./mixins/backup.js";
import { PluginsMixin } from "./mixins/plugins.js";
import { BannerMixin } from "./mixins/banner.js";

const OpenAgentCLI = applyMixins(BaseCLI, [
  ModelMixin,
  SessionMixin,
  SkillsMixin,
  AgentMixin,
  ConfigMixin,
  PersonalityMixin,
  MemoryMixin,
  UsageMixin,
  ToolsMixin,
  GitMixin,
  FileMixin,
  IntegrationsMixin,
  SafetyMixin,
  CronMixin,
  HistoryMixin,
  BackupMixin,
  PluginsMixin,
  BannerMixin,
  // Help last so it can introspect all registered commands.
  HelpMixin,
  HealthMixin,
  DebugMixin,
  MessagesMixin,
  RollbackMixin,
  ExitMixin,
]);

/** Instantiate once — constructors register all commands into globalRegistry. */
export const cli = new OpenAgentCLI(globalRegistry);

// Re-export the registry and dispatch surface for callers.
export { globalRegistry } from "./registry.js";
export type { CommandContext, CommandResult, SlashCommand, CompletionContext } from "./types.js";

// ─── Short aliases (global, registered after all commands exist) ──────────────
// /h → /help  /m → /model  /s → /skills  /n → /new  /ss → /sessions
// /?? → /help  /mem → /memory  /ctx → /context  /git st → /git status

const ALIASES: Record<string, string> = {
  "h": "help",
  "m": "model",
  "s": "skills",
  "n": "new",
  "ss": "sessions",
  "??": "help",
  "mem": "memory",
  "ctx": "context",
  "git st": "git status",
};

for (const [alias, target] of Object.entries(ALIASES)) {
  // Register as a passthrough command.
  globalRegistry.register({
    path: [alias],
    description: `Alias for /${target}`,
    usage: `/${alias} → /${target}`,
    aliases: [`/${alias}`],
    handler: async (args, ctx) =>
      globalRegistry.dispatch(`/${target}${args.length ? " " + args.join(" ") : ""}`, ctx),
    complete: async (ctx) => globalRegistry.complete(`/${target} `, ctx),
  });
}

/** All slash-command paths for use in TUI autocomplete. */
export function allCommandPaths(): string[] {
  return globalRegistry
    .listAll()
    .map((c) => "/" + c.path.join(" "))
    .sort();
}
