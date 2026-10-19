# Unit 0299-U4：有限情境权重与确定性重演

## Goal

在现有 weighted without-replacement Hand 抽取中，用显式 Action tendencyRole 按本轮 HP / Enemy 状态将基础 tendencyWeight 调为 1 倍或 2 倍。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | Unit 白名单与停止条件 |
| 文档 | docs/plan-work/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P2 | 倍率与状态条件 |
| 源码 | src/arona-clicker/services/gameplay-b-hand-resolver.ts：drawGameplayBHands、resolveCandidates | 加权抽取 |
| 源码 | src/arona-clicker/services/map-run-service.ts：createEncounterSnapshot、restoreMapRun | 提供 HP 上下文并重演 |
| 源码 | src/arona-clicker/contracts/map-run.ts：MapRunPartyHp、MapRunEnemyHp | 权威状态输入 |
| 测试 | tests/engine/gameplay-b-map-run.test.ts | 条件 / 概率 / 无写入 |
| 测试 | tests/engine/gameplay-b-map-save-resume.test.ts | 按保存状态复算同一 Hand |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 不改变 Target Preview 或 UI DTO；必要时拆分上下文校验 |

## Optional Read Set

- tests/data/gameplay-b-map-registry.test.ts，只在 role 字段 Registry 合同需要回查时读取。

## Do Not Read by Default

- docs/plan-work/archive/**
- Workspace / Controller / UI 文件
- Ability / Item 情境；它们不是角色 Hand 候选

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Hand 按 party 顺序为每个角色抽最多 3 张、加权不放回；seed/cursor 是 RNG 唯一状态。 | gameplay-b-hand-resolver.ts：drawGameplayBHands、sampleBelow | 情境权重只能改变候选相对概率。 |
| Encounter 初始与 Restore 都使用同一纯 Hand resolver 重演。 | map-run-service.ts：createEncounterSnapshot、restoreMapRun | party current HP、Map HP caps、存活 Enemy 必须来自同一快照。 |
| U3 已添加显式 role；Map Action 源类型与 Registry 不允许从文案推断用途。 | gameplay-map.ts：GameplayMapActionDef；registry-validate.ts | 本 Unit 不改数据字段合同。 |

## Constraints

- recovery + partyCharacter：任一存活合法队员 missingHP / maxHP >= 1/4 时 ×2；recovery + self 只看行动者。
- defense：行动者 currentHP / maxHP <= 1/2 时 ×2。
- attack：target.kind 为 enemy 且至少一个存活合法 Enemy 时 ×2。
- 其他情况 ×1；每个 Action 只有一个 tendencyRole，倍率不得叠乘超过 2。
- 比例阈值用整数 / BigInt 精确比较，不转 float；RNG 仍从已保存 seed/cursor 取样。
- 本轮所有抽牌槽均使用同一情境加权的不放回规则；不从 Hand 外替换自然 Hand[0]。

## Allowed Files

- src/arona-clicker/services/gameplay-b-hand-resolver.ts
- src/arona-clicker/services/map-run-service.ts
- tests/engine/gameplay-b-map-run.test.ts
- tests/engine/gameplay-b-map-save-resume.test.ts

## Explicit Non-goals

- 不改 Hand 数量、资格顺序、自然 Action / Wait 定义或 RNG 算法。
- 不增加权重公式 DSL、叠加 modifier、隐藏 Override 或持久化新的策略 Owner。
- 不改玩家干预后的整轮费用 readiness；Team 预留由 U6 负责。

## Stop Conditions

- MapRun / Restore 无法从当前保存的 party HP、Enemy HP 和 Map HP caps 重建同一权重上下文：停止并报告缺失字段。
- 为实现权重需要保存随机目标、修改 Workspace / Runtime View 或突破 Allowed Files：停止并拆分。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] recovery、defense、attack 的边界条件分别按 P0 触发；不触发时使用原基础 weight。
- [x] 触发条件权重恰为 2 倍；不累乘；三种用途的抽取频率有确定性测试证据。
- [x] 没有合法目标的 Action 先由 U2 过滤，不能靠权重重新加回。
- [x] 同一 Save / Resume checkpoint 重演相同 Hand、cursor、context；Preview 不推进 RNG。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Hand / MapRun 回归 | npx vitest run tests/engine/gameplay-b-map-run.test.ts | 通过 |
| Save / Resume 回归 | npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts | 通过 |
| 类型检查 | npx tsc --noEmit | 通过 |
| 差异检查 | git diff --check | 通过 |
