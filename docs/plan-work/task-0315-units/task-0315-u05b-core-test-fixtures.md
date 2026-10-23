# Task 0315 Unit U05b：MapRun 核心测试夹具迁移

状态：completed — 五个核心测试文件已迁移到新 Program；所有指定回归通过。

## Goal

将 MapRun、来源事务、基础 Gameplay B、卡牌和关系测试中的有效 Action 旧数组夹具改为新 effectProgram；保留这些测试的领域行为覆盖。

## Allowed Files

- `tests/engine/gameplay-b-map-run.test.ts`
- `tests/engine/gameplay-b-map-source-transactions.test.ts`
- `tests/engine/gameplay-b-basic-map-p0-p3.test.ts`
- `tests/engine/gameplay-b-map-cards.test.ts`
- `tests/engine/gameplay-b-map-relations.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 上述文件的有效 Map Action 不再使用 `hpEffects`、`cardEffects` 或 Action `effects`；Action 资源变化使用 `resourceChange`，卡牌折扣使用 prepare。
- Shop Offer `effects` 保持其独立语义；费用、目标、来源和测试结果不发生无意变化。
- 每份受影响测试继续验证原来的 Owner、CardRef、事务或关系行为。

## Stop Conditions

- 需要修改产品代码、增加新原语或改玩法预期时停止并上报；Receipt / Save 测试须等 U03b 完成后再运行。

## Validation

- `npx vitest run tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-source-transactions.test.ts tests/engine/gameplay-b-basic-map-p0-p3.test.ts tests/engine/gameplay-b-map-cards.test.ts tests/engine/gameplay-b-map-relations.test.ts`
- `git --no-pager diff --check`
