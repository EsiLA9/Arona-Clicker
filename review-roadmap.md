# 全量 Code Review Roadmap（从零到吃透引擎）

> 目标：从基础代码出发，完整理解项目与实际运行原理，并完成一轮全量 review。
> 路线按「数据 → 数值 → 写入/事件 → 游戏域 → 装配/UI → 数据包」分层推进，每层先读文档再对代码，读完做验证。
> 机制细节一律以 [[docs-828/00-INDEX]] 路由的文档为准，本文只管阅读顺序与 review 检查点。

## 代码量概览（2026-08-31 实测）

| 分区 | 位置 | 文件数 | 约行数 | 说明 |
| --- | --- | --- | --- | --- |
| 实体类型 | `src/engine/types/` | 17 | ~3,400 | 全项目的数据契约 |
| 注册表 | `src/engine/registry/` | 2 | ~800 | Registry 建表 + 校验 |
| def-factory | `src/engine/def-factory/` | 25 | ~2,150 | Datapack def → 运行时对象 |
| 表达式/数值 | `src/engine/expression/` | 11 | ~1,550 | ValueSystem / GameNum |
| 写入与事件 | `src/engine/system/` + `src/engine/effect/` | 24 | ~3,700 | StateMutationService / Trigger / Affector |
| 游戏域 | `src/engine/game/` | 25 | ~3,240 | Init / Spot / Story / 存档门面 |
| 角色域系统 | `src/engine/system/` 角色部分 | 18 | ~2,750 | 角色 / 抽卡 / 色彩 / 培养 |
| 统计/可见性/Extra | `stats/` `visibility/` `extra/` | 15 | ~1,370 | 横切子系统 |
| 装配与 tick | `game-instance.ts` + `game/wiring.ts` + `main.ts` | 3 | ~750 | 组合根 |
| UI | `src/ui/` | ~50 | — | 只读消费 + controller 拆分 |
| 引擎测试 | `tests/engine/` | 59 | — | vitest |

引擎合计约 1.7 万行。按本路线每天 1–2 小时，预计 2–3 周完成首轮全量。

---

## Phase 0 · 全局认知（半天）

**目标**：建立系统全景，跑通开发环境。

- 读 [[AGENTS]]（架构纪律 7 条 + 命令表）
- 读 [[docs-828/00-INDEX]] 与 [[docs-828/01-architecture/overview]]
- 读 [[docs-828/01-architecture/run-logic]]（主干调用链：`main.ts → GameInstance → wiring 装配 → init(datapacks) → start() → tick`）

**动手验证**：
```
npm test          # vitest 全量，确认基线绿色
npx tsc --noEmit  # 类型检查
npm run dev:game  # 打开 UI 实际玩一圈：选 Init → 进 Area → Spot 生产 → 抽卡 → 剧情
```

**自测**：能不看文档说出「一次状态变更从 UI 点击到 PlayerState 落盘经过哪几层」。

---

## Phase 1 · 数据地基：类型 + 注册表（2–3 天）

**目标**：所有实体类型、三层状态结构、Registry 建表逻辑。

阅读顺序（由小到大）：

| 顺序 | 文件 | 行数 | 配套文档 |
| --- | --- | --- | --- |
| 1 | `types/common.ts` / `types/ids.ts` | 218 | [[docs-828/03-data-structures/id-reference-semantics]] |
| 2 | `types/state.ts` | 272 | [[docs-828/01-architecture/state-layers]] + [[docs-828/03-data-structures/player-state]] |
| 3 | `types/world.ts` | 244 | 同上 |
| 4 | `types/expression.ts` / `types/trigger.ts` / `types/events.ts` | 552 | [[docs-828/03-data-structures/declarative-dsl]] |
| 5 | `types/character.ts` / `types/content.ts` | 1,051 | [[docs-828/03-data-structures/character-entities]] |
| 6 | `types/results.ts` / `types/datapack.ts` | 316 | [[docs-828/03-data-structures/stats-views]] |
| 7 | `registry/registry.ts` + `registry/registry-validate.ts` | 798 | [[docs-828/03-data-structures/registry]] + [[docs-828/02-modules/registry]] |

**Review 检查点**：
- [ ] 三层状态（global / per-Init 快照 / per-Init 当前）每个字段能归类；抽查 `PER_INIT_FIELD_SPECS`（`game/per-init-fields.ts`，152 行）登记面是否与 `types/state.ts` 一致
- [ ] 真引用 vs 意义引用：抽 3 个 ref 字段对照判定表验证
- [ ] Registry 校验覆盖了哪些非法情形？找一个**没有**被校验的非法输入（review 发现点）

---

## Phase 2 · 数值核心：表达式 + GameNum（2–3 天）

**目标**：吃透产出结算的心脏。这是全项目最精妙的子系统。

