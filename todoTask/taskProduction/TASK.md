# taskProduction — 生产结算与效果链路统一任务书

> 合并三个引擎的任务为一个统一任务表：
> **GameNum**（产出结算树，来源 `todoTask/taskGameNum/TASK.md`）、
> **Affector**（效果生命周期，来源 `docs-824/04h-affector-review.md`）、
> **Resource**（资源管道：ValueSystem 表达式 / StateMutationService 写入口 / TickSystem 结算 / LootSystem 掉落 / 统计）。
> 目标架构见 `todoTask/taskGameNum/tree-design.md`（未来树设计）。
>
> 本任务书为后续执行 agent 的唯一输入，自包含，无需依赖原会话上下文。
> 仓库根目录：`C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`（git 仓库，分支 main）。

---

## 0. 任务目标（一句话）

**把「产出 → 效果 → 资源入账」整条链路收敛为单一真相、单一路径、跨帧懒求值的树形系统**：
GameNum 树是唯一结算路径，state 表是唯一修饰数据真相，Affector 是唯一效果生命周期，
资源写入只经 StateMutationService 且事件完备——数值变动后只重算受影响子树。

执行准则（贯穿全程）：

1. **单一真相**：每份数据只有一种表示（当前 zone 修饰数据存三份，需归一）。
2. **单一路径**：每类操作只有一条执行路径（tick 结算、表达式求值、flows 扫描各只有一条）。
3. **失效精确化**：懒求值要真的懒——跨帧只重算受影响子树，不做每帧整树置脏。
4. **删死代码**：无消费者即删，不做「预留」。
5. **不改语义**：除测试中已显式声明的行为外，所有数值结果必须保持不变；语义变更（如同组乘区合并方式）须先在交付说明中写明并更新快照测试。

---

## 1. 系统现状（三引擎文件地图）

### 1.1 GameNum（产出结算树）

| 文件 | 职责 |
| --- | --- |
| `src/engine/expression/game-num.ts` | `GameNumSystem` 门面：事件订阅、索引字段、查询入口 |
| `src/engine/expression/game-num-eval.ts` | 17 种节点 kind + 纯求值 `evaluateGameNum` + 溯源 + `aggregateZone` 兜底 + 双 flows 入口 |
| `src/engine/expression/game-num-build.ts` | `buildAll` 建树：primitiveGain / spot 子树 / zone 节点 / zoneIndex / 层级链接 |
| `src/engine/expression/game-num-tag.ts` | 区表写入 + Affector 桥接（`registerTagEffect` / `syncAffectorZoneEffects`） |
| `src/engine/expression/tag-effect.ts` | `TagEffectRecord` / `ZoneModifierDecl` / `EntityRef` / `entityKey` / `tagPrefixesBottomUp` |

### 1.2 Affector（效果生命周期）

| 文件 | 职责 |
| --- | --- |
| `src/engine/effect/affector-engine.ts` | 实例生命周期（mount/unmount/recheck）、entry 条件、addResource edge 发放、`syncAffectorZoneEffects` 调用方、Spot 功能挂载 |
| `src/engine/effect/affector-text.ts` | 效果描述文本 |
| `src/engine/def-factory/affector-pack.ts` | `AffectorPackDef` builder（`modTag` / `modEntity` / `flow`） |
| `src/engine/types/trigger.ts` | `AffectorPackDef` / `AffectorInstance` / `AffectorEffect` 类型 |

### 1.3 Resource（资源管道）

| 文件 | 职责 |
| --- | --- |
| `src/engine/expression/value-system.ts` | ValueExpression 求值（`res`/`spotLevel`/`spotCount`/`managerCount`/`data`/`funclet` 读 state） |
| `src/engine/system/state-mutation-service.ts` | 唯一写入口：`changeResource` / `setResource`（含 global/per-init 分桶 `resourceBucket`）、`resourceChanged` 事件 |
| `src/engine/system/tick-system.ts` | 每 tick 结算（**含两条路径**） |
| `src/engine/system/loot-system.ts` | 掉落资源 |
| `src/engine/game/init-service.ts` | 资源读数（`getResourceAmount`）、购买结算 |
| `src/engine/types/state.ts` | `resources` / `globalResources` / `resourceDisplays` 定义 |

### 1.4 相关文档

