import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import type { PluginInstance, PluginManifest, PluginTool } from "./types.js";

const PLUGINS_DIR = resolve(homedir(), ".openagent", "plugins");

export class PluginRegistry {
  private plugins = new Map<string, PluginInstance>();

  constructor() {
    this.scanInstalled();
  }

  private scanInstalled(): void {
    if (!existsSync(PLUGINS_DIR)) return;
    for (const dir of readdirSync(PLUGINS_DIR)) {
      const manifestPath = join(PLUGINS_DIR, dir, "plugin.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        this.plugins.set(manifest.name, {
          manifest,
          dir: join(PLUGINS_DIR, dir),
          enabled: true,
          tools: [],
          installedAt: Date.now(),
        });
      } catch {
        continue;
      }
    }
  }

  list(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  get(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  install(name: string, sourceUrl?: string): PluginInstance {
    const dir = join(PLUGINS_DIR, name);
    if (existsSync(dir)) throw new Error(`Plugin "${name}" is already installed.`);

    mkdirSync(dir, { recursive: true });

    const manifest: PluginManifest = {
      name,
      version: sourceUrl ? "0.1.0" : "0.1.0",
      description: `Plugin: ${name}`,
      author: "unknown",
      license: "MIT",
      risk: "medium",
      tools: [],
      hooks: [],
      entry: `index.js`,
    };

    const meta: PluginInstance = {
      manifest,
      dir,
      enabled: true,
      tools: [],
      installedAt: Date.now(),
    };

    writeFileSync(join(dir, "plugin.json"), JSON.stringify(manifest, null, 2));
    writeFileSync(join(dir, "index.js"), `// ${name} plugin — add your tool implementations here.\n`);
    this.plugins.set(name, meta);
    return meta;
  }

  uninstall(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    rmSync(plugin.dir, { recursive: true, force: true });
    this.plugins.delete(name);
    return true;
  }

  enable(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) plugin.enabled = true;
  }

  disable(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) plugin.enabled = false;
  }

  loadTools(): PluginTool[] {
    const all: PluginTool[] = [];
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;
      const entryPath = join(plugin.dir, plugin.manifest.entry);
      if (!existsSync(entryPath)) continue;
      try {
        delete require.cache[require.resolve(entryPath)];
        const mod = require(entryPath);
        if (mod.tools && Array.isArray(mod.tools)) {
          plugin.tools = mod.tools;
          all.push(...mod.tools);
        }
      } catch {
        continue;
      }
    }
    return all;
  }
}

export const globalPluginRegistry = new PluginRegistry();
