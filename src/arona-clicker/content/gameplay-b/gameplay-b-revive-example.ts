import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_REVIVE_EXAMPLE_MAP_ID = 'gameplay-b:map:revive-example';

/** A small AG-1 sample showing explicit downed targeting and later source reactivation. */
export const gameplayBReviveExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_REVIVE_EXAMPLE_MAP_ID,
  name: '复苏原语演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '训练敌人先击倒芹香；白子随后使用 Ability 复苏她，芹香在本轮后序来源位置继续行动。',
    tips: [
      '复苏只接收倒地的 Party Character primary 目标，所设 HP 会截到最大 HP。',
      '普通治疗与 hpChange 不会复活 0 HP 角色；复苏的目标和 HP 变化会进入 Commit Flow。',
      '已倒地来源没有本轮准备行动；本例展示在回合开始仍存活、队列执行中倒地再被复苏的来源继续执行。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 1, maxHp: 10 },
  ],
  initialPlayerCost: 2,
  actions: [
    {
      id: 'knockout',
      name: '击倒芹香',
      description: '训练敌人攻击 HP 最低的队员；芹香从 1 HP 倒地。',
      eligibleCharacterIds: [],
      agility: { base: 20, max: 20 },
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
    },
    {
      id: 'revive-serika',
      name: '复苏芹香',
      description: '选择倒地队友，复苏至 3 HP；若目标仍存活则记录 no-op。',
      eligibleCharacterIds: [],
      agility: { base: 10, max: 10 },
      target: { kind: 'partyCharacter', includeDefeated: true },
      effectProgram: { resolve: [{ op: 'revive', target: 'primary', amount: 3 }] },
    },
    {
      id: 'serika-followup',
      name: '芹香继续行动',
      description: '验证前序复苏使后序的既有 Prepared 来源恢复资格；结算后恢复 1 HP。',
      eligibleCharacterIds: ['serika'],
      agility: { base: 0, max: 0 },
      target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'hpChange', target: 'source', delta: 1 }] },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '进入复苏演练。' },
    {
      id: 'revive-test',
      title: '队列复苏测试',
      description: '结算顺序为训练敌人、Ability 复苏、芹香已准备的行动。',
      encounter: {
        title: '复苏与来源资格',
        abilityActionIds: ['revive-serika'],
        enemies: [{ id: 'training-target', initialHp: 10, maxHp: 10, actions: [{ actionId: 'knockout', tendencyWeight: 1 }] }],
        participants: [{ characterId: 'serika', actions: [{ actionId: 'serika-followup', tendencyWeight: 1 }] }],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'revive-test' }, { fromNodeId: 'revive-test', toNodeId: 'exit' }],
};
