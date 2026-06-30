# .codex/

The OpenAgent codex: machine-readable registries for skills, slash commands, tools, and agent definitions. Files here are read at startup to populate the runtime registries.

## Structure

```
.codex/
├── skills/
│   └── registry.yaml      # All skills: name, path, category, risk, tags
├── commands/
│   └── registry.yaml      # All slash commands: command, handler, description, args
└── README.md
```

## Skills Registry

`skills/registry.yaml` is read by the `SkillsCommand` slash handler to populate `/skills list`. Each entry maps a skill name to its SKILL.md path and metadata.

Add a new skill:
1. Create `skills/<category>/<name>/SKILL.md`
2. Add an entry to `.codex/skills/registry.yaml`
3. The skill is immediately available via `/skills use <name>`

## Commands Registry

`commands/registry.yaml` is read by the CommandRegistry at startup. The `handler` field must match a mixin class name from `src/cli/slash/mixins/`.

Add a new command:
1. Create `src/cli/slash/mixins/<name>.ts` exporting a mixin class
2. Add an entry to `.codex/commands/registry.yaml`
3. Register the mixin in `src/cli/slash/index.ts`

## Conventions

- Skill names: `kebab-case`, globally unique
- Command names: `/kebab-case`, globally unique
- Risk levels: `low` (read-only or safe writes) | `medium` (modifies local state) | `high` (network, auth, destructive)
- All paths are relative to the project root
