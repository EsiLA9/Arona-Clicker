import type { TagPath } from '../../../engine/core/tag';
import type { ExtraCompound } from '../../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../../engine/types/expression';
import type { InitId, StoryId } from '../../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../../engine/types/reveal';
import type { ActiveStoryEntry, BranchGuard, ConditionalReward, PassiveStoryEntry, StoryEntryBase } from '../../../data-services/contracts/story-entry';
import { and } from '../../../engine/def-factory/condition';

abstract class StoryEntryBaseBuilder {
  protected readonly _id: StoryId; protected _storyId: StoryId; protected _triggerCondition: ConditionGroup = and();
  protected _availableInits: InitId[] = []; protected _tags: TagPath[] = []; protected _revealTriggers: RevealTrigger[] = [];
  protected _replayable = false; protected _completionStrategy?: 'simple' | 'conditional'; protected _conditionalRewards: ConditionalReward[] = [];
  protected _branchGuards: BranchGuard[] = []; protected _openingTitle?: string; protected _extra?: ExtraCompound;
  constructor(id: StoryId, storyId?: StoryId) { this._id = id; this._storyId = storyId ?? id; }
  story(storyId: StoryId): this { this._storyId = storyId; return this; }
  inits(...ids: InitId[]): this { this._availableInits = ids; return this; }
  when(condition: ConditionGroup): this { this._triggerCondition = condition; return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  replayable(): this { this._replayable = true; return this; }
  conditionalReward(condition: ConditionGroup, ...effects: Effect[]): this { this._conditionalRewards.push({ condition, effects }); return this; }
  branchGuard(storyId: StoryId, prerequisites: { storyId: StoryId; talkletIndex: number }[], denialMessage: string): this { this._branchGuards.push({ storyId, prerequisites, denialMessage }); return this; }
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this { this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target }); return this; }
  openingTitle(value: string): this { this._openingTitle = value; return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  protected toBase(): StoryEntryBase {
    const def: StoryEntryBase = { id: this._id, storyId: this._storyId, triggerCondition: this._triggerCondition, availableInits: this._availableInits };
    if (this._tags.length) def.tags = this._tags; if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._replayable) def.replayable = true; if (this._completionStrategy) def.completionStrategy = this._completionStrategy;
    if (this._conditionalRewards.length) def.conditionalRewards = this._conditionalRewards; if (this._branchGuards.length) def.branchGuards = this._branchGuards;
    if (this._openingTitle) def.openingTitle = this._openingTitle; if (this._extra) def.extra = this._extra; return def;
  }
}
export class ActiveStoryBuilder extends StoryEntryBaseBuilder {
  private _completionReward?: { first?: Effect[]; repeat?: Effect[] }; private _owner?: string;
  completionStrategy(value: 'simple' | 'conditional'): this { this._completionStrategy = value; return this; }
  rewardFirst(...effects: Effect[]): this { this._completionReward = { ...(this._completionReward ?? {}), first: effects }; return this; }
  rewardRepeat(...effects: Effect[]): this { this._completionReward = { ...(this._completionReward ?? {}), repeat: effects }; return this; }
  owner(variantId: string): this { this._owner = variantId; return this; }
  build(): ActiveStoryEntry { const def: ActiveStoryEntry = { ...this.toBase(), type: 'active' }; if (this._completionReward) def.completionReward = this._completionReward; if (this._owner) def.owner = this._owner; return def; }
}
export class PassiveStoryBuilder extends StoryEntryBaseBuilder {
  private _repeatable = true; private _weight = 1; private _completionReward?: { first?: Effect[]; repeat?: Effect[] }; private _owner?: string;
  private _cooldownFrames?: number; private _block?: ConditionGroup; private _interruptible?: boolean; private _leaveArea?: boolean; private _affectionRequired?: number; private _pushAfterStory?: string;
  repeatable(value = true): this { this._repeatable = value; return this; }
  weight(value: number): this { this._weight = value; return this; }
  rewardFirst(...effects: Effect[]): this { this._completionReward = { ...(this._completionReward ?? {}), first: effects }; return this; }
  rewardRepeat(...effects: Effect[]): this { this._completionReward = { ...(this._completionReward ?? {}), repeat: effects }; return this; }
  rewardPyroxene(firstAmount: number, repeatAmount?: number): this { this._completionReward = { first: [{ op: 'addResource', target: 'base:resource:pyroxene', value: firstAmount }], ...(repeatAmount !== undefined ? { repeat: [{ op: 'addResource', target: 'base:resource:pyroxene', value: repeatAmount }] } : {}) }; return this; }
  owner(variantId: string): this { this._owner = variantId; return this; }
  cooldownFrames(value: number): this { this._cooldownFrames = value; return this; }
  affectionRequired(value: number): this { this._affectionRequired = value; return this; }
  pushAfterStory(storyId: StoryId): this { this._pushAfterStory = storyId; return this; }
  block(condition: ConditionGroup): this { this._block = condition; return this; }
  interruptible(value = true): this { this._interruptible = value; return this; }
  leaveArea(value = true): this { this._leaveArea = value; return this; }
  build(): PassiveStoryEntry {
    const def: PassiveStoryEntry = { ...this.toBase(), type: 'passive', repeatable: this._repeatable, weight: this._weight };
    if (this._completionReward) def.completionReward = this._completionReward; if (this._owner) def.owner = this._owner; if (this._cooldownFrames !== undefined) def.cooldownFrames = this._cooldownFrames;
    if (this._affectionRequired !== undefined) def.affectionRequired = this._affectionRequired; if (this._pushAfterStory !== undefined) def.pushAfterStory = this._pushAfterStory;
    if (this._block) def.block = this._block; if (this._interruptible !== undefined) def.interruptible = this._interruptible; if (this._leaveArea !== undefined) def.leaveArea = this._leaveArea; return def;
  }
}
export const activeStory = (id: StoryId, storyId?: StoryId): ActiveStoryBuilder => new ActiveStoryBuilder(id, storyId);
export const passiveStory = (id: StoryId, storyId?: StoryId): PassiveStoryBuilder => new PassiveStoryBuilder(id, storyId);
