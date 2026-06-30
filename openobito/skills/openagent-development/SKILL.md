---
name: openagent-development
description: Build, review, and extend OpenAgent, a local-first Node.js/TypeScript CLI AI agent. Use when working on OpenAgent agent loop behavior, TUI thinking/tool panels, tool registry, permissions, safety gates, SQLite sessions, Ollama/local model adapters, slash commands, plugins, or release packaging.
---

# OpenAgent Development

Use this skill when changing OpenAgent code or designing new OpenAgent
capability.

## First Read

1. Read `AGENTS.md` at the OpenAgent repo root.
2. Inspect the module and nearby tests before editing.
3. Check `package.json` scripts and run the smallest useful verification.

## Design Defaults

- Preserve local-first behavior. Cloud, telemetry, hosted auth, and remote model
  calls must be opt-in.
- Keep the core narrow. Prefer skill, plugin, command, provider adapter, or
  service-gated tool before adding a built-in tool.
- Reuse registries. Do not add parallel dispatch tables for tools, slash
  commands, providers, or policies.
- Treat permissions, audit, and safety behavior as contracts.
- Keep UI state and parsing logic testable with pure helpers where possible.

## Common Workflows

### Add Or Change A Tool

Read `references/tools-and-permissions.md`.

Use this path when adding built-in tools, plugin tool support, risk policies,
approval behavior, or audit logging.

### Change The Agent Loop

Read `references/agent-loop-and-events.md`.

Use this path for message alternation, tool-call rounds, streaming, thinking
events, stop reasons, model fallback, or session lifecycle changes.

### Change The TUI

Read `references/tui.md`.

Use this path for Ink components, thinking parsing, slash completion, input
history, status panels, and tool execution display.

## Verification

Run focused tests first:

```bash
npm test -- test/tools/registry.test.ts
npm test -- test/permissions/policy.test.ts
npm test -- test/agent/events.test.ts
npm test -- test/tui/thinking.test.ts
```

Then run broader checks before finishing code edits:

```bash
npm test
npm run typecheck
npm run build
```

If a command cannot be run, report why and name the remaining risk.

