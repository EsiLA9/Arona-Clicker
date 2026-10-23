# Task 0320-U29：E5 单体击杀回馈

本文冻结 Draft 0312 §3「击杀奖励」的最小可观察合同。当前状态：实现与自动化验证完成；人工屏幕验收待执行。实现结果见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U29-receipt]]，屏幕需求单见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U29-screen-acceptance-report]]。

## 目标

让 Party Actor 的 AG-1 Action 在一次直接主目标伤害命中确实击败 Enemy 后，为来源 Party Actor 增加一个 MapRun Actor 资源。该结果属于 MapRun 内回馈，不写 AC 永久资源、库存或 Story。

## 作者合同

- 在 `effectProgram.triggers` 增加 `event: 'enemyDefeated'`。
- `enemyDefeated` 只允许 Party Actor 来源、`target: 'enemy'` 的 Action；Actorless Ability/Item、Enemy 来源和非 Enemy 主目标均不合法。
- 该事件的 `effect` 仅允许正安全整数 `resourceChange`，账户固定为 `sourceActor`。资源必须已在对应 Party 来源角色上声明。
- `enemyDefeated` 不允许 `minimumActualAmount`；事件本身已表示致死结果，不把它扩成通用伤害阈值或击杀累计器。
- 现有 `healApplied` / `damageApplied` 继续只允许 `primaryActor` 回馈，字段和结果语义保持不变。

## 结果与顺序

- 只检查普通 `damage` 指令逐次命中时的 HP 变化。该条命中必须以 `before > 0` 开始并以 `after === 0` 结束，且伤害语句直接使用单体 `primary` Enemy。
- damageProtection 拦截、damageReduction、Shield 和 HP 下限按既有顺序先结算；只有最终 HP 从正数变为零才产生事件。Shield 完全吸收、请求被减为零、未致死命中以及命中前已经倒地均不触发。
- 只处理当前来源顶层 Effect Program 中的直接命中；TargetSet、`forTargets` 循环体、Status roundEnd tick、`hpChange` 及其它来源不得产生此事件。重复命中按每击判断，至多只有将 HP 从正数降至零的那击触发。
- 每个来源先完整规划和结算自己的费用及 Effect Program，再把符合条件的 Trigger 依命中顺序、同次命中内依声明顺序追加到现有 FIFO。奖励在父来源结算后记入同一 detached 资源账本，只对后续来源可见，不得支付父来源自己的费用或重入当前 Action。
- 沿用单次 Commit 最多 32 个 Trigger activation 的预算及全量原子拒绝；不接入 AC EventBus 或 Tick。

## Receipt 与恢复

- 新增独立 Trigger Receipt v3。其 `enemyDefeated` trace 必须同时保留被击败的 `target` Enemy 与实际领取资源的 `rewardRecipient` Party Actor，不能把事件对象误当成奖励账户。
- Trigger Receipt v3 可与既有 `healApplied` / `damageApplied` trace 及自然 Status 到期 trace 同时出现；到期部分继续使用独立的 `statusExpiryTriggerTrace`。未包含击杀事件的旧回执仍按 v1/v2 原结构和语义重放。
- v3 的事件、命中数值、目标、领取角色、资源写入、FIFO 序号与最终账本必须由 `schedulerStartSnapshot` 重新规划并逐项核对；任一字段或收款对象篡改均拒绝恢复。
- 本 Unit 不升级 Scheduler、Program、Shield 或 Status Receipt 版本；不改变旧 v1/v2 Restore 路径。

## 验证边界

覆盖命中致死、非致死、已倒地、保护拦截、减伤归零、Shield 全吸收/部分吸收、TargetSet 与 `forTargets` 排除、多段命中、Party 来源与 Enemy 主目标校验、资源发给来源角色、后序来源读取、预算/原子性、v3 与自然到期共存、保存恢复及事件/收款身份篡改拒绝。既有 v1/v2 Heal/Damage 和 Status 到期样例作为兼容回归。

正式 DataPack 样例随后展示：Party Action 对 Enemy 造成致死主目标命中后来源角色弹药 `+1`；未致死或只有 Shield 吸收时不奖励，后序 Party 来源可读到奖励。
