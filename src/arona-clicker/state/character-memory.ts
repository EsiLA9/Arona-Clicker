// 跨世界线角色记忆（CharacterMemory）读写助手。
//
// Memory 永远 global（不进 PER_INIT_FIELD_SPECS）：只记录历史最大值与历史事实，
// 由各写入口在同一提交内维护，保证跨世界线追赶可信（见 ADR-0008 A2）。

import type { AronaClickerState } from '../types/state';
import type { CharacterMemory, GearProgress, VariantMemory, VariantProgress } from '../types/character';
import type { VariantId } from '../types/character';
import type { Character } from '../types/ids';

function emptyMemory(): CharacterMemory {
  return {
    variants: {},
    affectionTotalEver: 0,
    variantsEverOwned: [],
    lifetime: { expGained: 0, cultivateSpent: 0, affectionGained: 0 },
  };
}

/** 取（或惰性创建）某原型的记忆对象。 */
export function memoryOf(state: AronaClickerState, character: Character): CharacterMemory {
  const all = (state.characterMemory ??= {});
  return (all[character] ??= emptyMemory());
}

/** 取（或惰性创建）某差分的记忆对象。 */
export function variantMemoryOf(mem: CharacterMemory, variantId: VariantId): VariantMemory {
  return (mem.variants[variantId] ??= { maxLevel: 0, maxStars: 0, maxAffection: 0 });
}

/** 刷新差分的历史最大值（只增不减）。 */
export function recordVariantProgress(mem: CharacterMemory, entry: VariantProgress): void {
  const vm = variantMemoryOf(mem, entry.variantId);
  vm.maxLevel = Math.max(vm.maxLevel, entry.level);
  vm.maxStars = Math.max(vm.maxStars, entry.stars);
  vm.maxAffection = Math.max(vm.maxAffection, entry.affectionLevel);
}

/** 刷新差分三槽装备的历史最高 tier（只增不减）。 */
export function recordGearProgress(
  mem: CharacterMemory,
  variantId: VariantId,
  gear: readonly (GearProgress | undefined)[],
): void {
  const vm = variantMemoryOf(mem, variantId);
  const previous = vm.maxGearTier ?? [0, 0, 0];
  vm.maxGearTier = [0, 1, 2].map(i => Math.max(previous[i] ?? 0, gear[i]?.tier ?? 0)) as [number, number, number];
}

/** 首次拥有某差分：登记历史事实（幂等）。 */
export function recordVariantOwned(mem: CharacterMemory, variantId: VariantId): void {
  if (!mem.variantsEverOwned.includes(variantId)) mem.variantsEverOwned.push(variantId);
}

/** 累计行为量（跨世界线口径；与 roadmap-0004 统计的合并留待其裁定）。 */
export function addLifetime(
  mem: CharacterMemory,
  delta: { expGained?: number; cultivateSpent?: number; affectionGained?: number },
): void {
  if (delta.expGained) mem.lifetime.expGained += delta.expGained;
  if (delta.cultivateSpent) mem.lifetime.cultivateSpent += delta.cultivateSpent;
  if (delta.affectionGained) mem.lifetime.affectionGained += delta.affectionGained;
}
