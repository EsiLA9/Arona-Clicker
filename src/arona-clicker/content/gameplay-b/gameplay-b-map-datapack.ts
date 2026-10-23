import type { Datapack } from '../../../data-services/contracts/datapack';
import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';
import { spot } from '../def-factory/spot';
import { tagPath, tagRef } from '../../../engine/core/tag';
import { gameplayBEffectProgramExampleMap } from './gameplay-b-effect-program-example';
import { gameplayBStatusExampleMap } from './gameplay-b-status-example';
import { gameplayBPreparedTagComboExampleMap } from './gameplay-b-prepared-tag-combo-example';
import { gameplayBReviveExampleMap } from './gameplay-b-revive-example';
import { gameplayBDamageReductionExampleMap } from './gameplay-b-damage-reduction-example';
import { gameplayBHealAppliedResourceExampleMap } from './gameplay-b-heal-applied-resource-example';
import { gameplayBDamageAppliedResourceExampleMap } from './gameplay-b-damage-applied-resource-example';
import { gameplayBActualAmountThresholdExampleMap } from './gameplay-b-actual-amount-threshold-example';
import { gameplayBStatusExpiryRewardExampleMap } from './gameplay-b-status-expiry-reward-example';
import { gameplayBDamageProtectionExampleMap } from './gameplay-b-damage-protection-example';
import { gameplayBEnemyDefeatedRewardExampleMap } from './gameplay-b-enemy-defeated-reward-example';
import { gameplayBMapRunStatusExampleMap } from './gameplay-b-maprun-status-example';
import { gameplayBStatusDamageRewardExampleMap } from './gameplay-b-status-damage-reward-example';

/** U17d2: a Party Prepared Action strengthens another Party member's later heal. */
export const gameplayBCardModifierExampleMap: GameplayMapDef = {
  id: 'gameplay-b:map:card-modifier-example',
  name: '卡牌效果修正演练',
  executionContractId: 'AG-1',
  resumeVersion: 7,
  entryInfo: {
    description: '白子先为芹香本轮准备的治疗卡增加 2 点治疗量。',
    tips: ['目标必须是另一名队员当前准备的卡。', 'Modifier 先执行才会生效；Commit Receipt 会记录两张实际 Prepared 卡及效果。'],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 5, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  partyAgility: [],
  actions: [
    { id: 'amplify-heal', name: '鼓舞治疗', description: '选择芹香当前准备的治疗卡，本轮治疗量增加 2。',
      eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 }, target: { kind: 'card', side: 'ally' },
      effectProgram: { resolve: [{ op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 }] } },
    { id: 'prepared-heal', name: '强化治疗', description: '为一名队友恢复 2 点 HP；若白子先鼓舞，此卡恢复 4 点。',
      eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 }, target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] } },
    { id: 'example-interrupt', name: '训练靶打断', eligibleCharacterIds: [], agility: { base: 5, max: 8 },
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '白子与芹香进入治疗协同演练。' },
    { id: 'practice', title: 'Prepared 治疗卡', description: '白子先执行 Modifier；芹香随后执行队友治疗。', encounter: {
      title: '治疗协同', enemies: [{ id: 'training-target', initialHp: 5, maxHp: 5 }], participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'amplify-heal', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'prepared-heal', tendencyWeight: 1 }] },
      ],
    } },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};

