# Unit 0215-U8：EventRun 原子 Commit 与窄入口接线

## Goal

将 U4–U7 纯计算接入唯一 EventRun owner，以版本校验与一次 Run 替换提交完整 Beat。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md`、`docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 事务、revision、命令和 Run 所有权边界 |
| 源码/测试 | `src/arona-clicker/services/operation-runtime-service.ts`、`src/arona-clicker/services/operation-entry-service.ts`、`src/arona-clicker/contracts/operation.ts` | 当前 owner 与 facade 写入方式 |
| 源码/测试 | src/arona-clicker/contracts/operation-resolution.ts | Run history 持有的唯一 Resolution DTO |
| 源码/测试 | src/arona-clicker/services/operation-plan-preparation.ts、src/arona-clicker/services/operation-intervention-preview.ts、src/arona-clicker/services/operation-resolution-planner.ts | 被提交的纯计算输入输出 |
| 测试 | `tests/engine/operation-runtime-service.test.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts` | 原子写回和 public entry 契约 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–40k token；涉及 Run owner 可适度超过代码行数预算但须保持单一写入职责 |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 将纯 resolver 留在 U6/U7；不要扩大到 UI/Save/Mutation |

## Optional Read Set

- `src/arona-clicker/runtime-game-instance.ts`：仅当窄 facade 构造接线需调整时读取。

## Do Not Read by Default

- UI/Controller、SaveData、PlayerState Mutation、Datapack/Registry 与全局 EventBus。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Run 修改走 deep copy → 校验 → 单次 slot pointer swap。 | `operation-runtime-service.ts:applyStateDelta` | Beat commit 沿用这一所有权。 |
| 生命周期 listener 异常隔离，通知回调中禁止 Runtime 写重入。 | `operation-runtime-service.ts:publish/assertCanMutate` | Beat 只在完整 swap 后发一次本地通知。 |
| GameInstance facade 目前不公开 raw owner。 | `runtime-game-instance.ts:#operationRuntimeOwner`、`operation-entry-service.ts:createOperationEntry` | 新 API 仍保持窄语义命令。 |

## Constraints

- EventRun 拥有唯一单调 `planVersion`。接受的 draft/state/lifecycle 写命令递增版本并使旧命令失效；拒绝命令不递增版本。
- `OperationRunStartInput` 携带受信 Action/Skill definitions、完整学生 Profile snapshot 与已 admission 的 participant candidate 顺序；U8 在 start 时把完整可运行规则集深拷贝/冻结于该 Run 私有 rules。此后准备、预览、Commit 都只读 Run-start snapshot，不再次 resolve 外部 content。
- owner 将 U4 纯函数产出的当前 PreparedBeat 保存进 EventRun；`reviseIntervention` / `clearIntervention` 只接受 U5 已校验的输入，并将唯一 InterventionDraft 存在 EventRun。start/commit/state mutation 的一次 candidate Run 转换中刷新 PreparedBeat、递增 planVersion 或清理 Draft。
- 命令输入只含 runId、当前 planVersion 与用户干预字段。客户端不能提交 PreparedBeat、cost、效果、resolution 或 state delta。
- Beat Commit 从克隆 Run 开始，先完成完整 validation 与纯 resolution，再一次替换 actor/team/track state、random cursor、beat index、next preparation、Draft 清理和最近 32 条 Resolution。
- 最近 Resolution 记录 Commit 消费的 base planVersion。相同 runId/base version 的 retry 必须先于 stale 检查返回同一 Resolution；不重扣费用、不重掷 RNG、不递增版本、不重复通知。比最近 Resolution 更早的版本返回 stale。Commit API 不接收 Draft payload。
- `applyStateDelta`、`enterLocation`、`completeCurrentLocation`、`finish` 等已有 owner 写口递增版本并使当前 PreparedBeat 失效或按 Task 规定重新准备；读取与失败校验不影响版本。
- `beatResolved` 通知必须在单次 Run swap 后发布；通知回调抛错不能回滚，通知期间的写重入按现有 owner 规则拒绝。

## Allowed Files

- `src/arona-clicker/contracts/operation.ts`
- src/arona-clicker/contracts/operation-resolution.ts
- `src/arona-clicker/services/operation-runtime-service.ts`
- `src/arona-clicker/services/operation-entry-service.ts`
- `tests/engine/operation-runtime-service.test.ts`
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u08-atomic-run-commit-receipt.md

## Explicit Non-goals

- 不暴露 owner 的通用 delta/location/lifecycle/listener API。
- 不接 AC Mutation/Engine EventBus/PlayerState/UI，也不写存档恢复。
- 不支持在生命周期通知中重入、并行 Commit 或跨 Run 命令。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；若必须改 Engine Event、通用架构边界或 SaveData，停止上报。

## Completion Criteria

- [ ] start 创建首个 PreparedBeat；有效 Commit 一次增加版本/Beat/Resolution sequence，并准备下一 Beat。
- [ ] 经校验的 InterventionDraft 作为 EventRun state 保存且可 detached 读取；clear 与 Commit 原子清理或替换它。
- [ ] 旧 run/version、重复干预、位置变化或其他 Run 写入后的 stale command 明确拒绝。
- [ ] 任何验证/规划异常均使 snapshot、Team/Actor/Track 状态、游标、日志、版本与通知数保持不变。
- [ ] 最新 consumed base planVersion 的相同 Commit 重试返回之前 Resolution 且不重复通知；更早版本 stale；Run 仅持有最近 32 条 Resolution。
- [ ] GameInstance.operationEntry 只新增 Beat 语义读/写命令，不暴露 raw owner。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts` | 原子性、重试、stale、通知与窄入口通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构检查 | `npm run check:architecture` | 数据服务边界通过 |
| 人工验收 | 检查运行时写入只有一次 Run pointer swap | 无部分 Beat 状态 |
