---
name: codekb-explain
description: Explain a symbol via codekb_explain MCP tool — aggregate functional summary, associated knowledge entries, known bug patterns, call graph, and coding conventions for a symbol. Use before modifying a function/class to understand its intent and constraints.
license: MIT
compatibility: Requires CodeKB MCP Server. Reuses CodeGraph for call graph when available.
metadata:
  author: ai-coding
  version: "1.0"
---

# CodeKB: Explain Symbol

Get an aggregated explanation of a symbol before modifying it.

## When to Use

- About to modify a function/class and need its functional summary
- Want to know historical issues (bug patterns) before touching code
- Need to understand design constraints and conventions around a symbol
- Assessing impact: callers/callees + related knowledge

## MCP Tool

```json
codekb_explain(symbol: string) → {
  summary: string,
  knowledge: KnowledgeEntry[],        // 关联的设计决策/业务规则
  known_issues: BugPatternEntry[],    // 关联的缺陷模式（按 severity 降序）
  callgraph: { callers, callees },    // 复用 CodeGraph
  conventions: string[],
  code_snippet: string
}
```

## Steps

1. **Identify the symbol** — class or `Class.method` to explain.
2. **Call the MCP tool**:
   ```
   codekb_explain("PaymentService.processRefund")
   ```
3. **Use the `knowledge` array** — design decisions and business rules the symbol must respect.
4. **Check `known_issues`** — if non-empty, review historical bug patterns before modifying; avoid reintroducing fixed defects.
5. **Verify `callgraph`** — if CodeGraph is not initialized, `callgraph` returns empty with `_note`; fall back to `codegraph explore` or `rg`.

## Output Interpretation

```
summary: 处理退款请求。校验原始交易状态后执行账务冲正并通知用户。
knowledge: [ { type: "decision", title: "使用 Saga 模式而非分布式事务" } ]
known_issues: [ { severity: "high", title: "并发场景下共享 HashMap 导致数据丢失" } ]
conventions: [ "金额字段使用 BigDecimal" ]
```

## Guardrails

- Always check `known_issues` before proposing a fix — it reveals why defensive code exists
- Do not remove code that addresses a known bug pattern without confirming the trigger conditions are gone
- If `codekb_explain` is unavailable, assemble the same information manually via `codegraph explore` + reading `codekb/knowledge/`
