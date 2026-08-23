// ============================================================
// engine/types/state.ts — 运行时状态与统计
// ============================================================

import type { StoryView } from './results';
import type { AffectorInstance, EnhancementAttachment } from './entities';
import type { Character, EnhancementId, InitId, SpotId, StoryId, ItemId, AreaId } from './ids';
import type { ExtraCompound } from './extra';
import type {
  ChatMessageId,
  ColorId,
  GachaPoolId,
  GachaPoolState,
  ProtoStat,
  RosterEntry,
  VariantId,
} from './character';

// --- PlayerState ---

export interface PlayerState {
  /** 世界线局部（per-Init）资源：随 Init 快照保存/清除，不跨世界线。 */
  resources: Record<string, number>;
  /** 全局资源（跨世界线保留）：见 isGlobalResource。可选，兼容旧档。 */
  globalResources?: Record<string, number>;
  spotLevels: Record<SpotId, number>;
  spotManagers: Record<SpotId, Character>;
  unlockedEnhancements: EnhancementId[];
  /** 各已获得 Enhancement 的挂靠元数据（仅 UI 展示）。可选，兼容旧档。 */
  enhancementAttachments?: Record<EnhancementId, EnhancementAttachment>;
  activeInit: InitId;
  /** 当前所在 Area（玩家视角所在地）。可选字段以兼容旧存档。 */
  currentAreaId?: AreaId;
  /** 已访问过的 Area（支持返回，不限相邻）。可选字段以兼容旧存档。 */
  visitedAreas?: AreaId[];
  /** 已进入过的 Init（first-entry 判定，跨世界线全局保留）。可选，兼容旧档。 */
  visitedInits?: InitId[];
  totalFrames: number;
  storyLog: CompletedStory[];
  /**
   * 按 Story.id 记录的阅读日志（可选，兼容旧档）。
   * 用于重阅读系统与分歧点准入守卫。
   */
  storyReadLogs?: Record<StoryId, StoryReadLog>;
  inventory: Record<ItemId, number>;
  flags: Record<string, string>;
  unlockedInits: InitId[];
  /** 已触发过的一次性 Trigger（once）id 集合。 */
  triggersCompleted?: string[];
  /** 当前 Init 的 per-Init 层额外数据（随快照保存/恢复，软重启清空重建；见 docs/13 §5.3）。可选，兼容旧档。 */
  initExtras?: ExtraCompound;
  /** 各 Init 的快照（软重启时保存，后续重进可恢复）。可选，兼容旧档。 */
  initSnapshots?: Record<InitId, InitSnapshot>;
  /** 全局层额外数据（跨 Init 保留，入存档；三层合并视图最高优先级，见 docs/13 §5.3）。可选，兼容旧档。 */
  extras?: ExtraCompound;
  /**
   * 通讯录：玩家持有的变体实例（Character 重构；归属层由 characterPersistConfig.roster 声明）。
   * 可选以兼容分阶段构建（M1 起写入）。
   */
  roster?: Record<VariantId, RosterEntry>;
  /** 碎片余额（按差分隔离；归属随 roster）。 */
  fragments?: Record<VariantId, number>;
  /** 卡池计数（pity/pulls；归属由 characterPersistConfig.gacha 声明）。 */
  gachaState?: Record<GachaPoolId, GachaPoolState>;
  /** 当前激活的界面主题色彩（全局单选；null = 默认主题）。 */
  activeColor?: ColorId | null;
  /** 已解锁色彩库存（收集类资产，恒为 global 层）。 */
  colorsOwned?: ColorId[];
  /** 聊天已读记录（归属由 characterPersistConfig.chatRead 声明）。 */
  chatRead?: Record<ChatMessageId, true>;
  /** 世界 Pool：已进入常驻集合的差分（池关闭条件触发后并入）。 */
  worldPool?: VariantId[];
  /** 原型聚合统计（派生视图，Trigger 维护；键为 Character id 字符串）。 */
  protoStats?: Record<string, ProtoStat>;
}

/** Init 内快照：结束 Init 时保存，重新进入时恢复。
 *
 * 快照包含 Init 局部（per-Init）的全部数据。
 * 跨 Init 全局字段（unlockedInits / globalResources / stats 等）由 PlayerState 顶层或 StatsService 管理。 */