/** U18d: a Party Action grants a teammate three Encounter Shield for one Focus. */
export const gameplayBShieldExampleMap: GameplayMapDef = {
  id: 'gameplay-b:map:shield-example',
  name: '友方护盾演练',
  executionContractId: 'AG-1',
  resumeVersion: 1,
  entryInfo: {
    description: '白子消耗 1 点专注，为芹香获得 3 点护盾；训练机器人连续两轮各造成 2 点伤害。',
    tips: ['第一轮护盾吸收 2 点伤害并保留 1 点，芹香 HP 不变。', '第二轮剩余护盾吸收 1 点，未吸收的 1 点伤害再扣除 HP。'],
  },
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 8, maxHp: 10 },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 1 },
    { characterId: 'serika', resourceId: 'focus', value: 0 },
  ],
  initialPlayerCost: 0,
  partyAgility: [],
  actions: [
    {
      id: 'grant-shield',
      name: '护盾支援',
      description: '消耗 1 点专注，为一名队友增加 3 点护盾。',
      eligibleCharacterIds: ['shiroko'],
      agility: { base: 8, max: 8 },
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{ op: 'shieldAdd', target: 'primary', amount: 3 }] },
    },
    {
      id: 'wait',
      name: '观察',
      description: '本轮不执行额外行动。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      agility: { base: 0, max: 8 },
      target: { kind: 'none' },
    },
    {
      id: 'training-strike',
      name: '训练机器人射击',
      description: '攻击 HP 比例最低的队员，造成 2 点伤害。',
      eligibleCharacterIds: [],
      agility: { base: 0, max: 8 },
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
  ],
  nodes: [
    { id: 'entry', title: '入口', description: '白子与芹香进入护盾演练。' },
    {
      id: 'practice',
      title: '两轮护盾演练',
      description: '第一轮施加护盾并承受攻击，第二轮观察剩余护盾如何分担伤害。',
      encounter: {
        title: '护盾演练',
        description: '训练机器人每轮造成 2 点伤害，优先攻击 HP 比例最低的队员。',
        enemies: [{ id: 'training-robot', initialHp: 10, maxHp: 10,
          actions: [{ actionId: 'training-strike', tendencyWeight: 1 }] }],
        participants: [
          { characterId: 'shiroko', actions: [
            { actionId: 'grant-shield', tendencyWeight: 1 },
          ] },
          { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'exit', title: '演练出口', description: '完成两轮护盾演练。' },
  ],
  edges: [{ fromNodeId: 'entry', toNodeId: 'practice' }, { fromNodeId: 'practice', toNodeId: 'exit' }],
};

export const GAMEPLAY_B_MAP_SPOT_ID = 'gameplay-b:spot:operation_terminal';

/** Clean Map-only Gameplay B bundle. Legacy Operation samples are not included. */
export const gameplayBMapDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:field-investigation',
  name: '现场调查路线',
  entryInfo: {
    description: '检查现场、完成调查，再沿开放路线前往出口。',
    tips: ['遭遇调查完成后，后续地点才会开放。', '行动点、队员体力和团队物资属于本局状态。'],
  },
  resumeVersion: 4,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [
    {
      id: 'inspect-site',
      name: '检查现场',
      description: '搜集线索，推进现场调查。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 1 }] },
    },
    {
      id: 'steady-equipment',
      name: '稳住设备',
      description: '消耗个人体力，调整设备状态。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      costs: [{ scope: 'actor', resourceId: 'stamina', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
    },
    {
      id: 'assist-teammate',
      name: '协助队友',
      description: '消耗共用物资，帮助一名队员集中注意力。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 }] },
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'stamina', value: 2 },
    { characterId: 'serika', resourceId: 'stamina', value: 2 },
    { characterId: 'shiroko', resourceId: 'focus', value: 0 },
    { characterId: 'serika', resourceId: 'focus', value: 0 },
  ],
  initialTeamResources: [
    { resourceId: 'clues', value: 0 },
    { resourceId: 'supplies', value: 1 },
  ],
  nodes: [
    { id: 'a', title: '入口', description: '从这里开始调查。' },
    {
      id: 'b',
      title: '现场',
      description: '检查现场后继续前进。',
      encounter: {
        title: '现场调查',
        description: '完成调查以解锁后续路线。',
        completion: { kind: 'manual', label: '完成调查' },
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'inspect-site', tendencyWeight: 5 },
              { actionId: 'steady-equipment', tendencyWeight: 3 },
              { actionId: 'assist-teammate', tendencyWeight: 1 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'inspect-site', tendencyWeight: 2 },
              { actionId: 'steady-equipment', tendencyWeight: 1 },
              { actionId: 'assist-teammate', tendencyWeight: 5 },
            ],
          },
        ],
      },
    },
    { id: 'c', title: '出口', description: '调查路线的出口。' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ],
};

/** Small author example: candidate Pools and a route Edge read the current MapRun Counter. */
export const gameplayBFactGatedPoolExampleMap: GameplayMapDef = {
  id: 'gameplay-b:map:fact-gated-pool-example',
  name: '事实门控候选池示例',
  entryInfo: { description: '首个遭遇记录路线进度；后续候选池按入场快照更新，前往下一节点时路线边读取当前计数。' },
  resumeVersion: 7,
  executionContractId: 'AG-1',
  startNodeId: 'survey',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  mapRunFacts: { counters: [{ id: 'route-step', initial: 0, min: 0, max: 3 }] },
  actions: [
    { id: 'record-route', name: '记录路线', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'mapRunCounterAdd', counterId: 'route-step', delta: 1 }] } },
    { id: 'follow-route', name: '沿记录路线前进', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' } },
  ],
  candidatePools: [
    { id: 'route-options', entries: [
      { kind: 'pool', poolId: 'first-step', weight: 1 },
      { kind: 'pool', poolId: 'later-step', weight: 1 },
    ] },
    { id: 'first-step', gate: { kind: 'counter', counterId: 'route-step', comparison: 'eq', value: 0 },
      entries: [{ kind: 'action', actionId: 'record-route', weight: 1 }] },
    { id: 'later-step', gate: { kind: 'counter', counterId: 'route-step', comparison: 'gte', value: 1 },
      entries: [{ kind: 'action', actionId: 'follow-route', weight: 1 }] },
  ],
  nodes: [
    { id: 'survey', title: '路线调查', encounter: { title: '路线调查', completion: { kind: 'manual', label: '完成调查' },
      participants: [
        { characterId: 'shiroko', actions: [], candidatePoolIds: ['route-options'] },
        { characterId: 'serika', actions: [] },
      ] } },
    { id: 'advance', title: '路线推进', encounter: { title: '路线推进', completion: { kind: 'manual', label: '完成推进' },
      participants: [
        { characterId: 'shiroko', actions: [], candidatePoolIds: ['route-options'] },
        { characterId: 'serika', actions: [] },
      ] } },
    { id: 'exit', title: '出口' },
  ],
  edges: [
    { fromNodeId: 'survey', toNodeId: 'advance', condition: { kind: 'counter', counterId: 'route-step', comparison: 'gte', value: 1 } },
    { fromNodeId: 'advance', toNodeId: 'exit' },
  ],
};

