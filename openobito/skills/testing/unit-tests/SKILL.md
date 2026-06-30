---
name: unit-tests
description: "Write fast, isolated unit tests with Vitest: arrange-act-assert, mocks, and edge cases."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [testing, unit-tests, vitest, mocks, coverage, tdd]
    category: testing
    related_skills: [refactor, root-cause, code-review]
    tools: [read_file, write_file, shell_exec]
    risk: low
---

# Unit Tests

Write targeted, fast unit tests using Vitest. Follows the arrange-act-assert pattern: every test sets up its own state, calls exactly one thing, and asserts on outcomes — not on implementation details.

## When to Use

- Adding tests for new functions or modules
- Writing regression tests before fixing a bug
- Increasing coverage for untested existing code
- Replacing flawed tests that couple to implementation
- Before refactoring: establish a characterization test suite

## Prerequisites

- Vitest installed (`npm install -D vitest`)
- The module to be tested is importable
- Test can be run with `npx vitest run` or `npm test`

## How to Run

Invoke via `/skills use unit-tests` or ask:

> "Write unit tests for the RateLimiter class"

## Quick Reference

```bash
npx vitest run                         # Run all tests once
npx vitest run test/safety/            # Run tests in a directory
npx vitest --coverage                  # Coverage report
npx vitest run --reporter=verbose      # Verbose output
```

## Procedure

### 1. Read the Code Under Test

```
[read] src/safety/ratelimit.ts
```

List the behaviors to test:
- Happy path (normal usage)
- Edge cases (zero, max, boundary)
- Error conditions (invalid input, missing deps)
- State transitions (if stateful)

Do not look at the existing tests first — form independent expectations.

### 2. Structure: One File Per Module

```
src/safety/ratelimit.ts     → test/safety/ratelimit.test.ts
src/agent/loop.ts           → test/agent/loop.test.ts
src/cli/slash/base.ts       → test/cli/slash/base.test.ts
```

Mirror the source tree under `test/`. Use `.test.ts` suffix.

### 3. Arrange-Act-Assert (AAA) Pattern

Every test follows three phases:

```typescript
it("should reject after hitting the per-minute limit", () => {
  // Arrange: set up state
  const rl = new RateLimiter({ commands: { perMinute: 5 } });

  // Act: call the thing under test
  for (let i = 0; i < 5; i++) rl.checkAndConsume("commands");
  const result = rl.checkAndConsume("commands");

  // Assert: verify the outcome
  expect(result.allowed).toBe(false);
  expect(result.retryAfterMs).toBeGreaterThan(0);
});
```

Rules:
- One logical assertion per test (multiple `expect()` calls are fine if they test one concept)
- Never assert on implementation (don't check internal timestamps arrays — check behavior)
- Never share state between tests — each `it` block builds its own

### 4. Naming Convention

```
"[unit] [condition]"  →  describes what happens under what circumstance

Good:
  "allows first request when limit not reached"
  "rejects when per-minute limit is exactly met"
  "resets count after window expires"
  "throws when config is missing required field"

Bad:
  "test rate limiter"
  "should work"
  "handles edge case"
```

Use `describe()` to group tests by class or behavior:

```typescript
describe("RateLimiter", () => {
  describe("checkAndConsume()", () => {
    it("allows first request", () => { ... });
    it("rejects after limit", () => { ... });
  });
  describe("reset()", () => { ... });
});
```

### 5. Mocking

Use mocks sparingly. Mock only at system boundaries:
- External HTTP calls (`web_fetch`)
- File system writes (`fs.writeFile`)
- Database calls
- Time (`Date.now`)

Do NOT mock:
- Functions in the same module you are testing
- Pure helper functions
- TypeScript types

```typescript
import { vi } from "vitest";

// Mock time so sliding windows are deterministic
const now = vi.spyOn(Date, "now");
now.mockReturnValue(1_700_000_000_000);

// ... test ...

now.mockRestore();
```

For database or file system:
```typescript
import { vi } from "vitest";
import * as fs from "node:fs/promises";

vi.spyOn(fs, "writeFile").mockResolvedValue();
```

### 6. Edge Cases Checklist

Always test:
- [ ] Empty input (`""`, `[]`, `{}`, `null`, `undefined`)
- [ ] Single item (list with one element)
- [ ] Boundary values (limit exactly, limit - 1, limit + 1)
- [ ] Concurrent calls (if the unit is stateful)
- [ ] Error conditions (what the function throws/returns on bad input)

### 7. Test File Template

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MyClass } from "../../src/module/myclass.js";

describe("MyClass", () => {
  let instance: MyClass;

  beforeEach(() => {
    instance = new MyClass();
  });

  describe("methodName()", () => {
    it("does X when Y", () => {
      // Arrange
      // Act
      // Assert
    });

    it("throws when Z is missing", () => {
      expect(() => instance.methodName(null as any)).toThrow(TypeError);
    });
  });
});
```

### 8. Run and Confirm

```
[exec] npx vitest run test/path/to/new.test.ts   # Run just the new file
[exec] npx vitest run                             # Full suite must still pass
[exec] npx tsc --noEmit                          # No type errors in test files
```

Check coverage for the module:
```
[exec] npx vitest run --coverage --include=src/module/myclass.ts
```

## Pitfalls

- **Testing implementation details**: If you test internal variable state, the test breaks on any refactor even when behavior is preserved. Test outputs, not internals.
- **Shared mutable state between tests**: `beforeEach` must reset all state. Global variables in test files persist across `it` blocks.
- **Over-mocking**: If you mock 5 things to test 1 function, you are testing the mocks. Extract the dependency or test at a higher level.
- **No negative tests**: Happy-path-only suites miss the bugs that happen at limits and error conditions.
- **Snapshot tests for logic**: Snapshots are for UI components. For business logic, assert on specific values.
- **Test count inflation**: 50 tests that each test one branch of a switch is not better than 5 tests that together cover all cases. Aim for signal, not count.

## Verification

The test suite is ready when:

- [ ] Every public function has at least one test
- [ ] All error paths and edge cases have tests
- [ ] `npx vitest run` exits with code 0
- [ ] `npx tsc --noEmit` exits with code 0 (test files included)
- [ ] No `any` casts in test files used to bypass type safety
- [ ] No tests rely on implicit ordering or shared state
