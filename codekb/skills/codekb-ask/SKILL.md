---
name: codekb-ask
description: Natural language Q&A about the project via codekb_ask MCP tool — RAG over code chunks + knowledge entries with source traceability. Use when the user asks "why is X done this way", "how does the system handle Y", or any project-specific question.
license: MIT
compatibility: Requires CodeKB MCP Server. Answers reference real file paths and knowledge entry IDs.
metadata:
  author: ai-coding
  version: "1.0"
---

# CodeKB: Ask

Answer project-specific questions grounded in actual code and knowledge entries.

## When to Use

- "为什么消息模块用事件驱动" (design intent questions → decision entries)
- "退款失败时系统怎么处理的" (behavior questions → code + rules)
- "这个模块的编码约定是什么" (convention questions)
- Any question that requires project memory rather than general knowledge

## MCP Tool

```json
codekb_ask(question: string, options?: {
  context_symbols?: string[],  // 当前编辑的符号，提供额外上下文
  include_sources?: boolean    // 是否返回引用来源
}) → Answer & { sources: Source[] }
```

## Context Assembly (bounded, layered, ≤ 4K tokens)

```
[知识层]  相关设计决策和业务规则（~800 tokens）
[结构层]  相关符号签名和调用关系（~1200 tokens）
[代码层]  最相关的代码片段（~2000 tokens）
```

## Steps

1. **Call the MCP tool**:
   ```
   codekb_ask("<question>", { context_symbols: ["PaymentService"] })
   ```
2. **Verify `sources`** — every answer cites file paths / knowledge entry IDs / symbol names for traceability.
3. **No-information guard**: if nothing is found, CodeKB answers "项目中未找到相关知识" instead of fabricating.

## Output Interpretation

```
answer: 退款请求通过 Saga 编排...  (引用 RefundController.handle 的错误处理)
sources: [ { file: "src/services/payment.ts", startLine: 42 }, { id: "decision-007" } ]
```

## Guardrails

- Answers must cite traceable sources — if sources are empty, treat the answer as unverified
- When asked about a topic absent from the project, CodeKB explicitly returns "未找到" — do not fabricate
- For deep follow-up, use `codekb_explain` on cited symbols
- If CodeKB is unavailable, combine `codekb_search` results manually to answer
