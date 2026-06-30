# Tools And Permissions

## Decision Path

Use the smallest durable surface:

1. Extend an existing tool or policy.
2. Add a skill/instruction workflow.
3. Add a slash or CLI command.
4. Add plugin/provider adapter support.
5. Add a service-gated tool.
6. Add a built-in core tool only when the capability is fundamental.

## Built-In Tool Checklist

- Define a clear schema with stable parameter names.
- Classify risk as `low`, `medium`, `high`, or `critical`.
- Add a default config policy.
- Ensure hidden tools are not exposed in model schemas.
- Return `ToolResult` errors instead of throwing through the loop.
- Log audit entries for deny, approval, and execution paths.
- Add tests in `test/tools/` and `test/permissions/` or `test/safety/`.

## Permission Expectations

- Unknown tools should resolve to the configured default action.
- Destructive, install, network, and shell behaviors should not default to
  unconditional allow.
- Approval prompts should include the tool name, risk, reason, and arguments.
- Secrets must be redacted before display or logging.
- `hide_from_prompt` means the model should not see the tool schema.

## Safety Expectations

- Fail closed for protected paths, credential locations, destructive shell
  patterns, and unknown command classes.
- Keep audit payloads bounded.
- Prefer allowlists for low-risk reads and explicit prompts for writes.

