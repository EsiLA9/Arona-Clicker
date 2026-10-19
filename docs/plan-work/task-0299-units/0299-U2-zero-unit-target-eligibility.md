# Unit 0299-U2：抽卡前过滤无合法单位目标

## Goal

在加权抽牌前排除没有合法 partyCharacter / enemy 目标的单位 Action；过滤后没有行动即保持空 Hand / Wait。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | 施工范围与验证 |
| 文档 | docs/plan-work/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P1 | 零目标合同 |
| 源码 | src/arona-clicker/services/gameplay-b-hand-resolver.ts：resolveCandidates、drawGameplayBHands | 抽卡资格点 |
| 源码 | src/arona-clicker/services/map-run-service.ts：createEncounterSnapshot、restoreMapRun | 传递当前 HP / Enemy 快照 |
| 源码 | src/arona-clicker/contracts/map-run.ts：MapRunEnemyHp | Enemy 当前身份 / HP |
| 测试 | tests/engine/gameplay-b-map-run.test.ts | 抽卡、Wait、RNG 与保存恢复 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 只扩展 Hand / Encounter 直接调用方 |

## Optional Read Set

- Registry 对 Battle / Rest 的 target 合法性限制，仅在测试 fixture 无法构造时查阅。

## Do Not Read by Default

- docs/plan-work/archive/**
- Action Preview UI / Workspace 投影
- 卡牌目录实现；card 目标由 P4 两阶段处理

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Hand resolver 已在加权抽取前做 Action 资格、倒地状态和单行动 Actor / Team affordability 过滤。 | gameplay-b-hand-resolver.ts：resolveCandidates | 可在同一候选边界增加单位目标资格。 |
| Encounter 初始化 / Restore 都重演 drawGameplayBHands，保存 seed / cursor / Hand。 | map-run-service.ts：createEncounterSnapshot、restoreMapRun | 新资格必须由已保存 Encounter HP / Enemy roster 确定。 |
| card 目标依赖全队 Hands 确定后形成的真实卡牌目录。 | gameplay-b-action-preview-resolver.ts：card target branch | U2 不过滤 card 目标，不循环重抽。 |

## Constraints

- 只有 enemy / partyCharacter 的零目标候选在抽卡前硬过滤；none / self 不变，card 继续两阶段。
- 本地目标资格过滤为纯计算，不改变资源、Hand 外选择或随机状态。
- 过滤后候选为空时返回空 Hand；不生成 Wait Action。

## Allowed Files

- src/arona-clicker/services/gameplay-b-hand-resolver.ts
- src/arona-clicker/services/map-run-service.ts
- tests/engine/gameplay-b-map-run.test.ts

## Explicit Non-goals

- 不做情境权重或 Team 虚拟预留。
- 不在 Preview / UI 阶段重抽 Hand。
- 不改 Runtime View / Workspace 接口。

## Stop Conditions

- 当前 Enemy roster / living party snapshot 无法从既有 Encounter / MapRun 状态取得：停止并说明缺失状态合同。
- 需要编辑 Hand 快照结构或加入随机目标状态：停止并上报。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] 没有存活敌人时，enemy Action 不进入抽取候选；无其他候选则空 Hand / Wait。
- [x] 没有任何存活队员可成为 partyCharacter 目标时相同处理。
- [x] card Action 不在本阶段过滤。
- [x] 无目标 Action 不消耗 RNG word，Restore 重演同一 Hand 与 cursor。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| MapRun / draw 回归 | npx vitest run tests/engine/gameplay-b-map-run.test.ts | 通过 |
| 类型检查 | npx tsc --noEmit | 通过 |
| 差异检查 | git diff --check | 通过 |
