# .agents/

Agent workflow definitions for OpenAgent. Each file in `agents/` describes a named autonomous workflow that can be invoked via `/agent run <name>`.

## Available Agents

| Name | Autonomy | Description |
|---|---|---|
| [ship-and-babysit](agents/ship-and-babysit.md) | supervised | Pre-flight checks → commit → push → CI watch |
| [code-review](agents/code-review.md) | readonly | 4-dimension code review over a diff or PR |
| [refactor](agents/refactor.md) | supervised | Safe incremental refactor with per-step commits |

## Autonomy Tiers

| Tier | Behavior |
|---|---|
| `readonly` | Only reads files and runs non-destructive commands. Never writes. |
| `supervised` | Runs most steps automatically. Asks before destructive or irreversible actions. |
| `full` | Runs all steps without approval gates. Only for trusted, low-risk workflows. |

## Circuit Breakers (all agents)

Every agent enforces these hard limits regardless of autonomy tier:

- **Repeat failure (3×)**: Same step fails 3 times → stop and escalate
- **No progress (6×)**: 6 steps without meaningful output → stop and ask
- **Hard reject**: User denies an approval gate → stop the workflow entirely
- **Blocked operation**: Safety system blocks a tool call → stop and report

## Adding a New Agent

Create a Markdown file in `agents/` with these sections:

```markdown
# Agent: name

Brief description.

## Trigger
## Autonomy Tier
## Phases
## Circuit Breakers
## Output Format
```

The agent will be discovered automatically by `/agent list`.
