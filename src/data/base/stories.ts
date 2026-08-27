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
  activeStory,
  passiveStory,
  passivePool,
  and,
  cond,
  Resource,
} from '../../engine/types';
import type { ActiveStoryEntry, PassivePoolDef, PassiveStoryEntry } from '../../engine/types';
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
  activeStory('base:story:schale_welcome').inits('base:init:schale_office').replayable().build(),
  activeStory('base:story:schale_flow_show').inits('base:init:schale_office').replayable().build(),
  activeStory('base:story:abydos_welcome').inits('base:init:abydos').replayable().build(),
  activeStory('base:story:millennium_welcome').inits('base:init:millennium').replayable().build(),
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
  activeStory('base:story:millennium_game_crisis', 'base:story:millennium_game_crisis_intro')
    .inits('base:init:millennium')
    .replayable()
    // 分歧奖励：亲自调试路线奖励更高（体现"更深入的参与"）
    .completionStrategy('conditional')
    .conditionalReward(
      and(cond('visitedStoryInChain', 'base:story:millennium_game_crisis_debug', '==', 1)),
      { op: 'addResource', target: Resource.Pyroxene, value: 40 },
    )
    .conditionalReward(
      and(cond('visitedStoryInChain', 'base:story:millennium_game_crisis_bribe', '==', 1)),
      { op: 'addResource', target: Resource.Pyroxene, value: 15 },
    )
    // 分歧点守卫：进入"买冰淇淋"分支需先真正读过该分支
    // （首次走"亲自调试"的玩家，重阅读时无法跳过未读的分歧）
    .branchGuard(
      'base:story:millennium_game_crisis_bribe',
      [{ storyId: 'base:story:millennium_game_crisis_bribe', talkletIndex: -1 }],
      '你还没有真正走过这条路线，无法回顾该分歧。',
    )
    .build(),
  // ============================================================
  // Demo: 全局顺序故事链 (hasReadStory)
  //   渐进揭示：(上)完成 → (下)名称揭开 + 可开始。
  //   跨 Run 永久记忆：完成过上篇就不会再隐藏下篇。
  // ============================================================
  activeStory('base:story:serika_side_1').inits('base:init:abydos').replayable().build(),
  activeStory('base:story:serika_side_2')
    .inits('base:init:abydos')
    .replayable()
    .when(and(cond('hasReadStory', 'base:story:serika_side_1', '==', 1)))
    // reveal: 完成上篇后，下篇名称和条件才从 "???" 揭开。
    //   name + condition 同阶段揭示 → 不会在 "???" 状态下泄露条件文本。
    .reveal('name', and(cond('hasReadStory', 'base:story:serika_side_1', '==', 1)))
    .reveal('condition', and(cond('hasReadStory', 'base:story:serika_side_1', '==', 1)))
    .build(),
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
  activeStory('base:story:run_chain_1').inits('base:init:schale_office').replayable().build(),
  activeStory('base:story:run_chain_2')
    .inits('base:init:schale_office')
    .replayable()
    .when(and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    // reveal: 名称+条件都在完成 (一) 后揭开，与开播权同步。
    .reveal('name', and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    .reveal('condition', and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    .build(),
  activeStory('base:story:run_chain_3')
    .inits('base:init:schale_office')
    .replayable()
    .when(and(cond('hasReadStoryInRun', 'base:story:run_chain_2', '==', 1)))
    // reveal: 双阶段揭示。
    //   name 在 (一)完成时揭开 → 暗示有第三章。
    //   condition 在 (二)完成时揭开 → 同时开播权解锁。
    //   中间阶段玩家看到 "深夜巡逻 (三)" 但 "条件未知"，营造悬疑感。
    .reveal('name', and(cond('hasReadStoryInRun', 'base:story:run_chain_1', '==', 1)))
    .reveal('condition', and(cond('hasReadStoryInRun', 'base:story:run_chain_2', '==', 1)))
    .build(),
  // 天台相遇剧情（夏莱）：由天台 Trigger（进入 schale_rooftop）启动。
  // 独立于聊天空间邀约（hoshino_conv_2），避免前往天台时重复触发同一邀约。
  activeStory('base:story:hoshino_rooftop_meet').inits('base:init:schale_office').replayable().build(),
];

export const basePassiveStories: PassiveStoryEntry[] = [
  passiveStory('base:story:schale_briefing')
    .inits('base:init:schale_office')
    .weight(1)
    .tags(tagPath('theme', 'daily'))
    // 信息揭示示例：累计产出 30 信用点后才知晓该剧情标题
    .reveal('name', and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 30)))
    // 闲聊完结奖励：首次 +15 青辉石（Global），重复 +5
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:schale_tea')
    .inits('base:init:schale_office')
    .weight(2)
    .tags(tagPath('theme', 'daily'))
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:schale_printer')
    .inits('base:init:schale_office')
    .weight(1)
    .tags(tagPath('theme', 'office'))
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:schale_archive')
    .inits('base:init:schale_office')
    .weight(2)
    .tags(tagPath('theme', 'office'))
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:schale_sunset')
    .inits('base:init:schale_office')
    .weight(1)
    .tags(tagPath('theme', 'daily'))
    .rewardPyroxene(15, 5)
    .build(),
  // ============================================================
  // 池系统测试用新增：初始 Init（夏莱办公室）
  //   schale_planner  — 日常池；其 Talklet 效果会开启 night_mode flag，
  //                     从而解锁「深夜闲聊」池（链式解锁演示）。
  //   schale_vending  — 办公专题池（gate：拥有 office 标签设施 ≥ 1）。
  //   schale_night    — 深夜池（gate：flag night_mode）。
  // ============================================================
  passiveStory('base:story:schale_planner')
    .inits('base:init:schale_office')
    .weight(2)
    .tags(tagPath('theme', 'daily'))
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:schale_vending')
    .inits('base:init:schale_office')
    .weight(1)
    .tags(tagPath('theme', 'office'))
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:schale_night')
    .inits('base:init:schale_office')
    .weight(2)
    .tags(tagPath('theme', 'night'))
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:abydos_daily_committee')
    .inits('base:init:abydos')
    .weight(2)
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:abydos_siesta')
    .inits('base:init:abydos')
    .weight(1)
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:abydos_serika_shift')
    .inits('base:init:abydos')
    .weight(2)
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:abydos_money')
    .inits('base:init:abydos')
    .weight(1)
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:millennium_calculation')
    .inits('base:init:millennium')
    .weight(2)
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:millennium_game_dev')
    .inits('base:init:millennium')
    .weight(2)
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:millennium_hack')
    .inits('base:init:millennium')
    .weight(1)
    .rewardPyroxene(15, 5)
    .build(),
  passiveStory('base:story:millennium_server')
    .inits('base:init:millennium')
    .weight(1)
    .rewardPyroxene(15, 5)
    .build(),
  // —— 聊天空间壁垒 / 冷却 / 阻断 示例入口 ——
  ...hoshinoConversationStories,
  ...cooldownDemoStories,
  // —— 图片系统演示：星野自拍（含头像 + 发送图片） ——
  passiveStory('base:story:hoshino_selfie')
    .inits('base:init:schale_office')
    .weight(300)
    .tags(tagPath('theme', 'daily'))
    .rewardPyroxene(15, 5)
    .build(),
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
  passivePool('base:pool:schale_root')
    .name('夏莱闲聊')
    .tags(tagPath('place', 'schale'))
    .child('base:pool:schale_daily', 3)
    .child('base:pool:schale_office_topic', 2)
    .child('base:pool:schale_night_owl', 2)
    .build(),
  passivePool('base:pool:schale_daily')
    .name('日常')
    .tags(tagPath('theme', 'daily'))
    .child('base:story:schale_briefing', 1)
    .child('base:story:schale_tea', 2)
    .child('base:story:schale_sunset', 1)
    .child('base:story:schale_planner', 2)
    .build(),
  passivePool('base:pool:schale_office_topic')
    .name('办公区专题')
    .tags(tagPath('theme', 'office'))
    .condition(and(cond('tagCount', 'spots:office', '>=', 1)))
    .child('base:story:schale_printer', 1)
    .child('base:story:schale_archive', 2)
    .child('base:story:schale_vending', 1)
    .build(),
  passivePool('base:pool:schale_night_owl')
    .name('深夜闲聊')
    .tags(tagPath('theme', 'night'))
    .condition(and(cond('flag', 'night_mode', '==', 1)))
    .child('base:story:schale_night', 1)
    .build(),
  // —— 聊天空间壁垒 / 冷却 / 阻断 示例池 ——
  hoshinoConversationPool,
  cooldownDemoPool,
];
