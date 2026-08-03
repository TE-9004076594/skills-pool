/**
 * BM25 词法索引 — 纯 JS 实现（不依赖 Tantivy，保证可运行）
 */
import fs from 'node:fs';
import path from 'node:path';

const K1 = 1.5;
const B = 0.75;

/**
 * 简单 tokenizer：提取单词 + 保留符号名/错误信息片段
 */
function tokenize(text) {
  const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) || [];
  // 对 CamelCase 分词（FooBar → foo, bar）
  const refined = [];
  for (const t of tokens) {
    const parts = t.match(/[a-z]+|[A-Z][a-z]*|\d+/g);
    if (parts) refined.push(...parts.map((p) => p.toLowerCase()));
    else refined.push(t);
  }
  return refined;
}

export class BM25Index {
  constructor(codekbDir) {
    this.codekbDir = codekbDir;
    this.jsonPath = path.join(codekbDir, 'index', 'bm25.json');
    this.docs = new Map();   // id → { id, file, startLine, endLine, content }
    this.postings = new Map(); // term → Map<docId, tf>
    this.docFreq = new Map();  // term → df
    this.avgDl = 0;
    this._init();
  }

  _init() {
    if (fs.existsSync(this.jsonPath)) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
      this.docs = new Map(Object.entries(data.docs || {}));
      this.postings = new Map(Object.entries(data.postings || {}).map(([term, m]) => [term, new Map(Object.entries(m))]));
      this.docFreq = new Map(Object.entries(data.docFreq || {}));
      this.avgDl = data.avgDl || 0;
    }
  }

  /**
   * 索引/更新文档
   */
  async addDoc(rec) {
    const id = rec.id;
    const tokens = tokenize(rec.content || '');
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    // 移除旧 posting
    if (this.docs.has(id)) {
      const oldTokens = tokenize(this.docs.get(id).content || '');
      for (const t of new Set(oldTokens)) {
        const post = this.postings.get(t);
        if (post?.has(id)) {
          post.delete(id);
          if (post.size === 0) { this.postings.delete(t); this.docFreq.delete(t); }
        }
      }
    }
    this.docs.set(id, { id, file: rec.file, startLine: rec.startLine, endLine: rec.endLine, content: rec.content || '' });
    for (const [term, count] of tf) {
      if (!this.postings.has(term)) this.postings.set(term, new Map());
      this.postings.get(term).set(id, count);
    }
    // 更新 df + avgDl
    this._recomputeStats();
    this._persist();
  }

  async addDocs(records) {
    for (const rec of records) await this.addDoc(rec);
  }

  /**
   * 删除文档
   */
  async deleteByFile(filePath) {
    const toDelete = [...this.docs.values()].filter((d) => d.file === filePath).map((d) => d.id);
    for (const id of toDelete) {
      const tokens = tokenize(this.docs.get(id).content || '');
      for (const t of new Set(tokens)) {
        const post = this.postings.get(t);
        if (post?.has(id)) {
          post.delete(id);
          if (post.size === 0) { this.postings.delete(t); this.docFreq.delete(t); }
        }
      }
      this.docs.delete(id);
    }
    if (toDelete.length) this._recomputeStats();
    this._persist();
    return toDelete.length;
  }

  /**
   * BM25 检索
   */
  async search(query, { topK = 10, scope = null } = {}) {
    const terms = tokenize(query);
    if (!terms.length) return [];
    const docScores = new Map();
    for (const term of terms) {
      const post = this.postings.get(term);
      if (!post) continue;
      const df = this.docFreq.get(term) || 0;
      const idf = Math.log(1 + (this.docs.size - df + 0.5) / (df + 0.5));
      for (const [docId, tf] of post) {
        const doc = this.docs.get(docId);
        if (!doc) continue;
        if (scope && !scope.some((s) => doc.file.includes(s))) continue;
        const dl = tokenize(doc.content || '').length;
        const denom = tf + K1 * (1 - B + B * (dl / (this.avgDl || 1)));
        const score = idf * ((tf * (K1 + 1)) / denom);
        docScores.set(docId, (docScores.get(docId) || 0) + score);
      }
    }
    const results = [...docScores.entries()]
      .map(([id, score]) => ({ ...this.docs.get(id), score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return results;
  }

  count() {
    return this.docs.size;
  }

  _recomputeStats() {
    this.docFreq = new Map();
    for (const [term, post] of this.postings) {
      this.docFreq.set(term, post.size);
    }
    let totalLen = 0;
    for (const doc of this.docs.values()) totalLen += tokenize(doc.content || '').length;
    this.avgDl = this.docs.size ? totalLen / this.docs.size : 0;
  }

  _persist() {
    const data = {
      docs: Object.fromEntries(this.docs),
      postings: Object.fromEntries([...this.postings.entries()].map(([t, m]) => [t, Object.fromEntries(m)])),
      docFreq: Object.fromEntries(this.docFreq),
      avgDl: this.avgDl,
    };
    fs.writeFileSync(this.jsonPath, JSON.stringify(data), 'utf8');
  }
}
