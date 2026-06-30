---
name: security-audit
description: "Code security audit: OWASP top 10 checks, dependency scanning, and policy verification."
version: 1.0.0
author: OpenAgent
license: MIT
platforms: [linux, macos, windows]
metadata:
  openagent:
    tags: [security, audit, owasp, vulnerabilities, dependencies, pen-test]
    category: security
    related_skills: [root-cause, documentation]
    tools: [read_file, shell_exec, web_fetch]
    risk: low
---

# Security Audit

Systematic security audit of a codebase: checks for OWASP Top 10 vulnerabilities, dependency CVEs, credential leaks, injection paths, and policy violations. Produces a prioritized finding report.

## When to Use

- Before releasing a new version or feature
- When a new dependency or integration was added
- After a reported security incident
- As a periodic (quarterly) baseline review
- Before deploying to production or sharing code publicly

## Prerequisites

- Access to the full codebase (`read_file`)
- `npm audit` or equivalent dependency scanner available
- `git log` access (to audit recent changes)

## How to Run

Invoke via `/skills use security-audit` or ask:

> "Run a security audit on the authentication module"

## Quick Reference

```bash
npm audit                              # Known CVEs in dependencies
grep -rn "eval\|innerHTML\|exec" src/  # Injection sinks
grep -rn "\.env\|process\.env" src/    # Credential access patterns
grep -rn "TODO.*security\|FIXME.*auth" # Deferred security work
```

## Procedure

### 1. Dependency Audit

```
[exec] npm audit --json
```

Triage findings by severity:
- **Critical / High**: Must fix before release. No exceptions.
- **Moderate**: Fix in next sprint. Document if deferred.
- **Low**: Acknowledge and track.

For each critical finding, check if the vulnerable code path is actually reachable:

```
[exec] npm audit fix          # Auto-fix compatible updates
[exec] npm audit fix --force  # Force major upgrades (test carefully)
```

### 2. OWASP Top 10 Checks

#### A01: Broken Access Control
```
[read] src/permissions/
[read] src/safety/policy.ts
```
- Verify every tool has a default policy classification
- Verify unknown tools default to deny (fail-closed)
- Check that `hide_from_prompt` tools are actually filtered before model calls

#### A02: Cryptographic Failures
```
[read] src/safety/credentials.ts
```
- Verify AES-256-GCM is used (not DES, 3DES, RC4, MD5, SHA-1 for integrity)
- Verify IVs are randomly generated per encryption (not hardcoded)
- Verify auth tags are checked (GCM auth tag prevents tampering)
- Check for any hardcoded secrets or keys

#### A03: Injection
```
[exec] grep -rn "eval(" src/ --include="*.ts"
[exec] grep -rn "innerHTML" src/ --include="*.tsx"
[exec] grep -rn "execSync\|spawnSync\|exec(" src/ --include="*.ts"
```
- `eval()` — almost always removable
- Shell injection: verify `execSync(cmd)` where `cmd` includes user input is sanitized
- SQL injection: verify all SQLite queries use parameterized statements, not string concat

#### A04: Insecure Design
- Review threat model: what can the LLM actually do?
- Verify the approval system cannot be bypassed programmatically
- Verify audit log entries cannot be deleted by normal tool calls

#### A05: Security Misconfiguration
```
[read] src/config/index.ts
```
- Default security level should be `strict`, not `relaxed`
- No debug endpoints or verbose error messages in production paths
- Verify `.env.example` does not contain real credentials

#### A06: Vulnerable and Outdated Components
Already covered by `npm audit`. Additionally:
```
[exec] npm outdated
```
Check if any package is several major versions behind its current release.

#### A07: Identification and Authentication Failures
- Verify session IDs are cryptographically random (not sequential)
- Verify sessions expire appropriately
- Check for hardcoded test credentials in code or tests

#### A08: Software and Data Integrity Failures
- Verify `package-lock.json` is committed and used in CI (`npm ci` not `npm install`)
- Check `npm audit signatures` if using npm >= 9

#### A09: Security Logging and Monitoring Failures
```
[read] src/safety/audit.ts
```
- Verify all tool executions are logged
- Verify denied operations are logged with reason
- Verify logs cannot be silently swallowed by exceptions

#### A10: Server-Side Request Forgery (SSRF)
If there is a web fetch tool:
- Verify internal network ranges are blocked (10.x, 172.16.x, 192.168.x, 127.x)
- Verify redirects are followed safely (max depth, same-origin policy)

### 3. Credential Leak Scan

```
[exec] git log --all --oneline | head -50    # Recent history
[exec] grep -rn "password\s*=" src/ --include="*.ts"
[exec] grep -rn "api_key\s*=" src/ --include="*.ts"
[exec] grep -rn "AKIA[A-Z0-9]{16}" src/     # AWS access key pattern
```

Also check git history for accidentally committed secrets:
```
[exec] git log --all -p -- "*.env" 2>/dev/null | head -100
```

### 4. Produce Finding Report

Format each finding:

```markdown
## FINDING-001: Shell injection in exec handler

**Severity**: High
**Location**: `src/tools/builtin/shell.ts:34`
**CWE**: CWE-78 (OS Command Injection)

**Description**: The `command` parameter is passed directly to `execSync()` without sanitization. An adversarial LLM or user input could inject shell metacharacters.

**Evidence**:
```typescript
execSync(cmd, { ... })  // cmd comes directly from args
```

**Recommendation**: Use `spawn()` with argv array (no shell interpretation), or validate with a strict allowlist before `execSync()`.

**Status**: Open
```

Prioritize findings: Critical > High > Medium > Low. Fix Critical and High before release.

## Pitfalls

- **False confidence from `npm audit` alone**: Dependency CVEs are a small fraction of security issues. Manual code review is required.
- **Treating Low severity as unimportant**: Low CVEs in widely-used parsing libraries have historically enabled RCE.
- **Not checking the git history**: Secrets accidentally committed and then removed are still in git history.
- **Auditing only the "security" module**: Injection and auth failures happen throughout the codebase.
- **Not verifying fixes work**: After patching a CVE, re-run `npm audit` to confirm the finding is gone.

## Verification

The audit is complete when:

- [ ] `npm audit` shows zero Critical or High findings
- [ ] All OWASP Top 10 checks completed with findings documented
- [ ] Credential scan shows no hardcoded secrets
- [ ] Finding report produced with priority ordering
- [ ] All Critical/High findings have a remediation plan
- [ ] One re-audit pass completed after applying fixes
