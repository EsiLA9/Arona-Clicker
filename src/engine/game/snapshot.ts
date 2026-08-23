// ============================================================
// engine/game/snapshot.ts — per-Init 状态 / 快照纯函数辅助
// ============================================================

import { extra } from '../extra';
import type { ExtraCompound, InitSnapshot } from '../types';
import type { Registry } from '../registry';

/** 返回所有 Init 局部字段的 "新鲜" 默认值。 */
export function freshPerInitState(): InitSnapshot & { initExtras: ExtraCompound } {
  return {
    resources: {},
    spotLevels: {},
    spotManagers: {},
    visitedAreas: [],
    totalFrames: 0,
    inventory: {},
    unlockedEnhancements: [],
    storyLog: [],
    flags: {},
    triggersCompleted: [],
    currentAreaId: undefined,
    initExtras: extra.dict({}),
  };
}

/** 提取 SpotDef.global=true 的 Spot 状态条目（跨世界线共享设施）。 */
export function globalSpotEntries<T>(registry: Registry, map: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [spotId, value] of Object.entries(map)) {
    if (registry.spots.get(spotId)?.global) result[spotId] = value;
  }
  return result;
}

/** 提取非 global 的 Spot 状态条目（普通设施，随世界线隔离）。 */
export function localSpotEntries<T>(registry: Registry, map: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [spotId, value] of Object.entries(map)) {
    if (!registry.spots.get(spotId)?.global) result[spotId] = value;
  }
  return result;
}
