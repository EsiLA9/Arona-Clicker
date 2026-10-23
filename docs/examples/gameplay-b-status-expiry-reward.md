# Gameplay B：Status 自然到期后资源回馈

`gameplay-b:map:status-expiry-reward-example` 是一个 AG-1 Status 生命周期样例。芹香持有两轮 Regen：最后一次 HP tick 后，状态自然到期并给 holder 增加局内 focus。它不连接 AC 永久资源、Story 或 EventBus。

## Status 与自然到期回馈

```ts
statuses: [{
  id: 'patient-regen',
  name: '细心恢复',
  category: 'beneficial',
  kind: 'regen',
  hpPerStack: 1,
  maxStacks: 1,
  onExpire: { resourceId: 'focus', delta: 1 },
}]

effectProgram: {
  resolve: [{ op: 'statusApply', target: 'primary', statusId: 'patient-regen', stacks: 1, durationRounds: 2 }],
}
```

`onExpire` 的 holder 身份来自即将自然到期的 Status 实例，不由 Action `primaryActor` 代替。奖励每个实例结算一次，与 stacks 无关。最后一次 Regen HP tick 先完成，随后到期回馈；同轮新施加的实例不触发到期。主动清除、消费、类别净化、刷新或终局跳过 roundEnd 均不发放奖励。

## 四轮数值

芹香以 6/10 HP 和 0 focus 入场。第一轮施加持续 2 轮的 `patient-regen`，这一轮不 tick：6 HP、剩余 2 轮。第二轮 roundEnd 恢复 1 HP：7 HP、剩余 1 轮。第三轮 roundEnd 最后恢复 1 HP 至 8 HP，状态自然移除后给芹香 `focus +1`。第四轮没有状态、恢复或到期回馈；芹香保持 8 HP 和 1 focus。

## 屏幕演练

在开发版迷你控制台运行：

```text
startMap gameplay-b:map:status-expiry-reward-example --enter-office --move-to practice --ability apply-regen --target-party serika --commit-rounds 4
```

逐轮核对 HP、remainingRounds 和 focus 变化。屏幕验收步骤与人工记录见 [U26 屏幕验收需求单](../plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U26-screen-acceptance-report.md)。
