# @openagent/architecture.md

## Best features extracted

### Crosswalk: OpenAgent ↔ Hermes ↔ OpenHuman

#### Hermes highlights to bring into OpenAgent
- Prompt caching invariants (don’t rebuild mid-session)
- Plugin hooks at lifecycle boundaries (pre/post tool, pre/post LLM)
- Permissions + risk tiers
- Skills and automations as first-class extensibility

#### OpenHuman highlights to bring into OpenAgent
- Rust core + RPC boundary is analogous to OpenAgent’s separation of:
  - UI layer (TUI)
  - agent loop and tool execution
- Approval gate is part of security policy, not a UI-only feature.

### OpenAgent architecture model (recommended)
Design OpenAgent modules so they map to the same boundaries:
- **UI (TUI/CLI)**
  - renders transcript
  - collects user messages
  - surfaces approvals
- **Agent core**
  - runs reasoning loop
  - manages session state
  - emits structured tool call events
- **Tooling layer**
  - registry for tool schemas
  - permission enforcement
  - tool execution handlers
- **Policy layer**
  - tool → risk tier → default action
  - approval UX and TTL/trace
- **Storage layer**
  - persistent sessions
  - audit log
  - agent memory KV

### What “good” looks like
- Adding a new tool updates:
  - registry metadata
  - permission policy mapping
  - UI tool call / output rendering
- Adding a new skill updates:
  - skill metadata
  - its prerequisites and tool expectations
  - any relevant scripts

## Generated docs strategy (optional future)
Hermes/OpenHuman keep architecture docs generated from sources in some areas.
For OpenAgent, consider adopting a similar approach later by:
- defining architecture facts in code
- generating markdown skeletons

This file is intended as a stable, human-maintained crosswalk.

