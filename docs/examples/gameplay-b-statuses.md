# Gameplay B Status 示例：Encounter-local Status 的分类净化与层数操作

本文展示 Map Action 如何声明带有类别的 `burn` / `regen` Status、施加层数、按精确 Status ID 消耗指定层数、按 ID 清除，以及按类别净化。真实可进入的 AG-1 内容样例位于 `gameplayBStatusExampleMap`，Map 入口标签为“进入状态原语演练”。该 Map 的 `resumeVersion` 为 4，因为它声明了 `statusRemoveCategory`。

## 声明 Map-local Status

```ts
statuses: [
  {
    id: 'burn',
    name: '燃烧',
    description: '回合末对持有者造成 HP 伤害。',
    kind: 'burn',
    hpPerStack: 1,
    maxStacks: 3,
    category: 'harmful',
  },
  {
    id: 'regen',
    name: '再生',
    description: '回合末恢复持有者 HP。',
    kind: 'regen',
    hpPerStack: 1,
    maxStacks: 3,
    category: 'beneficial',
  },
],
```

`id` 只在 Map 内引用。`kind` 当前仅接受 `burn` 与 `regen`；`hpPerStack` 是每层在 roundEnd 的 HP 变化量，`maxStacks` 限制同一持有者、Status 和来源组合的层数。`category` 是可选作者元数据，只接受 `harmful` 或 `beneficial`；未分类的 Status 不会被类别净化匹配。它不会从 `kind`、名称或显示样式推断。Map 最多定义 64 个 Status，层数上限为 99。

## 从 Action 施加

```ts
{
  id: 'apply-burn',
  name: '点燃训练目标',
  eligibleCharacterIds: ['shiroko'],
  target: { kind: 'enemy' },
  effectProgram: {
    resolve: [{
      op: 'statusApply',
      target: 'primary',
      statusId: 'burn',
      stacks: 1,
      durationRounds: 2,
    }],
  },
}
```

`statusApply.target` 只接受 `source` 或已解析的 `primary` 单位；不能指向 CardRef、Team 或 MapRun。`stacks` 必须为正整数，且不超过该定义的 `maxStacks`；`durationRounds` 为 1–99。Actorless Ability / Item 没有 `source` 单位，只能使用 `primary`。

## 按 ID 消耗部分层数

`statusConsume` 仅用于 AG-1 Map，形状为 `{ op: 'statusConsume', target, statusId, stacks }`。目标规则与 `statusApply`、`statusRemove` 相同；`statusId` 必须是本 Map 声明的精确 ID，`stacks` 是 1–99 的正整数常量。

```ts
{
  id: 'consume-burn',
  name: '消耗一层燃烧',
  eligibleCharacterIds: ['shiroko'],
  target: { kind: 'enemy' },
  effectProgram: {
    resolve: [{ op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 1 }],
  },
}
```

执行时只匹配解析出的 holder 与 Status ID。若有多个来源实例，先消费 `remainingRounds` 最小、也就是较早到期的实例；到期轮数相同时按稳定的 Status ID、来源 key、Action ID 顺序处理。每个实例最多消费其现有层数；层数降到 0 就移除实例，否则只改 `stacks`，不会改持续轮数、来源或 Action 归属。可用总层数少于请求时仍成功并消费全部可用层数，Receipt 记录 `requestedStacks`、`consumedStacks` 和 `unmetStacks`；没有匹配项时也是成功 no-op，`changes` 为空、实际消费为 0。

正式样例只演示单一来源：第一轮施加 2 层，下一轮消耗 1 层，并在该轮 roundEnd 后保留剩余 1 层。多来源到期优先和不足请求的规则由通用合同定义；这个最小样例不单独构造多来源或不足场景。

## 按类别全量净化

