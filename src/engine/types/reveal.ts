// ============================================================
// engine/types/reveal.ts — 揭示 / 可达性层级共享类型
// ============================================================

import type { Condition, ConditionGroup } from './expression';

/**
 * 信息揭示阶梯（可购买实体）：
 *   invisible    L0 不可见（未满足存在条件）
 *   presence     L1 知晓这里有一个未解锁内容
 *   partial      L2 知晓名称 或 解锁条件
 *   known        L3 知晓名称与解锁条件
 *   utility      L4 并知晓效用
 *   purchaseable L5 解锁条件满足，可购买
 *   owned        L6 已购买
 */
export type RevealStage =
  | 'invisible'
  | 'presence'
  | 'partial'
  | 'known'
  | 'utility'
  | 'purchaseable'
  | 'owned';

/**
 * 揭示目标：信息阶梯中由单个 Trigger 负责揭示的信息块。
 * existence = 实体是否出现（原 visibilityCondition 的职责，已并入本系统）。
 * unlock    = 实际解锁 / 自动解锁条件（可达性层，engine 直接消费；其余 target 仅做信息揭示）。
 */
export type RevealTarget = 'existence' | 'name' | 'condition' | 'utility' | 'unlock';

/**
 * 揭示 Trigger：负责单一揭示任务的信息块揭示条款。
 * 条件满足即揭示对应信息块；同一信息块可有多个 Trigger（任一满足即揭示）。
 * Def 原型上的揭示信息由可变 Trigger 列表（revealTriggers）表达，而非固定四段阶梯。
 */
export interface RevealTrigger {
  /** 本 Trigger 负责揭示的信息块。 */
  reveal: RevealTarget;
  /** 触发条件：满足时揭示。可为单条原子条件（Condition）或组合条件（ConditionGroup）。缺省 = 恒真。 */
  condition?: Condition | ConditionGroup;
}

/**
 * 实体在系统中的状态阶段，自上而下层层收窄：
 *
 *   可见性层  hidden      实体不出现在界面（revealTriggers 的 existence 门槛不满足）
 *   揭示层    obfuscated  可见但数值以 ??? 遮挡（未满足揭示条件）
 *   揭示层    revealed    可见且数值完整展示（已拥有/已激活）
 *   可达性层  accessible  可进入 / 解锁 / 使用（Init 解锁、Area 相邻、Spot 购买、
 *                         Enhancement 条件满足、Story 可演出等逐级放行）
 *   生效层    active      运行时持续生效（Affector Latent/Active、Trigger 命中执行、
 *                         Spot 功能按条件产出生效、动态 Tag 增删触发重估）
 *
 * 顺序：可见性 → 揭示 → 可达性 → 生效。先看见，再看全，再进得去，才持续生效。
 * 可见性由 revealTriggers 中的 existence 目标承担（原 visibilityCondition 的职责）。
 */
export type AccessStage = 'hidden' | 'obfuscated' | 'revealed' | 'accessible' | 'active';
