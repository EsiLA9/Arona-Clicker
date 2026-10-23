# Task 0320-U27：E4 单次受击保护

状态：实现与自动化验证已完成；屏幕验收需求单已交付，未标记人工通过。U27 接续 U18 Shield、U22 damageReduction、U23/U24 实际 Heal/Damage Trigger 与 U26 Status 自然到期；只新增一次性防御 Status，不改变既有伤害事件资格或伤害结算主链。

## 目标与作者字段

- Map-local `GameplayMapStatusDef` 增加 AG-1 `kind: 'damageProtection'`。字段为 `id`、`name`、可选 `description`、必需 `category: 'beneficial'`、可选 U26 `onExpire`、`kind`、`maxStacks`。
- `stacks` 表示单次受击保护的剩余充能数，每次成功拦截一个正 damage hit 消耗 1 层；不新增 `hpPerStack` 或 `damageReductionPerStack`。`maxStacks` 继续使用 Status 现有 1–99 上限与 `statusApply` 语法。
- 只由 AG-1 Effect Program 的 `damage` hit 消耗；不由 burn、`hpChange`、heal、revive、E1/legacy 或纯 Shield 流程消耗。`statusApply` 可在本轮后续来源开始前建立保护，普通 N+1 roundEnd 首 tick 规则不变。
- Status 实例身份、来源绑定、同来源重施、类别净化、ID 清除、部分层数消费、状态时长与 U26 `onExpire` 继续沿各自已冻结合同执行。

## 命中范围与顺序

- 每个 AG-1 `damage` 语句按 TargetSet 固定顺序及 repeat 命中顺序逐 hit 判断。目标 HP 大于 0、最终 outgoing Modifier 后的 damage 请求大于 0 时，先寻找目标持有的 `damageProtection` 状态；命中时消耗 1 层并把本次 damage request 全部拦截为 0。
- 防护顺序为：raw damage Value → U17 outgoing CardRef Modifier/clamp → `damageProtection` 单次拦截 → U22 damageReduction → U18 Shield 吸收 → HP。被拦截的 hit 不消耗 Shield、不改 HP、不继续经过 damageReduction；叠加的保护层只能各自拦截后续 hit，不会对同一 hit 重复计算。
- 可用保护按剩余轮数最短优先，再按现有稳定 Status 身份顺序及数组位置消费。每 hit 至多消费一个 Status 实例的一层；消费到零层立即移除该实例。不同 source/action 实例分别持有充能。
- 零 damage request、HP 已为 0 的目标、来源 skip 或未执行的 hit 不消耗保护。TargetSet 中每个冻结目标以及 repeat 的每个正 hit 独立判断；同一个 Status 可拦截该伤害程序的首个受保护 hit，后续 hit 按更新后的 Status 继续正常结算。
- 被拦截的 hit 记录为 HP 实际变化 0，因此不触发 U23/U24 `healApplied`/`damageApplied`；同来源其他实际失血 hit 仍按既有顺序触发，所有来源和 Trigger 账本规则不变。

## Trace、Receipt 与原子性

- 每个被拦截的 Program `damage` Trace 增加可选 `damageProtection` evidence，记录最终请求量与使用的完整 Status 来源身份、Status ID、`stacksBefore`/`stacksAfter`、holder 和本次拦截量；没有保护的旧 Trace 形状保持不变。Trace 排列仍与实际 Effect Program hit 次序一致。
- 带 `damageProtection` 状态定义的 Map 使用独立 `statusReceiptVersion: 6`；v6 扩展 Status instance 与 roundEnd `statusKind` 白名单，支持 `damageProtection` 的零 HP tick/Duration 结算。v1–v5 精确字段及 Restore 路径保持，scheduler v5/v6、Program Receipt v1/v2、Shield Receipt v1、Action Trigger Receipt v1/v2 不升级。
- Save/Restore 从 scheduler 起点重新计算 Status 消耗、Program hit Trace、roundEnd Status Trace、剩余 stacks、U26 expiry 与 HP/Shield/资源结果；漏项、重排或篡改会拒绝。若自然到期时仍有充能，U26 `onExpire` 仍只对该 Status 实例奖励一次，不按剩余层数倍增；已消耗完的实例不再到期，也不发奖。
- 所有变化处于同一 detached AG-1 Commit。任何后续来源、Trigger、额度、Trace 或 Owner 安装失败时，不安装保护消耗、Shield、HP、资源或 Receipt 的部分结果。

## 正式样例与验证

- 新增可进入的 AG-1 两段攻击演练：芹香先获得一层 `damageProtection`；同轮敌方一次两 hit 攻击中，首 hit 被拦截且不耗 Shield/HP、不触发 `damageApplied`，第二 hit 正常伤害并可触发现有 U24 handler。Receipt 显示一层消费，RoundEnd Status 不再存在。
- 自动化覆盖 U17 outgoing Modifier 后的请求量、U22 damageReduction 与 U18 Shield 顺序、TargetSet/repeat、同源多层、不同来源充能稳定顺序、零请求与倒地目标不消费、同 Program 先施加/消费后命中、U23/U24 实际 HP Trigger 资格、U26 到期边界、失败原子、Receipt v1–v5 历史与 v6 Restore 篡改拒绝。
- 迷你控制台使用现有 `--enter-office`、`--move-to`、`--ability`、`--target-party` 与 `--commit-rounds` 参数完成单轮演练；不增加脚本语法或中途操作器。
- 演练命令与预期结果见 [[docs/examples/gameplay-b-damage-protection]]；人工屏幕检查记录见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U27-screen-acceptance-report]]。

## 明确排除

- 部分伤害减免、持续多 hit 的“直到轮末”保护、可堆叠不同保护类型、穿透、抗性、Shield 互换或反伤。
- 对 heal、burn、`hpChange`、revive、Enemy/Party 终局清理或 E1/legacy 路径的拦截。
- `damageApplied` 对完全拦截 hit 的响应、一次性 Trigger handler、Status 持有者任意事件订阅、跨 Encounter Status 与 AC EventBus/Tick 写入。
