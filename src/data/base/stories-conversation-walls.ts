// ============================================================
// data/base/stories-conversation-walls.ts
// 聊天空间壁垒 / 冷却 / 阻断 的示例数据（对应本次需求）。
//
// 三项能力通过 PassiveStoryEntry / PassivePoolDef 的字段表达：
//   1. owner（壁垒）：entry 或 pool 声明 owner=VariantId 后，仅在该学生的对话空间
//      被抽取；一般聊天只抽 owner 为空的全局闲聊。
//   2. cooldownFrames（冷却）：entry 或 pool 命中后需经过 N 帧才能再次被选取，
//      状态落在 PlayerState.passiveCooldowns。
//   3. block（阻断/重启）：entry 播完后锁定其 owner 的对话空间，直到 block 条件组
//      满足（玩家前往某区域 / 持某物品 / 某 flag 等）才解除，实现「剧情要求前往某地
//      继续下一步」的关卡式剧情。
//
// 演出本体（Talklet）已拆至 stories-play.ts，此处仅声明触发入口与池结构。
// ============================================================

import { passiveStory, passivePool, and, cond } from '../../engine/types';
import type { PassivePoolDef, PassiveStoryEntry } from '../../engine/types';

// ------------------------------------------------------------
// 1. 壁垒示例：每个学生的专属闲聊池（owner 路由）
// ------------------------------------------------------------
// 星野的对话空间只抽 this pool 内的 entry；一般聊天抽不到它们。
export const hoshinoConversationPool: PassivePoolDef = passivePool('base:pool:hoshino_conv')
  .name('星野对话空间')
  .owner('Hoshino')
  .child('base:story:hoshino_conv_1')
  .child('base:story:hoshino_conv_2')
  .child('base:story:hoshino_bond_invite')
  .build();

export const hoshinoConversationStories: PassiveStoryEntry[] = [
  passiveStory('base:story:hoshino_conv_1', 'base:story:hoshino_tea_time')
    // 星野专属演出本体（不复用全局「窗边晚霞」，保证壁垒 owner 反查唯一命中、内容独有）
    .owner('Hoshino')
    .inits()
    .weight(1)
    // 冷却：抽完后 600 帧（约 10 秒 tick）内不再被选取
    .cooldownFrames(600)
    .build(),
  passiveStory('base:story:hoshino_conv_2', 'base:story:hoshino_rooftop_hint')
    .owner('Hoshino')
    // 天台剧情只在夏莱 Init 出现（外部 Init 无天台区域）
    .inits('base:init:schale_office')
    .repeatable(false)
    .weight(1)
    // 阻断：播完后锁定星野对话空间，直到玩家「到达夏莱天台区域」才重启
    .block(and(cond('area', 'base:area:schale_rooftop', '==', 1)))
    // 天台演出中锁定移动且不被打断（演出中途不可离场 / 移动打断）
    .leaveArea(false)
    .interruptible(false)
    .build(),
  passiveStory('base:story:hoshino_bond_invite')
    .owner('Hoshino')
    .inits()
    .repeatable(false)
    .weight(1)
    .build(),
];

// ------------------------------------------------------------
// 2. 冷却示例（全局闲聊池级冷却）
// ------------------------------------------------------------
export const cooldownDemoPool: PassivePoolDef = passivePool('base:pool:cooldown_demo')
  .name('冷却演示池')
  // 该池整体命中后 1200 帧内不再被抽（覆盖其内所有 entry）
  .cooldownFrames(1200)
  .child('base:story:cooldown_demo_1')
  .build();

export const cooldownDemoStories: PassiveStoryEntry[] = [
  passiveStory('base:story:cooldown_demo_1', 'base:story:schale_briefing')
    .inits()
    .weight(1)
    .build(),
];