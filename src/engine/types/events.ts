// ============================================================
// engine/types/events.ts — 运行时事件（GameEvent）
// ============================================================

import type { StatsContext } from './state';
import type { AffectorState } from './entities';
import type { Effect } from './expression';
import type { Character } from './ids';
import type { ExtraPath, ExtraValue } from './extra';

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
  | { type: 'conditionGroupMet'; triggerId: string }
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
  /** 色彩解锁入库存（幂等：已拥有不重复发）。 */
  | { type: 'colorUnlocked'; colorId: string }
  /** 色彩装备到变体色彩槽。 */
  | { type: 'colorEquipped'; variantId: string; colorId: string }
  /** 激活主题切换（colorId = null 回默认主题）。 */
  | { type: 'themeChanged'; colorId: string | null }
  /** 聊天消息标记已读。 */
  | { type: 'chatReadChanged'; messageId: string }
  /** 抽卡结算完成（count = 本次抽取次数；逐次结果以 characterAcquired 事件跟随）。 */
  | { type: 'gachaResolved'; poolId: string; count: number }
  /** 被动闲聊冷却表更新（entryId/poolId → 上次抽取帧）。 */
  | { type: 'passiveCooldownsChanged'; cooldowns: Record<string, number> }
  /** 学生对话空间阻断态变化（blocked=true 锁定 / false 解除）。 */
  | { type: 'studentBlockChanged'; variantId: string; blocked: boolean; entryId?: string }
  & { stats?: StatsContext };

export type EventHandler = (event: GameEvent) => void;
