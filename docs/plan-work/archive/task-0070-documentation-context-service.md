# Task：文档上下文服务与 Luna 阅读负担治理

状态：done — 文档治理、工具化与真实任务试读已完成首轮

## 目标

建立一套面向人类协作者与 Luna 模型的文档上下文服务，使每个施工任务都能从项目入口快速获得最小、正确、可验证的 Read Set，降低全库阅读、历史文档污染和文档事实漂移的风险。

本 Task 不改变 `docs/docs-828/` 的当前事实源地位，也不把文档内容复制成第二套事实源；它只增加导航、上下文预算、任务路由和维护检查能力。

## 设计边界

### 当前事实

- `docs/docs-828/` 是当前机制、架构、数据结构和规范的唯一文档事实入口。
- 源码与测试是最终事实；文档负责索引、解释语义和记录稳定约束。
- `docs/plan-work/` 已整体冻结为历史考古层；`archive/` 中的 ADR、Roadmap、Task 和草案默认不进入施工上下文。
- `docs/ai/` 负责 AI 施工协议和模板，从属于 `AGENTS.md`。
- `docs/newPlan/` 是旧位置，禁止继续写入。

### 本 Task 允许做的事

- 新增当前架构上下文卡和任务类型 Read Set 路由。
- 新增或调整 Patch Unit / Execution Receipt 模板中的上下文预算字段。
- 为高频领域建立只提供链接和读取边界的上下文包。
- 为核心文档增加轻量读取元信息。
- 加强 `check:docs` 可机械验证的文档治理规则。
- 整理 `docs/newPlan/` 中的遗留文档，但必须保留历史语义并完成链接检查。

### 明确不做

- 不重写 `docs/docs-828/` 的机制正文。
- 不把历史 ADR、Roadmap 或 Task 改写成当前事实。
- 不把 `docs/abstract.md` 升格为技术事实源。
- 不建立与 `docs/docs-828/` 平行的第二套架构百科。
- 不自动扫描全仓库并把所有搜索结果塞入模型上下文。
- 不在本 Task 内修改游戏机制、UI、Schema 或运行时代码。
- 不把 256k 上下文当成默认阅读配额。

## 预期结构

```text
AGENTS.md
  → docs/docs-828/00-INDEX.md
  → 当前架构上下文卡
  → 任务类型 Read Set 路由
  → 领域上下文包
  → 源码与测试
```

历史资料只在以下情况按需进入上下文：追溯设计理由、解释当前事实与历史裁定的差异、恢复未决方向，或核验某项设计是否已经落地。

## 施工切片

### P0：最小可用上下文服务

#### DOC-001：建立文档权威层级表

交付：在当前入口中明确源码、`docs/docs-828/`、`docs/ai/`、`docs/plan-work/`、`docs/abstract.md` 的权威顺序和使用方式。

完成定义：协作者无需依赖个人经验即可判断一篇文档是当前事实、施工协议、玩法摘要还是历史来源。

#### DOC-002：编写当前架构上下文卡

建议文件：`docs/docs-828/01-architecture/current-context-card.md`。

内容：主调用链、三层状态、Datapack 数据流、StateMutationService、Effect / Trigger / Affector、UI 只读边界、常见修改入口和关键禁区。

完成定义：正文控制在约 3k–6k token，详细说明全部链接到已有权威文档。

#### DOC-003：建立任务类型与 Read Set 路由表

至少覆盖：引擎机制、PlayerState、实体字段 / 枚举、UI、主题色彩、Schema、测试和文档维护。

每类任务必须列出：必读文档、可选文档、默认不读目录、源码入口和最小验证命令。

#### DOC-004：更新 Patch Unit 模板

在 `docs/ai/templates/patch-unit.md` 中加入：Context Budget、Required Read Set、Optional Read Set、Do Not Read、历史资料访问条件和超预算拆分规则。

建议默认预算：普通 Unit 8k–30k token；跨模块 Unit 25k–60k token；超过 60k token 时必须拆分或升级调查范围。

### P1：领域上下文包与漂移治理

#### DOC-005～DOC-009：建立领域上下文包

优先建立以下五个上下文包：

