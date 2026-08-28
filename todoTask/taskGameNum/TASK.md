# taskGameNum — GameNum 冗余清理任务书

> 本任务书为后续执行 agent 的**唯一输入**，自包含，无需依赖原会话上下文。
> 仓库根目录：`C:\Users\15229\Documents\Obsidian Vault\1-项目\ACProgram`（git 仓库，分支 main）。

==new== **状态：全部完成（Phase 0–6）。** 实际执行按 `todoTask/taskProduction/` 的 Phase 1–7 落地，交付细节以 `todoTask/taskProduction/REPORT.md` 为准。本任务书 Phase 0→taskProduction Phase 0（行为快照）；Phase 1→taskProduction Phase 1（删 childMulMap 投影）；Phase 2→taskProduction Phase 2（删旧 tick 路径）；Phase 3→taskProduction Phase 3（收敛双表达式，选方案 A）；Phase 4→taskProduction Phase 5（事件驱动精确失效）；Phase 5→taskProduction Phase 7（死代码清理）；Phase 6→taskProduction Phase 4/6/8（Affector 正确性、四级层级树、文档同步）。

---

## 0. 任务目标（一句话）

**清理 GameNum 系统的冗余结构，把它收敛为「干净的、跨帧懒求值的生产结算树」；数值变动后只重算受影响子树，是系统存在的唯一理由。**

执行准则（贯穿全程）：

1. **单一真相**：每份数据只有一种表示（当前 zone 修饰数据存了三份，需归一）。
2. **单一路径**：生产结算只有一条执行路径（当前 tick 有两条，需合并）。
3. **失效精确化**：懒求值要真的懒——跨帧只重算受影响子树，不做每帧整树置脏。
4. **删死代码**：无消费者即删，不做「预留」。
5. **不改语义**：除测试中已显式声明的行为（如 capacity 不再截断）外，所有数值结果必须保持不变。

---

## 1. 系统背景（现状速览，供 agent 快速进入）

GameNum 是统一生产结算系统：把「每个资源的每 tick 产出」建模为懒求值数值树。

### 文件地图

| 文件 | 职责 |
| --- | --- |
| `src/engine/expression/game-num.ts` | `GameNumSystem` 门面宿主：事件订阅、索引字段、查询入口 |
| `src/engine/expression/game-num-eval.ts` | `GameNum` 节点类型（17 种 kind）+ 纯求值 `evaluateGameNum` + 溯源 `evaluateGameNumBreakdown` |
| `src/engine/expression/game-num-build.ts` | `buildAll` 建树：primitiveGain / spot 子树 / zone 节点 / zoneIndex / 层级链接 |
| `src/engine/expression/game-num-tag.ts` | 区表写入 + Affector 桥接（`registerTagEffect` / `syncAffectorZoneEffects`） |
| `src/engine/expression/game-num-internal.ts` | 内部共享类型（ZoneNode / MulNode / ZoneIndexEntry） |
| `src/engine/expression/tag-effect.ts` | `TagEffectRecord` / `ZoneModifierDecl` / `EntityRef` / `entityKey` / `tagPrefixesBottomUp` |
| `src/engine/system/tick-system.ts` | 每 tick 生产结算（**含两条路径，见问题 1**） |
| `src/engine/effect/affector-engine.ts` | Affector 生命周期 + `syncAffectorZoneEffects` 每 tick 调用方 |
| 相关文档 | `docs-824/04b-production.md`（生产结算）、`docs-824/04h-affector-review.md`（Affector 评审，含关联问题）、`docs-824/04f-trigger-effect.md` |

### 树结构（每资源一棵）

```
primitiveGain:<res> (add)                 ← tick 结算入口（evaluateResourceGain）
├── spot:<spotId> (mul)                   ← 每个产该资源的 Spot 一棵子树
│   ├── owned                             0/1（spotLevels>0）
│   ├── baseLine (add)
│   │   ├── baseYield (add)
│   │   │   ├── base (expr → ValueExpression)
│   │   │   └── levelLinear               (N-1)×yieldPerLevel
│   │   └── flatZone (zone flat)
│   ├── mulZone (zone mul, childMulMap: defaultMul/defaultAddMul/hierarchy)
│   └── （hierarchy 通道：(areaZone-1)、(initZone-1)，Area/Init 乘区逐级上抛）
└── affectors:<res> (affectorFlows)       活跃 Affector 的 flows 懒求值
```

