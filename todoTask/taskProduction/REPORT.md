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

## 测试结果汇总

| 时点 | npm test | tsc --noEmit |
| --- | --- | --- |
| Phase 1 后（b558235） | 908 passed | ✅ |
| Phase 2 后（975c3a9，当前 HEAD） | 908 passed（88 files） | ✅ |
| Phase 3 后（本次提交） | 905 passed（88 files，-3 删除用例） | ✅ |

## 遗留风险与后续建议

- `Phase2Bef` commit message 未按任务书 Phase 8 要求「说明清理内容与验收结果」（同时打包了 TASK.md/HANDOFF.md/tree-design.md 入库）。历史已成型，不改写；后续 Phase commit message 补足描述即可。
- 未跟踪文件 `src/data/Hoshino.png` 与本任务无关，待用户定夺入库或忽略。
- funclet 求值链有历史遗留：`value-system.ts:122` 将 `FuncletDef.calc`（类型为 ValueExpression）强转 Value 求值，运行时落入 `evaluateValue` 的 default 分支——本任务未触碰，建议 Phase 5 资源写路径审计时一并核查。
- zone / affectorFlows 叶子的动态值（区记录 expr、Affector flow value）不在 gain 依赖扫描内，`resourceChanged` 对它们不失效——Phase 5 精确失效需一并设计。
- Phase 4 起待办见 `TASK.md` roadmap。
