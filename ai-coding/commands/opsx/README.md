---
description: 
---
# OPSX 命令参考手册

## 概述

OPSX 是一套基于 OpenSpec 的变更管理工作流，覆盖从**探索 → 提案 → 实施 → 验证 → 同步 → 归档**的完整生命周期。每个阶段对应一个 `/opsx:*` 命令。

所有命令中**自动集成了 CodeGraph** 进行代码库语义探索，无需手动调用 `codegraph explore`。

---

## 文件结构与映射关系

```
.qoder/
│
├── commands/opsx/                         ← 可执行命令（用户通过 /opsx:xxx 触发）
│   │
│   ├── explore.md                         · 进入探索/思考模式
│   │   │                                   无固定步骤，可自由讨论想法、分析问题、
│   │   │                                   比较方案。与 openspec-explore skill 联动。
│   │   │
│   ├── propose.md                         · 创建新 change，一次性生成所有 artifacts
│   │   │                                   (proposal.md + design.md + tasks.md)
│   │   │                                   自动运行 codegraph explore 获取代码上下文。
│   │   │
│   ├── android-bug.md                     · 等同于 propose，专用于 Android bug 调试
│   │   │                                   新增 Bug Triage、分类检查清单、
│   │   │                                   8 类专用调试技能路由。委派至
│   │   │                                   `openspec-android-bug` skill。
│   │   │
│   ├── trace-log.md                       · 在可疑代码调用链上插桩结构化 trace 日志
│   │   │                                   CodeGraph 发现调用链 → 按约定插桩
│   │   │                                   → 提供日志采集命令 + 诊断分析 → 清理日志。
│   │   │                                   可独立使用，也可嵌入 android-bug 流程。
│   │   │
│   ├── apply.md                           · 实施 change 中的任务
│   │   │                                   从 tasks.md 逐条执行，完成后自动
│   │   │                                   codegraph sync -q 更新索引。
│   │   │
│   ├── verify.md                          · 验证实施后的代码质量
│   │   │                                   按序执行格式检查 → clippy → 测试 →
│   │   │                                   参数注释检查。无独立 skill，步骤直接定义。
│   │   │
│   ├── sync.md                            · 将 delta specs 同步到 main specs
│   │   │                                   智能合并 ADDED/MODIFIED/REMOVED/RENAMED。
│   │   │
│   ├── archive.md                         · 归档已完成的 change
│   │   │                                   检查完整性 → CodeGraph 快照 →
│   │   │                                   移动目录 → 输出归档摘要。
│   │   │
│   └── README.md                          · 本文档
│
└── skills/                                ← 技能文件（被命令或 Skill tool 引用）
    │
    ├── openspec-explore/SKILL.md          · 探索模式技能实现
    │                                       被 /opsx:explore 命令引用。定义 stance、
    │                                       CodeGraph 集成方式、处理不同入口点。
    │
    ├── openspec-propose/SKILL.md          · 提案技能实现
    │                                       被 /opsx:propose 命令引用。定义 artifact
    │                                       创建流程、CodeGraph 上下文、输出格式。
    │
    ├── openspec-apply/SKILL.md     · 实施技能实现
    │                                       被 /opsx:apply 命令引用。定义任务循环、
    │                                       CodeGraph 探索时机、暂停/恢复规则。
    │
    ├── openspec-archive/SKILL.md   · 归档技能实现
    │                                       被 /opsx:archive 命令引用。定义完整性检查、
    │                                       spec 同步评估、归档操作。
    │
    └── openspec-sync-specs/SKILL.md       · 同步技能实现
                                            被 /opsx:sync 命令引用。定义 delta spec
                                             解析、智能合并逻辑、输出格式。

    └── openspec-trace-logger/SKILL.md     · 调用链 trace 日志技能实现
                                            被 /opsx:trace-log 命令引用。定义
                                            CodeGraph 调用链发现、插桩约定、
                                            日志采集命令、runtime 诊断分析、清理流程。

    ├── openspec-android-bug/SKILL.md      · Android bug triage + 分类路由技能
    │                                       被 /opsx:android-bug 命令引用。将 bug
    │                                       分类到 8 大类并加载对应的专项 skill。
    │
    └── android-* 专项知识文档(平面 .md)   · 被 openspec-android-bug 通过 Skill tool
        │                                   加载后驱动深度分析。每个都包含:
        │                                   目的/目标/工作流/Heuristics/
        │                                   Anti-Patterns/CodeGraph/Guardrails
        │
        ├── android-crash-analyzer.md      · Crash 分析
        ├── android-anr-investigator.md    · ANR 调查
        ├── android-lifecycle-debugger.md  · 生命周期/状态 调试
        ├── android-memory-leak-fixer.md   · 内存泄漏 / OOM
        ├── android-network-bug-debugger.md· 网络/数据流 调试
        ├── android-ui-regression-checker.md· UI / 渲染回归
        ├── android-gallery-bugfix-skill.md· Gallery / MediaStore / 图片相关
        └── android-camera-bugfix-skill.md · 相机 / Camera2 / CameraX 相关
```

