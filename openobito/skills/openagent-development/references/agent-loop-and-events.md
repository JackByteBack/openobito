# Agent Loop And Events

## Agent Loop Contracts

- Keep the system prompt stable during a session.
- Preserve message role alternation.
- Append assistant tool-call messages before tool result messages.
- Bound tool rounds and surface a stop reason when a bound is reached.
- Treat denied tools and user-denied approvals as tool results that the model
  can recover from.
- Never let tool handler exceptions crash the whole loop.

## Event Contracts

Emit events for state that TUI, logs, plugins, or diagnostics may need:

- `session.start`
- `session.end`
- `message.user`
- `message.assistant`
- `message.tool_result`
- `model.thinking`
- `tool.approval_required`
- `tool.denied`
- `tool.call`
- `tool.result`
- `model.done`
- `error`

Event payloads should be small, stable, and free of secrets.

## Tests To Add

- Event ordering when the loop streams, calls tools, and finishes.
- Deny and approval-denied paths.
- Tool handler failure path.
- Maximum tool-round stop behavior.
- Hidden tools filtered from model schemas.

