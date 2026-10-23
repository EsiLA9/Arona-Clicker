import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_ACTUAL_AMOUNT_THRESHOLD_EXAMPLE_MAP_ID = 'gameplay-b:map:actual-amount-threshold-example';

/** An AG-1 sample distinguishing requested damage from actual HP-loss Trigger thresholds. */
export const gameplayBActualAmountThresholdExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_ACTUAL_AMOUNT_THRESHOLD_EXAMPLE_MAP_ID,
  name: '实际变化阈值演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '训练敌人先用 2 点护盾吸收伤害：3 点请求实际损失 1 HP，不满足门槛；随后实际损失 2 HP，满足门槛并获得 guard +1。',
    tips: [
      'minimumActualAmount 比较最终实际 HP 变化，不比较伤害请求。',
      '低于门槛的事件没有 Trigger Trace、资源意图或队列序号。',
      '达到门槛的回馈在后续来源前结算，芹香可读取 guard。',
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
    id: 'threshold-shot',
    name: '测试阈值射击',
    description: '先给主目标 2 点护盾，再造成 3 点与 2 点伤害；仅实际 HP 损失至少 2 点时获得 guard。',
    eligibleCharacterIds: [],
    agility: { base: 20, max: 20 },
    target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
    tendencyRole: 'attack',
    effectProgram: {
      resolve: [
        { op: 'shieldAdd', target: 'primary', amount: 2 },
        { op: 'damage', target: 'primary', amount: 3 },
        { op: 'damage', target: 'primary', amount: 2 },
      ],
      triggers: [{
        id: 'guard-on-two-hp-loss',
        event: 'damageApplied',
        minimumActualAmount: 2,
        effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'guard', delta: 1 },
      }],
    },
  }, {
    id: 'use-threshold-guard',
    name: '利用 guard 反击',
    description: '若芹香本轮获得 guard，就对训练靶造成等量伤害。',
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
    { id: 'entry', title: '入口', description: '进入实际变化阈值演练。' },
    {
      id: 'practice',
      title: '护盾与实际 HP 门槛',
      description: '第一击请求 3、护盾吸收 2、实际损失 1 未达门槛；第二击实际损失 2 命中门槛。',
      encounter: {
        title: '实际伤害量阈值',
        enemies: [{ id: 'training-target', initialHp: 5, maxHp: 5,
          actions: [{ actionId: 'threshold-shot', tendencyWeight: 1 }] }],
        participants: [{ characterId: 'serika', actions: [{ actionId: 'use-threshold-guard', tendencyWeight: 1 }] }],
      },
    },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};
