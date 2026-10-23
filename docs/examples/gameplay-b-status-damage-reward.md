# Gameplay B：Status 持有者受伤回馈

正式样例 Map：`gameplay-b:map:status-damage-reward-example`。

```ts
{
  id: 'steadfast',
  kind: 'regen',
  hpPerStack: 1,
  maxStacks: 1,
  onDamageTaken: { resourceId: 'focus', delta: 1 },
}
```

只有 AG-1 Map 可以声明 `onDamageTaken`。`delta` 必须是正安全整数，资源必须在所有可能成为 primary holder 的 Party／Enemy Actor 资源中声明。该效果写给 Status holder；同一 Status 的多层不增加回馈次数，不同 Status 实例会按 Status ID、来源和 Action 的稳定顺序分别执行。

回馈仅由现有直接 primary `damage` Hit 触发，并要求结算后 HP 实际减少大于零。Shield 全吸收、`damageProtection` 拦截、零伤害、已倒地目标、`hpChange`、Status tick 和 `forTargets` 都不会触发。

Planner 在 Hit 时复制该 holder 的活动 Status。即使同来源的后续语句移除了 Status，已经捕获的回馈仍会执行；Hit 前移除的 Status 不参与。对每个 Hit，Action Trigger 事件按产生顺序和作者声明顺序执行完毕后，才执行该 Hit 的 Status 回馈；同一来源的所有效果规划完成后才结算这些资源意图，因此该来源的后续语句读不到新资源，后续 AG-1 来源可以读取。

Status 回馈只做一次 holder `resourceChange`，不会造成伤害或派生事件。每个实际执行的 Action Trigger、`onDamageTaken` 回馈和 `statusExpired` 回馈共用每次 Commit 32 次预算；超限时整次 Commit 原子拒绝。声明该字段的 Map 每次 Commit 都写 Trigger Receipt v4，允许三个 Trace 均为空；Restore 从 scheduler 起点重算并逐字段比对。旧 Trigger Receipt v1–v3、Status Receipt v1–v7 和 E1／legacy 路径保持各自格式。

运行时展示位于受伤回馈 Flow 行，内容包含 Status holder、Status ID、来源、实际受伤 Hit 与资源前后值。投影只读 Receipt。
