#!/usr/bin/env node
/**
 * OpenObito CLI entry point.
 * Delegates to the compiled dist bundle or live TypeScript via tsx in dev mode.
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = join(__dirname, "..", "dist", "index.js");
const srcEntry = join(__dirname, "..", "src", "cli", "index.ts");

if (existsSync(distEntry)) {
  await import(distEntry);
} else if (existsSync(srcEntry)) {
  // Development fallback — requires tsx to be installed
  const { register } = await import("node:module");
  try {
    const tsxPath = createRequire(import.meta.url).resolve("tsx/esm");
    register(tsxPath, import.meta.url);
    await import(srcEntry);
  } catch {
    console.error(
      "OpenObito: dist/ not found. Run `npm run build` or install `tsx` for dev mode."
    );
    process.exit(1);
  }
} else {
  console.error("OpenObito: neither dist/index.js nor src/cli/index.ts found.");
  process.exit(1);
}