1. 生产 / GameNum / Affector / Tick；
2. 角色 / 抽卡 / 培养 / 通讯录；
3. UI / 主题 / 表现层；
4. Datapack / Registry / Schema；
5. Init / 世界线 / 存档 / 生命周期。

上下文包只提供任务入口、Read Set、源码入口、验证命令和默认排除项，不复制机制正文。

#### DOC-010：增加轻量读取元信息

为架构文档、模块卡片和机制正文逐步增加以下可选元信息：

```yaml
scope: current-fact
authority: semantic-explanation
read_when:
  - 修改 PlayerState
avoid_when:
  - 只改 UI 样式
related_modules:
  - state-mutation
```

完成定义：元信息只辅助路由，不重复正文，也不改变现有文档的权威关系。

#### DOC-011：固定历史层访问规则

统一规定 `docs/plan-work/archive/**` 默认不读，仅在追溯理由、恢复未决方向或处理事实冲突时按需读取，并要求回到源码与当前事实文档确认。

#### DOC-012：整理 `docs/newPlan/`

逐篇判断其属于当前事实、未决方向或历史草案；需要保留的内容迁入合适位置，真正要推进的方向重新立项，完成后运行 `npm run check:docs`。

该切片必须独立执行，不与机制代码改动混合。

### P2：工具化与实证

#### DOC-013：扩展文档检查器

仅增加可机械判断的检查：元信息格式、源码路径、旧目录引用、`docs/newPlan/` 新增文件、历史层误用提示等。

#### DOC-014：生成任务上下文包

根据任务类型输出建议 Read Set、源码入口、默认排除项和验证命令。第一版允许使用静态 Markdown 索引，不要求立即引入复杂工具。

#### DOC-015：建立文档负担监测

统计当前文档和上下文包的规模，识别过长模块卡、重复度高的文档和超过 60k token 的领域包。

#### DOC-016：用真实任务验证上下文包

至少选择一个引擎机制、一个 UI、一个 Schema、一个跨模块和一个纯文档任务，记录实际读取范围、上下文规模、历史噪音和遗漏约束。

#### DOC-017：建立文档维护责任矩阵

把代码变化与必需文档同步关系集中记录，并与 `doc-maintenance.md` 保持一致。

## 依赖与顺序

```text
DOC-001 → DOC-002 → DOC-003 → DOC-004
                         ↓
                 DOC-005～DOC-009
                         ↓
                 DOC-010～DOC-012
                         ↓
                 DOC-013～DOC-017
```

DOC-012 涉及历史文档迁移，必须在 DOC-001 的权威层级明确后执行。DOC-013 之后才考虑自动生成上下文包，避免过早工具化。

## 上下文预算

本 Task 的施工 Unit 默认遵守：

- 文档 Read Set：3–8 篇；
- 历史文档：默认 0 篇，必要时最多 2 篇；
- 普通 Unit：8k–30k token；
- 跨模块 Unit：25k–60k token；
- 超过 60k token：拆分或先建立新的领域上下文包。

## 测试与验收

### 文档层

- `npm run check:docs`
- `git --no-pager diff --check`
- 所有新增 WikiLink 可达；
- `docs/plan-work/` 裸文件名仍保持唯一；
- 不新增 `docs/newPlan/` 文件。

### 上下文层

- 新会话读取 `AGENTS.md + 00-INDEX + 当前架构卡` 后，可以选择正确的领域入口；
- 典型任务不需要默认读取 `docs/plan-work/archive/**`；
- 每个领域上下文包能给出明确的最小 Read Set；
- 真实任务验证中，遗漏约束和历史误读都能被记录并回填到路由规则。

### 代码层

本 Task 不修改运行时代码，因此不要求 `npm test` 或 `npx tsc --noEmit` 作为每个文档 Unit 的最低验证；若后续修改检查脚本，则必须补充脚本定向验证。

## 当前核验（2026-09-15）

