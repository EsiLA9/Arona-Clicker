# Task 0320-U24：实际受伤后的局内资源触发

状态：实现与自动化验证完成；屏幕验收待人工执行，需求单不代表已通过。

## 基线与目标

U23 已建立 AG-1 `healApplied` 局内事件队列、正向 `primaryActor` 资源响应、32 次 Commit 预算及独立 Trigger Receipt v1。本 Unit 增加 `damageApplied`，验证受击后的局内回馈；不接 AC EventBus/TriggerSystem，也不把受击 Trigger 扩展为任意 Effect Program。

## 冻结合同

### 作者字段与事件身份

- `GameplayMapEffectTriggerDef.event` 增加闭合值 `damageApplied`；保留 `healApplied` 完全相同的含义、顺序、目标与结果。
- `damageApplied` 仅匹配同一 AG-1 Action `effectProgram.resolve` 中对单个 `primary` 执行的 `damage`。不监听 TargetSet damage、`hpChange`、revive、E1/legacy damage、Encounter-local burn 或其它 Map 的 Action。
- 每次 primary damage hit 在 CardRef outgoing modifier 后、Status damageReduction 与 Shield 吸收后计算 HP。仅 `beforeHP > afterHP` 时生成事件，`actualAppliedAmount = beforeHP - afterHP`；请求为 0、目标已倒地、DamageReduction 将请求减至 0，或 Shield 完全吸收时均不生成事件。
- Trace 的 `requestedAmount` 是 outgoing CardRef modifier 后、DamageReduction/Shield 前的单次请求伤害；`actualAppliedAmount` 是最终实际 HP 损失的正值。Heal 事件继续按 U23 解释为实际恢复 HP 的正值。
- 每个实际事件依同一 Action `triggers` 数组声明顺序激活 event 相同的 handlers；不匹配的 event handler 跳过。一个来源内多个 Heal/Damage event 按 resolve hit Trace 顺序排入同一 FIFO 队列。
- Trigger effect 仍仅允许一条正向 safe-integer `resourceChange`，账户固定为该事件目标的 `primaryActor`；目标可以在 Damage 后倒地，局内资源仍归该 Actor。资源必须按 Registry/Context 声明给全部可能的 primary Actor。

### 队列、事务和兼容

- 沿用 U23 的来源完成后运行、资源写入归属父来源、只在父来源结算后对后续 AG-1 来源可见、来源自身不能提前读取奖励的规则。
- `healApplied` 与 `damageApplied` 共用一个 Commit FIFO 序号和单 Commit 32 次激活预算；预算按实际 handler 执行次数计数。
- Trigger 仍不能写 HP/Status/Facts/Shield、再派发事件或递归；最大链深固定为 1。错误和超预算整轮拒绝，不安装任何 HP、Shield、Status、资源、费用或 Receipt 变化。
- 延用 `triggerReceiptVersion: 1` 与 `triggerTrace`；`event` 扩为两种闭合值，不升级 Scheduler/Program/Status/Shield Receipt。旧的只有 `healApplied` Trace 的 v1 Save/Resume 仍可按同一版本重放。
- Restore 必须从 scheduler start snapshot 重算两类事件、触发顺序、资源账本和 Receipt，缺失、多余、乱序或篡改拒绝。
- Flow 在 `healApplied` 时显示“实际恢复”，在 `damageApplied` 时显示“实际损失 HP”；保持同一父来源、queueIndex 和资源回馈关系，不增加伪造的 Action/Card 来源。

## 样例和验证

- 正式 AG-1 演练 Map 由 Enemy 以 primary damage 对 Serika 造成 1 点实际 HP 损失后，给 Serika 局内 `guard +1`；同轮较晚的 Serika 来源读取 guard 并对训练靶造成 1 点伤害。
- 自动化覆盖实际受伤触发、Shield 全吸收/减伤无 HP delta 不触发、混合 Heal/Damage event 顺序、后续来源可见、Receipt/Restore、32 次共用预算及超预算整轮原子拒绝。
- 迷你控制台屏幕命令使用：`startMap gameplay-b:map:damage-applied-resource-example --enter-office --move-to practice --commit-rounds 1`。屏幕验收单另记为待人工执行，不声称人工通过。

## 施工切片

- **U24a 作者与 Schema**：事件枚举、AG-1/primary Damage Context、Normalizer 与 Schema sync。
- **U24b Planner/Owner**：实际 HP damage event、混合队列、账本、预算和 Restore replay。
- **U24c ReadModel/Flow/样例**：双事件 Flow 文案、正式 Map、作者说明、自动化与屏幕需求单。

## 明确排除

- 任何 `damageApplied` 的 Shield-only 触发、反击 Damage/Heal、Status Tick/到期事件、Status 持有 Trigger、TargetSet 事件、任意 Trigger Effect、嵌套或跨 Action/Encounter 订阅。
- 持续状态跨 Encounter、通用可组合 Modifier、永久资源/Story 写入和 AC 侧 EventBus/Tick 回调；分别另立合同。

## 实施与验收状态

- U24a–c 已完成：事件闭合枚举/Normalizer/Context/Schema、Planner 实际 HP 损失事件、与 Heal 共用 FIFO/预算、Owner 资源结算/Receipt/Restore、Flow 双事件文案和正式 Map 样例均已接通。
- 正式样例 `gameplay-b:map:damage-applied-resource-example` 中 Enemy 对 9/10 HP Serika 请求 1 点伤害，造成实际 HP -1 并给予 `guard +1`；后序 Serika 来源读取该 guard 后对训练靶造成 1 点伤害。
- Planner 回归覆盖预减伤/预 Shield 请求量、减伤或 Shield 导致 HP 不变、倒地目标、TargetSet、Heal/Damage 混合顺序和共用 32 次激活预算。Owner 样例覆盖 Restore 回放。
- 自动化与静态检查见 [[receipts/U24-receipt]]。人工 Workspace 步骤见 [[U24-screen-acceptance-report]]，状态保持待人工执行。
