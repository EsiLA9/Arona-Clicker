// ============================================================
// data/base/stories.ts - 触发入口（activeStories / passiveStories / passivePools）
//   演出本体（story 内容）已拆至 stories-play.ts，此处仅 re-export baseStories。
//   Entry.id 与 Story.id 当前 1:1 同值，Entry.storyId 显式引用演出本体。
//
//   Talklet 演出风格（与 UI 聊天流同步）：
//     - 缺省 = 对话气泡：speaker 归属，左侧圆形头像 + 用户名 + 小箭头气泡。
//     - kind: 'narration' = 场间旁白：横跨聊天流宽度，align: center|left|right 对齐。
//     - avatar：可选头像 URL；缺省渲染首字母圆形占位（本项目暂无图片资源，故不设）。
// ============================================================

import {
  ActiveStoryEntry,
  PassiveStoryEntry,
  PassivePoolDef,
  and,
  cond,
  Resource,
} from '../../engine/types';
import { tagPath } from '../../engine/core/tag';

export { baseStories } from './stories-play';
// 聊天空间壁垒 / 冷却 / 阻断 示例（见 stories-conversation-walls.ts）
import {
  hoshinoConversationPool,
  hoshinoConversationStories,
  cooldownDemoPool,
  cooldownDemoStories,
} from './stories-conversation-walls';

// ============================================================
// 触发入口拆分为两张独立表：
//   baseActiveStories  = 主线 / 支线入口（进入场景自动展开，不可重复）
//   basePassiveStories = 随机闲聊入口（无剧情时按权重随机抽取）
// ============================================================

