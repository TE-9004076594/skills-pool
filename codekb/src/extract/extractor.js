/**
 * 五类知识提取器 — LLM 驱动的知识提取管线
 *
 * 提取器:
 * - pattern      架构模式识别（依赖模块图 + 源码）
 * - decision     设计决策提取（Git commit + WHY/NOTE/HACK 注释 + PR）
 * - rule         业务规则提取（条件分支、校验逻辑、常量、测试用例）
 * - convention   编码约定提取（代码风格一致性 + lint 配置交叉验证）
 * - bug-pattern  缺陷模式提取（Git fix/bugfix/hotfix commit + diff）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { KnowledgeStore, generateId } from '../knowledge/store.js';

/**
 * LLM 客户端（OpenAI-compatible API）
 * 无 API Key 时降级为启发式提取（不调用 LLM）
 */
export class LLMClient {
  constructor(config) {
    this.config = config?.extraction || {};
    this.apiKey = process.env[this.config.api_key_env || 'OPENAI_API_KEY'] || process.env.OPENAI_API_KEY;
  }

  get available() {
    return Boolean(this.apiKey && this.config.base_url);
  }

  async complete(systemPrompt, userPrompt, { maxTokens = 2000 } = {}) {
    if (!this.available) return null;
    const url = `${this.config.base_url.replace(/\/$/, '')}/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    });
    if (!resp.ok) throw new Error(`LLM API 调用失败: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || null;
  }
}

/**
 * 内容哈希缓存 — 未变更的源不重复调用 LLM
 */
class ExtractCache {
  constructor(codekbDir) {
    this.cacheDir = path.join(codekbDir, 'index', 'cache');
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
    this.manifest = new Map();
    if (fs.existsSync(this.manifestPath)) {
      const data = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      this.manifest = new Map(Object.entries(data));
    }
  }

  hash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  hit(key, contentHash) {
    return this.manifest.get(key) === contentHash;
  }

  set(key, contentHash) {
    this.manifest.set(key, contentHash);
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(this.manifestPath, JSON.stringify(Object.fromEntries(this.manifest), null, 2), 'utf8');
  }
}

/**
 * 知识提取器主类
 */
export class KnowledgeExtractor {
  constructor(projectDir, config) {
    this.projectDir = projectDir;
    this.config = config;
    this.store = new KnowledgeStore(projectDir);
    this.llm = new LLMClient(config);
    this.cache = new ExtractCache(path.join(projectDir, 'codekb'));
  }

  /**
   * 提取入口
   * @param {Object} options - { scope, extractors, force, fromChange, staleOnly }
   */
  async extract(options = {}) {
    const extractors = options.extractors || this.config.extraction?.extractors || [];
    const results = { created: [], updated: [], byType: {}, lowConfidence: [], skipped: [] };

    for (const extractor of extractors) {
      try {
        const r = await this.runExtractor(extractor, options);
        results.created.push(...r.created);
        results.updated.push(...r.updated);
        results.byType[extractor] = (results.byType[extractor] || 0) + r.created.length;
        results.lowConfidence.push(...r.lowConfidence);
      } catch (err) {
        results.skipped.push({ extractor, error: err.message });
      }
    }
    return results;
  }

  async runExtractor(type, options) {
    switch (type) {
      case 'decision': return this.extractDecisions(options);
      case 'rule': return this.extractRules(options);
      case 'convention': return this.extractConventions(options);
      case 'bug-pattern': return this.extractBugPatterns(options);
      case 'pattern': return this.extractPatterns(options);
      default: return { created: [], updated: [], lowConfidence: [] };
    }
  }

  /**
   * 设计决策提取 — Git commit message + PR 描述 + WHY/NOTE/HACK 注释
   */
  async extractDecisions(options) {
    const created = [];
    const input = this.collectCommitMessages() + '\n' + this.collectSpecialComments();
    const cacheKey = `decision:${this.cache.hash(input)}`;
    if (!options.force && this.cache.hit('decision', this.cache.hash(input))) {
      return { created: [], updated: [], lowConfidence: [] };
    }
    if (this.llm.available) {
      const result = await this.llm.complete(
        '你是资深软件架构师。从输入的 Git 提交信息、PR 描述、代码注释中提取设计决策。输出 JSON 数组，每项包含: title, reason, related_symbols[], confidence(0-1), body',
        input,
        { maxTokens: 3000 },
      );
      created.push(...this.persistLlmResults(result, 'decision', { source: 'git-history + code-analysis' }));
    }
    // 启发式：提取 WHY/NOTE/HACK 注释为低置信度决策
    created.push(...this.heuristicDecisions());
    this.cache.set('decision', this.cache.hash(input));
    const lowConfidence = created.filter((e) => e.confidence < 0.7);
    return { created, updated: [], lowConfidence };
  }

