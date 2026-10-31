import type { PassiveStoryEntry, StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { Registry } from '../../../data-services/registry/registry';
import type { ConditionSystem } from '../../../engine/expression/condition-system';
import type { EffectEngine } from '../../../engine/effect/effect-engine';
import type { Effect } from '../../../engine/types/expression';
import type { PlayerState } from '../../types/state';
import type { StoryMutationPort } from '../../contracts/runtime/mutation';
import type { EffectReceipt } from '../../../engine/contracts/effect-receipt';

export type RewardsSettlement = { source: 'first' | 'repeat' | 'conditional'; effects: Effect[]; receipts: EffectReceipt[] } | null;

export interface StoryRewardsContext {
  readonly registry: Registry;
  readonly conditionSystem: ConditionSystem;
  readonly effectEngine: Pick<EffectEngine, 'applyEffects'> & Partial<Pick<EffectEngine, 'applyEffectsWithReceipts'>>;
  readonly mutations: Pick<StoryMutationPort, 'setPassiveCooldowns' | 'setStudentBlock'>;
  readonly getState: () => PlayerState;
  readonly hasCompletedStory: (storyId: string) => boolean;
}

function settle(ctx: StoryRewardsContext, source: NonNullable<RewardsSettlement>['source'], effects: Effect[]): NonNullable<RewardsSettlement> {
  const receipts: EffectReceipt[] = [];
  const settlement = { source, effects, receipts };
  try {
    if (ctx.effectEngine.applyEffectsWithReceipts) ctx.effectEngine.applyEffectsWithReceipts(effects, receipt => receipts.push(receipt));
    else ctx.effectEngine.applyEffects(effects);
    return settlement;
  } catch (error) {
    // Never retry through the legacy route: an observer may have thrown after a real commit.
    const failure = new Error(error instanceof Error ? error.message : String(error)) as Error & { receipts: EffectReceipt[]; rewardSettlement: NonNullable<RewardsSettlement> };
    failure.receipts = receipts.length ? receipts : [...((error as { receipts?: EffectReceipt[] } | null)?.receipts ?? [])];
    failure.rewardSettlement = { ...settlement, receipts: failure.receipts };
    throw failure;
  }
}

/** Entry owns reward policy; first/repeat is decided against the terminal Story ID. */
export function applyCompletionReward(ctx: StoryRewardsContext, entry: StoryEntryDef, terminalStoryId: string): RewardsSettlement {
  if (entry.completionStrategy === 'conditional' && entry.conditionalRewards?.length) {
    const matched = entry.conditionalRewards.find(reward => ctx.conditionSystem.evaluateGroup(reward.condition, ctx.getState()));
    if (!matched?.effects.length) return null;
    return settle(ctx, 'conditional', matched.effects);
  }
  if (!entry.completionReward) return null;
  const first = !ctx.hasCompletedStory(terminalStoryId);
  const effects = first ? entry.completionReward.first : entry.completionReward.repeat;
  if (!effects?.length) return null;
  return settle(ctx, first ? 'first' : 'repeat', effects);
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
