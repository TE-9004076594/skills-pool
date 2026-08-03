---
name: codekb-init
description: Initialize CodeKB knowledge base in a project — index code with tree-sitter chunking, build vector + BM25 hybrid index, optionally extract knowledge. Use when starting to work with an unfamiliar codebase or enabling project memory for AI.
license: MIT
compatibility: Requires codekb CLI (`npm install -g ./codekb`). Detects CodeGraph; degrades gracefully when absent.
metadata:
  author: ai-coding
  version: "1.0"
---

# CodeKB: Initialize

Initialize the CodeKB semantic knowledge base for a project.

## When to Use

- Starting work on an unfamiliar codebase and need project memory
- Enabling AI to retrieve design decisions, business rules, and coding conventions
- Setting up incremental indexing (Git hooks) for ongoing knowledge maintenance

## Prerequisites

```bash
# Install CodeKB CLI (from skills-pool/codekb/)
cd skills-pool/codekb
npm install -g .
codekb --help
```

Optional: install `node-tree-sitter` for AST-aware chunking (falls back to heuristic chunking without it).

## Steps

1. **Check prerequisites** — ensure `codekb` CLI is available:
   ```bash
   codekb --help
   ```

2. **Initialize the project**:
   ```bash
   codekb init
   ```
   - Creates `codekb/codekb.yaml` (config)
   - Creates `codekb/knowledge/` (Git-managed knowledge entries)
   - Creates `codekb/index/` (local index, gitignored)
   - Builds vector + BM25 hybrid index
   - Optionally extracts initial knowledge (add `--skip-extract` to skip)

3. **Verify initialization**:
   ```bash
   codekb status
   ```
   Expected: `索引健康: ✓`, indexed chunks > 0.

4. **Configure MCP** — add the printed MCP config to the AI coding tool:
   ```json
   { "mcpServers": { "codekb": { "command": "codekb", "args": ["mcp"], "env": { "CODEKB_PROJECT": "<project-path>" } } } }
   ```

5. **Verify CodeGraph integration** — if `.codegraph/` exists, structural retrieval is enabled; otherwise it degrades to semantic + lexical channels.

## Output Format

```
✓ 初始化完成
  索引文件: N | 代码行: N | 分块: N
  知识条目: N 条
  CodeGraph: ✓ 已就绪 / ✗ 未初始化
```

## Guardrails

- `codekb init` is idempotent — re-running rebuilds the index without destroying knowledge entries
- `codekb/index/` is gitignored; `codekb/knowledge/` is committed to Git
- If CodeGraph is not initialized, do not fail — warn and continue with degraded retrieval
