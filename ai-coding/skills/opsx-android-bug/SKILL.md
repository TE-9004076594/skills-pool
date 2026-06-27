---
name: opsx-android-bug
description: Slash-command skill for OpenSpec — investigate and propose a fix for an Android bug via `/opsx:android-bug` using OpenSpec workflow with specialized Android debugging.
license: MIT
compatibility: Requires openspec CLI. Works with openspec workflow skills and android-* debugging skills.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Android Bug

This skill is a thin wrapper around the [opsx android-bug command](file://ai-coding/commands/opsx/android-bug.md). Refer to that file for the complete workflow.

Investigate and propose a fix for an Android bug. Works like `/opsx:propose` but specialized for Android bug investigation.

**Input**: The argument after `/opsx:android-bug` is the bug description or report.

## Quick Reference

1. **Gather bug context** — symptom, trigger, frequency, device/OS
2. **Android bug triage** — classify as Crash / ANR / Lifecycle / Memory / Network / UI
3. **Route to specialized skill** — reference the appropriate android-* debugging skill
4. **Define OpenSpec contract** — expected vs actual, invariants, constraints
5. **CodeGraph analysis** — `codegraph explore "<key terms>"`
6. **Create change** — `openspec new change "<bug-name>"`
7. **Create artifacts** — proposal + design + tasks with Android-specific context

See [commands/opsx/android-bug.md](file://ai-coding/commands/opsx/android-bug.md) for full details.
