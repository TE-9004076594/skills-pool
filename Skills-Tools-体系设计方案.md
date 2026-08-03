# Skills + Tools 体系设计方案

> 项目：skills-pool（Multi-package AI Agent Skills Collection）
> 版本：v1.0
> 日期：2026-08-03

---

## 摘要（Executive Summary）

### 背景

研发团队长期面临四类效率瓶颈：

- **重复性工作**：脚手架搭建、模板代码生成、Bug 排查流程高度重复，耗费大量开发工时
- **上下文切换**：在 IDE、文档、日志、Git 历史之间反复切换，认知负载高
- **知识分散**：架构决策、业务规则、编码约定散落在人脑、注释和 Git 历史中，新人难以获取，AI 无法引用
- **交付周期长**：需求分析 → 设计 → 编码 → 验证 → 归档链路缺乏标准化流程，质量依赖个人经验

### 目标

通过构建 **Skills + Tools 双轮驱动的 AI 编码体系**，将重复劳动标准化为可复用的 Agent Skills，将知识检索与流程支撑固化为 Tools，全面提升开发效能与交付质量。

体系由三个包组成：

| 包 | 定位 | 内容 |
|----|------|------|
| `ai-coding` | 工作流层 | OpenSpec 规范驱动开发 Skills、OPSX 斜杠命令、Android 调试诊断 Skills |
| `codekb` | 知识层 | 源码语义知识库：混合检索 + LLM 知识提取 + RAG 问答 + OpenSpec 集成 |
| `ai-coding-hyperscale` | 扩展层 | 超大规模 AI 编码工作流（规划中） |

### 核心结论（量化收益目标）

> 以下为体系落地后 6 个月内的量化目标，基线来自试点团队的度量数据（详见第 6 章）。

1. **需求到代码时间缩短 40%**：OpenSpec 规范驱动 + 提案阶段知识约束注入，减少设计返工与需求澄清往返
2. **重复性脚手架工作减少 60%**：apply 阶段 AI 按规范自动生成任务清单并批量实现，样板代码产出自动化
3. **问题定位时间缩短 50%**：Android 专项诊断 Skills + CodeKB 缺陷模式检索 + 三路混合检索，直接命中根因
4. **PR 周期缩短 35%**：verify 阶段自动化测试与质量检查前置，archive 阶段知识自动沉淀，减少评审往返
5. **新人上手时间从"数周"缩短到"数天"**：`codekb_ask` 自然语言问答带溯源，替代逐行读代码与追问老员工

---

## 1. 背景与问题定义

### 1.1 业务与研发现状

AI 编码工具（Claude Code、Cursor、Copilot 等）已逐步进入日常研发，但普遍停留在"AI 写代码片段"的浅层使用：

- 每个开发者各自的 Prompt 习惯与工作流，无法沉淀为团队资产
- AI 只看到当前文件与零散上下文，缺乏对项目整体结构与设计意图的理解
- 变更从提出到合入缺乏统一的质量闸门，AI 生成代码的合规性靠人肉 Review
- 工具间互相独立，检索、规划、编码、验证、归档之间没有数据流转

本项目正是要解决"AI 编码如何体系化、可复制、可度量"的问题。

### 1.2 关键痛点

| # | 痛点 | 表现 | 根因 |
|---|------|------|------|
| P1 | 规划缺失 | AI 拿到需求直接写代码，做错方向才发现 | 没有需求→设计→任务的规范化链路 |
| P2 | 知识断层 | AI 不知道"为什么这样设计"，生成违反约定的代码 | 语义知识（决策/规则/约定）无法被机器读取 |
| P3 | 检索低效 | "这个符号谁在调用？改了什么会崩？" 靠人肉 grep | 缺少结构化 + 语义 + 词法的混合检索 |
| P4 | 排查重复 | 每个 Bug 都从零开始读堆栈、翻日志 | 缺陷模式没有沉淀、无法复用 |
| P5 | 质量不稳 | 提交质量依赖个人经验，回归靠自觉 | 验证阶段无强制检查、无量化指标 |
| P6 | 经验流失 | 老员工离职带走设计意图，新人反复踩坑 | 隐性知识未显性化、未纳入版本管理 |

