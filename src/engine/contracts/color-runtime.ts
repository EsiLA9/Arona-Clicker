import type { Effect } from '../types';

/** 引擎效果反应器请求主题演出的最小能力。 */
export interface ColorEffectPort {
  handleThemeEffect(effect: Effect): boolean;
}

/** 引擎事件反应器触发色彩解锁重算所需的最小能力。 */
export interface ColorUnlockPort {
  recheckUnlocks(): void;
  recheckDesignUnlocks(): void;
}
