---
name: documentation
description: "Write clear, maintainable technical documentation: READMEs, API docs, and inline comments."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [documentation, readme, api-docs, comments, technical-writing]
    category: writing
    related_skills: [refactor, web-research]
    tools: [read_file, write_file]
    risk: low
---

# Documentation

Produces well-structured technical documentation for code, APIs, and projects. Follows the principle that good documentation explains the *why*, not the *what* — code shows what; docs explain intent, trade-offs, and usage context.

## When to Use

- Writing or improving a project README
- Documenting a public API or module interface
- Adding JSDoc/TSDoc to a TypeScript module
- Writing a CHANGELOG entry
- Creating architecture decision records (ADRs)
- Explaining a non-obvious algorithm or design decision

## Prerequisites

- Access to the code being documented (`read_file`)
- Understanding of the audience (end user, contributor, integrator)

## How to Run

Invoke via `/skills use documentation` or ask:

> "Write documentation for the SafetySystem class"

## Quick Reference

```
README structure: Title → One-liner → Install → Quickstart → Features → Config → Contributing
API doc:          Purpose → Parameters → Return → Throws → Example
Comment rule:     Only write the WHY. If the code name explains the WHAT, skip the comment.
```

## Procedure

### 1. Identify the Audience

Before writing, answer:
- Who will read this? (End user / contributor / integrator / future-self)
- What do they already know? (Beginner / intermediate / expert)
- What question are they trying to answer? (How do I install this? / What does this function do? / Why was this designed this way?)

The audience determines vocabulary, depth, and structure.

### 2. Read the Code First

```
[read] src/module/index.ts
[read] src/module/types.ts
```

Do not write documentation from memory. Read the actual implementation to:
- Verify parameter types and return shapes
- Identify edge cases and error conditions
- Note non-obvious behaviors

### 3. README Structure

For project READMEs, use this order:

```markdown
# Project Name

One sentence describing what this does and for whom.

## Install

[minimal install command]

## Quickstart

[5–10 lines showing the most common usage]

## Features

- Feature A — one line
- Feature B — one line

## Configuration

[table or YAML example of the most important options]

## API Reference

[link to generated docs or key types]

## Contributing

[link to AGENTS.md or CONTRIBUTING.md]
```

Keep the README scannable. If a section needs more than 1 paragraph, link to a dedicated doc.

### 4. API Documentation (TSDoc)

For TypeScript functions and classes:

```typescript
/**
 * Classifies a shell command and returns the policy decision for it.
 *
 * Unknown commands default to `CommandClass.Write` (fail-closed).
 * The result is deterministic for the same input — cache-safe.
 *
 * @param cmd - Raw shell command string (not yet split into argv)
 * @param tier - Current autonomy tier for the session
 * @returns The gate decision: Allow, Prompt, or Block
 *
 * @example
 * const decision = classify("git status", AutonomyTier.Supervised);
 * // → GateDecision.Allow
 */
export function classify(cmd: string, tier: AutonomyTier): GateDecision
```

Rules:
- First line: what it does (not "This function...")
- Non-obvious behavior in the description body
- `@param` for every parameter that is not self-explanatory
- `@returns` describing the shape, not just the type
- `@throws` if the function can throw
- `@example` for any public API

### 5. Inline Comments

The rule: **document the WHY, not the WHAT**.

```typescript
// BAD: the code already says this
const filtered = items.filter(x => x.active);

// GOOD: explains a non-obvious constraint
// Inactive items arrive in the stream but must not be shown — they are
// historical records kept for audit purposes only.
const filtered = items.filter(x => x.active);
```

Write a comment when:
- A workaround exists for a specific external bug or limitation
- A value is magic and the derivation is not obvious
- A design decision was made for non-obvious reasons
- A simpler approach was rejected (note why)

Skip a comment when:
- The variable or function name already explains it
- It just restates the code in English

### 6. Architecture Decision Records (ADRs)

For significant decisions, create `docs/adr/NNN-title.md`:

```markdown
# ADR-001: Use SQLite for local session storage

## Status
Accepted

## Context
Sessions need to persist across process restarts. The agent runs locally
without a network dependency, so a hosted database is not appropriate.

## Decision
Use `better-sqlite3` for local SQLite storage. All session data lives in
`~/.openagent/sessions.db`.

## Consequences
- Positive: No network dependency, zero config, ACID guarantees.
- Negative: Not suitable for multi-machine sync without explicit export.
- Neutral: Requires `npm rebuild better-sqlite3` after Node.js major version upgrades.
```

### 7. CHANGELOG Entries

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

```markdown
## [Unreleased]

### Added
- Safety system with 9 layers including AES-256-GCM credential encryption

### Changed
- Mixin constructors now use `...args: any[]` to satisfy TypeScript TS2545

### Fixed
- git.ts blocklist pattern now correctly detects `git push -f` without --force-with-lease

### Removed
- Removed deprecated `PolicyEngine.isAllowed()` in favor of `classify()`
```

## Pitfalls

- **Documenting the obvious**: `// increment counter` above `count++` is noise.
- **Stale docs worse than no docs**: If documentation drifts from the code, it actively misleads. Keep docs close to the code they describe.
- **README as a wall of text**: If it needs a scroll to find the install command, it fails. Lead with the quickstart.
- **Copying types into prose**: `@param path - string` is useless. `@param path - Absolute or relative path to the config file (~ expands to home)` is useful.
- **Missing examples**: Abstract descriptions are hard to parse. Always include a concrete example for public APIs.

## Verification

After writing:

- [ ] Every public function has a TSDoc comment
- [ ] No comment just restates the variable/function name
- [ ] README has a working quickstart (tested, not written from memory)
- [ ] All code examples compile (copy-paste them into a `.ts` file and check)
- [ ] ADR file created for any significant design decision made during this session