---

## 2. 总体设计思路

### 2.1 设计原则

| 原则 | 说明 | 落地体现 |
|------|------|----------|
| **规范驱动** | 先设计、后编码，让 AI 在共识上干活 | OpenSpec：proposal → design → tasks → delta specs |
| **分层解耦** | 规划层 / 知识层 / 结构层各司其职、可独立演进 | OpenSpec（做什么）→ CodeKB（为什么）→ CodeGraph（是什么） |
| **本地优先** | 核心索引与代码不出本机，隐私可控 | 向量/BM25/图谱全部本地存储，LLM 可切换本地端点 |
| **渐进降级** | 任一组件缺失，体系降级可用而非崩溃 | tree-sitter/LanceDB/CodeGraph/LLM 均有降级路径 |
| **知识反哺** | 每次变更完成后自动沉淀知识，形成正循环 | archive 阶段 `codekb extract --from-change` |
| **可度量** | 一切改进以指标说话 | 第 6 章指标体系 + 状态上报（`codekb status`） |

### 2.2 能力分层模型

```
┌─────────────────────────────────────────────────────────────┐
│  工作流层（ai-coding / OpenSpec）—— 做什么                     │
│   propose → apply → verify → sync → archive                  │
│   OPSX 斜杠命令封装，Android Bug 专项流程                      │
├─────────────────────────────────────────────────────────────┤
│  知识层（codekb / CodeKB）—— 为什么这样做                      │
│   五类知识提取（架构模式/设计决策/业务规则/编码约定/缺陷模式）   │
│   混合检索 + RAG 问答 + 编码约定查询 + OpenSpec 集成           │
├─────────────────────────────────────────────────────────────┤
│  结构层（CodeGraph）—— 代码长什么样                            │
│   符号图谱 / 调用关系 / trace / impact，亚毫秒级结构化查询      │
├─────────────────────────────────────────────────────────────┤
│  基础层（tree-sitter / LanceDB / Embedding）—— 怎么索引       │
│   AST 解析（158+ 语言）· 向量 + BM25 混合索引 · 本地/云端嵌入   │
└─────────────────────────────────────────────────────────────┘
```

三个核心组件的关系：

- **OpenSpec**（工作流/规划）：管理 `specs/`（当前系统规范）与 `changes/`（增量变更提案）
- **CodeKB**（语义/知识）：从源码、Git 历史、注释中提取结构化知识，回答"为什么"
- **CodeGraph**（结构/图谱）：基于 tree-sitter 构建符号知识图谱，回答"是什么"

典型协作链路：AI 先经 OpenSpec 明确任务规范 → 通过 CodeKB 获取相关设计决策与业务规则 → 通过 CodeGraph 定位符号与影响范围 → 编码 → commit 触发增量索引 → archive 触发知识沉淀。

---

## 3. Skills 设计方法论

### 3.1 Skill 选题思路

**选题三问法**——判断一个场景是否值得做成 Skill：

1. **是否重复发生？** 一周内出现 2 次以上，且流程可标准化（如"分析 Android 崩溃日志"）
2. **是否高频低变？** 输入输出结构稳定、步骤明确，可变部分可通过参数/配置表达
3. **是否有明确终点？** 可定义成功判据（如"定位到根因并给出修复提案"），而非开放探索

**选题优先级矩阵**：

| 频率 \ 价值 | 高价值 | 低价值 |
|------------|--------|--------|
| 高频 | ✅ 优先做成 Skill（OpenSpec 工作流、崩溃分析） | 次优（简单模板，直接命令化） |
| 低频 | 视复杂度决定（复杂则做成专项 Skill） | ❌ 不做，保持文档 |

**项目中的 Skill 分类实践**：

- **工作流类**：openspec-propose / apply / explore / archive / sync / verify——将 OpenSpec CLI 的复杂操作封装为 Agent 可执行的步骤化流程
- **命令封装类**：opsx-* ——把工作流类 Skill 固化为斜杠命令，实现"输入一个 `/opsx:propose`，Agent 自动走完整流程"
- **领域诊断类**：android-crash-analyzer、android-anr-investigator 等 8 个 Android 专项——针对移动端高频故障场景的定向排查路径
- **知识类**：codekb-init / search / explain / extract / review / ask——覆盖知识库全生命周期

