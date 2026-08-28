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

---

## 测试结果汇总

| 时点 | npm test | tsc --noEmit |
| --- | --- | --- |
| Phase 1 后（b558235） | 908 passed | ✅ |
| Phase 2 后（975c3a9，当前 HEAD） | 908 passed（88 files） | ✅ |

## 遗留风险与后续建议

- `Phase2Bef` commit message 未按任务书 Phase 8 要求「说明清理内容与验收结果」（同时打包了 TASK.md/HANDOFF.md/tree-design.md 入库）。历史已成型，不改写；后续 Phase commit message 补足描述即可。
- 未跟踪文件 `src/data/Hoshino.png` 与本任务无关，待用户定夺入库或忽略。
- Phase 3 起待办见 `TASK.md` roadmap。
