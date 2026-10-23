import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';

export const GAMEPLAY_B_MAPRUN_STATUS_EXAMPLE_MAP_ID = 'gameplay-b:map:maprun-status-example';

/** AG-1 example of a Party Status surviving an Encounter, a Shop, and a later Encounter. */
export const gameplayBMapRunStatusExampleMap: GameplayMapDef = {
  id: GAMEPLAY_B_MAPRUN_STATUS_EXAMPLE_MAP_ID,
  name: '跨遭遇状态演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '白子在首个短回合为自己施加持续状态；经过补给站后，再观察训练靶攻击受到减伤。',
    tips: [
      'MapRun 状态由本局持有，经过 Shop、Activity 与 Encounter 转场时保留。',
      '只有成功的 Encounter roundEnd 会推进状态时长；Shop 购买和离开不会推进。',
      '首个 Encounter 的来源 Action 直接列在参与者手牌定义中。',
    ],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 8, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  initialTeamResources: [{ resourceId: 'credits', value: 1 }],
  statuses: [{
    id: 'travelling-cover',
    lifetime: 'mapRun',
    name: '同行掩护',
    description: '每层在受击时固定减免伤害；状态在本局内跨遭遇保留。',
    category: 'beneficial',
    kind: 'damageReduction',
    damageReductionPerStack: 2,
    maxStacks: 1,
  }],
  actions: [
    {
      id: 'apply-travelling-cover',
      name: '准备同行掩护',
      description: '白子为自己施加持续三次成功遭遇回合的同行掩护。',
      eligibleCharacterIds: ['shiroko'],
      target: { kind: 'none' },
      effectProgram: { resolve: [{
        op: 'statusApply',
        target: 'source',
        statusId: 'travelling-cover',
        stacks: 1,
        durationRounds: 3,
      }] },
    },
    {
      id: 'practice-shot',
      name: '练习射击',
      description: '对训练靶造成 3 点伤害。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 2, max: 2 },
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
    },
    {
      id: 'training-shot',
      name: '训练靶射击',
      description: '对队伍中排序最前的成员请求 3 点伤害。',
      eligibleCharacterIds: [],
      agility: { base: 10, max: 10 },
      target: { kind: 'partyCharacter', preference: 'stableOrder' },
      tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '开始跨遭遇状态演练。' },
    {
      id: 'practice',
      title: '补给与训练路线',
      description: '依次完成状态施加、补给站和训练靶战斗。',
      activities: [
        {
          id: 'origin',
          title: '施加同行掩护',
          encounter: {
            title: '准备状态',
            description: '完成一轮后进入补给站；刚施加的状态不会在本轮末立即触发。',
            rounds: 1,
            participants: [{
              characterId: 'shiroko',
              actions: [{ actionId: 'apply-travelling-cover', tendencyWeight: 1 }],
            }],
          },
        },
        {
          id: 'supply-stop',
          title: '补给站',
          shop: {
            title: '训练补给站',
            description: '可以购买一次补给，也可以直接离开；Shop 操作不推进 Status 时长。',
            offers: [{
              id: 'serika-ration',
              name: '芹香的口粮',
              description: '花费 1 点信用点，为芹香恢复 1 点 HP。',
              costs: [{ resourceId: 'credits', amount: 1 }],
              heal: { characterId: 'serika', amount: 1 },
            }],
          },
        },
        {
          id: 'demonstration',
          title: '验证同行掩护',
          encounter: {
            title: '训练靶反击',
            description: '训练靶请求对白子造成 3 点伤害；同行掩护前三次减免各 2 点，耗尽后恢复完整伤害。',
            enemies: [{
              id: 'training-target',
              initialHp: 12,
              maxHp: 12,
              actions: [{ actionId: 'training-shot', tendencyWeight: 1 }],
            }],
            participants: [{
              characterId: 'shiroko',
              actions: [{ actionId: 'practice-shot', tendencyWeight: 1 }],
            }],
          },
        },
      ],
    },
    { id: 'exit', title: '演练出口', description: '到达出口后，本局的 MapRun Status 清除。' },
  ],
  edges: [
    { fromNodeId: 'entry', toNodeId: 'practice' },
    { fromNodeId: 'practice', toNodeId: 'exit' },
  ],
};
