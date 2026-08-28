# docs-824 — 08 架构整理任务清单（todoTASK）==规划==

> 状态：**规划文档（任务清单，未排期）**。来源：[[docs-824/05-architecture-review]] 基线的增量问题 + 2026-08 全量依赖梳理（GameInstance / StateMutationService / Registry / 效果三引擎 / 三层状态同步 / UI 依赖方向）。
> 定位：架构债作为**独立迭代**逐项消化，**不混入功能迭代**（如好感度系统，见 [[docs-824/03g-affection]]）。拆分手法与惯例见 [[docs-824/06-refactoring-guide]]。

## 评估结论（哪些不动 / 哪些要动）

**不动（刻意设计，解耦反而破坏纪律）**：
- 单一写入口集中——`StateMutationService` 保持单类门面（所有状态变更走一处换来的可审计性是买点）
- Registry 25 表 + schema 三向同步——`数据包声明式`纪律的代价，有 `engine-schema.sync.test.ts` 兜底
- 事件驱动反向通道——EventBus 单向 emit 是订阅方解耦的手段

**要动（真问题，下表 T1-T7）**。

## 任务总览

| # | 任务 | 严重度 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| T1 | GameInstance 装配外移与门面收敛 | 🔴 | 无 | 待办 |
| T2 | UI 只读纪律恢复（去 as never / 裁剪接口） | 🔴 | 无 | 待办 |
| T3 | 三层状态快照元数据化 | 🔴 | 无 | 待办 |
| T4 | 事件登记表 + Trigger 映射扩展 + 死事件清理 | 🟡 | 无 | 待办 |
| T5 | 分发点注册表化（Condition / Value / Effect） | 🟡 | T4 风格先行 | 待办 |
| T6 | Registry 表清单表驱动 + addSpotTag 破口处置 | 🟡 | 无 | 待办 |
| T7 | 环形依赖解扣（EffectEngine 回调 / Affector↔GameNum 互持） | 🟡 | T5 | 待办 |

**建议执行序**：T1 / T2 / T3 可并行先行（纯搬移 + 纪律恢复，零行为变化）；T4 → T5 → T7 串行（扩展点与依赖方向改造）。
**统一验证**：`npm test` 全绿 + `npx tsc --noEmit` + 动 types 时 `npm run gen:schema`。

---

## T1 GameInstance 装配外移与门面收敛

### 现状证据
- `src/engine/game-instance.ts` 889 行：构造器 L123-341 new 出 28 个子系统，回调闭包互相接线（`() => this._state` 10+ 处、`(expr,state)=>evaluateExpr` 3 处）；L348-363 内联**业务订阅**（`characterAcquired`/`flagChanged` → 色彩解锁重算——特性代码写进组合根）。
- 05 基线规划的 state-factory / save-codec / snapshot / init-savepoint 拆分已落地；剩余为**装配膨胀 + 门面膨胀**（60+ 透传方法）。

### 任务拆解
1. 拆 `src/engine/game/wiring.ts`（或 wiring/ 目录）：装配逻辑外移为分域函数 `wireCore / wireExpression / wireEffect / wireDomain / wireUIFacing`，构造器只剩 `new` + `wire(...)` 调用。
2. 业务订阅外移：色彩解锁重算移入 `color-system`（订阅自己的依赖事件）或独立 `system/unlock-reactor.ts`（沿用 `EventDrivenReactor` 分桶模式）；组合根不再含特性逻辑。
3. 门面收敛：透传方法分组评估**子门面**（`game.story.*` / `game.spot.*`），UI 渐进迁移；确认无调用的纯透传删除（项目无兼容包袱）。

### 验收
- `game-instance.ts` ≤ 400 行；构造器无业务订阅；`npm test` 全绿（纯搬移零行为变化）。

### 风险
- 回调闭包的 setState 时序敏感——按构造器原顺序逐段搬移，每段对照行为。

---

## T2 UI 只读纪律恢复

### 现状证据
- **16 个文件**直读 `game.state`（components 10 个 + controller 级 6 个），并用 `as never` 强转把 `Readonly<PlayerState>` 交回引擎系统求值：`production.ts:48/65/67/69`、`controller-core.ts:82/88`、`tooltip-detail-spot.ts:35/60/63`、`tooltip-enhancement.ts:110/123`、`tooltip-reveal.ts:27` 等。
- components 持有整个 `game` 对象（非裁剪接口），可触达任意引擎系统——`getView()` 只读快照纪律形同虚设（架构纪律 #4 被系统性绕过）。

