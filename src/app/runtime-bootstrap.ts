import { defaultDatapack } from '../arona-clicker/content';
import { AronaClickerRuntime, type AronaClickerRuntimeOptions } from '../arona-clicker/runtime';

export const DEFAULT_INIT_ID = 'base:init:schale_office';

export function createAppRuntime(options: AronaClickerRuntimeOptions = {}): AronaClickerRuntime {
  return new AronaClickerRuntime(options);
}

export function loadDefaultDatapack(runtime: AronaClickerRuntime): void {
  runtime.init([defaultDatapack]);
}

export { defaultDatapack };
