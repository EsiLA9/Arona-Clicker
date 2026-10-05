# Unit 0216-U3：Operation Workspace 路由与 Surface

## Goal

增加局部 Operation Workspace Route，并从既有聊天流进入、可返回原工作区；不新增全局导航。

## Must Read / Read Set

- `docs/plan-work/archive/task-0216-gameplay-b-command-loop-vertical-slice-ui.md`
- `docs/docs-829/06-wiki/50-ui/workspace-routing.md`
- `src/ui/workspace/workspace-router.ts`
- `src/ui/components/app-shell.ts`
- `src/ui/update/ui-surface.ts`
- `src/ui/controller.ts`
- `tests/ui/workspace-router.test.ts`
- `tests/ui/workspace-lifecycle.test.ts`

## Confirmed Facts

- Workspace route 要与 `PanelState` 派生的 Legacy route 相符才可解析。依据：`src/ui/workspace/workspace-router.ts`。
- `disposeWorkspace` 位于 `src/ui/controller.ts`，根据导航状态的 `returnTo` 恢复来源标签。
- Surface key 可保持区域实例稳定；高频 Operation version/Beat 不应作为 Surface identity。依据：`src/ui/update/ui-surface.ts`。
- `workspace-renderer.ts` 当前未知 route 会回退成 Game Workspace；实际 Operation view renderer 属 U4，本 Unit 只验 route 与 Surface identity。

## Allowed Files

- `src/ui/workspace/workspace-router.ts`
- `src/ui/components/app-shell.ts`
- `src/ui/update/ui-surface.ts`
- `src/ui/controller.ts`
- `tests/ui/workspace-router.test.ts`
- `tests/ui/workspace-lifecycle.test.ts`
- `docs/plan-work/archive/task-0216-gameplay-b-command-loop-vertical-slice-ui-units/receipts/0216-u03-operation-workspace-route-and-surface-receipt.md`

## Constraints

- 用 typed `PanelState.workspace` Operation state（含稳定 `runId`）对齐 Legacy route；返回状态由现有导航栈表达。
- Operation Surface 的稳定 key 只基于 `runId`，不可使用 `planVersion`、Beat 或 View hash。
- 全局导航及既有主 Workspace 布局不改；这里只接 route 与 surface lifecycle。

## Explicit Non-goals

- 不在本 Unit 实现样例启动命令、事件日志组件、侧栏设计与视图 DTO。
- 不把 Operation 状态写入 save/gameplay player state。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若 route 状态无法在当前 PanelState 表达且需改白名单外导航 owner，先调整 Unit。

## Completion Criteria

- [x] 从 typed `PanelState.workspace` 唯一解析 Operation route，并产生对应的稳定 Surface token。
- [x] 进入和退出保留来源 route/tab；独立 runId 不串用不同 Surface。
- [x] 同一 runId 的 route state 收敛不销毁 Surface identity；不同 runId 会产生新 Surface token。
- [x] route 仅由局部 workspace state 驱动，不增加全局导航入口。非 Office Init 的启动入口由 U5 隐藏。
- [x] 实际视图分派由 U4 `workspace-renderer.ts` 承担；本 Unit 不增加 placeholder 或 Game Workspace fallback 行为。

## Verification

- `npx vitest run tests/ui/workspace-router.test.ts --silent`
- `npx vitest run tests/ui/workspace-lifecycle.test.ts -t "Operation route" --silent`
- `npx tsc --noEmit`
