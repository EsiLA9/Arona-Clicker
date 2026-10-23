# Gameplay B：按实际 HP 变化量触发资源回馈

`gameplay-b:map:actual-amount-threshold-example` 是 AG-1 演练 Map，展示 `damageApplied` 的 `minimumActualAmount` 按最终 HP 损失比较，而不是按伤害请求比较。

## Trigger 门槛

```ts
effectProgram: {
  resolve: [
    { op: 'shieldAdd', target: 'primary', amount: 2 },
    { op: 'damage', target: 'primary', amount: 3 },
    { op: 'damage', target: 'primary', amount: 2 },
  ],
  triggers: [{
    id: 'guard-on-two-hp-loss',
    event: 'damageApplied',
    minimumActualAmount: 2,
    effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'guard', delta: 1 },
  }],
}
```

若省略 `minimumActualAmount`，行为与此前 Trigger 相同：任何正实际 HP 变化都可触发。声明门槛时它必须是正安全整数。Heal 按实际恢复量比较；Damage 按 DamageReduction 与 Shield 结算后的最终 HP 损失比较。未达门槛的事件不写 Trigger Trace、资源意图或队列序号，也不占用 Commit 的 Trigger 预算。

## 样例结算

芹香以 9/10 HP 和 0 guard 进入遭遇。训练敌人先为主目标添加 2 点 Shield，再请求 3 点 Damage；Shield 吸收 2，实际 HP 只损失 1，低于门槛 2，因此不触发。随后请求 2 点 Damage，实际损失正好为 2，`guard-on-two-hp-loss` 为芹香增加 `guard +1`。同轮较晚的芹香来源读取 guard 并对训练靶造成 1 点伤害。提交后芹香为 6 HP、1 guard，训练靶为 4 HP；Trigger Trace 只有第二次受伤事件。

## 屏幕演练

在开发版迷你控制台运行：

```text
startMap gameplay-b:map:actual-amount-threshold-example --enter-office --move-to practice --commit-rounds 1
```

确认 Flow 展示第一击“请求 3、Shield 吸收 2、实际 HP 损失 1”，没有资源回馈；第二击“请求 2、实际损失 2”后芹香获得 guard，并在同轮稍后的行动中造成 1 点伤害。屏幕验收需求与记录见 [U25 屏幕验收需求单](../plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U25-screen-acceptance-report.md)。