- `todoTask/taskGameNum/TASK.md`（原 GameNum 清理任务书）
- `todoTask/taskGameNum/tree-design.md`（未来树设计：四级层次 + base 链）
- `docs-824/04h-affector-review.md`（Affector 评审）
- `docs-824/04b-production.md`（生产结算）、`docs-824/04f-trigger-effect.md`（Affector 桥接）

---

## 2. 已识别问题清单（按主题分组，含来源引擎标记）

> 标注：[G]=GameNum，[A]=Affector，[R]=Resource 管道。

### 主题 1：数据三份表示 → 单一真相 [G]

1. `state.tagEffects` / `state.entityEffects`（PlayerState 顶层字段，随存档持久化）——唯一该留的真相。
2. `zoneNode.childMulMap`（内存投影，求值主路径；`game-num-tag.ts` 约 80 行镜像机制）。
3. `aggregateZone`（game-num-eval.ts:122-165）实时扫描 state 表——兜底路径，**正常不可达**；仅旧 tick 路径与测试调用。

**两条聚合路径的已知分歧**（Phase 0 快照已锁定，见 `game-num-snapshot.test.ts` 的 KNOWN DIVERGENCE）：
- 同乘区组多条记录：childMulMap 是 `1+Σ(f-1)`（加法），aggregateZone 是 `Πf`（连乘）。
- 通配 entity 键（`area:*` / `spot:*` / `init:*`）：不路由到 childMulMap，但 `aggregateZone` 会读。
- 统一语义时**必须先决策**（见 §6 决策项 1），并更新快照测试。

### 主题 2：多条执行路径 → 单一路径

- [G] 双 tick 路径（tick-system.ts:52-63 GameNum 路径 与 65-99 旧逐 Spot 路径并存；旧路径有已废弃的 capacity 夹取语义，7 处测试依赖）。
- [G] 双表达式系统：GameNum 17 种 kind 中 9 种从未被 buildAll 构造（min/max/pow/div/clamp/floor/ceil/round/cond），ValueExpression 已完整覆盖。
- [G] 双 flows 求值入口：`evaluateResourceAffectorFlows`（按资源）vs `evaluateSpotAffectorFlows`（按 spot）。
- [R] 资源读取路径分散：`init-service.getResourceAmount`、`value-system` 的 `res`/`data`、`loot-system`——读数一致性需核对。

### 主题 3：失效策略叠加 → 精确失效 [G][R]

- `game-instance.tick`（game-instance.ts:478）每帧 `invalidateProduction()` → 全树置脏 → 节点级缓存只在本帧内有效。
- `parents` 父链 + 定向 `markDirty` 传播被每帧全量失效盖掉。
- [R] `resourceChanged` 订阅（game-num.ts:114-116）依赖 `mayReadResources` 布尔（`JSON.stringify` hack），粒度粗。
- [R] 需审计 `StateMutationService` 全部资源写路径是否发射对应事件（见主题 6 的 Phase 4）。

### 主题 4：Affector 正确性 [A]

1. **存档恢复缺实例重挂载**（04h §1.1，严重）：`restoreFromSave` 只调 `setState`，不重挂载实例 → 读档后 flows/zoneModifiers/addResource 全丢。
2. **初始状态物品/强化无挂载**（04h §1.2，严重）：`createDefaultPlayerState` 的初始物品/强化不触发挂载事件。
3. `Effect[]` 每 tick 执行**（04h §1.3，严重）：非 addResource 的一次性 op（addItem/grantCharacter/unlockInit/triggerStory）在 Affector 中每 tick 重复执行 → 无限发放。
4. **flow 与 effects[addResource] 双通道双重发放**（04h §3.1，中）：并存时数据作者可能拿到双倍。
5. **mount 无条件覆盖旧实例**（04h §3.3，中）：重复获得同一物品 → addResource 重复发放。
6. **同 pack 多 entry 共用 id 隐式 OR**（04h §3.2，中）：无校验。
7. `getSpotMaxLevelOverrides` 每调用全量扫描**（04h §3.5，中）。

### 主题 5：Affector–GameNum 桥接 [G][A]

- `syncAffectorZoneEffects`（game-num-tag.ts:172-191）每 tick 全量「先按 source 撤销、再重注册」，与主题 1 同根，统一收敛。
- `toValueNode` 随机 id（game-num-tag.ts:142）：非确定性。
- `SpotFunctionalityDef.id` 作 pack 命名空间键、内外源隐式覆盖（03e §3，本任务不修但需记录）。
- `syncSpotFunctionalities` pack 键冗余 `${fn.id}@${spotId}@${spotId}`（04h §3.4，低）。

