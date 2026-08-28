// ============================================================
// engine/types/events.ts — 运行时事件（GameEvent）
// ============================================================

import type { StatsContext } from './state';
import type { AffectorState } from './entities';
import type { Effect } from './expression';
import type { Character } from './ids';
import type { ExtraPath, ExtraValue } from './extra';
import type { Talklet } from './content';
import type { ChatTextKind, ChatTextStyle } from './expression';

export type GameEvent =
  | { type: 'resourceChanged'; resource: string; delta: number; newValue: number }
  | { type: 'spotLevelChanged'; spotId: string; newLevel: number }
  | { type: 'managerChanged'; spotId: string; newManager: Character }
  | { type: 'enhancementAdded'; enhancementId: string }
  | { type: 'enhancementRemoved'; enhancementId: string }
  | { type: 'itemCollected'; itemId: string; count: number; newTotal: number }
  | { type: 'initEntered'; initId: string }
  | { type: 'initUnlocked'; initId: string }
  | { type: 'areaEntered'; areaId: string; fromAreaId: string | null }
  /** Story 的 travelToArea effect 成功移动（且 notice=true）→ UI 显示「移动到了 XX」迷你条目。 */
  | { type: 'storyAreaTraveled'; areaId: string }
  | { type: 'storyTriggered'; storyId: string }
  | { type: 'storyCompleted'; storyId: string }
  /**
   * 剧情完结奖励已结算（applyCompletionReward 之后发出）。
   * source: first/repeat = simple 策略；conditional = 条件分支奖励。
   * effects 为实际生效的效果列表（UI 可据此渲染奖励摘要）。
   */
  | { type: 'storyRewarded'; storyId: string; source: 'first' | 'repeat' | 'conditional'; effects: Effect[]; flags: string[] }
  /** 闲聊池 gate 翻转（PassivePoolSystem 重算时发现可用性变化）。 */
  | { type: 'poolGateChanged'; poolId: string; available: boolean }
  | { type: 'tick'; frame: number }
  | { type: 'flagChanged'; flag: string; value: string }
  | { type: 'extraChanged'; path: ExtraPath; value?: ExtraValue }
  | { type: 'spotProduced'; spotId: string; resource: string; amount: number }
  | { type: 'spotTagChanged'; spotId: string; tag: string; added: boolean }
  /**
   * 某类型下 tag 收集集合发生变化（TagStatService 发出；kind = TagStatKind）。
   * 仅实际增删时发出；setState 全量重建路径不发（与其它系统读档语义一致，
   * 条件新鲜度由挂载时 recheck / rebuild 兜底）。
   */
  | { type: 'tagCollectedChanged'; kind: string }
  | { type: 'affectorMounted'; instanceId: string; packId: string; mountEntityId: string }
  | { type: 'affectorStateChanged'; instanceId: string; oldState: AffectorState; newState: AffectorState }
  | { type: 'affectorUnmounted'; instanceId: string; reason: string }
  // --- Character 重构事件（docs-818/12-character-rework.md §4.2） ---
  /** 角色差分获得（含重复获得：duplicate=true，rewards 为实际返还）。 */
  | { type: 'characterAcquired'; variantId: string; via: 'gacha' | 'story' | 'event'; duplicate: boolean; shards: number; bonusResources: Record<string, number> }
  /** 培养变更（exp = 升级；star = 突破）。 */
  | { type: 'cultivated'; variantId: string; kind: 'exp' | 'star'; newLevel?: number; newStars?: number }
  /** 色彩组解锁入库存（幂等：已拥有不重复发）。 */
  | { type: 'groupUnlocked'; groupId: string }
  /** 色彩装备收集入库存（幂等：已拥有不重复发）。 */
  | { type: 'equipmentCollected'; equipmentId: string }
  /** 色彩装备装备到变体单装备槽。 */
  | { type: 'equipmentEquipped'; variantId: string; equipmentId: string }
  /** 激活主题切换（groupId = null 回默认主题）。 */
  | { type: 'themeChanged'; groupId: string | null }
  /** 实体主题槽变化（玩家/系统更改了某实体的当前主题来源）。 */
  | { type: 'entityThemeChanged'; entityKey: string }
  /** 实体配色设计解锁入库存（幂等）。 */
  | { type: 'entityDesignUnlocked'; entityKey: string; designId: string }
  /** 聊天消息标记已读。 */
  | { type: 'chatReadChanged'; messageId: string }
  /** 抽卡结算完成（count = 本次抽取次数；逐次结果以 characterAcquired 事件跟随）。 */
  | { type: 'gachaResolved'; poolId: string; count: number }
  /** 被动闲聊冷却表更新（entryId/poolId → 上次抽取帧）。 */
  | { type: 'passiveCooldownsChanged'; cooldowns: Record<string, number> }
  /** 学生对话空间阻断态变化（blocked=true 锁定 / false 解除）。 */
  | { type: 'studentBlockChanged'; variantId: string; blocked: boolean; entryId?: string }
  /** 玩家侧 Chara 头像-人名对覆写变化（setCharaCustom / clearCharaCustom）。 */
  | { type: 'charaCustomChanged'; character: Character }
  // --- 运行时效果请求（EffectEngine 转发演出类 op；RuntimeEffectReactor 消费，docs-824/08 T7） ---
  /** setTheme effect 请求：临时演出主题由 ColorSystem.handleThemeEffect 处理（不落状态）。 */
  | { type: 'themeEffectRequested'; effect: Effect }
  /** triggerStory effect 请求：由 StoryService.startStory（force）处理（不落状态）。 */
  | { type: 'storyEffectRequested'; effect: Effect }
  /** 聊天流演出 effect 请求（clearAllChatFlow / showChatText / clearIdChatFlow / clearAllChatText）。 */
  | { type: 'chatFlowEffectRequested'; effect: Effect }
  /** Affector 激活 entry 集在 Active 内变化（状态未翻转；GameNum 重同步区表与 flows）。 */
  | { type: 'affectorEntriesChanged'; instanceId: string }
  // --- 聊天流演出服务（Talklet 专用；UI 订阅后操作聊天流） ---
  /** 清理聊天流全部内容（clearAllChatFlow）。UI 清空当前活跃流。 */
  | { type: 'chatFlowCleared' }
  /** 删除全部可变位置的演出文本（clearAllChatText / Story 完结默认）。UI 清空当前活跃流的覆盖层，保留聊天历史。 */
  | { type: 'chatTextClearedAll' }
  /**
   * 演出专用文本显示（showChatText）：id = 临时 id，x/y 为百分比坐标（0,0=左下，1,1=右上）。
   * 内容为 text 或嵌入的 talklet（talklet 优先，复用标准 Talklet 渲染）。
   */
  | { type: 'chatTextShown'; id: string; text?: string; talklet?: Talklet; x?: number; y?: number; align?: 'left' | 'center' | 'right'; kind?: ChatTextKind; style?: ChatTextStyle; title?: string; buttonText?: string; targetStoryId?: string }
  /** 按临时 id 擦除演出专用文本（clearIdChatFlow）。 */
  | { type: 'chatTextCleared'; id: string }
  & { stats?: StatsContext };

