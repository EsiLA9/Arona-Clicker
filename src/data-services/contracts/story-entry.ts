import type { TagPath } from '../../engine/core/tag';
import type { ExtraCompound } from '../../engine/types/extra';
import type { ConditionGroup, Effect } from '../../engine/types/expression';
import type { InitId, StoryId } from '../../engine/types/ids';
import type { RevealTrigger } from '../../engine/types/reveal';

export interface ConditionalReward { condition: ConditionGroup; effects: Effect[]; }
export interface BranchGuard { storyId: StoryId; prerequisites: { storyId: StoryId; talkletIndex: number }[]; denialMessage: string; }
export interface StoryEntryBase {
  id: StoryId; storyId: StoryId; availableInits: InitId[]; tags?: TagPath[]; triggerCondition: ConditionGroup;
  revealTriggers?: RevealTrigger[]; replayable?: boolean; completionStrategy?: 'simple' | 'conditional';
  conditionalRewards?: ConditionalReward[]; branchGuards?: BranchGuard[]; openingTitle?: string; extra?: ExtraCompound;
}
export interface ActiveStoryEntry extends StoryEntryBase {
  type: 'active'; completionReward?: { first?: Effect[]; repeat?: Effect[] }; owner?: string;
}
export interface PassiveStoryEntry extends StoryEntryBase {
  type: 'passive'; repeatable: boolean; weight: number; completionReward?: { first?: Effect[]; repeat?: Effect[] };
  owner?: string; affectionRequired?: number; pushAfterStory?: string; cooldownFrames?: number;
  block?: ConditionGroup; interruptible?: boolean; leaveArea?: boolean;
}
export type StoryEntryDef = ActiveStoryEntry | PassiveStoryEntry;
