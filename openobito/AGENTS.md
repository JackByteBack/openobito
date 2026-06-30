# OpenAgent Development Guide

Instructions for AI coding assistants and developers working on OpenAgent.

## What OpenAgent Is

OpenAgent is a local-first CLI AI agent built with Node.js and TypeScript. It
runs on the user's machine, talks to local model providers such as Ollama, and
keeps sessions, audit logs, memory, permissions, and tool execution local by
default.

The product direction is simple: make a capable personal agent without turning
the core into a large permanent tool surface.

Two design constraints should shape every change:

- **Local-first is the product promise.** Do not add networked defaults,
  telemetry, hosted dependencies, or cloud-only flows without an explicit
  opt-in configuration path.
- **The core is a narrow waist.** Every built-in tool or prompt rule affects
  every conversation. Prefer config, skills, plugins, or service-gated
  adapters over growing the core.

## Contribution Rubric

### What We Want

- Fix real bugs with a line-level explanation of where the behavior changes.
- Preserve the offline/local default, especially around files, memory, logs,
  model calls, and diagnostics.
- Extend existing registries before adding new dispatch branches.
- Keep capability at the edges: skill, plugin, command, or provider adapter
  first; built-in tool last.
- Treat permission and safety behavior as public contracts. Changes need
  focused tests.
- Prefer behavior tests over snapshot/change-detector tests.
- Keep event names stable and payloads typed enough for TUI, logs, and future
  plugins to consume.
- Keep files focused. If a module starts acting as a controller, split it.

### What We Avoid

- New hosted services, telemetry, or attribution tags enabled by default.
- New destructive capabilities without explicit policy classification and
  approval/audit coverage.
- User-facing config via new environment variables when `config.yaml` is the
  better home. Env vars are for secrets, local overrides, and test harnesses.
- Duplicate command, tool, slash, or provider registries.
- Adding a new built-in tool because it is convenient when shell/file tools or
  a skill can do the job.
- Tests that only freeze current lists, counts, or literal config versions.

## Capability Footprint Ladder

Choose the smallest durable surface that solves the task:

1. **Extend existing code** when the behavior is a variation of a current path.
2. **Skill or instruction file** when the capability is a repeatable workflow
   that can be expressed through existing tools.
3. **CLI/slash command** when the user needs a direct command surface.
4. **Plugin or provider adapter** when the feature is optional, niche,
   third-party, or user-specific.
5. **Service-gated tool** when structured tool I/O is necessary and the tool
   should only appear when configured.
6. **Built-in core tool** only when the feature is fundamental to almost every
   user and cannot be expressed safely through the surfaces above.

## Repository Map

```text
src/
├── cli/          # Commander entry, subcommands, slash command registry
├── tui/          # Ink UI, thinking/tool panels, input and history hooks
├── agent/        # Loop, sessions, memory, event bus, delegation, compression
│   ├── loop.ts         # Main reasoning loop with circuit breakers + autonomy tiers
│   ├── definition.ts   # AgentDefinition type + registry (readonly/supervised/full)
│   ├── delegate.ts     # Multi-agent delegation (DelegationManager + SubAgentTask)
│   └── compressor.ts   # Context compression (sliding_window / summarize / hybrid)
├── cron/         # Cron scheduler for recurring agent tasks
│   ├── types.ts        # CronJob, CronJobRun types
│   ├── parser.ts       # 5-field cron expression parser + nextRunTime()
│   └── scheduler.ts    # CronScheduler with tick loop and concurrency cap
├── model/        # Local model adapters and fallback chain
├── tools/        # Tool registry and built-in tools
├── permissions/  # Policy engine and approval formatting
├── safety/       # 9-layer safety system (see Safety System below)
├── storage/      # SQLite schema and audit/session persistence
├── config/       # YAML config loading
└── doctor/       # Local diagnostics

skills/           # SKILL.md workflow definitions (Hermes-inspired)
├── git/git-workflow/
├── coding/refactor/
├── debugging/root-cause/
├── research/web-research/
├── writing/documentation/
├── security/security-audit/
├── testing/unit-tests/
└── productivity/code-review/

.agents/agents/   # Agent workflow definitions (OpenHuman-inspired)
├── ship-and-babysit.md   # Pre-flight → commit → push → CI watch
├── code-review.md        # 4-dimension readonly code review
└── refactor.md           # Supervised incremental refactor with per-step commits

.codex/           # Machine-readable registries
├── skills/registry.yaml    # All skills (name, path, category, risk, tags)
└── commands/registry.yaml  # All slash commands (command, handler, args)

test/
├── agent/        # Event contract tests
├── permissions/  # Policy behavior tests
├── safety/       # Guardrail tests
├── tools/        # Registry/tool execution tests
└── tui/          # Thinking and TUI helper tests
```

