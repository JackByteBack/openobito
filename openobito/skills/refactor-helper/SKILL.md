---
name: refactor-helper
description: "Refactor code for clarity, simplicity, and maintainability without changing behavior."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [refactoring, clean-code, simplification, architecture, maintainability]
  related_skills: [code-reviewer, test-writer, file-analyzer]
---

# Skill: Refactor Helper

## Description

Safely refactors code to improve structure, reduce complexity, and eliminate duplication
— without changing external behavior. Always starts by understanding existing tests,
then refactors in small safe steps verified by running tests after each change.

## When to Activate

- User says "refactor this", "clean up this code", "simplify this function"
- User asks "this is too complex", "too much duplication", "hard to understand"
- User wants to "extract a module", "split this file", "rename throughout"
- Code review identified structural issues to address
- User wants to "improve the architecture"

## The Refactor Contract

```
Refactoring = behavior-preserving transformation.
If the tests change color, you changed behavior.
```

Before touching code: understand existing tests. If there are none, write them first.

## Instructions

### Step 0 — Establish the Safety Net

```bash
# Run existing tests — they must all be green before you start
npm test           # or: pytest, cargo test, go test ./...

# If no tests exist, write characterization tests first:
# Test current behavior (even if it seems wrong) so refactoring can't break it
```

If there are no tests and you can't write them (e.g., side effects, UI), ask the user
to verify behavior manually at each step.

### Step 1 — Understand Before Changing

1. `read_file` the target file(s) completely
2. Identify the exact problem: too long? too coupled? duplicated? poorly named?
3. Plan refactors in order from safest to most invasive:
   - **Safe:** rename, extract constant, add type annotation, remove dead code
   - **Medium:** extract function, inline variable, move code within a file
   - **Invasive:** split file/module, change interfaces, restructure data

### Step 2 — Common Refactor Patterns

**Extract Function** — when a block of code has a clear single purpose:
```typescript
// Before: mixed concerns
function processOrder(order) {
  // 20 lines of validation
  // 15 lines of pricing
  // 10 lines of DB write
}

// After: each concern is named and testable
function processOrder(order) {
  const validated = validateOrder(order);
  const priced = calculatePricing(validated);
  return saveOrder(priced);
}
```

**Replace Magic Values with Named Constants:**
```typescript
// Before
if (retries > 3) throw new Error("max retries");
await sleep(1000 * Math.pow(2, attempt));

// After
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
if (retries > MAX_RETRIES) throw new Error("max retries");
await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt));
```

**Eliminate Duplication (DRY):**
```typescript
// Before: same logic in 3 places
// After: extract to a shared utility, import in all 3 places
// CAUTION: only extract when the logic is truly identical AND belongs together
```

**Flatten Deep Nesting (early return / guard clause):**
```typescript
// Before
function process(user) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        doWork(user);
      }
    }
  }
}

// After
function process(user) {
  if (!user) return;
  if (!user.isActive) return;
  if (!user.hasPermission) return;
  doWork(user);
}
```

**Split Large Files:**
A file is too large when: > ~400 lines, multiple unrelated classes/functions, imports
from many unrelated domains. Split by cohesion — things that change together stay together.

**Rename for Clarity:**
- `data` → `userProfile`
- `handleClick` → `submitLoginForm`
- `utils.ts` → `date-formatting.ts` (when the file has a clear single purpose)

### Step 3 — Apply and Verify

For each refactor step:
1. Make the change
2. Run tests: `npm test` (should still be green)
3. Commit with message: `refactor: extract validateOrder from processOrder`

Never mix a refactor with a bug fix or feature. Keep commits atomic.

### Step 4 — Report Changes

After refactoring, summarize:
- What was changed and why
- Lines before / after (or file count)
- Any new abstractions introduced
- Any follow-up refactors suggested (but not done)

## Required Tools

- `read_file`: read files to understand before changing
- `write_file` or `shell_exec("patch")`: apply changes
- `shell_exec`: run tests after each step, run linter
- `list_directory`: find all files affected by a rename or extraction

## Example Usage

User: "This auth.ts file is 800 lines and a mess"
Agent:
1. `read_file("src/auth.ts")` — read the entire file
2. Identify natural groupings: token handling, user lookup, session management
3. Plan: split into `auth/tokens.ts`, `auth/users.ts`, `auth/session.ts`
4. Check tests: `npm test` — all green
5. Extract `tokens.ts` first: copy relevant functions, update imports, run tests
6. Repeat for other files
7. Delete functions from `auth.ts` as they move, run tests after each
8. Report: 800 lines → 3 files of ~250 lines each, all tests green

## Notes

- Never refactor and fix bugs in the same commit — it makes review impossible
- "Three and no more" rule: only extract a function when you've seen the pattern 3+ times
- Ask before splitting modules across packages — it changes the public API
- Circular import detection: `npx madge --circular src/` before and after splitting
- The goal is LESS code, not more abstraction — don't create indirection for its own sake
- If you find a bug while refactoring: note it, finish the refactor, then fix the bug separately
