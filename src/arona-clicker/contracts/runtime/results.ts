// ============================================================
/* AronaClicker 领域操作结果与剧情视图。 */
// ============================================================

import type { StoryId, ItemId, SpotId, AreaId, EnhancementId } from '../../../engine/types/ids';
import type { Talklet } from '../../../data-services/contracts/story';
import type { CompletedStory } from '../../types/story-state';

export type UseItemResult =
  | { success: true; itemId: ItemId }
  | { success: false; itemId: ItemId; error: 'NotFound' | 'NotOwned' | 'NotUsable' | 'ConditionNotMet' };

export type TravelError =
  | 'NotFound'
  | 'NotInThisInit'
  | 'NotAdjacent'
  | 'AlreadyThere'
  | 'Locked'
  /** 剧情阻塞手动移动时拒绝玩家移动 Area（Story 自身要求移动不受限）。 */
  | 'StoryBlocked';

export type TravelResult =
  | { success: true; areaId: AreaId; fromAreaId: AreaId | null; method?: 'adjacent' | 'visited' | 'transit' }
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
  | { success: false; spotId: SpotId; error: 'NotFound' | 'NotVisible' | 'InsufficientResource' | 'AlreadyOwned' | 'MaxLevel' | 'PaymentNotDeclared' | 'NoPurchaseRoute' | 'PaymentOptionRequired' | 'PaymentOptionNotFound' | 'PaymentConditionNotMet' | 'InvalidPayment'; paymentOptionIds?: string[] };

export type SpotUpgradeResult =
  | { success: true; spotId: SpotId; newLevel: number }
  | { success: false; spotId: SpotId; error: 'NotFound' | 'NotOwned' | 'InsufficientResource' | 'MaxLevel' | 'ConditionNotMet' | 'PaymentNotDeclared' | 'NoPurchaseRoute' | 'PaymentOptionRequired' | 'PaymentOptionNotFound' | 'PaymentConditionNotMet' | 'InvalidPayment'; paymentOptionIds?: string[] };

// --- 剧情视图与结果 ---

export interface StoryView {
  /** Source StoryEntry ID; stable while the playback jumps between Story definitions. */
  storyId: StoryId;
  /** Type of the source StoryEntry. */
  type: 'passive' | 'active';
  /** 当前实际播放的 Story.id（跳转链中可能不同于 Entry.storyId）。 */
  storyDefId: StoryId;
  pageIndex: number;
  totalPages: number;
  page: Talklet;
  availableChoiceIndexes: number[];
  /** Stable presentation boundary and unforgeable command ticket for the current wait. */
  nodeId: string;
  token: string;
  phase: 'delivery' | 'input';
  runId: string;
  /** Stable logical delivery identity retained when restore assigns a fresh visual runId. */
  historyId?: string;
  /** One checkpoint counter per run; the same node may be legitimately delivered more than once. */
  waitSequence?: number;
  /** The next authored node is an enabled Click; the delivered Talklet auto-acknowledges into it. */
  nextIsInput?: boolean;
  /** Human-readable, player-facing effects of the current Operation, in authored order. */
  operationEffects?: readonly string[];
  /** The action has committed; Runtime automatically releases its presentation barrier. */
  operationCheckpoint?: true;
}

/** Read-only AreaHero offer derived from the current Init's pending delivery records. */
export interface AreaStoryDeliveryView {
  /** Opaque acceptance identity for a run-bound invitation. */
  id?: string;
  entryId: StoryId;
  areaId: string;
  title: string;
  owner: string | null;
}

