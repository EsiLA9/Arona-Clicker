# Unit 0215-U1：Action/Team 基础合同与 Team Run 状态

## Goal

建立独立 OperationActionDef / Team 合同、EventRun Team tactical resources 与 Actor.teamId 归属；不把 ActionDef 临时放入 EventDef 或建立旧 resolver 来源。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/00-INDEX.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | Runtime 与 Run owner 边界 |
| 文档 | `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md` | 本 Task 规范语义 |
| 历史 | `docs/plan-work/archive/task-0213-gameplay-b-event-runtime-and-session-state.md`、`docs/plan-work/archive/task-0214-gameplay-b-student-participation-and-autonomy.md` | EventRun 与已完成 Actor/Profile 合同来源 |
| 源码/测试 | `src/arona-clicker/contracts/operation.ts`、`src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/operation-definition-validation.ts`、`tests/engine/operation-runtime-service.test.ts` | 当前 Run、初始化和验证行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token |
| 文档 Read Set | 3 篇；Task 0213/0214 仅读指定历史边界 |
| 历史文档 | 2 篇，仅核对已完成契约 |
| 超预算处理 | 拆合同与 Runtime 行为，不扩大 Unit 文件范围 |

## Optional Read Set

- `docs/docs-829/05-conventions/architecture-discipline.md`：仅当 Run state owner 有疑问时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**` 其他历史 Task、UI、Save、Datapack Editor 与无关 Engine 子系统。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Actor 目前持有 bounded HP/resources，Run 独立于 PlayerState。 | `src/arona-clicker/contracts/operation.ts:OperationActorDef/EventRun`、`operation-runtime-service.ts:MutableRun` | 新 Team resources 仍归 EventRun。 |
| Run 由私有 OperationRuntimeService 持有，公开快照 detached。 | `runtime-game-instance.ts:#operationRuntimeOwner`、`operation-runtime-service.ts:getSnapshot` | 不开放 Team raw owner。 |
| Actor 当前没有 Team membership；`factionId` 是非学生身份字段。 | `src/arona-clicker/contracts/operation.ts:OperationActorDef/OperationActorState` | Team membership 新增为显式 `OperationActorDef.teamId`。 |

## Constraints

- Team membership 只从 `OperationActorDef.teamId` 来；不得由 faction、Character 或 participant kind 推导。
- `OperationTeamDef` 仅声明 bounded tactical resources；`EventRun.teamStates` 保存本局副本。该状态不得混入 `playerRouteState.playerCost`。
- `OperationActionDef` 的资源费用只有 `actor` 或 `team` source；team source 要求 actor 有有效 teamId 与声明资源。
- `OperationActionDef` 在此只作为独立类型合同，不挂到 `OperationEventDef`，也不建立第二个 Action resolver；唯一受信内容入口由 U2 接入 `OperationResolvedContent.actionDefinitions`。
- ActionDef 只定义是否要目标及关系；目标偏好 ID 属于 `OperationActorDef.targetPriorityActorIds`，不得将场景 Actor ID 固化到可复用 ActionDef。
- Event 暂存 `locationTactics[]` 结构：每个 Location ID 至多一个规则块，声明 `enabledActionIds` 和 `combinationRules`；本 Unit 校验 Location 存在性、块重复、局部 ID/数组结构、标签槽与 target-match 形状。Action/tag 跨定义引用由 U2 内容入口校验。
- 每个 `OperationActorDef.targetPriorityActorIds` 项必须引用本 Event 中唯一声明的 Actor ID；teamless target relation 遵循主 Task 的固定语义，不从 factionId 推导。
- 使用独立契约/纯验证职责，不把全部新逻辑继续堆入 `operation-runtime-service.ts`。

## Allowed Files

- `src/arona-clicker/contracts/operation.ts`
- src/arona-clicker/contracts/operation-action.ts（新增）
- `src/arona-clicker/services/operation-definition-validation.ts`
- `src/arona-clicker/services/operation-runtime-service.ts`
- `tests/engine/operation-runtime-service.test.ts`
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u01-action-and-team-contracts-receipt.md

## Explicit Non-goals

- 不接入 SceneAction、PlayerCost、Team AI、Datapack/Registry、目标选择或 Run Save。
- 不实现 Intervention、Combination、RNG 或 Action 效果 Resolver。
- 不修改 Task 0213/0214 归档正文或历史 Receipt。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件的默认六条执行；尤其是需要改白名单外文件、新增第二个文件或改变 Engine/PlayerState 边界时停止上报。

## Completion Criteria

- [ ] 独立 Action 合同表达能力门槛、理由、tag、参与者 kind、可选单一 actor/team 费用、目标关系与有限效果字段，不包含可执行脚本；不作为 EventDef 的第二份来源。
- [ ] Team definitions 与 Actor.teamId 被完整验证；Team resources 成为 detached EventRun state，并由唯一 Run owner 初始化。
- [ ] Team/Actor 初始资源边界、重复 ID 与 Actor 引用缺失 Team 得到诊断；无效定义不创建/替换 Run。Action cost 资源声明的跨定义存在性由 U2 admission 校验。
- [ ] locationTactics 不重复绑定同一 Location；未知 Location、重复 enabled Action ID、无效/重复 Combination ID、非整数 priority、重复/空 tag slot 与未知 targetMatch 被结构校验拒绝。
- [ ] targetPriorityActorIds 中的未知/重复 Actor ID 被拒绝；目标关系运行时语义由 U4 的目标选择器实现和验证。
- [ ] PlayerCost、Character/Variant 和 PlayerState 状态没有改变。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-runtime-service.test.ts` | Team Run 副本、边界与原子拒绝通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 人工验收 | 核对 Team state 位于 EventRun，Actor.teamId 是唯一归属依据 | 符合 Task 语义 |
