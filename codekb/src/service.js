/**
 * CodeKB 核心服务 — 协调配置、索引、检索、知识提取
 * 供 CLI 和 MCP Server 共用
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, generateDefaultYaml } from './config/index.js';
import { chunkFile, collectFiles } from './indexing/chunker.js';
import { buildMerkleTree, diffMerkleTree, saveMerkleState, loadMerkleState } from './indexing/merkle.js';
import { Embedder, VectorStore } from './indexing/vector-store.js';
import { BM25Index } from './indexing/bm25.js';
import { hybridSearch } from './retrieval/router.js';
import { KnowledgeExtractor } from './extract/extractor.js';
import { KnowledgeStore } from './knowledge/store.js';

export class CodeKBService {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.codekbDir = path.join(projectDir, 'codekb');
    this.config = loadConfig(projectDir);
  }

  /**
   * 初始化项目
   */
  async init({ skipExtract = false } = {}) {
    fs.mkdirSync(path.join(this.codekbDir, 'knowledge'), { recursive: true });
    fs.mkdirSync(path.join(this.codekbDir, 'index'), { recursive: true });
    // 幂等：配置文件已存在时不覆盖
    const configPath = path.join(this.codekbDir, 'codekb.yaml');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, generateDefaultYaml(), 'utf8');
    }
    // 检测 CodeGraph
    const codegraphDir = path.join(this.projectDir, '.codegraph');
    const codegraphReady = fs.existsSync(codegraphDir);

    // 全量索引
    const indexResult = await this.index({ reindex: true });
    let extractResult = { created: [], byType: {}, lowConfidence: [] };
    if (!skipExtract) {
      extractResult = await this.extract({});
    }
    // .gitignore
    this.updateGitignore();
    // 安装 Git hook
    this.installHooks();

    return {
      configPath,
      codegraphReady,
      ...indexResult,
      knowledge: extractResult,
      mcpConfig: {
        mcpServers: {
          codekb: {
            command: 'codekb',
            args: ['mcp'],
            env: { CODEKB_PROJECT: this.projectDir },
          },
        },
      },
    };
  }

  /**
   * 全量/增量索引
   */
  async index({ reindex = false, changedFiles = null } = {}) {
    const files = collectFiles(this.projectDir, this.config);
    const merkle = buildMerkleTree(files);
    let targets = files;

    if (!reindex) {
      const prev = loadMerkleState(this.codekbDir);
      const diff = diffMerkleTree(prev, merkle);
      if (diff.changed.length === 0 && prev) {
        return { filesIndexed: 0, chunks: 0, upToDate: true, files: files.length, lines: countLines(files) };
      }
      targets = diff.changed;
    }

    const embedder = new Embedder(this.config);
    const vectorStore = new VectorStore(this.codekbDir);
    const bm25 = new BM25Index(this.codekbDir);

    // 删除已移除文件
    if (!reindex && changedFiles) {
      for (const f of changedFiles.removed || []) {
        await vectorStore.deleteByFile(f);
        await bm25.deleteByFile(f);
      }
    }

    let chunkCount = 0;
    const batch = [];
    for (const file of targets) {
      const chunks = chunkFile(file, this.projectDir);
      for (const c of chunks) {
        const id = `${file}:${c.startLine}`;
        batch.push({ id, ...c });
        chunkCount++;
      }
      if (batch.length >= 100) {
        await this._indexBatch(batch, embedder, vectorStore, bm25);
        batch.length = 0;
      }
    }
    if (batch.length) await this._indexBatch(batch, embedder, vectorStore, bm25);

    // 标记过期知识
    const store = new KnowledgeStore(this.projectDir);
    const staleSymbols = targets.map((f) => path.basename(f).replace(/\.\w+$/, ''));
    const stale = store.markStale(staleSymbols);

    saveMerkleState(this.codekbDir, merkle);
    return {
      filesIndexed: targets.length,
      chunks: chunkCount,
      files: files.length,
      lines: countLines(files),
      staleMarked: stale,
      upToDate: false,
    };
  }

  async _indexBatch(batch, embedder, vectorStore, bm25) {
    const texts = batch.map((b) => `${b.signature || ''}\n${b.content || ''}`);
    const vectors = await embedder.embed(texts);
    const records = batch.map((b, i) => ({ ...b, vector: vectors[i] }));
    await vectorStore.upsert(records);
    await bm25.addDocs(records);
  }

  /**
   * 增量同步（Git hook 调用）
   */
  async sync({ incremental = true, reindex = false } = {}) {
    if (reindex) return this.index({ reindex: true });
    const files = collectFiles(this.projectDir, this.config);
    const merkle = buildMerkleTree(files);
    const prev = loadMerkleState(this.codekbDir);
    const diff = diffMerkleTree(prev, merkle);
    if (diff.changed.length === 0 && prev) {
      return { synced: 0, upToDate: true };
    }
    const result = await this.index({ changedFiles: diff });
    return { synced: diff.changed.length, ...result };
  }

  /**
   * 混合检索
   */
  async search(query, options = {}) {
    const embedder = new Embedder(this.config);
    const vectorStore = new VectorStore(this.codekbDir);
    const bm25 = new BM25Index(this.codekbDir);
    const store = new KnowledgeStore(this.projectDir);
    const scope = options.scope;

    // 语义通道
    const [queryVector] = await embedder.embed([query]);
    const semantic = await vectorStore.search(queryVector, { topK: options.topK || 10, scope });

    // 词法通道
    const lexical = await bm25.search(query, { topK: options.topK || 10, scope });

    // 结构化通道：查找精确符号名匹配
    const symbolName = query.trim();
    const structural = semantic.filter((r) => r.name === symbolName || r.file.includes(symbolName))
      .map((r) => ({ ...r, score: 1.0 }));

    const result = await hybridSearch(
      { structural: async () => structural, semantic: async () => semantic, lexical: async () => lexical },
      query,
      options,
    );

    // 关联知识条目
    const results = result.results.map((r) => {
      const symbol = (r.name || '').split('.').pop();
      const knowledge = store.list({ includeSuperseded: false })
        .filter((e) => (e.related_symbols || []).some((s) => s.includes(symbol) || symbol.includes(s)));
      return { ...r, knowledge: knowledge.map((k) => ({ id: k.id, type: k.type, title: k.title, confidence: k.confidence })) };
    });

    return { route: result.route, results };
  }

  /**
   * 符号解释
   */
  async explain(symbol) {
    const store = new KnowledgeStore(this.projectDir);
    const searchResult = await this.search(symbol, { topK: 5 });
    const symbolRec = searchResult.results.find((r) => r.name === symbol || r.file.includes(symbol)) || searchResult.results[0];
    const related = store.list({ includeSuperseded: false }).filter((e) =>
      (e.related_symbols || []).some((s) => s.includes(symbol) || symbol.includes(s)),
    );
    const bugPatterns = related.filter((e) => e.type === 'bug-pattern').sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0));
    return {
      summary: symbolRec ? `符号 ${symbol} 定义于 ${symbolRec.file}:${symbolRec.startLine}` : `未找到符号 ${symbol}`,
      knowledge: related.filter((e) => e.type !== 'bug-pattern').map((e) => ({ id: e.id, type: e.type, title: e.title, confidence: e.confidence })),
      known_issues: bugPatterns.map((e) => ({ id: e.id, title: e.title, severity: e.severity, trigger_conditions: e.trigger_conditions })),
      callgraph: { callers: [], callees: [], _note: this.isCodegraphReady() ? undefined : 'CodeGraph not initialized' },
      conventions: store.list({ type: 'convention' }).map((e) => e.title),
      code_snippet: symbolRec ? symbolRec.content?.slice(0, 500) : null,
    };
  }

  /**
   * RAG 问答
   */
  async ask(question, options = {}) {
    const searchResult = await this.search(question, { topK: 8, scope: options.scope });
    const store = new KnowledgeStore(this.projectDir);
    const knowledge = store.list({ includeSuperseded: false });

    const sources = searchResult.results.slice(0, 5).map((r) => ({
      file: r.file, startLine: r.startLine, endLine: r.endLine,
      type: 'code', symbol: r.name, channel: r.channels || [],
    }));
    const kbSources = knowledge.slice(0, 3).map((k) => ({ id: k.id, type: 'knowledge', title: k.title }));

    const contextCode = searchResult.results.slice(0, 4).map((r) =>
      `### ${r.file}:${r.startLine}\n${r.content?.slice(0, 800)}`
    ).join('\n');
    const contextKb = knowledge.slice(0, 3).map((k) => `- [${k.id}] ${k.title} (${k.type})`).join('\n');

    const prompt = `基于以下项目上下文回答用户问题。若上下文无相关信息，回答"项目中未找到相关知识"。
=== 代码上下文 ===
${contextCode || '(无匹配代码)'}

=== 知识条目 ===
${contextKb || '(无相关知识条目)'}

问题: ${question}`;

    return {
      answer: `基于检索到的 ${searchResult.results.length} 条代码片段和 ${knowledge.length} 条知识条目，\n${prompt.slice(-500)}`,
      sources: [...sources, ...kbSources],
    };
  }

  /**
   * 触发知识提取
   */
  async extract(options = {}) {
    const extractor = new KnowledgeExtractor(this.projectDir, this.config);
    return extractor.extract(options);
  }

  /**
   * 从 OpenSpec 变更提取（archive 阶段）
   */
  async extractFromChange(changeName) {
    const extractor = new KnowledgeExtractor(this.projectDir, this.config);
    // 读取 OpenSpec 变更制品
    const changeDir = path.join(this.projectDir, 'openspec', 'changes', changeName);
    const artifacts = {};
    for (const name of ['proposal.md', 'design.md', 'tasks.md', 'spec.md', 'archive.md']) {
      const p = path.join(changeDir, name);
      if (fs.existsSync(p)) artifacts[name] = fs.readFileSync(p, 'utf8').slice(0, 4000);
    }
    // 从变更制品中提取知识
    const sourceText = Object.entries(artifacts).map(([k, v]) => `### ${k}\n${v}`).join('\n');
    const store = new KnowledgeStore(this.projectDir);
    const extractorResult = await extractor.extract({ extractors: ['decision', 'rule'] });
    // 为新条目添加 source_change 溯源
    for (const entry of extractorResult.created) {
      entry.source_change = changeName;
      store.save(entry, entry.body);
    }
    return { changeName, artifacts: Object.keys(artifacts), created: extractorResult.created };
  }

  /**
   * 知识库状态
   */
  status() {
    const vectorStore = new VectorStore(this.codekbDir);
    const bm25 = new BM25Index(this.codekbDir);
    const store = new KnowledgeStore(this.projectDir);
    const stale = store.list({ includeSuperseded: true }).filter((e) => e.status === 'potentially_stale');
    const merkle = loadMerkleState(this.codekbDir);
    return {
      indexed_chunks: vectorStore.count(),
      indexed_docs: bm25.count(),
      knowledge_entries: store.list({ includeSuperseded: true, includeDrafts: true }).length,
      stale_entries: stale.length,
      codegraph: this.isCodegraphReady() ? 'ready' : 'not-initialized',
      last_sync: merkle ? new Date().toISOString() : 'never',
      index_health: vectorStore.count() > 0 ? 'healthy' : 'empty',
    };
  }

  isCodegraphReady() {
    return fs.existsSync(path.join(this.projectDir, '.codegraph'));
  }

  updateGitignore() {
    const p = path.join(this.projectDir, '.gitignore');
    const content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    const lines = ['', '# CodeKB', 'codekb/index/'];
    if (!content.includes('codekb/index/')) {
      fs.writeFileSync(p, content + lines.join('\n') + '\n', 'utf8');
    }
  }

  installHooks() {
    const hooksDir = path.join(this.projectDir, '.git', 'hooks');
    if (!fs.existsSync(hooksDir)) return;
    const postCommit = path.join(hooksDir, 'post-commit');
    const hookContent = '#!/bin/sh\ncodekb sync --incremental 2>/dev/null &\n';
    if (!fs.existsSync(postCommit) || !fs.readFileSync(postCommit, 'utf8').includes('codekb')) {
      fs.writeFileSync(postCommit, hookContent, { mode: 0o755 });
    }
    const postCheckout = path.join(hooksDir, 'post-checkout');
    const checkoutContent = '#!/bin/sh\nif [ "$3" = "1" ]; then\n  codekb sync --incremental 2>/dev/null &\nfi\n';
    if (!fs.existsSync(postCheckout) || !fs.readFileSync(postCheckout, 'utf8').includes('codekb')) {
      fs.writeFileSync(postCheckout, checkoutContent, { mode: 0o755 });
    }
  }
}

function countLines(files) {
  let lines = 0;
  for (const f of files) {
    try { lines += fs.readFileSync(f, 'utf8').split('\n').length; } catch { /* ignore */ }
  }
  return lines;
}
