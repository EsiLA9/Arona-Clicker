# Unit 0216-U5：Operation 入口命令与局部刷新

## Goal

从当前中心聊天流提供 Office Init 专属事件入口；通过 UI Controller 调用窄 facade 启动/修订/清除/Commit Operation，并以合并局部刷新维护交互连续性。

## Must Read / Read Set

- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui.md`
- `docs/docs-829/06-wiki/50-ui/controller-commands.md`
- `docs/docs-829/06-wiki/50-ui/refresh-update.md`
- `src/ui/components/center-panel.ts`
- `src/ui/controller.ts`
- `src/ui/controller-events.ts`
- `src/ui/update/ui-surface.ts`
- `src/ui/context.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `src/arona-clicker/contracts/operation-view.ts`（U1）

## Confirmed Facts

- command 调用路径是 UI → Controller → Runtime facade；组件只发命令，不直接持有 Runtime 写入口。
- `operationEntry` 窄 facade 提供 start、getView、合法 revision/clear/commit；禁止组件直接读写 EventRun。
- App runtime bootstrap 由 `src/app/runtime-bootstrap.ts` 组装；UI mount 前需核验 `activeInit`。
- 主题改动已有未提交文件 `src/ui/context.ts`、`src/ui/controller-theme.ts` 等；不得覆盖或重置用户变化。

## Allowed Files

- `src/ui/components/center-panel.ts`
- src/ui/controller-actions-operation.ts (new file)
- `src/ui/controller.ts`
- tests/ui/gameplay-b-operation-controller.test.ts (new file)
- `docs/plan-work/task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/0216-u05-operation-entry-commands-and-local-refresh-receipt.md`

## Constraints

- 非 `base:init:schale_office` 隐藏入口；Roster admission 错误明确呈现，不添加学生。
- Operation 命令与主题 dirty 文件职责分离；若确须修改 `src/ui/context.ts`、`runtime-commands.ts` 等白名单外文件先上报并更新 Unit。
- 每个用户操作最多构造一次最新 OperationView，并发出一个合并 region 更新；hover/scroll/普通候选选择不得触发 Runtime 重建、resolver 或全量 render。
- commit 结果以 Runtime Resolution 为准；两 Beat 后 UI 本地判读“安全处置 / 处置失败”，禁用继续 commit，明确非正式 EventOutcome。
- 返回聊天流保留列表、tab、焦点与滚动状态。

## Explicit Non-goals

- 不实现 Operation objective/outcome/finish、地图 route 或 PlayerState 写入。
- 不引入玩家卡牌、PlayerCost 或非战斗场景动作。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若当前 command dispatcher API 与白名单不符，先提出最窄接线方案，不扩大到全局命令重构。

## Completion Criteria

- [ ] 入口只在 Office Init 中可见，点击后新建 Run 并进入 U3 Operation Surface。
- [ ] 修订、取消与 Commit 有明确命令结果、错误状态和可预期焦点恢复。
- [ ] 单次用户命令对应一个 OperationView 读取与一个合并 surface 更新。
- [ ] 两个 Beat 后停止接受 Commit 并展示样例本地结论，不污染 Runtime formal status。
- [ ] UI tests 覆盖非 Office 隐藏、Admission failure、revision、clear、commit、refresh observation。

## Verification

- `npx vitest run tests/ui/gameplay-b-operation-controller.test.ts tests/ui/workspace-router.test.ts tests/ui/operation-workspace-view.test.ts`
- `npx tsc --noEmit`
- `npm run ui:callgraph`
