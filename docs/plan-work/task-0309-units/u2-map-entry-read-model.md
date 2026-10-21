# Unit 0309-U2：提供 MapRun 准备页只读投影

## Goal

从 GameInstance 暴露 detached 的 MapEntryView，准确呈现新局准入预览、同图续行快照、其他地图占用与不可用内容。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0309-maprun-staging-and-reentry-workspace.md` §“领域侧：只读准备投影” | DTO 最小字段和 fresh/resume 边界 |
| 约定 | `docs/docs-829/05-conventions/architecture-discipline.md` | 保持 Runtime Owner 与 UI 查询边界 |
| 源码 | `src/arona-clicker/contracts/runtime.ts:MapRunQuery` | 只读查询入口 |
| 源码 | `src/arona-clicker/runtime-game-instance.ts:admitMapParty/startMap/getMapWorkspaceView` | 固定队伍求解、开始和 Run 投影 |
| 源码 | `src/arona-clicker/contracts/map-run.ts:MapRun` | 当前局内状态形状 |
| 源码 | `src/arona-clicker/services/map-run-service.ts:getSnapshot/start/restart` | Owner 的活动 Run 快照、绑定 Map 定义与生命周期 |
| 测试 | `tests/engine/gameplay-b-map-runtime-integration.test.ts` | 运行时查询和状态行为入口；不得削弱既有断言 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k tokens |
| 文档 Read Set | 3 篇以内 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并拆分，不扩大 Allowed Files |

## Optional Read Set

- 只有为显示资源标签或队员身份而出现未决只读来源时，才读取对应 ReadModel / 格式化 helper。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**`

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `MapRunQuery` 当前提供 `getSnapshot`、`getWorkspaceView` 等只读查询，无入口准备投影 | `src/arona-clicker/contracts/runtime.ts:MapRunQuery` | 当前查询门面 |
| `startMap` 先解析 Map，再调用私有 `admitMapParty` 并将结果交给 MapRun Owner | `src/arona-clicker/runtime-game-instance.ts:startMap` | 预览不得调用 `startMap` |
| 准入按解锁 Character 与持有 Variant 检查；候选 Variant 由 roster key 排序后择首个；准入失败抛 `MapRunError` | `src/arona-clicker/runtime-game-instance.ts:admitMapParty` | 同一规则须复用于预览与实际开始 |
| MapRun Owner 提供活动快照，restart 单独创建新局，UI 不直接拥有其可写状态 | `src/arona-clicker/runtime-game-instance.ts`；`services/map-run-service.ts` | 本 Unit 只投影，不改变 Run |
| Owner slot 持有 Run 创建时绑定的 Map 定义，`partyHpCaps` 已按该定义和冻结队伍计算上限 | `src/arona-clicker/services/map-run-service.ts:MapRunSlot/partyHpCaps` | 准备页要由 Owner 输出成员 HP 上限，不能重新解析当前 Registry 定义 |

## Constraints

- 只读、detached、不可变投影；禁止为预览调用 `start`、安装临时 Owner、修改 PlayerState 或 Run。
- fresh/resume 区分初始与当前 HP / 资源；resume 使用冻结 Variant，不重新准入。
- 复用同一固定队伍准入求解；开始提交仍重新验证。
- UI 前台门控与入口来源留给 Controller，不注入 MapRunService。
- 遵守 `AGENTS.md`、`docs/docs-829/05-conventions/architecture-discipline.md` 和 Task 0309。

## Allowed Files

- `src/arona-clicker/contracts/map-entry.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `src/arona-clicker/services/map-run-service.ts`

## Explicit Non-goals

- 不修改 MapRun 的写入、战斗结算、存档协议或 `resumeVersion`。
- 不加入 Spot 前台门控、UI、入口会话、选队或任何新存档字段。
- 不修改测试文件；遵从本轮施工指令，不新增或运行测试。

## Stop Conditions

适用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件的 6 条。若需改动 Allowed Files 外部、查询层必须跨入 UI / 存档，或无法让准入预览和 `startMap` 使用同一求解，停止上交。

## Completion Criteria

- [ ] `MapRunQuery.getEntryView(mapId)` 返回四种明确模式：fresh、resume、blocked、unavailable。
- [ ] 投影包含地图说明、固定队伍成员 / 准入原因、正确 HP cap、初始或当前局内资源，以及 resume 的 runId 与当前进度摘要。
- [ ] 冷启动、另一地图活动、同图续行及不可用 Map 均不触发写操作。
- [ ] `admitMapParty` 与 `startMap` 共享实际准入规则，开始时仍重验。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 测试 | 未要求；不新增或运行测试 | — |

## Pre-flight

- Goal：建立只读准备投影；Allowed Files 仅为新 DTO、Runtime 查询契约与 GameInstance；不做 UI、存档与 Owner 写入；初始值与续行值分开，fresh 准入复用实际开始规则，resume 沿冻结成员。任何必要跨层扩展均停止。
