# TUI

## Thinking Panel

- Parse `<thinking>...</thinking>` from accumulated stream buffers.
- Support closed and still-open streaming blocks.
- Strip common bullet markers when deriving steps.
- Do not show raw tags in final assistant messages.
- Keep empty and interrupted streams stable.

## Tool Execution Display

- Show tool start, approval, denial, result, and error states distinctly.
- Keep long payloads collapsed or truncated by default.
- Prefer event-driven updates over polling.

## Slash Commands

- Keep help, completion, and execution backed by one registry.
- Commands that only affect the local TUI should be handled locally.
- Commands that affect sessions, config, tools, or skills should flow through
  the shared CLI/agent path.

## Tests To Add

- Thinking extraction and step derivation.
- Slash completion drift between help and execution.
- Tool panel behavior for success, error, approval, and denied states.