| 顺序 | 文件 | 行数 | 配套文档 |
| --- | --- | --- | --- |
| 1 | `expression/value-system.ts` | 149 | [[docs-828/02-modules/expression]] |
| 2 | `expression/condition-system.ts` + `condition-deps.ts` | 369 | 同上 |
| 3 | `expression/funclet-executor.ts` | 44 | 同上 |
| 4 | `expression/game-num.ts` → `game-num-build.ts` → `game-num-eval.ts` → `game-num-tag.ts` → `game-num-internal.ts` | 1,232 | [[docs-828/02-modules/game-num]] + [[docs-828/04-algorithms/production]] + [[docs-828/06-adr/0002-gamenum-tree]] |
| 5 | `expression/stat-dsl.ts` + `tag-effect.ts` | 165 | — |

**Review 检查点**：
- [ ] GameNum 四级层级树（资源 → zone → …）画一张图；增量失效靠什么触发（事件驱动失效）
- [ ] 对照 [[docs-828/07-audit/00-overview]] 的豁免说明理解：为什么 GameNum 增量失效体系被豁免于整改
- [ ] 跑 `tests/engine/game-num*.test.ts`（3 个文件），改一个 def 数值观察失效范围

---

## Phase 3 · 写入口与事件驱动（2–3 天）

**目标**：理解「单一写入口」与「事件驱动」这两条铁律的实现。

| 顺序 | 文件 | 行数 | 配套文档 |
| --- | --- | --- | --- |
| 1 | `core/event-bus.ts` / `core/tag.ts` / `core/resource.ts` | 146 | [[docs-828/02-modules/core]] |
| 2 | `system/state-mutation-service.ts` | 602 | [[docs-828/04-algorithms/state-mutation]]（写入 4 步管道） |
| 3 | `effect/effect-engine.ts` + `system/effect-ops.ts` | 151 | [[docs-828/02-modules/effect-trigger]] |
| 4 | `effect/trigger-system.ts` + `event-driven-reactor.ts` + `runtime-effect-reactor.ts` | 297 | [[docs-828/04-algorithms/trigger-effect]]（EVENT_CATALOG） |
| 5 | `effect/affector-engine.ts` + `affector-text.ts` | 603 | [[docs-828/02-modules/affector]]（四通道） |

**Review 检查点**：
- [ ] 写入 4 步管道每一步做什么？哪一步触发事件？哪一步做统计？
- [ ] 全局 grep 直接改 `PlayerState` 的写点，验证纪律 1 是否真的无违规
- [ ] Trigger 与 Affector 的边界：什么场景该用哪个？（review 易混点）

---

## Phase 4 · 游戏域系统（4–5 天，最大分区）

**目标**：门面层 + 各玩法域。按「世界 → 角色 → 表现」三组推进。

### 4a. 世界域（`game/` 门面）

| 顺序 | 文件 | 行数 | 配套文档 |
| --- | --- | --- | --- |
| 1 | `game/init-service.ts` + `init-mount.ts` + `init-savepoint.ts` | 527 | [[docs-828/02-modules/world]] |
| 2 | `game/spot-service.ts` + `system/spot-functionality.ts` | 309 | 同上 |
| 3 | `game/session-service.ts` / `item-service.ts` / `enhancement-service.ts` | 310 | — |
| 4 | `game/save-codec.ts` + `snapshot.ts` + `runtime-reset.ts` + `state-factory.ts` | 324 | [[docs-828/01-architecture/state-layers]]（存档双政策见 [[docs-828/07-audit/runtime-tolerance]]） |

### 4b. 角色域（`system/`）

| 顺序 | 文件 | 行数 | 配套文档 |
| --- | --- | --- | --- |
| 1 | `system/character-system.ts` + `character-availability.ts` + `roster-system.ts` | 292 | [[docs-828/02-modules/character]] + [[docs-828/04-algorithms/roster]] |
| 2 | `system/gacha-service.ts` | 186 | [[docs-828/04-algorithms/gacha]]（入口在 Spot 的 gacha 功能项） |
| 3 | `system/cultivate-system.ts` | 106 | [[docs-828/04-algorithms/cultivate]] |
| 4 | `system/color-system.ts` + `color-equipment-system.ts` + `color-unlock-reactor.ts` | 713 | [[docs-828/02-modules/color]] + [[docs-828/04-algorithms/color-derivation]] |
| 5 | `system/affection-system.ts` | 110 | [[docs-828/06-adr/planning]]（好感机制单一事实源） |
| 6 | `system/loot-system.ts` + `passive-pool-system.ts` | 271 | — |

### 4c. 表现域

| 顺序 | 文件 | 行数 | 配套文档 |
| --- | --- | --- | --- |
| 1 | `game/story-service.ts` + `story-flow.ts`（513，最大文件）+ story-jump/replay/rewards/context/cursor-state | ~1,180 | [[docs-828/02-modules/story]] |
| 2 | `visibility/` 4 文件 | 327 | [[docs-828/02-modules/visibility]] |
| 3 | `stats/` 4 文件 + `extra/` 8 文件 | ~1,045 | [[docs-828/02-modules/stats]] + [[docs-828/07-audit/stats-ledgers]]（统计五套并记问题） |
| 4 | `image/` 3 文件 | 100 | [[docs-828/02-modules/pics]] |

