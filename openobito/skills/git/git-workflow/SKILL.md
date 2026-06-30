---
name: git-workflow
description: "Full git workflow: branch, commit, PR creation, and push with safety checks."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [git, github, version-control, pr, branch, commit]
    category: software-development
    related_skills: [code-review, refactor]
    tools: [shell_exec, read_file, write_file]
    risk: medium
---

# Git Workflow

Guides the agent through a safe, complete git development cycle: creating a feature branch, making commits with conventional messages, pushing, and opening a pull request. Enforces safety checks at each stage.

## When to Use

- Starting work on a new feature or bug fix
- Committing and pushing changes to a remote repository
- Opening a pull request on GitHub or GitLab
- When you want structured, safe git operations with approval checkpoints

## Prerequisites

- Git installed and configured (`git config user.name`, `git config user.email`)
- Remote repository accessible (`git remote -v`)
- Working directory is a git repository (`git status` succeeds)
- For PR creation: `gh` CLI installed and authenticated (`gh auth status`)

## How to Run

Invoke this skill by typing `/skills use git-workflow` or ask the agent:

> "Follow the git workflow to commit my changes and open a PR"

## Quick Reference

```bash
git checkout -b feat/<name>     # Create feature branch
git add -p                       # Stage changes interactively
git commit -m "feat: <message>" # Conventional commit
git push -u origin <branch>     # Push (first time)
gh pr create --fill             # Open PR via gh CLI
```

## Procedure

### 1. Verify Repository State

```
[read] git status
[read] git remote -v
[read] git log --oneline -5
```

Confirm:
- Working tree is not detached HEAD
- Remote `origin` exists
- You are not on `main` or `master` (warn if so)

### 2. Create Feature Branch

Branch naming convention: `<type>/<short-description>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

```
[exec] git checkout -b feat/your-feature-name
```

Skip if already on a non-default branch.

### 3. Review Changes

```
[read] git diff --stat
[read] git diff
```

Summarize what changed before staging. Flag any unexpected changes.

### 4. Stage Changes

Prefer interactive staging to avoid committing unintended files:

```
[exec] git add -p
```

Or target specific files:

```
[exec] git add src/path/to/file.ts
```

**Never stage**: `.env`, credential files, `node_modules/`, `dist/`, binary files > 1MB.

### 5. Write Conventional Commit

Format: `<type>(<scope>): <description>`

```
feat(auth): add OAuth2 login flow
fix(api): handle null response from model endpoint
chore(deps): upgrade better-sqlite3 to 11.x
docs(readme): add installation instructions for Windows
```

```
[exec] git commit -m "<type>(<scope>): <description>"
```

For multi-line bodies:
```
[exec] git commit -m "<type>: <short summary>" -m "<detailed explanation>"
```

### 6. Push Branch

First push requires upstream tracking:

```
[exec] git push -u origin <branch-name>
```

Subsequent pushes:

```
[exec] git push
```

**Never use**: `git push --force` (blocked). Use `git push --force-with-lease` only when rebasing.

### 7. Open Pull Request

```
[exec] gh pr create \
  --title "<type>: <description>" \
  --body "## Summary\n- <bullet 1>\n- <bullet 2>\n\n## Test plan\n- [ ] Unit tests pass\n- [ ] Manual smoke test" \
  --base main
```

Or interactively:
```
[exec] gh pr create --fill
```

## Pitfalls

- **Committing secrets**: Always check `git diff --cached` before committing. The safety system will flag credential patterns.
- **Force push to main**: Blocked by policy. If you need to rewrite history, use `--force-with-lease` on feature branches only.
- **Large files**: Warn if any staged file exceeds 1 MB. Suggest `.gitignore` or git-lfs.
- **Merge vs rebase**: Prefer rebase for clean history on feature branches, merge for integration.
- **Detached HEAD**: Run `git checkout -b <new-branch>` to recover.
- **Wrong branch**: Always verify current branch before committing.

## Verification

After completing the workflow:

```
[read] git log --oneline -3          # Confirm commit appears
[read] gh pr view                    # Confirm PR is open
[read] git status                    # Confirm clean working tree
```

Expected: working tree clean, PR URL printed, CI checks initiated.