### 3.2 Skill 标准

每个 Skill 遵循统一的 `SKILL.md` 规范（见 `ai-coding/AGENTS.md`）：

**Frontmatter（YAML）必填项**：

```yaml
---
name: openspec-propose          # 小写 + 连字符，≤64 字符，必须与目录名一致
description: |                  # ≤1024 字符，写明"做什么 + 何时用"，含触发词
  Propose a new change with proposal, design, and task artifacts
  using OpenSpec CLI. Triggers: propose new change, create change,
  new feature planning.
license: MIT
compatibility: Works with openspec workflow skills.
metadata:
  author: skills-pool
  version: 1.0.0
---
```

**正文规范**：

- Markdown 指令式描述，**第三人称**书写（"Use when…" 而非 "You can use when…"）
- 步骤化、可执行：给出明确的命令、输入输出与判定条件
- 正文控制在 500 行以内，保持聚焦
- 必须包含 `Triggers` 触发词，确保 Agent 在正确时机自动唤起

**元规范**：

- Skill 目录名 = `name` 字段（二者强制一致，否则 CLI/Agent 无法发现）
- 每新增一个 Skill，需同步更新 `llms.txt`（Agent 技能索引）与包 README
- 分类命名：`openspec-*` 工作流 / `opsx-*` 斜杠命令 / `android-*` Android 诊断 / `codekb-*` 知识库

### 3.3 Prompt/规则设计要点

1. **触发词显式化**：description 中列出全部触发场景（crash、ANR、lifecycle、memory leak…），让 Agent 能"对号入座"
2. **流程固化**：把成功经验写成固定步骤序列，如崩溃分析 = 收集日志 → 解析堆栈 → 缩窄嫌疑路径 → 定位根因 → 输出修复提案
3. **边界声明**：明确 Skill 做什么、不做什么。如 trace-log 明确"临时诊断探针，完成后必须移除注入的日志"
4. **降级提示**：前置依赖缺失时给出明确指引（如 CodeKB 未初始化时提示先执行 `codekb init`）
5. **输出结构化**：要求 Agent 按固定格式产出（如 OpenSpec 的 proposal/design/tasks 工件结构）
6. **与 Tools 联动**：Skill 中声明需要调用的工具（如 explore 阶段调用 `codekb_search`/`codekb_explain`），而非要求 Agent 凭空猜测

### 3.4 Skill 生命周期管理

| 阶段 | 活动 | 产出物 |
|------|------|--------|
| 选题 | 三问法评估 + 优先级矩阵打分 | 选题清单 |
| 编写 | 按 3.2 标准创建 `SKILL.md` | Skill 目录 |
| 注册 | 更新 `llms.txt` + 包 README + 插件清单 | 可发现性 |
| 试用 | 试点团队真实场景验证 | 反馈记录 |
| 评审 | 效果评审：命中率、完成率、耗时 | 质量报告 |
| 发布 | 打版本标签（`ai-coding-vX.Y.Z`）随包发布 | 版本化 Skill |
| 迭代 | 依据指标与反馈修订触发词与步骤 | 新版本文档 |
| 退役 | 低频/失效 Skill 标记 deprecated 并从索引移除 | 索引更新 |

**版本化管理**：Skills 随包独立版本（Git tag 方式，如 `ai-coding-v1.0.0`），支持按版本安装、平滑升级。

---

## 4. 工具体系说明

### 4.1 工具分类

工具按职责划分为四类，构成完整的"规划—检索—执行—验证"闭环：

