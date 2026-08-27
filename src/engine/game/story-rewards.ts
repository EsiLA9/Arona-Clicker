// ============================================================
// engine/game/story-rewards.ts — 完结奖励 / 冷却 / 对话阻断
// 从 story-service.ts 拆出：applyCompletionReward / recordPassiveCooldown / maybeBlockConversation
// ============================================================

import type { PassiveStoryEntry, StoryDef, StoryEntryDef } from '../types/entities';
import type { StoryRuntime } from './story-context';

/**
 * 完结奖励评估：
 * - conditional 策略：按声明顺序评估 conditionalRewards，首个满足的生效。
 * - simple 策略（缺省，兼容现有行为）：passive 闲聊的 first / repeat。
 */
export function applyCompletionReward(rt: StoryRuntime, entry: StoryEntryDef, story: StoryDef): void {
  if (entry.completionStrategy === 'conditional' && entry.conditionalRewards && entry.conditionalRewards.length > 0) {
    const matched = entry.conditionalRewards.find(r => rt.conditionSystem.evaluateGroup(r.condition, rt.getState()));
    if (matched && matched.effects.length > 0) {
      rt.effectEngine.applyEffects(matched.effects);
      rt.lastRewarded.value = { source: 'conditional', effects: matched.effects };
    }
    return;
  }
  if (entry.completionReward) {
    // 该 Story 首次完成发 first，重复完成发 repeat（一般不配置 repeat）
    const isFirst = !rt.hasCompletedStory(story.id);
    const reward = isFirst ? entry.completionReward.first : entry.completionReward.repeat;
    if (reward && reward.length > 0) {
      rt.effectEngine.applyEffects(reward);
      rt.lastRewarded.value = { source: isFirst ? 'first' : 'repeat', effects: reward };
    }
  }
}

/**
 * 被动闲聊完结后写入冷却帧：entry 自身 + 其归属的池（若池声明了 cooldownFrames）。
 * 抽选时未过冷却期的 entry/池将被剪枝（见 PassivePoolSystem.pick）。
 */
export function recordPassiveCooldown(rt: StoryRuntime, entry: PassiveStoryEntry): void {
  if (!entry.cooldownFrames) return;
  const frame = rt.getState().totalFrames;
  const cooldowns = { ...(rt.getState().passiveCooldowns ?? {}) };
  cooldowns[entry.id] = frame;
  // 该 entry 被哪些池以子节点形式引用（归属池）：这些池命中后也进入冷却
  for (const pool of rt.registry.passivePools.values()) {
    if (!pool.cooldownFrames) continue;
    if (pool.children.some(child => child.id === entry.id)) {
      cooldowns[pool.id] = frame;
    }
  }
  rt.mutations.setPassiveCooldowns(cooldowns);
}

/**
 * 被动闲聊完结后若声明了 block 条件，则锁定该学生对话空间（壁垒重启），
 * 直到条件组满足（由各 tick / 区域进入事件经 StateMutationService 解除）。
 */
export function maybeBlockConversation(rt: StoryRuntime, entry: PassiveStoryEntry): void {
  if (entry.owner && entry.block) {
    rt.mutations.setStudentBlock(entry.owner, entry.id);
  }
}
