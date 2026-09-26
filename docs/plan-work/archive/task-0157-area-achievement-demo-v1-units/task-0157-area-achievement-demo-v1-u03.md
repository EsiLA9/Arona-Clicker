# Unit 0157-U03：Area 到访门槛进入 Milestone Watch 派生

## Goal

仅对关联 Listener 的 Milestone 按当前 Init 的 Area 到访事实门控 Watch；未关联 Listener 的旧 Milestone 保持原行为。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/04-mechanisms/trigger-effect.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 当前机制与 Unit 纪律 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U02 Receipt | 首访语义与 Registry 前置结果 |
| 源码 | `src/arona-clicker/services/milestone-domain.ts`、`src/arona-clicker/services/milestone-adapter.ts`、`src/data-services/registry/registry.ts`、`src/arona-clicker/types/state.ts` | desired watch、调用点、定义、到访状态 |
| 测试 | `tests/engine/milestone-adapter.test.ts` | 原有 P0 保持与新门槛测试 |

## Context Budget

目标约 10k–20k tokens；仅聚焦 desired watch，超出 2 个额外文件或 60k tokens 时停下上报。

## Optional Read Set

- `src/arona-clicker/state/per-init-fields.ts`，仅在确认 `visitedAreas` 层级时读取。

## Do Not Read by Default

- UI、Runtime Editor、统计、效果执行、历史计划与其他大范围 Runtime 源码。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前 Domain 对所有未完成且有受支持唤醒源的 Milestone 派生 Watch | `src/arona-clicker/services/milestone-domain.ts:43-55` | 尚无 Area 门槛 |
| `visitedAreas` 属于当前 Init 的状态字段 | `src/arona-clicker/types/state.ts`、`src/arona-clicker/state/per-init-fields.ts` | Unit 不新增持久账本 |
| Registry 已有 `milestoneListeners` 和 `areas` 只读表 | U02 Receipt、`src/data-services/registry/registry.ts` | 可按 Listener.areaId 找归属 Init |

## Constraints

- 关联 Listener 的 Milestone 只在 `activeInit` 等于该 Area 的 `initId` 且当前 `visitedAreas` 包含该 Area 时进入 desired watches；否则既不注册也不在 admission 立即完成。
- 未关联 Listener 的 Milestone 原样派生；不改变 Condition 覆盖判断、completed Save 事实或 Adapter 的幂等提交。
- Registry 已保证引用与一对一关系，本 Unit 不重复做加载期校验。

## Allowed Files

- `src/arona-clicker/services/milestone-domain.ts`
- `tests/engine/milestone-adapter.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u03-receipt.md`

## Explicit Non-goals

- 不接 `InitService` 的旅行后即时 reconcile；该生命周期入口留下一 Unit。
- 不扩展 `stat` 唤醒、执行 `then`、修改 UI、Registry 或数据包类型。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若仅改 Domain 无法保证 Adapter 的旧行为，停止并给出最小证据。

## Completion Criteria

- [ ] 未到访的关联目标不派生 Watch，即使条件当前已满足也不完成；到访且处于归属 Init 后可在 reconcile 时追赶完成。
- [ ] 其他 Init 无关联 Watch；未关联的旧 Milestone 行为经回归测试保持。
- [ ] Receipt 记录实际验证和下一个生命周期缺口。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/milestone-adapter.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