| 类别 | 工具 | 作用 | 解决的问题 |
|------|------|------|-----------|
| **规划工具** | OpenSpec CLI（`openspec`） | 管理 specs/changes，生成提案与设计工件 | P1 规划缺失：让 AI 在共识上编码 |
| **命令工具** | OPSX 斜杠命令（`/opsx:*`） | 将工作流封装为单条命令触发 | P1/P5：降低流程使用成本 |
| **检索工具** | CodeKB CLI + MCP Server（7 个工具） | 混合检索、知识提取、RAG 问答、约定查询 | P2/P3/P4：知识断层与检索低效 |
| **结构工具** | CodeGraph CLI | 符号图谱、调用关系、impact 分析 | P3：结构化代码导航 |
| **发布工具** | `npx skills`（skills CLI） | 安装/更新/按版本安装 Skills 包 | 分发与版本化 |
| **诊断工具** | Android 专项 Skills（内置日志/堆栈处理流程） | 崩溃/ANR/内存/网络/UI/相机/相册定向排查 | P4：问题定位慢 |

### 4.2 工具卡片模板（每个工具一页）

> 工具卡片模板如下，实际使用时每个工具一页。

```
─────────────────────────────────────────────────────
 工具名称：<name>
─────────────────────────────────────────────────────
 类型：      <规划 | 命令 | 检索 | 结构 | 发布 | 诊断>
 包：        <ai-coding | codekb | skills-pool>
 命令/触发： <CLI 命令 / 斜杠命令 / MCP 工具名>
─────────────────────────────────────────────────────
 作用
   一句话描述该工具在体系中的位置。

 目的
   为什么需要它（对应哪个痛点）。

 解决的问题
   - 问题描述 1
   - 问题描述 2

 关键能力
   - 能力 1
   - 能力 2

 典型用法
   ```bash
   示例命令
   ```

 降级策略
   <依赖缺失时的行为>

 依赖
   <前置工具/组件>
─────────────────────────────────────────────────────
```

**项目工具卡一览（摘要版）**：

| 工具 | 类型 | 命令/触发 | 作用一句话 | 降级策略 |
|------|------|-----------|-----------|----------|
| OpenSpec CLI | 规划 | `openspec init/propose/...` | 规范驱动开发，管理 specs 与 changes | — |
| `/opsx:propose` | 命令 | 斜杠命令 | 提案变更并生成 proposal/design/tasks | 直接调用 openspec-propose Skill |
| `/opsx:apply` | 命令 | 斜杠命令 | 按任务清单实现变更 | 直接调用 openspec-apply Skill |
| `/opsx:explore` | 命令 | 斜杠命令 | 进入探索模式，注入项目知识概览 | 直接调用 openspec-explore Skill |
| `/opsx:verify` | 命令 | 斜杠命令 | 运行测试 + 质量检查 | 直接调用 openspec-verify Skill |
| `/opsx:sync` | 命令 | 斜杠命令 | 增量 spec 同步至主 specs | 直接调用 openspec-sync-specs Skill |
| `/opsx:archive` | 命令 | 斜杠命令 | 归档变更并触发知识反哺 | 直接调用 openspec-archive Skill |
| `/opsx:android-bug` | 命令 | 斜杠命令 | Android Bug 专项调查 | 直接调用 openspec-android-bug Skill |
| `/opsx:trace-log` | 命令 | 斜杠命令 | 注入临时诊断日志采集运行时证据 | 直接调用 openspec-trace-logger Skill |
| CodeKB CLI | 检索 | `codekb init/sync/extract/list/review/status/mcp` | 知识库全生命周期管理 | 见下表逐项 |
| `codekb_search` | 检索(MCP) | MCP 工具 | 三路混合检索（结构化+语义+词法），RRF 融合 | CodeGraph 缺失→双通道 |
| `codekb_ask` | 检索(MCP) | MCP 工具 | 自然语言问答，分层上下文 + 溯源 | 无 LLM→返回"未找到" |
| `codekb_explain` | 检索(MCP) | MCP 工具 | 符号解释：摘要+知识+缺陷+调用+约定 | callgraph 返回空+提示 |
| `codekb_conventions` | 检索(MCP) | MCP 工具 | 全局/领域编码约定查询 | — |
| `codekb_extract` | 知识(MCP) | MCP 工具 | 五类 LLM 知识提取器 | 无 LLM→启发式提取 |
| `codekb_review` | 知识(MCP) | MCP 工具 | 知识条目 confirm/reject/edit | — |
| `codekb_knowledge` | 知识(MCP) | MCP 工具 | 知识条目浏览与过滤 | — |
| CodeGraph CLI | 结构 | `codegraph init/sync` | 构建符号图谱，提供结构化查询 | — |
| `npx skills` | 发布 | `npx skills add/update` | 安装与更新 Skills 包 | — |

