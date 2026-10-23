import type { PassiveStoryEntry, StoryEntryDef, BranchGuard } from '../../../data-services/contracts/story-entry';
import type { Registry } from '../../../data-services/registry/registry';
import type { PlayerState } from '../../types/state';
import type { ConditionSystem } from '../../../engine/expression/condition-system';
import type { StoryCursorSnapshot } from '../../../engine/contracts/story-cursor';
import type { StoryStartResult } from '../../contracts/runtime/results';
import { PassivePoolSystem } from '../economy/passive-pool-system';

export interface StoryEntrySelectionContext {
  readonly registry: Registry;
  readonly conditionSystem: ConditionSystem;
  readonly passivePools: PassivePoolSystem;
  readonly getState: () => PlayerState;
  readonly hasCompletedStory: (storyId: string) => boolean;
  readonly getCurrentStoryId: (owner?: string | null) => string | null;
  readonly startStory: (storyId: string, expectedType: 'active' | 'passive', owner?: string | null, opts?: { force?: boolean; skipConditions?: boolean }) => StoryStartResult;
}

/** Ready affection steps and tails, in their established priority order. */
export function readyStepIds(ctx: StoryEntrySelectionContext, owner: string): string[] {
  const state = ctx.getState();
  const level = ctx.conditionSystem.affectionLevelReader(owner, state);
  const blocked = !!state.studentBlocks?.[owner];
  const activeEntryId = ctx.getCurrentStoryId(owner);
  const tails: string[] = [];
  const steps: { id: string; required: number }[] = [];
  for (const entry of ctx.registry.passiveStories.values()) {
    if (!isReadyStep(ctx, entry, owner, level, blocked, activeEntryId)) continue;
    if (entry.pushAfterStory != null) tails.push(entry.id);
    else steps.push({ id: entry.id, required: entry.affectionRequired! });
  }
  steps.sort((a, b) => a.required - b.required);
  return [...tails, ...steps.map(step => step.id)];
}

export function pickAffectionStep(ctx: StoryEntrySelectionContext, owner: string): string | null {
  return readyStepIds(ctx, owner)[0] ?? null;
}

export function triggerAffectionPush(ctx: StoryEntrySelectionContext, owner: string): StoryStartResult {
  if (ctx.getCurrentStoryId(owner) !== null) return { success: false, error: 'AlreadyActive' };
  const selectedId = pickAffectionStep(ctx, owner);
  if (!selectedId) return { success: false, error: 'NoAvailableStory' };
  return ctx.startStory(selectedId, 'passive', owner);
}

export function triggerPassiveStory(ctx: StoryEntrySelectionContext, initId = ctx.getState().activeInit, owner?: string | null): StoryStartResult {
  if (ctx.getCurrentStoryId(owner) !== null) return { success: false, error: 'AlreadyActive' };
  const state = ctx.getState();
  const selectedId = ctx.passivePools.pick(state, entry => {
    if (entry.weight <= 0) return false;
    if (entry.affectionRequired != null || entry.pushAfterStory != null) return false;
    if (entry.availableInits.length > 0 && !entry.availableInits.includes(initId)) return false;
    if (entry.triggerCondition && !ctx.conditionSystem.evaluateGroup(entry.triggerCondition, state)) return false;
    if (!entry.repeatable && ctx.hasCompletedStory(entry.storyId)) return false;
    return true;
  }, {
    owner: owner ?? null,
    cooldowns: state.passiveCooldowns ?? {},
    blocks: state.studentBlocks ?? {},
  });
  if (!selectedId) return { success: false, error: 'NoAvailableStory' };
  return ctx.startStory(selectedId, 'passive', owner);
}

export function triggerTailPush(ctx: StoryEntrySelectionContext, owner: string, storyId: string): StoryStartResult {
  if (ctx.getCurrentStoryId(owner) !== null) return { success: false, error: 'AlreadyActive' };
  const state = ctx.getState();
  const level = ctx.conditionSystem.affectionLevelReader(owner, state);
  const blocked = !!state.studentBlocks?.[owner];
  const tail = [...ctx.registry.passiveStories.values()].find(entry =>
    entry.pushAfterStory === storyId && isReadyStep(ctx, entry, owner, level, blocked, null));
  if (!tail) return { success: false, error: 'NoAvailableStory' };
  return ctx.startStory(tail.id, 'passive', owner, { skipConditions: true });
}

function isReadyStep(
  ctx: StoryEntrySelectionContext,
  entry: PassiveStoryEntry,
  owner: string,
  level: number,
  blocked: boolean,
  activeEntryId: string | null,
): boolean {
  if (entry.repeatable || entry.owner !== owner || blocked || entry.id === activeEntryId) return false;
  if (entry.pushAfterStory != null) {
    if (!ctx.hasCompletedStory(entry.pushAfterStory)) return false;
  } else if (entry.affectionRequired != null) {
    if (entry.affectionRequired > level) return false;
  } else return false;
  if (ctx.hasCompletedStory(entry.storyId)) return false;
  const state = ctx.getState();
  if (entry.availableInits.length > 0 && !entry.availableInits.includes(state.activeInit)) return false;
  if (entry.triggerCondition && !ctx.conditionSystem.evaluateGroup(entry.triggerCondition, state)) return false;
  const last = state.passiveCooldowns?.[entry.id];
  if (last !== undefined && entry.cooldownFrames && state.totalFrames - last < entry.cooldownFrames) return false;
  return true;
}

/** Replay branch guards use Talklet ordinals; Click and Operation nodes are not counted. */
export function guardPrereqsMet(registry: Registry, state: PlayerState, guard: BranchGuard): boolean {
  return guard.prerequisites.every(({ storyId, talkletIndex }) => {
    const log = state.storyReadLogs?.[storyId];
    if (!log) return false;
    if (talkletIndex === -1) {
      const story = registry.stories.get(storyId);
      if (!story) return false;
      const talklets = story.nodes.filter(node => node.type === 'talklet');
      return talklets.every((_, index) => log.readTalkletIndexes.includes(index));
    }
    return log.readTalkletIndexes.includes(talkletIndex);
  });
}

/** Determines whether a source owner has a valid checkpoint shape before replay restore. */
export function isStoryCursorSnapshot(value: unknown): value is StoryCursorSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<StoryCursorSnapshot>;
  return !!snapshot.playback && snapshot.playback.format === 'story-nodes'
    && typeof snapshot.isReplay === 'boolean'
    && Number.isSafeInteger(snapshot.lastChoiceIndex)
    && (snapshot.lastChoiceStoryId === null
      || typeof snapshot.lastChoiceStoryId === 'string' && snapshot.lastChoiceStoryId.trim().length > 0)
    && Array.isArray(snapshot.flags) && snapshot.flags.every(flag => typeof flag === 'string');
}

export function storyHasDisplayNodes(entry: StoryEntryDef, registry: Registry): boolean {
  const story = registry.stories.get(entry.storyId);
  return !!story && story.nodes.some(node => node.type === 'talklet' || node.type === 'click');
}
