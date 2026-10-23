# Task 0315 Unit U08：旧卡牌字段 UI 投影移除

状态：completed — Workspace Action 合同与 UI 已迁到 Program 摘要；damage/heal 声明及实际 Trace 均有专用显示。

## Goal

让 Map Workspace / Effect Workspace 只基于新 effectProgram 摘要和实际 Trace 呈现卡牌效果，不再读取旧 hpEffects / cardEffects。

## Allowed Files

- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/contracts/map/map-relations.ts`（待 U07c 收口后扩展 damage/heal 声明摘要类型）
- `src/ui/components/map/map-workspace.ts`
- `src/arona-clicker/services/map/map-effect-summary.ts`
- `tests/ui/gameplay-b-effect-workspace.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 新 damage/heal、resourceChange、prepare 折扣摘要与执行结果正确展示。
- Workspace Action view 不再声明旧 `hpEffects` / `cardEffects` 字段；旧数组文案 / 字段读取消失。
- 区域局部刷新、Tooltip 和现有弹层生命周期不变。

## Stop Conditions

- 需要创建新视觉方向、CSS、刷新调度器或改变其它工作区时停止。

## Validation

- `npx vitest run tests/ui/gameplay-b-effect-workspace.test.ts tests/ui/gameplay-b-map-workspace.test.ts`
- `git --no-pager diff --check`

Receipt：[[docs/plan-work/task-0315-units/receipts/task-0315-u08-receipt]]