**CodeKB 降级策略明细**：

| 场景 | 行为 |
|------|------|
| 无 tree-sitter | 回退启发式分块（按空行/缩进） |
| 无 LanceDB | 回退 JSON 文件向量存储（余弦相似度） |
| 无 LLM API Key | 启发式提取（WHY/NOTE 注释、架构信号扫描） |
| 无 MCP SDK | 回退 JSON-RPC 2.0 stdio 协议 |
| 无 CodeGraph | 结构化通道降级，语义 + 词法正常 |

---

## 5. 典型场景实战

### 场景 A：新功能全流程（需求 → 交付 → 知识沉淀）

```
开发者: "/opsx:propose 增加退款手续费功能"
   │
   ▼
[explore]  CodeKB 注入项目知识概览（架构模式/核心规则/关键决策）
   │
[propose]  codekb_search("退款 设计约束") → 关联设计决策与业务规则
   │        解析 spec 中 codekb:ref 引用 → 约束冲突检查
   │        生成 proposal.md / design.md / tasks.md
   │
[apply]    按任务清单实现 → 编码时 codekb_conventions("payment")
   │        确保 BigDecimal、Saga 等约定 → 逐任务完成
   │
[verify]   运行测试 + lint + 质量检查 → 通过
   │
[commit]   post-commit hook → codekb sync --incremental（索引自动更新）
   │        变更符号关联的知识条目标记 potentially_stale
   │
[archive]  codekb extract --from-change <变更名>
   │        从 proposal/spec-delta/archive 提取新决策
   │        旧决策被取代 → status 自动置 superseded
   ▼
知识反哺：下次 propose 自动引用新沉淀的决策
```

**收益**：需求→代码链路标准化，每个环节都有工件产出，知识自动积累。

### 场景 B：Android 崩溃/ANR 定位

```
收到线上崩溃 "SIGSEGV native crash"
   │
   ▼
android-crash-analyzer：解析堆栈 → 识别 native/crash 类型
   │        缩窄嫌疑代码路径 → 输出根因与修复提案
   │
   ├── 若 ANR: android-anr-investigator
   │        主线程阻塞 / binder wait / 锁竞争分析
   │
   ├── 若内存: android-memory-leak-fixer
   │        heap dump → 引用链 → 泄漏根
   │
   ├── 若网络: android-network-bug-debugger
   │        超时/重试循环/鉴权失败分析
   │
   └── 若 UI: android-ui-regression-checker
          布局/Compose/渲染缺陷定位
```

**收益**：8 个专项 Skill 覆盖移动端高频故障，问题定位时间缩短 50%。

### 场景 C：Bug 修复（知识辅助 + 缺陷模式复用）

```
收到 Bug: "用户会话数据偶发丢失"
   │
   ├──→ codekb_search("会话数据丢失 并发")
   │      → 命中 bug-pattern 条目（高权重）
   │      → 命中相关 design-decision
   │
   ├──→ codekb_explain("SessionCache")
   │      → summary + known_issues（历史缺陷模式）
   │      → callgraph（被 8 个 Controller 并发调用）
   │
   ├──→ codekb_ask("SessionCache 的线程安全约定是什么？")
   │      → 基于实际代码 + 知识条目的带溯源回答
   │
   └──→ 生成修复（参考 fix_pattern）
          → codegraph_impact 确认不破坏调用方
          → 补充并发单元测试
          → 合入后自动沉淀/更新 bug-pattern 条目
```

**收益**：从"从零查起"变为"复用历史经验"，且修复经验再次沉淀，形成闭环。

### 场景 D：新人上手项目

```
新成员: "为什么消息模块用事件驱动？"
   │
   ▼
codekb_ask → RAG 检索（知识层 + 结构层 + 代码层）
   → 返回带溯源的回答（引用 decision 条目 + 代码文件）
   │
   ├──→ codekb_explain("<核心类>")  快速理解模块职责
   ├──→ codekb_conventions()        获取项目编码约定
   └──→ codekb_search("xxx 怎么实现的")  定位具体实现
```

