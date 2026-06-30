import { readFileSync, writeFileSync, existsSync, mkdirSync, watchFile, unwatchFile } from "fs";
import { join } from "path";
import { homedir } from "os";
import yaml from "js-yaml";
import {
  InternalConfigSchema,
  ConfigSchema,
  type Config,
  type ValidationResult,
  SCHEMA_KEYS,
} from "./schema.js";

type InternalConfig = Record<string, unknown>;

function configDir(): string {
  const home = homedir();
  switch (process.platform) {
    case "win32":
      return join(process.env.LOCALAPPDATA || home, "openagent");
    case "darwin":
      return join(home, "Library", "Application Support", "openagent");
    case "linux":
      return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "openagent");
    default:
      return join(home, ".openagent");
  }
}

function configFile(): string {
  return join(configDir(), "config.yaml");
}

function deepSet(obj: Record<string, unknown>, pathParts: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i]!;
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[pathParts[pathParts.length - 1]!] = value;
}

function deepGet(obj: Record<string, unknown>, pathParts: string[]): unknown {
  let current: unknown = obj;
  for (const key of pathParts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export class ConfigManager {
  private _internal: InternalConfig;
  private _config: Config;
  private _configDir: string;
  private _configFile: string;
  private _watchers: Array<(config: Config) => void> = [];
  private _watching = false;

  constructor() {
    this._configDir = configDir();
    this._configFile = configFile();
    this._internal = {};
    this._config = this._read();
  }

  load(): Config {
    this._config = this._read();
    return this._config;
  }

  save(): void {
    this._ensureDir();
    const raw = yaml.dump(this._internal, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: true,
    });
    writeFileSync(this._configFile, raw, "utf8");
  }

  saveWithConfig(config: Config): void {
    this._config = config;
    this._ensureDir();
    const raw = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: true,
    });
    writeFileSync(this._configFile, raw, "utf8");
  }

  get<K extends keyof Config>(key: K): Config[K];
  get(keyPath: string): unknown;
  get(keyOrPath: string | keyof Config): unknown {
    if (!keyOrPath.includes(".")) {
      return (this._config as Record<string, unknown>)[keyOrPath];
    }
    return deepGet(this._config as unknown as Record<string, unknown>, keyOrPath.split("."));
  }

  set(keyPath: string, value: unknown): string | null {
    const parts = keyPath.split(".");
    const updated = { ...this._internal } as Record<string, unknown>;
    deepSet(updated, parts, value);

    const parsed = InternalConfigSchema.safeParse(updated);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      if (first) {
        return `Validation error at "${first.path.join(".")}": ${first.message}`;
      }
      return "Validation failed";
    }

    this._internal = parsed.data as unknown as InternalConfig;
    this._config = ConfigSchema.parse(this._internal);
    this._enforceInvariants();
    this.save();
    this._notify();
    return null;
  }

  reset(): Config {
    this._internal = {};
    this._config = this._read();
    this.save();
    this._notify();
    return this._config;
  }

  validate(): ValidationResult[] {
    const raw = this._readRaw();
    if (raw === null) return [];

    const results: ValidationResult[] = [];
    let parsed: unknown;
    try {
      parsed = yaml.load(raw);
    } catch (err) {
      results.push({
        path: "file",
        message: `Invalid YAML syntax: ${err instanceof Error ? err.message : String(err)}`,
        fix: "Use a YAML validator or check for syntax errors",
      });
      return results;
    }

    const check = InternalConfigSchema.safeParse(parsed ?? {});
    if (check.success) return results;

    for (const issue of check.error.errors) {
      const path = issue.path.join(".");
      let fix: string | undefined;
      const schemaType = SCHEMA_KEYS[path];
      if (schemaType) {
        fix = `Expected type: ${schemaType}`;
      } else {
        fix = `Check the "${path}" field`;
      }
      results.push({ path, message: issue.message, fix });
    }

    return results;
  }

  onChange(fn: (config: Config) => void): void {
    this._watchers.push(fn);
    if (!this._watching) {
      this._watching = true;
      watchFile(this._configFile, { interval: 2000 }, () => {
        this.load();
        this._notify();
      });
    }
  }

  disconnect(): void {
    this._watchers = [];
    if (this._watching) {
      unwatchFile(this._configFile);
      this._watching = false;
    }
  }

  configPath(): string {
    return this._configFile;
  }

  configDir(): string {
    return this._configDir;
  }

  toObject(): Config {
    return { ...this._config };
  }

  private _read(): Config {
    this._ensureDir();
    const raw = this._readRaw();
    if (raw === null) {
      return this._initDefaults();
    }

    try {
      const parsed = yaml.load(raw) ?? {};
      this._internal = InternalConfigSchema.parse(parsed) as unknown as InternalConfig;
    } catch {
      this._internal = InternalConfigSchema.parse({}) as unknown as InternalConfig;
    }

    this._patchDefaults();
    this._config = ConfigSchema.parse(this._internal);
    this._enforceInvariants();
    return this._config;
  }

  private _initDefaults(): Config {
    this._internal = InternalConfigSchema.parse({}) as unknown as InternalConfig;
    this._patchDefaults();
    this._config = ConfigSchema.parse(this._internal);
    this._enforceInvariants();
    writeFileSync(
      this._configFile,
      yaml.dump(this._internal, { indent: 2, lineWidth: 120, noRefs: true, sortKeys: true }),
      "utf8",
    );
    return this._config;
  }

  private _patchDefaults(): void {
    const internal = this._internal as Record<string, unknown>;
    if (!internal["storage"] || typeof internal["storage"] !== "object") {
      internal["storage"] = {};
    }
    const storage = internal["storage"] as Record<string, unknown>;
    if (!storage["path"] || typeof storage["path"] !== "string" || !(storage["path"] as string).length) {
      storage["path"] = this._configFile.replace(/\.yaml$/, ".db");
    }
  }

  private _readRaw(): string | null {
    if (!existsSync(this._configFile)) return null;
    try {
      return readFileSync(this._configFile, "utf8");
    } catch {
      return null;
    }
  }

  private _ensureDir(): void {
    if (!existsSync(this._configDir)) {
      mkdirSync(this._configDir, { recursive: true });
    }
  }

  private _enforceInvariants(): void {
    (this._config as { app: { telemetry: false } }).app.telemetry = false;
  }

  private _notify(): void {
    for (const fn of this._watchers) {
      try {
        fn(this._config);
      } catch {
        // ignore watcher errors
      }
    }
  }
}

export function createConfigManager(): ConfigManager {
  return new ConfigManager();
}