`statusRemoveCategory` 仅用于 AG-1 Map，形状为 `{ op: 'statusRemoveCategory', target, category }`。目标只能是已解析的 `source` 或单位 `primary`；Map 必须至少声明一个与所选类别相同的 Status。它只清除这个 holder 身上类别匹配的完整活动实例，不会改变另一类别或未分类实例。

```ts
{
  id: 'remove-harmful',
  name: '清除有害状态',
  eligibleCharacterIds: ['shiroko'],
  target: { kind: 'enemy' },
  effectProgram: {
    resolve: [{ op: 'statusRemoveCategory', target: 'primary', category: 'harmful' }],
  },
}
```

正式样例的 `apply-burn-and-regen` 在同一训练目标上施加 `burn/harmful` 与 `regen/beneficial`。随后执行 `remove-harmful`：Receipt 的 `statusCategoryRemoveTrace` 列出被移除的燃烧实例，`plannedStatuses` 与活动状态保留再生。类别移除在 roundEnd 结算前生效，因此此轮只对保留的再生结算，不会把燃烧伤害和再生恢复的先后顺序混入清除示例。没有匹配实例时仍成功，`removed` 为空；多实例按稳定 Status 顺序完整记录原索引和实例。

## 精确清除

`statusRemove` 仅用于 AG-1 Map，形状为 `{ op: 'statusRemove', target, statusId }`。目标只能是已解析的 `source` 或单位 `primary`；Actorless Ability / Item 只能使用 `primary`。`statusId` 必须是本 Map `statuses` 中声明的精确 ID。

```ts
{
  id: 'remove-burn',
  name: '清除燃烧',
  eligibleCharacterIds: ['shiroko'],
  target: { kind: 'enemy' },
  effectProgram: {
    resolve: [{ op: 'statusRemove', target: 'primary', statusId: 'burn' }],
  },
}
```

执行时会从该目标移除所有同 ID 的活动实例，不区分由哪个 Character、Enemy、Ability、Item 或 Action 施加；其他目标和其他 Status 保持不变。找不到匹配实例是成功的 no-op，仍会写入访问 Trace 和空的 `removed` 列表。`statusApply`、`statusConsume` 与 `statusRemove` 按 Program 顺序生效：后续语句会看到前序变化；同轮先施加再清除时最终没有该实例，先施加再消费时只留下剩余层数。

清除只改 detached Status 列表，不改 HP、费用、资源或 MapRun Facts，不产生触发事件，也不会复活单位。新的 `statusRemove` 只准入 AG-1；E1/legacy 的既有 `statusApply` 与 Status Receipt v1 保存恢复行为保持不变。

## 轮次、重施与来源

第 N 轮施加的全新实例不会在 N 轮末触发，首次在 N+1 轮末结算。剩余轮数只随成功提交的 Encounter 回合边界递减；停留页面或 AC Tick 不会推进状态。burn 扣 HP，regen 恢复 HP，两者沿用普通 HP 上限和不复活规则。

Status 实例按持有单位、Status ID、Effect Program 来源身份和声明它的 Action ID 区分。同一来源重施会将层数累加到 `maxStacks`，并把持续轮数刷新为本次申请值；同一持有者由不同 Action、Character、Enemy、Ability 或 Item 来源施加时，会保留独立实例。进入新 Encounter 或离开当前 Encounter 后，实例清除。

完整定义见 [GameplayMapDef 与 Effect Program 契约](../docs-829/03-data-structures/datapack-contracts.md)。当前示例 Map 已接入 AG-1 MapRun Owner：可施加燃烧与再生、部分消费燃烧、按精确 ID 清除，并按 `harmful` 类别清除而保留 `beneficial` 再生。由于 Map 声明 `statusRemoveCategory`，每次 AG-1 Commit 使用 Status Receipt v4，并包含显式的 `statusCategoryRemoveTrace`；未使用类别净化的提交该 Trace 为空数组。Receipt 版本独立于保持 v5 的 scheduler 格式。内容入口仍是普通 Registry Map，不会在 UI 侧模拟状态规则。