### 主题 6：死 API / 死字段 [G][A]

- [G] `named` 注册表（game-num.ts:59,205-220）：全库无调用方。
- [G] `clearTagEffectsByLife` + `TagEffectRecord.life` / `ZoneModifierDecl.life`（tag-effect.ts:29,59）：无调用方，三档语义无人执行；`ZoneModifierDecl.life` 是数据包字段，删除需同步 schema。
- [A] `AffectorPackDef.persistent`（trigger.ts:38）：声明即死，引擎从未读取。
- [G] `zoneNodeById`（game-num.ts:77）：仅 build 内部去重用。
- [G] `toValueNode` 随机 id（game-num-tag.ts:142）。
- [A] `modTag` / `modEntity` 仅接受 number，不支持 ValueExpression（04h §4.3）。
- [A] `describeValue` 的 spotCount 参数名与语义不符（04h §4.2）。

### 主题 7：未来树结构（tree-design.md 落地）[G][A][R]

- 显式 `init:<id>` / `area:<id>` / `spot:<id>` 层级节点（替代隐式 hierarchy 组）。
- 新增 `baseAdd`（Affector 对 base 的加值）、`areaOwn`（Area 自身产出）、`enhGains`（Enhancement 直接产出）节点。
- `base` 链与 `flat`/`flows` 链分离：乘区只乘 base 和。
- Affector flows 按 `mountEntityId` 层级分发（spotFlows / areaFlows / initFlows / globalFlows）。
- `getSpotMultiplier` 修正或删除（当前不含 hierarchy，与注释不符）。
- **乘区语义决策**：同组多条 mul 的加法 vs 连乘（§6 决策项 1）。

### 关联背景（本任务不修，仅不得恶化）

- Affector 实例不跨存档、读档后全部丢失是主题 4 的问题，**本任务修**（见 Phase 4）。
- `affectorPackIds: string | AffectorPackDef` 双通道引用（03e §3）、字符串 ID 泛滥（03e §5）：不修，记录。

---

## 3. 执行 Roadmap（按序执行）

### Phase 0 — 行为快照（已完成 ✅，commit `1faf5c3`）

- `tests/engine/game-num-snapshot.test.ts`（32 tests）已锁定：zone 聚合、hierarchy、双路径对拍、flows 双入口、失效行为。
- 现状：`npm test` 全绿（908 pass）、`npx tsc --noEmit` 通过。
- 注意：KNOWN DIVERGENCE 三个测试（同组多条 mul / custom / 通配 entity 键）在主题 7 统一语义后需更新。

### Phase 1 — 统一区表真相：删 childMulMap 投影（[G] 主题 1，核心结构清理）

**目标**：`state.tagEffects` / `state.entityEffects` 成为唯一真相；zone 求值统一走 state 表扫描；`zoneIndex` 保留，降级为定向失效索引。

- 删除 `game-num-tag.ts` 全部投影机制：`routeToZoneNodes` / `addContribution` / `applyBound` / `removeContribByKey`。
- `removeTagEffectsBySource` 中遍历 `zoneNodes`/`childMulMap` 的镜像撤销半边（保留 state 表清理 + markDirty）。
- `zoneValue` 的 childMulMap 分支，仅保留兜底 `aggregateZone` 路径。
- `mul` 节点求值中的 `childMulMap`/`bound` 分支——若不再有节点挂载区，一并删除。
- 保留：`zoneIndex`（定向 markDirty）、`markDirty`/`markAllDirty`/`parents`、`aggregateZone` 聚合逻辑。
- **语义迁移注意**：统一到哪个语义由 §6 决策项 1 决定；决策后更新快照测试的 KNOWN DIVERGENCE。
- 验收：快照测试（含对拍）按统一语义全绿；`registerTagEffect` 后无需 `routeToZoneNodes`；grep 确认 `childMulMap` 仅剩定义与清理后无残留投影逻辑。

### Phase 2 — 单生产路径：删旧 tick 路径（[G] 主题 2）

- `tests/engine/tick-system.test.ts` 的 7 处 `new TickSystem(reg, vs, bus)` 改为注入 `GameNumSystem`。
- 删除 `tick-system.ts:65-99` 旧路径及其 `aggregateZone` 直接调用、`baseCapacity` 夹取分支。
- 把「capacity 不再截断 gain」语义写进 `docs-824/02c-tick-loop.md` 与测试断言（`spot-functionality.test.ts:86` 已有声明，固化防回归）。
- 修复 `productions.push({ spotId: resource, ... })`（tick-system.ts:58）标签错位。
- 验收：`npm test` 全绿；`tick-system.ts` 不再 import `aggregateZone`；`TickSystem` 构造函数中 gameNumSystem 变必传（或删除退化分支）。

