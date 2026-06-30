---
name: doc-writer
description: "Write README files, JSDoc/TSDoc comments, inline documentation, and API references."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [documentation, readme, jsdoc, tsdoc, comments, api-reference]
  related_skills: [code-reviewer, file-analyzer]
---

# Skill: Doc Writer

## Description

Writes, improves, and audits documentation: README files, JSDoc/TSDoc/Docstring
comments, inline code comments, API references, and CONTRIBUTING guides. Reads the
code to understand what it actually does — never invents behavior.

## When to Activate

- User says "write a README", "document this", "add comments", "JSDoc for this"
- User asks "write docs for the API", "generate documentation"
- User says "this code has no comments", "improve the docs"
- After implementing a new module, function, or class
- User wants a CONTRIBUTING.md or API reference

## Instructions

### README Writing

A great README answers five questions in order:

**Template:**
```markdown
# Project Name

> One-sentence tagline.

## What It Does
<2-3 sentences. What problem does it solve? Who is it for?>

## Quick Start
\`\`\`bash
npm install -g myproject
myproject --help
\`\`\`

## Installation
<Prerequisites, then step-by-step install>

## Usage
<Most common use cases with copy-pasteable examples>

## Configuration
<Key config options with defaults and explanations>

## API Reference
<For libraries: key exports, types, functions>

## Contributing
<How to run tests, PR process, code style>

## License
MIT
```

Rules:
- Lead with value, not history or philosophy
- Every code block must be copy-pasteable and actually work
- Include a "Quick Start" that gets to hello world in < 60 seconds
- Link to deeper docs rather than stuffing everything in

### JSDoc / TSDoc Comments

**When to add comments:**
- Public API (exported functions, classes, types)
- Non-obvious logic ("why" not "what")
- Complex algorithms or business rules
- Parameters with non-obvious constraints

**When NOT to add comments:**
- Trivially obvious code (`// increment counter` above `i++`)
- Internal implementation details that could just be renamed
- Restating the function name in prose

**Format (TypeScript / TSDoc):**
```typescript
/**
 * Validates a JWT token and returns the decoded payload.
 *
 * @param token - Raw JWT string from the Authorization header
 * @param secret - HMAC-SHA256 signing secret (min 32 bytes)
 * @returns Decoded payload, or null if the token is invalid or expired
 * @throws {TokenExpiredError} If the token has expired (exp claim in the past)
 *
 * @example
 * const payload = verifyToken(req.headers.authorization?.slice(7), process.env.JWT_SECRET);
 * if (!payload) return res.status(401).end();
 */
export function verifyToken(token: string, secret: string): JwtPayload | null
```

**Format (Python / Docstrings):**
```python
def verify_token(token: str, secret: str) -> dict | None:
    """
    Validate a JWT and return the decoded payload.

    Args:
        token: Raw JWT string (without "Bearer " prefix).
        secret: HMAC-SHA256 signing secret.

    Returns:
        Decoded payload dict, or None if invalid/expired.

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
    """
```

### Inline Comments

Good inline comments explain WHY, not WHAT:
```typescript
// Retry with exponential backoff — Ollama rate-limits at 10 req/s per model
await sleep(100 * Math.pow(2, attempt));

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
// config is guaranteed non-null here: validated at startup in cli/index.ts:94
const value = config!.model;
```

### API Reference Generation

1. `list_directory("src/")` — find all exported modules
2. Read each public module's types and exports
3. Group by category (not by file)
4. For each export: name, description, parameters, return type, example

### Auditing Existing Docs

Check for:
- Functions with no docstring/JSDoc at all (public API)
- Outdated examples (parameter names changed, API evolved)
- Broken links
- README that describes removed features
- Missing `@throws` / `Raises` for documented error paths

## Required Tools

- `read_file`: read source code to document accurately
- `list_directory`: find all files needing documentation
- `shell_exec` (optional): `grep -r "export " src/ --include="*.ts"` to find all public API

## Example Usage

User: "Write JSDoc for all the functions in src/auth.ts"
Agent:
1. `read_file("src/auth.ts")` — understand every function
2. For each exported function: understand parameters, return value, error cases
3. Write TSDoc comments for each, grounded in the actual implementation
4. Write back the file with comments added

User: "Write a README for this project"
Agent:
1. `read_file("package.json")` — name, description, scripts
2. `list_directory("src/")` — understand structure
3. Read entry point to understand what the project does
4. Write README using the template above
5. Include real, working examples from the actual API

## Notes

- ALWAYS read the code first — never invent behavior that isn't there
- If a function does something surprising, document that with extra care
- For monorepos, each package needs its own README
- Keep examples minimal but complete — a reader should be able to copy-paste and run
- When improving existing docs: don't delete existing content that's accurate, just add and clarify
- For `@param` descriptions: include units ("milliseconds"), ranges ("1–100"), constraints ("non-empty")
