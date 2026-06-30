---
name: debug-assistant
description: "Debug errors and unexpected behavior using 4-phase root-cause analysis."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [debugging, troubleshooting, root-cause, errors, tracing]
  related_skills: [test-writer, code-reviewer, file-analyzer]
---

# Skill: Debug Assistant

## Description

Debugs errors, crashes, and unexpected behavior using a disciplined 4-phase process:
reproduce → root cause → hypothesis → fix. Never guesses. Never applies multiple
fixes at once. Always finds the root cause before touching code.

## When to Activate

- User pastes an error, stack trace, or exception
- User says "it's broken", "this doesn't work", "why is this failing?"
- Tests are failing and the cause is unclear
- User says "debug this", "help me trace this error", "it crashes when..."
- Unexpected output or behavior without an obvious error message

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE FIRST.
Symptom patches are failure.
```

If you haven't completed Phase 1 (reproduce + understand), you cannot write code.

## Instructions

### Phase 1 — Reproduce and Understand (REQUIRED FIRST)

**Read the error completely**
- Full stack trace, all lines — don't skip the middle
- Note: file path, line number, error type, error message
- Note: what was the user doing when it happened?

**Build a tight feedback loop**
The goal is one command that goes red now and green when fixed:
```bash
# Failing test
npm test -- --testNamePattern="specific test"

# Direct repro
node src/broken-thing.js

# With specific input
echo '{"id": 0}' | node src/handler.js
```

If there's no repro yet, ask the user: "Can you give me a command that reliably triggers the error?"

**Check recent changes**
```bash
git log --oneline -10    # what changed recently?
git diff HEAD~1          # what did the last commit change?
git stash                # does the bug exist without recent changes?
```

**Gather evidence: read the failing code**
1. `read_file` the file at the line number in the stack trace
2. Trace up the call stack — where was the bad value set?
3. `shell_exec("grep -r 'functionName' src/ --include='*.ts'")` — find all callers

**Phase 1 completion gate:**
- [ ] I can reproduce the error with a single command
- [ ] I have read the full error and stack trace
- [ ] I know WHAT is wrong and WHERE in the code
- [ ] I have a hypothesis for WHY it is wrong

Do not proceed until all four are checked.

---

### Phase 2 — Pattern Analysis

**Find working examples**
```bash
# Is there similar code elsewhere that works?
grep -r "similarFunction\|similarPattern" src/ --include="*.ts" -l
```

**Compare working vs broken**
- What's different between the working call and the failing one?
- Is the input different? The context? The environment?
- List every difference, however small. Don't assume "that can't matter."

---

### Phase 3 — Form and Test Hypotheses

Generate 2–4 ranked hypotheses before testing any:
1. Most likely cause based on evidence
2. Second most likely
3. ...

For each: state the prediction — "If this is the cause, then doing X should reveal Y."

Test the highest-ranked hypothesis with the MINIMUM change:
- Add ONE `console.log` / `print` — not five
- Change ONE variable — not three
- Run the tight loop after each change

If wrong: form a NEW hypothesis. Don't stack more fixes.

**Rule of Three:** If 3+ fixes have failed, STOP. The architecture may be wrong.
Discuss with the user before attempting another fix.

---

### Phase 4 — Implement the Fix

Only when root cause is confirmed:
1. Write a regression test FIRST (it should be red now)
2. Apply the minimal fix to the root cause
3. Run: tight loop (red → green) + full test suite (no new failures)
4. Explain what the root cause was and why your fix addresses it

---

### Common Error Patterns

**TypeError / AttributeError / nil pointer**
→ Something is `null`/`undefined`/`nil` when it shouldn't be. Trace where it's set.

**Import / Module not found**
→ Wrong path, missing install, wrong export name. Check: `ls node_modules/<pkg>`, `cat package.json`.

**Promise rejection / async error**
→ Missing `await`, unhandled promise, race condition. Add `try/catch` around the `await`.

**Port already in use**
→ `lsof -i :<port>` or `ss -tlnp | grep <port>` then kill the occupying process.

**Environment-specific failure**
→ Check env vars: `env | grep RELEVANT_VAR`. Check NODE_ENV, PATH, working directory.

**Test passes locally, fails in CI**
→ Timezone, file path case sensitivity, missing env vars, different Node/Python version.

## Required Tools

- `shell_exec`: run tests, reproduce errors, check git history, grep
- `read_file`: read source files at error locations
- `list_directory`: find related files and test suites

## Example Usage

User: "Getting TypeError: Cannot read properties of undefined (reading 'id') at user.ts:42"
Agent:
1. `read_file("src/user.ts")` — read around line 42
2. Identify what's undefined and trace back to where it's supposed to be set
3. `shell_exec("grep -n 'getUser\|userId' src/ -r --include='*.ts'")` — find callers
4. Identify root cause (e.g., async function not awaited, DB query returning null)
5. Write a test that reproduces it, then fix, then verify

## Notes

- Never apply more than one fix at a time — you can't isolate what worked
- "It's probably X" is not root cause — prove it with evidence before fixing
- If you can't reproduce it, say so — ask the user for more info rather than guessing
- Flaky tests need a reproduction strategy: run 100x, add stress, pin time/randomness
- Log lines added for debugging should be tagged: `// [DEBUG-tmp]` for easy removal
