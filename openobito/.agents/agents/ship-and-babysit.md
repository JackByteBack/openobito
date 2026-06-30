# Agent: ship-and-babysit

A compound workflow that prepares a feature branch for shipping, then monitors the result. Combines pre-flight checks, commit, push, and post-merge validation in one autonomous session.

## Trigger

```
/agent run ship-and-babysit [--branch <name>] [--dry-run]
```

Or via natural language:
> "Ship the current branch and watch for problems"

## Autonomy Tier

`supervised` — will ask for approval before:
- Force-pushing
- Merging to main
- Deploying to production

All other steps run automatically.

## Phases

### Phase 1: Pre-flight

1. `git status` — confirm clean or stashable working tree
2. `npx tsc --noEmit` — zero type errors required
3. `npx vitest run` — all tests must pass
4. `npm audit --audit-level=high` — no High/Critical CVEs
5. `git log --oneline main..HEAD` — summarize commits to be shipped

If any phase-1 check fails, the agent stops and reports the failure. It does not proceed to Phase 2.

### Phase 2: Commit & Push

1. `git add -p` — stage only relevant changes (asks user for large diffs)
2. Generate commit message from diff (conventional commits format)
3. `git commit -m "<generated message>"`
4. `git push origin HEAD` — push branch

**Approval gate**: if branch is `main` or `master`, ask user before push.

### Phase 3: PR / Merge Prep

1. Detect if CI is configured (`/.github/workflows/*.yml` or `/.circleci/`)
2. If CI present: output the PR creation command for the user to run
3. If no CI: run a local smoke test (`npm start -- --smoke` if defined)
4. Summarize: "Branch pushed. N commits ahead of main. Tests: pass. Lint: pass."

### Phase 4: Post-ship Watch (babysit)

If `--watch` flag is set or CI is detected:

1. Poll CI status every 60s for up to 10 minutes
2. If CI passes: output "✓ CI green. Branch is ready to merge."
3. If CI fails: output the failing job name and last 20 lines of log
4. If timeout: output "⚠ CI still running after 10 min. Check manually."

## Error Handling

| Error | Action |
|---|---|
| Type errors | Stop, show errors, do not commit |
| Test failures | Stop, show failing tests, do not commit |
| CVE High/Critical | Stop, show CVE, suggest `npm audit fix` |
| Push rejected | Show error, suggest `git pull --rebase` |
| CI failure | Report failure details, do not auto-merge |

## Circuit Breakers

- **Repeat failure (3×)**: If the same check fails 3 times in a row, stop the workflow and escalate to user.
- **No progress (6×)**: If 6 consecutive steps produce no new output, stop and report stuck state.
- **Hard reject**: If user denies an approval gate, stop the entire workflow.

## Output Format

```
[ship-and-babysit] Phase 1: Pre-flight
  ✓ Working tree clean
  ✓ TypeScript: 0 errors
  ✓ Tests: 42 passed, 0 failed
  ✓ npm audit: 0 High/Critical
  ✓ 3 commits to ship

[ship-and-babysit] Phase 2: Commit & Push
  ✓ Committed: "feat(safety): add AES-256-GCM credential encryption"
  ✓ Pushed to origin/feature/safety-credentials

[ship-and-babysit] Phase 3: PR Prep
  ℹ No CI detected. Smoke test: N/A
  ✓ Branch ready. Run: gh pr create --fill

[ship-and-babysit] Done. 3 commits shipped. No issues detected.
```