### Phase 3 — 收敛双表达式系统（[G][R] 主题 2）

**目标**：GameNum 与 ValueExpression 不再维护两套算术求值。

- **方案 A（推荐）**：GameNum 只保留 buildAll 实际构造的 kind：`const/expr/add/sub/mul/owned/levelLinear/zone/affectorFlows`。删除 `min/max/pow/div/clamp/floor/ceil/round/cond`（五处移除：类型联合、switchEval、Breakdown、collect、gainsMayReadResource walk；删除对应求值测试）。
- **方案 B（保守）**：不删，在 game-num-eval.ts 头部注释明确分工。**二选一，交付说明写明选择及理由。**
- **必做**：重写 `gainsMayReadResource` 为类型化静态扫描（参考 `condition-deps.ts`），粒度细化到**按 gain 子树**（每个 primitiveGain 一个依赖集合），为 Phase 4 铺路。
- 验收：`npm test` 全绿；grep 确认无残留 kind 构造；`gainsMayReadResource` 无 JSON.stringify。

### Phase 4 — Affector 正确性修复（[A] 主题 4，与树结构解耦，可并行）

- **4.1 存档恢复重挂载**（严重）：`restoreFromSave` 末尾（或下一 tick 前）遍历 PlayerState 中的物品/强化/Spot 等级，按需 mount Affector 实例并触发一次 `syncAffectorZoneEffects`。补测试：`restoreFromSave` + affector 匹配项（读档后 flows/zoneModifiers/addResource 均恢复）。
- **4.2 初始状态挂载**（严重）：`init()` 流程末尾扫描初始状态物品/强化/Spot 功能，统一 mount。
- **4.3 Effect[] 每 tick 执行类型失配**（严重）：方案 A 单独定义 `perTickEffects`（或等价），从类型上禁止一次性 op 进入持续期；方案 B（最小改）在 `applyActiveEffects` 拒绝对 addItem/grantCharacter/unlockInit/triggerStory/addEnhancement 的每 tick 执行并 DevLog 警告。**优先方案 A**。
- **4.4 flow 与 effects[addResource] 双通道**（中）：明确语义——flows 是唯一持续产出通道，addResource 只做 edge-triggered 一次性发放；文档写明并存即双倍。可选：数据包层面校验。
- **4.5 mount 幂等**（中）：重复 mount 已存在实例时改为 recheck 而非覆盖（或先 unmount 再 mount，保证不重复发放 addResource）。
- **4.6 entry id 唯一性校验**（中）：`load` / `registerPack` 时校验 pack 内 entry id 唯一，重复则 DevLog 警告。
- **4.7 getSpotMaxLevelOverrides 缓存**（中，可选）：构建 maxLevel 反查索引，避免每次全量扫描。
- 验收：`npm test` 全绿；新增 4.1/4.3 回归测试；存档往返测试覆盖 Affector。

### Phase 5 — 精确失效：懒求值真正跨帧（[G][R] 主题 3，核心收益）

**目标**：跨帧只重算受影响子树。

- 删除 `game-instance.tick` 每帧无条件 `invalidateProduction()`（game-instance.ts:478）。
- 依赖事件驱动失效（订阅已全部存在，game-num.ts:96-116）：
  - `resourceChanged` → 按 Phase 3 细化的依赖只失效读资源的 gain 子树。
  - `spotLevelChanged` / `spotTagChanged` / `enhancementAdded` / `enhancementRemoved` / `managerChanged` / `extraChanged` → 定向或全树失效（保留 `markDirty` 的 parents 传播）。
- **正确性审计（最大风险）**：逐条核对 `StateMutationService` 所有写路径是否发射对应事件：
  - 写 spotLevels → `spotLevelChanged`？写 tags → `spotTagChanged`？写 resources → `resourceChanged`？写 extra → `extraChanged`？写 spotManagers → `managerChanged`？写 unlockedEnhancements → `enhancementAdded`？
  - [R] **资源写路径审计**：`changeResource` / `setResource` 已发 `resourceChanged`（state-mutation-service.ts:111-124）；核对 `effect-ops` 的 `addResource`、`loot-system` 掉落、`init-service` 购买结算是否都走 `changeResource`。任何绕过点都产生陈旧读数。
  - Affector 状态翻转 → 是否触发对应失效（`affectorStateChanged` 订阅）。