export type StoryError =
  | 'Busy'
  | 'StartDeferred'
  | 'PresentationPending'
  | 'NotFound'
  | 'AreaDeliveryUnavailable'
  | 'AlreadyActive'
  | 'NoActiveStory'
  | 'ConditionNotMet'
  | 'WrongStoryType'
  | 'AlreadyCompleted'
  | 'NoAvailableStory'
  | 'ChoiceRequired'
  | 'InvalidChoice'
  | 'ChoiceConditionNotMet'
  /** The UI submitted a delivery/input ticket that is no longer current. */
  | 'StaleToken'
  /** 当前页有点击需求（click / clickWork）且尚未完成确认，不能直接推进或跳转。 */
  | 'ClickRequired'
  /** 重阅读模式：分歧点准入守卫拒绝进入目标 Story（见 StoryEntryDef.branchGuards）。 */
  | 'BranchGuardDenied'
  /** 跳转深度超过上限（32），强制终止演出。 */
  | 'JumpLimitExceeded'
  /** 重阅读入口不可用（entry.replayable = false）。 */
  | 'NotReplayable'
  /** New-node playback stopped on an unsupported or failed action/document. */
  | 'PlaybackFailed';

export type StoryStartResult =
  | { success: true; finished: false; story: StoryView; replayId?: string }
  | { success: true; finished: true; storyId: StoryId; completed: CompletedStory; replayId?: string }
  | { success: false; storyId?: StoryId; error: StoryError; detail?: string };

export type StoryAdvanceResult =
  | { success: true; finished: false; story: StoryView }
  | { success: true; finished: true; storyId: StoryId; completed: CompletedStory }
  | {
      success: false;
      storyId?: StoryId;
      error: StoryError;
      /** BranchGuardDenied 时的拒绝提示文本（branchGuard.denialMessage）。 */
      denialMessage?: string;
      /** Engine/action diagnostic for a playback failure. */
      detail?: string;
    };

/**
 * 当前 Story 等待点对应的底部发送控件状态。
 */
export type SendState =
  | {
      mode: 'advance';
      /** 当前进行中的 StoryId（若处于剧情演出中） */
      storyId: StoryId | null;
      pageIndex: number;
      /** 当前 button Click 的显示文案；Talklet delivery 阶段为空串。 */
      text: string;
      /** Current delivery/input ticket; every formal StoryService projection supplies it. */
      token?: string;
      /** Automatic operation presentation; the UI displays a disabled progress affordance. */
      checkpoint?: 'operation';
      /**
       * 当前 button Click 的按击工作量。done 为已完成次数，total 为所需次数；
       * 第 total 次有效输入会立即提交并推进，不需要额外确认。
       */
      clickWork?: { total: number; done: number };
    }
  | { mode: 'idle'; reason: 'noStory' | 'noAvailable' }
  | {
      mode: 'choice';
      /**
       * Choice input 是否已就绪。StoryNodePlayer 正式投影恒为 true，字段为保留的显示接口。
       */
      confirmed: boolean;
      token?: string;
    }
  | {
      mode: 'kizuna';
      /** 当前进行中的 StoryId（若处于剧情演出中） */
      storyId: StoryId | null;
      pageIndex: number;
      /** 目标剧情入口 id（指向 ActiveStoryEntry）。 */
      targetStoryId: StoryId;
      /** 卡片标题。 */
      title?: string;
      /** 按钮文案。 */
      buttonText?: string;
      /** 卡片对齐（left | right，不允许居中）。 */
      align?: 'left' | 'right';
      token?: string;
    };

/**
 * 玩家点击一次 Story 输入按钮的结果。
 * - completed：已提交一次 delivery ack 或 Click input；是否成功推进查看 advance.success。
 * - working：button Click 的按击次数尚未满足；最后一次所需输入会立即提交并推进。
 * - choice：当前等待点是 Choice input，按钮发送入口让位给候选项。
 * - idle：无进行中剧情，触发/尝试触发 PassiveTalk
 */
export type SendResult =
  | {
      type: 'completed';
      storyId: StoryId | null;
      finished: boolean;
      advance: StoryAdvanceResult;
      /**
       * 保留的显示结果字段。StoryNode 流程不隐式吸收后续节点，正式结果恒为空数组。
       */
      absorbed: StoryView[];
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