  /**
   * 业务规则提取 — 条件分支、校验逻辑、常量、测试用例
   */
  async extractRules(options) {
    const created = [];
    const scopeFiles = this.scopeFiles(options.scope);
    const samples = scopeFiles.slice(0, 10).map((f) => {
      const content = fs.readFileSync(f, 'utf8').slice(0, 4000);
      return `### ${path.basename(f)}\n${content}`;
    }).join('\n');
    const input = `从以下源码中提取隐含的业务规则：\n\n${samples}`;
    const cacheKey = `rule:${this.cache.hash(input)}`;
    if (!options.force && this.cache.hit('rule', this.cache.hash(input))) {
      return { created: [], updated: [], lowConfidence: [] };
    }
    if (this.llm.available) {
      const result = await this.llm.complete(
        '从源码中提取业务规则。输出 JSON 数组，每项包含: title, description, related_symbols[], confidence(0-1)',
        input,
        { maxTokens: 3000 },
      );
      created.push(...this.persistLlmResults(result, 'rule', { source: 'code-analysis' }));
    }
    this.cache.set('rule', this.cache.hash(input));
    const lowConfidence = created.filter((e) => e.confidence < 0.7);
    return { created, updated: [], lowConfidence };
  }

  /**
   * 编码约定提取 — 代码风格推断 + lint 配置交叉验证
   */
  async extractConventions(options) {
    const created = [];
    const lintConfig = this.detectLintConfig();
    const input = `项目 lint 配置: ${JSON.stringify(lintConfig)}\n\n分析以上配置与常见编码风格，推断项目编码约定。输出 JSON 数组，每项包含: title, description, scope(global|module), source(lint|inferred), example, confidence(0-1)`;
    if (this.llm.available) {
      const result = await this.llm.complete(
        '你是代码规范专家。基于 lint 配置和代码风格推断项目编码约定。输出 JSON 数组，每项包含: title, description, scope, source, example, confidence(0-1)',
        input,
        { maxTokens: 2000 },
      );
      created.push(...this.persistLlmResults(result, 'convention', { source: 'lint-config + code-inference' }));
    } else {
      // 启发式约定
      created.push({
        id: 'convention-heuristic', type: 'convention',
        title: '项目配置了 lint 工具，应遵循其规则', status: 'accepted',
        confidence: 0.5, source: 'lint-config', tags: ['lint'], body: '检测到 ' + (lintConfig.tool || 'unknown') + ' 配置。',
      });
    }
    const lowConfidence = created.filter((e) => e.confidence < 0.7);
    return { created, updated: [], lowConfidence };
  }

  /**
   * 缺陷模式提取 — Git fix/bugfix/hotfix commit + diff
   */
  async extractBugPatterns(options) {
    const created = [];
    const fixCommits = this.collectFixCommits();
    const input = fixCommits.slice(0, 8).map((c) => `COMMIT ${c.hash}: ${c.message}\n${c.diff.slice(0, 2000)}`).join('\n');
    if (this.llm.available) {
      const result = await this.llm.complete(
        '从 fix commit 中提取缺陷模式。输出 JSON 数组，每项包含: title, severity(high|medium|low), trigger_conditions[], fix_pattern, related_symbols[], source_commits[], defense_advice, confidence(0-1)',
        input,
        { maxTokens: 4000 },
      );
      created.push(...this.persistLlmResults(result, 'bug-pattern', { source: 'git-history' }));
    }
    const lowConfidence = created.filter((e) => e.confidence < 0.7);
    return { created, updated: [], lowConfidence };
  }

  /**
   * 架构模式识别 — 模块依赖 + 通信方式
   */
  async extractPatterns(options) {
    const created = [];
    // 启发式：扫描常用架构模式信号
    const signals = this.detectArchitectureSignals();
    for (const sig of signals) {
      created.push({
        id: generateId('architecture', this.store.list({ includeSuperseded: true, includeDrafts: true }).map((e) => e.id)),
        type: 'architecture', title: sig.title, status: 'accepted',
        confidence: 0.6, source: 'code-analysis', tags: ['architecture'],
        related_symbols: sig.symbols || [],
        body: sig.description,
      });
    }
    const lowConfidence = created.filter((e) => e.confidence < 0.7);
    return { created, updated: [], lowConfidence };
  }

  // ===== 辅助方法 =====

