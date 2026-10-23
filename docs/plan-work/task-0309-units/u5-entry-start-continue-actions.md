# Unit 0309-U5：接入入口、开始与继续操作

## Goal

将 Spot Map 入口改为只打开准备页，并让准备页的显式开始 / 继续与 Map 现场返回遵守来源重核、前台 gate 和单次提交。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` §“门控、提交与更新边界”与验收 | 来源失效、竞态、单次提交边界 |
| 源码 | `src/ui/components/map/map-entry.ts:renderMapEntryFunctions` | 设施按钮与作者文案 |
| 源码 | `src/ui/controller/controller-actions-operation.ts:mapFunctionAvailable/handleMapClick` | 当前 Map 入口重核、MapRun 点击动作 |
| 源码 | `src/ui/components/map/map-workspace.ts:renderActiveCenter` | 现场返回入口 |
| 源码 | `src/ui/components/map/map-entry-workspace.ts:renderPrimaryAction` | 准备页按钮与前台状态反馈 |
| 源码 | `src/ui/controller/controller.ts:enterMapEntry/returnMapToEntry/returnFromMapEntry` | route-only 会话生命周期 |
| 契约 | `src/arona-clicker/contracts/map/map-entry.ts:MapEntryView` | fresh/resume 的权威当前模式与身份 |
| 机制 | `src/arona-clicker/contracts/story/story-query.ts:isBlockingInteraction` | 覆盖全局与 chat 游标的交互 gate |
| 源码 | `src/ui/interaction/modal.ts:ModalManager.isOpen` | Spot 确认 / 其他前台 modal gate |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k tokens |
| 文档 Read Set | 3 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并拆分 |

## Optional Read Set

- 只有 gate 缺少已有共享 API 时，才查对应 Controller 状态；不得建立新暂停机制。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前 Spot Map 按钮点击会直接 `startMap` 或直接切入 map route | `src/ui/controller/controller-actions-operation.ts:handleMapClick` | 入口需先改为 route map-entry |
| `mapFunctionAvailable` 当前核对当前 Area、utilityKnown、functionality identity，但未重验 condition | `src/ui/controller/controller-actions-operation.ts:mapFunctionAvailable` | 本 Unit 增加条件重核 |
| `StoryService.isBlockingInteraction()` 检查 global cursor 与全部 chat cursors | `src/arona-clicker/services/story/story-service.ts:cursorsForInteractionGate/isBlockingInteraction` | 覆盖跨流阻塞交互 |
| `ModalManager.isOpen()` 可识别前台确认 / modal | `src/ui/interaction/modal.ts` | 入口 / start / continue 前 gate |
| Map Workspace 活动态返回按钮当前回到进入前位置 | `src/ui/components/map/map-workspace.ts:renderActiveCenter` | 改成返回准备页 |

## Constraints

- 打开准备页不调用 `startMap`、不生成 runId；设施来源只写 UI session。
- 开始前重核 map-entry route、同一来源 Spot / functionality / condition、current Area、前台 gate 与最新 `MapEntryView.mode === fresh`，再显式调用一次 `startMap`。
- 继续前重核相同来源与最新 `runId` / Map identity；续行只 `replaceWorkspaceRoute`，不写 Run。
- 另一个 MapRun 可打开准备页查看阻塞原因，但不能开始或静默切换 Map。
- 全局 / chat Story 阻塞、send/story confirmation、opening banner、Spot modal 或重复同步事件均不得绕过门控 / 创建第二局；普通 Tick / 生产不阻塞。
- Map 现场返回准备页只清 UI MapFlow 并保留 Run；返回游戏恢复最初单层 returnTo 并优先恢复来源入口焦点。
- 遵守 Task 0309、`AGENTS.md` 与 `docs/docs-829/05-conventions/architecture-discipline.md`。

## Allowed Files

- `src/ui/components/map/map-entry.ts`
- `src/ui/controller/controller-actions-operation.ts`
- `src/ui/components/map/map-workspace.ts`
- `src/ui/components/shared/app-shell.ts`
- `src/ui/components/map/map-entry-workspace.ts`

## Explicit Non-goals

- 不实施准备页重开 / 放弃确认、局部更新 dispatcher、Datapack Schema 或未来编队。
- 不修改 MapRun Owner、存档、Story Runtime 或前台生产语义。
- 不修改或运行测试。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。若需改 Controller 以外的路由契约、Runtime 命令或超白名单文件，停止并上交。

## Completion Criteria

- [ ] Spot Map 入口只进入 map-entry route；作者入口文案保留。
- [ ] fresh 仅显式开始创建新 Run；resume 仅回到相同 runId。
- [ ] 现场“返回准备页”清 MapFlow、保留 Run 与 `returnTo`；准备页返回日常游戏后恢复入口焦点。
- [ ] gate、source invalidation、stale mode/runId 与重复事件被拒绝并给玩家反馈，不产生双重操作。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 源码类型检查 | 临时配置继承仓库 `tsconfig.json`，以本 Unit 相关 UI 源文件为入口 | 无新增错误 |
| 差异检查 | `git --no-pager diff --check` | 通过 |
| 测试 | 未要求；不修改或运行测试 | — |

## Pre-flight

- Goal：设施按钮只导航；准备页显式 start 唯一创建 Run，continue 只 replace 同 runId；Allowed Files 仅 Map 入口组件、点击控制、Map Workspace 和 PanelState；提交前重核来源、condition、run 和全局 gate；return 保留 Run 与 returnTo；不做重开 / 放弃。
