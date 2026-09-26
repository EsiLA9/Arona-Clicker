# Unit 0157-U10：Records 成就进度定点刷新

## Goal

Records 页保持打开时，资源产出或物品收集能更新已显示的简单进度与完成状态，且不重建整页 DOM。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/ui.md`、`docs/ai/PROJECT-CONSTITUTION.md` | UI 刷新等级与施工边界 |
| 计划 | Task 0157、本 Unit、U09 Receipt | 已渲染的节点契约 |
| 源码 | `src/ui/components/service-workspace.ts:renderRecordsMain`、`src/ui/controller-core.ts:refreshLight`、`src/ui/controller-events.ts:bindEvents`、`src/ui/controller.ts:UIController` 中的 root/panelState/refreshLight | 事件与轻刷新入口 |
| 测试 | `tests/ui/controller-events.test.ts` | DOM 行为测试入口 |

## Context Budget

目标约 12k–20k tokens；只定位相关符号。额外阅读超过 2 个文件或 60k tokens 时停止上报。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| Records 成就行及进度／状态子节点由 U09 给出稳定标记 | U09 Receipt、`service-workspace.ts` |
| `refreshLight` 每 Tick 定点更新数值，`bindEvents` 已订阅 EventBus；控制器持有当前服务页与 root | `controller-core.ts`、`controller-events.ts`、`controller.ts` |

## Constraints

- 仅当 Records 页在场时读取 `getAchievementView()` 并更新现存成就行的进度与状态；通过 `textContent` 更新文字，不拼接 HTML。
- 资源产出/变化、物品收集及 Tick 后进度要及时更新；注意事件处理与 Milestone 完成的订阅顺序，必要时在微任务末尾收敛。
- 不重建整页或替换成就行节点，保持滚动、焦点和 hover；不新增非必要 wrapper。
- 新发现项发生于 Area 切换，重开 Records 页面即可看到；本 Unit 不处理热插入和编辑器。

## Allowed Files

- `src/ui/controller-core.ts`
- `src/ui/controller-events.ts`
- `tests/ui/controller-events.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u10-receipt.md`

## Explicit Non-goals

- 不修改 UI 列表结构、只读投影、Milestone 机制、数据包或 CSS。
- 不全局 `render()` 或频繁 `refreshPanels()`；不更新未显示的目标。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；U09 标记若不足以定点刷新，停止并报告具体缺口。

## Completion Criteria

- [ ] Records 保持打开时，生产累计与物品累计的已显示数值无需重开即可更新；达标时状态同步。
- [ ] 更新不替换成就行节点，离开 Records 页后无越界 DOM 写入。
- [ ] 定向测试及 Receipt 记录通过与限制。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/controller-events.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
