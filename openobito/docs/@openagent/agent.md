# @openagent/agent.md

## Best features extracted

### 1) Narrow-waist core; capability at the edges
Hermes and OpenHuman both follow the same principle: keep the core small and stable, and push capability into the *edges* (skills, plugins, toolsets, and adapters).

**OpenAgent adoption**
- Prefer implementing new behavior as:
  - a new built-in tool (only if it must exist in core), or
  - a new CLI command + skill, or
  - a plugin/tool wrapper, or
  - a provider/tool adapter.
- Avoid adding one-off feature logic directly into the main chat loop.

### 2) Cache-safety as a first-class invariant
Hermes treats per-conversation prompt caching as sacred: do not rebuild the system prompt mid-conversation, do not swap tool schemas mid-flight, and do not invalidate cached prefixes.

**OpenAgent adoption**
- If you change prompt templates, tool lists, permissions, or memory inputs, default to *deferred effect* (next session) unless the user explicitly opts into immediate invalidation.
- Keep role alternation invariant (no “two same-role messages in a row”) in your transcript composer.

### 3) Session persistence + auditability
Hermes uses SQLite-backed sessions and an audit log; OpenAgent already lists persistent sessions as a feature.

**OpenAgent adoption**
- Ensure tool calls and approvals are captured in the session trace.
- Make the “what the agent did” trail easy to inspect in TUI.

### 4) Lifecycles: pre/post tool, pre/post LLM call
Hermes plugin hooks include lifecycle stages (pre/post tool, pre/post LLM, session start/end). OpenAgent can mirror this as internal extension points.

**OpenAgent adoption**
- Implement hook points so plugins can safely:
  - sanitize tool args/outputs,
  - inject provenance,
  - enforce extra policy checks,
  - log structured events.

### 5) Permission model with risk levels
OpenAgent already has a permission system inspired by OpenHuman.

Hermes adds explicit risk-tier classification and enforces approval gates.

**OpenAgent adoption**
- Keep a stable mapping from tool → risk level.
- Default policies should be conservative for high/critical risk tools.

## How to use this doc
Use this file when designing OpenAgent changes around:
- agent loop behavior
- prompt/tool caching and invalidation
- session trace and audit logging
- extension points (hooks)
- permissions/risk gates

