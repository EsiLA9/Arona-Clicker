# Unit 0157-U05：两种 Init 累计目标的精确唤醒

## Goal

让 Area Listener 关联的 Milestone 可对 `$InitProducedAmount` 与 `$InitCollectedAmount` 建立资源／物品身份精确的 Watch，并在事件后完整重验条件。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/expression.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 统计与 Unit 边界 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U03 Receipt | 关联门槛已实现 |
| 源码 | `src/arona-clicker/services/milestone-domain.ts`、`src/arona-clicker/services/milestone-adapter.ts`、`src/engine/expression/stat-dsl.ts`、`src/engine/expression/condition-system.ts` | 解析、Watch 与重验 |
| 事件 | `src/engine/types/trigger.ts`、`src/engine/effect/trigger-system.ts` 的 `matchesEvent`、`src/arona-clicker/state/state-mutation-service.ts` 的 `changeResource/addItem/removeItem`、`src/engine/stats/stats.ts` 的统计写入 | 确认写入早于事件、身份精度 |
| 测试 | `tests/engine/milestone-adapter.test.ts` | 统计和拒绝边界 |

## Context Budget

目标约 15k–25k tokens；只看上述符号，超出 2 个额外文件或 60k tokens 时停下上报。

## Optional Read Set

- `tests/engine/stats.test.ts`，仅在已有统计行为不清楚时读取。

## Do Not Read by Default

- UI、编辑器、Effect 实现、历史计划、所有其他统计 DSL。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 两个 DSL 由 `parseStatCall` 解析，ConditionSystem 已能求值 | `src/engine/expression/stat-dsl.ts`、`condition-system.ts` | 只缺 Milestone wake |
| StatsService 在资源／物品实际写入时更新累计桶，统一写入口随后发事件 | `src/engine/stats/stats.ts`、`src/arona-clicker/state/state-mutation-service.ts` | 唤醒后可读最新统计 |
| Milestone Domain 当前 `stat` 不生成来源 | `src/arona-clicker/services/milestone-domain.ts:22-29` | 不可放宽任意 stat |

## Constraints

- 只让关联 Area Listener 的 `stat` 叶进入新能力；DSL 必须精确为上述两种函数、指定 Init 与 Listener 所属 Area 的 `initId` 一致，且有单个资源／物品 key。其他 stat 维持不准入。
- 为资源与物品分别派生精确身份的 wake；不要用 tick、宽 `ConditionDepIndex` 或跨 Init 统计兜底。事件后由现有 Adapter 重验完整 Condition。
- 简单阈值首期只支持数值 `>=` 与 `>`；其他 comparator 不承诺实时唤醒，保持不准入。
- 不修改 StatsService 记账与现有资源／物品事件契约。

## Allowed Files

- `src/arona-clicker/services/milestone-domain.ts`
- `src/arona-clicker/services/milestone-adapter.ts`
- `tests/engine/milestone-adapter.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u05-receipt.md`

## Explicit Non-goals

- 不执行 Listener `then`、新增统计桶、修改任意 Condition 通用求值、UI、Schema 或示范包。
- 不把 `$Global...`、`$CurrentRun...` 或其他 `$Init...` 函数宣布为响应式。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；如果现有事件身份不足以精确唤醒指定统计，停止上报，不使用宽监听替代。

## Completion Criteria

- [ ] 两个指定函数各自有精确 wake 与事件后完整条件重验；花费资源／物品不回退累计值。
- [ ] 别的身份、错误 Init、其他 stat 函数、无关联旧 Milestone 与不支持 comparator 不误获新能力。
- [ ] 监听引入时若统计早已达标，仍按现有 admission 完成。
- [ ] Receipt 记录测试与剩余限制。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/milestone-adapter.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
