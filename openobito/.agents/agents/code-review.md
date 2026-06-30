# Agent: code-review

Autonomous code review over a diff or a set of files. Reviews across four dimensions (correctness, safety, readability, test coverage), produces a prioritized finding list, and optionally creates a GitHub PR comment.

## Trigger

```
/agent run code-review [--diff <range>] [--file <path>] [--pr <number>]
```

Or via natural language:
> "Review the changes in this branch"
> "Review src/safety/credentials.ts for security issues"

## Autonomy Tier

`readonly` — this agent only reads files and executes read-only commands. It never writes files or modifies git state.

## Phases

### Phase 1: Gather Diff

If `--diff` provided:
```
git diff <range>
```

If `--file` provided:
```
git diff HEAD -- <path>
```

If `--pr` provided (GitHub CLI required):
```
gh pr diff <number>
```

If none provided:
```
git diff main...HEAD
```

Parse the diff into a list of (file, hunk) pairs.

### Phase 2: Read Full Files

For each changed file, read the complete current version (not just the diff hunk). This allows the reviewer to understand callers, types, and context that the diff alone omits.

For TypeScript files, also read:
- The corresponding test file (if it exists)
- The types file for the module (if it exists)

### Phase 3: Run Static Checks

```
npx tsc --noEmit          # Type errors
```

If `eslint` is configured:
```
npx eslint <changed-files>
```

Collect any errors. These become automatic findings (Blocking - Type Error or Blocking - Lint Error).

### Phase 4: Review Across Dimensions

Apply the code-review skill (`skills/productivity/code-review/SKILL.md`) to each changed file.

Dimensions:
1. **Correctness** — logic errors, off-by-ones, silent error swallowing
2. **Safety** — injection, path traversal, secrets, data loss, crashes
3. **Readability** — naming, length, magic numbers, dead code
4. **Test Coverage** — missing tests, deleted tests, untested error paths

For each finding, record:
- Dimension (Correctness / Safety / Readability / Test)
- Severity (Blocking / Suggestion)
- File + line number
- Description
- Recommended fix

### Phase 5: Produce Report

Output the review as Markdown. If `--pr` was provided and GitHub CLI is available, optionally post as a PR review comment (user approval required before posting).

```
/agent run code-review --pr 42 --post    # Post to GitHub PR (requires approval)
```

## Circuit Breakers

- If diff > 2000 lines: warn user, offer to review only the most critical files
- If `tsc` times out after 60s: skip type-check, note in report
- Hard reject on any write operation

## Output Format

```markdown
## Code Review: feat/safety-credentials

**Files changed**: 3 | **Lines changed**: +187 / -12 | **Tests changed**: Yes

### 🚫 Blocking Issues

1. **Safety** — `src/safety/credentials.ts:45`
   IV is derived from a counter, not random. Reusing IVs with AES-GCM breaks confidentiality.
   Fix: `const iv = crypto.randomBytes(12);`

### 💡 Suggestions

1. **Readability** — `src/safety/credentials.ts:88`
   `kdf()` is a 70-line function. Extract key derivation steps into named helpers.

### ✅ Looks Good

- AES-256-GCM with auth tag verification is the correct choice for this threat model
- Test coverage for all 12 credential detection patterns is thorough

### Static Check Results
- TypeScript: ✓ 0 errors
- ESLint: ✓ 0 errors
```

## Notes

- This agent is read-only. It will never modify files.
- For large PRs, it reviews the highest-risk files first (files matching `src/safety/`, `src/auth/`, `src/agent/`).
- Posting to GitHub PRs requires `gh` CLI and user approval.