---

## 命令速查表

| 命令 | 阶段 | 核心产出 | 前置依赖 |
|------|------|----------|----------|
| `/opsx:explore` | 探索 | 思维导图、决策记录、问题分析 | 无 |
| `/opsx:propose` | 提案 | proposal.md + design.md + tasks.md | 无 |
| `/opsx:android-bug` | 提案(Android) | 同上 + Bug Triage + 分类检查清单 | 无 |
| `/opsx:trace-log` | 调试(运行时) | 调用链可视化 + 结构化 trace 日志 + 诊断报告 | 可疑调用链或 bug 描述 |
| `/opsx:apply` | 实施 | 代码改动 + tasks.md 勾选 | propose 完成 |
| `/opsx:verify` | 验证 | 验证报告（格式/lint/测试） | apply 完成 |
| `/opsx:sync` | 同步 | 主 specs 更新 | 有 delta specs |
| `/opsx:archive` | 归档 | 归档目录 + 摘要 | 实施完成 |

---

## 命令详解

### `/opsx:explore`

**用途**：进入探索模式，是思维伙伴而非工作流脚本。

**特点**：
- 自由的思考模式，无固定步骤
- 自动运行 `openspec list --json` + `codegraph explore "<topic>"` 获取上下文
- 可绘制 ASCII 图表辅助思考
- 可引用已有 change 的 artifacts 进行讨论

**何时使用**：
- 有新想法需要讨论
- 遇到复杂问题需要分析
- 比较不同技术方案
- 实施过程中遇到困难需要探索替代方案

**关键规则**：探索模式只思考、不实现。不可以写应用代码。

---

### `/opsx:propose`

**用途**：创建新 change，一次性生成所有 artifacts。

**流程**：

1. **收集需求** — 如未提供输入，询问用户
2. **读取现有 spec 基线** — `openspec list --json` 检查是否有重叠/冲突的 active change；读取 `openspec/specs/` 判断是新增/修改/删除能力，记录 ADDED/MODIFIED/REMOVED/RENAMED 意图
3. **需求澄清关卡（强制）** — 向用户确认：变更名、一句话目标、scope 包含/排除项、边界行为契约、目标模块/流程、风险点；用户明确确认后才进入代码探索
4. **CodeGraph 探索** — 提取关键术语，运行 `codegraph explore` 获取代码库上下文
5. **创建 change 目录** — `openspec new change "<name>"`
6. **获取 artifact 构建顺序** — `openspec status --change "<name>" --json`
7. **按序创建 artifacts**（proposal → design → tasks），每步使用 spec 基线 + CodeGraph 上下文

**产出 artifacts**：