==new== 上图是立项时的旧结构（spot 子树直接挂在 primitiveGain 下、含 `childMulMap`）。清理后实作为显式四级层级树：`primitiveGain:<res> = globalProduct(×globalMulZone) + globalFlat + globalFlows`，其下 `initFull = (Σ areaProduct) × initMulZone + initExtra`，`areaFull = (Σ spotProduct) × areaMulZone + areaExtra`，`spotFull = spotBase × spotMulZone + spotExtra`；乘区只乘下一级 base 链，flat/flows 不进乘区（经 Extra 直加）。权威图示见 `tree-design.md` §2 与 `docs-824/04b-production.md`。

### 关键机制

- **求值**：`evaluateGameNum` 递归，节点级 `dirty`/`cached` 两级缓存（`useCache=false` 时跳过，溯源用）。
- **乘区语义**：统一「1+Σ(fᵢ-1) ≡ Πfᵢ」，乘区贡献以 (f-1) 存入 `zoneNode.childMulMap`。
- **区表**：`buildZoneNode` 为 scope(spot/area/init)×part(flat/mul)×resource 建 zone 节点；`zoneIndex` 按「tag 前缀自下而上 + entityKey」建反路由；`registerTagEffect` 把记录写进 `state.tagEffects` 并路由进 zone 节点 `childMulMap`。
- **失效**：事件驱动（enhancementAdded/spotTagChanged/spotLevelChanged/managerChanged/extraChanged/resourceChanged）+ `game-instance.tick` 每帧无条件 `invalidateProduction()`（全树置脏）。
- **Affector 桥接**：`syncAffectorZoneEffects`（game-num-tag.ts:172-191）在 `applyActiveEffects` 每 tick 全量「先按 source 撤销、再重注册」。

==new== **实作修正（清理后现状）**：上列「关键机制」描述的是任务立项时的旧状，Phase 1–7 后已变——
- 节点 kind 由 17 种收敛为 9 种（`add/sub/mul/const/expr/owned/levelLinear/zone/affectorFlows`，删 div/min/max/pow/clamp/floor/ceil/round/cond）。
- `childMulMap` 投影机制整体删除，zone 求值统一走 `aggregateZone` 扫 `state.tagEffects`/`entityEffects` 单一真相；`zoneIndex` 降级为定向失效索引。
- 树结构升级为显式四级层级树（global→init→area→spot 逐级连乘，乘区只乘下一级 base 链，flat/flows 经 Extra 直加），详见 `docs-824/04b-production.md` 与 `tree-design.md`。
- 每帧 `invalidateProduction()` 已删除，改为事件驱动三路定向失效（`gainResourceDeps`/`zoneKeyResourceDeps`/`flowsResourceDeps`）。
- `syncAffectorZoneEffects` 不再每 tick 全量重建，改由挂载/卸载/状态对账事件驱动；`applyActiveEffects` 每 tick 仅执行 `perTickEffects`，`effects` 在激活沿边沿触发。
- `named` 注册表、`clearTagEffectsByLife`、`life` 字段、`AffectorPackDef.persistent`、`zoneNodeById` 字段均已删除。

---

## 2. 已识别问题清单（含证据，按清理归属分组）

### 问题组 A：双生产路径并存（tick-system.ts）

- GameNum 路径（tick-system.ts:52-63）：`evaluateResourceGain` 每资源入账——**运行时实际走这条**（GameInstance 始终注入 gameNumSystem）。
- 旧路径（tick-system.ts:65-99）：逐 Spot 结算，`baseYield × aggregateZone 倍率 + baseCapacity 容量夹取`，注释称「无 GameNum 时，供单元测试直用」。
- 语义已分叉：旧路径有 `baseCapacity` 夹取，GameNum 路径没有——且这是**有意**的（`tests/engine/spot-functionality.test.ts:81-86` 注释「spot capacity 不再截断 gain」）。
- 测试承重墙：`tests/engine/tick-system.test.ts` 共 7 处 `new TickSystem(reg, vs, bus)`（不带 gameNumSystem），全部依赖旧路径。
- 附带：GameNum 路径 `productions.push({ spotId: resource, ... })`（tick-system.ts:58）spotId 填的是资源名，语义错位。

### 问题组 B：同一份 zone 修饰数据存三份表示