export const baseActiveStories: ActiveStoryEntry[] = [
  {
    id: 'base:story:schale_welcome',
    storyId: 'base:story:schale_welcome',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:schale_office'],
  },
  {
    id: 'base:story:abydos_welcome',
    storyId: 'base:story:abydos_welcome',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:abydos'],
  },
  {
    id: 'base:story:millennium_welcome',
    storyId: 'base:story:millennium_welcome',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:millennium'],
  },
  // ============================================================
  // Demo: Story 跳转链 + 条件奖励 + 重阅读守卫
  //
  //   千禧年 · 游戏开发部的危机
  //   展示三种机制：
  //     1. 选项级 goto：分歧跳转到不同分支 Story
  //     2. Talklet 级 insert：插入子剧情后返回原地
  //     3. conditionalRewards：按经过的 Story 发放分歧奖励
  //     4. replayable + branchGuards：重阅读 + 分歧点准入守卫
  // ============================================================
  {
    id: 'base:story:millennium_game_crisis',
    storyId: 'base:story:millennium_game_crisis_intro',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:millennium'],
    replayable: true,
    // 分歧奖励：亲自调试路线奖励更高（体现"更深入的参与"）
    completionStrategy: 'conditional',
    conditionalRewards: [
      {
        condition: and({ target: 'visitedStoryInChain', key: 'base:story:millennium_game_crisis_debug', comparator: '==', value: 1 }),
        effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 40 }],
      },
      {
        condition: and({ target: 'visitedStoryInChain', key: 'base:story:millennium_game_crisis_bribe', comparator: '==', value: 1 }),
        effects: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      },
    ],
    // 分歧点守卫：进入"买冰淇淋"分支需先真正读过该分支
    // （首次走"亲自调试"的玩家，重阅读时无法跳过未读的分歧）
    branchGuards: [
      {
        storyId: 'base:story:millennium_game_crisis_bribe',
        prerequisites: [{ storyId: 'base:story:millennium_game_crisis_bribe', talkletIndex: -1 }],
        denialMessage: '你还没有真正走过这条路线，无法回顾该分歧。',
      },
    ],
  },
  // ============================================================
  // Demo: 全局顺序故事链 (hasReadStory)
  //   渐进揭示：(上)完成 → (下)名称揭开 + 可开始。
  //   跨 Run 永久记忆：完成过上篇就不会再隐藏下篇。
  // ============================================================
  {
    id: 'base:story:serika_side_1',
    storyId: 'base:story:serika_side_1',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:abydos'],
  },
  {
    id: 'base:story:serika_side_2',
    storyId: 'base:story:serika_side_2',
    type: 'active',
    triggerCondition: and({ target: 'hasReadStory', key: 'base:story:serika_side_1', comparator: '==', value: 1 }),
    availableInits: ['base:init:abydos'],
    // reveal: 完成上篇后，下篇名称和条件才从 "???" 揭开。
    //   name + condition 同阶段揭示 → 不会在 "???" 状态下泄露条件文本。
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'hasReadStory', key: 'base:story:serika_side_1', comparator: '==', value: 1 }) },
      { reveal: 'condition', condition: and({ target: 'hasReadStory', key: 'base:story:serika_side_1', comparator: '==', value: 1 }) },
    ],
  },
  // ============================================================
  // Demo: 当前 Run 内逐一揭示的故事链 (hasReadStoryInRun)
  //
  //   设计模式：n 已完成 →  n+1 可开始 + n+2 名称暗示
  //   —————————————————————————————————————————————
  //   run_chain_1 是入口，始终可见可玩。
  //   run_chain_2 的名称和开播权绑定在 run_chain_1 完成上。
  //   run_chain_3 的名称在 run_chain_1 完成时暗示，开播权在 run_chain_2 完成时解锁。
  //
  //   玩家体验（每次新 Run）：
  //   - 初始：只看到 (一) 可玩，(二)(三) 均为 "???"
  //   - 完成 (一)：(二) 揭开名称+可开始，(三) 揭开名称但"条件不足"
  //   - 完成 (二)：(三) 变为可开始
  //   - 新 Run 全部重置回到 "???"
  // ============================================================
  {
    id: 'base:story:run_chain_1',
    storyId: 'base:story:run_chain_1',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:schale_office'],
  },
  {
    id: 'base:story:run_chain_2',
    storyId: 'base:story:run_chain_2',
    type: 'active',
    triggerCondition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }),
    availableInits: ['base:init:schale_office'],
    // reveal: 名称+条件都在完成 (一) 后揭开，与开播权同步。
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }) },
      { reveal: 'condition', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }) },
    ],
  },
  {
    id: 'base:story:run_chain_3',
    storyId: 'base:story:run_chain_3',
    type: 'active',
    triggerCondition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_2', comparator: '==', value: 1 }),
    availableInits: ['base:init:schale_office'],
    // reveal: 双阶段揭示。
    //   name 在 (一)完成时揭开 → 暗示有第三章。
    //   condition 在 (二)完成时揭开 → 同时开播权解锁。
    //   中间阶段玩家看到 "深夜巡逻 (三)" 但 "条件未知"，营造悬疑感。
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_1', comparator: '==', value: 1 }) },
      { reveal: 'condition', condition: and({ target: 'hasReadStoryInRun', key: 'base:story:run_chain_2', comparator: '==', value: 1 }) },
    ],
  },
  {
    // 天台相遇剧情（夏莱）：由天台 Trigger（进入 schale_rooftop）启动。
    // 独立于聊天空间邀约（hoshino_conv_2），避免前往天台时重复触发同一邀约。
    id: 'base:story:hoshino_rooftop_meet',
    storyId: 'base:story:hoshino_rooftop_meet',
    type: 'active',
    triggerCondition: and(),
    availableInits: ['base:init:schale_office'],
  },
];

