# @openagent/routines.md

## Best features extracted

Hermes-already-has-routines.md describes Hermes’ automation system (“routines”) with three trigger types:
- scheduled (cron)
- webhook/event triggers
- API triggers

Hermes also emphasizes:
- script injection (mechanical pre-processing)
- multi-skill chaining
- deliver-anywhere targets
- no daily run caps (bounded by model budget)

## Proposed OpenAgent “routines” documentation

### Trigger types
1) **Scheduled (cron)**
- cron expressions or interval phrases
- optional one-shot timestamp

2) **Webhook / event triggers**
- configure event subscriptions
- include payload-to-template mapping

3) **API triggers**
- authenticated endpoints
- read payload and generate a task prompt

### Script injection (mechanical work)
- Run a script before the agent
- Inject stdout into the agent prompt
- Provide a `[SILENT]`-style pattern to avoid notification spam

### Multi-skill chaining
- Allow a list of skills to load for each automation
- Skills should specialize capabilities (e.g., “web research”, “patching”, “notetaking”)

### Deliver targets
- local file (no notification)
- chat platforms
- webhooks

## Adoption guidelines for maintainers
- Keep the agent loop identical for manual and automated runs.
- Ensure permission checks apply to automation the same way they apply to interactive runs.
- Make automation failures observable:
  - include error classification
  - include a retry policy (bounded)

## Example (documentation-only)
```bash
# Scheduled automation
openagent routine create \
  "every 1h" \
  "Summarize site changes; notify only if change detected." \
  --script ~/.openagent/scripts/watch-site.py \
  --name "Site change monitor" \
  --deliver local
```

