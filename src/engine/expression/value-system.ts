// ============================================================
// engine/value-system.ts — ValueExpression 求值系统
//
// 算子表驱动（BINARY_OPS / UNARY_OPS）+ source → 求值器注册表
// （模块级常量，Record 键穷尽 ValueSource 全集）：新增 source =
// ValueSource 联合加成员 + SOURCE_EVALUATORS 加一条。数据包 JSON
// 可能携带未知 source：查找失败回落 0（保持原 default 语义）。
// ============================================================

import { ValueExpression, PlayerState, Value, ValueSource, FuncletDef, ExtraPath, ExtraValue } from '../types';
import { toNumber } from '../extra/index';

/** 二元算子表（div 有除零保护，clamp 三操作数，均走显式分支）。 */
const BINARY_OPS = {
  add: (a: number, b: number) => a + b,
  sub: (a: number, b: number) => a - b,
  mul: (a: number, b: number) => a * b,
  min: (a: number, b: number) => Math.min(a, b),
  max: (a: number, b: number) => Math.max(a, b),
  pow: (a: number, b: number) => Math.pow(a, b),
} as const;

/** 一元取整算子表。 */
const UNARY_OPS = {
  floor: (x: number) => Math.floor(x),
  ceil: (x: number) => Math.ceil(x),
  round: (x: number) => Math.round(x),
} as const;

/** 单个 source 的求值器：从状态与注入依赖读取数值。 */
type SourceEvaluator = (sys: ValueSystem, val: Value, state: PlayerState) => number;

const SOURCE_EVALUATORS: Record<ValueSource, SourceEvaluator> = {
  const: (_sys, val) => Number(val.params.value ?? 0),

  res: (_sys, val, state) => state.resources[String(val.params.resource)] ?? 0,

  spotLevel: (_sys, val, state) => state.spotLevels[String(val.params.spot ?? '')] ?? 0,

  areaSpotCount: (_sys, val, state) => {
    // 计算某 Area 下已解锁的 Spot 数量
    const areaId = String(val.params.area ?? '');
    let count = 0;
    for (const [spotId, level] of Object.entries(state.spotLevels)) {
      if (spotId.startsWith(areaId) && level > 0) count++;
    }
    return count;
  },

  managerCount: (_sys, val, state) => {
    // 计算某 Init 下所有 Spot 中已被分配的 Manager 数量
    const initId = String(val.params.init ?? '');
    const managerSet = new Set<string>();
    for (const [spotId, char] of Object.entries(state.spotManagers)) {
      if (spotId.startsWith(initId) && char !== 'none') {
        managerSet.add(char);
      }
    }
    return managerSet.size;
  },

  data: (sys, val) => {
    // 读 Extra 三层合并视图并转数值（缺失 → 0）
    return toNumber(sys.extraReader(String(val.params.path ?? '')));
  },

  funclet: (sys, val, state) => {
    const funcletId = String(val.params.funclet ?? '');
    const def = sys.funcletDefs.get(funcletId);
    if (!def) return 0;
    // 从 params 中提取参数 (排除 funclet key 本身)
    const args: Record<string, number | string> = {};
    for (const param of def.params) {
      const raw = val.params[param.name];
      if (raw !== undefined) {
        args[param.name] = param.type === 'number' ? Number(raw) : String(raw);
      }
    }
    return sys.evaluate({ type: 'value', value: def.calc as unknown as Value }, {
      ...state,
      flags: { ...state.flags, ...Object.fromEntries(
        Object.entries(args).map(([k, v]) => [k, String(v)])
      )},
    });
  },
};

export class ValueSystem {
  /** @internal funclet 定义表（供 SOURCE_EVALUATORS 读取；setFuncletDefs 注入）。 */
  funcletDefs: Map<string, FuncletDef>;
  /** @internal Extra 三层合并视图读取器（由 GameInstance.getExtra 提供）。 */
  extraReader: (path: ExtraPath) => ExtraValue | undefined = () => undefined;

  constructor(funcletDefs: Map<string, FuncletDef> = new Map()) {
    this.funcletDefs = funcletDefs;
  }

  setFuncletDefs(defs: Map<string, FuncletDef>): void {
    this.funcletDefs = defs;
  }

  /** 读取 funclet 定义（供静态分析，如产出表达式资源依赖扫描）。 */
  getFunclet(id: string): FuncletDef | undefined {
    return this.funcletDefs.get(id);
  }

  setExtraReader(reader: (path: ExtraPath) => ExtraValue | undefined): void {
    this.extraReader = reader;
  }

  /** 求值 ValueExpression 为数字 */
  evaluate(expr: ValueExpression, state: PlayerState): number {
    switch (expr.type) {
      case 'const':
        return expr.value;
      case 'value':
        return this.evaluateValue(expr.value, state);
      case 'add':
      case 'sub':
      case 'mul':
      case 'min':
      case 'max':
      case 'pow': {
        const op = BINARY_OPS[expr.type];
        return op(this.evaluate(expr.left, state), this.evaluate(expr.right, state));
      }
      case 'div': {
        const d = this.evaluate(expr.right, state);
        return d === 0 ? 0 : this.evaluate(expr.left, state) / d;
      }
      case 'floor':
      case 'ceil':
      case 'round':
        return UNARY_OPS[expr.type](this.evaluate(expr.expr, state));
      case 'clamp': {
        const v = this.evaluate(expr.expr, state);
        const lo = this.evaluate(expr.min, state);
        const hi = this.evaluate(expr.max, state);
        return Math.min(Math.max(v, lo), hi);
      }
    }
  }

  /** 求值单个 Value */
  evaluateValue(val: Value, state: PlayerState): number {
    const evaluator = SOURCE_EVALUATORS[val.source];
    return evaluator ? evaluator(this, val, state) : 0;
  }
}
