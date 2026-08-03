/**
 * Merkle Tree 文件哈希校验 — 快速判断索引是否需要更新
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * 计算文件内容哈希（SHA-256）
 */
export function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * 构建 Merkle Tree（按目录层级哈希聚合）
 * 返回 { tree: Map<path, hash>, rootHash: string }
 */
export function buildMerkleTree(files) {
  const leafHashes = new Map();
  for (const file of files) {
    leafHashes.set(file, fileHash(file));
  }
  // 聚合目录哈希
  const dirHashes = new Map();
  const tree = new Map(leafHashes);
  for (const file of files) {
    let dir = path.dirname(file);
    const parts = [];
    while (dir && dir !== path.parse(dir).root) {
      parts.unshift(path.basename(dir));
      dir = path.dirname(dir);
    }
    const dirKey = parts.join('/');
    dirHashes.set(dirKey, (dirHashes.get(dirKey) || '') + leafHashes.get(file));
  }
  let rootHash = '';
  const sorted = [...dirHashes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, h] of sorted) {
    rootHash += h;
  }
  rootHash = crypto.createHash('sha256').update(rootHash).digest('hex');
  return { tree, rootHash };
}

/**
 * 与已保存的 Merkle 状态对比，返回变更文件列表
 */
export function diffMerkleTree(previous, current) {
  if (!previous || !previous.tree) return { changed: [...current.tree.keys()], added: [...current.tree.keys()], removed: [] };
  const changed = [];
  const added = [];
  const removed = [];
  for (const [file, hash] of current.tree) {
    if (!previous.tree.has(file)) added.push(file);
    else if (previous.tree.get(file) !== hash) changed.push(file);
  }
  for (const file of previous.tree.keys()) {
    if (!current.tree.has(file)) removed.push(file);
  }
  return { changed: [...added, ...changed], added, removed };
}

/**
 * 保存 Merkle 状态到磁盘
 */
export function saveMerkleState(codekbDir, state) {
  const indexDir = path.join(codekbDir, 'index');
  fs.mkdirSync(indexDir, { recursive: true });
  const serializable = { rootHash: state.rootHash, tree: Object.fromEntries(state.tree) };
  fs.writeFileSync(path.join(indexDir, 'merkle.json'), JSON.stringify(serializable, null, 2), 'utf8');
}

/**
 * 从磁盘加载 Merkle 状态
 */
export function loadMerkleState(codekbDir) {
  const p = path.join(codekbDir, 'index', 'merkle.json');
  if (!fs.existsSync(p)) return null;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { rootHash: data.rootHash, tree: new Map(Object.entries(data.tree || {})) };
}
