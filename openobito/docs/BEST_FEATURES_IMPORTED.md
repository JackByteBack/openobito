# Best Features Imported Into OpenAgent

This document records the portable ideas extracted from Hermes Agent and
OpenHuman and how they map into OpenAgent.

## From Hermes Agent

- Narrow core, rich edges: prefer skills, plugins, commands, and gated tools
  before adding permanent built-in tools.
- Skills as procedural memory: reusable workflows should live in compact
  `SKILL.md` files with references for details.
- Central registries: slash commands, tools, and completions should derive from
  one source of truth.
- Stable prompt/session behavior: avoid mutating the system prompt mid-session.
- TUI as a first-class surface: thinking, tools, approvals, and slash commands
  should be event-driven and testable.

## From OpenHuman

- Local-first privacy posture: memory, sessions, audit logs, and runtime state
  stay on the user's machine by default.
- Explicit permission tiers: unknown and risky actions fail conservatively.
- Approval and audit gates: prompt users before risky actions and record what
  happened.
- Domain-focused modules: keep business logic out of transport and UI layers.
- Debug discipline: logs should help diagnose flow without leaking secrets.

## OpenAgent Additions

- `AGENTS.md`: root development guide for future coding agents.
- `AGENT.md`: compatibility pointer for singular-file conventions.
- `skills/openagent-development/SKILL.md`: reusable OpenAgent development skill.
- `skills/openagent-development/references/`: detailed guidance for tools,
  permissions, event loop, and TUI work.
- `.agents/agents/`: small specialized agents for core implementation, review,
  and release readiness.

