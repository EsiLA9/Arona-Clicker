import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_DAMAGE_REDUCTION_EXAMPLE_MAP_ID = 'gameplay-b:map:damage-reduction-example';

/** A compact AG-1 sample showing a round-limited damage-reduction Status before Shield. */
export const gameplayBDamageReductionExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_DAMAGE_REDUCTION_EXAMPLE_MAP_ID,
  name: '防御减伤演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '白子为芹香施加每层减免 2 点伤害的防御状态，并附加 1 点护盾；训练机器人连续攻击验证减免、护盾和到期顺序。',
    tips: [
      '伤害减免先于护盾：原伤害 3 先降到 1，再由 1 点护盾吸收，芹香首轮 HP 不变。',
      '减伤状态在后续回合继续生效，按成功 roundEnd 推进两轮后到期；倒地目标不消费护盾或减免。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
  ],
  initialPlayerCost: 2,
  statuses: [{
    id: 'cover',
    name: '掩护',
    description: '每层在伤害进入护盾前减免固定伤害。',
    category: 'beneficial',
    kind: 'damageReduction',
    damageReductionPerStack: 2,
    maxStacks: 1,
  }],
  actions: [
    {
      id: 'cover-serika',
      name: '掩护芹香',
      description: '为芹香增加 1 点护盾，并施加持续两轮、每层减伤 2 的掩护。',
      eligibleCharacterIds: [],
      agility: { base: 20, max: 20 },
      target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [
        { op: 'shieldAdd', target: 'primary', amount: 1 },
        { op: 'statusApply', target: 'primary', statusId: 'cover', stacks: 1, durationRounds: 2 },
      ] },
    },
    {
      id: 'training-shot',
      name: '训练机器人攻击',
      description: '每回合对当前 HP 比例最低的队员造成 3 点伤害。',
      eligibleCharacterIds: [],
      agility: { base: 8, max: 8 },
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '进入防御减伤演练。' },
    {
      id: 'practice',
      title: '减伤与护盾',
      description: '先施加掩护和 1 点护盾，再观察伤害减免先于护盾吸收。',
      encounter: {
        title: '防御减伤与回合期限',
        abilityActionIds: ['cover-serika'],
        enemies: [{ id: 'training-robot', initialHp: 20, maxHp: 20,
          actions: [{ actionId: 'training-shot', tendencyWeight: 1 }] }],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