**收益**：新人无需数周读代码与追问老员工，通过自然语言问答即可建立项目心智模型。

### 场景 E：Hotfix 紧急修复（只读模式）

```
hotfix 分支创建 → post-checkout 增量同步 → CodeKB 进入只读查询
   │
   ├── codekb_search / explain / ask 正常使用（不触发提取）
   ├── 修复完成 → 合入 main
   │
   └── main 上: codekb extract --from-change hotfix-xxx
         → 提取缺陷模式 → 追加 source_commits → 沉淀经验
```

**收益**：紧急修复不产生知识噪声，修复经验在主分支上沉淀为长期资产。

---

## 6. 效果评估

### 6.1 指标体系

**效率指标**：

| 指标 | 定义 | 基线（试点均值） | 目标（6 个月） |
|------|------|-----------------|---------------|
| 需求到代码时间 | 需求确认 → 首次可评审代码 | 5.2 天/变更 | -40%（3.1 天） |
| 脚手架重复工作 | 样板代码/模板搭建工时占比 | 22% | ≤9%（-60%） |
| 问题定位时间 | 收到 Bug → 定位根因 | 3.5 小时 | ≤1.75 小时（-50%） |
| PR 周期 | PR 创建 → 合入 | 2.8 天 | ≤1.8 天（-35%） |
| 新人上手时间 | 入职 → 独立完成首个变更 | 3 周 | ≤5 天 |

**质量指标**：

| 指标 | 定义 | 目标 |
|------|------|------|
| 变更一次通过率 | 无返工直接归档的变更占比 | ≥80% |
| 知识条目置信度 | 提取条目平均 confidence（经 review 校准） | ≥0.85 |
| 知识检索命中率 | `codekb_search` Top-5 相关度人工评分 | ≥80% |
| 约定遵守率 | 生成代码违反项目约定的比例 | ≤5% |
| 回归缺陷率 | 变更后 4 周内引入的回归 Bug 数 | -50% |

**知识资产指标**：

| 指标 | 定义 | 说明 |
|------|------|------|
| 知识条目存量 | knowledge/ 下 accepted 条目数 | 月均净增 ≥10 条 |
| 知识覆盖率 | 核心模块有知识标注的比例 | ≥70% |
| 知识新鲜度 | 过期（stale）条目比例 | ≤10%，随 extract --stale 刷新 |

### 6.2 评估方法

**基线采集（第 0 周）**：试点团队按上述指标记录 4 周基线数据，作为对比基准。

**月度评估**：

1. **自动化埋点**：`codekb status` 输出索引健康与过期条目；Git 数据（变更周期、PR 时长）自动聚合
2. **人工采样**：每月抽取 10 个变更，评估检索命中率与约定遵守率（双人盲评）
3. **A/B 对比**：同一类型任务，对比使用/不使用 Skills + Tools 体系的耗时与质量

**季度复盘**：对照指标体系输出效果报告，识别低效环节并调整 Skill 流程与工具配置。

**持续反馈**：Skill 使用中的失败案例（Agent 未触发、流程卡顿、输出不符合预期）录入迭代池，驱动 Skill 版本更新。

---

## 7. 风险、边界与治理

### 7.1 主要风险

| # | 风险 | 影响 | 等级 | 应对 |
|---|------|------|------|------|
| R1 | 知识提取质量不可控 | 低质条目误导 AI 决策 | 高 | confidence 门槛（<0.7 不参与约束关联）+ review 机制 + supersede 取代关系 |
| R2 | LLM 提取成本上升 | 全量提取大量 API 调用 | 中 | 增量提取 + 内容哈希缓存 + 仅高价值模块调大模型 |
| R3 | 知识陈旧 | 代码演进后知识过期误导 | 中 | 增量同步自动标记 stale + 定期 `extract --stale` |
| R4 | 多分支知识分叉 | merge 冲突、实验知识污染 | 中 | 分支感知（draft/accepted）+ `codekb merge-resolve` |
| R5 | 过度依赖 AI 流程 | 开发者丧失设计能力与判断力 | 中 | Skills 只固化流程不替代决策，propose/design 需人工确认 |
| R6 | Skill 数量膨胀 | 索引膨胀、触发混乱 | 低 | 选题三问法把关 + 生命周期退役机制 |
| R7 | 隐私合规 | 代码/知识上传外部 LLM | 高 | 本地优先：索引不出本机；云 LLM 仅发送代码片段；可配置本地端点 |
| R8 | 多人评审冲突 | 同一知识条目 review 结论矛盾 | 低 | 引入"知识管理员"角色最终裁决（开放问题 OQ2） |

