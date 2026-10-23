# Task 0315 U06 Receipt：Owner 旧执行模式移除

状态：completed。

## 修改

- `src/arona-clicker/services/map/map-run-service.ts`：移除 `settlementChangesFor` 中按 `legacyPhase` 筛资源指令并单独调用 Planner 的分支；有序资源账本现在只从 authoritative `effectProgram` 计划读取。无效果的既有 Action 仍可结算成本，不会执行旧字段。
- `map-run-service.ts`：移除 HP 旧相位过滤与第二次 Planner 运行；HP `hpChanges` 只从已规划 Trace 的 `hpChange` / `damage` / `heal` 事件投影。Actorless Ability / Item 仅允许 Program 中不存在 `sourceActor` 资源写入。
- `src/arona-clicker/services/map/map-card-effects.ts`：准备期只允许有序 Program 产生折扣 metadata；旧 `cardEffects` 不再变成可执行折扣。CardRef 归属、准备目标资格及 Actor `sCost` 折扣汇总保持不变，metadata 不再携带 `legacy` / `program` mode。
- `tests/engine/gameplay-b-effect-card-prepare.test.ts`：同步新的 count-free Program prepare metadata 断言。
- Save / Resume 中的 HP Receipt 重建分支（`map-run-service.ts` 后续 restore helpers）仍归 U07；Receipt validator 的旧模式仍归 U06b。Shop Offer `effects` 未改。

## 验证

- 实际运行：`npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-effect-card-prepare.test.ts`，**3 files / 66 tests passed**。
- `git --no-pager diff --check` 通过。
- 首轮运行曾暴露 prepare metadata 仍受 `mode` guard 丢弃，导致 Trace 缺少 discount；去掉该遗留 guard 后重跑全绿。
