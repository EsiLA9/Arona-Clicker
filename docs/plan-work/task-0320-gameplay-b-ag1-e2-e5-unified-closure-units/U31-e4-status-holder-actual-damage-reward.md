# Task 0320-U31：Status Holder 实际受伤回馈

状态：合同已冻结；实现、自动化和回执待完成。屏幕验收如用户不执行，则提供需求单并保持未通过。

## 目标与范围

为 Map-local Status 增加一种窄的 holder 事件：Status 持有者因当前已有 AG-1 `damageApplied` 事件实际失去 HP 后，由该 Status 定义给持有者增加一种已声明的局内 Actor 资源。它为 Draft 0312 §7 的状态持有者反应提供可重放首片，不实现反击 Damage 或通用 Status 监听器。

新增可选定义：

```ts
onDamageTaken?: { resourceId: string; delta: number };
```

`delta` 必须是正安全整数。资源写给 Status holder；不按 Status stacks 放大奖励。

## 冻结语义

- 仅 AG-1 Gameplay Map 接受 `onDamageTaken`。省略时不监听受伤事件；Encounter-lifetime 与 U30 MapRun-lifetime 的既有 Status 均可选择该字段，E1/legacy 格式不变。
- 只响应现有 `damageApplied` 事件：一次直接 primary `damage` hit 经 CardRef Modifier、`damageProtection`、`damageReduction`、Shield 和 HP cap 结算后，primary holder HP 的实际减少量必须大于 0。每次符合条件的 hit 单独匹配；不由 Effect 请求量、Status tick `burn`、`hpChange`、`revive`、TargetSet/`forTargets`、Shield 全吸收、保护拦截、零伤害、满血/no-op 或已倒地目标触发。
- 在 Planner 处理 Hit 的位置捕获当时投影中的活动 Status 快照；此前语句已移除的 Status 不匹配，该 Hit 后才移除的 Status 不取消已排入的回馈。Hit-time 快照只生成本来源的有序资源意图，仍在整个来源 Effect Program 规划完成后才执行；同一来源的后续语句不会读到本次回馈，只有后续 AG-1 来源可见。每个 Status 实例按 holder/Status/source/Action 稳定顺序执行一次；同一 Status 多层仍只回馈一次，不同来源实例分别回馈。
- 同一 Hit 的触发序严格为：先按现有 Planner 事件产生顺序，执行全部 Action Trigger handlers（例如 `damageApplied` 后接 `enemyDefeated`，每一事件按作者声明顺序）；然后执行该 holder 的 `onDamageTaken` Status handlers；之后才处理 EffectTrace 中的下一个 Hit。自然到期回馈仍在所有来源及 Hit 回馈之后，按既有 `statusTrace` 顺序结算。
- 每项回馈只执行有限 `resourceChange(holderActor, resourceId, +delta)`，不产生 Damage、Heal、Status、地图移动或新的 Trigger 事件；回馈结果只对后序 AG-1 来源可见。Holder 可在该 Hit 后倒地，仍按 hit-time Status 快照回馈。
- `onDamageTaken` 资源必须在 Map 对应 Party／Enemy Actor 资源声明中存在，确保每种可成为 primary holder 的来源都可写入。MapRun Status 仍限 U30 的 Party holder 规则。
- Action Trigger handlers、Status `onDamageTaken` handlers 和 U26 `statusExpired` handlers 共用每 Commit 32 次队列预算；预算只计真正执行的 handler/callback，不计没有 listener 的事件、过滤尝试或单纯 `enemyDefeated` 事件。每个匹配 Status 实例 × 实际 Hit 计一次，不按 stacks；U26 每个自然到期回调计一次。任一计划超过预算时整次 Commit 拒绝，不写入 HP、Shield、Status、资源、游标或 Receipt。
- 所有 handler 依 AG-1 source execution 顺序。对每个直接 Damage Hit，Action handler 按 Planner 事件产生顺序及作者声明顺序，其后是 hit-time Status handler 稳定顺序；下一个 Hit 再依次处理。自然到期回馈最后按既有 `statusTrace` 顺序结算。
- 每个声明了 `onDamageTaken` 的 Map，其所有 AG-1 Commit 使用 Trigger Receipt v4，包括没有实际受伤或没有匹配 holder 时的空 `statusDamageTriggerTrace: []`；v4 允许 Action `triggerTrace` 与到期回馈 Trace 同时为空。独立字段记录 Hit 快照、Status holder 身份、实例 Origin/应用时长、资源前后值与队列顺序。v4 Restore 从 scheduler 起点重算所有 Status/Hit 输入与回馈。该版本只扩展 Trigger Receipt；Status Receipt 仍按 Map Status 能力使用 v1–v7，scheduler v5–v7、Trigger Receipt v1–v3 与 E1/legacy 继续原分支，不在旧格式中添加字段或重解释事件。
- ReadModel 与 Flow 只读呈现 Status holder、Status ID、来源、对应实际 Hit 和资源变化；不得在投影阶段安装回馈。

## 最小示例与验收

- 新增可进入 AG-1 Map：训练敌人对持有 `onDamageTaken` Status 的 Party 成员请求伤害。实际扣除 HP 后 holder 获得 `focus +1`；Shield 全吸收和 `damageProtection` 拦截均不给资源。后续 Party 来源可以读到 focus。
- 自动化覆盖实际伤害／Shield／保护/no-op 触发边界、同一次 Hit 多 Status 稳定顺序、多次 Hit 各触发、倒地 holder、同来源后续读取、32/33 预算与原子拒绝、Save/Resume／Receipt 篡改拒绝、Status 清除和 MapRun Root 所有权。
- 屏幕验收需求单展示一条迷你控制台入口命令与宽屏鼠标检查步骤。自动化、ReadModel 或命令结果不代表人工屏幕验收通过。

## 明确不纳入

- 对伤害来源反击 Damage；后续若纳入须单独冻结递归抑制、目标失效、反击击杀与 `enemyDefeated` 交互。
- Status `onApply`、重施、移除、消费、净化、任意 round hook 或通用 Trigger Program。
- Shield-only / 被拦截的请求事件、Status tick Burn 造成的事件、TargetSet/`forTargets` 的多目标订阅。
- 百分比/乘法伤害或费用 Modifier、通用事件总线和 AC Tick/EventBus 写回。
