# Unit 0309-U6：从准备页管理活动 Run

## Goal

在 resume 准备页加入低强调的重新开始与放弃操作，复用当前确认和领域命令，并让取消 / 失效保留现状与焦点。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` §“页面状态与主操作” / P3 / 验收 | 准备页管理操作边界 |
| 源码 | `src/ui/controller/controller-actions-operation.ts:openMapRestartConfirmation/openMapAbandonConfirmation/getActiveMapRunForRoute` | 复用确认、重核和原有 map route 语义 |
| 源码 | `src/ui/components/map/map-entry-workspace.ts:renderPrimaryAction` | 在 resume 模式增加低强调管理区与焦点 key |
| 契约 | `src/arona-clicker/contracts/runtime/runtime.ts:GameCommands.restartMap/abandonMap` | 既有 Run 命令 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k tokens |
| 文档 Read Set | 3 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并拆分 |

## Optional Read Set

- 无；不能扩展 MapRun Owner 或 SaveData。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前 Map Workspace 已使用 `restartMap` / `abandonMap` 的显式确认 | `src/ui/controller/controller-actions-operation.ts:openMapRestartConfirmation/openMapAbandonConfirmation` | 扩展共用入口以支持 map-entry route |
| restart 返回新 Run 并继续进入 map route；abandon 当前返回原游戏位置 | 同上 | map-entry abandon 应局部返回 fresh 准备页 |
| `getActiveMapRunForRoute` 当前只接受 route kind map | `src/ui/controller/controller-actions-operation.ts:getActiveMapRunForRoute` | map-entry 需严格核对相同 mapId、runId 与来源 |

## Constraints

- 管理区仅在 `mode === resume` 显示，低于“继续地图”主按钮；不增加角色编队 / 重置行为。
- 重新开始复用 `restartMap` 与现有危险操作确认；确认后新 Run 进入 map route，取消或失败保留旧 Run / 原焦点。
- 放弃复用 `abandonMap` 与现有确认；从 map-entry 确认后留在同 map 的 fresh 准备页，不自动开局；从 map route 保持既有返回原游戏行为。
- map-entry 路径在打开确认与确认提交时均重核 source、route、runId 和 gate；取消不产生 Run / PlayerState 写入。
- 遵守 Task 0309 和 `AGENTS.md`。

## Allowed Files

- `src/ui/controller/controller-actions-operation.ts`
- `src/ui/components/map/map-entry-workspace.ts`
- `src/ui/css/map-entry-workspace.css`

## Explicit Non-goals

- 不增 MapRun 命令、不改变存档、Run 所有权或终局路径。
- 不增加第二套确认组件 / 危险动作体系。
- 不修改或运行测试。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。若必须改 Owner / Controller / Workspace 路由、或发现源合同与 Task 冲突，停止并上交。

## Completion Criteria

- [ ] resume 页面显示低强调重开 / 放弃入口，fresh / blocked 不显示。
- [ ] restart 确认前后校验 run 与来源；成功建立新 runId 并进入同图现场。
- [ ] abandon 确认成功后保留在 fresh 准备页；从 map route abandon 保持原行为。
- [ ] 取消无副作用并恢复有效焦点；失效 / 命令失败不清旧 Run。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 源码类型检查 | 临时配置继承仓库 `tsconfig.json`，以本 Unit UI 文件为入口 | 无新增错误 |
| 差异检查 | `git --no-pager diff --check` | 通过 |
| 测试 | 未要求；不修改或运行测试 | — |

## Pre-flight

- Goal：复用现有 restart/abandon 确认，扩展验证以支持 map-entry 页面；Allowed Files 仅两文件；不改写 Owner 或保存机制；restart 进入现场，abandon 留 fresh 页，取消无写入并恢复焦点。
