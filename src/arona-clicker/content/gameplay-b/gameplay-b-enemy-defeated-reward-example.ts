import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_ENEMY_DEFEATED_REWARD_EXAMPLE_MAP_ID = 'gameplay-b:map:enemy-defeated-reward-example';

/** AG-1 sample for one direct Enemy defeat awarding a MapRun resource to its Party source. */
export const gameplayBEnemyDefeatedRewardExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_ENEMY_DEFEATED_REWARD_EXAMPLE_MAP_ID,
  name: '单体击杀回馈演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '白子以单次主目标攻击击败训练靶后，获得局内 ammo +1；后续观察者读取白子的 ammo 并作出反应。',
    tips: [
      '只有一次直接 damage 命中使 Enemy HP 从正数降至 0 才触发 enemyDefeated。',
      '奖励对象是来源角色白子；受击目标仍记录为训练靶。',
      '没有击杀、目标原已倒地、伤害被保护拦截或仅由状态到期造成倒地时均不发奖励。',
      'ammo 是 MapRun Actor 资源，不会写入 AC 永久资源或 Story 状态。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 9, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'ammo', value: 0 },
    { characterId: 'serika', resourceId: 'ammo', value: 0 },
  ],
  initialPlayerCost: 0,
  partyAgility: [],
  actions: [
    {
      id: 'finish-training-target',
      name: '终结训练靶',
      description: '造成 3 点主目标伤害；确实击败 Enemy 时，来源角色获得 ammo +1。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 20, max: 20 },
      target: { kind: 'enemy' },
      effectProgram: {
        resolve: [{ op: 'damage', target: 'primary', amount: 3 }],
        triggers: [{
          id: 'ammo-on-defeat',
          event: 'enemyDefeated',
          effect: { op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1 },
        }],
      },
    },
    {
      id: 'wait',
      name: '观察',
      description: '本轮不执行额外行动。',
      eligibleCharacterIds: ['serika'],
      agility: { base: 0, max: 0 },
      target: { kind: 'none' },
    },
    {
      id: 'observe-ammo',
      name: '观察弹药回馈',
      description: '若白子持有 ammo，就对当前目标造成 1 点伤害。',
      eligibleCharacterIds: [],
      agility: { base: 0, max: 0 },
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      tendencyRole: 'attack',
      effectProgram: {
        resolve: [{
          op: 'when',
          condition: { kind: 'resourceAtLeast', account: 'primaryActor', resourceId: 'ammo', value: 1 },
          then: [{ op: 'damage', target: 'primary', amount: 1 }],
        }],
      },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '进入单体击杀回馈演练。' },
    {
      id: 'practice',
      title: '致死命中与来源奖励',
      description: '白子先击败 3 HP 训练靶并获得 ammo；观察者随后读取白子的 ammo。',
      encounter: {
        title: 'Enemy Defeated 回馈',
        enemies: [
          { id: 'training-target', initialHp: 3, maxHp: 3 },
          { id: 'observer', initialHp: 9, maxHp: 9,
            actions: [{ actionId: 'observe-ammo', tendencyWeight: 1 }] },
        ],
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'finish-training-target', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