### 任务拆解
1. 盘点：全量列出 `game.state` 直读点与 `as never` 点，分两类消费——**渲染数据**（应走 view 快照）与**条件/数值求值**（应走引擎只读求值 API）。
2. 供给补齐：`createUIContext()` 扩展缺失的只读查询面（如 conditionSystem 的 describe/evaluate 包装）。
3. 类型收口：`UIContext.game` 收窄为 `UIFacingGame`（Pick 只读查询面），逐步清除 `as never`。
4. 迁移顺序：tooltip 系（低频）→ production / controller（高频），逐文件独立提交。

### 验收
- `grep "as never" src/ui` 零命中；`game.state` 直读仅剩白名单（目标零）；开发服务器各面板冒烟无回归。

### 风险
- view 是快照，高频面板（production/tick 驱动）需确认刷新链路不因快照化丢失实时性——按面板验证。

---

## T3 三层状态快照元数据化

### 现状证据
- 同一份 per-Init 字段清单手写 **5+ 处**：`init-savepoint.ts` 的 `save(L22-40)` / `clear(L59-86)` / `restore(L89-114)` / `characterSnapshotFields(L43-56)` + `snapshot.ts freshPerInitState(L10-25)` + `state-factory.ts createDefaultState(L9-30)`（全量默认）；`save-codec.ts normalizePlayerState(L82-106)` 另有兜底。
- **加一个 per-Init 字段漏同步一处即存档不一致**——本项目最高危的手工耦合（好感度 affection 内嵌 RosterEntry 恰好绕开，但后续任何新 per-Init 字段仍会踩）。

### 任务拆解
1. 定义 `src/engine/game/per-init-fields.ts`：`PER_INIT_FIELD_SPECS: { key; defaultValue; scopeOf?(registry) }[]` 作为**单一事实源**。
2. `save / clear / restore / freshPerInitState` 改为遍历 SPECS；`characterScopeOf` 三分支（roster/gacha/chatRead）下沉为 `spec.scopeOf`。
3. `createDefaultState` 的 per-Init 部分引用 SPECS（global 层默认保留手写）。
4. 守卫测试：SPECS 键集合 == `PlayerState` per-Init 字段键集合（类型级映射或运行时断言），新字段漏登记直接报错——**防漂移是本任务的核心收益**。

### 验收
- `init-savepoint` 三函数各 ≤ 30 行；守卫测试通过；存档往返测试全绿（含 affector-reconcile 存档往返）。

### 风险
- scope 分支语义（roster/gacha/chatRead 三种归属组合）易错——SPECS 单测逐组合覆盖。

---

## T4 事件登记表 + Trigger 映射扩展 + 死事件清理

### 现状证据
- 41 种事件 vs `TriggerSystem.ON_KIND_TO_EVENT` 仅 7 种（`trigger-system.ts:30-38`）——Trigger DSL 无法响应 `characterAcquired` / `cultivated` 等事件。
- 17+ 种事件（培养/色彩/主题/affector 家族）无任何专属订阅方（仅 onAny 兜底）；`conditionGroupMet`（`events.ts:38`）是全库唯一**既无人发射也无人订阅**的死事件。
- 订阅方散落 10+ 文件，无集中登记——事件契约不可审计。

### 任务拆解
1. `events.ts` 建立事件目录：逐条登记发射方 / 订阅方 / 用途（TSDoc 或 `EVENT_CATALOG` 元数据）。
2. 死事件处置：`conditionGroupMet` 删除（AGENTS 纪律 #7 允许破坏性变更）。
3. `TriggerEventDef.kind` 按玩法需要扩展：最少补 `character`（→ `characterAcquired`，服务获得/好感联动）与 `cultivated`（→ 升级/突破联动）；`ON_KIND_TO_EVENT` 加**类型级穷尽测试**（每个 kind 必有事件映射）。
4. [[docs-824/04f-trigger-effect]] 发射方表与代码对齐。

