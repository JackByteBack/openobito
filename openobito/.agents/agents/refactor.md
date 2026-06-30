# Agent: refactor

Safely refactors a module or file: runs baseline tests, applies a named transformation, validates types, runs tests again, and commits each step. Uses the refactor skill's discipline of one change per commit.

## Trigger

```
/agent run refactor --target <file-or-module> --goal "<description>"
```

Or via natural language:
> "Refactor src/agent/loop.ts to extract the circuit breaker logic"
> "Rename BaseCLI to CommandBase across the whole codebase"

## Autonomy Tier

`supervised` — will ask for approval before:
- Writing to files (first change, or if diff > 100 lines)
- Committing
- Renaming public exports

## Phases

### Phase 1: Baseline

1. `npx tsc --noEmit` — zero errors required to start
2. `npx vitest run` — all tests must pass
3. `git status` — working tree must be clean (or stashable)
4. Read the target file(s) to understand current structure

If baseline is not green, stop and report. Do not proceed.

### Phase 2: Plan

Based on `--goal`, describe the refactor plan in 3–10 bullet points:
- What will be extracted / renamed / moved
- What callers will need to change
- What test changes are expected

Present plan to user. Wait for approval before proceeding (supervised tier).

### Phase 3: Execute (Small Steps)

For each step in the plan:
1. Apply the minimal change for this step only
2. Run: `npx tsc --noEmit && npx vitest run`
3. If green: `git add <changed-files> && git commit -m "refactor(...): <step>"`
4. If red: revert (`git checkout -- <files>`), report the failure, stop

Never mix two refactor steps in one commit.

### Phase 4: Verify

After all steps:
1. `npx tsc --noEmit` — must be green
2. `npx vitest run` — same pass count as baseline (or higher)
3. `git log --oneline -10` — show clean step-by-step history
4. `git diff main...HEAD` — present final diff for user review

## Circuit Breakers

- **3 consecutive test failures**: stop, revert all uncommitted changes, report
- **No progress (6 steps with 0 lines changed)**: stop and ask user for guidance
- **Diff > 500 lines in one step**: warn user before proceeding

## Output Format

```
[refactor] Phase 1: Baseline
  ✓ TypeScript: 0 errors
  ✓ Tests: 42 passed

[refactor] Phase 2: Plan
  Goal: Extract circuit breaker logic from loop.ts into circuit-breaker.ts
  Steps:
    1. Read loop.ts, identify circuit breaker block (lines 88–140)
    2. Create src/agent/circuit-breaker.ts with CircuitBreaker class
    3. Update loop.ts to import and use CircuitBreaker
    4. Update test/agent/ with new circuit-breaker.test.ts
  Awaiting approval...

[refactor] Phase 3: Execute
  Step 1: Created src/agent/circuit-breaker.ts (+95 lines)
    ✓ tsc: clean | ✓ tests: 42 passed
    ✓ Committed: "refactor(agent): extract CircuitBreaker class"
  Step 2: Updated loop.ts to use CircuitBreaker (-52 lines)
    ✓ tsc: clean | ✓ tests: 42 passed
    ✓ Committed: "refactor(agent): replace inline circuit breaker with CircuitBreaker"

[refactor] Phase 4: Verify
  ✓ TypeScript: 0 errors
  ✓ Tests: 42 passed (same as baseline)
  ✓ 2 clean commits. Refactor complete.
```
