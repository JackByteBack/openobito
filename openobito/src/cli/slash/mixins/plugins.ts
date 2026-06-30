import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

export function PluginsMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["plugins"],
          description: "List, install, and manage plugins",
          usage: "/plugins [list|install|info|uninstall|enable|disable]",
          handler: async (args, _ctx) => {
            const sub = args[0] ?? "list";
            const { PluginRegistry } = await import("../../../plugins/index.js");
            const registry = new PluginRegistry();
            if (sub === "list") {
              const plugins = registry.list();
              if (!plugins.length) return output("No plugins installed. Use /plugins install <name>.");
              return output(
                plugins.map((p) =>
                  `  ${p.enabled ? "✓" : "⏸"} ${p.manifest.name.padEnd(20)} v${p.manifest.version}  ${p.manifest.risk.padEnd(6)}  ${p.manifest.description}`
                ).join("\n")
              );
            }
            if (sub === "install") {
              const name = args[1];
              if (!name) return err("Usage: /plugins install <name>");
              try {
                const plugin = registry.install(name);
                return output(`Installed plugin: ${plugin.manifest.name} v${plugin.manifest.version}`);
              } catch (e) { return err(String(e)); }
            }
            if (sub === "uninstall") {
              const name = args[1];
              if (!name) return err("Usage: /plugins uninstall <name>");
              registry.uninstall(name);
              return output(`Uninstalled: ${name}`);
            }
            if (sub === "info") {
              const name = args[1];
              if (!name) return err("Usage: /plugins info <name>");
              const plugin = registry.get(name);
              if (!plugin) return err(`Plugin not found: ${name}`);
              return output(
                `${plugin.manifest.name} v${plugin.manifest.version}\n` +
                `Author: ${plugin.manifest.author}\n` +
                `Risk:   ${plugin.manifest.risk}\n` +
                `Hooks:  ${plugin.manifest.hooks.join(", ") || "none"}\n` +
                `Tools:  ${plugin.tools.length} loaded\n` +
                `Dir:    ${plugin.dir}`
              );
            }
            if (sub === "enable") {
              const name = args[1];
              if (!name) return err("Usage: /plugins enable <name>");
              const { globalPluginRegistry } = await import("../../../plugins/index.js");
              globalPluginRegistry.enable(name);
              return output(`Enabled: ${name}`);
            }
            if (sub === "disable") {
              const name = args[1];
              if (!name) return err("Usage: /plugins disable <name>");
              const { globalPluginRegistry } = await import("../../../plugins/index.js");
              globalPluginRegistry.disable(name);
              return output(`Disabled: ${name}`);
            }
            return err("Usage: /plugins [list|install|info|uninstall|enable|disable]");
          },
          complete: async () => ["list", "install", "info", "uninstall", "enable", "disable"],
        },
        {
          path: ["plugins", "list"],
          description: "List installed plugins",
          usage: "/plugins list",
          handler: async () => {
            const { PluginRegistry } = await import("../../../plugins/index.js");
            const plugins = new PluginRegistry().list();
            if (!plugins.length) return output("No plugins installed.");
            return output(plugins.map((p) =>
              `  ${p.enabled ? "✓" : "⏸"} ${p.manifest.name.padEnd(20)} v${p.manifest.version}`
            ).join("\n"));
          },
        },
        {
          path: ["plugins", "install"],
          description: "Install a plugin",
          usage: "/plugins install <name>",
          handler: async (args) => {
            const name = args[0];
            if (!name) return err("Usage: /plugins install <name>");
            const { PluginRegistry } = await import("../../../plugins/index.js");
            try {
              const plugin = new PluginRegistry().install(name);
              return output(`Installed: ${plugin.manifest.name} v${plugin.manifest.version}`);
            } catch (e) { return err(String(e)); }
          },
        },
        {
          path: ["plugins", "uninstall"],
          description: "Uninstall a plugin",
          usage: "/plugins uninstall <name>",
          handler: async (args) => {
            const name = args[0];
            if (!name) return err("Usage: /plugins uninstall <name>");
            const { PluginRegistry } = await import("../../../plugins/index.js");
            new PluginRegistry().uninstall(name);
            return output(`Uninstalled: ${name}`);
          },
        },
        {
          path: ["plugins", "info"],
          description: "Show plugin details",
          usage: "/plugins info <name>",
          handler: async (args) => {
            const name = args[0];
            if (!name) return err("Usage: /plugins info <name>");
            const { PluginRegistry } = await import("../../../plugins/index.js");
            const plugin = new PluginRegistry().get(name);
            if (!plugin) return err(`Plugin not found: ${name}`);
            return output(`${plugin.manifest.name} v${plugin.manifest.version}\nRisk: ${plugin.manifest.risk}\nTools: ${plugin.tools.length}`);
          },
        },
        {
          path: ["plugins", "enable"],
          description: "Enable a plugin",
          usage: "/plugins enable <name>",
          handler: async (args) => {
            const name = args[0];
            if (!name) return err("Usage: /plugins enable <name>");
            const { globalPluginRegistry } = await import("../../../plugins/index.js");
            globalPluginRegistry.enable(name);
            return output(`Enabled: ${name}`);
          },
        },
        {
          path: ["plugins", "disable"],
          description: "Disable a plugin",
          usage: "/plugins disable <name>",
          handler: async (args) => {
            const name = args[0];
            if (!name) return err("Usage: /plugins disable <name>");
            const { globalPluginRegistry } = await import("../../../plugins/index.js");
            globalPluginRegistry.disable(name);
            return output(`Disabled: ${name}`);
          },
        },
      ]);
    }
  };
}
