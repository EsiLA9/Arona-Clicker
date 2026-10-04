# Unit 0216-U6：体验验收、机制文档与 GALHCG

## Goal

以真实 UI 验收核对中心聊天流、两 Beat 决策闭环和更新连续性；稳定后更新 OperationView 权威机制说明、UI 路由文档和 GALHCG 地图，交付 Task Receipt。

## Must Read / Read Set

- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui.md`
- `docs/ai/galhcg-project-map.md`
- `docs/ai/frontend-design-project-overlay.md`
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`
- `docs/docs-829/02-modules/ui.md`
- `docs/docs-829/03-data-structures/00-index.md`
- `docs/docs-829/06-wiki/50-ui/workspace-routing.md`
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`

## Confirmed Facts

- OperationView 不属于全局 GameView；Entry facade 是 Operation UI 窄读写边界。实现证据以 U1/U5 receipts 与源码为准。
- 0216 两 Beat 判读属于样例 UI；正式目标、路线与结束契约由后续 Task 承接。
- GALHCG 维护对稳定机制概念与实现文件建立关系；小组件和 helper 不创建独立 Concept。

## Allowed Files

- `docs/docs-829/03-data-structures/operation-view.md`
- `docs/docs-829/03-data-structures/00-index.md`
- `docs/docs-829/02-modules/ui.md`
- `docs/docs-829/06-wiki/50-ui/workspace-routing.md`
- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui.md`
- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/0216-u06-ux-documentation-and-galhcg-receipt.md`
- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/task-0216-gameplay-b-command-loop-vertical-slice-ui-receipt.md`

## Constraints

- 完成 U1–U5 代码、定向测试、类型与架构检查后，才把实现写入当前机制文档。
- UI 视觉检查 1280×720：主聊天列至少 60%；分别操作无干预/紧急制动/人群疏导；检查两 Beat 结果与固定 Seed 重复性。
- 检查焦点、日志滚动、未到底时追加消息的锚点、主列表 identity、refresh observation 和 DOM budget。
- 按 GALHCG 协议做概念/路径发现、检查既有地图、刷新触达证据、维护稳定 Operation UI/View 概念关系、验证 freshness；不得仅凭概念搜索结果推断代码事实。
- 最后核对 Task Acceptance 的每一项，未能实测的口径明示为未完成，不勾选；0215 archive 仍须 Task Owner 独立确认。

## Explicit Non-goals

- 不替 0217 编写正式目标/结束机制，不归档 0215。
- 不借此重写 Operation Runtime 主机制文档中与 0216 无关的章节。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。GALHCG 失败或关键 UI 浏览器验收不可执行时记录阻塞证据并保持 Task 未完成。

## Completion Criteria

- [ ] UI 人工走查两种不同样例结果及无干预路线；同 seed 可复现。
- [ ] 检查焦点/滚动/节点 identity 与刷新诊断符合 U4/U5 约定。
- [ ] 更新 `operation-view.md`、模块索引和 Workspace Routing Wiki，内容与源码一致。
- [ ] GALHCG 概念与路径证据关系更新并通过 freshness 验证。
- [ ] 两层 receipts 与 0216 Task 状态记录真实完成项、命令和限制。

## Verification

- `npm run check:docs`
- `git diff --check`
- `npx vitest run tests/engine/gameplay-b-operation-sample.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts tests/ui/gameplay-b-operation-controller.test.ts tests/ui/workspace-router.test.ts tests/ui/operation-workspace-view.test.ts`
- `npx tsc --noEmit`
- `npm run check:architecture`
- Browser/refresh diagnostics as listed above
