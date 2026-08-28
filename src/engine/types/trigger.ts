// ============================================================
// engine/types/trigger.ts — Trigger / Affector 事件联动类型
// ============================================================

import type { ExtraCompound } from './extra';
import type { Condition, ConditionGroup, Effect, ValueExpression } from './expression';
import type { ZoneModifierDecl } from '../expression/tag-effect';

export type AffectorState = 'Latent' | 'Active' | 'Removed';

/** 持续流：Affector 激活期间每 tick 懒求值入账的资源产出。 */
export interface AffectorFlow {
  /** 目标资源。 */
  resource: string;
  /** 每 tick 数量（数值或表达式，如 spotLevel × amountPerLevel）。 */
  value: number | ValueExpression;
}

export interface AffectorEffect {
  id: string;
  condition?: ConditionGroup;
  /**
   * 即时效果：仅在激活沿（Latent→Active 翻转）执行一次。addResource 为一次性发放，
   * setFlag/addItem/addEnhancement 等一次性 op 同样只执行一次——持续产出用 flows，
   * 每 tick 逻辑用 perTickEffects，声明类 op（setSpotMaxLevel/removeSpotMaxLevel）
   * 由 getSpotMaxLevelOverrides 动态读取，不经执行。
   */
  effects: Effect[];
  /** 持续期每 tick 执行的效果（仅限幂等/维持类 op；一次性 op 会随每 tick 重复发放）。 */
  perTickEffects?: Effect[];
  /** 持续流：激活期间每 tick 懒求值入账（唯一持续产出通道）。 */
  flows?: AffectorFlow[];
  /** 按作用目标（tag 或指定实体）的加区/乘区/上下限声明（经桥接层转写为 PlayerState.tagEffects / entityEffects）。 */
  zoneModifiers?: ZoneModifierDecl[];
}

export interface AffectorPackDef {
  /** @label ID */
  id: string;
  entries: AffectorEffect[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/**
 * Affector 包引用：既可是全局注册的 pack id 字符串，也可是内联的完整 AffectorPackDef
 * （匿名构建，依附所在 Datapack，不存存档本体）。运行时按「后加载优先」解析为可用 pack。
 */
export type AffectorPackRef = string | AffectorPackDef;

export interface AffectorInstance {
  instanceId: string;
  packId: string;
  mountEntityId: string;
  state: AffectorState;
  activeEntryIds: string[];
}

// --- Trigger 系统（对外 DSL：事件侦测 → 条件 → 执行） ---

/** 侦测来源：由哪些运行时事件驱动检查。 */
export type TriggerEventDef =
  | { kind: 'tick'; every?: number }
  | { kind: 'resource'; resource?: string }
  | { kind: 'spotLevel'; spotId?: string }
  | { kind: 'item'; itemId?: string }
  | { kind: 'story'; storyId?: string }
  | { kind: 'init'; initId?: string }
  | { kind: 'area'; areaId?: string };

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
