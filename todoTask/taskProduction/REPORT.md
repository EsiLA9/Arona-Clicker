# REPORT — taskProduction 执行报告

> 按 `TASK.md` §5 交付物要求记录：每 Phase 实际改动、决策项选择、删除清单、测试结果。
> 随 Phase 推进增量更新。

---

## Phase 0 — 行为快照 ✅

- commit `1faf5c3`：`tests/engine/game-num-snapshot.test.ts`（32 tests）锁定 zone 聚合、hierarchy、双路径对拍、flows 双入口、失效行为基线。

## Phase 1 — 统一区表真相：删 childMulMap 投影 ✅

commit `b558235`。

### 实际改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/expression/game-num-tag.ts` | 整文件重写：删除 `routeToZoneNodes` / `addContribution` / `applyBound` / `toValueNode`（随机 id）/ `removeContribByKey` 全部投影机制；register/remove 只写 state 表 + 定向 `markDirty`（经 zoneIndex 反查） |
| `src/engine/expression/game-num-eval.ts` | `aggregateZone` mul 路径改分桶语义；`zoneValue` 删 childMulMap 分支；`mul` 节点求值删 childMulMap/bound 处理；`GameNum` 联合类型删相关字段 |
| `src/engine/expression/game-num-build.ts` | `buildZoneNode` 删 childMulMap 初始化；`buildSpotProduction` 删预置组、hierarchy 显式化为 `hierarchy:<spotId>` add 节点；删 `linkHierarchy` |
| `src/engine/expression/game-num-internal.ts` | 删 `MulNode` 类型 |
| `src/engine/game-instance.ts` | 三处 `setState` 回调（startNewGame 路径 294-298 / restoreFromSave 852 / reset 861）改调 `gameNumSystem.buildAll(this._state)`，修复 GameNumSystem.state 陈旧引用 bug |
| `tests/engine/game-num-snapshot.test.ts` | 4 处语义统一：custom 预期 16→24；KNOWN DIVERGENCE 三例并入「双聚合路径对拍」（同组 mul=2.5 加法 / 同 multiplierId custom=6 连乘 / 通配键=2 生效） |
| `tests/engine/game-num.test.ts` | spot subtree 结构断言补第 4 子节点 `hierarchy:<spotId>` |

### 决策项 1（定案）：同乘区组多条记录合并语义

**选择 B（连乘）+ mul/custom 分桶**（用户拍板）：

- `category: 'mul'`（默认乘区）→ 加法：`1 + Σ(f-1)`。
- `category: 'custom'` + multiplierId（手动乘区）→ 组内连乘 `Πf`、组间连乘。

现有数据包全部是单条 mul 记录，加法=连乘，现有游戏数值不变。

### 删除的 API / 字段

- `routeToZoneNodes` / `addContribution` / `applyBound` / `removeContribByKey` / `toValueNode`（game-num-tag.ts）
- `MulNode` 类型（game-num-internal.ts）；`linkHierarchy`（game-num-build.ts）
- `GameNum` 各节点的 `childMulMap` / `bound` 字段
- 遗留：`ZoneBound` 接口（eval.ts）已无消费者，Phase 7 删；build.ts `allEntitiesOfKind` 死代码，Phase 7 删。

### 回归测试说明

陈旧 state bug 未新增独立用例：原失败用例 `P1: enhancement production multiplier applies and refreshes on unlock/remove`（game-num.test.ts:152，走 startNewGame 后 addEnhancement/removeEnhancement）在修复后转绿，即为回归覆盖。

## Phase 2 — 单生产路径：删旧 tick 路径 ✅

commit `975c3a9`（Phase2Bef）。

