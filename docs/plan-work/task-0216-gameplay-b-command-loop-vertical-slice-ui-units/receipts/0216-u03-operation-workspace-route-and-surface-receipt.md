# Receipt 0216-U3：Operation Workspace 路由与 Surface

## Outcome

已将 Operation 作为局部 Workspace Route 接入现有路由、`PanelState.workspace` 与 Surface 身份。运行身份只使用 `runId`；不把 Beat、计划版本或 Runtime View hash 纳入 Surface key。Controller 可进入 Operation Workspace，并由现有单层返回位置恢复来源标签、选中角色和会话角色。

## Implementation

- Router、AppShell、UISurface 与 Controller 都从 typed Operation workspace state 派生同一 `{ kind: 'operation', runId }` route。
- 同一 `runId` 的路由收敛保留 Surface token；切换到另一 `runId` 会产生新 Surface generation。
- Operation workspace 只保存稳定 Run ID 和返回上下文，不保存 `EventRun` 或 `OperationView`。
- 实际 Operation 内容渲染归 U4；本 Unit 没有创建 placeholder，也没有加入全局入口。

## Verification

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/ui/workspace-router.test.ts --silent` | 通过，9 tests |
| `npx vitest run tests/ui/workspace-lifecycle.test.ts -t "Operation route" --silent` | 通过，1 test |
| `npx tsc --noEmit` | 通过 |
| `npm run check:docs` | 通过，638 Markdown、0 errors |
| `git diff --check` | 通过；显示工作树 CRLF 转换提示 |

## Follow-up

- 完整 `tests/ui/workspace-lifecycle.test.ts` 运行时 16/17 通过；既有的“局部替换恢复被替换节点内的焦点”断言失败（预期 BUTTON、实际 BODY）。该断言位于普通 panel refresh 流程，不属于本 Unit 的路由代码；暂未证明其在干净基线上也会失败，留待后续单独核查。
- 0215 归档仍等待 Task Owner 独立确认。
