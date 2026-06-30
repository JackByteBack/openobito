---
name: code-reviewer
description: "Review code for bugs, security issues, quality, and maintainability."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [code-review, quality, security, bugs, best-practices]
  related_skills: [refactor-helper, test-writer, debug-assistant]
---

# Skill: Code Reviewer

## Description

Systematically reviews code for correctness, security vulnerabilities, performance
issues, maintainability problems, and style violations. Produces a structured report
with severity ratings and concrete fix suggestions.

## When to Activate

- User says "review my code", "check this file", "look for bugs", "audit this"
- User pastes code and asks for feedback
- User asks "is this safe?", "any issues here?", "what do you think of this?"
- Before a git commit or PR creation on significant changes

## Instructions

### Review Checklist (run through all sections)

**1. Correctness**
- Off-by-one errors, null/undefined dereferences, incorrect conditionals
- Logic errors: does the code do what the comments/name claim?
- Edge cases: empty inputs, zero values, very large inputs, concurrent access
- Error handling: are exceptions caught and handled correctly?

**2. Security**
- Injection: SQL, shell, path traversal, template injection
- Authentication/authorization: missing checks, privilege escalation paths
- Secrets in code: hardcoded passwords, API keys, tokens
- Input validation: user-controlled data reaching sensitive operations
- Dependency vulnerabilities: note any known-bad patterns in imports

**3. Performance**
- N+1 queries or nested loops over large data sets
- Unnecessary re-computation inside hot loops
- Memory leaks: event listeners never removed, circular references
- Blocking operations on the main thread / async anti-patterns

**4. Maintainability**
- Functions doing too many things (single-responsibility)
- Magic numbers / strings without named constants
- Deep nesting that obscures control flow
- Missing or misleading documentation on public APIs
- Dead code, commented-out blocks, TODO bombs

**5. Style and Conventions**
- Naming: variables, functions, types follow project conventions
- Consistency with surrounding code
- Unnecessary complexity where a simpler approach exists

### Output Format

Structure your review as:

```
## Code Review: <filename or description>

### Summary
<1-2 sentence overall assessment>

### Issues Found

#### 🔴 Critical (fix before merging)
- [line N] <issue> — <why it matters> — Fix: <concrete suggestion>

#### 🟠 High (should fix)
- [line N] <issue> — Fix: <suggestion>

#### 🟡 Medium (consider fixing)
- [line N] <issue> — Suggestion: <improvement>

#### 🟢 Low / Style
- [line N] <minor note>

### Positives
- <what the code does well>

### Recommended Next Steps
1. <most important fix>
2. <second priority>
```

Omit sections with no findings. Always include at least one positive.

## Required Tools

- `read_file`: read source files being reviewed
- `list_directory`: find related files for context (tests, types, callers)
- `shell_exec` (optional): run linters — `eslint`, `tsc --noEmit`, `ruff`, `cargo clippy`

## Example Usage

User: "Can you review src/auth.ts?"
Agent:
1. `read_file("src/auth.ts")` — read the target file
2. `list_directory("src/")` — check for related test files and types
3. Read related files (auth types, middleware callers) for context
4. Produce structured review with all 5 checklist sections
5. Offer to fix any critical/high issues immediately

User: "Review the changes I just made"
Agent:
1. `shell_exec("git diff HEAD")` — see what changed
2. Read each changed file for full context
3. Focus review on the diff, but note any systemic issues in context

## Notes

- Always read the FULL file, not just what the user pastes — context matters
- When a linter is available, run it first; don't duplicate what it catches
- For security issues, be specific: "line 42 passes `user.id` directly into a shell
  command — use `execFile` with an args array instead"
- Severity guide: Critical = data loss / security breach / crash in production;
  High = likely bug or obvious vulnerability; Medium = code smell or latent risk;
  Low = style / nitpick
- Don't be pedantic about style if the codebase is already consistent in its own way
