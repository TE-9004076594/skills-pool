# skills-pool

Multi-package AI agent skills collection. Each package is independently versioned and can be installed separately.

**Available packages:**

| Package | Description |
|---------|-------------|
| [ai-coding](./ai-coding/) | OpenSpec workflow skills (propose, design, implement, verify, archive), OPSX slash commands, and Android debugging skills |
| [codekb](./codekb/) | 源码语义知识库 — 混合代码检索 + LLM 知识提取 + RAG 问答 + OpenSpec 工作流集成 |
| ai-coding-hyperscale | Hyperscale AI coding workflow skills *(coming soon)* |

## Prerequisites

### Git

Skills are installed from a Git repository, so Git must be available:

```bash
git --version        # check if Git is installed
```

- **macOS**: Included with Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Download from [git-scm.com](https://git-scm.com/)
- **Linux**: `sudo apt install git` (Debian/Ubuntu) / `sudo dnf install git` (Fedora)

### Node.js

OpenSpec CLI requires **Node.js >= 20.19.0**. Install or upgrade:

```bash
node --version        # check current version
```

- **macOS**: `brew install node`
- **Windows**: Download `.msi` from [nodejs.org](https://nodejs.org/)
- **Linux**: `sudo apt install nodejs` (Debian/Ubuntu) / `sudo dnf install nodejs` (Fedora)

### OpenSpec CLI

```bash
npm install -g @fission-ai/openspec@latest
openspec --version    # verify installation
```

### CodeGraph CLI

CodeGraph builds a pre-indexed knowledge graph of your codebase for faster agent context retrieval.

**Option 1 — Install script (no Node.js required):**

```bash
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
```

**Option 2 — npm (if Node.js already installed):**

```bash
npm i -g @colbymchenry/codegraph
```

**Verify and configure:**

```bash
codegraph --version
codegraph install     # auto-detect and wire up AI agents
```

### Platform Installation Guide

<details>
<summary>macOS</summary>

```bash
# Node.js
brew install node

# OpenSpec CLI
npm install -g @fission-ai/openspec@latest

# CodeGraph (script, no Node.js required)
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh

# or CodeGraph (npm)
npm i -g @colbymchenry/codegraph

# Verify
openspec --version
codegraph --version

# Install a package (e.g. ai-coding)
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/ai-coding --all
```

</details>

<details>
<summary>Windows</summary>

```powershell
# Node.js: download .msi from https://nodejs.org/

# OpenSpec CLI
npm install -g @fission-ai/openspec@latest

# CodeGraph (script, no Node.js required)
irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex

# or CodeGraph (npm)
npm i -g @colbymchenry/codegraph

# Verify
openspec --version
codegraph --version

# Install a package (e.g. ai-coding)
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/ai-coding --all
```

</details>

<details>
<summary>Linux</summary>

```bash
# Node.js (Debian/Ubuntu)
sudo apt install nodejs
# or Node.js (Fedora)
sudo dnf install nodejs

# OpenSpec CLI
npm install -g @fission-ai/openspec@latest

# CodeGraph (script, no Node.js required)
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh

# or CodeGraph (npm)
npm i -g @colbymchenry/codegraph

# Verify
openspec --version
codegraph --version

# Install a package (e.g. ai-coding)
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/ai-coding --all
```

</details>

> **Note**: `npm`-based commands (OpenSpec CLI, CodeGraph npm, npx skills) are identical across all platforms. Only Node.js installation and CodeGraph script install differ.

### Project Initialization

After installing OpenSpec CLI, initialize it in your project:

```bash
cd your-project
openspec init --tools claude,cursor
```

## Installing a Package

See the package's own README for detailed install instructions:

- [ai-coding → Installation](./ai-coding/#installing)

Quick reference:

```bash
# Install specific package (recommended)
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/ai-coding --all

# Install specific version (via Git tag)
npx skills add https://github.com/TE-9004076594/skills-pool/tree/ai-coding-v1.0.0/ai-coding --all

# Install entire repo (multi-package selection)
npx skills add https://github.com/TE-9004076594/skills-pool --all

# Install to specific agent only
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/ai-coding -s '*' -a claude-code
```

> **⚠️ Common error on Windows**: If using interactive mode (without `--all`) shows:
> ```
> ✗ find-skills → PromptScript: PromptScript does not support global skill installation
> ```
> **Fix**: Add `--all` to skip interactive selection.

### Claude Code

```
/plugin marketplace add TE-9004076594/skills-pool
```

### Cursor

Settings → Rules → Add Rule → Remote Rule (GitHub) and use `TE-9004076594/skills-pool`.

## CodeKB 安装与使用

### 1. 安装 CodeKB CLI（npm 全局安装）

```bash
npm install -g @yun918/codekb
codekb --version    # 验证安装
```

### 2. 初始化项目知识库

```bash
cd your-project
codekb init
```

- 创建 `codekb/codekb.yaml` 配置 + `codekb/knowledge/` 知识库
- 构建向量 + BM25 混合索引
- 自动安装 Git hook（commit 后增量同步）
- 可选：安装 `node-tree-sitter`、`@lancedb/lancedb` 获得 AST 分块和 LanceDB 向量检索（未安装时自动降级）

### 3. 配置 MCP Server（AI 编码工具接入）

`codekb init` 会打印 MCP 配置，添加到你的 AI 编码工具：

```json
{
  "mcpServers": {
    "codekb": {
      "command": "codekb",
      "args": ["mcp"],
      "env": { "CODEKB_PROJECT": "/path/to/your-project" }
    }
  }
}
```

### 4. 日常使用

```bash
# 代码变更后手动同步（Git hook 会自动执行）
codekb sync

# 知识提取（五类：pattern/decision/rule/convention/bug-pattern）
codekb extract --scope src/payment

# OpenSpec archive 阶段知识反哺
codekb extract --from-change <change-name>

# 浏览/审阅知识条目
codekb list --type decision
codekb review decision-001 confirm

# 索引健康状态
codekb status
```

AI 编码时通过 MCP 工具使用：`codekb_search`（混合检索）、`codekb_explain`（符号解释）、`codekb_ask`（RAG 问答）、`codekb_conventions`（编码约定）。

### 5. 安装 codekb 技能（可选，npx skills）

```bash
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/codekb --all
```

### 6. 与 OpenSpec 解耦

CodeKB 是**可选增强层**，与 OpenSpec + CodeGraph 完全解耦：

- **不安装 CodeKB** → `openspec-*` 技能 + CodeGraph 照常工作，无任何 CodeKB 参与
- **安装 CodeKB** → 通过随包附带的 `openspec-codekb-integration` 技能，在 explore/propose/apply/archive/android-bug 各阶段获得语义增强
- OpenSpec 工作流**永不**被 CodeKB 阻塞

## Updating Skills

```bash
# Update all installed skills
npx skills update

# Update global or project-level only
npx skills update -g     # global
npx skills update -p     # project-level only
```

To update CodeGraph index after code changes:

```bash
codegraph sync -q
```

## Repository Structure

```
skills-pool/
├── README.md
├── LICENSE
├── .claude-plugin/           # Root package registry
│   └── marketplace.json
├── .cursor-plugin/           # Root package registry
│   └── marketplace.json
├── ai-coding/                # Package: ai-coding
│   └── README.md
├── codekb/                   # Package: CodeKB 源码语义知识库
│   ├── src/                  #   CLI + MCP Server + 索引/提取/检索
│   ├── skills/               #   7 个技能（6 codekb-* + openspec-codekb-integration）
│   ├── package.json
│   └── README.md
└── ai-coding-hyperscale/     # Package: coming soon
```

## License

MIT