- 已核验 `docs/docs-828/00-INDEX.md` 为当前文档唯一入口。
- 已核验 `docs/docs-828/` 当前约 56 篇文档。
- 已核验 `docs/plan-work/archive/` 为冻结历史层，当前约 116 篇文档。
- 已核验 `docs/ai/PROJECT-CONSTITUTION.md` 已规定最小 Read Set、Patch Unit 和 Receipt 纪律。
- 已将 `docs/newPlan/` 的 6 篇遗留文档移入 `docs/plan-work/archive/`；旧目录现为空，不再承载计划正文。
- 已完成 DOC-001：权威层级已写入当前架构卡、Read Set 路由和任务入口。
- 已完成 DOC-002：新增 `docs/docs-828/01-architecture/current-context-card.md`。
- 已完成 DOC-003：新增 `docs/ai/task-read-set-routing.md`，覆盖主要任务类型。
- 已完成 DOC-004：Patch Unit 模板增加上下文预算、Optional Read Set 和默认排除项。
- 已完成 DOC-005～DOC-009：新增生产、角色、UI、Datapack / Schema、世界线生命周期五个领域上下文包。
- 已执行 `npm run check:docs`：通过，扫描 198 篇 Markdown，errors: 0。
- 已执行 `git --no-pager diff --check`：通过；工作区已有的换行提示不是错误。
- DOC-010 已完成首轮治理：为高频架构入口和 Read Set 路由增加轻量 YAML 元信息，并在文档维护规范中登记格式。
- DOC-011 已由 Read Set 路由、当前架构卡和本 Task 的历史层规则统一覆盖。
- DOC-012 已完成：6 篇 `docs/newPlan/` 遗留文档已迁入 archive；其中一篇追加路径更正说明。
- DOC-013 已完成：`check:docs` 增加元信息、旧目录和旧 WikiLink 的机械检查。
- DOC-014 已完成首版：静态 Read Set 路由和五个领域上下文包可直接作为任务上下文入口。
- DOC-015 已完成首版：新增 `npm run report:doc-context`，只输出分区规模和超预算提示。
- DOC-017 已完成首轮：文档维护规范已登记代码变动到文档同步触发器。
- DOC-016 已完成：用生产、UI、Schema 和世界线 / 生命周期四类真实任务试读 Read Set；4 个定向测试文件共 38 tests 全部通过。

### DOC-016 真实任务试读记录

| 任务样本 | 实际 Read Set / 验证入口 | 结果 |
| --- | --- | --- |
| 生产 / GameNum 事件失效 | `production` 上下文包、GameNum / Affector 模块与机制文档；`tests/engine/game-num-invalidation.test.ts` | 能定位；发现领域包需显式带架构纪律，已补齐 |
| UI / Presentation 服务 | `ui-presentation` 上下文包；`src/ui/presentation-service.ts`；`tests/ui/presentation-service.test.ts` | 能定位；未引入历史主题 Roadmap |
| Schema / 类型同步 | `datapack-schema` 上下文包；`src/engine/types/`、`tools/datapack-editor/schema/`；`engine-schema.sync.test.ts` | 能定位；Schema 生成和三向同步边界清晰 |
| Init / Global 生命周期 | `world-lifecycle` 上下文包；Runtime / state / save 入口；`tests/engine/init-global-lifecycle.test.ts` | 能定位；Global / per-Init 边界未遗漏 |

试读结论：领域上下文包需要保留架构纪律作为共同 Required Read Set；历史 archive 未进入默认上下文；当前未发现需要新增领域包的遗漏。

## 本轮执行记录

| Unit | 范围 | 结果 |
| --- | --- | --- |
| 0070-U1 | DOC-001～DOC-004：权威层级、当前架构卡、Read Set 路由、上下文预算 | 完成 |
| 0070-U2 | DOC-005～DOC-009：五个领域上下文包 | 完成 |
| 0070-U3 | DOC-010～DOC-017：元信息、历史目录治理、检查器、规模报告、真实任务试读 | 完成 |

本轮没有修改运行时代码或 Schema 生成产物；历史计划只追加了一条路径更正说明。

## 剩余工作

DOC-001～DOC-017 已完成首轮；后续仅在真实施工暴露新的遗漏或噪音时增量修订，不预先扩展成全库元数据改造。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/05-conventions/doc-maintenance]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[task-0069-documentation-integrity-guardrails]]
- [[docs/plan-work/00-index]]
