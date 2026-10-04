# Unit 0215-U7：纯战术 Resolution 计划

## Goal

从冻结的 PreparedBeat、InterventionDraft、受信规则和暂存 RNG cursor 生成单一可解释 Resolution batch，不写 EventRun。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution.md` | Commit 顺序、费用/效果原子性 |
| 源码/测试 | `src/arona-clicker/contracts/operation.ts`、src/arona-clicker/contracts/operation-action.ts、src/arona-clicker/contracts/operation-beat.ts | Run/Plan/Action/Effect 输入输出 |
| 源码/测试 | src/arona-clicker/services/operation-intervention-preview.ts、src/arona-clicker/services/operation-combination-resolver.ts、src/arona-clicker/services/operation-tactical-rng.ts | 使用已校验的干预、协同和随机投影 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–35k token；以单一职责为界，不以行数切碎聚合器 |
| 文档 Read Set | 1 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 若 effect aggregation 需要额外独立机制，先交上游裁定而非悄然扩展 |

## Optional Read Set

- `src/arona-clicker/services/operation-runtime-service.ts`：仅为对齐 EventRun 字段读取。

## Do Not Read by Default

- PlayerState/Mutation、UI、SceneAction、保存编解码与 Datapack Registry。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 当前低层 Run owner 已有 Actor/Track bounded declarations 与 detached snapshot。 | `operation-runtime-service.ts:RunRules/getSnapshot` | Resolution 只能通过临时结果返回给 owner。 |
| 本 Task Action 效果局限 Actor HP/resource、Team resource、EventState numeric track。 | 所属 Task “Action、参与者与临时 Location 战术合同”裁定 | Facts/Predicate/Outcome 由 Task 0217 扩展。 |

## Constraints

- 成本基于 Commit 前同一快照预留，所有 Action cost 完整通过后才可进入随机/效果计算；当 Beat 内资源产出不得支付当 Beat 成本。
- 先固定技能检查清单，再按 Event Actor 声明顺序计算随机结果；组合规则替代输入 Action 效果，但不跳过该 Actor 独立的 Student Skill 检查。
- 将同类 numeric delta 按 actor/team/track/resource key 累加，并对每个 pool 只限幅一次；输出 old/new/delta 及来源记录。
- 任何未声明字段、非法引用、无效 target、数值非有限或 RNG 错误都返回诊断；此函数不能部分修改输入。
- 结果需覆盖行动/Intent、干预前后、支付、组合、技能 roll、状态差异与稳定 ID；不嵌入完整 Run 或内容定义。

## Allowed Files

- src/arona-clicker/services/operation-resolution-planner.ts（新增）
- src/arona-clicker/contracts/operation-resolution.ts（新增）
- tests/engine/operation-resolution-planner.test.ts（新增）
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u07-pure-resolution-planning.md

## Explicit Non-goals

- 不写 Run、不递增 planVersion、不 append history、不发布通知；由 U8 统一提交。
- 不实现 Facts、Predicate、Objective、Location completion/Outcome 或 AC 长期奖励。
- 不实现多 Location 路线和 SceneAction/PlayerCost。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；若需要向 Engine/Mutation 扩大副作用或改变 Task 0217 边界，停止上报。

## Completion Criteria

- [ ] 相同冻结输入与 seed/cursor 输出一致；失败结果不修改任何输入。
- [ ] Team/Actor 多项预留不会超支；协同输入没有重复行动效果或重复支付。
- [ ] HP/resource/track 同 key 的 delta 聚合后只限幅一次，Resolution 清楚列出实际变化。
- [ ] Skill 无触发、触发效果与多 Actor 排序均可重放并由固定输入测试覆盖。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-resolution-planner.test.ts` | 原子 batch、资源、组合/技能和聚合结果通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 人工验收 | 对 resolution result 逐项比对冻结输入与状态差异 | 仅产生声明效果 |
