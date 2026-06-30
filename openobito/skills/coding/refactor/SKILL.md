---
name: refactor
description: "Safe, incremental code refactoring with tests-first discipline and rollback awareness."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [refactor, typescript, clean-code, tests, maintainability]
    category: software-development
    related_skills: [git-workflow, code-review]
    tools: [read_file, write_file, shell_exec]
    risk: medium
---

# Refactor

Guides safe, incremental refactoring of TypeScript/JavaScript code. Enforces the discipline of running tests before and after each change, taking small steps, and preserving behavior.

## When to Use

- Improving code structure, readability, or performance without changing behavior
- Extracting duplicate logic into shared helpers
- Renaming symbols for clarity across a codebase
- Reducing module coupling or splitting oversized files (>500 lines)
- Migrating from one pattern to another (e.g., callbacks → async/await)

## Prerequisites

- Existing test suite that can be run (`npm test` or equivalent)
- Clean git working tree (all prior changes committed or stashed)
- TypeScript compiler available (`npx tsc --noEmit`)
- Understanding of what behavior must be preserved

## How to Run

Invoke via `/skills use refactor` or ask:

> "Refactor the authentication module to separate concerns"

## Quick Reference

```bash
npm test                    # Baseline: all tests must pass before starting
npx tsc --noEmit           # Type-check before touching anything
git stash                  # Stash unrelated work if needed
# ... make changes ...
npm test                   # Must still pass after each step
npx tsc --noEmit           # Must still type-check
git diff                   # Review changes before committing
```

## Procedure

### 1. Establish a Baseline

Before touching anything, confirm the codebase is green:

```
[exec] npm test            # Must: all pass
[exec] npx tsc --noEmit   # Must: zero errors
[read] git status          # Must: clean tree
```

If tests fail at baseline, stop and fix them first — refactoring on broken ground creates noise.

### 2. Understand the Target

Read the code to be refactored:

```
[read] src/module/target.ts
[read] test/module/target.test.ts    # Read tests to understand intent
```

List what the code currently does. List what behavior must be preserved.

### 3. Plan the Refactor

Describe the transformation in one sentence before touching code:

> "Extract the database connection logic from `agent/loop.ts` into `storage/connection.ts` and update all import sites."

Use the **Footprint Ladder**: if the refactor can be done with zero new exports, do that. If it needs new files, add only what is needed.

### 4. Take Small Steps (One at a Time)

Each step should:
- Be independently reversible via `git checkout <file>`
- Keep all tests passing
- Not mix concern (do not rename AND restructure in the same commit)

Common steps:

**Extract function**
```typescript
// Before: inline logic
function process(items: Item[]) {
  const filtered = items.filter(x => x.active && x.score > 0.5);
  // ...
}

// After: named helper
function filterActive(items: Item[]): Item[] {
  return items.filter(x => x.active && x.score > 0.5);
}
function process(items: Item[]) {
  const filtered = filterActive(items);
}
```

**Rename symbol** (use sed or find-replace, then verify with grep):
```
[exec] grep -rn "oldName" src/ --include="*.ts"
# edit files
[exec] grep -rn "oldName" src/ --include="*.ts"   # verify zero hits
```

**Split large file**:
- Extract types into `types.ts`
- Extract helpers into `helpers.ts`
- Keep main logic in original file
- Update imports across codebase

### 5. Test After Every Step

```
[exec] npm test
[exec] npx tsc --noEmit
```

If tests break, revert immediately:
```
[exec] git checkout -- src/module/target.ts
```

Never accumulate multiple failing steps.

### 6. Commit Each Logical Step

```
[exec] git add -p
[exec] git commit -m "refactor(module): extract <description>"
```

One refactor action per commit. Makes bisect and rollback trivial.

## Pitfalls

- **Mixing refactor with feature work**: Never. If you find a bug while refactoring, file a note and continue — fix it in a separate commit.
- **Renaming public APIs without deprecation**: Public API changes are not refactoring. Add a deprecation alias and plan a migration.
- **Skipping baseline tests**: If you skip step 1 and tests break later, you cannot attribute the breakage to your changes.
- **Mass automated renames without verification**: `sed -i` renames can hit comments, strings, or documentation. Always verify with `grep` after.
- **Refactoring without test coverage**: If the code to be refactored has no tests, write characterization tests first.
- **Changing multiple abstractions simultaneously**: Extract → test. Move → test. Rename → test. Never combine.

## Verification

After completing the refactor:

```
[exec] npm test                    # All tests pass (same count as baseline)
[exec] npx tsc --noEmit           # Zero type errors
[read] git log --oneline -10      # Clean commit history
[exec] git diff main...HEAD       # Final diff is reasonable
```

The refactor is complete when:
1. All tests pass with the same or better coverage
2. TypeScript compiles cleanly
3. The diff is smaller or more readable than the original code
4. No behavior has been added or removed
