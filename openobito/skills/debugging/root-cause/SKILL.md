---
name: root-cause
description: "Systematic root-cause analysis: reproduce, bisect, hypothesize, verify, and fix bugs."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [debugging, root-cause, bugs, testing, bisect, hypothesis]
    category: debugging
    related_skills: [refactor, git-workflow]
    tools: [read_file, shell_exec, write_file]
    risk: low
---

# Root Cause Analysis

A disciplined bug-hunting methodology that avoids the trap of fixing symptoms. Forces evidence-based debugging: reproduce first, hypothesize second, verify third, fix last.

## When to Use

- A bug report arrived and you don't know where it comes from
- A test is failing and the failure message is not enough to understand why
- A performance regression appeared but has no obvious cause
- Something "works on my machine" but fails in CI or production

## Prerequisites

- A reproducible way to trigger the bug (test, command, or sequence of steps)
- Access to the codebase and test runner
- Clean git history to enable bisect if needed

## How to Run

Invoke via `/skills use root-cause` or ask:

> "Help me debug why the rate limiter is allowing more requests than it should"

## Quick Reference

```
Step 1: Reproduce the bug in a test or command
Step 2: State your hypothesis explicitly before looking at code
Step 3: Find the evidence that confirms or denies the hypothesis
Step 4: Fix only the confirmed root cause — not the symptom
Step 5: Verify the fix with the reproduction case
```

## Procedure

### 1. Reproduce First

A bug you cannot reproduce does not exist for debugging purposes.

```
[exec] npm test -- --grep "rate limiter"   # Run only the failing test
```

If there is no test, write one:

```typescript
it("should reject after 60 requests per minute", () => {
  const rl = new RateLimiter();
  for (let i = 0; i < 60; i++) rl.consume("commands");
  expect(rl.consume("commands").allowed).toBe(false);
});
```

The reproduction case is both your evidence of the bug and your verification of the fix.

### 2. Gather Context

Before forming a hypothesis, gather facts:

```
[read] src/safety/ratelimit.ts
[exec] git log --oneline --follow src/safety/ratelimit.ts
[exec] git log --oneline -20       # Recent commits that might relate
```

Look for:
- When the file last changed
- What the actual vs expected behavior is
- Any error messages, stack traces, or log lines

### 3. State a Hypothesis

Before looking at more code, write down your hypothesis in one sentence:

> "Hypothesis: The rate limiter sliding window is not pruning old timestamps before checking the count, so stale entries inflate the counter."

This forces you to reason before pattern-matching. It also gives you a falsifiable prediction.

### 4. Gather Evidence

Now look for specific evidence:

```
[read] src/safety/ratelimit.ts    # Read the prune() method
```

Either:
- **Hypothesis confirmed**: You find the code matches your prediction. Proceed to fix.
- **Hypothesis denied**: The code does not match. Go back to step 3 with new information.

Never skip straight to fixing without confirming.

### 5. Git Bisect (for Regressions)

If the bug is a regression (worked before, broken now):

```
[exec] git bisect start
[exec] git bisect bad                # Current commit is broken
[exec] git bisect good v1.2.0        # Last known good tag
# Run the failing test on each bisect step:
[exec] npm test -- --grep "failing test"
[exec] git bisect good/bad
# Repeat until bisect identifies the commit
[exec] git bisect reset
```

The commit identified by bisect is where the root cause was introduced.

### 6. Fix Only the Root Cause

Resist the urge to refactor or improve nearby code at the same time. Fix only the specific root cause identified.

```typescript
// Fix: prune before checking count
private prune(w: Window): void {
  if (w.windowMs === 0) return;
  const cutoff = Date.now() - w.windowMs;
  w.timestamps = w.timestamps.filter((t) => t > cutoff);  // ← this was missing
}
```

Keep the fix minimal. A smaller fix is easier to review, easier to revert, and easier to understand.

### 7. Verify the Fix

Run the reproduction case first:

```
[exec] npm test -- --grep "rate limiter"   # Should now pass
[exec] npm test                             # Full suite should still pass
[exec] npx tsc --noEmit                    # No type errors introduced
```

If the reproduction case passes but other tests break, you fixed the symptom not the root cause. Revert and try again.

### 8. Document the Root Cause

Write a commit message that explains the root cause, not just the fix:

```
fix(ratelimit): prune stale timestamps before checking limit

The sliding window was checking the timestamp count before pruning expired
entries. On high-traffic scenarios, stale entries from before the window
inflated the count, causing valid requests to be incorrectly rate-limited
after a quiet period.

Fix: call prune() at the start of both check() and consume().
```

## Pitfalls

- **Fixing before reproducing**: You might fix the wrong thing. Reproduction first, always.
- **Fixing the symptom**: If the fix involves "just skipping" the error path, you've fixed the symptom. The error path exists for a reason.
- **Hypothesis-free debugging**: Random code changes are not debugging. State a hypothesis.
- **Not running the full test suite after fixing**: A fix that breaks other tests is not a fix.
- **Mixing the fix with a refactor**: Fix the bug in one commit. Refactor in a separate commit. The git history should tell the story cleanly.

## Verification

The debugging session is complete when:

- [ ] A test exists that reproduces the original bug (and now passes)
- [ ] The full test suite passes
- [ ] TypeScript compiles cleanly
- [ ] The commit message explains the root cause, not just the change
- [ ] No new warnings or lint errors introduced
