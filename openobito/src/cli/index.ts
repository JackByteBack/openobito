#!/usr/bin/env node
import { program } from "commander";
import { BannerManager } from "./branding/BannerManager.js";
import { registerChatCommand } from "./commands/chat.js";
import { registerRunCommand } from "./commands/run.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerConfigCommand } from "./commands/config.js";

async function main(args: string[]) {
  if (!args.includes("--quiet") && !args.includes("--help") && !args.includes("-h")) {
    const banner = new BannerManager({
      style: "full",
      animation: "none",
    });
    banner.display();
  }

  program
    .name("openobito")
    .description("OpenObito \u2014 fully local, open-source CLI AI agent")
    .version(new BannerManager().getVersion(), "-v, --version")
    .hook("preAction", () => {
      process.stdout.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "EPIPE") process.exit(0);
      });
    });

  registerChatCommand(program);
  registerRunCommand(program);
  registerDoctorCommand(program);
  registerConfigCommand(program);

  program
    .command("sessions")
    .description("List recent chat sessions")
    .option("-n, --limit <n>", "Number of sessions to show", "10")
    .action(async (opts) => {
      const { loadConfig } = await import("../config/index.js");
      const { getDb, listSessions } = await import("../storage/index.js");
      const config = loadConfig();
      const db = getDb(config.storage.path);
      const sessions = listSessions(db, Number(opts.limit));
      if (sessions.length === 0) {
        console.log("No sessions found.");
        return;
      }
      for (const s of sessions) {
        const date = new Date(s.updatedAt).toLocaleString();
        console.log(`${s.id.slice(0, 8)}  ${s.title.padEnd(40)}  ${date}`);
      }
    });

  program.parse(process.argv);
}

main(process.argv.slice(2)).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