export type EventHandler = (event: GameEvent) => void;

// --- 事件目录（发射方 / 订阅方登记） ---

/** 单个事件的登记条目。模块名为 src/engine|ui 下文件名（去扩展名）。 */
export interface EventCatalogEntry {
  /** 一句话用途。 */
  readonly purpose: string;
  /** 发射方模块（emit 调用所在）。 */
  readonly emit: readonly string[];
  /** 订阅方模块（on 定向订阅 / subscribeTo 分桶）。 */
  readonly subscribe: readonly string[];
}

/**
 * 事件目录：GameEvent 全类型的发射方 / 订阅方登记表。
 * Record 键为 GameEvent['type'] 全集 —— 新增/删除事件类型时本表强制同步（编译期穷尽），
 * 漂移即编译错误；取代「订阅方散落、契约不可审计」的旧状态（docs-824/08 T4）。
 *
 * 全局兜底（不逐条列入 subscribe）：devLog 的 onAny 全量记录（wiring.ts）、
 * UI 的 onAny 揭示刷新（controller-events.ts，跳过 tick/spotProduced）。
 */
export const EVENT_CATALOG: Record<GameEvent['type'], EventCatalogEntry> = {
  resourceChanged: { purpose: '资源增减（生产失效驱动核心）', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'game-num', 'trigger-system'] },
  spotLevelChanged: { purpose: '设施等级变化', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num', 'tag-stats', 'trigger-system'] },
  managerChanged: { purpose: '设施经理变更', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'game-num'] },
  enhancementAdded: { purpose: '强化获得（Affector 挂载 + 区表失效）', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num', 'tag-stats'] },
  enhancementRemoved: { purpose: '强化移除（Affector 卸载 + 区表失效）', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num', 'tag-stats'] },
  itemCollected: { purpose: '物品收集（Affector 挂载 + Trigger）', emit: ['state-mutation-service'], subscribe: ['affector-engine', 'condition-deps', 'trigger-system'] },
  initEntered: { purpose: '进入世界线', emit: ['init-service'], subscribe: ['condition-deps', 'tag-stats', 'trigger-system'] },
  initUnlocked: { purpose: '世界线解锁', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'tag-stats'] },
  areaEntered: { purpose: '进入区域', emit: ['init-service'], subscribe: ['condition-deps', 'tag-stats', 'trigger-system'] },
  storyAreaTraveled: { purpose: 'Story 的 travelToArea 成功（notice=true）', emit: ['story-flow'], subscribe: ['ui-controller-events'] },
  storyTriggered: { purpose: '剧情开始（UI 清演出文本；visitedStoryInChain 依赖）', emit: ['story-flow'], subscribe: ['condition-deps', 'ui-controller-events'] },
  storyCompleted: { purpose: '剧情完成（条件失效 + Trigger + UI 清理）', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'tag-stats', 'trigger-system', 'ui-controller-events'] },
  storyRewarded: { purpose: '完结奖励已结算（UI 渲染奖励摘要）', emit: ['story-jump'], subscribe: ['ui-controller-events'] },
  poolGateChanged: { purpose: '闲聊池 gate 翻转', emit: ['passive-pool-system'], subscribe: ['ui-controller-events'] },
  tick: { purpose: '每帧（Trigger every 分频）', emit: ['tick-system'], subscribe: ['trigger-system'] },
  flagChanged: { purpose: 'flag 写入（条件失效 + 色彩解锁重算）', emit: ['state-mutation-service'], subscribe: ['color-unlock-reactor', 'condition-deps'] },
  extraChanged: { purpose: 'Extra 树写入（条件/数值失效）', emit: ['state-mutation-service'], subscribe: ['condition-deps', 'game-num'] },
  spotProduced: { purpose: 'Spot 产出结算（无专属订阅方；UI 揭示刷新显式跳过）', emit: ['tick-system'], subscribe: [] },
  spotTagChanged: { purpose: 'Spot tag 增撤（Affector 重挂 + tag 依赖失效）', emit: ['spot-service'], subscribe: ['affector-engine', 'condition-deps', 'game-num'] },
  tagCollectedChanged: { purpose: 'tag 收集集合变化（tagCount 条件失效）', emit: ['tag-stats'], subscribe: ['condition-deps'] },
  affectorMounted: { purpose: 'Affector 实例挂载（GameNum 重同步区表/flows + 观测）', emit: ['affector-engine'], subscribe: ['game-num'] },
  affectorStateChanged: { purpose: 'Affector 状态翻转（GameNum 重同步区表/flows + 观测）', emit: ['affector-engine'], subscribe: ['game-num'] },
  affectorUnmounted: { purpose: 'Affector 实例卸载（GameNum 重同步区表/flows + 观测）', emit: ['affector-engine'], subscribe: ['game-num'] },
  affectorEntriesChanged: { purpose: 'Affector 激活 entry 集在 Active 内变化（GameNum 重同步，状态未翻转）', emit: ['affector-engine'], subscribe: ['game-num'] },
  characterAcquired: { purpose: '角色差分获得（色彩解锁重算 + 图鉴统计 + Trigger）', emit: ['state-mutation-service'], subscribe: ['color-unlock-reactor', 'tag-stats', 'trigger-system'] },
  cultivated: { purpose: '培养变更（升级/突破；Trigger 联动）', emit: ['state-mutation-service'], subscribe: ['trigger-system'] },
  groupUnlocked: { purpose: '色彩组解锁入库存（观测）', emit: ['state-mutation-service'], subscribe: [] },
  equipmentCollected: { purpose: '色彩装备收集入库存（观测）', emit: ['state-mutation-service'], subscribe: [] },
  equipmentEquipped: { purpose: '装备装配到变体（观测）', emit: ['state-mutation-service'], subscribe: [] },
  themeChanged: { purpose: '激活主题切换（观测）', emit: ['state-mutation-service'], subscribe: [] },
  entityThemeChanged: { purpose: '实体主题槽变化（观测）', emit: ['state-mutation-service'], subscribe: [] },
  entityDesignUnlocked: { purpose: '实体配色设计解锁（观测）', emit: ['state-mutation-service'], subscribe: [] },
  chatReadChanged: { purpose: '聊天消息标记已读（观测）', emit: ['state-mutation-service'], subscribe: [] },
  gachaResolved: { purpose: '抽卡结算完成（逐次结果以 characterAcquired 跟随）', emit: ['gacha-service'], subscribe: [] },
  passiveCooldownsChanged: { purpose: '被动闲聊冷却表更新', emit: ['state-mutation-service'], subscribe: [] },
  studentBlockChanged: { purpose: '学生对话空间阻断态变化', emit: ['state-mutation-service'], subscribe: [] },
  charaCustomChanged: { purpose: 'Chara 头像-人名对覆写变化', emit: ['state-mutation-service'], subscribe: [] },
  themeEffectRequested: { purpose: 'setTheme effect 请求（→ ColorSystem 临时主题层，不落状态）', emit: ['effect-engine'], subscribe: ['runtime-effect-reactor'] },
  storyEffectRequested: { purpose: 'triggerStory effect 请求（→ StoryService.startStory force，不落状态）', emit: ['effect-engine'], subscribe: ['runtime-effect-reactor'] },
  chatFlowEffectRequested: { purpose: '聊天流演出 effect 请求（→ ChatFlowService，不落状态）', emit: ['effect-engine'], subscribe: ['runtime-effect-reactor'] },
  chatFlowCleared: { purpose: '清理聊天流全部内容（演出服务 → UI）', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] },
  chatTextClearedAll: { purpose: '删除全部演出文本覆盖层（演出服务 → UI）', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] },
  chatTextShown: { purpose: '显示演出专用文本（演出服务 → UI）', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] },
  chatTextCleared: { purpose: '按临时 id 擦除演出文本（演出服务 → UI）', emit: ['chat-flow-service'], subscribe: ['ui-controller-events'] },
};
