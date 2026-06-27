---
name: opsx-propose
description: Slash-command skill for OpenSpec — propose a new change via `/opsx:propose` with all artifacts generated in one step.
license: MIT
compatibility: Requires openspec CLI. Works with openspec workflow skills and CodeGraph.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Propose

This skill is a thin wrapper around the [opsx propose command](file://commands/opsx/propose.md). Refer to that file for the complete workflow.

Propose a new change — create the change and generate all artifacts in one step.

Artifacts to generate:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

**Input**: The argument after `/opsx:propose` is the change name (kebab-case) or a description of what the user wants to build.

## Quick Reference

1. **If no input** — ask what they want to build
2. **CodeGraph exploration** — `codegraph explore "<key terms>"`
3. **Create change** — `openspec new change "<name>"`
4. **Get build order** — `openspec status --change "<name>" --json`
5. **Create artifacts in sequence** — follow instructions from `openspec instructions <artifact-id> --change "<name>" --json`
6. **Show final status** — `openspec status --change "<name>"`

See [commands/opsx/propose.md](file://commands/opsx/propose.md) for full details.
