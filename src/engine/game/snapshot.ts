// ============================================================
// engine/game/snapshot.ts — per-Init 快照纯函数辅助
// （字段清单与默认值见 per-init-fields.ts；本文件只保留 Spot 局部/全局过滤）
// ============================================================

import type { Registry } from '../registry/registry';

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
