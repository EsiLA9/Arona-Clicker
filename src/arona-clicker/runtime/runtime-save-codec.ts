import type { SaveData } from '../contracts/runtime/save-data';
import type { SaveBuildContext } from '../contracts/runtime/save-codec';
import { mergeTagEffects, mergeTagOverrides, splitTagEffects, splitTagOverrides } from '../state/tag-residue';

/** 组装 AronaClicker Runtime 快照；不负责恢复引擎子系统。 */
export function buildSaveData(ctx: SaveBuildContext): SaveData {
  const storyPlayback = ctx.storyCursors();
  const allTagOverrides = mergeTagOverrides(ctx.state.spotTagOverrides, ctx.retainedTagResidue);
  const tagOverrides = splitTagOverrides(allTagOverrides, ctx.activeModNames ?? new Set(['base']));
  const allTagEffects = mergeTagEffects(ctx.state.tagEffects, ctx.retainedTagResidue);
  const tagEffects = splitTagEffects(allTagEffects, ctx.activeModNames ?? new Set(['base']));
  const operationRun = ctx.operationRun?.() ?? null;
  const mapRun = ctx.mapRun?.() ?? null;
  return {
    version: '2.0.0',
    timestamp: Date.now(),
    playerState: JSON.parse(JSON.stringify({ ...ctx.state, spotTagOverrides: tagOverrides.active, tagEffects: tagEffects.active })),
    visibility: JSON.parse(JSON.stringify(ctx.visibility())),
    storyPlayback: structuredClone(storyPlayback),
    ...(operationRun ? { operationRun } : {}),
    ...(mapRun ? { mapRun: JSON.parse(JSON.stringify(mapRun)) as typeof mapRun } : {}),
    stats: ctx.persistedStats(),
    retained: { ...tagOverrides.residue, ...(Object.keys(tagEffects.residue).length ? { tagEffects: tagEffects.residue } : {}) },
  };
}