/** Two-round battle using the normal Map entry, Hand and Commit flow. */
export const gameplayBMinimalBattleDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:minimal-battle',
  name: '极简战斗演练',
  entryInfo: {
    description: '进入演练场击败敌人，最后前往演练出口。',
    tips: ['选择目标并提交本轮行动；存活敌人随后行动。', '队员生命会按战斗结算保留在本局进度中。'],
  },
  resumeVersion: 5,
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  actions: [{
    id: 'attack',
    name: '普通攻击',
    description: '对一名敌人造成 2 点伤害。选择目标后提交本轮行动。',
    eligibleCharacterIds: ['shiroko', 'serika'],
    tags: [tagRef('gameplay-b', ['action', 'attack'])],
    target: { kind: 'enemy' },
    effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
  }, {
    id: 'robot-counterattack',
    name: '机器人攻击',
    description: '攻击当前 HP 比例最低的队员，造成 2 点伤害。',
    eligibleCharacterIds: [],
    target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
    tendencyRole: 'attack',
    effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
  }],
  candidatePools: [{
    id: 'tagged-attacks',
    entries: [{ kind: 'tag', tag: tagRef('gameplay-b', ['action']), weight: 1 }],
  }],
  nodes: [
    { id: 'entry', title: '准备区', description: '白子与芹香各有 10 HP。前往演练场开始战斗。' },
    {
      id: 'battle',
      title: '演练场',
      description: '击败训练靶后可前往出口。',
      encounter: {
        title: '两人对两敌',
        description: '训练靶与机动靶各有 6 HP。两名队员每轮各攻击 2 点；每个存活机器人会从手牌中自主攻击队员。集火击败两侧目标方可取胜。',
        enemies: [
          { id: '训练靶', initialHp: 6, maxHp: 6, actions: [{ actionId: 'robot-counterattack', tendencyWeight: 1 }] },
          { id: '机动靶', initialHp: 6, maxHp: 6, actions: [{ actionId: 'robot-counterattack', tendencyWeight: 1 }] },
        ],
        participants: [
          {
            characterId: 'shiroko',
            actions: [{ actionId: 'attack', tendencyWeight: 1 }],
            candidatePoolIds: ['tagged-attacks'],
          },
          { characterId: 'serika', actions: [{ actionId: 'attack', tendencyWeight: 1 }] },
        ],
      },
    },
    { id: 'exit', title: '演练出口', description: '演练结束，返回游戏。' },
  ],
  edges: [
    { fromNodeId: 'entry', toNodeId: 'battle' },
    { fromNodeId: 'battle', toNodeId: 'exit' },
  ],
};

/**
 * P0 sample: one directed linear route where B holds the only Encounter.
 * A → B(Battle) → C keeps the Encounter victory and the MapRun success apart.
 */
export const gameplayBLinearBattleDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:linear-battle',
  name: '废弃走廊战斗',
  entryInfo: {
    description: '沿废弃走廊推进，清除拦路遭遇后抵达出口。',
    tips: ['先选择本轮行动目标，再提交本轮。', '完成当前遭遇后，路线才会继续开放。'],
  },
  resumeVersion: 4,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [
    {
      id: 'standard-shot',
      name: '普通射击',
      description: '对一名敌人造成 2 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 4 }] },
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
    },
    {
      id: 'signal-position',
      name: '通报位置',
      description: '把走廊情况回报给现场，积累 1 条线索。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 1 }] },
    },
    {
      id: 'patrol-counterattack', name: '巡逻机攻击', eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 1 },
    { characterId: 'serika', resourceId: 'focus', value: 1 },
  ],
  initialTeamResources: [{ resourceId: 'clues', value: 0 }],
  nodes: [
    { id: 'a', title: '入口', description: '沿唯一的走廊通道前进。' },
    {
      id: 'b',
      title: '废弃走廊',
      description: '巡逻机堵住了通道。击败它后走廊恢复通行。',
      encounter: {
        title: '走廊遭遇',
        description: '巡逻机有 12 HP，会从自己的手牌中自主攻击。手牌只有 3 张，第 4 项行动需要 PlayerCommand。',
        enemies: [{ id: '巡逻机', initialHp: 12, maxHp: 12, actions: [{ actionId: 'patrol-counterattack', tendencyWeight: 1 }] }],
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'standard-shot', tendencyWeight: 5 },
              { actionId: 'focused-shot', tendencyWeight: 3 },
              { actionId: 'take-cover', tendencyWeight: 2 },
              { actionId: 'signal-position', tendencyWeight: 1 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'standard-shot', tendencyWeight: 5 },
              { actionId: 'focused-shot', tendencyWeight: 2 },
              { actionId: 'take-cover', tendencyWeight: 1 },
              { actionId: 'signal-position', tendencyWeight: 3 },
            ],
          },
        ],
      },
    },
    { id: 'c', title: '出口', description: '走廊尽头是调查路线的出口。' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ],
};

/**
 * P1 sample: one Node runs a fixed Battle → Rest → Shop sequence; players never
 * choose the order and cannot move until every activity ends.
 */