### 实际改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/system/tick-system.ts` | 删 65-99 旧逐 Spot 路径（含 `aggregateZone` 直接调用与 `baseCapacity` 夹取分支）；`gameNumSystem` 构造参数从可选第 5 位改为**必传第 4 位**（mutations 之前）；`productions.push` 标签错位修复为 `spotId: ''`（resource 级聚合无单一 spot） |
| `tests/engine/tick-system.test.ts` | 7 处 `new TickSystem(reg, vs, bus)` 全部注入 `GameNumSystem`（`makeGameNumSystem` fixture）；`spotProduced` 事件断言改 `spotId: ''` |
| `src/engine/game-instance.ts` | TickSystem 构造实参顺序同步（gameNumSystem 第 4 位） |
| `docs-824/02c-tick-loop.md` | 新增「生产结算（tickSystem.run）」：单一路径说明 + capacity 不再截断 gain 的语义声明 |
| `tests/engine/spot-functionality.test.ts` | 81-86 已有「primitiveGain aggregates base + functionality without per-spot capacity cap」断言（固化防回归，本 Phase 复核确认在位） |

### 行为语义变化（显式声明）

- **capacity 不再截断 gain**：产出为 resource 级聚合（跨所有 spot），Spot 自身 `baseCapacity` 不再参与结算。需要容量上限语义应在数据包/数值层显式建模。文档已写入 `docs-824/02c-tick-loop.md`。
- `spotProduced` 事件 `spotId` 置空：消费者排查确认安全（`controller-events.ts:16` 显式忽略该事件；`dev-log.ts` 仅日志展示）。

### 删除的 API / 字段

- `TickSystem` 可选 gameNumSystem 退化分支（旧逐 Spot 结算路径整体）
- `tick-system.ts` 对 `aggregateZone` / `TagPath` 的 import

### 验收核验（本报告撰写时实测）

- `npm test`：88 文件 908 测试全绿。
- `npx tsc --noEmit`：通过。
- `findstr aggregateZone src\engine\system\tick-system.ts`：无匹配。
- `TickSystem` 构造函数 gameNumSystem 必传（无退化分支），全库 7 处调用点均已注入。

## Phase 3 — 收敛双表达式系统 ✅（方案 A）

### 决策项：方案选择

**选择方案 A（删除）**：GameNum 17 种 kind 中 9 种（`div` / `min` / `max` / `pow` / `clamp` / `floor` / `ceil` / `round` / `cond`）从未被 buildAll 构造，属纯算术重复实现；数据包作者的可选算术由 ValueExpression 完整覆盖（经 `expr` 叶子进入 GameNum 树）。`cond` 在 ValueExpression 无直接对应，但同样无构造点，删除无影响。

### 实际改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/expression/game-num-eval.ts` | 类型联合删 4 行（clamp/floor-ceil-round/cond 成员与 div/min/max/pow 字面量）；`switchEval` 删 9 个 case；`evaluateGameNumBreakdown` 删 9 个 case；头注释与 GameNum 文档注释同步 |
| `src/engine/expression/game-num-build.ts` | `collect` 子节点枚举简化为 add/sub/mul；`gainsMayReadResource`（JSON.stringify hack）整体删除，替换为类型化静态扫描 `gainResourceDeps`（`valueResourceDeps` / `exprResourceDeps` / `nodeResourceDeps` 三个纯函数），粒度到每个 primitiveGain 一个资源依赖集合 |
| `src/engine/expression/game-num.ts` | 新增 `gainResourceDeps = Map<string, Set<string>>` 字段（buildAll 填充）；`mayReadResources` 改为其派生布尔（任一 gain 依赖集非空），`resourceChanged` 订阅行为不变 |
| `tests/engine/game-num.test.ts` | 「组合算子」测试裁剪为 add/sub/mul（保留 kind）；删除 div 除零 / floor-ceil-round-clamp / cond 三个专属用例（-3 tests） |

### 语义等价性说明（gainsMayReadResource 重写）

- 旧 hack 检测 `'"source":"res"'` 与 `'"source":"resource"'` 两串；`ValueSource` 联合实际只有 `'res'`（expression.ts:11-19），`'resource'` 是防御性冗余，类型化扫描仅匹配 `'res'`，等价。
- 旧 hack 与新扫描均不展开 funclet 的 calc（funclet 节点序列化只含参数）；且 zone / affectorFlows 叶子的动态值（区记录 expr、Affector flow value）不经本扫描——与旧行为一致，其失效语义归 Phase 5 精确失效统一处理。
- `condition-deps.ts:178` 的 JSON.stringify 是 extraPath 键序列化，与本 hack 无关，保留。

