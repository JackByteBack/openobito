---
name: file-analyzer
description: "Analyze project structure, understand codebases, map dependencies, and suggest improvements."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [analysis, project-structure, architecture, dependencies, exploration]
  related_skills: [code-reviewer, doc-writer, refactor-helper]
---

# Skill: File Analyzer

## Description

Explores and analyzes project structure to produce a clear mental model of a codebase:
entry points, module boundaries, dependency graph, architectural patterns, and areas
of complexity or risk. Useful when onboarding to a new project or preparing for a
large refactor.

## When to Activate

- User says "analyze this project", "understand this codebase", "map out the structure"
- User asks "what does this file do?", "how is this connected?"
- User wants to know "where is X defined?", "what imports Y?"
- User is onboarding and wants a high-level tour
- Before a major refactor — "what would be affected if I change X?"

## Instructions

### Project-Level Analysis

**Step 1 — Get the lay of the land**
```bash
# Root structure
ls -la
cat package.json 2>/dev/null || cat pyproject.toml 2>/dev/null || cat Cargo.toml 2>/dev/null

# Entry points
find . -name "index.*" -o -name "main.*" -o -name "app.*" | grep -v node_modules | head -20

# Line count by type
find . -type f | grep -v node_modules | grep -v ".git" | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -15
```

**Step 2 — Read key files**
- Entry point (main, index, app)
- Package manifest (package.json, Cargo.toml, go.mod, pyproject.toml)
- Config files (tsconfig, .eslintrc, docker-compose)
- README if present

**Step 3 — Map the module graph**
For each significant directory, read its index or main file and note what it exports.
Build an outline:
```
src/
  api/       → HTTP handlers, routes
  models/    → Database schemas, ORM models
  services/  → Business logic
  utils/     → Shared helpers
```

**Step 4 — Identify patterns and anti-patterns**
- Architectural pattern: MVC, hexagonal, layered, microservices, monolith
- State management: where is shared state held?
- Data flow: request → handler → service → storage → response
- Anti-patterns: circular imports, God classes, missing abstractions, tangled layers

### File-Level Analysis

When asked about a specific file:
1. `read_file(<path>)` — read the full file
2. Summarize: purpose, key exports, notable dependencies
3. Find callers: `shell_exec("grep -r '<export-name>' src/ --include='*.ts' -l")`
4. Note complexity: long functions, deep nesting, many responsibilities

### Dependency Analysis

```bash
# Node.js: show all direct + transitive deps
cat package-lock.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(d['packages'].keys()))" 2>/dev/null | head -30

# Find circular imports (Node)
npx madge --circular src/ 2>/dev/null

# Find largest files
find src/ -name "*.ts" -o -name "*.py" | xargs wc -l 2>/dev/null | sort -rn | head -10
```

### Output Format

```
## Project Analysis: <project name>

### Overview
<1-paragraph summary of what this project is and does>

### Architecture
<Architectural pattern, key design decisions>

### Module Map
<tree with brief description of each key directory/module>

### Entry Points
<where execution starts, main HTTP routes, CLI commands>

### Key Dependencies
<most important external libraries and why they're used>

### Complexity Hotspots
<files/modules with high complexity, many dependents, or technical debt>

### Suggested Improvements
<prioritized list of structural improvements>
```

## Required Tools

- `list_directory`: explore directory trees
- `read_file`: read source files, manifests, configs
- `shell_exec`: run find, grep, wc, and analysis tools

## Example Usage

User: "Analyze this project for me"
Agent:
1. `list_directory(".")` — root structure
2. `read_file("package.json")` — understand tech stack and scripts
3. `list_directory("src/")` — source layout
4. Read entry point(s)
5. Read 3-5 most significant files to understand patterns
6. Produce full structured analysis report

User: "How does the auth module work?"
Agent:
1. `list_directory("src/auth/")` — find all auth files
2. Read each file in order of importance (index → types → handlers)
3. Trace data flow: login request → token generation → session storage
4. Explain with a simple flow diagram in text

## Notes

- Start wide (project level) before going deep (file level)
- For large projects, focus on the files most relevant to the user's question
- If there's a README or architecture doc, read it first — don't reinvent it
- When mapping dependencies, note which ones are unusual or could be removed
- "Complexity hotspot" = many dependents + large file + no tests + many TODOs
