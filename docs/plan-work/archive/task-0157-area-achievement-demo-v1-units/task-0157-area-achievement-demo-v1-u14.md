# Unit 0157-U14：真实演示包的 Records 联动验收

## Goal

用演示包真实运行结果驱动 Records 页，验证隐藏、发现、简单进度与达标状态在 UI 中形成闭环，并同步 UI 模块卡片。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/ui.md`、`docs/ai/PROJECT-CONSTITUTION.md` | UI 与文档边界 |
| 计划 | Task 0157、本 Unit、U09/U10/U11/U12 Receipts | 已实现的页面、刷新、数据包 |
| 源码 | `src/ui/components/service-workspace.ts:renderRecordsMain`、`src/ui/controller-core.ts:refreshAchievementRows`、`src/ui/controller-events.ts:bindEvents`、`src/ui/controller.ts:UIController`、`src/arona-clicker/runtime-game-instance.ts:GameInstance` | 真实联动入口 |
| 内容 | `datapack/area-achievement-demo/datapack.json`、`00-world.json`、`01-achievements.json` | 实际演示数据 |
| 测试 | `tests/data/area-achievement-demo.test.ts`、`tests/ui/controller-events.test.ts` | 加载与 UI 测试先例 |

## Context Budget

目标约 12k–20k tokens；额外阅读超出 2 个文件或 70k tokens 时停报。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| U11/U12 已证明真实 JSON/ZIP 内容可运行和启用 | U11/U12 Receipts |
| U09/U10 已有 Records 卡片标记及事件定点刷新 | U09/U10 Receipts、相关源码 |

## Constraints

- 新增一条真实联动测试，不 mock `getAchievementView()`：读取 JSON、构造 GameInstance、进入演示 Init，渲染 Records，确认第二 Area 项未出现；进入 Area 后重新打开 Records，确认项目与 1/3 进度；保持页面打开再往返，确认进度和完成状态定点更新且行节点身份不变。
- 测试生产后的资源成就状态与数值，但不要用 StateMutationService 直接写完成事实。
- 更新 UI 模块卡片中 Records 成就只读投影、区域分组和定点刷新入口；不复制 Task 玩法内容，不把未做的编辑器支持写成现状。
- 测试应清理 Controller/Runtime，避免定时器泄漏。

## Allowed Files

- tests/ui/area-achievement-demo.test.ts（本 Unit 新建）
- `docs/docs-828/02-modules/ui.md`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u14-receipt.md`

## Explicit Non-goals

- 不修改引擎、UI 实现、数据包、编辑器或现有测试。
- 不做浏览器视觉重设计。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若测试发现实现缺陷，停止并提交最小失败证据，不在本 Unit 越界修复。

## Completion Criteria

- [ ] 真实运行结果驱动 Records 页的首访隐藏、发现、进度和完成状态，定点更新不替换行。
- [ ] UI 模块卡片与当前实现一致；Receipt 记录测试结果和发现。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/area-achievement-demo.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