### 删除的 API / 字段

- `GameNum` 联合的 9 个 kind 成员（game-num-eval.ts:49-52 旧）
- `switchEval` / `evaluateGameNumBreakdown` 各 9 个 case
- `gainsMayReadResource` 函数（game-num-build.ts，旧 219-244）

### 验收核验（实测）

- `npm test`：88 文件 905 测试全绿（908 − 3 删除用例）。
- `npx tsc --noEmit`：通过。
- 递归 grep `kind: 'div'|'min'|'max'|'pow'|'clamp'|'floor'|'ceil'|'round'|'cond'`：src/ 与 tests/ 均无匹配。
- `gainsMayReadResource`：全库无引用残留；`gainsMayReadResource` 原 JSON.stringify hack 所在函数已整体删除。

---

## Phase 4 — Affector 正确性（04h §1.1/1.2/1.3/3.2/3.3/3.5）✅

### 实际改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/types/trigger.ts` | `AffectorEffect` 语义显式化：`effects`（激活沿一次性）+ `perTickEffects?`（持续期每 tick，仅限幂等/维持类 op）+ `flows`（唯一持续产出通道）+ `zoneModifiers`；文档注释重写 |
| `src/engine/def-factory/affector-pack.ts` | 新增 builder `perTickEffect(...)`；build() 序列化 `perTickEffects` |
| `src/engine/effect/affector-engine.ts` | ① `mount()` 幂等：同 `packId@mountEntityId` 已有非 Removed 实例时只 recheck 并返回既有实例（§3.3 覆盖挂载/重复发放修复）；② `recheck()` 激活沿发放从「仅 addResource」扩为「全部 op 除 setSpotMaxLevel/removeSpotMaxLevel」（声明式 op 归 applyActiveEffects 维护，§3.5）；③ `applyActiveEffects()` 每 tick 只执行显式 `perTickEffects`，不再重复执行 effects（§1.3 per-tick 陷阱修复）；④ 新增 `reconcileMounts()` 状态↔实例对账（§1.1/1.2）：按 `state.inventory`（物品 affectorPackIds）/ `state.unlockedEnhancements` / `spotLevels>0` 的 linearYield 功能计算期望集合，卸载失效实例、补挂缺失实例，收尾 `syncAffectorZoneEffects`；⑤ `getSpotMaxLevelOverrides()` 加缓存（recheck/unmount 失效，§3.5 扫描开销）；⑥ `warnDuplicateEntryIds`：load/registerPack 时 entry id 重复警告（§3.2），经 `devLog` 注入（game-instance.ts 接线）；⑦ `unmount()` 同步失效 maxLevel 缓存 |
| `src/engine/game/save-codec.ts` | `restoreFromSave` 在 setState 后调 `reconcileMounts()`（存档不保存 Affector 实例，读档按状态重建，§1.1） |
| `src/engine/game/init-service.ts` | `enterInit` 在 enterEffects 后调 `reconcileMounts()`（初始状态/世界线切换不经 itemCollected 等事件路径，§1.2；enterInit 是 init/startNewGame/resumeInit 唯一汇合点） |
| `src/engine/game/runtime-reset.ts` | `resetRuntime` 在 setState 后调 `reconcileMounts()`（重置后默认状态无物品/强化/Spot，对账清空旧世界线遗留实例） |
| `src/engine/game-instance.ts` | `affectorEngine.devLog = this.devLog` 注入 |
| `tools/datapack-editor/schema/engine-defs.gen.json` | `npm run gen:schema` 重新生成（仅时间戳；生成器不展开 entries 内部字段，perTickEffects 对编辑器暂透明） |
| `docs-824/04f-trigger-effect.md` | Affector 四通道语义（effects 激活沿 / perTickEffects 每 tick / flows 唯一持续产出 / zoneModifiers）+ 双通道警告（flows 与 effects[addResource] 并存=双倍）+ 实例生命周期（reconcileMounts 四接线点、mount 幂等） |
| `tests/engine/affector-reconcile.test.ts` | 新增 7 tests（下） |

### 回归测试（tests/engine/affector-reconcile.test.ts）

