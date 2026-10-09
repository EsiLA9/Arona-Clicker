# Unit 0278-U6：自动行动 / Target 与玩家覆盖的 UI 区分

## Goal

战斗卡牌同时显示自动选择的 Action / Target；基础计划标为自动，只有相对基础 PreparedBeat 的实际变化才标为玩家修订。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/frontend-design-project-overlay.md | 游戏 UI 刷新等级与 DOM 连续性 |
| 文档 | docs/docs-829/03-data-structures/operation-view.md | 基础 / 有效 PreparedBeat 的只读投影 |
| 源码 | src/ui/components/operation-workspace.ts：renderAction、renderAutomaticActionCard | 选中行动、目标和状态标签 |
| 测试 | tests/ui/operation-workspace-view.test.ts、tests/ui/gameplay-b-operation-controller.test.ts | 卡面投影、默认点击、替代行动交互 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 复用现有卡面与属性；新增结构需先更新 Task |

## Optional Read Set

- src/arona-clicker/contracts/operation-view.ts：只有 View 字段不足时读取 |

## Do Not Read by Default

- docs/plan-work/archive/**
- CSS 全目录；除非已有测试证明状态需要样式区分

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 选中 Action 当前显示目标姓名，并与 base/effective PreparedBeat 比较设置干预 class；状态文案仍只写“当前计划”。 | operation-workspace.ts：renderAction、renderStudent | 默认和实际覆盖的可见标签不够明确 |
| Controller 默认卡路径由 View / Runtime 提供默认 Target，不需要 UI 生成空目标补丁。 | controller-actions-operation.ts；operation-view-projector.ts | 保留现有命令流 |

## Constraints

- 刷新等级为 behavior / 现有 Operation region；新增节点数量为 0。
- 保留默认 Target 名称、行动替代、卡片焦点与现有单槽清除按钮。
- 不用浏览器验收替代定向 UI / Controller 测试；本 Unit 不安排浏览器回放。

## Allowed Files

- src/ui/components/operation-workspace.ts
- tests/ui/operation-workspace-view.test.ts
- tests/ui/gameplay-b-operation-controller.test.ts
- docs/plan-work/task-0278-units/receipts/0278-u6-receipt.md

## Explicit Non-goals

- 不重绘 Operation Workspace、不添加 wrapper、不改变 Controller 命令 API 或场景行动交互。

## Stop Conditions

按 docs/ai/PROJECT-CONSTITUTION.md 停止条件；如果需要全量 render、增加装饰节点或控制层单独保存自动值，先更新 Unit。

## Completion Criteria

- [x] 基础选中卡显示“自动计划”并显示 Runtime 默认 Target。
- [x] 修改后的有效计划显示“玩家已修订”；其他学生仍显示各自状态。
- [x] 选回默认行动 / Target 不会创建干预；取消已有覆盖恢复“自动计划”。
- [x] DOM 状态只改已有节点；Controller 测试覆盖默认值、选择回默认方案和替代 Action，不用浏览器回放。Combat Target 的合法选择仍由当前 View / Controller Preview 路径提交，`operation-intervention-preview.test.ts` 覆盖 Runtime 接受合法目标覆盖。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-controller.test.ts | 通过 |
| 浏览器验收 | 不运行 | 用户要求减少浏览器验收；测试覆盖 DOM / Controller 行为 |