export const gameplayBActivityHallDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:activity-hall',
  name: '废弃活动室',
  entryInfo: {
    description: '按地图顺序完成战斗、休整与补给活动，再前往出口。',
    tips: ['当前活动完成后才能继续路线。', '商店购买会消耗本局资源，结余会保留在 Run 中。'],
  },
  resumeVersion: 4,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [
    {
      id: 'standard-shot',
      name: '普通射击',
      description: '对一名敌人造成 2 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 4 }] },
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
    },
    {
      id: 'catch-breath',
      name: '调整呼吸',
      description: '在休整中为一名队员恢复 2 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] },
    },
    {
      id: 'tidy-supplies',
      name: '整理物资',
      description: '清点现场补给，共用资源 +1。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] },
    },
    {
      id: 'treat-teammate',
      name: '照顾队友',
      description: '消耗共用补给，为一名队员恢复 3 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 3 }] },
    },
    {
      id: 'hall-robot-counterattack', name: '巡逻机器人攻击', eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 1 },
    { characterId: 'serika', resourceId: 'focus', value: 1 },
  ],
  initialTeamResources: [
    { resourceId: 'supplies', value: 2 },
    { resourceId: 'clues', value: 0 },
  ],
  nodes: [
    { id: 'a', title: '入口', description: '活动室的门还开着。' },
    {
      id: 'b',
      title: '废弃活动室',
      description: '旧校舍的设备储藏室，仍有部分设施运作。',
      activities: [
        {
          id: 'clear-patrol',
          title: '清除巡逻机器人',
          encounter: {
            title: '活动室战斗',
            description: '巡逻机器人有 8 HP，会从自己的手牌中自主攻击。',
            enemies: [{ id: '巡逻机器人', initialHp: 8, maxHp: 8, actions: [{ actionId: 'hall-robot-counterattack', tendencyWeight: 1 }] }],
            participants: [
              {
                characterId: 'shiroko',
                actions: [
                  { actionId: 'standard-shot', tendencyWeight: 5 },
                  { actionId: 'focused-shot', tendencyWeight: 3 },
                  { actionId: 'take-cover', tendencyWeight: 1 },
                ],
              },
              {
                characterId: 'serika',
                actions: [
                  { actionId: 'standard-shot', tendencyWeight: 4 },
                  { actionId: 'focused-shot', tendencyWeight: 2 },
                  { actionId: 'take-cover', tendencyWeight: 2 },
                ],
              },
            ],
          },
        },
        {
          id: 'rest',
          title: '两轮休整',
          encounter: {
            title: '活动室休整',
            description: '没有敌人。完成两轮休整行为后自动进入补给。',
            rounds: 2,
            participants: [
              {
                characterId: 'shiroko',
                actions: [
                  { actionId: 'catch-breath', tendencyWeight: 4 },
                  { actionId: 'tidy-supplies', tendencyWeight: 2 },
                  { actionId: 'treat-teammate', tendencyWeight: 1 },
                ],
              },
              {
                characterId: 'serika',
                actions: [
                  { actionId: 'catch-breath', tendencyWeight: 3 },
                  { actionId: 'tidy-supplies', tendencyWeight: 2 },
                  { actionId: 'treat-teammate', tendencyWeight: 2 },
                ],
              },
            ],
          },
        },
        {
          id: 'supply',
          title: '现场补给',
          shop: {
            title: '活动室补给箱',
            description: '用共用补给换取现场物资，也可以直接离开。',
            offers: [
              {
                id: 'field-ration',
                name: '应急口粮',
                description: '为白子恢复 4 点 HP。',
                costs: [{ resourceId: 'supplies', amount: 1 }],
                heal: { characterId: 'shiroko', amount: 4 },
              },
              {
                id: 'spare-parts',
                name: '备用零件',
                description: '把零件记入现场线索。',
                costs: [{ resourceId: 'supplies', amount: 1 }],
                effects: [{ resourceId: 'clues', amount: 2 }],
              },
            ],
          },
        },
      ],
    },
    { id: 'c', title: '出口', description: '活动室的另一侧通向出口。' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ],
};

/**
 * P2 sample: A offers two one-way routes that converge at D. The battle route
 * costs HP and earns clues; the supply route spends credits and restores HP.
 */