1. **§1.3 陷阱回归**：effects 中 addItem 激活沿发放一次，3 次 `applyActiveEffects` 不重复；`perTickEffects` 每 tick 执行（3 tick → 3 credit）；未声明 perTickEffects 时无持续产出。
2. **§3.3 mount 幂等**：重复 `mount(pack, entity)` 返回同一实例，激活沿 addResource 不重复发放。
3. **§1.1/1.2 reconcile**：inventory/enhancements 补挂并执行激活沿（两实例 ×7）；物品移除后对账卸载（Removed）其余保留；Spot linearYield 功能按 `spotLevels` 对账挂载/归零卸载。
4. **存档往返**：baseDatapack + 附加强化包（entity 通配 `spot:*` 的 zone mul 1.5 + flows 5）→ A 存档 → B 读档后 active 实例恢复、`evaluateResourceGain` 一致、tick 后 flows 持续入账。

> 数值口径：flows 在 primitiveGain 根级加法、不进 spot 乘区，zone mul 只乘 spot 子树（5×1.5 + 2 + 5 = 14.5）；断言按此显式锚定。

### 验收核验（实测）

- `npm test`：89 文件 912 测试全绿。
- `npx tsc --noEmit`：通过。
- `reconcileMounts` 接线点 grep：affector-engine.ts（定义）/ init-service.ts:153 / runtime-reset.ts:49 / save-codec.ts:157，共 4 处。

---

## Phase 5 — 事件驱动精确失效（04g）✅

### 实际改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/game-instance.ts` | `tick()` 删每帧无条件 `invalidateProduction()`（未受影响的 gain 子树跨帧保持缓存）；注释声明「直接改 state 的调用方须走 StateMutationService」契约 |
| `src/engine/expression/game-num.ts` | 新增三个依赖索引：`zoneKeyResourceDeps`（区表 key → 区记录 expr 所读资源）、`flowsResourceDeps`（flows 节点 resource → 其 expr 依赖资源）、`affectorFlowsNodes`（resource → flows 节点）；`resourceChanged` 订阅改精确失效 `onResourceChanged`（不再全树）；新增 `onAffectorInstancesChanged()`（sync 区表 + flows 节点 markDirty） |
| `src/engine/expression/game-num-tag.ts` | 新增导出 `markSubtreeDirty(root)`（**向下**整子树失效，补 markDirty 只向上传播的缺口）；`markZoneDirty` 导出；`registerTagEffect` / `registerEntityEffect` 经 `accumulateKeyResourceDeps` 记录区记录 expr 的资源依赖（只增不减，过标记安全）；`syncAffectorZoneEffects` 收尾 `rebuildFlowsResourceDeps` |
| `src/engine/expression/game-num-build.ts` | `exprResourceDepsOf` 导出（Phase 3 已有内部实现）；`buildAll` 建 `affectorFlowsNodes` 索引 |
| `src/engine/effect/affector-engine.ts` | ① 新增 `notifyGameNum()` → `gameNumSystem.onAffectorInstancesChanged()`，在 mount / unmount / recheck 的状态翻转或 activeEntryIds 变化时调用（recheck 捕获 `oldEntryIds` 比对）；② `applyActiveEffects` 删每 tick `syncAffectorZoneEffects`；③ 修复 `syncSpotFunctionalities` 对 Removed 实例跳过重挂的 bug（`instances.has` 命中 Removed 阻塞重挂 → 无条件幂等 `mount`） |
| `tests/engine/game-num-invalidation.test.ts` | 新增 7 tests（下） |
| `tests/engine/enhancement-scope.test.ts` / `tests/engine/game-instance.test.ts` | settle 块的直接 `spotLevels` 写改走 `mutations.setSpotLevel/setResource`（原依赖每帧失效掩盖陈旧读） |

### 失效拓扑（设计说明）

