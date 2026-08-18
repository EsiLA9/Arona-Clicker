// ============================================================
// engine/funclet-executor.ts — Funclet 执行器
// ============================================================

import { FuncletDef, FuncletCall, PlayerState, ValueExpression } from './types';
import { ValueSystem } from './value-system';

export class FuncletExecutor {
  private defs: Map<string, FuncletDef>;
  private valueSystem: ValueSystem;

  constructor(defs: Map<string, FuncletDef> = new Map()) {
    this.defs = defs;
    this.valueSystem = new ValueSystem(defs);
  }

  setDefs(defs: Map<string, FuncletDef>): void {
    this.defs = defs;
    this.valueSystem.setFuncletDefs(defs);
  }

  /**
   * 执行一次 Funclet 调用并返回结果数值
   */
  execute(call: FuncletCall, state: PlayerState): number {
    const def = this.defs.get(call.funcletId);
    if (!def) return 0;

    const augmentedState: PlayerState = {
      ...state,
      flags: { ...state.flags },
    };

    // 将调用参数注入 flags 供 value-system 使用
    for (const [key, val] of Object.entries(call.args)) {
      augmentedState.flags[key] = String(val);
    }

    return this.valueSystem.evaluateValue(
      { type: 'value', source: 'const', params: { value: 0 } },
      augmentedState
    );
  }
}
