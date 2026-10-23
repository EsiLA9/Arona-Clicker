# Gameplay B：回合限时伤害减免 Status

`gameplay-b:map:damage-reduction-example` 是可进入的 AG-1 Map，演示固定防御减伤在伤害请求后、Shield 吸收前生效；该 Status 由现有 Status 列表持有并按成功 roundEnd 递减。

## 定义与施加

```ts
statuses: [{
  id: 'cover',
  name: '掩护',
  category: 'beneficial',
  kind: 'damageReduction',
  damageReductionPerStack: 2,
  maxStacks: 1,
}]

effectProgram: {
  resolve: [
    { op: 'shieldAdd', target: 'primary', amount: 1 },
    { op: 'statusApply', target: 'primary', statusId: 'cover', stacks: 1, durationRounds: 2 },
  ],
}
```

`damageReduction` Status 必须显式使用 `beneficial` 类别，只接受正安全整数 `damageReductionPerStack`，不接受 `hpPerStack`。它沿用 Status 的 Map-local ID、来源身份、叠层上限和 `durationRounds` 规则。

## 每次伤害的顺序

1. 求出本 hit 的伤害请求；如有 U17 outgoing CardRef Modifier，先应用并 clamp 到非负。
2. 读取目标当前活动 `damageReduction` Status，按层数减免伤害请求，最低为 0。
3. 将剩余请求交给 Shield，再按 U18 规则扣 HP。

本例的 3 点伤害先减 2 成为 1，再由 1 点 Shield 吸收，因此芹香第一轮 HP 不变。下一轮 Shield 为空，仍剩余 2 点减免，芹香受到 1 点 HP 伤害。Status 按既有 roundEnd 规则在后续两次成功回合边界推进并到期；到期后下一次伤害不再减免。

每个 TargetSet 目标、每次 repeat hit 分别计算。较早语句或来源施加/清理的 Status 会影响后续 hit；倒地单位不应用或消费 Shield/减免。heal、hpChange、revive、burn/regen tick 与 E1/legacy 不使用此减免。

## Trace 与存档

damage Trace 在实际减免时包含总减免量及参与 Status ID、来源、Action、层数、每层值和本次贡献。Commit Flow 按“damage → 减免 → Shield → HP”展示；Status 面板显示名称、层数和剩余轮数。

含 `damageReduction` 定义的 Map 使用 Status Receipt v5；Restore 从 scheduler 起点重放并比较 damage、Status 与 Shield Trace。Scheduler v5/v6、Program Receipt v1/v2、Shield Receipt v1 不因本能力升级。演练 Map 自身 `resumeVersion` 为 1，不升级其他 Map。

屏幕验收步骤见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U22-screen-acceptance-report]]。
