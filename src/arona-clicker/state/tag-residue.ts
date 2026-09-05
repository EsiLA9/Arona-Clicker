import { isTagRef, parseTagId, tagKey, tagModName, type TagPath } from '../../engine/core/tag';
import type { SpotTagOverrideState } from '../../engine/contracts/state-query';
import type { TagEffectRecord } from '../../engine/expression/tag-effect';

export type TagOverrideMap = Record<string, SpotTagOverrideState>;
export type TagEffectMap = Record<string, TagEffectRecord[]>;

export interface TagOverrideResidue {
  spotTagOverrides: TagOverrideMap;
  tagEffects?: TagEffectMap;
}

export interface SplitTagOverridesResult {
  active: TagOverrideMap;
  residue: TagOverrideResidue;
}

export interface ClearTagResidueResult {
  residue: TagOverrideResidue;
  removed: number;
}

function emptyOverride(): SpotTagOverrideState {
  return { added: [], removed: [] };
}

function cloneOverride(value: SpotTagOverrideState): SpotTagOverrideState {
  return {
    added: value.added.map(path => [...path]),
    removed: value.removed.map(path => [...path]),
  };
}

function isActiveTag(path: TagPath, activeModNames: ReadonlySet<string>): boolean {
  const key = tagKey(path);
  if (key.includes(':') && path.some(segment => segment.includes(':')) && !isTagRef(key)) return false;
  return activeModNames.has(tagModName(path));
}

function splitOne(value: SpotTagOverrideState, activeModNames: ReadonlySet<string>): [SpotTagOverrideState, SpotTagOverrideState] {
  const active = emptyOverride();
  const residue = emptyOverride();
  for (const path of value.added) (isActiveTag(path, activeModNames) ? active : residue).added.push([...path]);
  for (const path of value.removed) (isActiveTag(path, activeModNames) ? active : residue).removed.push([...path]);
  return [active, residue];
}

function keepNonEmpty(target: TagOverrideMap, spotId: string, value: SpotTagOverrideState): void {
  if (value.added.length > 0 || value.removed.length > 0) target[spotId] = value;
}

/** 将动态 Tag 覆盖按当前启用的 mod 拆成运行时数据与惰性残留。 */
export function splitTagOverrides(overrides: TagOverrideMap | undefined, activeModNames: ReadonlySet<string>): SplitTagOverridesResult {
  const active: TagOverrideMap = {};
  const residue: TagOverrideMap = {};
  for (const [spotId, value] of Object.entries(overrides ?? {})) {
    const [activeValue, residueValue] = splitOne(value, activeModNames);
    keepNonEmpty(active, spotId, activeValue);
    keepNonEmpty(residue, spotId, residueValue);
  }
  return { active, residue: { spotTagOverrides: residue } };
}

/** 将 retained 动态 Tag 与当前活跃覆盖合并，供下一次保存或重新启用 mod 后复活。 */
export function mergeTagOverrides(active: TagOverrideMap | undefined, residue: TagOverrideResidue | undefined): TagOverrideMap {
  const out: TagOverrideMap = {};
  for (const [spotId, value] of Object.entries(active ?? {})) out[spotId] = cloneOverride(value);
  for (const [spotId, value] of Object.entries(residue?.spotTagOverrides ?? {})) {
    const current = out[spotId] ?? emptyOverride();
    current.added.push(...value.added.map(path => [...path]));
    current.removed.push(...value.removed.map(path => [...path]));
    out[spotId] = current;
  }
  return out;
}

export function splitTagEffects(effects: TagEffectMap | undefined, activeModNames: ReadonlySet<string>): { active: TagEffectMap; residue: TagEffectMap } {
  const active: TagEffectMap = {};
  const residue: TagEffectMap = {};
  for (const [key, records] of Object.entries(effects ?? {})) {
    const target = key.includes(':') && !isTagRef(key)
      ? residue
      : (activeModNames.has(tagModName(parseTagId(key))) ? active : residue);
    target[key] = records.map(record => ({ ...record }));
  }
  return { active, residue };
}

export function mergeTagEffects(active: TagEffectMap | undefined, residue: TagOverrideResidue | undefined): TagEffectMap {
  const out: TagEffectMap = {};
  for (const [key, records] of Object.entries(active ?? {})) out[key] = records.map(record => ({ ...record }));
  for (const [key, records] of Object.entries(residue?.tagEffects ?? {})) {
    out[key] = [...(out[key] ?? []), ...records.map(record => ({ ...record }))];
  }
  return out;
}

export function clearTagResidueByMod(residue: TagOverrideResidue | undefined, modName: string): ClearTagResidueResult {
  let removed = 0;
  const spotTagOverrides: TagOverrideMap = {};
  for (const [spotId, value] of Object.entries(residue?.spotTagOverrides ?? {})) {
    const added = value.added.filter(path => {
      const match = tagModName(path) === modName;
      if (match) removed++;
      return !match;
    }).map(path => [...path]);
    const removedTags = value.removed.filter(path => {
      const match = tagModName(path) === modName;
      if (match) removed++;
      return !match;
    }).map(path => [...path]);
    if (added.length || removedTags.length) spotTagOverrides[spotId] = { added, removed: removedTags };
  }
  const tagEffects: TagEffectMap = {};
  for (const [key, records] of Object.entries(residue?.tagEffects ?? {})) {
    if (tagModName(parseTagId(key)) === modName) removed += records.length;
    else tagEffects[key] = records.map(record => ({ ...record }));
  }
  return {
    residue: {
      spotTagOverrides,
      ...(Object.keys(tagEffects).length ? { tagEffects } : {}),
    },
    removed,
  };
}

/** 按 mod 汇总残留动态 Tag 数量，供残留检查 UI 使用。 */
export function summarizeTagResidue(residue: TagOverrideResidue | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of Object.values(residue?.spotTagOverrides ?? {})) {
    for (const path of [...value.added, ...value.removed]) {
      const modName = tagModName(path);
      counts[modName] = (counts[modName] ?? 0) + 1;
    }
  }
  for (const key of Object.keys(residue?.tagEffects ?? {})) {
    const modName = tagModName(parseTagId(key));
    counts[modName] = (counts[modName] ?? 0) + (residue?.tagEffects?.[key]?.length ?? 0);
  }
  return counts;
}