| Artifact | 内容 | 目的 |
|----------|------|------|
| `proposal.md` | 做什么 + 为什么 | 定义变更范围和目标 |
| `design.md` | 怎么做 | 技术方案和架构设计 |
| `tasks.md` | 实施步骤清单 | 拆分可执行的任务 |

---

### `/opsx:android-bug`

**用途**：等同于 `/opsx:propose`，但专用于 Android bug 调试。

**额外流程**：

1. **Bug 上下文收集** — 规范化报告（症状、触发条件、频率、设备等）；按需采集日志（`adb logcat` / `adb bugreport` / tombstone / ANR traces），release 崩溃先用 `retrace` + `mapping.txt` 反混淆
2. **Bug Triage** — 按 8 大分类做信号级分类：

   | 分类 | 强信号 | 调试技能 |
   |------|--------|----------|
   | Crash | `FATAL EXCEPTION`, 堆栈 | `android-crash-analyzer` |
   | ANR / Freeze | 应用无响应, 主线程阻塞 | `android-anr-investigator` |
   | Lifecycle / State | 旋转/前后台切换触发 | `android-lifecycle-debugger` |
   | Memory / OOM | LeakCanary, 内存增长 | `android-memory-leak-fixer` |
   | Network | 超时, 响应竞态 | `android-network-bug-debugger` |
   | UI / Rendering | 布局异常, 状态渲染错误 | `android-ui-regression-checker` |
   | Gallery / Media | 相册打不开、图片加载/保存/删除/方向异常、MediaStore 查询、分区存储适配、Glide/Coil/Picasso 错误 | `android-gallery-bugfix-skill` |
   | Camera | 相机打不开、预览黑屏、拍照失败、前后摄切换、闪光灯/对焦、Camera2/CameraX 生命周期、ImageReader | `android-camera-bugfix-skill` |

3. **OpenSpec Contract** — 定义 expected/actual/invariants/constraints
4. **CodeGraph 分析** — 入口点、状态所有者、生命周期所有者、异步边界
5. **创建 artifacts** — 将以上分析融入 proposal/design/tasks

**Android 特有检查清单**：Crash / ANR / Lifecycle / Memory / Network / UI 各有一套专项 checklist。

---

### `/opsx:trace-log`

**用途**：在可疑代码调用链上插桩结构化 trace 日志，用于运行时诊断静态分析无法定位的问题。

**适用场景**：间歇性 bug、依赖时序的回调、错误的线程执行、跨生命周期的异步调用、异常的状态变迁 —— 凡是"静态分析看不清、必须观察运行时"的情况。

**流程**：

1. **接收插桩目标** — 入口点类名/方法名，或 bug 流程描述，或可疑调用链猜想
2. **CodeGraph 发现调用链** — `codegraph explore` 找出上下游调用、异步边界、生命周期挂钩
3. **可视化调用链** — 用 ASCII 图展示给用户确认 scope
4. **检测日志框架** — Timber / `Log.d` / 项目自有 logger，决定 TAG 前缀
5. **定义 trace 约定** — 统一的 TAG、entry/exit/state/exception/lifecycle 5 类日志、timing
6. **插桩代码** — 在每个函数添加 `// @TRACE-<name>` 注释 + 结构化日志，保证原行为不变
7. **提供采集命令** — 给出一键 `adb logcat | grep` 过滤命令和复现实操步骤
8. **分析日志输出** — 检查序列/时序/线程/状态/生命周期/异常，输出诊断报告
9. **清理日志** — 通过 `rg` 找出所有 `@TRACE-` 标记并机械化还原，再跑 `assembleDebug` 确认编译

**与 android-bug 的协作**：在 `/opsx:android-bug` 流程中，当 OpenSpec contract 的 Actual Behavior 不确定时，嵌入 `/opsx:trace-log` 获取运行时证据。

**关键规则**：
- 日志只读，不改变控制流
- 不记录 PII（token/密码/邮箱需脱敏）
- 插桩前建议 `git stash -u` 或建临时分支作安全网
- 诊断结束后必须完全清理，禁止遗留到生产代码