- **加「陈旧读」回归测试**：对每种 mutation API：先求值 → 变更 → 断言 `evaluateResourceGain` 立即反映新值（不经整树失效）。
- **回退方案（若审计失败）**：保留每帧失效，删除 `parents` 索引与定向传播（接受「帧内缓存」），交付说明写明选择。
- 验收：`npm test` 全绿；陈旧读测试覆盖全部 mutation 写路径；tick 循环多帧后数值与 Phase 0 基线一致。

### Phase 6 — 未来树结构落地（[G][A][R] 主题 7，tree-design.md）

**前置**：Phase 1 已删 childMulMap；Phase 3 已收敛表达式。

- 决策项先定（§6 决策项 1/2/3）。
- buildAll 改为显式四级层级树：
  - `primitiveGain:<res>` → `globalProduct(mul)` / `globalFlat` / `globalFlows`
  - `init:<initId>` → `initProduct(mul)` / `initFlat` / `initFlows`（含 `area:<areaId>` 聚合）
  - `area:<areaId>` → `areaProduct(mul)` / `areaFlat` / `areaFlows` / `areaOwn` / `enhGains`（含 `spot:<spotId>`）
  - `spot:<spotId>` → `spotProduct(mul)` / `spotFlat` / `spotFlows` / `spotBase`（baseYield + levelLinear + baseAdd）
- DAG 共享 `spotBase` / `areaBase`（parents 表已支持多父）。
- 删除隐式 `linkHierarchy` 通道（被显式层级替代）。
- [A] Affector flows 按 `mountEntityId` 分发到对应层级 flows 节点；`evaluateSpotAffectorFlows` / `evaluateResourceAffectorFlows` 合并为一个带层级过滤器的扫描（或明确分工）。
- [R] `getSpotMultiplier` 按决策项 3 修正/删除；UI 读数（view-builder / init-service）改用精确节点。
- 更新 `game-num-snapshot.test.ts` 的 hierarchy 相关快照（area×init 组内相加 → 新结构语义）。
- 验收：`npm test` 全绿；旧 hierarchy 快照更新后全绿；`getSpotMultiplier` 语义与注释一致。

### Phase 7 — 死代码清理（[G][A] 主题 6）

- [G] `named` 注册表：无消费者 → 删除（若保留需写明理由）。
- [G][A] `clearTagEffectsByLife` + `life` 字段：三选一——接线 / 删除 / 保留标注。按 AGENTS.md「不做存档迁移」，**倾向删除**：
  - `TagEffectRecord.life`（tag-effect.ts:29，PlayerState 内部字段）。
  - `ZoneModifierDecl.life`（tag-effect.ts:59，**数据包字段**，删除后必须 `npm run gen:schema` 并检查 `editor-extras.ts`）。
  - `AffectorPackBuilder.modTag/modEntity` 的 life 参数（affector-pack.ts:49,60）。
  - 与 Phase 1 顺序：life 在 state 表清理后删除更干净（Phase 7 在 Phase 1 之后，顺序满足）。
- [A] `AffectorPackDef.persistent`（trigger.ts:38）：删除，同步 schema。
- [G] `zoneNodeById` → 收敛为 `buildZoneNode` 局部去重。
- [G] `toValueNode` 随机 id：随 Phase 1 消失；如仍存在改确定性生成。
- [A] `modTag`/`modEntity` 支持 ValueExpression（04h §4.3）；`describeValue` 参数名修正（04h §4.2）。
- 验收：`npm test` + `npx tsc --noEmit` 全绿；grep 确认无残留引用；删除数据包字段则 schema 已同步。

### Phase 8 — 收尾

- 同步文档：
  - `docs-824/02c-tick-loop.md`：capacity 语义、失效策略（每帧失效已移除）。
  - `docs-824/04b-production.md`：单一真相（state 表）、zone 求值路径、四级层级树。
  - `docs-824/04f-trigger-effect.md`：Affector 桥接简化、flows 层级分发。
  - `docs-824/04h-affector-review.md`：标记已修复项（§1.1/1.2/1.3/2.3/3.x）。
  - `todoTask/taskGameNum/TASK.md`：标记完成状态；`tree-design.md`：落地后标记「已实现」。
  - 本任务书：执行后标记完成状态。
