#!/usr/bin/env node

// ─── OpenAgent Benchmark Runner ──────────────────────────────────────────────
// Usage: node scripts/bench.js [category]
//   categories: model | tool | loop | all

import { execSync } from "child_process";

const CATEGORIES = ["model", "tool", "loop"];

function sec(ms) {
  return (ms / 1000).toFixed(2);
}

function fmt(n) {
  return n.toLocaleString();
}

// ─── Benchmark: Model inference speed ─────────────────────────────────────────

async function benchModel() {
  console.log("\n═══ Model Benchmark ═══\n");

  const models = (() => {
    try {
      const out = execSync("ollama list", { encoding: "utf8" });
      const lines = out.trim().split("\n").slice(1);
      return lines.map((l) => l.split(/\s+/)[0]).filter(Boolean);
    } catch {
      return ["llama3.2:1b"];
    }
  })();

  for (const model of models.slice(0, 3)) {
    const prompt = "Explain the concept of recursion in one paragraph.";
    try {
      const t0 = Date.now();
      const out = execSync(
        `ollama run ${model} "${prompt}" 2>/dev/null`,
        { encoding: "utf8", timeout: 60000 }
      );
      const elapsed = Date.now() - t0;
      const tokens = out.split(/\s+/).length;
      console.log(`  ${model.padEnd(20)} ${sec(elapsed)}s  ${fmt(tokens)} tokens  ${(tokens / (elapsed / 1000)).toFixed(1)} tok/s`);
    } catch (e) {
      console.log(`  ${model.padEnd(20)} FAILED — ${e.message}`);
    }
  }
}

// ─── Benchmark: Tool execution speed ─────────────────────────────────────────

async function benchTool() {
  console.log("\n═══ Tool Benchmark ═══\n");

  const iterations = 100;
  const results = {};

  const tools = [
    { name: "read_file", fn: () => {
      const { readFileSync, existsSync } = await_import("fs");
      const { join } = await_import("path");
      const f = join(os_tmpdir(), "openagent-bench.tmp");
      if (existsSync(f)) readFileSync(f, "utf8");
    }},
  ];

  // Simplified: measure execSync, JSON.parse, fs operations
  const cases = [
    ["execSync('echo hello')", () => execSync("echo hello", { encoding: "utf8" })],
    ["JSON.parse (1KB)", () => JSON.parse('{"a":' + '"x".repeat(1024)' + "}")],
    ["fs.readFileSync (1KB)", () => {
      const { readFileSync, writeFileSync, existsSync } = require("fs");
      const f = "/tmp/openagent-bench-fs.tmp";
      if (!existsSync(f)) writeFileSync(f, "x".repeat(1024));
      readFileSync(f, "utf8");
    }],
    ["crypto.randomUUID()", () => crypto.randomUUID()],
  ];

  for (const [name, fn] of cases) {
    const t0 = Date.now();
    for (let i = 0; i < iterations; i++) fn();
    const elapsed = Date.now() - t0;
    const avg = (elapsed / iterations).toFixed(2);
    console.log(`  ${name.padEnd(40)} ${fmt(iterations)} iterations  ${elapsed}ms total  ${avg}ms avg`);
  }
}

// ─── Benchmark: Agent loop overhead ───────────────────────────────────────────

async function benchLoop() {
  console.log("\n═══ Loop Overhead Benchmark ═══\n");

  // Simulate message processing pipeline
  const iterations = 5000;
  const messages = [];
  for (let i = 0; i < iterations; i++) {
    messages.push({ id: crypto.randomUUID(), role: i % 2 === 0 ? "user" : "assistant", content: `Message number ${i}`, timestamp: Date.now() });
  }

  // Measure: filter + map through messages
  const t0 = Date.now();
  const processed = messages
    .filter((m) => m.role === "user")
    .map((m) => ({ ...m, tokens: m.content.split(/\s+/).length }));
  const t1 = Date.now();
  console.log(`  Filter+map ${fmt(iterations)} msgs  ${t1 - t0}ms total  ${((t1 - t0) / iterations * 1000).toFixed(2)}µs/msg`);
  console.log(`  Result: ${processed.length} user messages`);

  // Measure: JSON serialization
  const t2 = Date.now();
  const serialized = JSON.stringify(messages);
  const t3 = Date.now();
  console.log(`  JSON.stringify ${fmt(iterations)} msgs  ${t3 - t2}ms  ${(serialized.length / 1024).toFixed(1)}KB`);

  const t4 = Date.now();
  JSON.parse(serialized);
  const t5 = Date.now();
  console.log(`  JSON.parse ${fmt(iterations)} msgs  ${t5 - t4}ms`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const category = process.argv[2] || "all";

  if (category === "all" || category === "model") await benchModel();
  if (category === "all" || category === "tool") await benchTool();
  if (category === "all" || category === "loop") await benchLoop();

  console.log("\n═══ Done ═══\n");
}

main().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