1. `state.tagEffects` / `state.entityEffects`（`PlayerState` 顶层字段，state.ts:50,56，随存档持久化）。
2. `zoneNode.childMulMap`（内存投影，求值主路径；写入方 `game-num-tag.ts:91-168` 的 `routeToZoneNodes`/`addContribution`/`applyBound`/`removeContribByKey`，约 80 行镜像机制）。
3. `aggregateZone`（game-num-eval.ts:122-165）实时扫描 state 表——`zoneValue` 的兜底路径，**正常不可达**（`buildZoneNode` 无条件初始化 childMulMap，game-num-build.ts:127）；仅被旧 tick 路径与测试直接调用。

### 问题组 C：双失效策略叠加

- `game-instance.tick`（game-instance.ts:478）每帧 `invalidateProduction()` → `markAllDirty` 全树置脏 → 节点级缓存只在本帧内有效。
- `parents` 父链 + 定向 `markDirty` 传播（game-num-tag.ts 路由时用）被每帧全量失效盖掉，几乎无意义。

### 问题组 D：双表达式系统

- `GameNum` 17 种 kind 中，**9 种从未被 buildAll 构造**：`min/max/pow/div/clamp/floor/ceil/round/cond`。
- 它们只在 5 处被维护：类型联合（game-num-eval.ts:50-60）、`switchEval`（game-num-eval.ts:203-274）、`evaluateGameNumBreakdown`（game-num-eval.ts:281-374）、`collect`（game-num-build.ts:198-212）、`gainsMayReadResource` walk（game-num-build.ts:216-241）。
- **注意**：它们有测试直接构造求值（`tests/engine/game-num.test.ts:196-226`，用 `sys.evaluate(...)` 验证 div/min/max/pow/floor/round/clamp/cond）。
- `ValueExpression`（`expr` 节点内嵌）已完整支持全部算术/夹取/取整——GameNum 原生重实现了一套。

### 问题组 E：依赖分析用字符串 hack

- `gainsMayReadResource`（game-num-build.ts:216-241）：对每个 `expr` 节点 `JSON.stringify(n.expr).includes('"source":"res"')` 判断是否读资源。
- 脆弱（依赖序列化格式）、昂贵（全树序列化）、结论粗（全树布尔：任何一处读资源 → 所有 `resourceChanged` 整树失效）。
- 项目已有先例：`src/engine/expression/condition-deps.ts` 的类型化静态依赖收集。

### 问题组 F：死 API / 死字段

- `named` 注册表：`register` / `evaluateByName` / `evaluateByNameWithBreakdown` / `getNamedNumbers` / `hasNamed`（game-num.ts:59,205-220）——**全库无调用方**。
- `clearTagEffectsByLife`（game-num-tag.ts:77-89 + game-num.ts:167-169）——**全库无调用方**；`TagEffectRecord.life` 三档语义无人执行。
- `zoneNodeById`（game-num.ts:77）：仅 `buildZoneNode` 内部去重用。
- `toValueNode` 随机 id（game-num-tag.ts:142）：`Math.random().toString(36)` 非确定性生成。

### 问题组 G：双 flows 求值入口（低优先）

- `evaluateResourceAffectorFlows`（按资源，game-num-eval.ts:394-408）vs `evaluateSpotAffectorFlows`（按 spot，game-num-eval.ts:377-391）——两处对活跃实例做平行扫描。

### 关联背景（同一批评审发现的 Affector 问题，见 `docs-824/04h-affector-review.md`）

- Affector 实例不跨存档、读档后全部丢失（严重，但**本任务不修**，仅不得恶化）。
- `syncAffectorZoneEffects` 每 tick 全量重建（与问题组 B 同根，本任务统一收敛）。
- `AffectorPackDef.persistent` 死字段、`SpotFunctionalityDef.id` 作 pack 命名空间键（本任务不修）。

---

## 3. 执行 Roadmap（按序执行；Phase 0→1→4 有强依赖，2/3/5 可穿插）

### Phase 0 — 行为快照（前置保险，先做）==new== ✅ 已完成

**目标**：把当前语义锁进测试，保证后续每步可回归。

- 扩充 `tests/engine/game-num.test.ts`（或新增对拍测试文件）：
  - zone 聚合全覆盖：flat / mul / custom（按 multiplierId 分组）/ bound（跨 source 合并：min 取 max、max 取 min）。
  - Area/Init hierarchy 逐级上抛：对 Area/Init tag 的 mul 修饰作用于其下所有 Spot。
  - flows：`evaluateResourceAffectorFlows` 与 `evaluateSpotAffectorFlows` 各自语义。
  - **两条聚合路径等价性对拍**：同一组 `registerTagEffect` 写入后，`evaluateGameNum(zoneNode)`（childMulMap 路径）与 `aggregateZone(...)`（state 表路径）结果必须一致——这是 Phase 1 的安全网。
  - 每帧失效行为：`invalidateProduction` 后结果仍正确（Phase 4 前保持现状断言）。
