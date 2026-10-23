# Task 0315 Unit U07：Save / Resume 恢复清理

状态：completed — 依赖 U06 Owner 移除与 U06b Receipt 校验收敛。

## Goal

删除 MapRun Save / Resume 中仅为旧 Action 数组保留的字段和兼容校验；不改变顶层存档格式。

## Allowed Files

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `tests/engine/gameplay-b-effect-save-resume.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 新 Save / Resume 与恢复校验不复制旧作者字段或旧 Receipt 证明字段。
- Damage / heal Trace、program summary 与现有 Item / inventory / request replay 证据仍完整。
- 修改内容的 Map resumeVersion 不符时按现行规则拒绝或失效；无旧字段迁移旁路。

## Completion

- Runtime MapRun Action / Ability / Item 投影与 `MapRunEncounterSourceOption` 不再包含旧 `hpEffects` / `cardEffects` 字段。
- Save / Resume Receipt 重建仅接受当前 effectProgram Action；移除按旧作者数组重建 HP delta、资源或 Receipt 的兼容分支。存档顶层格式和现有 `resumeVersion` 内容版本校验未改变。
- Save/Resume 回归夹具迁为显式 `effectProgram` 资源原语，并保留 checkpoint、Item 消耗、Trace、replay 和损坏 Receipt 拒绝断言。

## Stop Conditions

- 需要改变顶层 SaveData 格式或 GameInstance 其它 PlayerState 回滚语义时停止上报。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-save-resume.test.ts`
- `git --no-pager diff --check`
