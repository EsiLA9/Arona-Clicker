// ============================================================
// engine/effect-engine.ts — Effect 效果引擎
//
// op 分发表驱动：状态层 op 委托 StateMutationService；演出类 op
// （主题/剧情启动/聊天流）发射运行时请求事件，由 RuntimeEffectReactor
// 消费（EventBus 同步派发，语义与原回调处理器一致）——效果层不反向
// 持有领域服务，依赖单向（docs-824/08 T7）。声明类 op 见
// types/expression DECLARATIVE_EFFECT_OPS。
// ============================================================

import { Effect, EffectOp, GameEvent, PlayerState, ValueExpression } from '../types';
import { EventBus } from '../core/event-bus';
import { StateMutationService } from '../system/state-mutation-service';
import { ValueSystem } from '../expression/value-system';

export class EffectEngine {
  private eventBus: EventBus;
  private mutations: StateMutationService;
  private _state!: PlayerState;

  /** 运行时请求事件发射表（构造期建一次）：演出类 op → 对应请求事件。 */
  private readonly runtimeEmit: Partial<Record<EffectOp, (effect: Effect) => GameEvent>>;

  constructor(eventBus: EventBus, mutations?: StateMutationService, private readonly valueSystem?: ValueSystem) {
    this.eventBus = eventBus;
    this.mutations = mutations ?? new StateMutationService(eventBus);
    this.runtimeEmit = {
      setTheme: effect => ({ type: 'themeEffectRequested', effect }),
      triggerStory: effect => ({ type: 'storyEffectRequested', effect }),
      clearAllChatFlow: effect => ({ type: 'chatFlowEffectRequested', effect }),
      showChatText: effect => ({ type: 'chatFlowEffectRequested', effect }),
      clearIdChatFlow: effect => ({ type: 'chatFlowEffectRequested', effect }),
      clearAllChatText: effect => ({ type: 'chatFlowEffectRequested', effect }),
    };
  }

  setState(state: PlayerState): void {
    this._state = state;
    this.mutations.setState(state);
  }

  /** 批量执行效果列表（value 为 ValueExpression 时先按当前状态求值）。 */
  applyEffects(effects: Effect[]): void {
    const resolved = effects.map(effect => this.resolveValue(effect));
    // 演出类 op 发运行时请求事件（不落状态），其余走状态写入口
    const stateEffects = resolved.filter(effect => {
      const build = this.runtimeEmit[effect.op];
      if (build) {
        this.eventBus.emit(build(effect));
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
