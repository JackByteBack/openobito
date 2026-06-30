---
name: test-writer
description: "Write unit tests, integration tests, and test suites. Red-green-refactor TDD pattern."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [testing, unit-tests, tdd, integration-tests, test-coverage]
  related_skills: [debug-assistant, refactor-helper, code-reviewer]
---

# Skill: Test Writer

## Description

Writes comprehensive test suites: unit tests, integration tests, edge case coverage,
and regression tests. Follows the red-green-refactor TDD cycle when writing new code.
Uses the project's existing test framework and conventions.

## When to Activate

- User says "write tests for this", "add unit tests", "test coverage for..."
- User asks "write a test that reproduces this bug" (regression test)
- User is doing TDD: "write the test first, then I'll implement"
- User asks "what's missing from these tests?", "improve test coverage"
- User wants "integration tests for the API endpoints"

## Instructions

### Step 0 — Understand the Test Environment

```bash
# Detect test framework
cat package.json | grep -E '"test"|vitest|jest|mocha|ava'
ls test/ __tests__/ src/**/*.test.* 2>/dev/null

# Run existing tests to see current state
npm test        # or: pytest, cargo test, go test ./...
```

Read 1-2 existing test files to understand: naming conventions, assertion style,
fixture patterns, mock approach.

### What to Test (Priority Order)

1. **Happy path** — the main use case works
2. **Error cases** — what happens when inputs are wrong or operations fail
3. **Edge cases** — empty inputs, zero, null/undefined, max values, concurrent calls
4. **Regression tests** — specific bugs that were fixed (prevents re-introduction)
5. **Integration** — does the component work with its real dependencies?

### Unit Test Structure (AAA Pattern)

```typescript
// Vitest / Jest style
import { describe, it, expect, vi } from "vitest";
import { verifyToken } from "../src/auth/tokens.js";

describe("verifyToken", () => {
  // Happy path
  it("returns payload for a valid token", () => {
    // Arrange
    const secret = "test-secret-32-bytes-minimum-abc";
    const token = createTestToken({ userId: "u1" }, secret);

    // Act
    const result = verifyToken(token, secret);

    // Assert
    expect(result).toMatchObject({ userId: "u1" });
  });

  // Error cases
  it("returns null for an expired token", () => {
    const token = createExpiredToken({ userId: "u1" }, secret);
    expect(verifyToken(token, secret)).toBeNull();
  });

  it("returns null for a tampered token", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.tampered.signature";
    expect(verifyToken(token, secret)).toBeNull();
  });

  // Edge cases
  it("returns null for an empty string", () => {
    expect(verifyToken("", secret)).toBeNull();
  });

  it("throws TokenExpiredError for explicitly expired tokens", () => {
    expect(() => verifyToken(expiredToken, secret)).toThrow(TokenExpiredError);
  });
});
```

### Mocking Strategy

**Mock external dependencies, not the thing you're testing:**
```typescript
// Mock the DB, not the service that uses it
vi.mock("../src/storage/db.js", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "u1", name: "Alice" }),
}));

// Don't mock the real logic — test it
// ❌ vi.mock("../src/auth/tokens.js") // when testing auth.ts
```

**Prefer dependency injection over module mocking:**
```typescript
// Better: pass mock as argument
const service = new AuthService({ db: mockDb, logger: mockLogger });

// Worse: module-level mock (couples test to module path)
vi.mock("../src/db.js");
```

### Regression Test Template

When a bug is reported, write this FIRST:
```typescript
it("regression: <concise bug description> (fixes #<issue>)", () => {
  // This test was red before the fix and green after.
  // Setup the exact scenario that triggered the bug
  const input = <exact-failing-input>;
  
  // Assert the correct behavior (not the buggy behavior)
  expect(fn(input)).toBe(<correct-output>);
});
```

### Integration Test Pattern

```typescript
describe("POST /auth/login (integration)", () => {
  let app: Express;
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase(); // real SQLite in :memory:
    app = createApp({ db });
  });

  afterAll(async () => {
    await db.close();
  });

  it("returns 200 and a token for valid credentials", async () => {
    await db.insertUser({ email: "a@b.com", password: hash("pass") });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@b.com", password: "pass" });

    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^ey/); // JWT
  });
});
```

### Coverage Audit

After writing tests, check coverage:
```bash
npm test -- --coverage        # Vitest / Jest
pytest --cov=src/             # Python
cargo tarpaulin               # Rust
```

Look for uncovered: error branches, early-return guards, catch blocks, else paths.

### Naming Conventions

- `describe`: name the unit under test — `describe("verifyToken", ...)`
- `it`: complete sentence — `it("returns null for an expired token", ...)`
- Test file: `<module>.test.ts` next to the source, or `test/<module>.test.ts`
- Fixture helpers: `createUser()`, `buildOrder()`, not `makeObj()` or `fixture()`

## Required Tools

- `read_file`: read source being tested + existing test files for conventions
- `write_file`: write new test files
- `shell_exec`: run tests to verify red/green, check coverage

## Example Usage

User: "Write tests for src/auth/tokens.ts"
Agent:
1. `read_file("src/auth/tokens.ts")` — understand every exported function
2. `list_directory("test/")` — find existing tests for conventions
3. Read one existing test file to match style
4. Write `test/auth/tokens.test.ts` with unit tests for all exports
5. `shell_exec("npm test test/auth/tokens.test.ts")` — verify all green
6. Report: N tests written, M cases covered

User: "This bug keeps coming back — write a regression test"
Agent:
1. Understand the exact input that triggers the bug
2. Write a test that is RED before the fix
3. Verify it goes GREEN after the fix is applied
4. Name it: `regression: <description> (fixes #<N>)`

## Notes

- Always run `npm test` before writing tests — start from a green baseline
- Write the test before the fix for regression tests (TDD discipline)
- One assertion per test when possible — makes failures clear
- Avoid testing implementation details — test the public contract
- Don't test library code — test your code's use of the library
- Snapshot tests are useful for output formats but brittle for logic — prefer explicit assertions
- For async code: always `await` or `return` the promise, never fire-and-forget in tests