---

### `/opsx:apply`

**用途**：实施 change 中的任务。

**流程**：

1. **选择 change** — 指定名称或列表选择
2. **检查状态** — `openspec status --json` 了解 schema 和进度
3. **获取指令** — `openspec instructions apply --json` 获取 context files 和任务列表
4. **读取上下文** — 读取 proposal/specs/design/tasks 等文件
5. **CodeGraph 探索** — 实施前用 `codegraph explore` 了解影响范围
6. **循环实施** — 逐个完成任务，勾选 tasks.md
7. **同步 CodeGraph 索引** — `codegraph sync -q` 确保后续命令看到最新代码

**关键规则**：
- 任务模糊时先问用户，不要猜测
- 实施中发现设计问题，建议更新 artifacts
- 出错时暂停等待指导

---

### `/opsx:verify`

**用途**：验证实施后的代码质量。

**验证流水线**（按顺序执行，Android/Gradle 项目，使用 `./gradlew`）：

| 步骤 | 检查项 | 命令 | 失败处理 |
|------|--------|------|----------|
| 1 | 静态分析/格式化 | `./gradlew :module:ktlintCheck` / `:detekt` / `:spotlessCheck`（仅运行已配置的） | `ktlintFormat`/`spotlessApply` 自动修复 |
| 2 | Android Lint | `./gradlew :module:lintDebug` | 查看报告路径,修资源/清单/API 问题 |
| 3 | 编译受影响模块 | `./gradlew :module:assembleDebug` | 修编译错误,失败则停止 |
| 4 | 受影响模块单元测试 | `./gradlew :module:testDebugUnitTest` | 分析失败原因 |
| 5 | 全量检查(可选) | `./gradlew testDebugUnitTest lintDebug` | 询问用户后运行 |

**分步停止机制**：编译失败则不跑测试。每一步结果清晰展示 ✅/❌/⏭️。仅运行项目中实际存在的质量任务,缺失的标记为 N/A。Instrumented 测试（`connectedDebugAndroidTest`）需真机/模拟器,默认不在范围内,仅作为手动跟进建议。

**CodeGraph 角色**：在验证前自动同步索引 + 将结果映射到受影响的 Gradle 模块（`:module:submodule`）。

---

### `/opsx:sync`

**用途**：将 delta specs 同步到 main specs。

**流程**：

1. **选择 change** — 列出有 delta specs 的 changes
2. **CodeGraph 探索** — 了解被修改 capability 的代码上下文
3. **查找 delta specs** — 从 `artifactPaths.specs.existingOutputPaths` 获取
4. **智能合并** — 逐条处理 ADDED/MODIFIED/REMOVED/RENAMED 需求

**Delta Spec 格式**：

