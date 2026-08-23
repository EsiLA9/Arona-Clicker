// ============================================================
// engine/effect-engine.ts — Effect 效果引擎
// ============================================================

import { Effect, PlayerState, ValueExpression } from '../types';
import { EventBus } from '../core/event-bus';
import { StateMutationService } from '../system/state-mutation-service';
import { ValueSystem } from '../expression/value-system';

export class EffectEngine {
  private eventBus: EventBus;
  private mutations: StateMutationService;
  private _state!: PlayerState;

  /**
   * 非状态主题类效果（setTheme）的处理器：由 GameInstance 注入 ColorSystem.handleThemeEffect。
   * 这类 effect 不写入 PlayerState，只影响运行时 UI 主题层。
   */
  themeEffectHandler: ((effect: Effect) => void) | null = null;
  /**
   * 剧情启动效果（triggerStory）的处理器：由 GameInstance 注入 StoryService.startStory。
   * 不写入 PlayerState，由上层按 effect.target（storyId）与 effect.owner（可选沙盒）启动剧情。
   */
  storyStarter: ((effect: Effect) => void) | null = null;

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
    // 主题/剧情启动类效果转发给运行时层（不落状态），其余走状态写入口
    const stateEffects = resolved.filter(effect => {
      if (effect.op === 'setTheme') {
        this.themeEffectHandler?.(effect);
        return false;
      }
      if (effect.op === 'triggerStory') {
        this.storyStarter?.(effect);
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