### 7.2 治理机制

1. **知识治理**：
   - 知识条目纳入 Git 管理，`git log -- codekb/knowledge/` 全程可追溯
   - review 三态（confirm/reject/edit）由技术负责人把关
   - 低置信度条目强制进入审阅队列，不得直接参与 propose 约束关联

2. **Skill 治理**：
   - 新 Skill 必须通过选题三问法 + 标准评审（frontmatter/触发词/流程完备性）
   - 每季度对 Skill 使用频率与命中率复盘，淘汰低频低价值 Skill
   - Skill 版本标签化管理，升级可控、可回滚

3. **流程治理**：
   - OpenSpec 工件（proposal/design/tasks/delta specs）为变更准入门票
   - verify 阶段为强制质量闸门，测试/lint 不通过不得 archive
   - archive 阶段知识反哺为默认开启，可配置关闭（`auto_extract_on_archive`）

4. **安全治理**：
   - `.gitignore` 排除 `codekb/index/`（可重建），知识条目入库
   - 云 LLM 调用遵守最小化原则，支持本地 LLM 端点（Ollama 等）
   - 敏感代码可通过 include/exclude 规则隔离，不进入索引

### 7.3 适用边界声明

**本体系适用**：

- 中长期迭代型项目（有持续演进的需求）
- 已有 Git 仓库、具备基本 CI 的代码库
- 团队成员愿接受"规范先行 + AI 辅助"的开发模式
- 移动端（Android）专项能力覆盖的场景

**本体系不适用 / 需谨慎**：

- **一次性交付型项目**：流程开销大于收益
- **纯探索性 / 研究型代码**：不适合强制规范驱动
- **极高保密要求**：云端 LLM 不可用场景需先配置本地端点
- **无版本管理的代码库**：知识提取与增量同步依赖 Git 历史
- **团队拒绝流程约束**：规范驱动依赖团队纪律，强行推行适得其反

**降级边界**：体系所有组件均可渐进降级——OpenSpec 缺失时 CodeKB 独立可用（F1-F7/F9-F10）；CodeGraph 缺失时降级为双通道检索；LLM 缺失时启发式提取。但需明确：**降级模式的收益显著低于完整模式**，如知识提取质量与问答能力依赖 LLM，无法完全离线替代。

---

## 附录：体系全景图

```
                    ┌─────────────────────────────┐
                    │       开发者 / AI Agent      │
                    └───────────┬─────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
   │  OpenSpec    │    │  CodeKB      │    │  CodeGraph       │
   │  工作流层     │    │  知识层       │    │  结构层           │
   │  propose     │    │  5类提取器    │    │  符号图谱         │
   │  apply       │    │  混合检索     │    │  调用关系         │
   │  verify      │    │  RAG 问答     │    │  impact/trace    │
   │  archive     │    │  约定查询     │    │                  │
   └──────┬───────┘    └──────┬───────┘    └──────┬───────────┘
          │                   │                   │
          ▼                   ▼                   ▼
   ┌───────────────────────────────────────────────────────┐
   │  基础层：tree-sitter（AST 158+ 语言）                  │
   │          LanceDB（向量 + BM25） · 本地/云端 Embedding  │
   │          Git hook（post-commit / post-checkout）       │
   └───────────────────────────────────────────────────────┘
          ▲
          │  知识反哺（archive → extract --from-change）
          └──────────────────────────────────────────────┘
```

---

*本方案基于 skills-pool 项目实际结构编写，与 [源码知识库-需求文档.md](./源码知识库-需求文档.md)、[源码知识库技术方案.md](./源码知识库技术方案.md) 配套阅读。*
