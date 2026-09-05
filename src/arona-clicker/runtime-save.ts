import type { PlayerState } from './types/state';
import { Registry } from '../data-services/registry/registry';
import { DevLog } from '../engine/core/dev-log';
import type { RuntimeMutationPort } from './contracts/mutation';
import { StatsService } from '../engine/stats/stats';
import type { PersistedStats } from '../engine/contracts/stats';
import { AffectorEngine } from '../engine/effect/affector-engine';
import { TriggerSystem } from '../engine/effect/trigger-system';
import { EffectEngine } from '../engine/effect/effect-engine';
import { TickSystem } from '../engine/system/tick-system';
import { TagStatService } from '../engine/stats/tag-stats';
import { VisibilityEngine } from '../engine/visibility/visibility-engine';
import { StoryService } from './services/story-service';
import { InitService } from './services/init-service';
import { SessionService } from '../engine/runtime/session-service';
import type { SaveData } from './contracts/save-data';
import { mergeTagEffects, mergeTagOverrides } from './state/tag-residue';
import { splitTagEffects, splitTagOverrides, type TagOverrideResidue } from './state/tag-residue';

export type { SaveData };

export function clonePlayerState(raw: PlayerState): PlayerState {
  return JSON.parse(JSON.stringify(raw)) as PlayerState;
}

export interface RestoreContext {
  registry: Registry;
  devLog: DevLog;
  mutations: RuntimeMutationPort;
  statsService: StatsService;
  affectorEngine: AffectorEngine;
  triggerSystem: TriggerSystem;
  effectEngine: EffectEngine;
  tickSystem: TickSystem;
  tagStatService: TagStatService;
  visibilityEngine: VisibilityEngine;
  storyService: StoryService;
  initService: InitService;
  sessionService: SessionService;
  setState: (next: PlayerState) => void;
  setTagResidue?: (residue: TagOverrideResidue) => void;
}

export function restoreFromSave(ctx: RestoreContext, saveData: SaveData): void {
  const state = clonePlayerState(saveData.playerState);
  const tagOverrides = splitTagOverrides(
    mergeTagOverrides(state.spotTagOverrides, saveData.retained),
    ctx.registry.loadedModNames,
  );
  state.spotTagOverrides = tagOverrides.active;
  const tagEffects = splitTagEffects(
    mergeTagEffects(state.tagEffects, saveData.retained),
    ctx.registry.loadedModNames,
  );
  state.tagEffects = tagEffects.active;
  ctx.setTagResidue?.({ ...tagOverrides.residue, ...(Object.keys(tagEffects.residue).length ? { tagEffects: tagEffects.residue } : {}) });
  ctx.setState(state);
  ctx.mutations.setState(state);
  ctx.statsService.setState(state);
  ctx.affectorEngine.setState(state);
  ctx.triggerSystem.setState(state);
  if (state.activeInit) ctx.initService.mountInitTriggers(state.activeInit);
  // visibility 是基于当前 Registry/State 的派生数据；旧存档中的快照可能缺少
  // 新增的 Init/GlobalEnh 条目，因此读档后统一按当前数据重算。
  if (saveData.visibility) ctx.visibilityEngine.setSnapshot(saveData.visibility);
  ctx.visibilityEngine.recomputeAll(state);
  if (saveData.stats) ctx.statsService.restore(saveData.stats);
  else ctx.statsService.beginSession();
  ctx.storyService.restoreCursor({
    currentStoryId: saveData.pendingStoryId,
    currentStoryDefId: saveData.pendingStoryDefId ?? null,
    currentStoryPageIndex: saveData.pendingStoryPageIndex,
    currentStoryChoiceIndex: saveData.pendingStoryChoiceIndex ?? -1,
    talkletClickWork: saveData.pendingTalkletClicks ? { ...saveData.pendingTalkletClicks } : null,
    insertStack: saveData.pendingInsertStack ? saveData.pendingInsertStack.map(s => ({ ...s })) : [],
    visitedStoryIds: saveData.pendingVisitedStoryIds ? [...saveData.pendingVisitedStoryIds] : [],
    isReplay: saveData.pendingIsReplay ?? false,
  });
  ctx.storyService.restoreChatCursors(saveData.chatCursors);
  ctx.sessionService.setLastTick(saveData.timestamp);
  ctx.effectEngine.setState(state);
  ctx.tickSystem.setState(state);
  ctx.tagStatService.setState(state);
  ctx.affectorEngine.reconcileMounts();
  const init = ctx.registry.inits.get(state.activeInit);
  ctx.initService.logInitReachability('世界线可及性：读取存档');
  ctx.devLog.record(`读取存档：恢复世界线 ${init?.name ?? state.activeInit}`, {
    source: 'init', level: 'info',
    details: [
      `帧 ${state.totalFrames}`,
      `解锁世界线 ${state.unlockedInits.length} 个`,
      state.currentAreaId ? `当前区域 ${ctx.registry.areas.get(state.currentAreaId)?.name ?? state.currentAreaId}` : '无当前区域',
      `已启用设施 ${Object.keys(state.spotLevels).length} 处`,
    ].join(' · '),
  });
}
