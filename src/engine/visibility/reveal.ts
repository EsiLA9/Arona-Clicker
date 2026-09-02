// ============================================================
// engine/reveal.ts — 揭示系统（Info Reveal）共享辅助
//
// revealTriggers（揭示 Trigger 列表）统一表达「信息可知」的各级门槛：
//   existence → 实体是否出现（原 visibilityCondition 的职责，已并入本系统）
//   name      → 名称
//   condition → 解锁 / 获得条件
//   utility   → 效用（描述、产出等）
//   unlock    → 实际解锁 / 自动解锁条件（engine 消费的可达性层；其余 target 仅做信息揭示）
//
// 规则：无该目标的 Trigger = 无门槛（该级默认已知 / 可见）；
// 有多个 Trigger = 任一满足即揭示（OR）。
// ============================================================

import { Condition, ConditionGroup, RevealTrigger } from '../types';

/** 取 revealTriggers 中负责「存在性」（实体是否出现）的 Trigger 列表。 */
export function existenceTriggers(triggers?: readonly RevealTrigger[]): RevealTrigger[] {
  return triggers?.filter(t => t.reveal === 'existence') ?? [];
}

/** 是否有存在性门槛（出现条件）。无 = 实体始终可见。 */
export function hasExistenceGate(triggers?: readonly RevealTrigger[]): boolean {
  return existenceTriggers(triggers).length > 0;
}

/** 取存在性条件（首个带条件的 existence Trigger），用于 UI 展示「出现条件」。无 = undefined。 */
export function existenceCondition(triggers?: readonly RevealTrigger[]): Condition | ConditionGroup | undefined {
  return existenceTriggers(triggers).find(t => t.condition)?.condition;
}

/**
 * 存在性判定：无门槛 → 恒可见；有门槛 → 任一 Trigger 满足即可见
 * （Trigger 缺省条件 = 恒真）。
 * @param evaluate 对单个条件求值（返回 true 表示满足）
 */
export function existenceMet(
  triggers: readonly RevealTrigger[] | undefined,
  evaluate: (condition: Condition | ConditionGroup) => boolean,
): boolean {
  const list = existenceTriggers(triggers);
  if (!list.length) return true;
  return list.some(t => !t.condition || evaluate(t.condition));
}

/** 取 revealTriggers 中负责「解锁」（实际解锁 / 自动解锁条件）的 Trigger 列表。 */
export function unlockTriggers(triggers?: readonly RevealTrigger[]): RevealTrigger[] {
  return triggers?.filter(t => t.reveal === 'unlock') ?? [];
}

/** 取实际解锁条件（首个带条件的 unlock Trigger）。无 unlock Trigger / 均无条件 = 无解锁门槛（恒真）。 */
export function unlockCondition(triggers?: readonly RevealTrigger[]): Condition | ConditionGroup | undefined {
  return unlockTriggers(triggers).find(t => t.condition)?.condition;
}

/**
 * 解锁可达性判定：无 unlock 门槛 → 恒可达；有门槛 → 任一 Trigger 满足即解锁
 * （Trigger 缺省条件 = 恒真）。
 * @param evaluate 对单个条件求值（返回 true 表示满足）
 */
export function unlockMet(
  triggers: readonly RevealTrigger[] | undefined,
  evaluate: (condition: Condition | ConditionGroup) => boolean,
): boolean {
  const list = unlockTriggers(triggers);
  if (!list.length) return true;
  return list.some(t => !t.condition || evaluate(t.condition));
}
