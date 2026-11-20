import type { TagPath } from '../../engine/core/tag';
import type { ExtraCompound } from '../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import type { AreaId, InitId, StoryEntryId, StoryId } from '../../engine/types/ids';
import type { RevealTrigger } from '../../engine/types/reveal';
import type { TriggerEventDef } from '../../engine/types/trigger';
import type { StoryEntryDirectoryPlacement } from './story-directory';

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
  id: StoryEntryId; storyId: StoryId; availableInits: InitId[]; tags?: TagPath[]; triggerCondition: ConditionGroup;
  /** 历史目录位置；与正式激活方式、角色归属和完成状态独立。 */
  catalog?: StoryEntryCatalog;
  /** Explicit placement in each applicable Init. Missing placements are inferred. */
  directoryPlacements?: StoryEntryDirectoryPlacement[];
  owner?: string;
  completionReward?: { first?: Effect[]; repeat?: Effect[] };
  revealTriggers?: RevealTrigger[]; replayable?: boolean; travelToStartContext?: boolean; completionStrategy?: 'simple' | 'conditional';
  conditionalRewards?: ConditionalReward[]; branchGuards?: BranchGuard[]; openingTitle?: string; extra?: ExtraCompound;
  /** One bounded child Entry; areaId requires accepting its invitation at that Area. */
  kizuna?: { entryId: StoryEntryId; areaId?: AreaId; returnFlags?: string[] };
  reactions?: StoryEntryReaction[];
  followUps?: StoryFollowUp[];
}
export interface ActiveStoryEntry extends StoryEntryBase {
  activation: ActiveStoryActivation;
  block?: never; interruptible?: never; leaveArea?: never; blocksInteraction?: never;
}
export interface StoryEntryCatalog {
  category: string; part: string; chapter?: string; order?: number;
}
/** 主动入口；fallback 只投放可接取入口，不自动开播或旅行。 */
export interface ActiveStoryActivation {
  kind: 'active';
  fallback?: { kind: 'current-area' } | { kind: 'fixed-area'; areaId: AreaId };
}
/** 随机抽取的基础权重与正式重复规则；池成员关系由 PassivePoolDef 保存。 */
export interface RandomStoryActivation {
  kind: 'random'; weight: number; repeatable: boolean; cooldownFrames?: number;
}
/** 单次角色阶段；等级和前置故事两种来源明确互斥。 */
export interface AffectionStoryActivation {
  kind: 'affection';
  when: { kind: 'level'; level: number } | { kind: 'after-story'; storyId: StoryId };
  cooldownFrames?: number;
}
export interface PassiveStoryBehavior {
  block?: ConditionGroup; interruptible?: boolean; leaveArea?: boolean;
  /** 阻塞玩家交互：播放期间不被其他 Story 打断，并禁止打开 AreaHero 或手动移动区域。 */
  blocksInteraction?: boolean;
}
export interface RandomStoryEntry extends StoryEntryBase, PassiveStoryBehavior { activation: RandomStoryActivation; }
export interface AffectionStoryEntry extends StoryEntryBase, PassiveStoryBehavior { owner: string; activation: AffectionStoryActivation; }
export type PassiveStoryEntry = RandomStoryEntry | AffectionStoryEntry;
export type StoryEntryDef = ActiveStoryEntry | PassiveStoryEntry;

/** 启动通道只读派生，不在作者数据中重复存储 active/passive。 */
export function storyEntryType(entry: Pick<StoryEntryDef, 'activation'>): 'active' | 'passive';
export function storyEntryType(entry: Pick<StoryEntryDef, 'activation'> | undefined): 'active' | 'passive' | undefined;
export function storyEntryType(entry: Pick<StoryEntryDef, 'activation'> | undefined): 'active' | 'passive' | undefined {
  return entry ? entry.activation.kind === 'active' ? 'active' : 'passive' : undefined;
}
