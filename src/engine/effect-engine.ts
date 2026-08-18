// ============================================================
// engine/effect-engine.ts — Effect 效果引擎
// ============================================================

import { Effect, PlayerState, ValueExpression } from './types';
import { EventBus } from './event-bus';
import { StateMutationService } from './state-mutation-service';
import { ValueSystem } from './value-system';

export class EffectEngine {
  private eventBus: EventBus;
  private mutations: StateMutationService;
  private _state!: PlayerState;

  constructor(eventBus: EventBus, mutations?: StateMutationService, private readonly valueSystem?: ValueSystem) {
    this.eventBus = eventBus;
    this.mutations = mutations ?? new StateMutationService(eventBus);
  }

  setState(state: PlayerState): void {
    this._state = state;
    this.mutations.setState(state);
  }

  /** 批量执行效果列表（value 为 ValueExpression 时先按当前状态求值）。 */
  applyEffects(effects: Effect[]): void {
    const resolved = effects.map(effect => this.resolveValue(effect));
    this.mutations.applyEffects(resolved);
  }

  /** 把 value 为 ValueExpression 的效果解析为数值；无 valueSystem 或非表达式（含 ExtraValue 等结构化对象）时原样保留。 */
  private resolveValue(effect: Effect): Effect {
    if (typeof effect.value !== 'object' || effect.value === null) return effect;
    if (!this.valueSystem) return effect;
    if (!('type' in effect.value)) return effect;
    return { ...effect, value: this.valueSystem.evaluate(effect.value as ValueExpression, this._state) };
  }
}
