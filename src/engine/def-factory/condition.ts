// ============================================================
// engine/def-factory/condition.ts — 条件组合工厂
// 构造 Condition / ConditionGroup（自 types/expression.ts 拆出）
// ============================================================

import type { Condition, ConditionGroup, Comparator, ConditionTarget } from '../types/expression';

/** 单条条件。 */
export const cond = (
  target: ConditionTarget,
  key: string,
  comparator: Comparator,
  value: number,
): Condition => ({ target, key, comparator, value });

/** AND 组合（可递归嵌套 ConditionGroup）。 */
export const and = (...conditions: (Condition | ConditionGroup)[]): ConditionGroup => ({
  type: 'AND',
  conditions,
});

/** OR 组合（可递归嵌套 ConditionGroup）。 */
export const or = (...conditions: (Condition | ConditionGroup)[]): ConditionGroup => ({
  type: 'OR',
  conditions,
});
