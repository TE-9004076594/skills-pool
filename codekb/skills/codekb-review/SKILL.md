---
name: codekb-review
description: Review knowledge entries via codekb_review MCP tool or codekb review CLI — confirm accuracy (confidence → 1.0), reject inaccurate entries, or edit content. Use to maintain knowledge base quality.
license: MIT
compatibility: Requires CodeKB CLI. Knowledge entries are Git-managed markdown files.
metadata:
  author: ai-coding
  version: "1.0"
---

# CodeKB: Review Knowledge

Review, correct, and confirm AI-extracted knowledge entries.

## When to Use

- After `codekb extract` reports low-confidence entries
- When a knowledge entry is suspected inaccurate
- Periodically auditing the knowledge base for quality

## CLI Usage

```bash
# 浏览条目（含过滤）
codekb list --type decision --status potentially_stale
codekb list --include-superseded
codekb list --tags payment

# 审阅
codekb review decision-001 confirm     # 确认准确 → confidence = 1.0
codekb review decision-003 reject      # 标记不准确 → status = rejected
codekb review decision-005 edit "<new body>"
```

## MCP Tool

```json
codekb_review(id: string, verdict: "confirm" | "reject" | "edit", edit?: string)
```

## Entry Lifecycle

| Status | Meaning | Retrieval |
|--------|---------|-----------|
| `accepted` | 审阅通过 | 默认返回 |
| `draft` | feature 分支产生，待提升 | 仅本分支可见 |
| `potentially_stale` | 代码变更可能影响 | 返回但标注 |
| `superseded` | 被新决策取代 | 默认不返回 |
| `rejected` | 标记不准确 | 不返回 |

## Steps

1. **List low-confidence entries**:
   ```bash
   codekb list --status potentially_stale
   ```
2. **Read the entry file** — verify against actual code (`codekb/knowledge/<type>/<id>.md`).
3. **Review**: confirm (accurate), reject (inaccurate), or edit (correct content).
4. **Track changes** — every modification is captured in Git history:
   ```bash
   git log -- codekb/knowledge/
   ```

## Guardrails

- Review `confidence < 0.7` entries before relying on them in `/opsx:propose`
- Rejected entries are excluded from search but remain in Git history
- Superseded entries remain accessible via `codekb list --include-superseded`
- Human review is the source of truth — AI-extracted knowledge is provisional until confirmed
