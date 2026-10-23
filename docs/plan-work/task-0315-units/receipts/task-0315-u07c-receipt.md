# Task 0315 U07c Receipt：Relation ReadModel 投影清理

## 结果

- `MapActionRelation` 不再公开旧 `effectRecipients`，Relation projector 也不再从 Action 的 `hpEffects`、`effects`、`cardEffects` 构造旧受用者投影。
- Program `declaredEffects` 仍经 `normalizeMapActionEffects` 与 `summarizeMapActionEffects` 生成；原始 path、既有 summary kind、条件信息与 target/source/team 受用者关系保持。
- 两份 UI Relation 测试中的 Relation fixtures 已删除旧字段，未改 UI 实现。
- 当前 `map-effect-summary.ts` 对 damage/heal 尚未提供专用声明摘要；按父任务边界留给 U08，不在 U07c 修改摘要实现。

## 修改文件

- `src/arona-clicker/contracts/map/map-relations.ts`
- `src/arona-clicker/services/map/map-relation-projector.ts`
- `tests/engine/gameplay-b-map-relations.test.ts`
- `tests/ui/map-relation-presentation.test.ts`
- `tests/ui/map-relation-interaction.test.ts`
- `docs/plan-work/task-0315-units/task-0315-u07c-relation-projection-removal.md`

## 首次失败与修正

- 首轮关系测试因路径断言固定为 `hit-b` 失败；实际自然 Action 可为 `hit-b` 至 `hit-d`。将断言改为校验原始 Action Program path 的合法模式。

## 验证

- `npx vitest run tests/engine/gameplay-b-map-relations.test.ts tests/ui/map-relation-presentation.test.ts tests/ui/map-relation-interaction.test.ts`：通过，3 个测试文件、31 项测试。
- `git --no-pager diff --check -- <U07c 文件>`：通过。
