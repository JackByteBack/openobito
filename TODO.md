# TODO — rename OpenAgent → OpenObito

## Plan
- [ ] Identify all occurrences of “OpenAgent” / “openagent” in the `openagent/` package (docs, code, binaries, config defaults).
- [ ] Update `openagent/package.json`:
  - [ ] package `name` field (if present)
  - [ ] bin mapping from `openagent` → `openobito`
  - [ ] repository/homepage URLs if they embed openagent.
- [ ] Update CLI entry and commander name/banner text:
  - [ ] `openagent/src/cli/index.ts` program name/description/banner.
  - [ ] any command help text referencing `openagent`.
- [ ] Update `openagent/bin/openagent.js` (file name / internal strings) to `openobito.js` or ensure bin points to correct file.
- [ ] Rename docs strings in `openagent/README.md`, `openagent/AGENT.md`, `openagent/AGENTS.md`.
- [ ] Update `openagent/cli-config.yaml.example` paths (e.g., ~/.openagent/* → ~/.openobito/*).
- [ ] Ensure any tests/build scripts still work.
- [ ] Run `npm test`/`npm run typecheck` in `openagent/` if feasible.

