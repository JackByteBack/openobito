import type { GConstructor } from "../types.js";
import { output } from "../types.js";
import type { BaseCLI } from "../base.js";

export function BannerMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["banner"],
          description: "Display the OpenObito startup banner",
          usage: "/banner [--full|--minimal|--art|--help]",
          handler: async (args, _ctx) => {
            const { BannerManager } = await import("../../branding/BannerManager.js");
            const banner = new BannerManager();
            banner.showBanner(args);
            return output("");
          },
          complete: async () => ["--full", "--minimal", "--art", "--help"],
        },
      ]);
    }
  };
}
