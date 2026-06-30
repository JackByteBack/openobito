---
name: git-helper
description: "Git operations, conventional commit messages, branch strategy, and PR descriptions."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [git, commits, branches, pull-requests, version-control]
  related_skills: [code-reviewer, doc-writer]
---

# Skill: Git Helper

## Description

Assists with the full Git workflow: composing commit messages, creating branches,
writing PR descriptions, resolving merge conflicts, and explaining git history.
Follows the Conventional Commits specification and the project's existing conventions.

## When to Activate

- User says "commit", "git commit", "write a commit message", "stage and commit"
- User asks "create a PR", "open a pull request", "write the PR description"
- User says "git help", "what branch should I use?", "merge conflict"
- User asks to "push my changes", "create a branch for..."
- User wants to understand git log / history

## Instructions

### Commit Message Workflow

**Step 1 — Understand the changes**
```bash
git diff --staged        # what is staged
git diff HEAD            # all uncommitted changes
git status               # file overview
```

**Step 2 — Write a Conventional Commit message**

Format:
```
<type>(<optional scope>): <short description>

<optional body — wrap at 72 chars>

<optional footer: Breaking Change, Closes #N>
```

Types:
| Type | Use when |
|------|----------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that's not a fix or feature |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `ci` | CI/CD pipeline changes |
| `chore` | Tooling, deps, config (no prod code change) |
| `revert` | Reverts a previous commit |

Rules:
- Subject line: imperative mood ("add", not "added" or "adds"), ≤ 72 chars, no period
- Body: explain WHY not WHAT; what was the problem, why this solution
- Reference issues: `Closes #42`, `Fixes #99`, `Related to #15`
- Breaking changes: `BREAKING CHANGE: <description>` in footer

**Step 3 — Commit**
```bash
git add <files>
git commit -m "feat(auth): add JWT refresh token rotation

Refresh tokens are now single-use and rotated on each use.
This prevents token theft via log exposure or interception.

Closes #142"
```

### Branch Naming

```
feat/<short-description>      # new features
fix/<issue-or-description>    # bug fixes
refactor/<target>             # refactoring
docs/<what>                   # documentation
ci/<pipeline-change>          # CI changes
hotfix/<critical-fix>         # urgent production fixes
```

### PR Description Template

```markdown
## Summary
<!-- 1-3 bullet points on what changed and why -->
- ...

## Changes
<!-- Key files / areas modified -->
- `src/foo.ts`: ...

## Test Plan
- [ ] Unit tests pass (`npm test`)
- [ ] Manually tested: <describe scenario>
- [ ] No regressions in related features

## Related Issues
Closes #N
```

### Merge Conflict Resolution

1. `git status` — list conflicted files
2. `read_file` each conflicted file — look for `<<<<<<<`, `=======`, `>>>>>>>`
3. For each conflict: understand BOTH sides, choose the correct resolution or merge both
4. Remove conflict markers completely
5. `git add <resolved-file>`
6. `git commit` (git generates the merge commit message)

Never blindly pick one side — read both and understand the intent.

### Explaining Git History

```bash
git log --oneline -20              # recent commits
git log --oneline --graph --all    # branch graph
git show <hash>                    # specific commit
git blame <file>                   # who changed what line
git log -p <file>                  # full history of a file
```

## Required Tools

- `shell_exec`: all git commands (`git diff`, `git log`, `git commit`, etc.)
- `read_file`: read conflicted files or files to be committed

## Example Usage

User: "Commit my changes"
Agent:
1. `shell_exec("git diff --staged && git diff HEAD")` — understand what changed
2. Compose a Conventional Commit message based on the changes
3. Present message to user for approval
4. `shell_exec("git commit -m '<message>'")`

User: "Write a PR description for my auth branch"
Agent:
1. `shell_exec("git log main..HEAD --oneline")` — see all commits in this branch
2. `shell_exec("git diff main...HEAD --stat")` — changed files overview
3. Read key changed files for context
4. Write structured PR description using template above

## Notes

- Always show the commit message to the user before committing — don't auto-commit silently
- If the project has a COMMIT_CONVENTION or CONTRIBUTING.md, read it first
- For monorepos, use the scope to indicate which package: `feat(api): ...`
- When amending: `git commit --amend --no-edit` for tiny fixes, full `--amend` for message changes
- `git push --force-with-lease` is safer than `--force` when force-pushing a rebased branch
