import type { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../../config/index.js";
import { getDb } from "../../storage/index.js";
import { FallbackChain } from "../../model/index.js";
import { createDefaultRegistry } from "../../tools/index.js";
import { PolicyEngine } from "../../permissions/index.js";
import { SessionManager, runAgentLoop } from "../../agent/index.js";
import { theme } from "../../tui/theme.js";
import type { Message } from "../../types/index.js";

export function registerRunCommand(program: Command): void {
  program
    .command("run <task>")
    .description("Run a one-shot task without entering interactive mode")
    .option("-m, --model <model>", "Override model name")
    .option("--json", "Output result as JSON")
    .action(async (task: string, opts) => {
      const config = loadConfig();
      if (opts.model) config.model.model = opts.model as string;

      const db = getDb(config.storage.path);
      const model = new FallbackChain(config.model);
      const tools = createDefaultRegistry();
      const policy = new PolicyEngine(config.permissions);
      const sessionMgr = new SessionManager(db, config.model.model);

      const spinner = ora({
        text: `Running: ${task.slice(0, 60)}`,
        color: "cyan",
      });

      const available = await model.isAvailable();
      if (!available) {
        spinner.fail(theme.error(`Cannot connect to Ollama at ${config.model.baseUrl}`));
        process.exit(1);
      }

      const session = sessionMgr.create(task.slice(0, 50));
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: task,
        timestamp: Date.now(),
      };
      session.messages.push(userMsg);

      spinner.start();

      try {
        let output = "";
        const result = await runAgentLoop(session.messages, {
          model,
          tools,
          policy,
          db,
          sessionId: session.id,
          stream: false,
          onApprovalRequired: async (prompt) => {
            spinner.stop();
            console.log("\n" + prompt);
            console.log(theme.muted("(auto-denied in non-interactive mode)"));
            spinner.start();
            return false;
          },
        });

        spinner.succeed(theme.success("Done"));
        output = result.message.content;

        if (opts.json) {
          console.log(JSON.stringify({ output, toolsExecuted: result.toolsExecuted }));
        } else {
          console.log("\n" + output);
        }
      } catch (err) {
        spinner.fail(theme.error(`Failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
