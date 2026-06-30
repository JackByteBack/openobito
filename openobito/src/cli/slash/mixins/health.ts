import type { GConstructor } from "../types.js";
import { output, err } from "../types.js";
import type { BaseCLI } from "../base.js";

async function doctorReportText(): Promise<string> {
  const { DoctorSystem, renderReport } = await import("../../../health/index.js");
  const system = new DoctorSystem();
  const report = await system.run();
  return renderReport(report);
}

async function doctorRepairText(): Promise<string> {
  const { DoctorSystem } = await import("../../../health/index.js");
  const system = new DoctorSystem();
  const report = await system.run();
  const issues = report.items.filter((item) => item.severity === "error" || item.severity === "warn");
  if (issues.length === 0) return "No issues to repair.";

  const lines = ["Repair suggestions:"];
  await system.repair(issues, (line) => lines.push(line));
  return lines.join("\n");
}

// ─── System & Health mixin (OpenHuman /doctor pattern) ────────────────────────
// /health /doctor /bench

export function HealthMixin<TBase extends GConstructor<BaseCLI>>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this.registerMany([
        {
          path: ["health"],
          description: "Quick system health check",
          usage: "/health [check|memory|disk]",
          handler: async (args, ctx) => {
            const sub = args[0] ?? "check";
            if (sub === "memory") {
              const mem = process.memoryUsage();
              return output(
                [
                  `Heap used:  ${(mem.heapUsed / 1_048_576).toFixed(1)} MB`,
                  `Heap total: ${(mem.heapTotal / 1_048_576).toFixed(1)} MB`,
                  `RSS:        ${(mem.rss / 1_048_576).toFixed(1)} MB`,
                ].join("\n")
              );
            }
            if (sub === "disk") {
              const { execSync } = await import("child_process");
              try {
                return output(execSync("df -h .", { encoding: "utf8" }).trim());
              } catch { return err("df failed."); }
            }
            // default: quick check
            ctx.print("Running health checks…");
            return output(await doctorReportText());
          },
          complete: async () => ["check", "memory", "disk"],
        },
        {
          path: ["health", "check"],
          description: "Run full health diagnostics",
          usage: "/health check",
          handler: async (_args, ctx) => {
            ctx.print("Running diagnostics…");
            return output(await doctorReportText());
          },
        },
        {
          path: ["health", "memory"],
          description: "Show process memory usage",
          usage: "/health memory",
          handler: async () => {
            const m = process.memoryUsage();
            return output(`Heap: ${(m.heapUsed / 1e6).toFixed(1)}MB / ${(m.heapTotal / 1e6).toFixed(1)}MB  RSS: ${(m.rss / 1e6).toFixed(1)}MB`);
          },
        },
        {
          path: ["health", "disk"],
          description: "Show disk usage",
          usage: "/health disk",
          handler: async () => {
            const { execSync } = await import("child_process");
            try { return output(execSync("df -h .", { encoding: "utf8" }).trim()); }
            catch { return err("df not available."); }
          },
        },
        {
          path: ["doctor"],
          description: "Run OpenAgent diagnostics",
          usage: "/doctor [diagnose|repair|logs]",
          handler: async (args, ctx) => {
            const sub = args[0] ?? "diagnose";
            if (sub === "diagnose" || sub === "") {
              ctx.print("Running doctor diagnostics…");
              return output(await doctorReportText());
            }
            if (sub === "repair") {
              return output(await doctorRepairText());
            }
            if (sub === "logs") {
              const { getConfigDir } = await import("../../../config/index.js");
              return output(`Log dir: ${getConfigDir()}\n(structured logging in Phase 2)`);
            }
            return err(`Unknown: /doctor ${sub}`);
          },
          complete: async () => ["diagnose", "repair", "logs"],
        },
        {
          path: ["doctor", "diagnose"],
          description: "Run full diagnostics",
          usage: "/doctor diagnose",
          handler: async (_args, ctx) => {
            ctx.print("Running doctor diagnostics…");
            return output(await doctorReportText());
          },
        },
        {
          path: ["doctor", "repair"],
          description: "Show repair instructions",
          usage: "/doctor repair",
          handler: async () => output(await doctorRepairText()),
        },
        {
          path: ["doctor", "logs"],
          description: "Show log file location",
          usage: "/doctor logs",
          handler: async () => {
            const { getConfigDir } = await import("../../../config/index.js");
            return output(`Logs in: ${getConfigDir()}\nStructured logging available in Phase 2.`);
          },
        },
        {
          path: ["bench"],
          description: "Run performance benchmarks",
          usage: "/bench [model|tool|loop|all]",
          handler: async (args, ctx) => {
            const sub = args[0] ?? "all";
            const results: string[] = [];
            if (sub === "model" || sub === "all") {
              const prompt = "Explain binary search in one sentence.";
              const { FallbackChain } = await import("../../../model/index.js");
              const model = new FallbackChain(ctx.config.model);
              ctx.print(`Benchmarking ${ctx.config.model.model}…`);
              const t0 = Date.now();
              try {
                const resp = await model.chat(
                  [{ id: "bench", role: "user", content: prompt, timestamp: Date.now() }]
                );
                const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
                const tokens = resp.usage?.completionTokens ?? 0;
                const tps = tokens > 0 ? (tokens / parseFloat(elapsed)).toFixed(1) : "?";
                results.push(`Model:  ${ctx.config.model.model}  ${elapsed}s  ${tokens} tokens  ${tps} tok/s`);
              } catch (e) { results.push(`Model:  FAILED — ${String(e)}`); }
            }
            if (sub === "tool" || sub === "all") {
              const t0 = Date.now();
              const iterations = 500;
              for (let i = 0; i < iterations; i++) crypto.randomUUID();
              const elapsed = Date.now() - t0;
              results.push(`Tool:   ${iterations}x crypto.randomUUID()  ${elapsed}ms  ${(elapsed / iterations).toFixed(3)}ms avg`);
            }
            if (sub === "loop" || sub === "all") {
              const msgs = Array.from({ length: 1000 }, (_, i) => ({
                id: crypto.randomUUID(),
                role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
                content: `Message ${i}`,
                timestamp: Date.now(),
              }));
              const t0 = Date.now();
              const filtered = msgs.filter((m) => m.role === "user").map((m) => ({ ...m, tokens: m.content.length }));
              const elapsed = Date.now() - t0;
              results.push(`Loop:   ${msgs.length}msgs → ${filtered.length} user  ${elapsed}ms  ${((elapsed / msgs.length) * 1000).toFixed(2)}µs/msg`);
            }
            return output(results.join("\n") || `Usage: /bench [model|tool|loop|all]`);
          },
          complete: async () => ["model", "tool", "loop", "all"],
        },
      ]);
    }
  };
}
