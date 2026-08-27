// ============================================================
// engine/types/results.ts — 操作返回结果 / 剧情视图
// ============================================================

import type { StoryId, ItemId, SpotId, AreaId, EnhancementId } from './ids';
import type { Talklet } from './entities';
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
  /** 当前实际播放的 Story.id（跳转链中可能不同于 Entry.storyId）。 */
  storyDefId: StoryId;
  pageIndex: number;
  totalPages: number;
  page: Talklet;
  availableChoiceIndexes: number[];
}

export type StoryError =
  | 'NotFound'
  | 'AlreadyActive'
  | 'NoActiveStory'
  | 'ConditionNotMet'
  | 'WrongStoryType'
  | 'AlreadyCompleted'
  | 'NoAvailableStory'
  | 'ChoiceRequired'
  | 'InvalidChoice'
  | 'ChoiceConditionNotMet'
  /** 当前页有点击需求（click / clickWork）且尚未完成确认，不能直接推进或跳转。 */
  | 'ClickRequired'
  /** 重阅读模式：分歧点准入守卫拒绝进入目标 Story（见 StoryEntryDef.branchGuards）。 */
  | 'BranchGuardDenied'
  /** 跳转深度超过上限（32），强制终止演出。 */
  | 'JumpLimitExceeded'
  /** 重阅读入口不可用（entry.replayable = false）。 */
  | 'NotReplayable';

export type StoryStartResult =
  | { success: true; story: StoryView }
  | { success: false; storyId?: StoryId; error: StoryError };

export type StoryAdvanceResult =
  | { success: true; finished: false; story: StoryView }
  | { success: true; finished: true; storyId: StoryId; completed: CompletedStory }
  | {
      success: false;
      storyId?: StoryId;
      error: StoryError;
      /** BranchGuardDenied 时的拒绝提示文本（branchGuard.denialMessage）。 */
      denialMessage?: string;
    };

/**
 * 底部"回复按钮"（本质上是一条承载推进的 Talklet）的当前状态。
 */
export type SendState =
  | {
      mode: 'advance';
      /** 当前进行中的 StoryId（若处于剧情演出中） */
      storyId: StoryId | null;
      pageIndex: number;
      /** 预设回复文案（仅 Talklet.sendText；旁白/普通对话为空串 → 按钮显示"点击"） */
      text: string;
      /**
       * 点击工作进度（Talklet.clickWork 存在时）。
       * done 为已点击次数（进入该页时为 0），total 为需完成的总次数；
       * 前 total 次点击填充进度条，填满后还需再点一次才结束该页。
       */
      clickWork?: { total: number; done: number };
    }
  | { mode: 'idle'; reason: 'noStory' | 'noAvailable' }
  | {
      mode: 'choice';
      /**
       * 选项页的文本确认状态：false = 尚未确认本页 text（选项被 text 阻塞，UI 先显示文本
       * + "继续"按钮，点击确认后才显示选项）；true = 已确认，可渲染选项卡片。
       */
      confirmed: boolean;
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
    };

/**
 * 玩家点击一次回复按钮的结果。
 * - completed：本次推进已发生
 * - working：点击工作进度 +1（多击任务需填满进度条后额外再点一次才结束），尚未推进（仅刷新进度条）
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
      /**
       * 是否应把 sentText 以「老师」身份气泡回显到聊天流。
       * click 页恒 false；非 click 页遇 Talklet.muteReply = true 也为 false。
       */
      echoReply: boolean;
      advance: StoryAdvanceResult;
      /**
       * 本次推进后向后吸收的过渡页（非 click、无选项、无 sendText、无 clickWork 的纯展示页）。
       * 这些页自动跳过、不要求玩家逐页点击，UI 需将其文本同步进聊天流。
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
