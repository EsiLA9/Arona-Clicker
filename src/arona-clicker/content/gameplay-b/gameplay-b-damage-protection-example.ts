import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_DAMAGE_PROTECTION_EXAMPLE_MAP_ID = 'gameplay-b:map:damage-protection-example';

/** An AG-1 two-hit sample showing a one-use Status before Shield and actual-damage Triggers. */
export const gameplayBDamageProtectionExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_DAMAGE_PROTECTION_EXAMPLE_MAP_ID,
  name: '一次性受击保护演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '白子先为芹香施加一次性受击保护和 1 点护盾；训练机器人同轮连续攻击两次，首击被完全拦截，第二击消耗护盾并造成实际 HP 损失。',
    tips: [
      '单次保护先于伤害减免和护盾；首击不改变芹香 HP、不消耗护盾，也不触发 damageApplied。',
      '第二击正常经过护盾和 HP；实际 HP 损失后芹香获得 guard +1。',
      '两次命中发生在同一轮；被消耗完的保护不会进入 roundEnd Status Trace。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
  ],
  initialActorResources: [{ characterId: 'serika', resourceId: 'guard', value: 0 }],
  initialPlayerCost: 2,
  statuses: [{
    id: 'one-hit-ward',
    name: '一次防护',
    description: '完整拦截持有者承受的下一次正向伤害命中。',
    category: 'beneficial',
    kind: 'damageProtection',
    maxStacks: 1,
  }],
  actions: [{
    id: 'prepare-ward',
    name: '准备防护',
    description: '为一名队友增加 1 点护盾与持续一轮的一次性受击保护。',
    eligibleCharacterIds: [],
    agility: { base: 20, max: 20 },
    target: { kind: 'partyCharacter' },
    effectProgram: { resolve: [
      { op: 'shieldAdd', target: 'primary', amount: 1 },
      { op: 'statusApply', target: 'primary', statusId: 'one-hit-ward', stacks: 1, durationRounds: 1 },
    ] },
  }, {
    id: 'double-training-shot',
    name: '训练机器人连射',
    description: '对 HP 比率最低的队员连续造成两次 3 点伤害；实际造成 HP 损失后，目标获得 guard +1。',
    eligibleCharacterIds: [],
    agility: { base: 8, max: 8 },
    target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
    tendencyRole: 'attack',
    effectProgram: {
      resolve: [{ op: 'damage', target: 'primary', amount: 3, repeat: 2 }],
      triggers: [{
        id: 'guard-on-hit',
        event: 'damageApplied',
        effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'guard', delta: 1 },
      }],
    },
  }],
  nodes: [
    { id: 'entry', title: '入口', description: '进入一次性受击保护演练。' },
    {
      id: 'practice',
      title: '单次保护与后续命中',
      description: '白子的能力先于机器人行动；首击被保护拦截，第二击通过护盾与 HP 结算。',
      encounter: {
        title: '保护、护盾与实际受伤回馈',
        abilityActionIds: ['prepare-ward'],
        enemies: [{ id: 'training-robot', initialHp: 20, maxHp: 20,
          actions: [{ actionId: 'double-training-shot', tendencyWeight: 1 }] }],
        participants: [
          { characterId: 'shiroko', actions: [] },
          { characterId: 'serika', actions: [] },
        ],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
