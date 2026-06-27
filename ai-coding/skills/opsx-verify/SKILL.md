---
name: opsx-verify
description: Slash-command skill for OpenSpec — verify a change by running tests, linting, and code quality checks via `/opsx:verify`.
license: MIT
compatibility: Requires openspec CLI. Works with openspec workflow skills.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Verify

This skill is a thin wrapper around the [opsx verify command](file://ai-coding/commands/opsx/verify.md). Refer to that file for the complete workflow.

Verify a change by running tests, linting, and code quality checks.

Use after `/opsx:apply` to validate that changes compile, pass tests, and meet quality standards.

**Input**: Optionally specify a change name (e.g., `/opsx:verify add-auth`).

## Quick Reference

1. **Select change** — prompt if ambiguous
2. **Check status** — `openspec status --change "<name>" --json`
3. **CodeGraph exploration** — `codegraph explore "<key terms>"`
4. **Sync index** — `codegraph sync -q`
5. **Run checks** — formatting → clippy → tests → argument-comment lint
6. **Report results** — structured pass/fail for each check

See [commands/opsx/verify.md](file://ai-coding/commands/opsx/verify.md) for full details.