- 验收：`npm test` 全绿；新增对拍测试在 Phase 1 前先红后绿的标记（或直接全绿作为基线）。

### Phase 1 — 统一区表真相：删 childMulMap 投影（核心结构清理）==new== ✅ 已完成（zone 求值统一走 `aggregateZone` 扫 state 表；`zoneIndex` 降级为定向失效索引）

**目标**：`state.tagEffects` / `state.entityEffects` 成为**唯一真相**；zone 求值统一走 state 表扫描；`zoneIndex` 保留，降级为**定向失效索引**。

- **删除**：
  - `game-num-tag.ts:91-168` 全部投影机制：`routeToZoneNodes` / `addContribution` / `applyBound` / `removeContribByKey`。
  - `removeTagEffectsBySource`（game-num-tag.ts:44-75）中遍历 `zoneNodes`/`childMulMap` 的镜像撤销半边（保留 state 表清理 + `markAllDirty` 或定向 markDirty）。
  - `zoneValue` 的 childMulMap 分支（game-num-eval.ts:168-190），仅保留兜底 `aggregateZone` 路径。
  - `mul` 节点求值中的 `childMulMap`/`bound` 分支（game-num-eval.ts:216-229）——若不再有节点挂载区，一并删除。
- **保留**：`zoneIndex`（register/remove 时反查 zone 节点 → 定向 `markDirty`，这是懒求值失效的核心）、`markDirty`/`markAllDirty`/`parents`、`aggregateZone` 聚合逻辑。
- **语义迁移注意**：`aggregateZone` mul 路径是 `product *= v`（v 为原始因子 f），childMulMap 路径是 `1+Σ(f-1)`，两者等价——迁移后统一为 `aggregateZone` 语义。
- 验收：Phase 0 对拍测试全绿；`registerTagEffect` 后无需 `routeToZoneNodes` 调用；grep 确认 `childMulMap` 仅剩定义与（如需）build 初始化残留清零。

### Phase 2 — 单生产路径：删旧 tick 路径 ==new== ✅ 已完成（`tick-system.ts` 仅剩 GameNum 一条路径；`productions.push` 的 spotId 标签错位一并修正）

**目标**：`tick-system.ts` 只有 GameNum 一条结算路径。

- 把 `tests/engine/tick-system.test.ts` 的 7 处 `new TickSystem(reg, vs, bus)` 改为注入 `GameNumSystem`（参考该测试文件内其他已注入的用例，或 `game-instance` 的组装方式）。
- **删除** `tick-system.ts:65-99` 旧路径及其 `aggregateZone` 直接调用、`baseCapacity` 夹取分支。
- 把「capacity 不再截断 gain」语义写进 `docs-824/02c-tick-loop.md` 与测试断言（`spot-functionality.test.ts:86` 已有声明，需固化防回归）。
- 修复 `productions.push({ spotId: resource, ... })`（tick-system.ts:58）标签错位。
- 验收：`npm test` 全绿；`tick-system.ts` 不再 import `aggregateZone`；`TickSystem` 构造函数中 gameNumSystem 变为必传（或保持可选但旧路径删除后无退化分支）。

### Phase 3 — 收敛双表达式系统 ==new== ✅ 已完成（选**方案 A**：删除 9 个未构造 kind，GameNum 收敛至 `add/sub/mul/const/expr/owned/levelLinear/zone/affectorFlows`；`gainsMayReadResource` 重写为类型化 `gainResourceDeps` 依赖扫描，无 JSON.stringify）

**目标**：GameNum 与 ValueExpression 不再维护两套算术求值。

- **方案 A（推荐，结构最小化）**：`GameNum` 只保留 buildAll 实际构造的 8 种 kind：`const/expr/add/sub/mul/owned/levelLinear/zone/affectorFlows`。删除 `min/max/pow/div/clamp/floor/ceil/round/cond`：
  - 从类型联合（game-num-eval.ts:50-60）、`switchEval`、`evaluateGameNumBreakdown`、`collect`（game-num-build.ts:198-212）、`gainsMayReadResource` walk 五处移除。
  - 删除 `tests/engine/game-num.test.ts:196-226` 对应的求值测试（div/min/max/pow/floor/round/clamp/cond）。
  - 通用算术一律经 `expr` 节点走 ValueExpression（构建时如有需要，用 `Expr` 工厂或内联 ValueExpression）。
