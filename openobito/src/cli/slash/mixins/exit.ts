import type { GConstructor } from "../types.js";
import { output } from "../types.js";
import type { BaseCLI } from "../base.js";

export function ExitMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["exit"],
          description: "Exit OpenAgent",
          usage: "/exit",
          aliases: ["/quit", "/q"],
          handler: async () => {
            process.stdout.write("\n");
            process.exit(0);
          },
        },
        {
          path: ["quit"],
          description: "Exit OpenAgent (alias for /exit)",
          usage: "/quit",
          handler: async () => {
            process.stdout.write("\n");
            process.exit(0);
          },
        },
      ]);
    }
  };
}
