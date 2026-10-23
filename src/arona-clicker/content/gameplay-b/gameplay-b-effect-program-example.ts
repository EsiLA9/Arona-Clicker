import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_EFFECT_PROGRAM_EXAMPLE_MAP_ID = 'gameplay-b:map:effect-program-example';

/** A copyable E1 map: one prepared shot, source fees, ordered HP guards, and a rest condition. */
export const gameplayBEffectProgramExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_EFFECT_PROGRAM_EXAMPLE_MAP_ID,
  name: '效果程序作者示例',
  entryInfo: {
    description: '按顺序完成卡牌协同、掩护射击、条件包扎与信任交涉。',
    tips: [
      '协同准备选择本轮真实手牌；卡牌费用减免只影响受用卡的 sCost。',
      '交涉信任在同一遭遇的多轮之间保留；两名队员都行动后才检查完成条件。',
    ],
  },
  resumeVersion: 4,
  startNodeId: 'range',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 4, maxHp: 10 },
    { characterId: 'serika', initialHp: 5, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'sCost', value: 0 },
    { characterId: 'serika', resourceId: 'sCost', value: 2 },
    { characterId: 'shiroko', resourceId: 'ammo', value: 0 },
    { characterId: 'serika', resourceId: 'ammo', value: 1 },
    { characterId: 'shiroko', resourceId: 'focus', value: 2 },
    { characterId: 'serika', resourceId: 'focus', value: 2 },
  ],
  initialTeamResources: [
    { resourceId: 'field-medkits', value: 0 },
    { resourceId: 'field-reports', value: 0 },
  ],
  actions: [
    {
      id: 'prepare-shot',
      name: '临时强化',
      description: '选择芹香本轮手牌中的射击，为其减免 1 点 sCost。',
      eligibleCharacterIds: ['shiroko'],
      target: { kind: 'card', side: 'ally' },
      effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] },
    },
    {
      id: 'precision-shot',
      name: '定点射击',
      description: '费用 1 点 sCost，对主目标造成 3 点伤害。',
      eligibleCharacterIds: ['serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }],
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
    },
    {
      id: 'covering-shot',
      name: '掩护射击',
      description: '主目标受到 2 点伤害；执行者补充 1 发弹药。弹药不足时不能靠本次补充支付费用。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'ammo', amount: 1 }],
      effectProgram: { resolve: [
        { op: 'damage', target: 'primary', amount: 2 },
        { op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1 },
      ] },
    },
    {
      id: 'conditional-bandage',
      name: '条件包扎',
      description: '治疗自己 3 点；治疗前 HP 不高于 4 时，团队获得 1 个急救包。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effectProgram: { resolve: [
        { op: 'when', condition: { kind: 'hpAtMost', target: 'source', value: 4 }, then: [
          { op: 'resourceChange', account: 'sourceTeam', resourceId: 'field-medkits', delta: 1 },
        ] },
        { op: 'heal', target: 'primary', amount: 3 },
      ] },
    },
    {
      id: 'negotiate',
      name: '认真交涉',
      description: '消耗 1 点个人专注；信任 +1，并为团队记录 1 条交涉记录。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [
        { op: 'counterAdd', counterId: 'trust', delta: 1 },
        { op: 'flagSet', flagId: 'briefed', value: true },
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'field-reports', delta: 1 },
      ] },
    },
  ],
  nodes: [
    {
      id: 'range',
      title: '训练区',
      description: '每个 activity 按声明顺序开始；两名队员的起始 HP 分别为 4/10 与 5/10。',
      activities: [
        {
          id: 'opening-shot',
          title: '基础射击',
          encounter: {
            title: '新伤害原语',
            enemies: [{ id: 'opening-target', initialHp: 3, maxHp: 3 }],
            participants: [{ characterId: 'serika', actions: [{ actionId: 'precision-shot', tendencyWeight: 1 }] }],
          },
        },
        {
          id: 'card-range',
          title: '卡牌协同',
          encounter: {
            title: '真实手牌协同演练',
            enemies: [{ id: 'range-target', initialHp: 3, maxHp: 3 }],
            participants: [
              { characterId: 'shiroko', actions: [{ actionId: 'prepare-shot', tendencyWeight: 1 }] },
              { characterId: 'serika', actions: [{ actionId: 'precision-shot', tendencyWeight: 1 }] },
            ],
          },
        },
        {
          id: 'cover-range',
          title: '掩护射击',
          encounter: {
            title: '弹药费用演练',
            enemies: [{ id: 'cover-target', initialHp: 4, maxHp: 4 }],
            participants: ['shiroko', 'serika'].map(characterId => ({
              characterId,
              actions: [{ actionId: 'covering-shot', tendencyWeight: 1 }],
            })),
          },
        },
        {
          id: 'triage',
          title: '条件包扎',
          encounter: {
            title: '包扎练习',
            rounds: 1,
            participants: ['shiroko', 'serika'].map(characterId => ({
              characterId,
              actions: [{ actionId: 'conditional-bandage', tendencyWeight: 1 }],
            })),
          },
        },
        {
          id: 'talk',
          title: '交涉与休息',
          encounter: {
            title: '恢复与交涉',
            description: '信任到 2 时可保存；恢复后再提交一整轮，信任达到 3 后活动完成。',
            locals: {
              counters: [{ id: 'trust', initial: 0, min: 0, max: 3 }],
              flags: [{ id: 'briefed', initial: false }],
            },
            completion: {
              kind: 'condition',
              label: '信任达到 3',
              condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 3 },
            },
            participants: ['shiroko', 'serika'].map(characterId => ({
              characterId,
              actions: [{ actionId: 'negotiate', tendencyWeight: 1 }],
            })),
          },
        },
      ],
    },
    { id: 'exit', title: '训练出口', description: '完成五项 activity 后离开训练区。' },
  ],
  edges: [{ fromNodeId: 'range', toNodeId: 'exit' }],
};