- 全量验证：`npm test` 全绿 + `npx tsc --noEmit` 通过 + `npm run build`（如可行）。
- 提交（如仓库允许）：分阶段 commit，每阶段一个，message 说明清理内容与验收结果。

---

## 4. 约束与纪律（必须遵守）

- 阅读并遵守仓库根目录 `AGENTS.md`：单一写入口（所有状态变更走 `StateMutationService`）、事件驱动、测试先行（`npm test` 通过才算完成）、**不做存档迁移/版本兼容代码**。
- 改引擎机制前先读 `docs-824/02-run-logic.md` 及 02a-e；改数据结构前先读 `docs-824/03-data-structures.md` 及 03a-e。
- 改 `src/engine/types/` 的数据包字段后必须 `npm run gen:schema`（本任务涉及：`ZoneModifierDecl.life`、`AffectorPackDef.persistent` 若删除）。
- 禁止修改：`dist/` / `web-dist/` / `src/ui/dist/` / `node_modules/` / `tools/datapack-editor/schema/engine-defs.gen.json`（生成产物，改源头后重新生成）。
- 默认不写注释；只在 WHY 非显而易见时写。
- **行为保持**：除测试已显式声明的语义外，所有游戏数值结果不变。每完成一个 Phase 先跑测试再进入下一 Phase。
- 语义变更（如同组乘区合并、getSpotMultiplier 修正）必须在交付说明中写明理由，并同步更新快照测试。

---

## 5. 交付物清单

1. 代码变更（分 Phase commit）。
2. `todoTask/taskProduction/` 下新增 `REPORT.md`，包含：
   - 每 Phase 的实际改动摘要（文件 + 行为变化）。
   - §6 决策项的每项选择及理由；Phase 5 是否启用精确失效（或回退方案）及理由。
   - 删除的 API / 字段清单（含原文件:行号）。
   - 测试结果（`npm test` / `npx tsc --noEmit` 输出摘要）。
   - 遗留风险与后续建议。
3. 文档同步（Phase 8 所列文件）。

---

## 6. 决策项（必须在相关 Phase 前定，且写入 REPORT）

| # | 决策 | 选项 | 建议 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 同乘区组多条记录合并语义 | A. 组内 `1+Σ(f-1)` 加法（当前 childMulMap 路径）<br>B. `Πf` 连乘（当前 aggregateZone 路径） | **B**（连乘直觉更符合「提升 x%」语义；Phase 1 统一为 aggregateZone 后实现最简） | Phase 1 / 6；改变真实数值（如 credit_printer 多全局强化 2.0 → 2.34375） |
| 2 | `globalMul` 乘什么 | A. `Σ initFull`（完整值，含各层 flat）<br>B. `Σ initBase`（纯 base 链） | **A**（全局倍率通常作用于最终产出） | Phase 6 树构建 |
| 3 | `getSpotMultiplier` 去向 | A. 删除<br>B. 改为 `evaluate(spotMulZone)` 精确语义（不含 hierarchy）<br>C. 改为 `evaluate(spotProduct)`（含 hierarchy） | **B 或 C**（先查 UI 调用方再定；当前无 UI 消费则倾向 A） | Phase 6；需查 UI 调用方 |

---

## 7. 验收标准（最终）

- [ ] `npm test` 全绿（vitest），`npx tsc --noEmit` 通过。
- [ ] `grep childMulMap`：仅剩（如需）定义与清理后无残留投影逻辑。
- [ ] `tick-system.ts` 无旧逐 Spot 路径、无 `aggregateZone` 直接调用（或经 GameNumSystem 唯一入口）。
- [ ] GameNum kind 缩减至构建实际使用集合（方案 A）或有明确分工文档（方案 B）。
- [ ] `gainsMayReadResource` 无 JSON.stringify，且粒度到按 gain 子树。
- [ ] 每帧不再无条件整树失效；陈旧读回归测试覆盖全部 mutation 写路径。
- [ ] Affector 存档恢复/初始挂载有回归测试；`Effect[]` 每 tick 执行陷阱已修（perTickEffects 或最小守卫）。
- [ ] 死 API（named / clearTagEffectsByLife / life / persistent）已删除或标注理由。
- [ ] 未来树结构（显式层级 + baseAdd/enhGains/areaOwn）已落地或明确搁置理由。
- [ ] 文档已同步；`REPORT.md` 已填写。