**Review 检查点**：
- [ ] 剧情流（story-flow）的推进/阻断/复检逻辑与 tick 的交互顺序
- [ ] 色彩派生链：ColorGroup → 主题 token → UI 消费
- [ ] 对照 [[docs-828/07-audit/dual-track-state]] 与 [[docs-828/07-audit/dormant-machinery]]，抽查清单中的点在当前代码是否仍存在（audit 整改进度 review）

---

## Phase 5 · 装配与 UI（2 天）

**目标**：把前面所有子系统在组合根串起来，再看只读 UI。

| 顺序 | 文件 | 行数 | 配套文档 |
| --- | --- | --- | --- |
| 1 | `game/wiring.ts` | 291 | [[docs-828/06-adr/0001-architecture-consolidation]]（T1-T7 整理：装配外移） |
| 2 | `game-instance.ts` | 398 | [[docs-828/01-architecture/run-logic]]（tick 顺序：生产结算 → Affector → 剧情 → 阻断复检 → 统计） |
| 3 | `src/main.ts` + `src/ui/main.ts` + `src/ui/context.ts` | — | [[docs-828/02-modules/ui]] |
| 4 | `src/ui/controller*.ts`（11 个拆分文件） | — | 同上（controller 拆分纪律） |
| 5 | `src/ui/components/` 抽 3 个代表：`production.ts` / `story.ts` / `contacts.ts` | — | 只读消费验证 |

**Review 检查点**：
- [ ] tick() 的完整顺序背下来；每个阶段失败/阻断时行为如何
- [ ] 全局搜索 UI 是否持有任何可写引用（纪律 4）
- [ ] UI 如何拿数据：`getView()` / `createUIContext()` 调用点梳理

---

## Phase 6 · 默认数据 + Datapack 生态（2 天）

**目标**：理解「声明式数据包」如何落地，以及编辑器同步协议。

| 顺序 | 内容 | 配套文档 |
| --- | --- | --- |
| 1 | `src/data/base/`（17 个 TS 文件）：先 `datapack.ts` → `inits.ts` → `spots.ts` → `characters.ts`/`character-rework.ts` → `stories*.ts` | 对照 def-factory 各文件（25 个）看 def → 运行时对象构建 |
| 2 | `datapack/` 目录的 JSON 示例包 | [[docs-828/06-adr/0004-datapack-management]]（多包管理，规划中） |
| 3 | `tools/datapack-editor/` + schema 协议 | [[docs-828/05-conventions/schema-sync]]（必读 `gen:schema` 流程与 `engine-schema.sync.test.ts` 三向检查） |
| 4 | `tests/` 顶层（arona-clicker-core / zip-loader） | [[docs-828/05-conventions/testing]] |

**动手验证**：改一个 `src/data/base/` 字段 → `npm run gen:schema` → 打开编辑器看变化 → `npm test`。

---

## 全局 Review 检查清单（贯穿各 Phase，最后汇总）

**架构纪律逐条验证**（[[docs-828/05-conventions/architecture-discipline]]）：
1. 单一写入口：grep 直接改 PlayerState 的写点
2. 事件驱动：GameInstance 方法体里有没有该做成 Trigger/Affector 的联动逻辑
3. 声明式：找硬编码本应进 Datapack 的机制
4. 只读 UI：UI 写引用搜索
5. 三层状态：per-Init 字段是否都在 SPECS 登记
6. 测试先行：改动无测试的模块清单
7. 无存档迁移代码：grep 版本兼容/迁移逻辑（应为零）

**Audit 整改复核**：过一遍 [[docs-828/07-audit/00-overview]] 各分组（runtime-tolerance / dual-track-state / dormant-machinery / presentation-fallbacks / enum-taxonomy / stats-ledgers / sync-burden），标记已整改/未整改/豁免。

**Review 输出物建议**：
- 每阶段在本文档下方追加一节「发现记录」（位置 / 现象 / 严重度 / 建议）
- 汇总后可按 [[docs-828/05-conventions/doc-maintenance]] 决定哪些发现升级进 docs-828 或 07-audit
- 机制理解与文档不符处 = 文档漂移，按 doc-maintenance 修正

## 进度打卡

- [ ] Phase 0 全局认知
- [ ] Phase 1 数据地基
- [ ] Phase 2 数值核心
- [ ] Phase 3 写入与事件
- [ ] Phase 4 游戏域（4a 世界 / 4b 角色 / 4c 表现）
- [ ] Phase 5 装配与 UI
- [ ] Phase 6 数据与工具链
- [ ] 全局纪律验证
- [ ] Audit 复核与发现汇总
