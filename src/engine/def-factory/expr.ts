// ============================================================
// engine/def-factory/expr.ts — 数值表达式工厂
// 构造 Value / ValueExpression（自 types/expression.ts 拆出）
// ============================================================

import type { Value, ValueSource, ValueExpression } from '../types/expression';

/** 构造 Value 引用（source + params）。 */
export const value = (source: ValueSource, params: Record<string, string | number> = {}): Value => ({
  type: 'value',
  source,
  params,
});

/** ValueExpression 表达式树工厂：字面量 / 引用 / 二元运算 / 取整 / 夹取。 */
export const Expr = {
  const: (v: number): ValueExpression => ({ type: 'const', value: v }),
  val: (v: Value): ValueExpression => ({ type: 'value', value: v }),
  add: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'add', left, right }),
  sub: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'sub', left, right }),
  mul: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'mul', left, right }),
  div: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'div', left, right }),
  min: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'min', left, right }),
  max: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'max', left, right }),
  pow: (left: ValueExpression, right: ValueExpression): ValueExpression => ({ type: 'pow', left, right }),
  floor: (expr: ValueExpression): ValueExpression => ({ type: 'floor', expr }),
  ceil: (expr: ValueExpression): ValueExpression => ({ type: 'ceil', expr }),
  round: (expr: ValueExpression): ValueExpression => ({ type: 'round', expr }),
  clamp: (expr: ValueExpression, min: ValueExpression, max: ValueExpression): ValueExpression =>
    ({ type: 'clamp', expr, min, max }),
};
