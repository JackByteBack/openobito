import type { GConstructor, SlashCommand } from "./types.js";
import type { CommandRegistry } from "./registry.js";

// ─── BaseCLI ──────────────────────────────────────────────────────────────────
// Every mixin extends this. Holds a reference to the registry so mixins can
// call this.register() without importing the global singleton directly
// (prevents circular dep issues in large mixin stacks).

export class BaseCLI {
  constructor(public readonly registry: CommandRegistry) {}

  public register(cmd: SlashCommand): void {
    this.registry.register(cmd);
  }

  public registerMany(cmds: SlashCommand[]): void {
    this.registry.registerAll(cmds);
  }
}

// ─── Mixin applier ────────────────────────────────────────────────────────────
// Compose an array of mixin factories into a single class.

type MixinFactory = (Base: GConstructor<BaseCLI>) => GConstructor<BaseCLI>;

export function applyMixins(
  Base: GConstructor<BaseCLI>,
  mixins: MixinFactory[]
): GConstructor<BaseCLI> {
  return mixins.reduce((Acc, mixin) => mixin(Acc), Base);
}
