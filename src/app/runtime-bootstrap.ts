import { defaultDatapack } from '../arona-clicker/content';
import { AronaClickerRuntime, type AronaClickerRuntimeOptions } from '../arona-clicker/runtime';
import type { OperationContentResolver } from '../arona-clicker/contracts/operation-content-resolver';
import { CAROUSEL_SAFETY_IDS } from '../arona-clicker/content/operation-samples/carousel-safety-ids';
import { carouselSafetySliceResolver } from '../arona-clicker/content/operation-samples/carousel-safety-slice';

export const DEFAULT_INIT_ID = 'base:init:schale_office';

export function createAppRuntime(options: AronaClickerRuntimeOptions = {}): AronaClickerRuntime {
  let runtime: AronaClickerRuntime | null = null;
  const operationContentResolver: OperationContentResolver = {
    resolve(eventId) {
      if (eventId === CAROUSEL_SAFETY_IDS.event && runtime?.state.activeInit !== DEFAULT_INIT_ID) return null;
      const customContent = options.operationContentResolver?.resolve(eventId);
      if (customContent) return customContent;
      if (eventId === CAROUSEL_SAFETY_IDS.event) {
        return carouselSafetySliceResolver.resolve(eventId);
      }
      return null;
    },
  };
  runtime = new AronaClickerRuntime({ ...options, operationContentResolver });
  return runtime;
}

export function loadDefaultDatapack(runtime: AronaClickerRuntime): void {
  // base 已由 AronaClickerRuntime 作为内置数据包登记进 PackManager；
  // 产品启动统一从启用集应用，确保包库、Registry 与运行时来源一致。
  runtime.applyEnabledPacks();
}

export { defaultDatapack };