## Coding Rules

- Use TypeScript strictness as a design tool: keep public shapes explicit.
- Prefer small, pure helpers for parsing and policy logic so they are easy to
  test.
- Keep registries table-driven. Slash commands, tools, and policies should not
  accumulate scattered conditionals.
- Avoid dynamic imports in production paths unless the dependency is truly
  optional and failure is handled cleanly.
- Never log secrets, full credentials, or unnecessarily large tool payloads.
- Make debug output grep-friendly with stable prefixes and identifiers.

## Agent Loop Rules

- Preserve message role alternation. Tool results should be attached through
  tool messages, not synthetic user instructions.
- Keep the system prompt stable during a session except for explicit context
  compression or a deliberate session reset.
- Bound tool-calling rounds and surface a graceful stop reason when the bound
  is reached.
- Emit events for user-visible lifecycle changes: thinking, tool call, tool
  result, approval required, denied, done, and errors.

### Circuit Breakers

The loop enforces two automatic stops based on `AgentDefinition.circuitBreakers`:

- **repeat_failure**: `consecutiveFailures >= repeatFailureThreshold` (default 3).
  Increments on: model error, tool denied by policy, tool blocked in readonly mode.
  Resets to 0 on any successful tool execution.
- **no_progress**: `consecutiveNoProgress >= noProgressThreshold` (default 6).
  Increments when a complete round produces tool calls but zero successful executions.
  Resets when at least one tool executes successfully.

Circuit breaker trip returns `stopped: true` with `stopReason: "circuit_breaker"`.
Hard reject (user denies approval) returns `stopReason: "hard_reject"` immediately.

### Autonomy Tiers

Defined in `src/agent/definition.ts`. The tier governs tool approval behavior:

- **readonly**: `require_approval` tools are auto-denied without prompting. Only
  `allow`-classified tools execute.
- **supervised**: `require_approval` tools pause and prompt the user. Denial stops
  the loop with `hard_reject`.
- **full**: All non-`deny` tools execute without approval prompts.

Tier is set per `AgentDefinition`. The default agent uses `supervised`.

### Context Compression

`ContextCompressor` (`src/agent/compressor.ts`) compresses the message list when
estimated tokens exceed `triggerFraction * maxTokens`. Strategies:

- **sliding_window**: Drop oldest non-system messages while budget allows.
- **summarize**: Compress tail into a summary block via a model call.
- **hybrid**: Summarize first, then sliding-window if still over budget.

Compression is opt-in. Call `compressor.compress(messages)` before passing to
`runAgentLoop()`. The result includes `compressed`, `originalCount`, `resultCount`.

### Multi-agent Delegation

`DelegationManager` (`src/agent/delegate.ts`) runs sub-agents within a session.
Each `SubAgentTask` carries its own prompt, `AgentDefinition`, and optional context.
Sub-agents share the same `ToolRegistry` and `PolicyEngine` as the parent but run
in a separate session ID (`parentId:sub:taskId`).

`runAll()` runs tasks with capped concurrency (default 4). Results include
`success`, `toolsExecuted`, `durationMs`, and `error` if failed.

### Cron Scheduler

`CronScheduler` (`src/cron/scheduler.ts`) runs recurring agent prompts on a 5-field
cron schedule. Jobs are stored in memory (or can be persisted to SQLite). The tick
interval defaults to 60 seconds. Concurrency is capped at `maxConcurrent` (default 3).

Each job has a `timeoutMs` guard (default 5 min). Jobs that exceed timeout are
marked `failed` and their `failCount` incremented. Jobs that reach `maxRuns` are
marked `completed`.

