# Task 0315 Unit U07c：Relation ReadModel 投影清理

状态：completed — 依赖 U06 与 U05b 的关系测试迁移已完成；damage/heal 展示语义由 U08 负责。

## Goal

让 Map Action 的 Relation projection 只提供 effectProgram 声明，不再复制旧作者数组生成的 effect recipient。Workspace Action view 的旧显示字段与 damage/heal 展示语义由 U08 一并处理，以便 UI 与合同同步切换。

## Allowed Files

- `src/arona-clicker/contracts/map/map-relations.ts`
- `src/arona-clicker/services/map/map-relation-projector.ts`
- `tests/engine/gameplay-b-map-relations.test.ts`
- `tests/ui/map-relation-presentation.test.ts`
- `tests/ui/map-relation-interaction.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- Map Action Relation 中没有由旧 hpEffects / effects / cardEffects 构造的 `effectRecipients` 投影。
- 现有 effectProgram Declared Effect summary、条件分支、原始 path 与受用对象保持稳定；damage/heal 的展示语义由 U08 的摘要更新与测试负责。
- 费用、target 与其他非效果 Action 字段无变化。

## Stop Conditions

- 需要修改 Workspace Action view、`map-workspace.ts` 或 effect summary UI 文案时停止；交由 U08。

## Validation

- `npx vitest run tests/engine/gameplay-b-map-relations.test.ts`
- `git --no-pager diff --check`
