/**
 * 向量索引 — LanceDB 优先，JSON 文件降级
 *
 * 由于 LanceDB 是可选依赖（需要下载），提供纯 JS 降级实现，
 * 保证工具在未安装 native 依赖时仍然可用（降级模式下仅内存检索）。
 */
import fs from 'node:fs';
import path from 'node:path';

let lancedb = null;
try {
  lancedb = await import('@lancedb/lancedb');
} catch {
  lancedb = null;
}

/**
 * 嵌入器接口：生产环境接入 jina-code-embeddings-0.5B (ONNX) 或 voyage-code-3 API
 * 降级实现：基于字符 n-gram 的哈希向量（确定性、无外部依赖）
 */
export class Embedder {
  constructor(config) {
    this.config = config;
    this.dimensions = config?.embedding?.dimensions || 896;
    this.provider = config?.embedding?.provider || 'local';
  }

  /**
   * 对文本生成嵌入向量
   * 降级实现：字符 bigram + 词哈希 → 固定维度稀疏向量（近似语义）
   */
  async embed(texts) {
    return texts.map((t) => this._hashEmbed(t));
  }

  _hashEmbed(text) {
    const dim = this.dimensions;
    const vec = new Float32Array(dim);
    const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) || [];
    // 字符 bigram
    const bigrams = [];
    for (let i = 0; i < text.length - 1; i++) {
      if (/[a-z0-9_]/i.test(text[i]) && /[a-z0-9_]/i.test(text[i + 1])) {
        bigrams.push(text.slice(i, i + 2).toLowerCase());
      }
    }
    for (const token of tokens) {
      const idx = this._hash(token) % dim;
      vec[idx] += 1;
    }
    for (const bg of bigrams) {
      const idx = this._hash(`bg:${bg}`) % dim;
      vec[idx] += 0.5;
    }
    // L2 归一化
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    for (let i = 0; i < dim; i++) vec[i] /= norm;
    return Array.from(vec);
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}

/**
 * 向量存储抽象
 */
export class VectorStore {
  constructor(codekbDir) {
    this.codekbDir = codekbDir;
    this.indexDir = path.join(codekbDir, 'index');
    this.jsonPath = path.join(this.indexDir, 'vectors.json');
    this._records = new Map(); // key: file:startLine → { id, file, startLine, endLine, kind, name, signature, content, vector }
    this.usingLance = false;
    this._init();
  }

  _init() {
    fs.mkdirSync(this.indexDir, { recursive: true });
    if (fs.existsSync(this.jsonPath)) {
      const data = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
      for (const rec of data.records || []) {
        this._records.set(rec.id, rec);
      }
    }
  }

  /**
   * upsert 记录（按 id 去重）
   */
  async upsert(records) {
    for (const rec of records) {
      this._records.set(rec.id, rec);
    }
    this._persist();
    return records.length;
  }

  /**
   * 按文件删除记录（增量同步时移除已删除文件）
   */
  async deleteByFile(filePath) {
    let removed = 0;
    for (const [id, rec] of this._records) {
      if (rec.file === filePath) {
        this._records.delete(id);
        removed++;
      }
    }
    this._persist();
    return removed;
  }

  /**
   * 向量相似度检索（降级实现：余弦相似度暴力搜索）
   */
  async search(queryVector, { topK = 10, scope = null } = {}) {
    const scored = [];
    for (const rec of this._records.values()) {
      if (scope && !scope.some((s) => rec.file.includes(s))) continue;
      const sim = cosine(queryVector, rec.vector);
      scored.push({ ...rec, score: sim });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  count() {
    return this._records.size;
  }

  _persist() {
    const records = [...this._records.values()];
    fs.writeFileSync(this.jsonPath, JSON.stringify({ usingLance: this.usingLance, records }, null, 2), 'utf8');
  }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