```markdown
## ADDED Requirements
### Requirement: New Feature
The system SHALL do something new.

## MODIFIED Requirements
### Requirement: Existing Feature
#### Scenario: New scenario to add
- **WHEN** user does A
- **THEN** system does B

## REMOVED Requirements
### Requirement: Deprecated Feature

## RENAMED Requirements
- FROM: `### Requirement: Old Name`
- TO: `### Requirement: New Name`
```

**关键原则**：增量合并而非全量替换。只需在 MODIFIED 中包含变更的部分。

---

### `/opsx:archive`

**用途**：归档已完成的 change。

**流程**：

1. **选择 change** — 列出未归档的 active changes
2. **检查 artifacts** — 确认哪些已完成，警告未完成的
3. **检查 tasks** — 统计未完成的任务
4. **评估 delta spec 同步状态** — 比较 delta specs 和 main specs
5. **CodeGraph 快照** — `codegraph explore` 捕获受影响代码快照
6. **执行归档** — `mv <changeRoot> archive/YYYY-MM-DD-<name>`
7. **展示摘要** — 包含 CodeGraph 影响的代码区域

**输出示例**：

```
## Archive Complete
**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs
**Affected CodeArea:** <key files/modules from CodeGraph>
```

---

## CodeGraph 集成

### 在各命令中的角色

| 命令 | CodeGraph 用途 | 时机 |
|------|----------------|------|
| `explore` | 语义探索，获取符号和调用路径 | 话题出现时自动触发 |
| `propose` | 了解相关代码结构，指导 artifact 创建 | 创建 artifacts 前 |
| `android-bug` | 分析 bug 代码路径和影响范围 | triage 后、创建 artifacts 前 |
| `trace-log` | 发现入口点的上下游调用链、异步边界、生命周期挂钩 | 用户确认 scope 前 |
| `apply` | 识别影响范围，指导实施 | 实施前 + 任务模糊时 |
| `verify` | 识别受影响包，确定验证范围 | 同步索引后 |
| `sync` | 了解 capabilitiy 代码上下文 | 合并 specs 前 |
| `archive` | 捕获最终代码快照 | 归档前 |

### 在各专项 debug skill 中的角色

8 个专项 debug skill（crash / anr / lifecycle / memory / network / ui / gallery / camera）的 `## CodeGraph Integration` 章节各自定义了对应 bug 类别的探索维度和分析重点。当 `/opsx:android-bug` 通过 Skill tool 加载某个专项 skill 后，按该 skill 的章节指导运行 `codegraph explore`：

- **Crash** — 调用者线程/生命周期、异步边界、动态派发、下游影响
- **ANR** — 主线程阻塞来源、调用图深度、锁竞争、后台迁移影响
- **Lifecycle** — owner/observer 关系、异步 scope、恢复路径、ViewModel 共享
- **Memory** — 强引用持有者、listener 配对、scope/Job 生命周期、缓存边界
- **Network** — API 调用者、重试策略、auth refresh、响应路径竞态
- **UI** — 状态源更新者、recomposition 触发、主题/RTL 消费者
- **Gallery** — MediaStore 查询调用链、Uri 消费链、加载库生命周期、保存/删除路径、适配器绑定
- **Camera** — openCamera 调用者、session/Surface 生命周期、ImageReader 缓冲、切换顺序、设备 HAL 差异

统一 fallback：`codegraph explore` 无结果时 proceed without it，回退到 `rg`/grep 查找调用点。

### 索引同步机制

CodeGraph 使用预索引机制，`codegraph explore` 查询的是已构建的索引数据，而非实时读取文件系统。

| 操作 | 同步命令 | 说明 |
|------|----------|------|
| 代码修改后 | `codegraph sync -q` | `/opsx:apply` 实施完成后自动执行 |
| 验证前 | `codegraph sync -q` | `/opsx:verify` 自动同步确保基于最新代码 |
| 其他命令 | 无需同步 | 只读查询 |

---

## 路径兼容性

所有命令使用**相对路径**，可在不同 AI 工具间适配：

```
./gradlew :app:assembleDebug   # 从项目根目录运行 Gradle wrapper
codegraph sync -q              # 默认当前目录
./gradlew :module:lintDebug    # 模块级校验任务
```

支持的工具：Qoder、Claude Code、Cursor、Windsurf 等。

---

## 通用工作流

```
┌─────────┐    ┌──────────┐    ┌───────┐    ┌────────┐    ┌──────┐    ┌─────────┐
│ Explore │───→│  Propose │───→│ Apply │───→│ Verify │───→│ Sync │───→│ Archive │
│ 思考    │    │ 提案     │    │ 实施   │    │ 验证   │    │ 同步  │    │ 归档    │
└─────────┘    └──────────┘    └───────┘    └────────┘    └──────┘    └─────────┘
     │              │              │             │            │            │
     │              │              │             │            │            │
     └──────────────┴──────────────┴─────────────┴────────────┴────────────┘
                                        │
                                  CodeGraph
                              (自动集成在每个阶段)
```

各阶段可以根据需要跳过或重复。例如：apply 过程中可以重新 explore。
