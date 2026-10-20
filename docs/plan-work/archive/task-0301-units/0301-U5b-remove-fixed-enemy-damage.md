# Unit 0301-U5b：移除固定 Enemy damage 合同

## Goal

在正式内容已迁移后，删除 Enemy 固定 `damage` 字段、固定伤害 Receipt `enemyAttacks` 以及对应的 Registry、Runtime、Save / Resume 与 UI 投影路径。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | Task 0301：旧合同有意变更 | 本次替换范围与 checkpoint 版本规则 |
| 规范 | `docs/docs-829/05-conventions/schema-sync.md` | 更新 Datapack Schema 的正规流程 |
| 源码 | `src/data-services/contracts/gameplay-map.ts`、`registry-validate.ts` | 作者合同和严格字段校验 |
| 源码 | `src/arona-clicker/contracts/map-run.ts`、`services/map-run-service.ts` | Receipt 数据及恢复校验 |
| 源码 | `src/arona-clicker/contracts/runtime.ts`、`runtime-game-instance.ts`、`src/ui/flow/map-flow-model.ts` | Runtime 与信息流投影 |

## Completion Criteria

- [x] `GameplayEncounterEnemyDef` 不再含固定 `damage`。
- [x] 旧 `enemyAttacks` Receipt 合同、解析和 Runtime projection 已删除；含旧未知字段的 Receipt 按当前版本合同拒绝。
- [x] 相关 Registry、Engine、UI 测试 fixture 不再依赖固定字段。
- [x] 通过 `npm run gen:schema` 与 Schema sync tests。
- [x] Registry 明确拒绝旧固定 Enemy damage 字段。
