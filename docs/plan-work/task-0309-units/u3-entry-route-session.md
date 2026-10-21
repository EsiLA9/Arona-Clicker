# Unit 0309-U3：接入准备页路由与返回会话

## Goal

在单层 Workspace 导航中加入 map-entry route 与 UI-only 来源绑定，使开始、续行、现场返回准备页及返回原游戏位置都保留最初 returnTo。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` §“路由、会话与生命周期” | 入口会话及 replace 语义 |
| 源码 | `src/ui/workspace/workspace-router.ts:WorkspaceRoute/resolveCurrentWorkspaceRoute` | 路由身份与 route-only 例外 |
| 源码 | `src/ui/components/app-shell.ts:PanelState` | UI-only 会话状态归属 |
| 源码 | `src/ui/controller.ts:enterWorkspaceRoute/replaceWorkspaceRoute/returnFromMapWorkspace` | 单层 returnTo 和 MapFlow 生命周期 |
| 测试 | `tests/ui/workspace-router.test.ts`、`tests/ui/workspace-lifecycle.test.ts` | 原单层返回回归入口；本轮不修改或运行测试 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k tokens |
| 文档 Read Set | 3 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并拆分 |

## Optional Read Set

- 无。入口和门控事件由后续 Unit 接线。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Map / Area 为 route-only 页面，`resolveCurrentWorkspaceRoute` 显式保留，legacy state 不携带其内部状态 | `src/ui/workspace/workspace-router.ts:resolveCurrentWorkspaceRoute` | 新 route 需加入同一保留分支 |
| Workspace 只有单层 `returnTo`，`replaceWorkspaceRoute` 保留它而 `enterWorkspaceRoute` 新建返回位置 | `src/ui/workspace/workspace-router.ts`；`src/ui/controller.ts` | entry 与现场互切必须 replace |
| `enterWorkspaceRoute` 离开 Map 时清理 MapFlow；`replaceWorkspaceRoute` 当前不做该清理 | `src/ui/controller.ts:enterWorkspaceRoute/replaceWorkspaceRoute` | 现场返回准备页须显式清理 |

## Constraints

- `map-entry` route 只携带 `mapId`；来源 `{ spotId, functionalityId, mapId }` 仅存在 UI memory，不进入 Runtime 或 SaveData。
- 从游戏首次进入准备页时只建立一次 returnTo；准备页与现场互切只 replace，不扩大成通用 history stack。
- 现场→准备页清理临时 MapFlow，不更改 MapRun。
- 遵守 `AGENTS.md` 与 Task 0309。

## Allowed Files

- `src/ui/workspace/workspace-router.ts`
- `src/ui/components/app-shell.ts`
- `src/ui/controller.ts`

## Explicit Non-goals

- 不接开始 / 继续按钮、设施入口、前台 gate、渲染组件、刷新 dispatcher 或 MapRun 命令。
- 不改变现有 Map / Area 返回行为或单层导航架构。
- 不修改或运行测试。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。需新增其它路径、改存档协议或引入通用导航栈时停止。

## Completion Criteria

- [ ] `map-entry` 有稳定 route key，解析时与 map / area 一样保留 route-only state。
- [ ] PanelState 保存 UI-only source binding。
- [ ] Map 现场和准备页间可 replace 往返并保留原游戏 returnTo；现场返回准备页前清理 MapFlow。
- [ ] 准备页返回游戏恢复原 tabs / selection / conversation location，清理入口会话。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 测试 | 未要求；不修改或运行测试 | — |

## Pre-flight

- Goal：新增 map-entry 路由与 UI-only 会话；Allowed Files 仅 route、PanelState 与 Controller；不接按钮或 Run 命令；首次 enter 保存原游戏位置，entry↔map 用 replace，返回 entry 清 MapFlow、不清 Run；不建通用栈。
