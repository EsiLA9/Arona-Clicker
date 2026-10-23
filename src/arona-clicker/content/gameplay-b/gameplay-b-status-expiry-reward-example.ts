import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID = 'gameplay-b:map:status-expiry-reward-example';

/** An AG-1 lifecycle example that rewards the holder after a Regen Status naturally expires. */
export const gameplayBStatusExpiryRewardExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID,
  name: 'Status 自然到期回馈演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '芹香以 6/10 HP 入场；白子施加两轮再生，第二、三轮各恢复 1 HP，第三轮自然到期后芹香获得 focus +1。',
    tips: [
      '新 Status 不在施加它的同一轮 roundEnd tick。',
      '最后一次 regen HP tick 完成后，才触发 holder 的 focus +1。',
      '只有自然到期会触发；显式清除或消费不会发放回馈。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 6, maxHp: 10 },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 0 },
    { characterId: 'serika', resourceId: 'focus', value: 0 },
  ],
  initialPlayerCost: 2,
  statuses: [{
    id: 'patient-regen',
    name: '细心恢复',
    description: '每轮恢复 1 HP；自然到期后为持有者提供 1 点 focus。',
    category: 'beneficial',
    kind: 'regen',
    hpPerStack: 1,
    maxStacks: 1,
    onExpire: { resourceId: 'focus', delta: 1 },
  }],
  actions: [{
    id: 'apply-regen',
    name: '细心包扎',
    description: '为一名队友施加持续两轮的细心恢复。',
    eligibleCharacterIds: [],
    agility: { base: 10, max: 10 },
    target: { kind: 'partyCharacter' },
    effectProgram: { resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'patient-regen', stacks: 1, durationRounds: 2,
    }] },
  }],
  nodes: [
    { id: 'entry', title: '入口', description: '进入 Status 自然到期回馈演练。' },
    {
      id: 'practice',
      title: '两轮恢复与到期回馈',
      description: '第一轮施加后不 tick；第二、三轮各恢复 1 HP；第三轮结束自然到期后 holder 获得 focus +1。',
      encounter: {
        title: '自然到期的最后一次恢复',
        enemies: [{ id: 'training-target', initialHp: 5, maxHp: 5 }],
        abilityActionIds: ['apply-regen'],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
