import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';
import { tagRef } from '../../../engine/core/tag';

export const GAMEPLAY_B_PREPARED_TAG_COMBO_MAP_ID = 'gameplay-b:map:prepared-tag-combo';
const explosiveTag = tagRef('gameplay-b', ['action', 'explosive']);

/** Enterable E5 example for a frozen Party Prepared Tag count and ordered follow-up damage. */
export const gameplayBPreparedTagComboExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_PREPARED_TAG_COMBO_MAP_ID,
  name: '爆破连携演练',
  entryInfo: {
    description: '两名队员都准备爆破卡时，连携攻击会在基础伤害后追加一次支援伤害。',
    tips: [
      '条件读取回合开始时冻结的 Party 准备行动。',
      'Wait、未选 Command 和 Enemy 意图不参与计数。',
    ],
  },
  resumeVersion: 1,
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  actions: [
    {
      id: 'combo-shot',
      name: '爆破连携攻击',
      description: '先造成 2 点伤害；若 Party 本轮至少准备两张爆破卡，再追加 1 点伤害。',
      tags: [explosiveTag],
      eligibleCharacterIds: ['shiroko'],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [
        { op: 'damage', target: 'primary', amount: 2 },
        { op: 'when', condition: {
          kind: 'preparedTagCount', side: 'party', tag: explosiveTag, comparison: 'gte', value: 2,
        }, then: [
          { op: 'damage', target: 'primary', amount: 1 },
        ] },
      ] },
    },
    {
      id: 'partner-blast',
      name: '爆破信号',
      description: '为队友的连携攻击提供第二张爆破准备卡。',
      tags: [explosiveTag],
      eligibleCharacterIds: ['serika'],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '进入爆破连携演练。' },
    {
      id: 'battle',
      title: '连携测试',
      description: '先计算本轮准备 Tag，再按队伍行动顺序结算伤害。',
      encounter: {
        title: '两张爆破卡',
        enemies: [{ id: 'training-target', initialHp: 10, maxHp: 10 }],
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'combo-shot', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'partner-blast', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [
    { fromNodeId: 'entry', toNodeId: 'battle' },
    { fromNodeId: 'battle', toNodeId: 'exit' },
  ],
};
