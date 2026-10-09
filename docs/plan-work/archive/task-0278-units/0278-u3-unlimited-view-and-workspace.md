# Unit 0278-U3：不限批次的 View 与 Workspace 表达

## Goal

让只读 OperationView 和游戏内 Workspace 将无批次上限投影为明确的“不限”，并持续开放行动 / 确认入口。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/frontend-design-project-overlay.md | 刷新与交互连续性护栏 |
| 文档 | docs/docs-829/03-data-structures/operation-view.md | View 契约及只读边界 |
| 源码 | src/arona-clicker/services/operation-view-projector.ts：sceneActionBatchesRemaining | 当前缺省转零的投影 |
| 源码 | src/ui/components/operation-workspace.ts：renderSceneActions、renderMain | 提交入口和剩余批次文案 |
| 测试 | tests/engine/operation-view-projector.test.ts、tests/ui/operation-workspace-view.test.ts | 实际 View 投影与 DOM 行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 优先沿用现有节点和 region，不扩展全量 Renderer |

## Optional Read Set

- src/arona-clicker/contracts/operation-view.ts：OperationView

## Do Not Read by Default

- docs/plan-work/archive/**
- CSS 全目录；除非现有 UI 测试证明需要样式调整

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| View 当前把缺省 Scene batch limit 设为 0 并投影剩余 0，Workspace 以 remaining 数值门控控件。 | operation-view-projector.ts；operation-workspace.ts | 改为 nullable remaining，null 表示不限 |
| 当前自动计划卡已有默认 Target 摘要；本 Unit 只处理 SceneAction 批次数展示。 | operation-workspace.ts：renderAction、renderSceneActions | 自动 / 干预状态由 U5 处理 |

## Constraints

- UI 只读 View；不在 DOM 层补造默认值或绕开 Runtime。
- 不新增 wrapper；必要更新按已有 region / behavior 刷新路径。

## Allowed Files

- src/arona-clicker/contracts/operation-view.ts
- src/arona-clicker/services/operation-view-projector.ts
- src/ui/components/operation-workspace.ts
- tests/engine/operation-view-projector.test.ts
- tests/ui/operation-workspace-view.test.ts
- docs/plan-work/task-0278-units/receipts/0278-u3-receipt.md

## Explicit Non-goals

- 不做视觉重塑、浏览器布局回归或手动玩家动作自动化。

## Stop Conditions

按 docs/ai/PROJECT-CONSTITUTION.md 停止条件；若需要新增结构节点或全量 render 才能表达状态，停止并重新评估 UI 方案。

## Completion Criteria

- [x] 缺省上限在 View 中以明确的不限定值呈现，不显示 0 次或巨大数值。
- [x] Workspace 在不限批次场景保持选牌、预览、单次确认和跳过入口。
- [x] 有限剩余批次与耗尽 UI 保持原样。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/ui/operation-workspace-view.test.ts | 通过 |
| 浏览器验收 | 不运行 | 依据用户要求减少；View / DOM 定向测试覆盖本 Unit |
