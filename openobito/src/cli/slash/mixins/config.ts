import type { GConstructor } from "../types.js";
import { output, err, OK } from "../types.js";
import type { BaseCLI } from "../base.js";
import { CONFIG_KEYS, CONFIG_VALUES } from "../complete.js";

// ─── Configuration mixin ───────────────────────────────────────────────────────
// /config /config show /config edit /config reset
// /config set <key> <value>, /config get <key>

function getNestedKey(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((cur, k) => {
    if (cur && typeof cur === "object") return (cur as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

function setNestedKey(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown
): void {
  const parts = dotPath.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

export function ConfigMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["config"],
          description: "Show configuration summary",
          usage: "/config [show|edit|reset|set|get]",
          handler: async (_args, ctx) => {
            const c = ctx.config;
            return output(
              [
                `Config: ${ctx.configPath}`,
                `  model          ${c.model.model}  (${c.model.provider})`,
                `  baseUrl        ${c.model.baseUrl}`,
                `  temperature    ${c.model.temperature ?? 0.7}`,
                `  defaultPolicy  ${c.permissions.defaultAction}`,
                `  theme          ${c.ui.theme}`,
                `  maxSessions    ${c.storage.maxSessions}`,
              ].join("\n")
            );
          },
        },
        {
          path: ["config", "show"],
          description: "Print the full config as YAML",
          usage: "/config show",
          handler: async (_args, ctx) => {
            const yaml = await import("js-yaml");
            return output(yaml.default.dump(ctx.config));
          },
        },
        {
          path: ["config", "edit"],
          description: "Open the config file in $EDITOR",
          usage: "/config edit",
          handler: async (_args, ctx) => {
            const { execSync } = await import("child_process");
            const editor = process.env["EDITOR"] ?? "nano";
            try {
              execSync(`${editor} "${ctx.configPath}"`, { stdio: "inherit" });
              return output("Config saved. Restart openagent to apply changes.");
            } catch {
              return err(`Could not open editor: ${editor}`);
            }
          },
        },
        {
          path: ["config", "reset"],
          description: "Reset config to defaults",
          usage: "/config reset",
          handler: async (_args, ctx) => {
            const { getConfigManager } = await import(
              "../../../config/index.js"
            );
            getConfigManager().reset();
            return output("Config reset to defaults.");
          },
        },
        {
          path: ["config", "set"],
          description: "Set a config value by dot-path key",
          usage: "/config set <key> <value>",
          detail: "Keys: " + CONFIG_KEYS.join(", "),
          handler: async (args, ctx) => {
            const [key, ...rest] = args;
            const value = rest.join(" ");
            if (!key || !value) return err("Usage: /config set <key> <value>");
            if (!(CONFIG_KEYS as readonly string[]).includes(key))
              return err(`Unknown key: ${key}\nValid keys: ${CONFIG_KEYS.join(", ")}`);

            const parsed: unknown =
              value === "true"
                ? true
                : value === "false"
                  ? false
                  : /^\d+(\.\d+)?$/.test(value)
                    ? parseFloat(value)
                    : value;

            setNestedKey(ctx.config as unknown as Record<string, unknown>, key, parsed);
            const { saveConfig } = await import("../../../config/index.js");
            saveConfig(ctx.config);
            return output(`Set ${key} = ${JSON.stringify(parsed)}`);
          },
          complete: async (ctx) => {
            const tokens = ctx.tokens;
            // tokens[0]=config tokens[1]=set tokens[2]=key? tokens[3]=value?
            if (tokens.length <= 2) return [...CONFIG_KEYS];
            const key = tokens[2];
            if (key && tokens.length === 3) return [...CONFIG_KEYS];
            if (key) return CONFIG_VALUES[key] ?? [];
            return [];
          },
        },
        {
          path: ["config", "get"],
          description: "Get a config value by dot-path key",
          usage: "/config get <key>",
          handler: async (args, ctx) => {
            const key = args[0];
            if (!key) return err("Usage: /config get <key>");
            const val = getNestedKey(
              ctx.config as unknown as Record<string, unknown>,
              key
            );
            return val !== undefined
              ? output(`${key} = ${JSON.stringify(val)}`)
              : err(`Key not found: ${key}`);
          },
          complete: async () => [...CONFIG_KEYS],
        },
      ]);
    }
  };
}
