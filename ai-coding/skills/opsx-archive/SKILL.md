---
name: opsx-archive
description: Slash-command skill for OpenSpec — archive a completed change via `/opsx:archive`. Use when the user invokes /opsx:archive or wants to finalize a change.
license: MIT
compatibility: Requires openspec CLI. Works with openspec workflow skills.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Archive

This skill is a thin wrapper around the [opsx archive command](file://ai-coding/commands/opsx/archive.md). Refer to that file for the complete workflow.

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name after `/opsx:archive` (e.g., `/opsx:archive add-auth`).

## Quick Reference

1. **Select change** — prompt if ambiguous
2. **Check completion** — `openspec status --change "<name>" --json`
3. **Check tasks** — read tasks.md for incomplete items
4. **Delta spec sync** — offer to sync before archiving if delta specs exist
5. **CodeGraph snapshot** — `codegraph explore "<key terms>"`
6. **Archive** — `mv "<changeRoot>" "<changesDir>/archive/YYYY-MM-DD-<name>"`
7. **Show summary**

See [commands/opsx/archive.md](file://ai-coding/commands/opsx/archive.md) for full details.
