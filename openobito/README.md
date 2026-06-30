# OpenAgent

> Your local AI agent. Safe, smart, always offline.

OpenAgent is a fully local, open-source CLI AI agent built with Node.js and TypeScript. It runs entirely on your machine using [Ollama](https://ollama.com) — no API keys, no cloud, no data leaving your device.

## Features

- **Interactive TUI** — Ink-based terminal UI with streaming output
- **Permission system** — Allow/RequireApproval/Deny/HideFromPrompt per tool (inspired by OpenHuman)
- **Risk levels** — Low/Medium/High/Critical task classification
- **Persistent sessions** — SQLite-backed conversation history and audit log
- **Agent memory** — Key-value store across sessions
- **Plugin-ready** — Extensible tool registry
- **Doctor diagnostics** — `openagent doctor` checks your setup
- **One-shot mode** — `openagent run "<task>"` for scripting

## Quick Start

```bash
# Install globally
npm install -g openagent

# Start Ollama (if not already running)
ollama serve

# Pull a model
ollama pull llama3.2

# Run diagnostics
openagent doctor

# Start chatting
openagent
```

## Commands

| Command | Description |
|---|---|
| `openagent` | Launch interactive chat (default) |
| `openagent chat` | Launch interactive chat |
| `openagent run "<task>"` | One-shot task execution |
| `openagent doctor` | Run diagnostics |
| `openagent config` | Edit config file |
| `openagent sessions` | List recent sessions |

## Config

Config lives at `~/.openagent/config.yaml`. Created automatically on first run.

```yaml
model:
  provider: ollama
  model: llama3.2
  baseUrl: http://localhost:11434
  temperature: 0.7

permissions:
  defaultAction: require_approval
  policies:
    - toolName: read_file
      action: allow
      riskLevel: low
    - toolName: shell_exec
      action: require_approval
      riskLevel: high
    - toolName: delete_file
      action: deny
      riskLevel: critical
```

## Built-in Tools

| Tool | Risk | Default Policy |
|---|---|---|
| `read_file` | Low | Allow |
| `list_directory` | Low | Allow |
| `write_file` | Medium | RequireApproval |
| `shell_exec` | High | RequireApproval |
| `fetch_url` | Medium | RequireApproval |
| `delete_file` | Critical | Deny |

## Slash Commands (in chat)

| Command | Action |
|---|---|
| `/help` | Show help |
| `/clear` | Clear chat history |
| `/exit` | Exit |

## Architecture

```
src/
├── cli/          # Commander.js entry + subcommands
├── tui/          # Ink terminal UI components
├── agent/        # Reasoning loop, session, memory, event bus
├── model/        # Ollama adapter, fallback chain
├── tools/        # Tool registry + built-in tools
├── permissions/  # Policy engine (Allow/Deny/RequireApproval)
├── storage/      # SQLite via better-sqlite3
├── config/       # js-yaml config loader
└── doctor/       # Diagnostics module
```

## Development

```bash
git clone https://github.com/openagent-dev/openagent
cd openagent
npm install
npm run dev       # Run with tsx (hot reload)
npm run build     # Build with esbuild
npm test          # Run Vitest tests
npm run typecheck # TypeScript strict check
```

## License

MIT
