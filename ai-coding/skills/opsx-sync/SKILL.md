---
name: opsx-sync
description: Slash-command skill for OpenSpec — sync delta specs from a change to main specs via `/opsx:sync`.
license: MIT
compatibility: Requires openspec CLI. Works with openspec workflow skills.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Sync

This skill is a thin wrapper around the [opsx sync command](file://commands/opsx/sync.md). Refer to that file for the complete workflow.

Sync delta specs from a change to main specs.

**Agent-driven operation** — you read delta specs and directly edit main specs to apply changes intelligently.

**Input**: Optionally specify a change name after `/opsx:sync`.

## Quick Reference

1. **Select change** — prompt if ambiguous
2. **Resolve context** — `openspec status --change "<name>" --json`
3. **CodeGraph exploration** — `codegraph explore "<capability terms>"`
4. **Find delta specs** — from `artifactPaths.specs.existingOutputPaths`
5. **Apply changes** — ADDED / MODIFIED / REMOVED / RENAMED requirements
6. **Show summary**

See [commands/opsx/sync.md](file://commands/opsx/sync.md) for full details.
