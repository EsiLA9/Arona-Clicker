// ============================================================
// engine/effect-engine.ts — Effect 效果引擎
//
// 状态效果委托注入的 StateMutationPort；非持久化效果交给宿主注入的
// EffectRuntimeHandler。基础引擎不解释具体产品效果名，也不持有领域服务。
// 声明类 op 见 types/expression DECLARATIVE_EFFECT_OPS。
// ============================================================

import type { Effect, ValueExpression } from '../types';
import type { EffectRuntimeState } from '../contracts/state-query';
import type { EffectRuntimeHandler } from '../contracts/effect-runtime';
import type { StateMutationPort } from '../contracts/mutation';
import { ValueSystem } from '../expression/value-system';

export class EffectEngine {
  private _state!: EffectRuntimeState;

  constructor(
    private readonly mutations: StateMutationPort,
    private readonly valueSystem?: ValueSystem,
    private readonly runtimeEffectHandler?: EffectRuntimeHandler,
  ) {
  }

  setState(state: EffectRuntimeState): void {
    this._state = state;
    // 迁移兼容：旧宿主允许通过 setState 同步写入口；基础契约不再要求该能力。
    (this.mutations as StateMutationPort & { setState?: (state: object) => void }).setState?.(state);
  }

  /** 批量执行效果列表（value 为 ValueExpression 时先按当前状态求值）。 */
  applyEffects(effects: Effect[]): void {
    const resolved = effects.map(effect => this.resolveValue(effect));
    // 演出类 op 发运行时请求事件（不落状态），其余走状态写入口
    const stateEffects = resolved.filter(effect => {
      if (this.runtimeEffectHandler?.(effect)) {
        return false;
      }
      return true;
    });
    if (stateEffects.length > 0) this.mutations.applyEffects(stateEffects);
  }

  /** 把 value 为 ValueExpression 的效果解析为数值；无 valueSystem 或非表达式（含 ExtraValue 等结构化对象）时原样保留。 */
  private resolveValue(effect: Effect): Effect {
    if (typeof effect.value !== 'object' || effect.value === null) return effect;
    if (!this.valueSystem) return effect;
    if (!('type' in effect.value)) return effect;
    return { ...effect, value: this.valueSystem.evaluate(effect.value as ValueExpression, this._state) };
  }
}
