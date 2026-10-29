# Gameplay B：实际治疗后的局内资源回馈

`gameplay-b:map:heal-applied-resource-example` 是一个 AG-1 作者样例，演示只有实际恢复 HP 后才产生 `healApplied` 事件。样例不连接 AC EventBus、永久资源或 Story 状态。

## 声明治疗与 Trigger

```ts
{
  id: 'encourage',
  name: '鼓励芹香',
  target: { kind: 'partyCharacter' },
  effectProgram: {
    resolve: [{ op: 'heal', target: 'primary', amount: 3 }],
    triggers: [{
      id: 'focus-on-heal',
      event: 'healApplied',
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
    }],
  },
}
```

Trigger 只监听所属 Action 的单体 `primary` Heal。事件资格使用 Heal 结算后的 HP：`actualAppliedAmount = after - before`。只有实际恢复大于 0 才会触发；满血目标、倒地目标和请求为 0 的治疗不会产生事件。本例的 Trigger effect 只增加受治目标的 Map-local `focus`，不包含第二次 HP 效果或嵌套 Trigger。

## 样例数值

芹香以 9/10 HP 和 0 focus 进入演练。白子请求恢复 3 HP；Heal Trace 应显示 `9 → 10`、实际恢复 `+1`。随后 `focus-on-heal` 对该受治目标写入 `focus +1`，最终芹香为 10 HP、1 focus。

同轮较晚执行的芹香来源读取自己的局内 Focus：至少为 1 时，对训练靶造成等量伤害。因此预览还应显示来源顺序为 Ability 后接芹香行动，以及训练靶受到 1 点伤害。这证明回馈在父来源结算后、后续 AG-1 来源之前已可见。

自动化还以满血芹香测试无恢复路径：Heal 请求仍为 3，Trace 显示 `10 → 10`、实际恢复 0；没有 Trigger Receipt，也不增加 focus。这样可区分“请求治疗”与“实际受治”。

## 屏幕演练

在开发版迷你控制台运行：

```text
startMap gameplay-b:map:heal-applied-resource-example --enter-office --move-to practice --ability encourage --target-party serika --commit-rounds 1
```

确认本轮 Heal 实际恢复 1 HP，随后 Trigger Flow 说明芹香获得 `focus +1`；再确认芹香的后续行动读取该 Focus 并对训练靶造成 1 点伤害。提交后芹香应为 10 HP、1 focus，训练靶为 4 HP。该数值只属于当前 MapRun。

屏幕步骤与人工记录模板见 [U23 屏幕验收需求单](../plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U23-screen-acceptance-report.md)。
