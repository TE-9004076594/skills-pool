---
name: opsx-trace-log
description: Slash-command skill for OpenSpec — TEMPORARY diagnostic probe via `/opsx:trace-log`. Instrument suspected call chains with structured logs, collect runtime evidence, then remove all instrumentation.
license: MIT
compatibility: Requires openspec CLI. Works with openspec workflow skills and openspec-trace-logger skill.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Trace Log

This skill is a thin wrapper around the [opsx trace-log command](file://ai-coding/commands/opsx/trace-log.md). Refer to that file for the complete workflow.

Instrument the call chain of a suspected code path with structured trace logs, then guide log capture and analysis to diagnose runtime issues. All instrumentation is removed before the session ends.

**Input**: The argument after `/opsx:trace-log` is the entry point, flow description, or suspicion. If nothing is provided, will be prompted.

## Quick Reference

1. **Collect the instrumentation target** — entry point, suspicion, scope
2. **Discover the call chain** — `codegraph explore "<entry point>"`
3. **Detect the logging framework** — Timber / android.util.Log / project utility
4. **Define trace-logging contract** — TAG, log level, entry/exit/key-state/exception logs
5. **Performance guardrail** — detect high-frequency / looping patterns
6. **Instrument the call chain** — add trace logs
7. **Provide log-capture instructions** — `adb logcat` filter command
8. **Analyze captured logs** — sequence, timing, thread, state, lifecycle checks
9. **Cleanup (mandatory)** — remove all instrumentation markers

See [commands/opsx/trace-log.md](file://ai-coding/commands/opsx/trace-log.md) for full details.
