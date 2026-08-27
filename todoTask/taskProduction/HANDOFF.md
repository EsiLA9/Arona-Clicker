# HANDOFF — Phase 1 交接文档（taskProduction）

> 交接时间点：Phase 1 代码改造已完成、根因已定位，**尚未提交**。
> 下一步执行者按「剩余工作」清单继续即可。

---

## 1. 总体进度

| Phase | 状态 |
| --- | --- |
| Phase 0 行为快照 | ✅ 完成并提交（commit `1faf5c3`，`tests/engine/game-num-snapshot.test.ts` 32 tests） |
| **Phase 1 统一区表真相** | **进行中（本交接）**——核心代码已改完，剩 6 个测试更新 + 1 个引擎 bug 修复 + 验收提交 |
| Phase 2-8 | 未开始 |

任务书：`todoTask/taskProduction/TASK.md`；原任务书：`todoTask/taskGameNum/TASK.md`；未来树设计：`todoTask/taskGameNum/tree-design.md`。

## 2. 决策项 1 已定案（用户拍板）

**分桶语义**：
- `category: 'mul'`（默认乘区，不指定 multiplierId）→ **加百分比**：`1 + Σ(f-1)`（+25% + +50% → 1.75）
- `category: 'custom'` + multiplierId（手动新乘区）→ **✕倍**：组内连乘 `Πf`、组间连乘（×1.5 ×2 → 3.0）

现有数据包全部是单条 mul 记录（加法=连乘），**现有游戏数值不变**。

## 3. 已完成的代码改动（未提交，工作区中）

### 3.1 `src/engine/expression/game-num-eval.ts`
- `aggregateZone`：mul 路径改为 `addMulSum += v - 1` 后 `product *= 1 + addMulSum`（加法）；custom 保持组内连乘。头注释重写为分桶语义说明。
- `zoneValue`：删除 childMulMap 分支，zone 节点唯一求值路径 = `aggregateZone`。
- `switchEval` 的 `mul` 分支：删除 `childMulMap`/`bound` 处理。
- `evaluateGameNumBreakdown`：`mul`/`zone` 分支删除 childMulMap 展开。
- `GameNum` 类型联合：所有节点删除 `childMulMap`/`bound` 字段（`ZoneBound` 接口保留但已无消费者，Phase 7 可删）。

### 3.2 `src/engine/expression/game-num-tag.ts`（整文件重写）
- **删除**：`routeToZoneNodes` / `addContribution` / `applyBound` / `toValueNode`（随机 id）/ `removeContribByKey` 全部投影机制。
- `registerTagEffect` / `registerEntityEffect`：只写 state 表 + `markZoneDirty`（经 zoneIndex 反查定向失效）。
- `removeTagEffect` / `removeTagEffectsBySource`：state 表清理 + 收集受影响 key → 定向 markDirty（删除镜像撤销半边）。
- 保留：`syncAffectorZoneEffects`（结构不变，但现在只操作 state 表）、`clearTagEffectsByLife`（Phase 7 处理）、`markAllDirty`/`markDirty`。

### 3.3 `src/engine/expression/game-num-build.ts`
- `buildZoneNode`：删除 `childMulMap: new Map()` 初始化。
- `buildSpotProduction`：删除 defaultMul/defaultAddMul 预置组；**hierarchy 显式化**——area/init 上抛改为显式节点 `hierarchy:<spotId>`（add：const 1 + 各 `sub(upperZone, const 1)`），parents 链：upper → subNode → hierarchyAdd → spotMul（保证 markDirty 沿缓存依赖传播）。数值不变（`1+Σ(zone-1)`）。
- 删除 `linkHierarchy` 函数与 `MulNode` import。
- 注意：build.ts 里 `allEntitiesOfKind` 是死代码（tag.ts 有同名实用版本），Phase 7 清理。

### 3.4 `src/engine/expression/game-num-internal.ts`
- 删除 `MulNode` 类型；保留 `ZoneNode`（纯别名）与 `ZoneIndexEntry`（zoneIndex 字段仍用）。

### 3.5 类型检查
`npx tsc --noEmit` ✅ 通过。

## 4. ⚠️ 根因发现：`GameNumSystem.state` 陈旧引用（Phase 1 暴露的引擎 bug）

