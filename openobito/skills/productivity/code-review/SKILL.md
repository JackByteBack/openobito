---
name: code-review
description: "Structured code review: correctness, safety, readability, and test coverage checks."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [code-review, quality, correctness, safety, readability, pull-request]
    category: productivity
    related_skills: [security-audit, unit-tests, documentation]
    tools: [read_file, shell_exec]
    risk: low
---

# Code Review

Structured code review across four dimensions: correctness, safety, readability, and test coverage. Produces a prioritized comment list with line references. Distinguishes between blocking issues (must fix) and non-blocking suggestions (should fix).

## When to Use

- Reviewing a pull request diff
- Self-reviewing your own changes before committing
- Reviewing a module before merging into a critical path
- Checking that a security-sensitive change is safe

## Prerequisites

- Access to the diff or changed files (`read_file`, `git diff`)
- Ability to run the test suite (`shell_exec`)

## How to Run

Invoke via `/skills use code-review` or ask:

> "Review this safety system implementation"

## Quick Reference

```
Dimension 1: Correctness — does it do what it claims?
Dimension 2: Safety — can it fail dangerously? (crashes, data loss, security)
Dimension 3: Readability — can a stranger maintain this in 6 months?
Dimension 4: Test coverage — are the critical paths tested?
```

## Procedure

### 1. Get the Diff

```
[exec] git diff main...HEAD                    # All changes vs main
[exec] git diff HEAD~1                         # Last commit only
[exec] git show <commit-hash> -- path/file.ts  # Specific file in commit
```

Read the diff first without forming judgments. Note:
- What files were changed
- What the stated purpose is (PR description / commit message)
- Any files that are suspiciously absent (e.g., feature added but no test file)

### 2. Dimension 1: Correctness

Read the changed code and ask: **does it do what it says?**

Checks:
- [ ] Off-by-one errors in loops or boundary conditions
- [ ] Missing null/undefined checks at function entry points
- [ ] Error paths that are silently swallowed (`catch {}` empty blocks)
- [ ] Race conditions in async code (concurrent mutation of shared state)
- [ ] Incorrect operator precedence (`a || b && c` vs `(a || b) && c`)
- [ ] Edge cases: empty collections, zero, negative numbers
- [ ] Incorrect early returns that skip side effects
- [ ] Wrong algorithm (O(n²) where O(n) is possible and the input can be large)

For each issue found:
```
BLOCKING - Correctness
File: src/safety/ratelimit.ts:42
Issue: `timestamps.length >= limit` should be `>` — at exactly `limit` requests the
       last request is blocked but the counter has not actually been exhausted.
Fix: Change `>=` to `>` or adjust the semantic to match the docs.
```

### 3. Dimension 2: Safety

**Security and failure safety** — can this cause harm if it goes wrong?

Checks:
- [ ] Shell injection: user-controlled input passed to `exec()` / `execSync()`
- [ ] Path traversal: user-controlled paths used with `fs.readFile()` without normalization
- [ ] Hardcoded secrets or API keys
- [ ] Sensitive data logged to console or audit files
- [ ] Uncaught exceptions in async code that could crash the process
- [ ] Infinite loops or unbounded recursion
- [ ] Destructive operations without confirmation or dry-run gate
- [ ] Missing rate limit or quota guard on expensive operations
- [ ] `Object.freeze()` misused on Maps (does not prevent `.set()`)
- [ ] Trust-elevation: does the change allow less-trusted code to do more?

```
BLOCKING - Safety
File: src/tools/builtin/shell.ts:34
Issue: `cmd` is user-provided and passed directly to execSync(). An adversarial
       prompt could inject "; rm -rf $HOME" after any valid command.
Fix: Use spawn() with argv array, or validate against an allowlist.
```

### 4. Dimension 3: Readability

**Can a stranger maintain this in 6 months?**

Checks:
- [ ] Function names describe what the function does (not how)
- [ ] Functions are ≤ 50 lines; files ≤ 400 lines
- [ ] No magic numbers without named constants
- [ ] Deeply nested code (> 3 levels) is a candidate for extraction
- [ ] Comments explain WHY, not WHAT
- [ ] TypeScript types are explicit where they aid understanding (not inferred `any`)
- [ ] No dead code (commented-out blocks, unused imports)
- [ ] Consistent naming conventions across the diff

Non-blocking suggestions go in a separate section:
```
SUGGESTION - Readability
File: src/agent/loop.ts:88
Issue: The 6-nested-if block at line 88 is hard to follow.
Suggestion: Extract to a named helper: `function shouldCircuitBreak(ctx: LoopCtx): CircuitBreakerReason | null`
```

### 5. Dimension 4: Test Coverage

Checks:
- [ ] Every new public function has at least one test
- [ ] Error paths are tested (not just the happy path)
- [ ] Boundary values tested (off-by-one prone areas)
- [ ] No test was deleted as part of this change without an explanation
- [ ] Tests are in the right directory (test file mirrors source path)
- [ ] Tests don't rely on implementation details that would break on refactor

```
BLOCKING - Test Coverage
File: src/safety/credentials.ts — new `detectLeaks()` function added
Issue: No test file changes found. The credential detection patterns are not tested.
Fix: Add tests in test/safety/credentials.test.ts covering at least 3 of the 12 patterns.
```

### 6. Produce the Review

Format:

```markdown
## Code Review: [feature/module name]

### Summary
[1–2 sentences: what the change does and overall impression]

### Blocking Issues (must fix before merge)

1. **Correctness** — `src/foo.ts:42` — [description and fix]
2. **Safety** — `src/bar.ts:10` — [description and fix]

### Non-blocking Suggestions (should fix, but not a blocker)

1. **Readability** — `src/baz.ts:88` — [description and suggestion]
2. **Test Coverage** — Add test for error path in `checkAndConsume()`

### What Looks Good

- [Specific positive observation — e.g., "The FrozenDecisionMap is elegant and solves the Map.freeze limitation correctly"]
- [Another positive observation]
```

Always include something that looks good. Reviews that are only criticism are demoralizing and less effective.

### 7. Verify Locally

After the author says issues are fixed, verify:

```
[exec] npx vitest run      # Tests pass
[exec] npx tsc --noEmit   # Type-check clean
[exec] git diff main...HEAD | wc -l   # Diff is not larger than expected
```

## Pitfalls

- **Reviewing style, not substance**: Prefer automated linters for style. Code review is for logic, safety, and design.
- **Being vague**: "This could be cleaner" is not actionable. "Extract lines 40–60 into a named helper" is.
- **Missing the deleted-test trap**: When tests are removed along with a feature, the test suite size shrinks. Always check if test deletions are intentional.
- **Only reviewing the diff**: Sometimes the bug is in the unchanged code that interacts with the new code. Read callers.
- **Not distinguishing blocking from non-blocking**: If everything is a blocker, nothing is. Reserve BLOCKING for things that will cause actual failures.
- **No positive feedback**: Good code review points out what works, not only what doesn't.

## Verification

A review is complete when:

- [ ] All four dimensions checked
- [ ] Blocking issues clearly distinguished from suggestions
- [ ] Each finding has a file + line reference
- [ ] Each finding has an actionable fix, not just a complaint
- [ ] At least one positive observation included
- [ ] Test suite and type-check verified locally after fixes applied