### 验收
- 事件目录完整；新增 trigger kind 的改动面 = 类型联合 + 映射表 1 行 + gen:schema；测试覆盖映射穷尽。

### 风险
- Trigger schema 面扩大——需 editor-extras 同步（TABLE_META 兜底 kind 枚举中文）。

---

## T5 分发点注册表化（Condition / Value / Effect）

### 现状证据
- `condition-system.ts:73-135`：14 个 ConditionTarget 硬编码 switch + 6 个 `setXxxReader` 注入回调——加 target 要改 switch + 加回调。
- `value-system.ts:31-133`：7 个 ValueSource + 12 个算子全部 switch。
- EffectOp 23 种 op 分散三处：`effect-ops.ts`（状态层）、`effect-engine.ts:42-58`（转发层）、`affector-engine.ts`（`setSpotMaxLevel` 声明类特判）。

### 任务拆解
1. ConditionSystem：`target → evaluator` 注册表（模块级常量 Map，引擎内置注册）；6 个注入回调收敛为单参 `EvalContext` 对象。
2. ValueSystem：source evaluator 注册表 + 算子表驱动。
3. EffectOp：`op → handler` 注册表合并三处分发；声明类 op（`setSpotMaxLevel`/`removeSpotMaxLevel`）标记 `declarative: true`，由 Affector 动态读取、不进执行流。
4. 扩展点验收标准：**新增一个 target/op 的改动面 = 类型联合 + 1 处注册**。

### 验收
- 现有全部测试绿；新增示例 target（如好感度 `affectionLevel`）只改 2 处即可接入。

### 风险
- tick 热路径性能：Map 查找 vs switch 差异可忽略，但注册表必须为模块级常量（禁止每帧重建）。

---

## T6 Registry 表清单表驱动 + addSpotTag 破口处置

### 现状证据
- `registry.ts` 25 张表 × 4 处同步（私有字段 L50-89 + getter + merge 分支 L341-434 + clear L306-337）。
- `addSpotTag/removeSpotTag`（L258-277）**运行时改数据包表**并同步索引——违反"数据包只读"，本质是应落状态层的数据变更。

### 任务拆解
1. merge / clear 表驱动：`表名 → 解析器` 注册清单遍历；getter 保留手写（类型安全收益大于同步成本）。
2. `addSpotTag` 迁移评估：spot tag 运行时改写入 `PlayerState.spotTagOverrides`（走 mutations + `spotTagChanged` 事件，affector 订阅链不变）；迁移后 Registry 恒只读。

### 验收
- 新增一张表的改动面 = 1 处注册 + 类型；spot tag 运行时变更走状态层事件链。

---

## T7 环形依赖解扣

### 现状证据
- EffectEngine 靠 3 个**回调处理器**反向指回 ColorSystem / StoryService / ChatFlowService（`game-instance.ts:178-194`）——效果层依赖被装配期打补丁反向接线。
- AffectorEngine 与 GameNumSystem **互持**（`game-instance.ts:218-226` 互相注入）。

### 任务拆解
1. 演出类 op（`setTheme` / `showChatText` 族）事件化：EffectEngine 只 emit `uiEffectRequested`（或按 op 细分），UI 侧 reactor 消费——消除三个回调处理器字段。
2. Affector ↔ GameNum 定向：GameNum 求值惰性查询 Affector（保持现方向）；Affector 的 perTick 产出改由 tick 编排层桥接，不再持 GameNum。

### 验收
- 依赖图无环（`npx madge --circular src/engine` 或 import 手工核对）；演出/产出全回归。

### 风险
- 事件化引入派发语义差异——EventBus 保持同步 dispatch 不变，演出发射点原位替换。

---

## 与功能迭代的关系（纪律）

1. **功能迭代不顺手重构**：好感度等新机制只踩必须踩的扩展点（condition switch / effect-ops / schema），T1-T7 独立分支独立提交。
2. 每完成一项 Ti：更新本表状态 + 将沉淀的惯例写回 [[docs-824/06-refactoring-guide]]。
3. T3 落地前，新增 per-Init 字段仍须手工同步 5 处（当前纪律，靠测试兜底）。

## 状态记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-28 | 建档：依据全量依赖梳理产出 T1-T7 任务卡 |

---
上一篇：[[docs-824/07-pic-assets]]
