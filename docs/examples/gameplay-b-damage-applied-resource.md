# Gameplay B：实际受伤后的局内资源回馈

`gameplay-b:map:damage-applied-resource-example` 是一个 AG-1 演练 Map，展示 Enemy primary damage 实际扣除 Party HP 后，为受伤目标增加本局 Actor 资源。它使用 MapRun `damageApplied`，不连接 AC EventBus、永久资源或 Story 状态。

## 定义 Enemy Damage Trigger

```ts
{
  id: 'training-shot',
  target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
  effectProgram: {
    resolve: [{ op: 'damage', target: 'primary', amount: 1 }],
    triggers: [{
      id: 'guard-on-hit',
      event: 'damageApplied',
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'guard', delta: 1 },
    }],
  },
}
```

`damageApplied` 只匹配该 Action 中对单个 `primary` 执行的 AG-1 damage。事件只在最终 HP 实际下降时产生：Trigger Trace 保留 outgoing Modifier 后、damageReduction/Shield 前的请求量，以及结算后的实际 HP 损失。倒地目标、Damage reduction 后请求为零、Shield 完全吸收或实际 HP 没有变化均不触发。回馈资源仍写给该次 damage 的 primary Actor。

## 样例数值与来源顺序

芹香以 9/10 HP 和 0 guard 进入演练。训练敌人先造成 1 点 damage，芹香实际从 9 HP 降到 8 HP，`guard-on-hit` 随后为她增加 `guard +1`。同轮较晚的芹香来源读取 Actor-local guard，并对训练靶造成 1 点伤害。提交后芹香应为 8 HP、1 guard，训练靶应为 4 HP。

Trigger 在父 Enemy 来源完整结算后写入同一个 MapRun 资源计划；后续来源可读到已结算的回馈。Trigger 本身只写资源，不产生新的事件或递归伤害来源。

## 屏幕演练

在开发版迷你控制台运行：

```text
startMap gameplay-b:map:damage-applied-resource-example --enter-office --move-to practice --commit-rounds 1
```

确认 Flow 先显示训练敌人造成 1 点实际 HP 损失，再显示 `guard-on-hit` 为芹香增加 1 guard，最后显示芹香的后续行动使用该 guard 对训练靶造成 1 点伤害。屏幕验收步骤见 [U24 屏幕验收需求单](../plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U24-screen-acceptance-report.md)。
