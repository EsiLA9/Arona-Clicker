# Gameplay B：单体击杀后的来源资源回馈

`gameplay-b:map:enemy-defeated-reward-example` 展示 AG-1 `enemyDefeated`。Party 来源的一次直接 primary damage 命中将 Enemy HP 从正数降至零后，奖励写入来源角色的 MapRun Actor 资源；击败目标与奖励领取者是两个明确身份。

## 作者声明

```ts
effectProgram: {
  resolve: [{ op: 'damage', target: 'primary', amount: 3 }],
  triggers: [{
    id: 'ammo-on-defeat',
    event: 'enemyDefeated',
    effect: { op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1 },
  }],
}
```

`enemyDefeated` 仅允许 Party Actor 对 Enemy primary 使用。TargetSet、`forTargets`、状态到期伤害、已倒地目标、保护拦截、减伤归零或 Shield 全吸收不会发放奖励。回馈在击杀来源完整结算后进入同一 FIFO 和 32 次 Commit 预算；本来源的费用与 Effect Program 不会读取自己的奖励，后续来源可以读取安装后的资源。

## 试玩台

```text
startMap gameplay-b:map:enemy-defeated-reward-example --enter-office --commit-rounds 1
```

预期：白子击败 3 HP 训练靶，`ammo +1` 写给白子；随后观察者读取白子的 ammo 并造成 1 点 HP 损失。最近提交结果中的 Trigger Receipt v3 同时记录被击败的 Enemy 和领取奖励的 Party Actor。