- **方案 B（保守）**：不删，但在 game-num-eval.ts 头部注释明确「GameNum 是通用数值树求值器，ValueExpression 是数据包声明语言，两者分工如下…」，并写进 04b 文档。**二选一，需在交付说明中写明选择了哪个及理由。**
- **同一 Phase 必做**：重写 `gainsMayReadResource`（game-num-build.ts:216-241）为类型化静态扫描（参考 `condition-deps.ts` 的 walk 风格），并细化粒度为**按 gain 子树**（每个 primitiveGain 根节点一个布尔，或每个依赖资源一个集合），为 Phase 4 铺路。
- 验收：`npm test` 全绿；grep 确认无残留 kind 构造；`gainsMayReadResource` 无 JSON.stringify。

### Phase 4 — 让懒求值真正跨帧：精确失效（核心收益，放最后）==new== ✅ 已完成（删除 `game-instance.tick` 每帧 `invalidateProduction()`；`resourceChanged` 三路定向失效 `gainResourceDeps`/`zoneKeyResourceDeps`/`flowsResourceDeps`；陈旧读回归测试覆盖全部 mutation 写路径）

**目标**：跨帧只重算受影响子树。

- **删除** `game-instance.tick` 每帧无条件 `invalidateProduction()`（game-instance.ts:478）。
- 依赖事件驱动失效（订阅已全部存在，game-num.ts:96-116）：
  - `resourceChanged` → 按 Phase 3 细化的依赖只失效读资源的 gain 子树（`mayReadResources` 布尔可删除或细化）。
  - `spotLevelChanged` / `spotTagChanged` / `enhancementAdded` / `enhancementRemoved` / `managerChanged` / `extraChanged` → 定向或全树失效（保留 `markDirty` 的 parents 传播）。
- **正确性审计（本 Phase 最大风险）**：逐条核对 `StateMutationService` 所有写路径是否发射对应事件：
  - 写 spotLevels → `spotLevelChanged`？写 tags → `spotTagChanged`？写 resources → `resourceChanged`？写 extra → `extraChanged`？写 spotManagers → `managerChanged`？写 unlockedEnhancements → `enhancementAdded`？affector 状态翻转 → 有对应失效？
  - 任何遗漏都会产生陈旧读数，必须补事件或补显式失效。
- **加「陈旧读」回归测试**：对每种 mutation API：先求值 → 变更 → 断言 `evaluateResourceGain` 立即反映新值（不经整树失效）。
- **回退方案（若审计失败）**：保留每帧失效，删除 `parents` 索引与定向传播（接受「帧内缓存」），在交付说明中写明选择。
- 验收：`npm test` 全绿；陈旧读测试覆盖全部 mutation 写路径；tick 循环多帧运行后数值与 Phase 0 基线一致。

### Phase 5 — 死代码清理 ==new== ✅ 已完成（对应 taskProduction Phase 7：删 `named` 注册表、`clearTagEffectsByLife` + `life` 字段、`AffectorPackDef.persistent`、`zoneNodeById`（降为 build 模块 WeakMap 局部去重）；`modTag`/`modEntity` 支持 `ValueExpression`；`describeValue` 参数名 `spotCount`→`areaSpotCount`；已 `gen:schema` 同步）

- `named` 注册表（game-num.ts:59,205-220）：无消费者 → 删除（若保留，需在交付说明中写明理由）。
- `clearTagEffectsByLife` + `life` 字段：三选一——接线（Init 切换/savepoint 时清理）、删除、保留标注。按 AGENTS.md「不做存档迁移」，**倾向删除**：
  - `TagEffectRecord.life`（tag-effect.ts:29，PlayerState 内部字段，不涉及数据包 schema）。
  - `ZoneModifierDecl.life`（tag-effect.ts:59，**是数据包字段**，删除后必须 `npm run gen:schema` 同步并检查 `editor-extras.ts` 是否需要兜底）。
  - `AffectorPackBuilder.modTag/modEntity` 的 life 参数（affector-pack.ts:49,60）。
  - 注意与 Phase 1 的顺序：life 字段在 state 表清理后删除更干净。
