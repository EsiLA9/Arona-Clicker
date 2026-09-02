// ============================================================
// arona-clicker/services/story-context.ts — 剧情运行时共享上下文
// story-service.ts 拆分后，story-flow / story-jump / story-replay /
// story-rewards 各模块通过 StoryRuntime 访问游标与协作系统，避免循环依赖
// ============================================================

import type { PlayerState } from '../types/state';
import type { BranchGuard } from '../../data-services/contracts/story-entry';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { StoryDef, Talklet } from '../../data-services/contracts/story';
import type { Effect } from '../../engine/types/expression';
import type { StoryView } from '../contracts/results';
import type { EventBus } from '../../engine/core/event-bus';
import type { Registry } from '../../data-services/registry/registry';
import type { ConditionSystem } from '../../engine/expression/condition-system';
import type { EffectEngine } from '../../engine/effect/effect-engine';
import type { StoryMutationPort } from '../contracts/mutation';
import type { PassivePoolSystem } from './passive-pool-system';
import type { StoryCursorState } from './story-cursor-state';

export type StoryTravelResult = { success: boolean; error?: string; areaId?: string };

/** 完结奖励结算记录（供完成时发出 storyRewarded 事件）。 */
export type RewardsSettlement = { source: 'first' | 'repeat' | 'conditional'; effects: Effect[] } | null;

/**
 * 剧情运行时上下文：StoryService 持有的游标 / 状态 / 协作系统在拆分模块间的只读视图。
 * 由 StoryService 构造并绑定到自身实现，子模块不直接依赖 StoryService。
 */
export interface StoryRuntime {
  readonly registry: Registry;
  readonly conditionSystem: ConditionSystem;
  readonly effectEngine: EffectEngine;
  readonly mutations: StoryMutationPort;
  readonly eventBus: EventBus;
  readonly passivePools: PassivePoolSystem;
  /** Story 自身要求移动 Area（travelToArea effect），不受玩家移动限制。checkAdjacency=false 跳过拓扑。 */
  readonly travelToArea: (areaId: string, allowDuringStory?: boolean, checkAdjacency?: boolean) => StoryTravelResult;
  getState: () => PlayerState;
  cursorFor: (owner?: string | null) => StoryCursorState;
  entryById: (storyId: string) => StoryEntryDef | undefined;
  storyOf: (entry: StoryEntryDef) => StoryDef | undefined;
  currentPage: (cur: StoryCursorState) => Talklet | undefined;
  hasCompletedStory: (storyId: string) => boolean;
  getView: (owner?: string | null) => StoryView | null;
  guardPrereqsMet: (guard: BranchGuard) => boolean;
  /** 本次剧情播放期间经 Talklet/选项效果设置的 flag（完成时随 storyRewarded 通知 UI）。 */
  flagsSetThisStory: Set<string>;
  /** applyCompletionReward 的结算记录（包装引用，供 resolveStoryEnd 读取并清空）。 */
  lastRewarded: { value: RewardsSettlement };
}