- `markDirty` 沿 parents **向上**；`markSubtreeDirty` 沿 children **向下**。resourceChanged 定向失效需两者配合：gain 根标记子树整体重算（子节点缓存陈旧）。
- resourceChanged 三路定向：`gainResourceDeps`（markSubtreeDirty 对应 gain 子树）+ `zoneKeyResourceDeps`（markZoneDirty 反查 zoneIndex）+ `flowsResourceDeps`（markDirty flows 节点，向上传至 gain 根）。
- 其余事件（enhancementAdded/Removed、spotLevelChanged、spotTagChanged、managerChanged、extraChanged）全树失效（markAllDirty）。
- Affector 翻转链：recheck 状态翻转 → `notifyGameNum` → `syncAffectorZoneEffects`（区表重同步）+ 全部 flows 节点 markDirty。注意 markDirty 向上只到已缓存的根，故对每个 flows 节点逐一标记。
- 回退方案（TASK.md 预设）：若未来发现事件缺口，恢复 `tick()` 末尾 `invalidateProduction()` 一行即可回到每帧全树失效。

### 正确性审计结论（TASK.md 要求）

- StateMutationService 全部生产相关写路径均发射对应事件（resource/spotLevel/spotTag/enhancement/manager/extra/flag）。
- 资源写路径核查：`effect-ops` addResource、`init-service` 购买结算走 `changeResource`；`loot-system` 无资源写（仅发 looted 事件由上层结算）。
- Affector 状态翻转经 `notifyGameNum` 覆盖（此前 `affectorStateChanged` 无 game-num 消费者）。

### 回归测试（tests/engine/game-num-invalidation.test.ts，7 tests）

每条：先求值建立缓存 → mutation 变更 → 不经 tick 立即断言 `evaluateResourceGain`：

1. changeResource/setResource → 读资源的 gain 子树定向重算（5/47/12）。
2. setSpotLevel/addSpotLevel → owned/levelLinear/功能 flows（7/11/15）。
3. setExtra/addExtra → data 源 gain（0/7/10）。
4. addEnhancement/removeEnhancement → zone mul 桥接（7/9.5/7；flows 不进乘区，5×1.5+2）。
5. zone 记录 expr 读资源 → zoneKeyResourceDeps 定向失效 zone 节点（5/5/65）。
6. Affector 资源阈值翻转 → flows 进出（5/115/55）。
7. tick 多帧一致性：首帧按变更时余额入账 12，resourceChanged 定向失效后次帧自反增至 36。

### 验收核验（实测）

- `npm test`：90 文件 919 测试全绿（+7）。
- `npx tsc --noEmit`：通过。
- 多帧 tick 数值与 Phase 0 基线一致（game-num-snapshot.test.ts 32 tests 全绿）。

---

## 测试结果汇总

| 时点 | npm test | tsc --noEmit |
| --- | --- | --- |
| Phase 1 后（b558235） | 908 passed | ✅ |
| Phase 2 后（975c3a9，当前 HEAD） | 908 passed（88 files） | ✅ |
| Phase 3 后（6132636） | 905 passed（88 files，-3 删除用例） | ✅ |
| Phase 4 后（c181cfb） | 912 passed（89 files，+7 affector-reconcile） | ✅ |
| Phase 5 后（本次提交） | 919 passed（90 files，+7 game-num-invalidation） | ✅ |

## 遗留风险与后续建议

- `Phase2Bef` commit message 未按任务书 Phase 8 要求「说明清理内容与验收结果」（同时打包了 TASK.md/HANDOFF.md/tree-design.md 入库）。历史已成型，不改写；后续 Phase commit message 补足描述即可。
- 未跟踪文件 `src/data/Hoshino.png` 与本任务无关，待用户定夺入库或忽略。
- funclet 求值链有历史遗留：`value-system.ts:122` 将 `FuncletDef.calc`（类型为 ValueExpression）强转 Value 求值，运行时落入 `evaluateValue` 的 default 分支——本任务未触碰，Phase 5 资源写路径审计确认无其他写路径缺口，建议独立任务修复。
- Phase 5 事件驱动失效依赖「状态变更走 StateMutationService」纪律：绕过 mutation 直接写 state 的调用方将得到陈旧缓存（tick 注释已声明契约）；`onResourceChanged` 三索引（zoneKeyResourceDeps/flowsResourceDeps）为只增不减的过标记设计，漏标记安全、多标记无害。
- Phase 5 起待办见 `TASK.md` roadmap。
