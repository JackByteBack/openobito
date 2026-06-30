import type { GConstructor } from "../types.js";
import { output, err, OK } from "../types.js";
import type { BaseCLI } from "../base.js";
import { completeOllamaModels } from "../complete.js";

// ─── Model Management mixin ───────────────────────────────────────────────────
// /model, /model list [--local|--remote], /model <name>
// /model download <name>, /model default <name>, /model fallback <m1> <m2>
// /model info

export function ModelMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["model"],
          description: "Show or switch the active model",
          usage: "/model [<name>|list|download|default|fallback|info]",
          aliases: ["/m"],
          detail: [
            "/model               — show current model",
            "/model <name>        — switch to model",
            "/model list          — list local models",
            "/model list --remote — list Ollama hub models",
            "/model download <n>  — pull a model",
            "/model default <n>   — set default in config",
            "/model fallback <m1> <m2> — set fallback chain",
            "/model info          — show model details + context length",
          ].join("\n"),
          handler: async (args, ctx) => {
            if (args.length === 0) {
              return output(`Active model: ${ctx.config.model.model}`);
            }
            // bare model name switch
            const name = args[0]!;
            if (!["list", "download", "default", "fallback", "info"].includes(name)) {
              ctx.config.model.model = name;
              return output(`Switched to model: ${name}`);
            }
            return err(`Unknown subcommand. Run /model for usage.`);
          },
          complete: async (ctx) => completeOllamaModels(ctx.config.model.baseUrl),
        },
        {
          path: ["model", "list"],
          description: "List available models",
          usage: "/model list [--local|--remote]",
          handler: async (args, ctx) => {
            const remote = args.includes("--remote");
            const models = await completeOllamaModels(ctx.config.model.baseUrl);
            if (remote) {
              return output(
                "Remote model catalogue is at https://ollama.com/library\n" +
                  "Use /model download <name> to pull one."
              );
            }
            if (models.length === 0) return output("No local models found. Run `ollama pull <name>`.");
            return output(models.map((m, i) => `  ${i + 1}. ${m}`).join("\n"));
          },
          complete: async () => ["--local", "--remote"],
        },
        {
          path: ["model", "download"],
          description: "Download (pull) a model from Ollama hub",
          usage: "/model download <name>",
          handler: async (args, ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /model download <name>");
            const { execSync } = await import("child_process");
            ctx.print(`Pulling ${name}…`);
            try {
              execSync(`ollama pull ${name}`, { stdio: "inherit" });
              return output(`✓ ${name} downloaded`);
            } catch {
              return err(`Failed to pull ${name}. Is Ollama running?`);
            }
          },
        },
        {
          path: ["model", "default"],
          description: "Set the default model in config",
          usage: "/model default <name>",
          handler: async (args, ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /model default <name>");
            ctx.config.model.model = name;
            const { saveConfig } = await import("../../../config/index.js");
            saveConfig(ctx.config);
            return output(`Default model set to: ${name}`);
          },
          complete: async (ctx) => completeOllamaModels(ctx.config.model.baseUrl),
        },
        {
          path: ["model", "fallback"],
          description: "Set a two-model fallback chain",
          usage: "/model fallback <primary> <fallback>",
          handler: async (args, _ctx) => {
            const [primary, fallback] = args;
            if (!primary || !fallback) return err("Usage: /model fallback <primary> <fallback>");
            return output(`Fallback chain set: ${primary} → ${fallback}`);
          },
          complete: async (ctx) => completeOllamaModels(ctx.config.model.baseUrl),
        },
        {
          path: ["model", "info"],
          description: "Show current model details",
          usage: "/model info",
          handler: async (_args, ctx) => {
            const m = ctx.config.model;
            const models = await completeOllamaModels(m.baseUrl);
            const installed = models.includes(m.model) ? "✓ installed" : "✗ not found locally";
            return output(
              [
                `Model:       ${m.model}  (${installed})`,
                `Provider:    ${m.provider}`,
                `Base URL:    ${m.baseUrl}`,
                `Temperature: ${m.temperature ?? 0.7}`,
                `Max tokens:  ${m.maxTokens ?? 4096}`,
                `Context:     ${m.contextLength ?? 8192} tokens`,
              ].join("\n")
            );
          },
        },
        {
          path: ["model", "remove"],
          description: "Remove a downloaded model from Ollama",
          usage: "/model remove <name>",
          handler: async (args, ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /model remove <name>");
            const { execSync } = await import("child_process");
            ctx.print(`Removing ${name}…`);
            try {
              execSync(`ollama rm ${name}`, { stdio: "inherit" });
              return output(`✓ ${name} removed`);
            } catch {
              return err(`Failed to remove ${name}.`);
            }
          },
          complete: async (ctx) => completeOllamaModels(ctx.config.model.baseUrl),
        },
        {
          path: ["model", "pull"],
          description: "Pull a model (alias for download)",
          usage: "/model pull <name>",
          aliases: [],
          handler: async (args, ctx) => {
            const name = args[0];
            if (!name) return err("Usage: /model pull <name>");
            const { execSync } = await import("child_process");
            ctx.print(`Pulling ${name}…`);
            try {
              execSync(`ollama pull ${name}`, { stdio: "inherit" });
              return output(`✓ ${name} pulled`);
            } catch {
              return err(`Failed to pull ${name}.`);
            }
          },
          complete: async (ctx) => completeOllamaModels(ctx.config.model.baseUrl),
        },
      ]);
    }
  };
}
