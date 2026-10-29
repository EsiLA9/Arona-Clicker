# Gameplay B 静态 Tag 与候选池示例

本文展示 MapRun 中静态 Action Tag 和 Map-local 候选池的作者用法。候选池只在抽 Hand 前汇集候选，不形成第二份 Hand 或库存；完整字段以 `GameplayMapDef` 契约为准。

```ts
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { tagRef } from '../../src/engine/core/tag';

export const taggedTrainingMap: GameplayMapDef = {
  id: 'example:map:tagged-training',
  name: '标签与候选池演练',
  resumeVersion: 1,
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko'],
  initialPartyHp: [{ characterId: 'shiroko', initialHp: 8, maxHp: 8 }],
  initialPlayerCost: 0,
  actions: [{
    id: 'cover',
    name: '就地掩护',
    eligibleCharacterIds: ['shiroko'],
    tags: [tagRef('example', ['action', 'defense'])],
    target: { kind: 'self' },
  }],
  candidatePools: [
    {
      id: 'defense-by-tag',
      entries: [{ kind: 'tag', tag: tagRef('example', ['action']), weight: 1 }],
    },
    {
      id: 'team-defense',
      entries: [{ kind: 'pool', poolId: 'defense-by-tag', weight: 2 }],
    },
  ],
  nodes: [
    { id: 'entry', title: '入口' },
    {
      id: 'battle',
      title: '演练场',
      encounter: {
        title: '标签候选演练',
        enemies: [{ id: 'target', initialHp: 4, maxHp: 4 }],
        participants: [{
          characterId: 'shiroko',
          actions: [{ actionId: 'cover', tendencyWeight: 1 }],
          candidatePoolIds: ['defense-by-tag', 'team-defense'],
        }],
      },
    },
    { id: 'exit', title: '出口' },
  ],
  edges: [
    { fromNodeId: 'entry', toNodeId: 'battle' },
    { fromNodeId: 'battle', toNodeId: 'exit' },
  ],
};
```

`cover` 从三条来源路径进入候选集：Encounter 直接候选权重 1、`defense-by-tag` 权重 1，以及 `team-defense` 经引用乘算后的权重 2。抽取前按 `actionId` 合并为一个权重 4 的候选；它不会在 Hand 中出现三次。

Action Tag 使用完整 `TagRef`。Tag 查询遵循同命名空间的层级前缀匹配：示例中的 `example:action` 可匹配 `example:action/defense`。Tag 只用于分类和候选匹配，不会自动增加效果、目标范围或伤害。

作者可以同时提供原有 `actions` 和 `candidatePoolIds`。候选来源顺序固定为直接候选、Pool 引用顺序、池内 entry 顺序；Tag 展开按 Map Action 定义顺序。合并完成后才进行一次资格、费用、目标合法性检查和现有 Tendency 调整，随后沿用 MapRun 的确定性无放回 Hand 抽取。

候选池属于单个 Map，Pool 可以有序引用同 Map 内的其他 Pool；未知引用、循环、非法权重和合并后超出安全整数上限会在 Registry 被拒绝。动态 Tag、运行时临时注入及旧 Operation CardPool 不属于这个合同。
