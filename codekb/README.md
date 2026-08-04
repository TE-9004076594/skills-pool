# codekb

源码语义知识库 — OpenSpec + CodeGraph AI Coding 框架的第三层能力（语义知识层）。

从源码、Git 历史、代码注释中自动提取架构模式、设计决策、业务规则、编码约定、缺陷模式，支持自然语言混合检索与 RAG 问答，使 AI 在编码时具备"项目记忆"。

## 功能

| 能力 | 工具 | 说明 |
|------|------|------|
| 项目初始化 | `codekb init` | tree-sitter 分块 + 向量 + BM25 混合索引 + Git hook |
| 混合检索 | `codekb_search` | 结构化 + 语义 + 词法三通道，RRF 融合 |
| 符号解释 | `codekb_explain` | 功能摘要 + 知识 + 缺陷模式 + 调用关系 + 约定 |
| RAG 问答 | `codekb_ask` | 分层上下文（≤4K tokens）+ 溯源 |
| 知识提取 | `codekb_extract` | 五类 LLM 提取器（pattern/decision/rule/convention/bug-pattern） |
| 知识审阅 | `codekb_review` | confirm / reject / edit，confidence 管理 |
| 编码约定 | `codekb_conventions` | 全局/领域约定查询 |
| OpenSpec 集成 | `codekb extract --from-change` | archive 阶段知识反哺（可选，见下方解耦说明） |

## 安装

```bash
# 方式一：npm 全局安装（发布到 registry 后）
npm install -g @yun918/codekb

# 方式二：从仓库源码本地安装（开发调试）
cd skills-pool/codekb
npm install
npm install -g .

# 在项目中初始化
cd your-project
codekb init
```

MCP Server 配置（初始化后打印）：
```json
{ "mcpServers": { "codekb": { "command": "codekb", "args": ["mcp"], "env": { "CODEKB_PROJECT": "<project-path>" } } } }
```

## 发布到 npm（npm install -g @yun918/codekb）

`@yun918/codekb` 是 scoped 包名，支持标准 npm 全局安装。

### 一次发布（只需做一次）

> **⚠️ 镜像源问题**：如果 `npm login` 报错 `Public registration is not allowed`，说明全局 registry 配置成了镜像源（如 npmmirror），它不允许注册/发布。本包已在 `codekb/.npmrc` 中指定官方 registry，在 codekb 目录下执行命令即可；若仍未生效，手动执行：
> ```bash
> npm login --registry=https://registry.npmjs.org/
> npm publish --registry=https://registry.npmjs.org/
> ```

> **⚠️ 发布前提**：npm 要求发布包账号必须开启 **2FA**（双因素认证）。未开启 2FA 时 `npm publish` 报 403。请先在 https://www.npmjs.com/settings/yun918/2fa 开启，然后在 [Access Tokens](https://www.npmjs.com/settings/yun918/tokens) 生成 **Granular Access Token**（Read and write 权限），配置：`npm config set //registry.npmjs.org/:_authToken=新token`。

```bash
# 1. 在 codekb 目录下登录（项目级 .npmrc 已指向官方 registry）
cd codekb
npm login
npm whoami        # 确认显示 yun918

# 2. 发布（scoped 包需声明 public）
npm publish --access public
# 如提示 OTP: npm publish --access public --otp=<验证码>
```

### 发布新版本（每次更新）

```bash
cd codekb

# 版本号递增：0.1.0 → 0.1.1 (patch) / 0.2.0 (minor) / 1.0.0 (major)
npm version patch -m "release: v%s"

# 发布
npm publish
```

### 用户安装方式

```bash
# 全局安装（推荐）
npm install -g @yun918/codekb

# 或项目内安装
npm install @yun918/codekb
```

### 打包内容验证

```bash
npm pack --dry-run   # 预览发布内容，确认无 node_modules
npm view @yun918/codekb   # 发布后验证 registry 可见
```

> **注意**：`files` 字段已配置，只打包 `bin/`、`src/`、`skills/`、插件配置和 README。`node_modules/`、`index/`、测试目录不会进入发布包。

> **可选增强**：安装 `node-tree-sitter`、`@lancedb/lancedb`、`onnxruntime-node` 以获得 AST 分块和向量检索；未安装时自动降级为启发式分块 + JSON 向量存储。

## 安装技能（npx skills）

```bash
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/codekb --all
```

安装后共 7 个技能：6 个 `codekb-*` + 1 个 `openspec-codekb-integration`。

## OpenSpec 关联（解耦设计）

CodeKB 与 OpenSpec 是**解耦**的：

- **未安装 CodeKB**：`openspec-*` 技能 + CodeGraph 完全独立工作，不涉及 CodeKB
- **安装 CodeKB 并初始化后**：通过 `openspec-codekb-integration` 技能获得各阶段语义增强
  - `/opsx:explore` — 知识概览注入
  - `/opsx:propose` — 约束关联（confidence ≥ 0.7）
  - `/opsx:apply` — 按需知识查询
  - `/opsx:archive` — 知识反哺（`codekb extract --from-change`）
  - `/opsx:android-bug` — Bug Pattern 检索
- 无论是否安装 CodeKB，OpenSpec 工作流都不会被阻塞

## CLI 命令

```bash
codekb init [--skip-extract]            # 初始化项目
codekb sync [--incremental|--reindex]   # 同步索引
codekb extract [--scope <path>] [--from-change <name>] [--force]  # 知识提取
codekb list [--type <type>] [--tags <tags>] [--status <status>]   # 浏览条目
codekb review <id> <confirm|reject|edit>  # 审阅条目
codekb status                           # 索引健康状态
codekb mcp                              # 启动 MCP Server
```

## 目录结构

```
codekb/
├── bin/codekb.js           # CLI 入口
├── src/
│   ├── cli/index.js        # 命令分发
│   ├── config/index.js     # codekb.yaml 配置
│   ├── service.js          # 核心服务（CLI + MCP 共用）
│   ├── indexing/           # 分块 + 向量 + BM25 + Merkle Tree
│   ├── retrieval/          # 查询路由 + RRF 融合
│   ├── extract/            # 五类知识提取器
│   ├── knowledge/          # 知识条目存储（Markdown + YAML）
│   └── mcp/server.js       # MCP Server（SDK 可选，JSON-RPC 降级）
├── skills/                 # 7 个技能（6 codekb-* + openspec-codekb-integration）
└── package.json
```

## 降级策略

| 场景 | 行为 |
|------|------|
| 无 tree-sitter | 回退到启发式分块（按空行/缩进） |
| 无 LanceDB | 回退到 JSON 文件向量存储（余弦相似度） |
| 无 LLM API Key | 启发式提取（WHY/NOTE 注释、架构信号扫描） |
| 无 MCP SDK | 回退到 JSON-RPC 2.0 stdio 协议 |
| 无 CodeGraph | 结构化通道降级，语义 + 词法正常 |

## License

MIT
