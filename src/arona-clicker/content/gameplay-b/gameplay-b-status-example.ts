import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_STATUS_EXAMPLE_MAP_ID = 'gameplay-b:map:status-example';

/** A small, enterable AG-1 author example for applying, consuming, and removing Map-local Statuses. */
export const gameplayBStatusExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_STATUS_EXAMPLE_MAP_ID,
  name: '状态原语演练',
  executionContractId: 'AG-1',
  entryInfo: {
    description: '施加并消耗燃烧，演示按精确 Status ID 清除，以及按类别清除 harmful 状态并保留 beneficial 状态。',
    tips: [
      '第 N 轮施加的新状态从 N+1 轮末开始触发。',
      '再次施加会刷新持续轮数，并在层数上限内叠加。',
      '消耗只减少请求层数；本样例的单一来源不足逻辑由回合结算后的当前状态展示。',
      '清除只匹配目标与 Status ID；目标没有燃烧时成功但不改变状态。',
      '类别净化只移除指定类别：训练目标同时持有燃烧与再生时，清除 harmful 后再生仍保留。',
    ],
  },
  resumeVersion: 4,
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  statuses: [
    { id: 'burn', name: '燃烧', description: '回合末对持有者造成 HP 伤害。', kind: 'burn', hpPerStack: 1, maxStacks: 3, category: 'harmful' },
    { id: 'regen', name: '再生', description: '回合末恢复持有者 HP。', kind: 'regen', hpPerStack: 1, maxStacks: 3, category: 'beneficial' },
  ],
  actions: [
    {
      id: 'apply-burn-and-regen',
      name: '施加燃烧与再生',
      description: '对主目标同时施加 harmful 燃烧与 beneficial 再生，用于演示类别净化。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 1, max: 8 },
      target: { kind: 'enemy' },
      effectProgram: { resolve: [
        { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 },
        { op: 'statusApply', target: 'primary', statusId: 'regen', stacks: 1, durationRounds: 2 },
      ] },
    },
    {
      id: 'remove-harmful',
      name: '清除有害状态',
      description: '清除主目标身上的全部 harmful 状态，保留 beneficial 再生。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 1, max: 8 },
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'statusRemoveCategory', target: 'primary', category: 'harmful' }] },
    },
    {
      id: 'apply-burn',
      name: '点燃训练目标',
      description: '对主目标施加 2 层、持续 2 轮的燃烧。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 1, max: 8 },
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{
        op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 2,
      }] },
    },
    {
      id: 'consume-burn',
      name: '消耗一层燃烧',
      description: '按精确 Status ID 消耗主目标 1 层燃烧，持续时间不变。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 1, max: 8 },
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{
        op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 1,
      }] },
    },
    {
      id: 'remove-burn',
      name: '清除燃烧',
      description: '清除主目标身上所有来源施加的燃烧；没有燃烧时不改变状态。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 1, max: 8 },
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{
        op: 'statusRemove', target: 'primary', statusId: 'burn',
      }] },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '进入状态演练。' },
    {
      id: 'burn-test',
        title: '燃烧测试',
        description: '施加两层燃烧、消耗一层，再清除剩余实例；观察回合结算与空匹配 no-op。',
      encounter: {
        title: '状态演练',
        enemies: [{ id: 'training-target', initialHp: 8, maxHp: 8 }],
        participants: [{ characterId: 'shiroko', actions: [
          { actionId: 'apply-burn', tendencyWeight: 1 },
          { actionId: 'consume-burn', tendencyWeight: 1 },
          { actionId: 'remove-burn', tendencyWeight: 1 },
        ] }],
      },
    },
    {
      id: 'category-test',
      title: '类别净化测试',
      description: '训练目标同时持有 harmful 燃烧与 beneficial 再生；清除 harmful 后再生保留。',
      encounter: {
        title: '状态类别净化演练',
        enemies: [{ id: 'training-target', initialHp: 8, maxHp: 8 }],
        participants: [{ characterId: 'shiroko', actions: [
          { actionId: 'apply-burn-and-regen', tendencyWeight: 1 },
          { actionId: 'remove-harmful', tendencyWeight: 1 },
        ] }],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [
    { fromNodeId: 'entry', toNodeId: 'burn-test' },
    { fromNodeId: 'entry', toNodeId: 'category-test' },
    { fromNodeId: 'burn-test', toNodeId: 'exit' },
  ],
};
