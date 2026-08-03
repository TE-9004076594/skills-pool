/**
 * 知识条目存储 — Markdown + YAML frontmatter，Git 管理
 *
 * 目录结构:
 *   codekb/knowledge/
 *     architecture/   # 架构模式
 *     decisions/      # 设计决策
 *     rules/          # 业务规则
 *     conventions/    # 编码约定
 *     bug-patterns/   # 缺陷模式
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';

const TYPE_DIRS = {
  'architecture': 'architecture',
  'design-decision': 'decisions',
  'rule': 'rules',
  'convention': 'conventions',
  'bug-pattern': 'bug-patterns',
  'pattern': 'architecture',
  'decision': 'decisions',
};

const VALID_TYPES = Object.keys(TYPE_DIRS);
const VALID_STATUS = ['accepted', 'draft', 'rejected', 'superseded', 'potentially_stale'];

/**
 * 解析 Markdown + YAML frontmatter 文件
 */
export function parseKnowledgeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { id: path.basename(filePath, '.md'), body: content, filePath, _parseError: true };
  }
  const frontmatter = yaml.load(match[1]) || {};
  return { ...frontmatter, body: match[2].trim(), filePath };
}

/**
 * 序列化为 Markdown + YAML frontmatter
 */
export function serializeKnowledge(entry, body) {
  const { body: _body, filePath: _fp, ...meta } = entry;
  const fm = yaml.dump(meta, { lineWidth: 100 });
  return `---\n${fm.trim()}\n---\n\n${body || ''}\n`;
}

/**
 * 生成新的知识条目 ID（如 decision-001）
 */
export function generateId(type, existingIds) {
  const prefix = type === 'design-decision' ? 'decision'
    : type === 'bug-pattern' ? 'bugpattern'
    : type;
  const used = existingIds
    .filter((id) => id.startsWith(`${prefix}-`))
    .map((id) => parseInt(id.split('-').pop(), 10) || 0);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/**
 * 知识库存储类
 */
export class KnowledgeStore {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.knowledgeDir = path.join(projectDir, 'codekb', 'knowledge');
  }

  getDirForType(type) {
    const dirName = TYPE_DIRS[type] || 'decisions';
    return path.join(this.knowledgeDir, dirName);
  }

  /**
   * 列出所有知识条目，支持过滤
   */
  list({ type, tags, relatedSymbol, status, includeSuperseded = false, includeDrafts = false } = {}) {
    if (!fs.existsSync(this.knowledgeDir)) return [];
    const entries = [];
    for (const dirName of Object.values(TYPE_DIRS)) {
      const dir = path.join(this.knowledgeDir, dirName);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const entry = parseKnowledgeFile(path.join(dir, file));
        entries.push(entry);
      }
    }
    return entries.filter((e) => {
      if (e._parseError) return false;
      if (type && TYPE_DIRS[type] && e.type !== type) return false;
      if (status && e.status !== status) return false;
      if (!includeSuperseded && e.status === 'superseded') return false;
      if (!includeDrafts && e.status === 'draft') return false;
      if (tags && Array.isArray(tags) && tags.length) {
        const entryTags = e.tags || [];
        if (!tags.some((t) => entryTags.includes(t))) return false;
      }
      if (relatedSymbol && !(e.related_symbols || []).some((s) => s.includes(relatedSymbol))) return false;
      return true;
    });
  }

  /**
   * 按 ID 查找条目
   */
  get(id) {
    for (const dirName of Object.values(TYPE_DIRS)) {
      const dir = path.join(this.knowledgeDir, dirName);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const entry = parseKnowledgeFile(path.join(dir, file));
        if (entry.id === id) return entry;
      }
    }
    return null;
  }

  /**
   * 保存条目（新增或更新）
   */
  save(entry, body) {
    const dir = this.getDirForType(entry.type);
    fs.mkdirSync(dir, { recursive: true });
    // 原子写：先写临时文件再 rename，避免半写状态
    const filePath = path.join(dir, `${entry.id}.md`);
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, serializeKnowledge(entry, body), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return filePath;
  }

  /**
   * 审阅条目: confirm | reject | edit
   */
  review(id, verdict, editText) {
    const entry = this.get(id);
    if (!entry) throw new Error(`知识条目不存在: ${id}`);
    if (verdict === 'confirm') {
      entry.confidence = 1.0;
    } else if (verdict === 'reject') {
      entry.status = 'rejected';
    } else if (verdict === 'edit') {
      if (!editText) throw new Error('edit 需要提供新的正文内容');
      return this.save(entry, editText);
    }
    // 保留修改历史：git 负责版本管理
    return this.save(entry, entry.body);
  }

  /**
   * 标记条目为 potentially_stale
   */
  markStale(relatedSymbols) {
    const stale = [];
    for (const entry of this.list({ includeSuperseded: true, includeDrafts: true })) {
      const symbols = entry.related_symbols || [];
      const match = symbols.some((s) => {
        const base = s.replace(/\.\*$/, '').split('.').slice(0, 2).join('.');
        return relatedSymbols.some((rs) => rs.includes(base) || base.includes(rs));
      });
      if (match && entry.status !== 'superseded' && entry.status !== 'rejected') {
        entry.status = 'potentially_stale';
        this.save(entry, entry.body);
        stale.push(entry.id);
      }
    }
    return stale;
  }

  /**
   * 应用取代关系: 新决策 supersedes 旧决策
   */
  applySupersede(newEntryId, supersededIds) {
    const updated = [];
    for (const oldId of supersededIds) {
      const old = this.get(oldId);
      if (!old) continue;
      old.status = 'superseded';
      old.superseded_by = newEntryId;
      this.save(old, old.body);
      updated.push(oldId);
    }
    return updated;
  }
}

export { VALID_TYPES, VALID_STATUS };
