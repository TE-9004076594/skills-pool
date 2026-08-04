---
name: openspec-codekb-integration
description: Optional integration layer — enrich OpenSpec workflow stages (explore, propose, apply, archive, android-bug) with CodeKB semantic knowledge. ONLY active when CodeKB is installed and initialized. Does not affect openspec + codegraph usage when CodeKB is absent.
license: MIT
compatibility: Requires CodeKB CLI installed (`npm install -g @yun918/codekb`) AND `codekb init` run in the project. Optional enhancement over openspec-* + codegraph — never a hard dependency.
metadata:
  author: ai-coding
  version: "1.0"
---

# OpenSpec + CodeKB Integration

This skill is the **optional enhancement layer** connecting CodeKB to the OpenSpec workflow.

**IMPORTANT — 解耦原则 (Decoupling Principle)**:
- Without CodeKB installed: `openspec-*` skills + CodeGraph work exactly as before, with zero CodeKB involvement
- With CodeKB installed + `codekb init` run: use this skill's guidance to enrich each OpenSpec stage
- This skill is shipped inside the `codekb` npm package — installing CodeKB brings the integration guidance with it

## When to Use

Only after BOTH are true:
1. `codekb` CLI is available (`codekb --version` works)
2. The project is initialized (`codekb status` shows healthy index)

If either is false, **skip CodeKB entirely** and proceed with the standard `openspec-*` + CodeGraph workflow.

## Stage-by-Stage Integration

### `/opsx:explore` — Knowledge Overview

Enrich exploration with semantic project knowledge ("why" behind the code):

```bash
codekb status
codekb_search("项目整体架构", { knowledge_types: ["pattern", "decision"] })
codekb_conventions()
codekb_explain("<core module>")
```

Include a knowledge overview in explore output:
```
"这个项目使用了事件驱动架构，包含 12 条设计决策、7 条业务规则。
 关键约束：金额必须用 BigDecimal (decision-001)，跨服务操作走 Saga。"
```

### `/opsx:propose` — Constraint Association

Retrieve design constraints the change must respect:

```bash
codekb_search("<change scope terms>", { knowledge_types: ["decision", "rule"], scope: ["<affected module>"] })
codekb_conventions("<affected domain>")
```

- **Only associate entries with `confidence ≥ 0.7`** — low-confidence knowledge must not guide design
- **Parse `codekb:ref` references** in existing spec files:
  ```html
  <!-- codekb:ref decision-001 -->
  ```
- **Constraint check**: detect conflicts between the proposal and existing knowledge
- Add a "相关约束" section to the proposal artifact referencing knowledge entry IDs

### `/opsx:apply` — On-Demand Knowledge

During implementation, respect constraints and conventions:

```bash
codekb_search("<module terms>", { knowledge_types: ["decision", "rule"] })
codekb_conventions("<affected domain>")
codekb_explain("<symbol being modified>")
```

- Before a behavior change: check related business rules and design decisions
- Before modifying a symbol with `known_issues`: verify the historical bug pattern still applies
- After each commit: CodeKB's Git hook auto-syncs the index and marks affected knowledge `potentially_stale`

### `/opsx:archive` — Knowledge Feedback (most valuable)

Archiving means the change is complete and verified — distill new knowledge:

```bash
codekb extract --from-change "<name>"
```

- Reads `proposal.md` / `design.md` / `spec-delta.md` / `archive.md` for new decisions and rules
- Sets `source_change: <name>` for traceability
- Detects superseded decisions → old entry status becomes `superseded`
- Validates `codekb:ref` references still hold

### `/opsx:android-bug` — Bug Pattern Retrieval

Bug investigation benefits from historical defect patterns:

```bash
codekb_search("<bug symptom keywords>", { knowledge_types: ["bug-pattern", "decision"] })
codekb_explain("<suspect class or method>")
```

- **`known_issues`** — historical bug patterns on the suspect symbol; the fix must not reintroduce them
- **Design intent** — compare current code against intent to detect violations
- **Conventions** — fix should respect project conventions (thread-safety, error handling)

## Guardrails

- **Never block the OpenSpec workflow on CodeKB** — if CodeKB errors or is absent, continue with standard openspec + codegraph
- CodeKB is an enhancement, not a requirement — treat every CodeKB step as "best effort"
- Only associate `confidence ≥ 0.7` knowledge in propose stage
- Archive knowledge feedback is optional; the change can always be archived without it
