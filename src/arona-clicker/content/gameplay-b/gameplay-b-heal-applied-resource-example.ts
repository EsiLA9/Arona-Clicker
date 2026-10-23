import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_HEAL_APPLIED_RESOURCE_EXAMPLE_MAP_ID = 'gameplay-b:map:heal-applied-resource-example';

/** A small AG-1 example rewarding the recipient only after actual HP restoration. */
export const gameplayBHealAppliedResourceExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_HEAL_APPLIED_RESOURCE_EXAMPLE_MAP_ID,
  name: '受治资源回馈演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '白子为芹香治疗 3 点；芹香实际恢复 1 HP 后，通过 healApplied 获得 1 点局内 focus。',
    tips: [
      '触发依据是 HP 实际增加量，而不是 heal 请求量。',
      '若目标已满 HP 或本次治疗没有实际恢复，不产生 focus 回馈。',
      '回馈属于本局 Actor 资源，不修改 AC 永久资源或 Story 状态。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 9, maxHp: 10 },
  ],
  initialActorResources: [{ characterId: 'serika', resourceId: 'focus', value: 0 }],
  initialPlayerCost: 2,
  actions: [
    {
      id: 'encourage',
      name: '鼓励芹香',
      description: '为芹香请求恢复 3 点 HP；实际恢复后芹香获得 1 点局内 focus。',
      eligibleCharacterIds: [],
      agility: { base: 10, max: 10 },
      target: { kind: 'partyCharacter' },
      effectProgram: {
        resolve: [{ op: 'heal', target: 'primary', amount: 3 }],
        triggers: [{
          id: 'focus-on-heal',
          event: 'healApplied',
          effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
        }],
      },
    },
    {
      id: 'read-focus',
      name: '以专注还击',
      description: '仅当本轮较早的治疗已为芹香恢复 focus 时，按她来源开始可见的 focus 对训练靶造成伤害。',
      eligibleCharacterIds: ['serika'],
      agility: { base: 0, max: 8 },
      target: { kind: 'enemy' },
      effectProgram: {
        resolve: [{
          op: 'when',
          condition: { kind: 'resourceAtLeast', account: 'sourceActor', resourceId: 'focus', value: 1 },
          then: [{ op: 'damage', target: 'primary', amount: {
            kind: 'resourceBalance', account: 'sourceActor', resourceId: 'focus',
          } }],
        }],
      },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '进入实际治疗回馈演练。' },
    {
      id: 'practice',
      title: '治疗与资源回馈',
      description: '为 9/10 HP 的芹香请求治疗 3；她实际恢复 1 HP 后获得 focus +1。',
      encounter: {
        title: 'healApplied 回馈',
        enemies: [{ id: 'training-target', initialHp: 5, maxHp: 5 }],
        abilityActionIds: ['encourage'],
        participants: [{ characterId: 'serika', actions: [{ actionId: 'read-focus', tendencyWeight: 1 }] }],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
