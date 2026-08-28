// ============================================================
// engine/value-system.ts — ValueExpression 求值系统
// ============================================================

import { ValueExpression, PlayerState, Value, FuncletCall, FuncletDef, ExtraPath, ExtraValue } from '../types';
import { toNumber } from '../extra/index';

export class ValueSystem {
  private funcletDefs: Map<string, FuncletDef>;
  /** Extra 三层合并视图读取器（全局 → per-Init → 数据包常量表，由 GameInstance.getExtra 提供）。 */
  private extraReader: (path: ExtraPath) => ExtraValue | undefined = () => undefined;

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
        return this.evaluate(expr.left, state) + this.evaluate(expr.right, state);
      case 'sub':
        return this.evaluate(expr.left, state) - this.evaluate(expr.right, state);
      case 'mul':
        return this.evaluate(expr.left, state) * this.evaluate(expr.right, state);
      case 'div': {
        const d = this.evaluate(expr.right, state);
        return d === 0 ? 0 : this.evaluate(expr.left, state) / d;
      }
      case 'min':
        return Math.min(this.evaluate(expr.left, state), this.evaluate(expr.right, state));
      case 'max':
        return Math.max(this.evaluate(expr.left, state), this.evaluate(expr.right, state));
      case 'pow':
        return Math.pow(this.evaluate(expr.left, state), this.evaluate(expr.right, state));
      case 'floor':
        return Math.floor(this.evaluate(expr.expr, state));
      case 'ceil':
        return Math.ceil(this.evaluate(expr.expr, state));
      case 'round':
        return Math.round(this.evaluate(expr.expr, state));
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
    switch (val.source) {
      case 'const':
        return Number(val.params.value ?? 0);

      case 'res':
        return state.resources[String(val.params.resource)] ?? 0;

      case 'spotLevel': {
        const spotId = String(val.params.spot ?? '');
        return state.spotLevels[spotId] ?? 0;
      }

      case 'areaSpotCount': {
        // 计算某 Area 下已解锁的 Spot 数量
        const areaId = String(val.params.area ?? '');
        let count = 0;
        for (const [spotId, level] of Object.entries(state.spotLevels)) {
          if (spotId.startsWith(areaId) && level > 0) count++;
        }
        return count;
      }

      case 'managerCount': {
        // 计算某 Init 下所有 Spot 中已被分配的 Manager 数量
        const initId = String(val.params.init ?? '');
        const managerSet = new Set<string>();
        for (const [spotId, char] of Object.entries(state.spotManagers)) {
          if (spotId.startsWith(initId) && char !== 'none') {
            managerSet.add(char);
          }
        }
        return managerSet.size;
      }

      case 'data': {
        // 读 Extra 三层合并视图并转数值（缺失 → 0）
        const path = String(val.params.path ?? '');
        return toNumber(this.extraReader(path));
      }

      case 'funclet': {
        const funcletId = String(val.params.funclet ?? '');
        const def = this.funcletDefs.get(funcletId);
        if (!def) return 0;
        // 从 params 中提取参数 (排除 funclet key 本身)
        const args: Record<string, number | string> = {};
        for (const param of def.params) {
          const raw = val.params[param.name];
          if (raw !== undefined) {
            args[param.name] = param.type === 'number' ? Number(raw) : String(raw);
          }
        }
        return this.evaluate({ type: 'value', value: def.calc as unknown as Value }, {
          ...state,
          flags: { ...state.flags, ...Object.fromEntries(
            Object.entries(args).map(([k, v]) => [k, String(v)])
          )},
        });
      }

      default:
        return 0;
    }
  }
}
