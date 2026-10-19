import { defaultDatapack } from '../arona-clicker/content';
import { AronaClickerRuntime, type AronaClickerRuntimeOptions } from '../arona-clicker/runtime';
import type { OperationContentResolver } from '../arona-clicker/contracts/operation-content-resolver';
import { createRegistryOperationContentResolver } from '../arona-clicker/services/registry-operation-content-resolver';

export const DEFAULT_INIT_ID = 'base:init:schale_office';

export function createAppRuntime(options: AronaClickerRuntimeOptions = {}): AronaClickerRuntime {
  let runtime: AronaClickerRuntime | null = null;
  let registryResolver: OperationContentResolver | null = null;
  const operationContentResolver: OperationContentResolver = {
    listEventIds() {
      if (runtime) registryResolver ??= createRegistryOperationContentResolver(runtime.registry);
      const ids = [
        ...(options.operationContentResolver?.listEventIds?.() ?? []),
        ...(registryResolver?.listEventIds?.() ?? []),
      ];
      return [...new Set(ids)];
    },
    resolve(eventId) {
      const customContent = options.operationContentResolver?.resolve(eventId);
      if (customContent) return customContent;
      if (runtime) {
        registryResolver ??= createRegistryOperationContentResolver(runtime.registry);
        const registryContent = registryResolver.resolve(eventId);
        if (registryContent) return registryContent;
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
