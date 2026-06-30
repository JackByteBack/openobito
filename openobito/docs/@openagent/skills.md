# @openagent/skills.md

## Best features extracted

### 1) Skill packaging standards (Hermes “SKILL.md” hardline)
Hermes enforces consistent `SKILL.md` structure and quality gates.

**Core standards to copy**
- Skill description:
  - ≤ 60 characters
  - one sentence
  - ends with a period
- Explicit tool expectations:
  - Reference native OpenAgent tools/commands (use backticks)
  - Do not name shell pipelines; name the tool/skill abstraction.
- Clear prerequisites:
  - list what the user must configure
  - list required accounts/tokens, OS constraints, and optional steps
- Standard section order:
  - `When to Use`, `Prerequisites`, `How to Run`, `Quick Reference`, `Procedure`, `Pitfalls`, `Verification`

### 2) Script-first mechanics; agent handles reasoning
Hermes and its automation/routines show a pattern: use scripts for mechanical work; the agent does reasoning and composition.

**OpenAgent adoption**
- For complex workflows:
  - ship helper scripts/snippets
  - document what they output
  - have skills reference those outputs in prompts.

### 3) “Tools referenced must exist” discipline
Hermes forbids skills from referencing nonexistent or wrong tools (especially cross-toolset references that might not be enabled).

**OpenAgent adoption**
- Ensure skills list only tools/skills that:
  - are native to OpenAgent, or
  - are explicitly required via an installed plugin.
- If a skill expects a plugin, document the expected plugin name.

### 4) Deterministic verification
Hermes asks for a `Verification` section and encourages tests without live network.

**OpenAgent adoption**
- For each skill doc, include:
  - what observable output should look like
  - what invariants must hold
  - (when possible) a dry-run or mock mode

## Proposed OpenAgent skill representation
OpenAgent currently uses a TypeScript codebase; this doc proposes a compatible skill metadata pattern:

- Each skill should have:
  - a short `description` (≤ 60 chars)
  - required tools/permissions
  - prerequisites (config/plugin installation)
  - a canonical prompt skeleton
  - quick reference steps

## Adoption checklist for maintainers
- Normalize section order across skill docs.
- Add “Tool expectations” and “Prerequisites” to every new skill.
- When adding a referenced tool to a skill, confirm that:
  - the tool exists in OpenAgent
  - the default permission policy makes sense
  - the skill does not assume unavailable provider features