- `zoneNodeById`（game-num.ts:77）→ 收敛为 `buildZoneNode` 局部去重。
- `toValueNode` 随机 id：随 Phase 1 的 childMulMap 消失；如仍存在则改确定性生成。
- 验收：`npm test` + `npx tsc --noEmit` 全绿；grep 确认无残留引用；如删数据包字段则 schema 已同步。

### Phase 6 — 收尾 ==new== ✅ 已完成（文档同步见 taskProduction Phase 8；flows 双入口问题组 G 经 Phase 6 层级分发收敛为按 `mountEntityId` 单层扫描）

- 评估双 flows 求值入口（问题组 G）是否合并为一个带过滤器的扫描函数（可选，低优先）。
- 同步文档：
  - `docs-824/02c-tick-loop.md`：capacity 语义、失效策略（每帧失效已移除）。
  - `docs-824/04b-production.md`：单一真相（state 表）、zone 求值路径。
  - `docs-824/04f-trigger-effect.md`：Affector 桥接简化。
  - `docs-824/04h-affector-review.md`：更新已修复项。
  - 本任务书（`todoTask/taskGameNum/TASK.md`）：执行后标记完成状态。
- 全量验证：`npm test` 全绿 + `npx tsc --noEmit` 通过 + `npm run build`（如可行）。
- 提交（如仓库允许）：分阶段 commit，每阶段一个，message 说明清理内容与验收结果。

---

## 4. 约束与纪律（必须遵守）

- 阅读并遵守仓库根目录 `AGENTS.md`：单一写入口（所有状态变更走 `StateMutationService`）、事件驱动、测试先行（`npm test` 通过才算完成）、**不做存档迁移/版本兼容代码**。
- 改引擎机制前先读 `docs-824/02-run-logic.md` 及 02a-e；改数据结构前先读 `docs-824/03-data-structures.md` 及 03a-e。
- 改 `src/engine/types/` 的数据包字段后必须 `npm run gen:schema`（本任务涉及：`ZoneModifierDecl.life` 若删除）。
- 禁止修改：`dist/` / `web-dist/` / `src/ui/dist/` / `node_modules/` / `tools/datapack-editor/schema/engine-defs.gen.json`（生成产物，改源头后重新生成）。
- 默认不写注释；只在 WHY 非显而易见时写。
- **行为保持**：除测试已显式声明的语义（capacity 不截断）外，所有游戏数值结果不变。每完成一个 Phase 先跑测试再进入下一 Phase。
- 本任务**不修** Affector 的存档持久化问题（见 `docs-824/04h-affector-review.md` §1.1），只做与本任务直接相关的结构收敛；如清理过程中发现必须触碰，需在交付说明中单独报告。

## 5. 交付物清单

1. 代码变更（分 Phase commit）。
2. `todoTask/taskGameNum/` 下新增 `REPORT.md`，包含：
   - 每 Phase 的实际改动摘要（文件 + 行为变化）。
   - Phase 3 的方案选择（A/B）及理由；Phase 4 是否启用精确失效（或回退方案）及理由。
   - 删除的 API / 字段清单（含原文件:行号）。
   - 测试结果（`npm test` / `npx tsc --noEmit` 输出摘要）。
   - 遗留风险与后续建议。
3. 文档同步（Phase 6 所列文件）。

## 6. 验收标准（最终）

==new== **全部达成（918 tests 全绿 / tsc 通过 / gen:schema 同步）：**

- [x] `npm test` 全绿（vitest），`npx tsc --noEmit` 通过。==new==
- [x] `grep childMulMap`：仅剩（如需）定义与清理后无残留投影逻辑。==new== 投影机制整体删除，零残留。
- [x] `tick-system.ts` 无旧逐 Spot 路径、无 `aggregateZone` 直接调用（或经 GameNumSystem 唯一入口）。==new==
- [x] GameNum kind 缩减至构建实际使用集合（方案 A）或有明确分工文档（方案 B）。==new== 选方案 A，收敛至 9 种 kind。
- [x] `gainsMayReadResource` 无 JSON.stringify。==new== 重写为类型化 `gainResourceDeps`。
- [x] 每帧不再无条件整树失效；陈旧读回归测试覆盖全部 mutation 写路径。==new==
- [x] 死 API（named / clearTagEffectsByLife / life 字段）已删除或标注理由。==new== 另删 `AffectorPackDef.persistent`、`zoneNodeById` 字段。
- [x] 文档已同步；`REPORT.md` 已填写。==new== 见 taskProduction Phase 8 文档同步。
