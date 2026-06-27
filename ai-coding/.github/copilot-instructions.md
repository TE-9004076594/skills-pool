# AI Coding — Repository-wide instructions for GitHub Copilot

This repository contains structured AI coding workflow skills and Android debugging skills for AI coding agents.

## Skills Overview

The `skills/` directory in this repo contains SKILL.md guidance organized into three groups:

### OpenSpec Workflow Skills
- **openspec-propose** — Create a new change with proposal, design, and task artifacts using OpenSpec CLI
- **openspec-apply-change** — Implement tasks from an OpenSpec change
- **openspec-explore** — Explore mode for thinking through ideas, investigating problems, clarifying requirements
- **openspec-archive-change** — Archive a completed change
- **openspec-sync-specs** — Sync delta specs from a change to main specs

### OPSX Command Skills
- **opsx-apply** — `/opsx:apply` — Implement tasks from a change
- **opsx-explore** — `/opsx:explore` — Enter explore mode
- **opsx-propose** — `/opsx:propose` — Propose a new change
- **opsx-archive** — `/opsx:archive` — Archive a completed change
- **opsx-sync** — `/opsx:sync` — Sync delta specs
- **opsx-verify** — `/opsx:verify` — Run tests and checks
- **opsx-android-bug** — `/opsx:android-bug` — Investigate Android bugs with OpenSpec

### Android Debugging Skills
- **android-crash-analyzer** — Analyze crash logs, find root cause, propose fixes
- **android-anr-investigator** — Investigate ANRs and UI stalls
- **android-lifecycle-debugger** — Debug lifecycle-related bugs
- **android-memory-leak-fixer** — Analyze memory leaks and retention paths
- **android-network-bug-debugger** — Debug network-related bugs
- **android-ui-regression-checker** — Investigate UI defects and regressions

For agents that support the Agent Skills format (Cursor, Claude Code, etc.), install this repo as a skill for the complete reference.
