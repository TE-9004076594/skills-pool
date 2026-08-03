/**
 * codekb.yaml 配置加载
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const DEFAULT_CONFIG = {
  version: 1,
  include: ['src/**', 'lib/**', 'app/**'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.generated.*', '**/.git/**'],
  embedding: {
    provider: 'local',
    model: 'jina-code-embeddings-0.5B',
    dimensions: 896,
    batch_size: 32,
  },
  extraction: {
    provider: 'openai-compatible',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    extractors: ['pattern', 'decision', 'rule', 'convention', 'bug-pattern'],
    auto_extract_on_archive: true,
  },
  retrieval: {
    hybrid: {
      structural_weight: 0.3,
      semantic_weight: 0.5,
      lexical_weight: 0.2,
    },
    reranker: { enabled: false },
    max_context_tokens: 4096,
  },
  branch_rules: {
    hotfix: { read_only: true, extract_on_merge: true },
  },
};

/**
 * 查找项目根目录中的 codekb 目录
 */
export function findCodekbDir(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, 'codekb');
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'codekb.yaml'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * 加载项目配置（合并默认值）
 */
export function loadConfig(projectDir) {
  const codekbDir = path.join(projectDir, 'codekb');
  const configPath = path.join(codekbDir, 'codekb.yaml');
  const config = structuredClone(DEFAULT_CONFIG);

  if (fs.existsSync(configPath)) {
    const userConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
    Object.assign(config, userConfig);
    if (userConfig.embedding) Object.assign(config.embedding, userConfig.embedding);
    if (userConfig.extraction) Object.assign(config.extraction, userConfig.extraction);
    if (userConfig.retrieval) Object.assign(config.retrieval, userConfig.retrieval);
  }
  config.codekbDir = codekbDir;
  config.projectDir = projectDir;
  return config;
}

/**
 * 生成默认配置文件内容
 */
export function generateDefaultYaml() {
  return `# CodeKB 项目配置
version: 1

# 索引范围
include:
  - "src/**"
  - "lib/**"
  - "app/**"
exclude:
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/build/**"
  - "**/*.generated.*"

# 嵌入模型
embedding:
  provider: local              # local | voyage | openai-compatible
  model: jina-code-embeddings-0.5B
  dimensions: 896
  batch_size: 32

# LLM 知识提取
extraction:
  provider: openai-compatible
  base_url: https://api.openai.com/v1
  model: gpt-4o
  extractors:
    - pattern
    - decision
    - rule
    - convention
    - bug-pattern
  auto_extract_on_archive: true

# 检索配置
retrieval:
  hybrid:
    structural_weight: 0.3
    semantic_weight: 0.5
    lexical_weight: 0.2
  reranker:
    enabled: false
  max_context_tokens: 4096
`;
}
