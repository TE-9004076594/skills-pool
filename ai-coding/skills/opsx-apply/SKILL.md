---
name: opsx-apply
description: Slash-command skill for OpenSpec — implement tasks from a change via `/opsx:apply`. Use when the user invokes /opsx:apply or wants to start/continue implementation.
license: MIT
compatibility: Requires openspec CLI. Works with openspec workflow skills.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Apply

This skill is a thin wrapper around the [opsx apply command](file://ai-coding/commands/opsx/apply.md). Refer to that file for the complete workflow.

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name (e.g., `/opsx:apply add-auth`). If omitted, check if it can be inferred from conversation context.

## Quick Reference

1. **Select the change** — use name or prompt if ambiguous
2. **Check status** — `openspec status --change "<name>" --json`
3. **Get apply instructions** — `openspec instructions apply --change "<name>" --json`
4. **Read context files** — from `contextFiles` in the apply instructions output
5. **Explore codebase** — `codegraph explore "<key terms>"`
6. **Implement tasks** — loop through pending tasks, update `- [ ]` → `- [x]`
7. **Sync CodeGraph** — `codegraph sync -q`
8. **Show results** — completion summary or pause reason

See [commands/opsx/apply.md](file://ai-coding/commands/opsx/apply.md) for full details.
