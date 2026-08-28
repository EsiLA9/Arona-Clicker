// ============================================================
// engine/game/save-codec.ts — 存档序列化 / 反序列化
// 从 game-instance.ts 拆出：save 组装 / load 反序列化与恢复编排
// ============================================================

import { GLOBAL_RESOURCE_IDS, PlayerState, VisibilitySnapshot } from '../types';
import { extra } from '../extra/index';
import { Registry } from '../registry/registry';
import { DevLog } from '../core/dev-log';
import { StateMutationService } from '../system/state-mutation-service';
import { PersistedStats, StatsService } from '../stats/stats';
import { AffectorEngine } from '../effect/affector-engine';
import { TriggerSystem } from '../effect/trigger-system';
import { EffectEngine } from '../effect/effect-engine';
import { TickSystem } from '../system/tick-system';
import { TagStatService } from '../stats/tag-stats';
import { VisibilityEngine } from '../visibility/visibility-engine';
import { StoryCursor, StoryService } from './story-service';
import { InitService } from './init-service';
import { SessionService } from './session-service';

/**
 * SaveData 是持久化的存档快照
 */
export interface SaveData {
  version: string;
  timestamp: number;
  playerState: PlayerState;
  visibility: VisibilitySnapshot;
  /** Legacy field accepted on load; new saves do not persist per-Spot timers. */
  timers?: Record<string, unknown>;
  pendingStoryId: string | null;
  pendingStoryPageIndex: number;
  pendingStoryChoiceIndex?: number;
  /** 多击任务（Talklet.clickWork）的进行中进度；缺省 = 无。 */
  pendingTalkletClicks?: { total: number; done: number } | null;
  /** 当前实际播放的 Story.id（跳转链中可变；旧档无 = 回退 pendingStoryId 的初始 Story）。 */
  pendingStoryDefId?: string | null;
  /** insert 跳转返回点栈（旧档无 = 空）。 */
  pendingInsertStack?: { storyId: string; pageIndex: number }[];
  /** 本 Entry 链已访问过的 Story.id（旧档无 = 空）。 */
  pendingVisitedStoryIds?: string[];
  /** 是否处于重阅读模式（旧档无 = false）。 */
  pendingIsReplay?: boolean;
  /** 各聊天沙盒游标（key → StoryCursor）：每个角色对话空间的独立剧情游标（旧档无 = 空）。 */
  chatCursors?: Record<string, StoryCursor>;
  /** 各聊天沙盒的历史条目（key → 聊天条目数组，已按上限截断；引擎不解析内部结构，由 UI 层读写）。 */
  chatHistories?: Record<string, unknown[]>;
  /** 三层统计持久化部分（global + 各 init 聚合 + 当前游玩的 session）。 */
  stats?: PersistedStats;
}

export interface SaveBuildContext {
  state: Readonly<PlayerState>;
  visibility: () => Readonly<VisibilitySnapshot>;
  storyCursor: () => StoryCursor;
  chatCursors: () => Record<string, StoryCursor>;
  persistedStats: () => PersistedStats;
}

export function buildSaveData(ctx: SaveBuildContext): SaveData {
  const storyCursor = ctx.storyCursor();
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    playerState: JSON.parse(JSON.stringify(ctx.state)),
    visibility: JSON.parse(JSON.stringify(ctx.visibility())),
    pendingStoryId: storyCursor.currentStoryId,
    pendingStoryPageIndex: storyCursor.currentStoryPageIndex,
    pendingStoryChoiceIndex: storyCursor.currentStoryChoiceIndex,
    pendingTalkletClicks: storyCursor.talkletClickWork,
    pendingStoryDefId: storyCursor.currentStoryDefId,
    pendingInsertStack: storyCursor.insertStack,
    pendingVisitedStoryIds: storyCursor.visitedStoryIds,
    pendingIsReplay: storyCursor.isReplay,
    chatCursors: ctx.chatCursors(),
    stats: ctx.persistedStats(),
  };
}

/** 反序列化 + 旧档兼容：解析副本并补齐字段迁移 */
export function normalizePlayerState(raw: PlayerState, registry: Registry): PlayerState {
  const state = JSON.parse(JSON.stringify(raw)) as PlayerState;
  state.initSnapshots ??= {};
  // 旧档兼容：extras / initExtras 字段缺失时补空底座（三层合并视图见 docs/13 §5.3）
  state.extras ??= extra.dict({});
  state.initExtras ??= extra.dict({});
  for (const snap of Object.values(state.initSnapshots)) {
    snap.extras ??= extra.dict({});
  }
  // 旧档迁移：早期存档可能把全局资源（青辉石）存在 resources 中
  state.globalResources ??= {};
  for (const id of GLOBAL_RESOURCE_IDS) {
    const legacy = state.resources[id] ?? 0;
    if (legacy > 0) {
      state.globalResources[id] = (state.globalResources[id] ?? 0) + legacy;
      delete state.resources[id];
    }
  }
  // 旧存档兜底：无 currentAreaId 时定位到当前 Init 的第一个默认 Area
  if (!state.currentAreaId) {
    const init = registry.inits.get(state.activeInit);
    state.currentAreaId = init?.defaultAreas[0] ?? undefined;
  }
  return state;
}

export interface RestoreContext {
  registry: Registry;
  devLog: DevLog;
  mutations: StateMutationService;
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
}

/** 从存档恢复：写入状态并重同步全部子系统 */
export function restoreFromSave(ctx: RestoreContext, saveData: SaveData): void {
  const state = normalizePlayerState(saveData.playerState, ctx.registry);
  ctx.setState(state);
  ctx.mutations.setState(state);
  ctx.statsService.setState(state);
  ctx.affectorEngine.setState(state);
  ctx.triggerSystem.setState(state);
  // 恢复当前世界线的专属 Trigger（先移除之前挂载的组）
  ctx.initService.mountInitTriggers(state.activeInit);
  if (saveData.visibility) ctx.visibilityEngine.setSnapshot(saveData.visibility);
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
  // 恢复各聊天沙盒游标（各角色对话空间独立剧情游标）
  ctx.storyService.restoreChatCursors(saveData.chatCursors);
  ctx.sessionService.setLastTick(saveData.timestamp);

  // 重新同步子系统
  ctx.effectEngine.setState(state);
  ctx.tickSystem.setState(state);
  ctx.tagStatService.setState(state);
  // 存档不保存 Affector 实例：按恢复后的状态对账重挂载（flows/zoneModifiers/effects 激活沿重放）
  ctx.affectorEngine.reconcileMounts();

  const init = ctx.registry.inits.get(state.activeInit);
  ctx.initService.logInitReachability('世界线可及性：读取存档');
  ctx.devLog.record(`读取存档：恢复世界线 ${init?.name ?? state.activeInit}`, {
    source: 'init',
    level: 'info',
    details: [
      `帧 ${state.totalFrames}`,
      `解锁世界线 ${state.unlockedInits.length} 个`,
      state.currentAreaId ? `当前区域 ${ctx.registry.areas.get(state.currentAreaId)?.name ?? state.currentAreaId}` : '无当前区域',
      `已启用设施 ${Object.keys(state.spotLevels).length} 处`,
    ].join(' · '),
  });
}
