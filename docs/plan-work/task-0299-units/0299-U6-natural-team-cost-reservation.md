# Unit 0299-U6：自然 Hand[0] 的虚拟 Team cost 预留

## Goal

按固定队伍顺序抽取自然 Hand[0]，仅在准备计算中预留其 Team costs，使默认自然行动组合尽量可直接 Commit。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | Unit 预算与白名单 |
| 文档 | docs/plan-work/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P3 | 虚拟预算产品规则 |
| 源码 | src/arona-clicker/services/gameplay-b-hand-resolver.ts：drawGameplayBHands、resolveCandidates | Hand 顺序 / 加权不放回 |
| 源码 | src/arona-clicker/services/map-run-service.ts：createEncounterSnapshot、restoreMapRun、setActionOverride | owner 调用、恢复与干预 |
| 源码 | src/arona-clicker/services/map-run-service.ts：resolveEncounterCommitPlan | 整轮真实费用校验 |
| 测试 | tests/engine/gameplay-b-map-run.test.ts | 自然预算、替代牌、Swap 后 readiness |
| 测试 | tests/engine/gameplay-b-map-save-resume.test.ts | 游标 / Hand 重演 |
| 测试 | tests/engine/gameplay-b-map-cards.test.ts：discounts cannot fund unrelated costs... | 适配既有跨角色费用冲突回归：通过明确 PlayerCommand 构造冲突 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 仅扩大到 draw / MapRun 直接调用方 |

## Optional Read Set

- 共享费用既有用例的直接片段，仅在重写基线测试时读取。

## Do Not Read by Default

- docs/plan-work/archive/**
- Action Preview target preference 与 UI；此 Unit 不改目标逻辑
- PlayerState 费用写入；虚拟预留不写全局资源

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前 Hand 按 fixed party 顺序逐人抽取；单角色过滤只用真实起始 Team balance。 | gameplay-b-hand-resolver.ts：drawGameplayBHands / resolveCandidates | 两个角色各自能付费不代表整轮能同时付。 |
| Commit 从整轮起始余额汇总 Actor / Team Action costs，并与 PlayerCost 分开校验。 | map-run-service.ts：resolveEncounterCommitPlan | 效果不能给本轮费用借款。 |
| Hand[0] 是自然行动，非首牌需显式 Swap；空 Hand 为 Wait。 | map-run.ts：MapRunEncounterHand；MapRunActionOverride | 不得隐藏更换 Hand[0]。 |

## Constraints

- 角色按 Map 固定顺序处理。为当前角色选择 Hand[0] 时，在先前自然 Hand[0] 的虚拟 Team cost 后过滤；抽出后只在本地虚拟余额预留其 Team cost。
- 自然 Hand[0] 候选按 context-adjusted tendencyWeight 加权；未选中的其余 Hand 候选继续按原来的单角色 affordability / 不放回规则，可包含会与队友自然行动冲突的备选牌。
- 没有能在剩余虚拟 Team 预算下承担的自然候选时，角色 Hand 为空 / Wait；不为其抽 Hand 备选，也不占预算，继续处理后续角色。
- Actor costs 仍按该角色真实起始 Actor balance 过滤；真实 Team balance / Commit 费用只由正式 Commit 改动。
- 玩家 Swap / PlayerCommand 后以新的 Prepared Actions 重算整轮 Commit readiness；允许干预导致不再可支付。
- 自然预留使用保存状态确定性重演，不增加 randomState 字段或第二份 override。

## Allowed Files

- src/arona-clicker/services/gameplay-b-hand-resolver.ts
- src/arona-clicker/services/map-run-service.ts
- tests/engine/gameplay-b-map-run.test.ts
- tests/engine/gameplay-b-map-save-resume.test.ts
- tests/engine/gameplay-b-map-cards.test.ts

## Explicit Non-goals

- 不改变真实资源、Commit 收费顺序、PlayerCost / Ability / Item 费用或 PlayerCommand 行为。
- 不过滤 Hand 中非首位备选的共享 Team 冲突，不保证玩家改牌后的组合永远可 Commit。
- 不增加 Action、Wait 卡、Override 或隐藏替换自然 Hand[0] 的状态。

## Stop Conditions

- 必须实际扣资源、把 Action 移到 Hand[0] 以外或改变 Hand / Swap / Command 语义才能预留：停止并上报。
- Save / Resume 不能从同一资源 / Party / Encounter snapshot 重演相同 Hand 与游标：停止并查明来源。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] Team=3、前序自然 Action cost=2、后序 cost=2 时，后序自然 Hand 为空 / Wait，整轮自然方案可提交且只扣 2。
- [x] 自然 Action 首位按剩余虚拟预算选择；Hand 备选仍按起始余额候选池抽取，可在手动 Swap 后使 Commit Preview 不可提交。
- [x] 后续角色按自然预留余额继续；没有可支付行为的角色不消耗 RNG 或虚拟预算。
- [x] 多次 Preview 与 Save / Resume 不改变已保存 Hand / RNG；虚拟预留不出现在资源余额或 Receipt 中。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Runtime / Hand / 卡牌回归 | npx vitest run --silent tests/engine/gameplay-b-map-run.test.ts tests/engine/gameplay-b-map-save-resume.test.ts tests/engine/gameplay-b-map-cards.test.ts | 通过：3 files、63 tests。 |
| 类型检查 | npx tsc --noEmit | 通过 |
| 差异检查 | git diff --check | 通过；仅提示工作树既有 CRLF 转换信息，无空白错误。 |
