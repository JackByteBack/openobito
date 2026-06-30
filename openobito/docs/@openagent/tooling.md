# @openagent/tooling.md

## Best features extracted

### 1) Footprint ladder (capability decision)
Hermes formalizes how to decide the *least-footprint* integration point for new capability:
1. Extend existing code
2. CLI command + skill
3. Service-gated tool
4. Plugin
5. MCP server (catalog)
6. New core tool (last resort)

**OpenAgent adoption**
Use this ladder when deciding where a new capability should live.

### 2) Core tools require strong justification
A Hermes rule: model tools are expensive because they appear on every model call.

**OpenAgent adoption**
- Avoid adding tools to the model-visible toolset unless:
  - it’s fundamental
  - it’s broadly useful
  - it’s not achievable via CLI/skills/plugins.

### 3) Tool registry abstraction
Hermes uses an auto-discovered registry and toolsets.

**OpenAgent adoption**
- Keep a tool registry that:
  - defines schema
  - defines runtime handler
  - defines risk tier + default permission action
  - supports optional enable/disable by config.

### 4) Don’t hardcode cross-tool references in schemas
Hermes warns: tool descriptions must not mention other tools by name if those tools can be disabled/unavailable.

**OpenAgent adoption**
- In tool descriptions/prompts, prefer semantic guidance ("use file reading") over exact tool names.
- If cross-tool references are needed, generate them dynamically based on enabled tools.

## Suggested OpenAgent tool metadata
Each tool definition should include:
- name
- JSON schema for arguments
- description
- semantic class
- risk level
- default permission action
- availability conditions (enabled toolset/plugins/config gates)

## Verification checklist
- Confirm permissions are enforced before tool execution.
- Confirm tool args validation and safe error messages.
- Confirm tool outputs are sanitized for UI.

