---
name: opsx-explore
description: Slash-command skill for OpenSpec — enter explore mode via `/opsx:explore` for thinking through ideas, investigating problems, and clarifying requirements.
license: MIT
compatibility: Works with openspec workflow skills and CodeGraph.
metadata:
  author: ai-coding
  version: "1.0"
---

# OPSX: Explore

This skill is a thin wrapper around the [opsx explore command](file://ai-coding/commands/opsx/explore.md). Refer to that file for the complete workflow.

Enter explore mode. Think deeply. Visualize freely.

**IMPORTANT: Explore mode is for thinking, not implementing.** You may read files and search code, but NEVER write code or implement features.

**Input**: The argument after `/opsx:explore` could be an idea, a problem, a change name, or nothing.

## The Stance

- **Curious, not prescriptive** — Ask questions that emerge naturally
- **Visual** — Use ASCII diagrams liberally
- **Adaptive** — Follow interesting threads, pivot when new info emerges
- **Patient** — Don't rush to conclusions
- **Grounded** — Use `codegraph explore` to surface code symbols

## Key Actions

- Check `openspec list --json` for existing changes
- Read change artifacts if a change name is mentioned
- Use CodeGraph for codebase investigation
- Offer to capture decisions in artifacts when insights crystallize

See [commands/opsx/explore.md](file://ai-coding/commands/opsx/explore.md) for the full reference.
