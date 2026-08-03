---
name: codekb-search
description: Hybrid code search via codekb_search MCP tool — structural (CodeGraph) + semantic (vector) + lexical (BM25) with RRF fusion. Use when the user asks a natural-language question about where something is implemented, or needs to find code by meaning.
license: MIT
compatibility: Requires CodeKB MCP Server configured in the AI coding tool.
metadata:
  author: ai-coding
  version: "1.0"
---

# CodeKB: Search

Hybrid semantic code search across code chunks and knowledge entries.

## When to Use

- Natural language queries: "where is user authentication handled"
- Exact symbol lookups: "PaymentService.processRefund"
- Error string searches: "NullPointerException OrderService"
- Bug-related queries: automatically boost bug-pattern knowledge weight

## MCP Tool

```json
codekb_search(query: string, options?: {
  scope?: string[],           // 限定搜索范围（目录/模块）
  knowledge_types?: string[], // 过滤知识类型
  max_results?: number        // 默认 10
})
```

## Routing Behavior (automatic)

| Query type | Example | Primary channel |
|-----------|---------|----------------|
| symbol | `PaymentService.processRefund` | structural (0.7) |
| error | `NullPointerException OrderService` | lexical BM25 (0.6) |
| bugfix | "并发 数据丢失" | bug-pattern weight ×2.0 |
| natural language | "哪里处理了鉴权" | semantic vector (0.5) |

## Steps

1. **Route the query** — determine query type (symbol / error / bugfix / NL).
2. **Call the MCP tool**:
   ```
   codekb_search("<query>", { max_results: 10 })
   ```
3. **Use `scope`** when the query targets a specific module or directory.
4. **Interpret results** — each result includes file path + line range, score, and matched channels (structural/semantic/lexical). Use the file path for follow-up Read operations.

## Output Interpretation

Results are fused via weighted RRF and annotated:
```
{ route: "symbol", results: [{ file, startLine, endLine, name, content, channels: ["structural"] }] }
```

## Guardrails

- For exact symbol queries, prefer CodeGraph structural channel results first
- If CodeKB is unavailable, fall back to `codegraph explore` then `rg`/grep
- Bug-related queries automatically boost `bug-pattern` entries — use this to surface historical fix patterns