export const gameplayBForkedRouteDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:forked-route',
  name: '分叉调查路线',
  entryInfo: {
    description: '沿分岔调查路线选择可达地点，逐步前往出口。',
    tips: ['路线候选会标注当前是否可走，不能跳过未完成的地点。', '遭遇或活动未完成时，移动可能暂不可用。'],
  },
  resumeVersion: 4,
  startNodeId: 'a',
  exitNodeIds: ['e'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [
    {
      id: 'standard-shot',
      name: '普通射击',
      description: '对一名敌人造成 2 点伤害，并把现场情况记入线索。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [
        { op: 'damage', target: 'primary', amount: 2 },
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 1 },
      ] },
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 4 }] },
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
    },
    {
      id: 'collect-intel',
      name: '收集情报',
      description: '从现场设备中提取 1 条线索。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 1 }] },
    },
    {
      id: 'guard-counterattack', name: '守卫攻击', eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 1 },
    { characterId: 'serika', resourceId: 'focus', value: 1 },
  ],
  initialTeamResources: [
    { resourceId: 'clues', value: 0 },
    { resourceId: 'credits', value: 2 },
    { resourceId: 'supplies', value: 0 },
  ],
  nodes: [
    { id: 'a', title: '入口', description: '前方路线分叉：左侧有战斗，右侧是补给站。' },
    {
      id: 'b',
      title: '战斗路线',
      description: '清理守卫可以取得现场线索。',
      encounter: {
        title: '守卫遭遇',
        description: '守卫有 6 HP，会从自己的手牌中自主攻击。',
        enemies: [{ id: '守卫', initialHp: 6, maxHp: 6, actions: [{ actionId: 'guard-counterattack', tendencyWeight: 1 }] }],
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'standard-shot', tendencyWeight: 4 },
              { actionId: 'focused-shot', tendencyWeight: 3 },
              { actionId: 'collect-intel', tendencyWeight: 1 },
              { actionId: 'take-cover', tendencyWeight: 1 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'standard-shot', tendencyWeight: 4 },
              { actionId: 'focused-shot', tendencyWeight: 2 },
              { actionId: 'collect-intel', tendencyWeight: 2 },
              { actionId: 'take-cover', tendencyWeight: 1 },
            ],
          },
        ],
      },
    },
    {
      id: 'c',
      title: '补给路线',
      description: '用现场信用点换取补给，不发生战斗。',
      activities: [{
        id: 'supply',
        title: '补给交换',
        shop: {
          title: '临时补给站',
          description: '消耗信用点换取物资与治疗。',
          offers: [
            {
              id: 'med-kit',
              name: '现场医疗包',
              description: '为芹香恢复 3 点 HP。',
              costs: [{ resourceId: 'credits', amount: 1 }],
              heal: { characterId: 'serika', amount: 3 },
            },
            {
              id: 'supply-box',
              name: '整箱补给',
              description: '把信用点换成交付给现场的补给。',
              costs: [{ resourceId: 'credits', amount: 1 }],
              effects: [{ resourceId: 'supplies', amount: 2 }],
            },
          ],
        },
      }],
    },
    { id: 'd', title: '汇合点', description: '两条路线在此汇合，队伍带着此前取得的资源继续前进。' },
    { id: 'e', title: '出口', description: '调查路线出口。' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'a', toNodeId: 'c' },
    { fromNodeId: 'b', toNodeId: 'd' },
    { fromNodeId: 'c', toNodeId: 'd' },
    { fromNodeId: 'd', toNodeId: 'e' },
  ],
};

/**
 * P3 sample: continuous Battle → Rest → Shop across separate Nodes plus one
 * condition-gated shortcut. The default route always remains completable.
 */
export const gameplayBContinuousConditionalDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:continuous-conditional',
  name: '连续调查与员工通道',
  entryInfo: {
    description: '完成连续调查，并在满足路线条件后前往员工通道。',
    tips: ['员工通道有额外准入条件，移动界面会显示当前门槛。', '未满足条件时可先选择其他可达路线。'],
  },
  resumeVersion: 4,
  startNodeId: 'a',
  exitNodeIds: ['e'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 1,
  actions: [
    {
      id: 'standard-shot',
      name: '普通射击',
      description: '对一名敌人造成 2 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 4 }] },
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
    },
    {
      id: 'search-terminal',
      name: '检索终端',
      description: '在守卫终端上找到一张临时员工通行证。',
      eligibleCharacterIds: [],
      target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'pass', delta: 1 }] },
    },
    {
      id: 'catch-breath',
      name: '调整呼吸',
      description: '在休整中为一名队员恢复 2 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] },
    },
    {
      id: 'tidy-supplies',
      name: '整理物资',
      description: '清点现场补给，共用资源 +1。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] },
    },
    {
      id: 'treat-teammate',
      name: '照顾队友',
      description: '消耗共用补给，为一名队员恢复 3 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 3 }] },
    },
    {
      id: 'continuous-guard-counterattack', name: '守卫攻击', eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] },
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 1 },
    { characterId: 'serika', resourceId: 'focus', value: 1 },
  ],
  initialTeamResources: [
    { resourceId: 'clues', value: 0 },
    { resourceId: 'supplies', value: 2 },
    { resourceId: 'credits', value: 1 },
    { resourceId: 'pass', value: 0 },
  ],
  nodes: [
    { id: 'a', title: '入口', description: '先在守卫处收集情报，再决定走哪条通道。' },
    {
      id: 'b',
      title: '守卫处',
      description: '守卫终端可能留有员工通行证。',
      encounter: {
        title: '守卫遭遇',
        description: '守卫有 6 HP，会从自己的手牌中自主攻击。检索终端是可选 Ability，提交时消耗 1 PlayerCost 取得通行证。',
        enemies: [{ id: '守卫', initialHp: 6, maxHp: 6, actions: [{ actionId: 'continuous-guard-counterattack', tendencyWeight: 1 }] }],
        abilityActionIds: ['search-terminal'],
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'standard-shot', tendencyWeight: 4 },
              { actionId: 'focused-shot', tendencyWeight: 3 },
              { actionId: 'take-cover', tendencyWeight: 1 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'standard-shot', tendencyWeight: 4 },
              { actionId: 'focused-shot', tendencyWeight: 2 },
              { actionId: 'take-cover', tendencyWeight: 1 },
            ],
          },
        ],
      },
    },
    {
      id: 'c',
      title: '休整点',
      description: '两轮休整后可以选择员工通道或普通通道。',
      encounter: {
        title: '休整点',
        description: '没有敌人。完成两轮休整行为后回到地图。',
        rounds: 2,
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'catch-breath', tendencyWeight: 4 },
              { actionId: 'tidy-supplies', tendencyWeight: 2 },
              { actionId: 'treat-teammate', tendencyWeight: 1 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'catch-breath', tendencyWeight: 3 },
              { actionId: 'tidy-supplies', tendencyWeight: 2 },
              { actionId: 'treat-teammate', tendencyWeight: 2 },
            ],
          },
        ],
      },
    },
    {
      id: 'd',
      title: '普通通道',
      description: '不需要通行证的常规通道。',
      activities: [{
        id: 'checkpoint-shop',
        title: '通道补给',
        shop: {
          title: '通道补给架',
          description: '用信用点换取补给，也可以直接离开。',
          offers: [{
            id: 'pass-ration',
            name: '通道口粮',
            description: '为白子恢复 2 点 HP。',
            costs: [{ resourceId: 'credits', amount: 1 }],
            heal: { characterId: 'shiroko', amount: 2 },
          }],
        },
      }],
    },
    { id: 'f', title: '员工通道', description: '凭临时通行证进入的内部通道，直通出口。' },
    { id: 'e', title: '出口', description: '调查路线出口。' },
  ],
  edges: [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
    {
      fromNodeId: 'c',
      toNodeId: 'f',
      condition: { kind: 'teamResourceAtLeast', resourceId: 'pass', amount: 1 },
    },
    { fromNodeId: 'c', toNodeId: 'd' },
    { fromNodeId: 'd', toNodeId: 'e' },
    { fromNodeId: 'f', toNodeId: 'e' },
  ],
};

