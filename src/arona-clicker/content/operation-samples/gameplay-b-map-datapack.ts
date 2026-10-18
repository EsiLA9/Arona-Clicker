import type { Datapack } from '../../../data-services/contracts/datapack';
import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';
import { spot } from '../def-factory/spot';
import { tagPath } from '../../../engine/core/tag';

export const GAMEPLAY_B_MAP_SPOT_ID = 'gameplay-b:spot:operation_terminal';

/** Clean Map-only Gameplay B bundle. Legacy Operation samples are not included. */
export const gameplayBMapDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:field-investigation',
  name: '现场调查路线',
  resumeVersion: 2,
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
      effects: [{ scope: 'team', resourceId: 'clues', amount: 1 }],
    },
    {
      id: 'steady-equipment',
      name: '稳住设备',
      description: '消耗个人体力，调整设备状态。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      costs: [{ scope: 'actor', resourceId: 'stamina', amount: 1 }],
      effects: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
    },
    {
      id: 'assist-teammate',
      name: '协助队友',
      description: '消耗共用物资，帮助一名队员集中注意力。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effects: [{ scope: 'actor', resourceId: 'focus', amount: 1, recipient: 'target' }],
    },
  ],
  initialActorResources: [
    { characterId: 'shiroko', resourceId: 'stamina', value: 2 },
    { characterId: 'serika', resourceId: 'stamina', value: 2 },
  ],
  initialTeamResources: [
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

/** Two-round battle using the normal Map entry, Hand and Commit flow. */
export const gameplayBMinimalBattleDefinition: GameplayMapDef = {
  id: 'gameplay-b:map:minimal-battle',
  name: '极简战斗演练',
  resumeVersion: 1,
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
    target: { kind: 'enemy' },
    hpEffects: [{ amount: -2 }],
  }],
  nodes: [
    { id: 'entry', title: '准备区', description: '白子与芹香各有 10 HP。前往演练场开始战斗。' },
    {
      id: 'battle',
      title: '演练场',
      description: '击败训练靶后可前往出口。',
      encounter: {
        title: '两人对一敌',
        description: '训练靶有 6 HP。两名队员每轮各攻击 2 点；训练靶存活时还击 2 点。提交两轮行动即可获胜。',
        enemies: [{ id: '训练靶', initialHp: 6, maxHp: 6, damage: 2 }],
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'attack', tendencyWeight: 1 }] },
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
  resumeVersion: 1,
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
      hpEffects: [{ amount: -2 }],
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      hpEffects: [{ amount: -4 }],
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effects: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
    },
    {
      id: 'signal-position',
      name: '通报位置',
      description: '把走廊情况回报给现场，积累 1 条线索。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effects: [{ scope: 'team', resourceId: 'clues', amount: 1 }],
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
        description: '巡逻机有 12 HP，每轮还击 2 点。手牌只有 3 张，第 4 项行动需要 PlayerCommand。',
        enemies: [{ id: '巡逻机', initialHp: 12, maxHp: 12, damage: 2 }],
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
  resumeVersion: 1,
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
      hpEffects: [{ amount: -2 }],
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      hpEffects: [{ amount: -4 }],
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effects: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
    },
    {
      id: 'catch-breath',
      name: '调整呼吸',
      description: '在休整中为一名队员恢复 2 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      hpEffects: [{ amount: 2 }],
    },
    {
      id: 'tidy-supplies',
      name: '整理物资',
      description: '清点现场补给，共用资源 +1。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effects: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
    },
    {
      id: 'treat-teammate',
      name: '照顾队友',
      description: '消耗共用补给，为一名队员恢复 3 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      hpEffects: [{ amount: 3 }],
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
            description: '巡逻机器人有 8 HP，每轮还击 2 点。',
            enemies: [{ id: '巡逻机器人', initialHp: 8, maxHp: 8, damage: 2 }],
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
  resumeVersion: 1,
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
      effects: [{ scope: 'team', resourceId: 'clues', amount: 1 }],
      hpEffects: [{ amount: -2 }],
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      hpEffects: [{ amount: -4 }],
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effects: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
    },
    {
      id: 'collect-intel',
      name: '收集情报',
      description: '从现场设备中提取 1 条线索。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effects: [{ scope: 'team', resourceId: 'clues', amount: 1 }],
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
        description: '守卫有 6 HP，每轮还击 2 点。',
        enemies: [{ id: '守卫', initialHp: 6, maxHp: 6, damage: 2 }],
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
  resumeVersion: 1,
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
      hpEffects: [{ amount: -2 }],
    },
    {
      id: 'focused-shot',
      name: '瞄准射击',
      description: '消耗个人专注，对一名敌人造成 4 点伤害。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      hpEffects: [{ amount: -4 }],
    },
    {
      id: 'take-cover',
      name: '就地掩护',
      description: '调整姿态，恢复 1 点个人专注。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'self' },
      effects: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
    },
    {
      id: 'search-terminal',
      name: '检索终端',
      description: '在守卫终端上找到一张临时员工通行证。',
      eligibleCharacterIds: [],
      target: { kind: 'partyCharacter' },
      effects: [{ scope: 'team', resourceId: 'pass', amount: 1 }],
    },
    {
      id: 'catch-breath',
      name: '调整呼吸',
      description: '在休整中为一名队员恢复 2 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      hpEffects: [{ amount: 2 }],
    },
    {
      id: 'tidy-supplies',
      name: '整理物资',
      description: '清点现场补给，共用资源 +1。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'none' },
      effects: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
    },
    {
      id: 'treat-teammate',
      name: '照顾队友',
      description: '消耗共用补给，为一名队员恢复 3 点 HP。',
      eligibleCharacterIds: ['shiroko', 'serika'],
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      hpEffects: [{ amount: 3 }],
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
        description: '守卫有 6 HP，每轮还击 2 点。检索终端是可选 Ability，提交时消耗 1 PlayerCost 取得通行证。',
        enemies: [{ id: '守卫', initialHp: 6, maxHp: 6, damage: 2 }],
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
    ],
  }],
  maps: [
    gameplayBMapDefinition,
    gameplayBMinimalBattleDefinition,
    gameplayBLinearBattleDefinition,
    gameplayBActivityHallDefinition,
    gameplayBForkedRouteDefinition,
    gameplayBContinuousConditionalDefinition,
  ],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
};
