# @openagent/permissions.md

## Best features extracted

### 1) Multi-tier risk classification + approval gates (OpenHuman + Hermes)
OpenAgent has a permission system; OpenHuman describes an autonomy model with approval gates and command classes.
Hermes adds task/tool risk levels (Low/Medium/High/Critical) and strong defaults.

**Recommended policy model**
- Classify each tool/command into a risk tier.
- Map tier → default action:
  - Low: allow
  - Medium: require approval
  - High: require approval
  - Critical: deny

### 2) Command classes
OpenHuman uses a command classification model:
- Read / Write / Network / Install / Destructive

**OpenAgent adoption**
- Extend permissions beyond “tool name” to include semantic classes.
- Derive risk tier from class + tool capability.

### 3) Approval gating must be explicit and time-bounded
OpenHuman notes approval TTLs (e.g., 10 minutes) and interactive approval UX.

**OpenAgent adoption**
- Ensure approvals are visible and traceable.
- If approvals expire, document TTL semantics.

### 4) Sandbox/constraint patterns
OpenHuman emphasizes sandbox backends and path hardening.

**OpenAgent adoption**
- If you support shell execution:
  - gate it
  - restrict file/network scope when possible
  - ensure path handling is safe.

## How to design new tools with permissions
When adding a new tool to OpenAgent:
1. Decide its semantic class (Read/Write/Network/Install/Destructive).
2. Assign a risk tier.
3. Choose a default policy action.
4. Ensure the tool’s runtime behavior matches the chosen class.
5. Update docs and any built-in permission examples.

## Example permission policy YAML (OpenAgent style)
```yaml
permissions:
  defaultAction: require_approval
  policies:
    - toolName: read_file
      action: allow
      riskLevel: low
    - toolName: write_file
      action: require_approval
      riskLevel: medium
    - toolName: shell_exec
      action: require_approval
      riskLevel: high
    - toolName: delete_file
      action: deny
      riskLevel: critical
```

