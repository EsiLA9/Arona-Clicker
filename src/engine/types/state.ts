// ============================================================
// engine/types/state.ts — 运行时状态与统计
// ============================================================

import type { StoryView } from './results';
import type { AffectorInstance, EnhancementAttachment } from './entities';
import type { Character, EnhancementId, InitId, SpotId, StoryId, ItemId, AreaId } from './ids';
import type { ExtraCompound } from './extra';
import type { CharaCustomOverride } from './chara-profile';
import type { TagEffectRecord } from '../expression/tag-effect';
import type {
  ChatMessageId,
  ColorGroupId,
  EntityThemeSlot,
  EquipmentId,
  GachaPoolId,
  GachaPoolState,
  ProtoStat,
  RosterEntry,
  ThemeOrderScope,
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
  /**
   * tag 效果记录表（PlayerState 级，运行时派生，不持久化语义由来源重放保证）。
   * key = tagId(path)。实体求值时按自身 tags 自下而上聚合命中记录（见 GameNum 的
   * zone 节点）。可选字段以兼容旧存档（AGENTS.md：不写迁移代码）。
   */
  tagEffects?: Record<string, TagEffectRecord[]>;
  /**
   * 实体效果记录表（与 tagEffects 并列的另一条标定维度）。
   * key = entityKey(kind:id)（id 为 '*' 表示该类全部实体）。定点作用于指定 typed-id 实体
   * 的加区/乘区/上下限经此命中。可选字段以兼容旧存档。
   */
  entityEffects?: Record<string, TagEffectRecord[]>;
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
  /** 当前激活的界面主题色彩组（全局单选；null = 默认主题）。须为 groupsOwned 内已解锁项。 */
  activeGroupId?: ColorGroupId | null;
  /**
   * 玩家自定义的主题层优先级排列（低→高；缺省 ['player','area','student']）。
   * 仅玩家/场景/学生三层参与；剧情演出层始终最高优先级。非法值回退默认。
   */
  themeLayerOrder?: ThemeOrderScope[];
  /** 已解锁色彩组库存（收集类资产，恒为 global 层）。 */
  groupsOwned?: ColorGroupId[];
  /** 已收集的色彩装备库存（收集类资产，恒为 global 层）。 */
  equipmentsOwned?: EquipmentId[];
  /**
   * 实体主题槽：玩家/系统为某实体（`area:<id>` / `variant:<id>`）选定的主题来源。
   * 缺省（无条目）= 声明默认。获得新配色设计时会自动写入（改默认颜色）。
   */
  entityThemeSlots?: Record<string, EntityThemeSlot>;
  /**
   * 各实体已解锁的配色设计（key = `area:<id>` / `variant:<id>`；幂等入库存，恒为 global 层）。
   */
  entityThemeDesignsOwned?: Record<string, string[]>;
  /** 聊天已读记录（归属由 characterPersistConfig.chatRead 声明）。 */
  chatRead?: Record<ChatMessageId, true>;
  /**
   * 被动闲聊冷却表：key = entryId 或 poolId，value = 上次被抽取时的 totalFrames。
   * 抽选时若 totalFrames - 上次帧 < cooldownFrames 则剪枝（不可选）。
   * 归属层随 element 自身（entry 多为 init，pool 多为 init）—— 由 ConditionSystem 在各 tick 自然失效。
   */
  passiveCooldowns?: Record<string, number>;
  /**
   * 对话空间阻断态：key = VariantId（学生差分），存在即该学生对话空间被锁定。
   * value 记录触发阻断的 entryId 与设定帧，满足条件组（PassiveStoryEntry.block）后由
   * StateMutationService 解除。用于「剧情结束后要求玩家前往某地继续下一步」。
   */
  studentBlocks?: Record<VariantId, { entryId: string; setAtFrame: number }>;
  /**
   * 玩家对 Chara 头像-人名对的自定义覆写（charaProfile 解析的 player 层，随存档持久化）。
   * key = Character 原型 id。
   */
  charaCustom?: Partial<Record<Character, CharaCustomOverride>>;
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
