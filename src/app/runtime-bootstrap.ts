import { defaultDatapack } from '../arona-clicker/content';
import { AronaClickerRuntime, type AronaClickerRuntimeOptions } from '../arona-clicker/runtime';

export const DEFAULT_INIT_ID = 'base:init:schale_office';

export function createAppRuntime(options: AronaClickerRuntimeOptions = {}): AronaClickerRuntime {
  return new AronaClickerRuntime(options);
}

export function loadDefaultDatapack(runtime: AronaClickerRuntime): void {
  // base 已由 AronaClickerRuntime 作为内置数据包登记进 PackManager；
  // 产品启动统一从启用集应用，确保包库、Registry 与运行时来源一致。
  runtime.applyEnabledPacks();
}

export { defaultDatapack };