Events emitted: `cron.job_added`, `cron.job_start`, `cron.job_done`, `cron.job_error`,
`cron.job_removed`.

## Skills

Skills are reusable workflow definitions in `skills/<category>/<name>/SKILL.md`. Each file
uses YAML frontmatter for machine metadata and Markdown sections for human procedure.

**SKILL.md frontmatter fields:**

```yaml
name: kebab-case-name        # globally unique, used by /skills use <name>
description: "≤60 chars"
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [tag1, tag2]
    category: category-name
    related_skills: [other-skill]
    tools: [read_file, shell_exec]
    risk: low|medium|high
```

**Required body sections** (in order): When to Use, Prerequisites, How to Run,
Quick Reference, Procedure, Pitfalls, Verification.

Skills are registered in `.codex/skills/registry.yaml`. Add an entry there after
creating a new SKILL.md.

**Risk guidelines:**
- `low`: read-only operations, documentation, research
- `medium`: writes to local files, git operations
- `high`: network calls, auth changes, database writes

## Agent Workflows

Agent workflow definitions in `.agents/agents/*.md` describe named autonomous
multi-step workflows. Each workflow declares:

- **Autonomy tier** (`readonly` / `supervised` / `full`)
- **Phases** with specific steps and decision gates
- **Circuit breakers** (what stops the workflow on failure)
- **Output format** (structured, predictable output for each phase)

Invoke via `/agent run <name>`. List available agents via `/agent list`.

When writing a new agent workflow:
1. Default to `supervised` unless the workflow is provably read-only or provably
   safe to run without any approval gates.
2. Every phase that can fail must describe what happens on failure (stop, retry,
   escalate).
3. Hard reject (user says no at an approval gate) always stops the workflow — no
   workarounds.

## Safety System

9-layer safety system in `src/safety/`:

| Layer | File | Purpose |
|---|---|---|
| 1 | `policy.ts` | Tool classification: allow / prompt / deny / hide_from_prompt |
| 2 | `approval.ts` | Pluggable approval prompts with session-level standing decisions |
| 3 | `blocklist.ts` | Permanently blocked commands and paths (regex + prefix matching) |
| 4 | `sandbox.ts` | Env var filtering + sandboxed `spawnSync` with timeout/buffer caps |
| 5 | `audit.ts` | Daily rotating JSONL audit logs at `~/.openagent/audit_logs/` |
| 6 | `ratelimit.ts` | Sliding window rate limits per tool category |
| 7 | `fileaccess.ts` | Protected paths, blocked directories, dangerous extensions |
| 8 | `credentials.ts` | AES-256-GCM credential encryption + session memory protection |
| 9 | `incident.ts` | Ring-buffer incident detection with diagnostic reports |

All layers are composed in `src/safety/index.ts` → `SafetySystem`. The `check()`
method is synchronous (no I/O); `execute()` runs the full async pipeline including
approval, audit, and incident detection.

## Tool Rules

- Every tool needs a clear schema, a risk classification, and a default policy.
- Hidden tools must be filtered before model schemas are sent.
- Tool failures return structured error results; do not throw through the loop.
- High-risk and destructive tools require approval and audit entries.
- Prefer plugin-owned tools for optional integrations.

## Permission And Safety Rules

- Default unknown tools to a conservative policy.
- Treat path roots, credential paths, and destructive commands as fail-closed.
- Approval prompts should show tool name, risk, reason, and arguments without
  exposing secrets.
- Audit deny, approval, and execution paths consistently.

## TUI Rules

- The TUI is a real agent surface, not a decorative wrapper.
- Thinking output should be parsed from streamed buffers without leaking raw
  tags into final answers.
- Keep panels resilient to empty, partial, and interrupted streams.
- Slash command completion should come from one registry so help, completion,
  and execution do not drift.

## Tests

Run the narrowest useful check while iterating, then broader checks before
finishing code changes:

```bash
npm test
npm run typecheck
npm run build
```

Add or update tests when touching:

- `src/permissions/` or `src/safety/`
- `src/tools/registry.ts` or built-in tools
- `src/agent/events.ts` or loop lifecycle behavior
- TUI parsing, completion, or status rendering
- Storage schema and audit behavior

