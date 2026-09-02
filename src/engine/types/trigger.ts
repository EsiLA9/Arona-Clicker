// ============================================================
// engine/types/trigger.ts — Trigger / Affector 事件联动类型
// ============================================================

import type { ExtraCompound } from './extra';
import type { Condition, ConditionGroup, Effect } from './expression';

export type { AffectorState, AffectorFlow, AffectorEffect, AffectorPackDef, AffectorPackRef, AffectorInstance } from '../contracts/affector';

// --- Trigger 系统（对外 DSL：事件侦测 → 条件 → 执行） ---

/** 侦测来源：由哪些运行时事件驱动检查。kind 全集与
 *  `TriggerSystem.ON_KIND_TO_EVENT` 双向锁合（docs-824/08 T4）。 */
export type TriggerEventDef =
  | { kind: 'tick'; every?: number }
  | { kind: 'resource'; resource?: string }
  | { kind: 'spotLevel'; spotId?: string }
  | { kind: 'item'; itemId?: string }
  | { kind: 'story'; storyId?: string }
  | { kind: 'init'; initId?: string }
  | { kind: 'area'; areaId?: string }
  /** 角色差分获得（含重复获得）。variantId 缺省 = 任意角色。 */
  | { kind: 'character'; variantId?: string }
  /** 培养变更。variantId / cultivation 缺省 = 任意差分 / 任意方式。 */
  | { kind: 'cultivated'; variantId?: string; cultivation?: 'exp' | 'star' };

/** Trigger `on.kind` 全集（供映射表与测试穷尽）。 */
export type TriggerEventKind = TriggerEventDef['kind'];

export interface TriggerDef {
  /**
   * 唯一 ID。缺省时视为匿名 Trigger，挂载期按「分组 + 结构内容」派生确定性身份
   * （派生 id 带 `anon:` 前缀；once 完成状态按派生 id 持久化，重放可复现）。
   * @label ID
   */
  id?: string;
  /** 侦测条件：事件模式决定"何时检查"（内容作者不直接接触 EventBus）。 */
  on: TriggerEventDef;
  /**
   * 附加条件：满足才执行（可引用统计 DSL / tag / 状态）。
   * 可为单条原子条件（Condition）或组合条件（ConditionGroup）。
   */
  condition?: Condition | ConditionGroup;
  /** 执行效果：桥接到内部 Effect 系统。 */
  effects: Effect[];
  /**
   * 一次性触发（默认 true）。once:false 时条件满足即可重复触发。
   * @label 一次性
   */
  once?: boolean;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}
