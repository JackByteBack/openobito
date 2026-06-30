#!/usr/bin/env node
// esbuild bundler script
import { build } from "esbuild";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  "node:*",
];

await build({
  entryPoints: ["src/cli/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/index.js",
  external,
  sourcemap: true,
  banner: {
    js: "// OpenAgent — https://github.com/openagent-dev/openagent",
  },
});

console.log("Build complete → dist/index.js");