  persistLlmResults(llmOutput, type, baseMeta) {
    if (!llmOutput) return [];
    const existing = this.store.list({ includeSuperseded: true, includeDrafts: true });
    const existingIds = existing.map((e) => e.id);
    const created = [];
    try {
      const items = typeof llmOutput === 'string' ? JSON.parse(llmOutput) : llmOutput;
      for (const item of items) {
        if (!item?.title) continue;
        const entry = {
          id: generateId(type, existingIds),
          type,
          title: item.title,
          status: 'accepted',
          date: new Date().toISOString().slice(0, 10),
          related_symbols: item.related_symbols || [],
          tags: item.tags || [],
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.6,
          source: baseMeta.source || 'llm-extraction',
          ...baseMeta,
        };
        existingIds.push(entry.id);
        const body = item.body || item.description || item.reason || item.fix_pattern || '';
        this.store.save(entry, body);
        created.push(entry);
      }
    } catch {
      // LLM 输出非 JSON，忽略
    }
    return created;
  }

  heuristicDecisions() {
    const created = [];
    const regex = /\/\/\s*(WHY|NOTE|HACK):\s*(.+)/g;
    for (const f of this.scopeFiles(undefined, 200)) {
      const content = fs.readFileSync(f, 'utf8');
      let m;
      while ((m = regex.exec(content))) {
        const entry = {
          id: generateId('decision', this.store.list({ includeSuperseded: true, includeDrafts: true }).map((e) => e.id)),
          type: 'design-decision', title: m[2].slice(0, 80), status: 'accepted',
          confidence: 0.55, source: 'code-comment', tags: ['auto-extracted'],
          related_symbols: [path.basename(f)],
          body: `${m[1]}: ${m[2]}\n来源文件: ${f}`,
        };
        this.store.save(entry, entry.body);
        created.push(entry);
      }
    }
    return created;
  }

  scopeFiles(scope, limit = 1000) {
    const { collectFiles } = dynamicImportChunker();
    const files = collectFiles(this.projectDir, this.config);
    const filtered = scope ? files.filter((f) => f.includes(scope)) : files;
    return filtered.slice(0, limit);
  }

  collectCommitMessages() {
    try {
      const log = execSync('git log --oneline -30', { cwd: this.projectDir, encoding: 'utf8' });
      return log;
    } catch {
      return '';
    }
  }

  collectSpecialComments() {
    let out = '';
    for (const f of this.scopeFiles(undefined, 100)) {
      try {
        const content = fs.readFileSync(f, 'utf8');
        const matches = content.match(/\/\/\s*(WHY|NOTE|HACK|TODO|FIXME):.*$/gm);
        if (matches) out += `### ${f}\n${matches.join('\n')}\n`;
      } catch { /* ignore */ }
    }
    return out;
  }

  collectFixCommits() {
    try {
      const log = execSync('git log --all --oneline --grep="fix" --grep="bug" --grep="hotfix" -i -30', { cwd: this.projectDir, encoding: 'utf8' });
      const commits = [];
      for (const line of log.split('\n').filter(Boolean)) {
        const hash = line.split(' ')[0];
        const message = line.slice(hash.length).trim();
        let diff = '';
        try {
          diff = execSync(`git show --stat ${hash}`, { cwd: this.projectDir, encoding: 'utf8' });
        } catch { /* ignore */ }
        commits.push({ hash, message, diff });
      }
      return commits;
    } catch {
      return [];
    }
  }

  detectLintConfig() {
    for (const name of ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.prettierrc', '.editorconfig', 'ktlint', 'pom.xml']) {
      const p = path.join(this.projectDir, name);
      if (fs.existsSync(p)) {
        try { return { tool: name, config: fs.readFileSync(p, 'utf8').slice(0, 500) }; } catch { return { tool: name }; }
      }
    }
    return {};
  }

  detectArchitectureSignals() {
    const signals = [];
    const all = this.scopeFiles(undefined, 1000).join('\n');
    const check = (label, regex, desc, symbols) => {
      if (regex.test(all)) signals.push({ title: label, description: desc, symbols });
    };
    check('事件驱动架构', /(eventBus|EventEmitter|dispatchEvent|publish\(|subscribe\(|EventBus)/, '检测到事件总线/发布订阅模式，可能存在事件驱动架构。', ['EventBus', 'EventEmitter']);
    check('分层架构', /(Repository|Service|Controller|Dao|Mapper)/, '检测到 Repository/Service/Controller 分层模式。', ['Repository', 'Service', 'Controller']);
    check('Saga 模式', /(Saga|compensat|orchestrat|choreograph)/, '检测到 Saga/补偿事务模式。', ['Saga']);
    check('CQRS 模式', /(CommandQuery|CommandHandler|QueryHandler|WriteModel|ReadModel)/, '检测到 CQRS 读写分离模式。', ['CommandHandler', 'QueryHandler']);
    return signals;
  }
}

// 动态导入分块器避免循环依赖
let _chunker = null;
function dynamicImportChunker() {
  return {
    collectFiles: (dir, cfg) => {
      const files = [];
      const walk = (d) => {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'codekb') continue;
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else files.push(full);
        }
      };
      walk(dir);
      return files;
    },
  };
}