/** A playable card-to-card relationship sample; no connector is needed to choose its targets. */
export const gameplayBScostTrainingDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:scost-training',
  name: '卡牌协同演练',
  entryInfo: {
    description: '演练队员卡牌与 sCost 配合，完成本局遭遇并抵达出口。',
    tips: ['卡牌费用减免只在受用卡实际执行时生效。', '能否提交以当前行动预览和费用状态为准。'],
  },
  resumeVersion: 4,
  startNodeId: 'briefing',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 8, maxHp: 8 },
    { characterId: 'serika', initialHp: 8, maxHp: 8 },
  ],
  initialPlayerCost: 3,
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'sCost', value: 3 },
    { characterId: 'serika', resourceId: 'sCost', value: 6 },
  ],
  actions: [
    { id: 'planning', name: '战术筹划', eligibleCharacterIds: ['shiroko'],
      description: '选一张友方卡牌，为其本轮使用减免 1 点 sCost。只有本轮实际执行的受用牌才享受减免。',
      target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] } },
    { id: 'coordinated-planning', name: '协同筹划', eligibleCharacterIds: ['shiroko'],
      description: '选一张友方卡牌，为其本轮使用减免 2 点 sCost，最低为零。',
      target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 2 }] } },
    { id: 'rifle-shot', name: '精确射击', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'sCost', amount: 2 }], effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
    { id: 'burst-shot', name: '连续射击', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'sCost', amount: 3 }], effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] } },
    { id: 'cover-shot', name: '牵制射击', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'sCost', amount: 2 }], effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
    { id: 'training-target-counterattack', name: '训练靶攻击', eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' }, tendencyRole: 'attack', effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
  ],
  nodes: [
    { id: 'briefing', title: '协同准备', description: '白子负责筹划，芹香负责射击。可先更换准备牌，再选择将获得减免的卡牌。' },
    { id: 'training', title: '协同演练场', encounter: {
      title: '筹划与射击', description: '用高亮检查作用来源和受用卡牌。修改目标只准备行动，确认后再提交本轮。',
      enemies: [{ id: '协同训练靶', initialHp: 6, maxHp: 6, actions: [{ actionId: 'training-target-counterattack', tendencyWeight: 1 }] }],
      participants: [
        { characterId: 'shiroko', actions: ['planning', 'coordinated-planning'].map(actionId => ({ actionId, tendencyWeight: 1 })) },
        { characterId: 'serika', actions: ['rifle-shot', 'burst-shot', 'cover-shot'].map(actionId => ({ actionId, tendencyWeight: 1 })) },
      ],
    } },
    { id: 'exit', title: '演练出口' },
  ],
  edges: [{ fromNodeId: 'briefing', toNodeId: 'training' }, { fromNodeId: 'training', toNodeId: 'exit' }],
};

/**
 * P5 sample: two autonomous party members, three ordered Enemies, contextual
 * Action preferences, and a second-round Swap / manual-target exercise.
 */
export const gameplayBAutonomousTargetBattleDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:autonomous-target-battle',
  name: '自主目标战斗演练',
  entryInfo: {
    description: '安排队员的战斗行动，并完成敌人会自动选择目标的演练。',
    tips: ['提交我方行动后，存活敌人会按自动目标规则行动。', '队员生命与本局资源会随 Run 进度保留。'],
  },
  resumeVersion: 4,
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 2,
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'focus', value: 2 },
    { characterId: 'serika', resourceId: 'focus', value: 2 },
  ],
  initialTeamResources: [
    { resourceId: 'clues', value: 0 },
    { resourceId: 'supplies', value: 1 },
  ],
  actions: [
    {
      id: 'autonomous-standard-shot',
      name: '普通射击',
      description: '优先射击当前 HP 比例最低的合法敌人，并记录 1 条线索。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy', preference: 'lowestHpRatio' },
      tendencyRole: 'attack',
      effectProgram: { resolve: [
        { op: 'damage', target: 'primary', amount: 2 },
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'clues', delta: 1 },
      ] },
    },
    {
      id: 'autonomous-take-cover',
      name: '就地掩护',
      description: '消耗 1 点专注整理姿态并恢复 1 点专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      tendencyRole: 'defense',
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 }] },
    },
    {
      id: 'autonomous-aid-teammate',
      name: '支援队友',
      description: '优先治疗 HP 损失比例最高的队员，恢复 2 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter', preference: 'highestMissingHpRatio' },
      tendencyRole: 'recovery',
      effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] },
    },
    {
      id: 'robot-counterattack',
      name: '机器人射击',
      description: '自主攻击当前 HP 比例最低的队员，造成 3 点伤害。',
      eligibleCharacterIds: [],
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      tendencyRole: 'attack',
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] },
    },
  ],
  nodes: [
    { id: 'entry', title: '编队入口', description: '白子与芹香进入现场。' },
    {
      id: 'battle',
      title: '机器人拦截区',
      description: '第一轮不需要手动指定目标；观察后手如何避开已击败的机器人。',
      encounter: {
        title: '自主索敌实战',
        description: '机器人 A 起始 2 / 8 HP，B 与 C 各有 8 HP。存活机器人会从各自手牌中自主攻击队员。',
        enemies: [
          { id: 'robot-a', initialHp: 2, maxHp: 8, actions: [{ actionId: 'robot-counterattack', tendencyWeight: 1 }] },
          { id: 'robot-b', initialHp: 8, maxHp: 8, actions: [{ actionId: 'robot-counterattack', tendencyWeight: 1 }] },
          { id: 'robot-c', initialHp: 8, maxHp: 8, actions: [{ actionId: 'robot-counterattack', tendencyWeight: 1 }] },
        ],
        participants: [
          {
            characterId: 'shiroko',
            actions: [
              { actionId: 'autonomous-standard-shot', tendencyWeight: Number.MAX_SAFE_INTEGER },
              { actionId: 'autonomous-take-cover', tendencyWeight: 1 },
              { actionId: 'autonomous-aid-teammate', tendencyWeight: 1 },
            ],
          },
          {
            characterId: 'serika',
            actions: [
              { actionId: 'autonomous-standard-shot', tendencyWeight: Number.MAX_SAFE_INTEGER },
              { actionId: 'autonomous-take-cover', tendencyWeight: 1 },
              { actionId: 'autonomous-aid-teammate', tendencyWeight: 1 },
            ],
          },
        ],
      },
    },
    { id: 'exit', title: '演练出口', description: '完成自主战斗演练。' },
  ],
  edges: [
    { fromNodeId: 'entry', toNodeId: 'battle' },
    { fromNodeId: 'battle', toNodeId: 'exit' },
  ],
};

const mapSpot = spot(GAMEPLAY_B_MAP_SPOT_ID, 'base:area:schale_main')
  .name('地图终端')
  .desc('进入 Gameplay B 地图，沿节点路线探索并处理遭遇。')
  .cost(0)
  .maxLevel(1)
  .tags(tagPath('tactical'), tagPath('office'))
  .build();

