---
name: codekb-extract
description: Trigger knowledge extraction via codekb_extract MCP tool or codekb extract CLI — five extractors (pattern, decision, rule, convention, bug-pattern) powered by LLM. Use to generate structured knowledge from code, git history, and OpenSpec changes.
license: MIT
compatibility: Requires CodeKB CLI. LLM API key optional — heuristic extraction works without it.
metadata:
  author: ai-coding
  version: "1.0"
---

# CodeKB: Extract Knowledge

Extract structured knowledge from source code, git history, and OpenSpec changes.

## When to Use

- After archiving an OpenSpec change (knowledge feedback loop)
- When a project needs design decisions / business rules extracted
- After fix commits, to accumulate bug patterns (`--from-change` or git history)
- Periodic refresh of `potentially_stale` knowledge entries

## Five Extractors

| Extractor | Source | Output |
|-----------|--------|--------|
| `pattern` | module dependencies + communication | architecture patterns (event-driven, CQRS, Saga, layered) |
| `decision` | git commits, PR descriptions, `// WHY:`/`// NOTE:`/`// HACK:` | lightweight ADR entries |
| `rule` | condition branches, validation, constants, tests | business rules |
| `convention` | code style + lint config cross-validation | coding conventions |
| `bug-pattern` | fix/bugfix/hotfix commits + diffs | defect patterns (severity, triggers, fix pattern) |

## CLI Usage

```bash
# 全量提取（按配置的 extractors）
codekb extract

# 从 OpenSpec 变更提取（archive 阶段）
codekb extract --from-change add-refund-fee

# 指定范围 + 指定提取器
codekb extract --scope src/payment --extractors decision,rule

# 强制重新提取（忽略缓存）
codekb extract --force

# 仅重新提取标记为 stale 的条目
codekb extract --stale
```

## MCP Tool

```json
codekb_extract(scope?, extractors?, force?, from_change?, stale_only?)
```

## Output Format

```
✓ 提取完成: 新增 N 条
  decision: 2 条
  rule: 1 条
⚠ 待审阅 (confidence < 0.7): N 条
  - decision-003: title (0.62)
```

## Guardrails

- **Caching**: unchanged sources are not re-sent to the LLM (content hash based)
- **Low confidence**: entries with `confidence < 0.7` are flagged for review and excluded from `/opsx:propose` auto-association
- **Source change**: `codekb extract --from-change <name>` sets `source_change` for traceability
- **Supersede**: if new knowledge replaces old decisions, `supersedes`/`superseded_by` links are applied automatically
- Never extract when the project is a `hotfix` branch (read-only mode)
