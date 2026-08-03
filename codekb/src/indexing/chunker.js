/**
 * AST-aware 代码分块器
 *
 * 优先使用 tree-sitter 按语义单元分块（函数/类/模块），
 * 不可用时回退到启发式分块（缩进/大括号平衡），保证工具始终可用。
 */
import fs from 'node:fs';
import path from 'node:path';

// 支持的扩展名 → tree-sitter 语言
const LANG_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.kt': 'kotlin', '.kts': 'kotlin', '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp',
  '.cs': 'c_sharp', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
  '.kt': 'kotlin', '.scala': 'scala', '.sh': 'bash', '.zsh': 'bash',
};

// tree-sitter 可选增强：安装 node-tree-sitter 后启用 AST 分块
let Parser = null;
try {
  const treeSitter = await import('node-tree-sitter');
  Parser = treeSitter.default || treeSitter;
} catch {
  Parser = null; // tree-sitter 不可用，使用启发式分块
}

/**
 * 分块结果
 * @typedef {Object} Chunk
 * @property {string} file       文件路径
 * @property {number} startLine  起始行（1-based）
 * @property {number} endLine    结束行
 * @property {string} kind       function | class | module | file
 * @property {string} name       符号名（如 ClassName.methodName）
 * @property {string} content    代码内容
 * @property {string} signature  函数签名或类声明行
 */

/**
 * 读取项目文件（按 include/exclude glob 过滤）
 */
export function collectFiles(projectDir, config) {
  const { globSync } = requireGlob();
  const includePatterns = config.include.map((p) => path.join(projectDir, p));
  const excludePatterns = config.exclude.map((p) => path.join(projectDir, p));
  const files = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'codekb') continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(projectDir, full);
      if (entry.isDirectory()) walk(full);
      else if (isIncluded(rel, includePatterns, excludePatterns, projectDir)) files.push(full);
    }
  };
  walk(projectDir);
  return files;
}

function isIncluded(rel, includePatterns, excludePatterns, projectDir) {
  const abs = path.join(projectDir, rel);
  if (excludePatterns.some((p) => matchesGlob(abs, p))) return false;
  if (includePatterns.length === 0) return true;
  return includePatterns.some((p) => matchesGlob(abs, p));
}

// 极简 glob 匹配（* 与 ** 支持）
function matchesGlob(filePath, pattern) {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${regexStr}$`).test(filePath);
}

function requireGlob() {
  // 内联 glob 匹配，避免额外依赖
  return { globSync: () => [] };
}

/**
 * 对单个文件分块
 */
export function chunkFile(filePath, projectDir) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  const lang = LANG_MAP[ext] || null;

  if (lang && Parser) {
    try {
      return chunkWithTreeSitter(filePath, content, lang);
    } catch {
      // 回退到启发式
    }
  }
  return chunkHeuristic(filePath, content);
}

/**
 * tree-sitter 分块（函数/类级）
 */
function chunkWithTreeSitter(filePath, content, lang) {
  const parser = new Parser();
  const Lang = Parser.Language;
  if (!Lang || !Lang.load) return chunkHeuristic(filePath, content);
  const language = Lang.load(`tree-sitter-${lang}`) || null;
  if (!language) return chunkHeuristic(filePath, content);
  parser.setLanguage(language);
  const tree = parser.parse(content);
  const chunks = [];
  const lines = content.split('\n');

  const walk = (node, depth) => {
    if (!node) return;
    const type = node.type;
    if (isFunctionNode(type)) {
      const start = node.startPosition.row + 1;
      const end = node.endPosition.row + 1;
      const text = content.slice(node.startIndex, node.endIndex);
      const name = extractFunctionName(node) || `fn_${start}`;
      chunks.push({
        file: filePath, startLine: start, endLine: end,
        kind: 'function', name, signature: text.split('\n')[0].slice(0, 200), content: text,
      });
    } else if (isClassNode(type)) {
      const start = node.startPosition.row + 1;
      const end = node.endPosition.row + 1;
      const text = content.slice(node.startIndex, node.endIndex);
      const name = extractClassName(node) || `class_${start}`;
      chunks.push({
        file: filePath, startLine: start, endLine: end,
        kind: 'class', name, signature: text.split('\n')[0].slice(0, 200), content: text,
      });
    }
    for (const child of node.namedChildren) walk(child, depth + 1);
  };
  walk(tree.rootNode, 0);
  return chunks.length ? chunks : fileLevelChunk(filePath, content);
}

function isFunctionNode(type) {
  return type === 'function_declaration' || type === 'method_definition'
    || type === 'arrow_function' || type === 'function_definition'
    || type === 'method' || type === 'function_item' || type === 'func_declaration'
    || type === 'def' || type === 'class_declaration' || type === 'local_function_statement';
}

function isClassNode(type) {
  return type === 'class_declaration' || type === 'class' || type === 'impl_item'
    || type === 'class_definition';
}

function extractFunctionName(node) {
  const nameNode = node.childForFieldName('name');
  return nameNode ? nameNode.text : null;
}
function extractClassName(node) {
  const nameNode = node.childForFieldName('name');
  return nameNode ? nameNode.text : null;
}

/**
 * 启发式分块（tree-sitter 不可用时）— 按空行 + 缩进切分
 */
function chunkHeuristic(filePath, content) {
  const lines = content.split('\n');
  if (lines.length <= 50) return fileLevelChunk(filePath, content);
  const chunks = [];
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    // 在空行或缩进回退处切分，块大小约 30-80 行
    const isBlank = lines[i].trim() === '';
    if (isBlank && i - start >= 30 && i - start <= 80) {
      chunks.push({
        file: filePath, startLine: start + 1, endLine: i,
        kind: 'segment', name: `seg_${start + 1}`,
        signature: lines[start].slice(0, 200), content: lines.slice(start, i).join('\n'),
      });
      start = i + 1;
    }
  }
  if (start < lines.length) {
    chunks.push({
      file: filePath, startLine: start + 1, endLine: lines.length,
      kind: 'segment', name: `seg_${start + 1}`,
      signature: lines[start].slice(0, 200), content: lines.slice(start).join('\n'),
    });
  }
  return chunks;
}

function fileLevelChunk(filePath, content) {
  return [{
    file: filePath, startLine: 1, endLine: content.split('\n').length,
    kind: 'file', name: path.basename(filePath),
    signature: '', content,
  }];
}

export { LANG_MAP };
