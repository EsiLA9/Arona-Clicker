// ============================================================
// engine/contracts/state-query.ts — 基础机制所需的最小状态读取面
// ============================================================

import type { Character, EnhancementId, AreaId, SpotId } from '../types/ids';
import type { TagEffectRecord } from '../expression/tag-effect';
import type { TagPath } from '../core/tag';

/** Condition 只观察故事完成记录的稳定 ID，不依赖产品的 passive/active 记录形状。 */
export interface StoryCompletionState {
  readonly storyId: string;
}

/** Condition 只读取原型统计中的累计获得数。 */
export interface ProtoStatState {
  readonly acquiredTotal: number;
}

/** 动态标签机制的运行时增撤覆盖。 */
export interface SpotTagOverrideState {
  added: TagPath[];
  removed: TagPath[];
}

/** Condition / Reveal 等基础机制读取的状态子集。 */
export interface ConditionState {
  resources: Record<string, number>;
  spotLevels: Record<SpotId, number>;
  spotManagers: Record<SpotId, Character>;
  unlockedEnhancements: EnhancementId[];
  flags: Record<string, string>;
  storyLog: readonly StoryCompletionState[];
  protoStats?: Record<string, ProtoStatState>;
  currentAreaId?: AreaId;
}

/** TriggerSystem 需要的状态面：条件读取加 once 触发记录。 */
export interface TriggerState extends ConditionState {
  triggersCompleted?: string[];
}

/** Spot 功能派生所需的强化与动态标签状态。 */
export interface FunctionalityState {
  unlockedEnhancements: EnhancementId[];
  spotTagOverrides?: Record<string, SpotTagOverrideState>;
}

/** Affector 挂载对账所需的条件、库存与 Spot 功能状态。 */
export interface AffectorRuntimeState extends ConditionState, FunctionalityState {
  inventory: Record<string, number>;
}

/** StatsService 维护会话定位与资源镜像所需的最小状态面。 */
export interface StatsState {
  activeInit: string;
  totalFrames: number;
  currentAreaId?: string;
  resources: Record<string, number>;
}

/** ValueExpression 求值所需的状态读取面。 */
export interface ValueState {
  resources: Record<string, number>;
  spotLevels: Record<string, number>;
  spotManagers: Record<string, string>;
  flags: Record<string, string>;
}

/** GameNum 求值与区表维护所需的数值修饰状态面。 */
export interface GameNumState extends ValueState {
  tagEffects?: Record<string, TagEffectRecord[]>;
  entityEffects?: Record<string, TagEffectRecord[]>;
  spotTagOverrides?: Record<string, SpotTagOverrideState>;
}

/** EffectEngine 解析声明式数值时的内部状态面。 */
export type EffectRuntimeState = ValueState;

/** TickSystem 生产结算时的内部状态面。 */
export interface TickState extends GameNumState {
  totalFrames: number;
}
