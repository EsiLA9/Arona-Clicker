import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_DAMAGE_APPLIED_RESOURCE_EXAMPLE_MAP_ID = 'gameplay-b:map:damage-applied-resource-example';

/** A compact AG-1 sample that rewards a Party Actor only after actual HP damage. */
export const gameplayBDamageAppliedResourceExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_DAMAGE_APPLIED_RESOURCE_EXAMPLE_MAP_ID,
  name: '受伤资源回馈演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '训练敌人对芹香造成 1 点实际 HP 损失后，芹香获得局内 guard +1，并在本轮后续行动中用 guard 攻击训练靶。',
    tips: [
      'damageApplied 按最终 HP 损失触发；Shield 完全吸收或减伤后 HP 不变时不会触发。',
      '回馈在 Enemy 来源完成后结算，芹香随后准备的行动可以读取 guard。',
      'guard 是 MapRun Actor 资源，不会写入 AC 永久资源或 Story 状态。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 9, maxHp: 10 },
  ],
  initialActorResources: [{ characterId: 'serika', resourceId: 'guard', value: 0 }],
  initialPlayerCost: 2,
  actions: [{
    id: 'training-shot',
    name: '训练敌人射击',
    description: '对 HP 比率最低的队员造成 1 点伤害；实际损失 HP 后，目标获得 guard +1。',
    eligibleCharacterIds: [],
    agility: { base: 20, max: 20 },
    target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
    tendencyRole: 'attack',
    effectProgram: {
      resolve: [{ op: 'damage', target: 'primary', amount: 1 }],
      triggers: [{
        id: 'guard-on-hit',
        event: 'damageApplied',
        effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'guard', delta: 1 },
      }],
    },
  }, {
    id: 'use-guard',
    name: '利用 guard 反击',
    description: '若芹香本轮已有 guard，就对训练靶造成等量伤害。',
    eligibleCharacterIds: ['serika'],
    agility: { base: 0, max: 0 },
    target: { kind: 'enemy' },
    effectProgram: { resolve: [{
      op: 'when',
      condition: { kind: 'resourceAtLeast', account: 'sourceActor', resourceId: 'guard', value: 1 },
      then: [{ op: 'damage', target: 'primary', amount: {
        kind: 'resourceBalance', account: 'sourceActor', resourceId: 'guard',
      } }],
    }] },
  }],
  nodes: [
    { id: 'entry', title: '入口', description: '进入实际受伤资源回馈演练。' },
    {
      id: 'practice',
      title: '实际受伤与 guard 回馈',
      description: '训练敌人先让芹香损失 1 HP；芹香随后读取 guard +1 并对训练靶造成 1 点伤害。',
      encounter: {
        title: 'damageApplied 回馈',
        enemies: [{ id: 'training-target', initialHp: 5, maxHp: 5,
          actions: [{ actionId: 'training-shot', tendencyWeight: 1 }] }],
        participants: [{ characterId: 'serika', actions: [{ actionId: 'use-guard', tendencyWeight: 1 }] }],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