export interface InitSnapshot {
  resources: Record<string, number>;
  spotLevels: Record<SpotId, number>;
  spotManagers: Record<SpotId, Character>;
  visitedAreas: AreaId[];
  totalFrames: number;
  inventory: Record<ItemId, number>;
  unlockedEnhancements: EnhancementId[];
  storyLog: CompletedStory[];
  /** 按 Story.id 记录的阅读日志（随快照保存/恢复；可选，兼容旧档）。 */
  storyReadLogs?: Record<StoryId, StoryReadLog>;
  flags: Record<string, string>;
  triggersCompleted: string[];
  currentAreaId?: AreaId;
  /** per-Init 层额外数据（随快照，软重启/恢复时同步；见 docs/13 §5.3）。可选，兼容旧档。 */
  extras?: ExtraCompound;
  /**
   * Character 系统容器（仅 characterPersistConfig 声明为 init 的块才会写入快照；
   * global 块跨世界线保留，不进快照。见 docs-818/12-character-rework.md §2.6）。
   */
  roster?: Record<VariantId, RosterEntry>;
  fragments?: Record<VariantId, number>;
  gachaState?: Record<GachaPoolId, GachaPoolState>;
  chatRead?: Record<ChatMessageId, true>;
}

export type CompletedStory =
  | { type: 'passive'; storyId: StoryId }
  | { type: 'active'; storyId: StoryId; choiceIndex: number };

/**
 * Story 阅读日志：按 Story.id 记录一次演出的阅读进度。
 * 用于重阅读时跳过已读内容 / 分歧点准入守卫。
 */
export interface StoryReadLog {
  /** 已读过的 Talklet 索引（升序、去重）。 */
  readTalkletIndexes: number[];
  /** 各 Talklet 内已选过的 Choice 索引（key = Talklet 索引）。 */
  chosenChoiceIndexes: Record<number, number[]>;
}

// --- 运行时事件 ---

/**
 * 三层统计数据：
 * - global      贯穿 Init 的总数据（累计产出/消耗/物品/设施/剧情/帧）
 * - init[id]    各 Init 内的总数据（另含在该世界线停留帧数）
 * - session     当前游戏数据（实时资源、当前 init/area、帧数）
 */
export type ResourceAmounts = Record<string, number>;

export interface StatCounters {
  produced: ResourceAmounts;
  consumed: ResourceAmounts;
  itemsCollected: Record<string, number>;
  itemsUsed: Record<string, number>;
  spotsUnlocked: number;
  spotsUpgraded: number;
  storiesCompleted: number;
  enhancementsUnlocked: number;
  initsUnlocked: number;
  framesActive: number;
}

export interface InitStatCounters extends StatCounters {
  framesInInit: number;
}

export interface SessionStatsSnapshot {
  /** 本次游玩起始帧（进入当前 Init 时点的 totalFrames）。 */
  startFrame: number;
  /** 本次游玩累计（本次进入以来；framesActive = 本次游玩帧数）。 */
  counters: StatCounters;
  currentInit: InitId | null;
  currentArea: AreaId | null;
  resources: ResourceAmounts;
  /** 当前 Run 中已完成过的 Story ID 列表（用于 hasReadStoryInRun 条件）。 */
  completedStoryIdsThisRun: StoryId[];
}

export type InitStatsMap = Partial<Record<InitId, InitStatCounters>>;

export interface StatsSnapshot {
  global: StatCounters;
  init: InitStatsMap;
  session: SessionStatsSnapshot;
}

/** 事件携带的统计上下文：变更时点的三层摘要，供"对统计感兴趣"的订阅者判断。 */
export interface StatsContext {
  global: StatCounters;
  currentInit: InitId | null;
  currentInitStats: InitStatCounters | null;
  session: SessionStatsSnapshot;
}

// --- 可见性快照 ---

export type VisibilitySnapshot = {
  inits: Record<InitId, boolean>;
  areas: Record<AreaId, boolean>;
  spots: Record<SpotId, boolean>;
  enhancements: Record<EnhancementId, boolean>;
  items: Record<ItemId, boolean>;
  stories: Record<StoryId, boolean>;
};

// --- UI 只读视图 ---

export interface GameView {
  activeInit: InitId;
  currentAreaId: AreaId | null;
  visitedAreas: AreaId[];
  totalFrames: number;
  resources: Record<string, number>;
  spotLevels: Record<SpotId, number>;
  spotManagers: Record<SpotId, Character>;
  unlockedEnhancements: EnhancementId[];
  inventory: Record<ItemId, number>;
  unlockedInits: InitId[];
  storyLog: CompletedStory[];
  flags: Record<string, string>;
  visibility: VisibilitySnapshot;
  currentStory: StoryView | null;
  activeAffectors: AffectorInstance[];
  stats: StatsSnapshot;
}
