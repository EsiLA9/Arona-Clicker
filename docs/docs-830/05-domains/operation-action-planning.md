# docs-830/05-domains/operation-action-planning — Operation 行动规划与提交

本文回答：一轮 Operation 如何准备行动、接受干预并安全地提交结果。

## 准备与候选

Run owner 根据当前 Location、Scene、Actor 状态和可信 Action 内容生成 `PreparedBeat`。角色手牌由事件、Location 与 Student Profile 声明的 CardPool 合并而成，再按当前合法行动事实筛选；StrategyProfile 只影响合法候选的权重。玩家 Scene 卡牌实例则在 Run 的抽牌堆、手牌和弃牌堆之间移动。

界面可先纯预览干预，或把 Scene 行动批次暂存为草稿。草稿不会直接改写已结算 Run；预览包含成本、目标和可执行结果，用于界面确认。

## Beat 解析与提交

```text
PreparedBeat + 干预草稿
  → 纯 Resolution Planner
  → 校验 runId / planVersion / Location / RNG 游标
  → 深拷贝并更新 Run
  → 发布 beatResolved，建立下一 Beat
```

Planner 选择合法目标、解析行动组合和局部随机，返回候选 Resolution，不持有 Run。Runtime owner 在提交时再次核对命令版本和候选结果与起始快照的一致性，再将数值、成员、位置、RNG 与进度一次性写入新的 Run。过期的 `runId` 或 `planVersion` 不能提交旧预览。

地点完成后，Outcome 评估目标与失败条件；仍有可选 Route 时必须先转场，全部结束后才形成 EventResult。成功奖励由 `claimOutcomeReward()` 防止重复领取。`OperationView` 从 Run 投影当前 Scene、候选和奖励状态，是只读呈现数据。

源码：`src/arona-clicker/services/operation/operation-plan-preparation.ts`、`operation-resolution-planner.ts`、`operation-player-scene-deck.ts`、`operation-progress-evaluator.ts`、`operation-route-evaluator.ts`、`operation-view-projector.ts`。相关测试见 `tests/engine/operation-resolution-planner.test.ts`、`tests/engine/operation-intervention-preview.test.ts`、`tests/engine/operation-view-projector.test.ts`。

准入、Run 状态与恢复见 [[operation-runtime-and-admission]]；UI 工作区入口见 [[read-model-and-ui]]。

## 计划、预览和提交的区别

| 阶段 | 输入 | 输出与边界 |
| --- | --- | --- |
| 准备 | 当前 Run、可信内容与合法行动事实 | `PreparedBeat` 描述当前行动计划；它属于特定 Run 和 planVersion。 |
| 预览干预 | 当前计划与玩家提出的草稿 | 返回可执行性、目标和成本等结果；不直接结算 Run。 |
| 规划 Resolution | 快照、行动和局部随机输入 | 纯计算候选结果，不持有或写入 Run。 |
| 提交 | `runId`、`planVersion` 和当前计划 | owner 验证当前性及结果一致性，再更新 Run 并推进下一步。 |

Character Hand 和 Scene 卡牌实例属于不同的行动内容：前者由合法候选生成，后者在 Run 的牌区间移动。StrategyProfile 改变合法候选的权重，不应把它理解为能使本来非法的行动通过校验。

## 示例：过期计划不能提交

`tests/engine/operation-runtime-service.test.ts` 在同一 Run 上尝试预览不存在的 Action、提交非法干预，并以错误的 `planVersion` 提交 Beat；三者被拒绝后，Run 快照、Character Hand 和随机游标保持不变。`tests/engine/operation-intervention-preview.test.ts` 还覆盖不在当前手牌中的行动、非法目标与费用不足。

因此，看到一个预览不代表状态已经发生变化，也不保证旧预览在下一次状态变化后仍可提交。界面应使用当前 Run / 版本重新发出命令；若命令被拒绝，检查计划、目标和费用，而不是假设已经消费随机数或资源。

## 地点完成后

地点目标和失败条件由 Outcome 评估；有可选 Route 时走路线转换，满足终局条件后形成 EventResult。奖励领取与结果出现是两步，`claimOutcomeReward()` 防止重复领取。Run 初始化、恢复和长期玩家状态边界见 [[operation-runtime-and-admission]]。