**现象**：`tests/engine/game-num.test.ts` 的 `P1: enhancement production multiplier...` 失败——`removeEnhancement` 后乘区记录未清理，产出维持旧值。

**调试结论（已实证，证据充分）**：
- `startNewGame` 等路径替换 `GameInstance._state` 为新对象后，`AffectorEngine.state` 指向**新对象**（记录经 mount → sync 写进新对象），但 `GameNumSystem.state` 仍指向**旧对象**（未重新 `buildAll`）。
- 关键证据（调试日志）：`sync state identity: system.state===state: false, affector.state===state: true, entityEffects of state: 19, entityEffects of system.state: 0`。
- 结果：GameNumSystem 事件处理器里的 `syncAffectorZoneEffects(this.affectorEngine, this.state)` 清理的是旧对象的空表；`evaluateResourceGain(res, game.state)` 读的是新对象（记录还在）→ 旧值。
- **旧代码为什么没暴露**：childMulMap 投影挂在共享节点上（与 state 对象无关），删除投影即清理了求值路径；state 表只有不可达的 aggregateZone 兜底在读。Phase 1 让 state 表成为唯一真相后，此 bug 立即变成正确性问题。

**修复方向**（下一步执行）：GameInstance 所有 `_state` 替换路径（`startNewGame`/enterInit/`restoreFromSave`/`reset`，见 game-instance.ts:294-298、852、861 的 setState 回调）必须统一重调 `this.gameNumSystem.buildAll(this._state)`（回调 294-298 已有 `invalidateProduction()`，替换/追加为 buildAll）。修复后补回归测试：state 替换后 register/remove 立即生效。

## 5. 剩余工作（按序）

1. **修 §4 陈旧 state bug**：在 game-instance.ts 的三处 setState 回调中，把 `invalidateProduction()` 换/补为 `gameNumSystem.buildAll(this._state)`（restoreFromSave 的回调 852 与 reset 的 861 也要加；确认 buildAll 在 registry 就绪后调用）。
2. **更新快照测试** `tests/engine/game-num-snapshot.test.ts`（4 处，语义统一后的预期值）：
   - `custom 按 multiplierId 分组`：16 → **24**（vip 组 2×3=6，gold 组 4，6×4=24；组内连乘是分桶语义）
   - KNOWN DIVERGENCE describe 三个测试移入「双聚合路径对拍」describe：
     - 同组多条 mul：两边都 = **2.5**（加法），改 `expect(viaMap).toBe(viaTable)` 并断言 2.5
     - 同 multiplierId 多条 custom：两边都 = **6**（连乘）
     - 通配 entity 键（`area:*`）：现在**生效**（aggregateZone 读通配键），断言 `evaluate(areaZone)` = 2，注明「统一后通配键生效，桥接层已把 `*` 展开为逐实体键故无数据影响」
   - describe 标题「主路径 childMulMap」可改为「state 表聚合」。
3. **更新结构断言** `tests/engine/game-num.test.ts` 的 `spot subtree expands down to owned/baseLine/zone leaves`：spotMul children 现为 **4 个**（多出 `hierarchy:<spotId>` add 节点）。改为 toEqual 4 元数组或toContain 前三项 + hierarchy。
4. **验收**：`npm test` 全绿 + `npx tsc --noEmit` 通过 + `grep childMulMap src/` 确认无残留（除 ZoneBound 死类型外）。
5. **提交**：commit message 概括「Phase 1: 删 childMulMap 投影，state 表唯一真相，分桶乘区语义，hierarchy 显式化，修 GameNumSystem.state 陈旧引用」。
6. 然后按任务书继续 Phase 2（删旧 tick 路径）。

## 6. 遗留说明

- `ZoneBound` 接口（game-num-eval.ts）已无消费者，Phase 7 删除。
- build.ts 的 `allEntitiesOfKind` 死代码，Phase 7 删除。
- 当前失败测试恰好 6 个：快照 4 + game-num.test.ts 2（结构断言 + 陈旧 state bug），其余全绿（tick-system / spot-functionality 等不受影响）。
- 调试产物（`_debug-affector.test.ts`、fullout*.txt、dbglog.txt）已全部删除，源码无调试残留。