export const gameplayBMapDatapack: Datapack = {
  modName: 'gameplay-b',
  name: 'Gameplay B Map',
  version: '1.0.0',
  inits: [],
  areas: [],
  spots: [{
    ...mapSpot,
    functionalities: [
      ...(mapSpot.functionalities ?? []),
      {
        id: 'field-investigation-map',
        kind: 'mapEntry',
        mapId: gameplayBMapDefinition.id,
        mapEntryLabel: '进入现场调查路线',
      },
      {
        id: 'minimal-battle-map',
        kind: 'mapEntry',
        mapId: gameplayBMinimalBattleDefinition.id,
        mapEntryLabel: '进入极简战斗演练',
      },
      {
        id: 'scost-training-map',
        kind: 'mapEntry',
        mapId: gameplayBScostTrainingDefinition.id,
        mapEntryLabel: '进入卡牌协同演练',
      },
      {
        id: 'linear-battle-map',
        kind: 'mapEntry',
        mapId: gameplayBLinearBattleDefinition.id,
        mapEntryLabel: '进入废弃走廊战斗',
      },
      {
        id: 'activity-hall-map',
        kind: 'mapEntry',
        mapId: gameplayBActivityHallDefinition.id,
        mapEntryLabel: '进入废弃活动室',
      },
      {
        id: 'forked-route-map',
        kind: 'mapEntry',
        mapId: gameplayBForkedRouteDefinition.id,
        mapEntryLabel: '进入分叉调查路线',
      },
      {
        id: 'continuous-conditional-map',
        kind: 'mapEntry',
        mapId: gameplayBContinuousConditionalDefinition.id,
        mapEntryLabel: '进入连续调查与员工通道',
      },
      {
        id: 'autonomous-target-battle-map',
        kind: 'mapEntry',
        mapId: gameplayBAutonomousTargetBattleDefinition.id,
        mapEntryLabel: '进入自主目标战斗演练',
      },
      {
        id: 'effect-program-example-map',
        kind: 'mapEntry',
        mapId: gameplayBEffectProgramExampleMap.id,
        mapEntryLabel: '进入效果程序作者示例',
      },
      {
        id: 'status-example-map',
        kind: 'mapEntry',
        mapId: gameplayBStatusExampleMap.id,
        mapEntryLabel: '进入状态原语演练',
      },
      {
        id: 'prepared-tag-combo-example-map',
        kind: 'mapEntry',
        mapId: gameplayBPreparedTagComboExampleMap.id,
        mapEntryLabel: '进入爆破连携演练',
      },
      {
        id: 'fact-gated-pool-example-map',
        kind: 'mapEntry',
        mapId: gameplayBFactGatedPoolExampleMap.id,
        mapEntryLabel: '进入事实门控候选池示例',
      },
      {
        id: 'card-modifier-example-map',
        kind: 'mapEntry',
        mapId: gameplayBCardModifierExampleMap.id,
        mapEntryLabel: '进入卡牌效果修正演练',
      },
      {
        id: 'shield-example-map',
        kind: 'mapEntry',
        mapId: gameplayBShieldExampleMap.id,
        mapEntryLabel: '进入友方护盾演练',
      },
      {
        id: 'revive-example-map',
        kind: 'mapEntry',
        mapId: gameplayBReviveExampleMap.id,
        mapEntryLabel: '进入复苏原语演练',
      },
      {
        id: 'damage-reduction-example-map',
        kind: 'mapEntry',
        mapId: gameplayBDamageReductionExampleMap.id,
        mapEntryLabel: '进入防御减伤演练',
      },
      {
        id: 'heal-applied-resource-example-map',
        kind: 'mapEntry',
        mapId: gameplayBHealAppliedResourceExampleMap.id,
        mapEntryLabel: '进入受治资源回馈演练',
      },
      {
        id: 'damage-applied-resource-example-map',
        kind: 'mapEntry',
        mapId: gameplayBDamageAppliedResourceExampleMap.id,
        mapEntryLabel: '进入受伤资源回馈演练',
      },
      {
        id: 'actual-amount-threshold-example-map',
        kind: 'mapEntry',
        mapId: gameplayBActualAmountThresholdExampleMap.id,
        mapEntryLabel: '进入实际变化阈值演练',
      },
      {
        id: 'enemy-defeated-reward-example-map',
        kind: 'mapEntry',
        mapId: gameplayBEnemyDefeatedRewardExampleMap.id,
        mapEntryLabel: '进入单体击杀回馈演练',
      },
      {
        id: 'status-expiry-reward-example-map',
        kind: 'mapEntry',
        mapId: gameplayBStatusExpiryRewardExampleMap.id,
        mapEntryLabel: '进入 Status 自然到期回馈演练',
      },
      {
        id: 'status-damage-reward-example-map',
        kind: 'mapEntry',
        mapId: gameplayBStatusDamageRewardExampleMap.id,
        mapEntryLabel: '进入 Status 受伤回馈演练',
      },
      {
        id: 'damage-protection-example-map',
        kind: 'mapEntry',
        mapId: gameplayBDamageProtectionExampleMap.id,
        mapEntryLabel: '进入一次性受击保护演练',
      },
      {
        id: 'maprun-status-example-map',
        kind: 'mapEntry',
        mapId: gameplayBMapRunStatusExampleMap.id,
        mapEntryLabel: '进入跨遭遇状态演练',
      },
    ],
  }],
  maps: [
    gameplayBMapDefinition,
    gameplayBMinimalBattleDefinition,
    gameplayBScostTrainingDefinition,
    gameplayBLinearBattleDefinition,
    gameplayBActivityHallDefinition,
    gameplayBForkedRouteDefinition,
    gameplayBContinuousConditionalDefinition,
    gameplayBAutonomousTargetBattleDefinition,
    gameplayBEffectProgramExampleMap,
    gameplayBStatusExampleMap,
    gameplayBPreparedTagComboExampleMap,
    gameplayBFactGatedPoolExampleMap,
    gameplayBCardModifierExampleMap,
    gameplayBShieldExampleMap,
    gameplayBReviveExampleMap,
    gameplayBDamageReductionExampleMap,
    gameplayBHealAppliedResourceExampleMap,
    gameplayBDamageAppliedResourceExampleMap,
    gameplayBActualAmountThresholdExampleMap,
    gameplayBEnemyDefeatedRewardExampleMap,
    gameplayBStatusExpiryRewardExampleMap,
    gameplayBDamageProtectionExampleMap,
    gameplayBMapRunStatusExampleMap,
    gameplayBStatusDamageRewardExampleMap,
  ],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
};
