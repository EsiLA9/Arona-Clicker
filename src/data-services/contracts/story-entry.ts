import type { TagPath } from '../../engine/core/tag';
import type { ExtraCompound } from '../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import type { AreaId, InitId, StoryEntryId, StoryId } from '../../engine/types/ids';
import type { RevealTrigger } from '../../engine/types/reveal';
import type { TriggerEventDef } from '../../engine/types/trigger';

export interface ConditionalReward { condition: ConditionGroup; effects: Effect[]; }
export interface BranchGuard { storyId: StoryId; prerequisites: { storyId: StoryId; talkletIndex: number }[]; denialMessage: string; }
/** StoryEntry 完结后才激活的局部反应；TriggerDef 是运行时派生物，不进入数据包。 */
export interface StoryEntryReaction {
  id: string;
  activation?: 'after-completion';
  lifetime?: 'current-init' | 'until-consumed';
  on: TriggerEventDef;
  condition?: Condition | ConditionGroup;
  effects: Effect[];
  once?: boolean;
}
/** 作者语义层的受限剧情后续；第一阶段只等待未来匹配 Area 并启动一个 StoryEntry。 */
export interface StoryFollowUp {
  id: string;
  waitFor: { kind: 'next-enter-area'; areaId: AreaId };
  outcome: { kind: 'start-story-entry'; storyEntryId: StoryEntryId };
}
export interface StoryEntryBase {
  id: StoryId; storyId: StoryId; availableInits: InitId[]; tags?: TagPath[]; triggerCondition: ConditionGroup;
  revealTriggers?: RevealTrigger[]; replayable?: boolean; completionStrategy?: 'simple' | 'conditional';
  conditionalRewards?: ConditionalReward[]; branchGuards?: BranchGuard[]; openingTitle?: string; extra?: ExtraCompound;
  reactions?: StoryEntryReaction[];
  followUps?: StoryFollowUp[];
}
export interface ActiveStoryEntry extends StoryEntryBase {
  type: 'active'; completionReward?: { first?: Effect[]; repeat?: Effect[] }; owner?: string;
}
export interface PassiveStoryEntry extends StoryEntryBase {
  type: 'passive'; repeatable: boolean; weight: number; completionReward?: { first?: Effect[]; repeat?: Effect[] };
  owner?: string; affectionRequired?: number; pushAfterStory?: string; cooldownFrames?: number;
  block?: ConditionGroup; interruptible?: boolean; leaveArea?: boolean;
  /** 阻塞玩家交互：播放期间不被其他 Story 打断，并禁止打开 AreaHero 或手动移动区域。 */
  blocksInteraction?: boolean;
}
export type StoryEntryDef = ActiveStoryEntry | PassiveStoryEntry;
