import type { Registry } from '../../data-services/registry/registry';

export function globalSpotEntries<T>(registry: Registry, map: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [spotId, value] of Object.entries(map)) {
    if (registry.spots.get(spotId)?.global) result[spotId] = value;
  }
  return result;
}

export function localSpotEntries<T>(registry: Registry, map: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [spotId, value] of Object.entries(map)) {
    if (!registry.spots.get(spotId)?.global) result[spotId] = value;
  }
  return result;
}
