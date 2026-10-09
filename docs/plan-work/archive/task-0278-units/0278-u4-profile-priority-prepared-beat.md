# Unit 0278-U4：按 Profile 优先级准备角色行动

## Goal

让每名存活学生从当前 Character Hand 按自己的 Profile 优先级依次尝试可用行动、资源和合法单目标，形成可直接 Commit 的 PreparedBeat。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/context-packs/character.md | Character / Hand 路由 |
| 文档 | docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md | Hand、PreparedBeat 与 target 合同 |
| 源码 | src/arona-clicker/services/operation-runtime-service.ts：preparationSnapshot、bindTacticalContentToCharacterHands | Character Hand 注入点 |
| 源码 | src/arona-clicker/services/operation-plan-preparation.ts：candidateActionsForActor、prepareOperationBeat | 按顺序资格、target 与资源 fallback |
| 测试 | tests/engine/operation-plan-preparation.test.ts、tests/engine/gameplay-b-scene-action-sample.test.ts | 规划顺序及正式 Carousel |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 保持现有纯准备器，不跨入随机池重设计 |

## Optional Read Set

- src/arona-clicker/services/operation-card-candidate-resolver.ts：仅在 Hand 候选排序需要解释时 |

## Do Not Read by Default

- docs/plan-work/archive/**
- 玩家自己的 SceneCard 牌组实现

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前 hand action IDs 被覆盖为 profile actionPriorityIds，手牌抽取次序实际成为规划次序。 | operation-runtime-service.ts：bindTacticalContentToCharacterHands | 规划顺序需按 Profile 优先级与手牌交集生成 |
| Prepare 会按候选顺序检查 Location enable、目标与支付能力，并对失败候选继续后备；Target selector 已按目标偏好排序。 | operation-plan-preparation.ts；operation-target-selection.ts | 不另造 AI / Target 机制 |
| 正式 Carousel 的星野与芹香 Profile 分别声明两张候选 Action，手牌解析及 Beat 注入路径都存在。 | carousel-safety-slice.ts；gameplay-b-datapack.ts；operation-runtime-service.ts | 需要补逐角色 PreparedBeat 断言 |

## Constraints

- 规划只在当前 Character Hand 集合内选择；优先顺序来自现有 Profile，Hand 未列入 Profile 优先级的行动按当前 Hand 顺序追加。
- 死亡 Actor 使用 Wait；战斗单目标语义不变；失败 Action / target / cost 继续下试，最后 Wait。
- Player SceneCard 保持在 playerRouteState.cards 中，不进入 Character Hand。

## Allowed Files

- src/arona-clicker/services/operation-runtime-service.ts
- src/arona-clicker/services/operation-plan-preparation.ts
- tests/engine/operation-plan-preparation.test.ts
- tests/engine/gameplay-b-scene-action-sample.test.ts
- docs/plan-work/task-0278-units/receipts/0278-u4-receipt.md

## Explicit Non-goals

- 不改 Character Hand 抽牌策略、StrategyProfile 权重、Action 定义或非战斗 SceneAction 选择。

## Stop Conditions

按 docs/ai/PROJECT-CONSTITUTION.md 停止条件；若需要修改 CardPool Schema、玩家场景卡区或 target 语义，停止并上报。

## Completion Criteria

- [x] Profile 排序决定手牌内行动优先级，而非抽牌顺序。
- [x] 目标 / 资源 /资格失败可回退下一张行动，所有候选失败时 Wait。
- [x] 多名学生按各自 Profile 与手牌生成稳定计划；Carousel 双卡学生的 Hand 与默认目标直接进入 PreparedBeat。
- [x] 同输入重复准备相同；无 UI target 补充也能提交。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/engine/operation-plan-preparation.test.ts tests/engine/gameplay-b-scene-action-sample.test.ts | 通过 |
