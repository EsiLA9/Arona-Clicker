import type { PassiveStoryEntry, StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { Registry } from '../../../data-services/registry/registry';
import type { ConditionSystem } from '../../../engine/expression/condition-system';
import type { EffectEngine } from '../../../engine/effect/effect-engine';
import type { Effect } from '../../../engine/types/expression';
import type { PlayerState } from '../../types/state';
import type { StoryMutationPort } from '../../contracts/runtime/mutation';

export type RewardsSettlement = { source: 'first' | 'repeat' | 'conditional'; effects: Effect[] } | null;

export interface StoryRewardsContext {
  readonly registry: Registry;
  readonly conditionSystem: ConditionSystem;
  readonly effectEngine: Pick<EffectEngine, 'applyEffects'>;
  readonly mutations: Pick<StoryMutationPort, 'setPassiveCooldowns' | 'setStudentBlock'>;
  readonly getState: () => PlayerState;
  readonly hasCompletedStory: (storyId: string) => boolean;
}

/** Entry owns reward policy; first/repeat is decided against the terminal Story ID. */
export function applyCompletionReward(ctx: StoryRewardsContext, entry: StoryEntryDef, terminalStoryId: string): RewardsSettlement {
  if (entry.completionStrategy === 'conditional' && entry.conditionalRewards?.length) {
    const matched = entry.conditionalRewards.find(reward => ctx.conditionSystem.evaluateGroup(reward.condition, ctx.getState()));
    if (!matched?.effects.length) return null;
    ctx.effectEngine.applyEffects(matched.effects);
    return { source: 'conditional', effects: matched.effects };
  }
  if (!entry.completionReward) return null;
  const first = !ctx.hasCompletedStory(terminalStoryId);
  const effects = first ? entry.completionReward.first : entry.completionReward.repeat;
  if (!effects?.length) return null;
  ctx.effectEngine.applyEffects(effects);
  return { source: first ? 'first' : 'repeat', effects };
}

/** Passive cooldown is rooted in the source Entry and any containing pool declaration. */
export function recordPassiveCooldown(ctx: StoryRewardsContext, entry: PassiveStoryEntry): void {
  if (!entry.cooldownFrames) return;
  const state = ctx.getState();
  const cooldowns = { ...(state.passiveCooldowns ?? {}) };
  cooldowns[entry.id] = state.totalFrames;
  for (const pool of ctx.registry.passivePools.values()) {
    if (pool.cooldownFrames && pool.children.some(child => child.id === entry.id)) cooldowns[pool.id] = state.totalFrames;
  }
  ctx.mutations.setPassiveCooldowns(cooldowns);
}

/** A source passive Entry may block its owning student's conversation after completion. */
export function maybeBlockConversation(ctx: StoryRewardsContext, entry: PassiveStoryEntry): void {
  if (entry.owner && entry.block) ctx.mutations.setStudentBlock(entry.owner, entry.id);
}