export const basePassiveStories: PassiveStoryEntry[] = [
  {
    id: 'base:story:schale_briefing',
    storyId: 'base:story:schale_briefing',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'daily')],
    // 信息揭示示例：累计产出 30 信用点后才知晓该剧情标题
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'stat', key: '$GlobalProducedAmount base:resource:credit', comparator: '>=', value: 30 }) },
    ],
    // 闲聊完结奖励：首次 +15 青辉石（Global），重复 +5
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_tea',
    storyId: 'base:story:schale_tea',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'daily')],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_printer',
    storyId: 'base:story:schale_printer',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'office')],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_archive',
    storyId: 'base:story:schale_archive',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'office')],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_sunset',
    storyId: 'base:story:schale_sunset',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'daily')],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  // ============================================================
  // 池系统测试用新增：初始 Init（夏莱办公室）
  //   schale_planner  — 日常池；其 Talklet 效果会开启 night_mode flag，
  //                     从而解锁「深夜闲聊」池（链式解锁演示）。
  //   schale_vending  — 办公专题池（gate：拥有 office 标签设施 ≥ 1）。
  //   schale_night    — 深夜池（gate：flag night_mode）。
  // ============================================================
  {
    id: 'base:story:schale_planner',
    storyId: 'base:story:schale_planner',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'daily')],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_vending',
    storyId: 'base:story:schale_vending',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'office')],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:schale_night',
    storyId: 'base:story:schale_night',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:schale_office'],
    tags: [tagPath('theme', 'night')],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:abydos_daily_committee',
    storyId: 'base:story:abydos_daily_committee',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:abydos'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:abydos_siesta',
    storyId: 'base:story:abydos_siesta',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:abydos'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:abydos_serika_shift',
    storyId: 'base:story:abydos_serika_shift',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:abydos'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:abydos_money',
    storyId: 'base:story:abydos_money',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:abydos'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:millennium_calculation',
    storyId: 'base:story:millennium_calculation',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:millennium'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:millennium_game_dev',
    storyId: 'base:story:millennium_game_dev',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 2,
    availableInits: ['base:init:millennium'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:millennium_hack',
    storyId: 'base:story:millennium_hack',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:millennium'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  {
    id: 'base:story:millennium_server',
    storyId: 'base:story:millennium_server',
    type: 'passive',
    triggerCondition: and(),
    repeatable: true,
    weight: 1,
    availableInits: ['base:init:millennium'],
    completionReward: {
      first: [{ op: 'addResource', target: Resource.Pyroxene, value: 15 }],
      repeat: [{ op: 'addResource', target: Resource.Pyroxene, value: 5 }],
    },
  },
  // —— 聊天空间壁垒 / 冷却 / 阻断 示例入口 ——
  ...hoshinoConversationStories,
  ...cooldownDemoStories,
];

// ============================================================
// basePassivePools — 被动闲聊池（树状抽取 + reactor 反射 gate）
//
// 夏莱办公室（初始 Init）演示树：
//   schale_root（夏莱闲聊）
//   ├── schale_daily        (w3) 日常：briefing / tea / sunset / planner
//   ├── schale_office_topic (w2, gate: 拥有 office 标签设施 ≥ 1)
//   │                             printer / archive / vending
//   └── schale_night_owl    (w2, gate: flag night_mode)
//                                 night
//
// 测试路径：
//   1) 初始状态只有「日常」池可抽；
//   2) 解锁任意 office 标签设施（如信用点制造机）→ 办公专题池即时解锁；
//   3) 抽到「日程表攻防」→ 其 Talklet 效果置 night_mode flag → 深夜池解锁。
// ============================================================
export const basePassivePools: PassivePoolDef[] = [
  {
    id: 'base:pool:schale_root',
    name: '夏莱闲聊',
    tags: [tagPath('place', 'schale')],
    children: [
      { id: 'base:pool:schale_daily', weight: 3 },
      { id: 'base:pool:schale_office_topic', weight: 2 },
      { id: 'base:pool:schale_night_owl', weight: 2 },
    ],
  },
  {
    id: 'base:pool:schale_daily',
    name: '日常',
    tags: [tagPath('theme', 'daily')],
    children: [
      { id: 'base:story:schale_briefing', weight: 1 },
      { id: 'base:story:schale_tea', weight: 2 },
      { id: 'base:story:schale_sunset', weight: 1 },
      { id: 'base:story:schale_planner', weight: 2 },
    ],
  },
  {
    id: 'base:pool:schale_office_topic',
    name: '办公区专题',
    tags: [tagPath('theme', 'office')],
    condition: and(cond('tagCount', 'spots:office', '>=', 1)),
    children: [
      { id: 'base:story:schale_printer', weight: 1 },
      { id: 'base:story:schale_archive', weight: 2 },
      { id: 'base:story:schale_vending', weight: 1 },
    ],
  },
  {
    id: 'base:pool:schale_night_owl',
    name: '深夜闲聊',
    tags: [tagPath('theme', 'night')],
    condition: and(cond('flag', 'night_mode', '==', 1)),
    children: [
      { id: 'base:story:schale_night', weight: 1 },
    ],
  },
  // —— 聊天空间壁垒 / 冷却 / 阻断 示例池 ——
  hoshinoConversationPool,
  cooldownDemoPool,
];
