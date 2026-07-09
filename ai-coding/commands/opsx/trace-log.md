---
name: OPSX: Trace Log
description: TEMPORARY diagnostic probe — instrument a call chain with structured logs, collect runtime evidence, then remove all instrumentation before the session ends
category: Debugging
tags: [debugging, trace, logging, android, experimental]
---

Instrument the call chain of a suspected code path with structured trace logs, then guide log capture and analysis to diagnose runtime issues. All instrumentation is removed before the session ends.

**Input**: The argument after `/opsx:trace-log` is the entry point, flow description, or suspicion (e.g., `LoginRepository.authenticate`). If nothing is provided, will be prompted.

**Execution**

Use the **Skill tool** to load the `openspec-trace-logger` skill and follow its workflow end-to-end.

The skill defines the full sequence:
1. Collect the instrumentation target
2. Discover the call chain with CodeGraph
3. Detect the logging framework
4. Define the trace-logging contract
5. Performance guardrail — detect high-frequency / looping patterns
6. Instrument the call chain
7. Provide log-capture instructions
8. Analyze captured logs
9. Cleanup (mandatory — session is not complete until this runs)

The skill file contains the complete step-by-step instructions, logging contract template, performance mitigations, and guardrails. Follow it exactly.

**Why a skill delegation?** Separating the command entry point from the workflow keeps the command file compact and avoids drift between the command and the skill it invokes. The skill is the single source of truth for the `trace-log` workflow.
