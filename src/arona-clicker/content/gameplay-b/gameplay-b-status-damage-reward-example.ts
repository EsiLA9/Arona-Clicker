import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_STATUS_DAMAGE_REWARD_EXAMPLE_MAP_ID = 'gameplay-b:map:status-damage-reward-example';

/** U31: an Encounter Status rewards its holder only after a direct Hit removes HP. */
export const gameplayBStatusDamageRewardExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_STATUS_DAMAGE_REWARD_EXAMPLE_MAP_ID,
  name: '受伤状态回馈演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '芹香持有坚韧状态时，训练敌人的直接攻击实际扣除 HP 后获得专注。',
    tips: [
      '状态在命中时读取；若该次直接命中实际损失 HP，芹香随后获得 focus +1。',
      'Shield 完全吸收、保护拦截或没有 HP 损失都不会触发回馈。',
      '同一 Action 的后续语句看不到本次回馈，后续 AG-1 来源可以读取更新后的资源。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 0 },
    { characterId: 'serika', resourceId: 'focus', value: 0 },
  ],
  initialPlayerCost: 0,
  statuses: [{ id: 'steadfast', name: '坚韧', description: '每次实际失去 HP 后获得 1 点专注。',
    kind: 'regen', hpPerStack: 1, maxStacks: 1, category: 'beneficial',
    onDamageTaken: { resourceId: 'focus', delta: 1 } }],
  actions: [
    { id: 'apply-steadfast', name: '赋予坚韧', eligibleCharacterIds: ['shiroko'],
      agility: { base: 9, max: 9 }, target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      effectProgram: { resolve: [{ op: 'statusApply', target: 'primary', statusId: 'steadfast', stacks: 1, durationRounds: 3 }] } },
    { id: 'training-hit', name: '训练拳击', eligibleCharacterIds: [], agility: { base: 1, max: 1 },
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '进入受伤回馈演练。' },
    { id: 'practice', title: '实际受伤回馈', description: '为芹香施加状态，观察训练敌人命中后的 focus 变化。', encounter: {
      title: '受伤状态回馈', enemies: [{ id: 'training-target', initialHp: 10, maxHp: 10,
        initialResources: [{ resourceId: 'focus', value: 0 }],
        actions: [{ actionId: 'training-hit', tendencyWeight: 1 }] }],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'apply-steadfast', tendencyWeight: 1 }] }],
    } },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
