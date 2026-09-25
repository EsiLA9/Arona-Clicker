# Unit task-0151-PU-4：Milestone Domain 与 EB-T Adapter

## Goal

以 Milestone-specific 窄 mapping 派生未完成 Watch，并注册精确 EB-T wake source；事件仅唤醒完整 Condition 重验。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/04-mechanisms/trigger-effect.md` | Registration / Withdrawal 契约 |
| 文档 | `docs/docs-828/04-mechanisms/state-mutation.md` | 完成提交写入边界 |
| Task | `docs/plan-work/task-0151-milestone-persistent-arrival-facts-p0.md` | P0 capability map 与单调事实边界 |
| Unit | `docs/plan-work/archive/task-0151-units/pu-2-registry-validation-and-schema.md` | Milestone Registry API |
| Unit | `docs/plan-work/archive/task-0151-units/pu-3-save-progress-mutation.md` | 完成提交端口 |
| 源码 | `src/engine/effect/trigger-system.ts:register, withdraw, setRuntimeActionHandler` | EB-T registration 与 action 派发 |
| 源码 | `src/engine/types/trigger.ts:TriggerEventDef` | 精确构造已有 resource / spotLevel / story registration |
| 源码 | `src/engine/expression/condition-system.ts:evaluateExpr` | 完整条件重验 |
| 源码 | `src/arona-clicker/types/ids.ts:isGlobalResource` | 排除 Condition.resource 不读取的全局资源 |
| 源码 | `src/arona-clicker/services/information-reveal-adapter.ts` | 仅参考精确 watch 的窄 adapter 模式 |
| 测试 | `tests/engine/trigger-system.test.ts` | Action 派发与 registration 行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–30k tokens |
| 文档 Read Set | 4 篇，含 Task / 前置 Unit |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k 时停止并重新拆分 |

## Optional Read Set

- `src/arona-clicker/services/information-reveal-domain.ts`：仅在 wake source 边界不清楚时阅读映射实现。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本 Unit 明确列出的自身依赖除外）
- 通用依赖索引、Visibility、UI 与 Statistics 实现

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| resource filter 精确匹配 resource ID，但仅 per-Init Condition.resources 准入 | `trigger-system.ts:matchesEvent`、`condition-system.ts:TARGET_EVALUATORS.resource` | globalResources 明确排除 |
| spotLevel / story wake 分别以 spotId / storyId 精确匹配 | `trigger-system.ts:matchesEvent` | 复用既有 EB-T kind |
| TriggerSystem 当前只有单一 runtime action handler | `trigger-system.ts:runtimeActionHandler` | PU-5 必须保留 Reveal 与 Milestone handler 可达 |

## Constraints

- 仅支持：`alwaysTrue` admission-only；per-Init `resource`、`spotLevel`、`hasReadStory`、`hasReadStoryInRun` reactive。
- AND/OR 组保守要求所有非恒定状态依赖叶都受支持；唤醒后重验整个表达式。
- 精确 filter 分别是 resource、spotId、storyId；不生成任何 TriggerDef 条件编译框架。
- 注册必须先于 admission evaluate；完成调用幂等，成功后撤出目标的所有 Registration。
- 不发 `milestoneCompleted`；Def 缺失不能清理 completed Progress。

## Allowed Files

- `src/engine/effect/trigger-system.ts`
- `src/arona-clicker/services/milestone-domain.ts`（新增）
- `src/arona-clicker/services/milestone-adapter.ts`（新增）
- `tests/engine/trigger-system.test.ts`
- `tests/engine/milestone-adapter.test.ts`（新增；同时验证窄 Domain capability 与 Adapter registration）

## Explicit Non-goals

- Runtime wiring / lifecycle、成就 UI、奖励、通用 ReactiveConditionService、global resource Condition 修复。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。若现有单 action handler 无法在本 Unit 范围安全扩展，记录具体冲突并回交，不自行引入通用框架。

## Completion Criteria

- [x] P0 capability 准入和 desired watches 可确定性派生，global resource 被拒绝。
- [x] Wake Registration 精确过滤；事件唤醒只重验当前完整 Condition / ConditionGroup。
- [x] 正常完成撤出所有该 Milestone Registration；TriggerSystem action 测试通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/trigger-system.test.ts tests/engine/milestone-adapter.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构检查 | `npm run check:architecture` | 通过 |
