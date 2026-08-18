// ============================================================
// engine/types/results.ts — 操作返回结果 / 剧情视图
// ============================================================

import type { StoryId, ItemId, SpotId, AreaId, EnhancementId } from './ids';
import type { StoryPage } from './entities';
import type { CompletedStory } from './state';

export interface ProductionResult {
  spotId: SpotId;
  resource: string;
  amount: number;
}

export interface TickResult {
  frame: number;
  productions: ProductionResult[];
}

export type UseItemResult =
  | { success: true; itemId: ItemId }
  | { success: false; itemId: ItemId; error: 'NotFound' | 'NotOwned' | 'NotUsable' | 'ConditionNotMet' };

export type TravelError =
  | 'NotFound'
  | 'NotInThisInit'
  | 'NotAdjacent'
  | 'AlreadyThere'
  | 'Locked'
  /** 非 passive 剧情演出进行中，禁止玩家移动 Area（Story 自身要求移动不受限）。 */
  | 'StoryBlocked';

export type TravelResult =
  | { success: true; areaId: AreaId; fromAreaId: AreaId | null }
  | { success: false; areaId: AreaId; error: TravelError };

export type EnhancementPurchaseError =
  | 'NotFound'
  | 'NotVisible'
  | 'ConditionNotMet'
  | 'InsufficientResource'
  | 'AlreadyOwned';

export type EnhancementPurchaseResult =
  | { success: true; enhancementId: EnhancementId }
  | { success: false; enhancementId: EnhancementId; error: EnhancementPurchaseError };

export type SpotUnlockResult =
  | { success: true; spotId: SpotId }
  | { success: false; spotId: SpotId; error: 'NotFound' | 'NotVisible' | 'InsufficientResource' | 'AlreadyOwned' | 'MaxLevel' };

export type SpotUpgradeResult =
  | { success: true; spotId: SpotId; newLevel: number }
  | { success: false; spotId: SpotId; error: 'NotFound' | 'NotOwned' | 'InsufficientResource' | 'MaxLevel' | 'ConditionNotMet' };

// --- 剧情视图与结果 ---

export interface StoryView {
  storyId: StoryId;
  type: 'passive' | 'active';
  pageIndex: number;
  totalPages: number;
  page: StoryPage;
  availableChoiceIndexes: number[];
}

export type StoryError =
  | 'NotFound'
  | 'AlreadyActive'
  | 'NoActiveStory'
  | 'ConditionNotMet'
  | 'WrongStoryType'
  | 'AlreadyCompleted'
  | 'Cooldown'
  | 'NoAvailableStory'
  | 'ChoiceRequired'
  | 'InvalidChoice'
  | 'ChoiceConditionNotMet';

export type StoryStartResult =
  | { success: true; story: StoryView }
  | { success: false; storyId?: StoryId; error: StoryError };

export type StoryAdvanceResult =
  | { success: true; finished: false; story: StoryView }
  | { success: true; finished: true; storyId: StoryId; completed: CompletedStory }
  | { success: false; storyId?: StoryId; error: StoryError };

/**
 * 底部"回复按钮"（本质上是一条承载推进的 Talklet）的当前状态。
 */
export type SendState =
  | {
      mode: 'advance';
      /** 当前进行中的 StoryId（若处于剧情演出中） */
      storyId: StoryId | null;
      pageIndex: number;
      /** 回复文本（来自 Talklet 的 sendText 或 text） */
      text: string;
      /**
       * 点击工作进度（Talklet.clickWork 存在时）。
       * done 为已点击次数，total 为需完成的总次数；done < total 时不推进。
       */
      clickWork?: { total: number; done: number };
    }
  | { mode: 'idle'; reason: 'noStory' | 'noAvailable' }
  | { mode: 'choice' };

/**
 * 玩家点击一次回复按钮的结果。
 * - completed：本次推进已发生
 * - working：点击工作进度 +1，但尚未达到 total，不推进（仅刷新进度条）
 * - choice：当前 Talklet 有选项，回复按钮让位
 * - idle：无进行中剧情，触发/尝试触发 PassiveTalk
 */
export type SendResult =
  | {
      type: 'completed';
      storyId: StoryId | null;
      finished: boolean;
      /** 玩家本次点击发送的回复文案（按钮上的文本）。 */
      sentText: string;
      advance: StoryAdvanceResult;
    }
  | {
      type: 'working';
      storyId: StoryId | null;
      pageIndex: number;
      /** 本次点击后累计的已点击次数 / 需完成总次数。 */
      clicksDone: number;
      clicksTotal: number;
    }
  | { type: 'choice' }
  | { type: 'idle'; started: boolean; error?: StoryError };
