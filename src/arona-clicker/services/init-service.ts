// ============================================================
// arona-clicker/services/init-service.ts — 世界线生命周期 / 区域移动 / 重启
//
// 从 GameInstance 拆出：进入世界线、区域可达性移动、进入条目、
// 世界线专属 Trigger 挂载、购买/解锁世界线、三种重启、per-Init
// 快照的保存/恢复/清除。GameInstance 以门面形式委托本服务。
// ============================================================

import type {
  AreaId,
} from '../../engine/types';
import type { EntryEffectDef, InitPurchaseResult } from '../../data-services/contracts/world';
import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { PlayerState } from '../types/state';
import type { TravelResult } from '../contracts/results';
import { Registry } from '../../data-services/registry/registry';
import { EventBus } from '../../engine/core/event-bus';
import { ConditionSystem } from '../../engine/expression/condition-system';
import { EffectEngine } from '../../engine/effect/effect-engine';
import type { InitMutationPort } from '../contracts/mutation';
import { StatsService } from '../../engine/stats/stats';
import { AffectorEngine } from '../../engine/effect/affector-engine';
import { TriggerSystem } from '../../engine/effect/trigger-system';
import { VisibilityEngine } from '../../engine/visibility/visibility-engine';
import { DevLog } from '../../engine/core/dev-log';
import { StoryService } from './story-service';
import { InitSavepoint } from '../state/init-savepoint';
import { globalSpotEntries } from '../state/snapshot';
import { extra, mergeExtra } from '../../engine/extra/index';
import { mountInitTriggers, unmountInitTriggers, type InitTriggerGroupState } from './init-mount';

export interface InitServiceOptions {
  registry: Registry;
  conditionSystem: ConditionSystem;
  effectEngine: EffectEngine;
  mutations: InitMutationPort;
  statsService: StatsService;
  eventBus: EventBus;
  devLog: DevLog;
  storyService: StoryService;
  triggerSystem: TriggerSystem;
  affectorEngine: AffectorEngine;
  visibilityEngine: VisibilityEngine;
  /** 读取当前 PlayerState。 */
  getState: () => PlayerState;
  getVisibility: () => VisibilitySnapshot;
  /** 整体替换当前 PlayerState（New Game / load / reset 等重建时使用）。 */
  setState: (next: PlayerState) => void;
  /** 通知可见性引擎重置（引擎以 EventBus 事件驱动增量更新）。 */
  resetVisibility: () => void;
  /** 通知可见性引擎清空本地 spots/areas（世界线切换）。 */
  clearLocalVisibility: () => void;
  /** 用当前 state 重算可见性并落盘。 */
  refreshVisibility: () => void;
  /** 停止 tick 循环。 */
  stop: () => void;
  /** 生成一份新的默认 PlayerState。 */
  createDefaultState: () => PlayerState;
  /** 刷新 lastTickTimestamp（离线上限计时基准）。 */
  touchTickTimestamp: () => void;
}

export class InitService {
  /** 当前已挂载的世界线 Trigger 分组状态（init:<initId>；null = 未挂载）。 */
  private readonly initTriggerGroup: InitTriggerGroupState = { group: null };
  /** per-Init 快照操作（保存/恢复/清除/播种）。 */
  private readonly savepoint: InitSavepoint;

  constructor(private readonly opts: InitServiceOptions) {
    this.savepoint = new InitSavepoint(opts.registry, opts.getState);
  }

  private get state(): PlayerState {
    return this.opts.getState();
  }

  // --- 公开 API（GameInstance 门面委托） ---

  /** 读取资源持有量：全局资源 + 当前世界线局部资源（局部优先覆盖同名）。 */
  getResourceAmount(resourceId: string): number {
    return ((this.state.globalResources ?? {})[resourceId] ?? 0) + (this.state.resources[resourceId] ?? 0);
  }

  unlockInit(initId: string): void {
    if (this.state.unlockedInits.includes(initId)) return;
    this.opts.mutations.unlockInit(initId);
  }

  /**
   * 进入一个 Init：清理非本世界线 Spot，定位默认 Area，解锁默认 Spot，
   * 自动展开起始剧情，执行进入条目，挂载世界线专属 Trigger。
   */
  enterInit(initId: string): void {
    const state = this.state;
    const init = this.opts.registry.inits.get(initId);
    if (!init) {
      this.opts.devLog.record(`进入世界线失败：${initId}`, { source: 'init', level: 'error', details: 'NotFound' });
      return;
    }

    // 世界线隔离：清理不属于当前 Init 的 Spot 持有状态与 Manager。
    // global Spot（SpotDef.global=true）是跨世界线共享设施，等级/管理角色不随世界线隔离。
    const ownedInThisInit = new Set(this.opts.registry.spotsOfInit(initId));
    for (const spotId of Object.keys(state.spotLevels)) {
      if (ownedInThisInit.has(spotId)) continue;
      const spotDef = this.opts.registry.spots.get(spotId);
      if (spotDef?.global) continue;
      delete state.spotLevels[spotId];
      delete state.spotManagers[spotId];
    }

    state.activeInit = initId;
    const visitedInits = state.visitedInits ?? [];
    const isFirstEnter = !visitedInits.includes(initId);
    if (isFirstEnter) {
      state.visitedInits = [...visitedInits, initId];
    }
    this.opts.statsService.beginSession();
    this.mountInitTriggers(initId);
    this.opts.eventBus.emit({ type: 'initEntered', initId });

    if (init.defaultAreas.length > 0) {
      state.currentAreaId = init.defaultAreas[0];
      const first = init.defaultAreas[0];
      const visited = state.visitedAreas ?? [];
      if (!visited.includes(first)) {
        state.visitedAreas = [...visited, first];
      }
    } else {
      state.currentAreaId = undefined;
    }
    const newlyUnlockedSpots: string[] = [];
    for (const areaId of init.defaultAreas) {
      const area = this.opts.registry.areas.get(areaId);
      if (!area) continue;
      for (const spotId of area.defaultSpots) {
        if ((state.spotLevels[spotId] ?? 0) > 0) continue;
        this.opts.mutations.setSpotLevel(spotId, 1);
        const spot = this.opts.registry.spots.get(spotId);
        newlyUnlockedSpots.push(spot?.name ?? spotId);
      }
    }

    // 自动展开起始剧情（InitStory）：进入 Init 时直接开始，无需玩家手动启动。
    // startStoryId 指向 active entry（投放位）；完结守卫按 entry.storyId（演出本体）判定。
    if (init.startStoryId) {
      const startEntry = this.opts.registry.activeStories.get(init.startStoryId);
      const completedStoryId = startEntry?.storyId ?? init.startStoryId;
      if (!this.opts.storyService.hasCompletedStory(completedStoryId)) {
        this.opts.storyService.startStory(init.startStoryId, 'active');
      }
    }

    this.applyEntryEffects(init.enterEffects, isFirstEnter);

    // 初始状态/切换世界线不经事件路径（itemCollected 等）：按当前状态对账重挂载 Affector
    this.opts.affectorEngine.reconcileMounts();

    this.opts.refreshVisibility();
    this.opts.devLog.record(`进入 ${init.name}：解锁内容`, {
      source: 'init',
      level: 'info',
      details: [
        `定位 ${init.defaultAreas.length} 个起始区域`,
        newlyUnlockedSpots.length > 0 ? `新解锁设施：${newlyUnlockedSpots.join('、')}` : '无新解锁设施',
        init.startStoryId ? '自动展开起始剧情' : undefined,
        isFirstEnter ? '首次进入' : undefined,
        init.enterEffects ? `进入条目 ${init.enterEffects.length} 项` : undefined,
      ].filter(Boolean).join(' · '),
    });
  }

  /**
   * 执行进入条目：按声明顺序逐个评估 first / condition，满足则应用其 effects。
   */
  private applyEntryEffects(defs: EntryEffectDef[] | undefined, isFirstEnter: boolean): void {
    if (!defs) return;
    for (const def of defs) {
      if (def.first && !isFirstEnter) continue;
      if (def.condition && !this.opts.conditionSystem.evaluateExpr(def.condition, this.state)) continue;
      this.opts.effectEngine.applyEffects(def.effects);
    }
  }

  /**
   * 在当前世界线内移动到 Area（玩家入口）——可达性层。
   * 门槛链：存在 → 同 Init → 非演出锁定 → 相邻 → 可见。
   * 非 passive 剧情演出进行中时禁止移动；Story 自身要求移动（travelToArea effect）视 allowDuringStory 放行。
   * checkAdjacency=false：Story 移动不判断拓扑（仍校验同 Init），用于 Talklet 触发跨区移动。
   */
  travelToArea(areaId: AreaId, allowDuringStory = false, checkAdjacency = true): TravelResult {
    const state = this.state;
    const area = this.opts.registry.areas.get(areaId);
    if (!area) {
      this.opts.devLog.record(`移动失败：${areaId}`, { source: 'area', level: 'error', details: 'NotFound' });
      return { success: false, areaId, error: 'NotFound' };
    }
    if (area.initId !== state.activeInit) {
      this.opts.devLog.record(`移动失败：${area.name} 不属于当前世界线`, { source: 'area', level: 'warning', details: 'NotInThisInit' });
      return { success: false, areaId, error: 'NotInThisInit' };
    }

    if (!allowDuringStory && this.opts.storyService.isBlockingMovement()) {
      this.opts.devLog.record(`移动失败：${area.name} 剧情演出中禁止移动`, {
        source: 'area',
        level: 'warning',
        details: 'StoryBlocked',
      });
      return { success: false, areaId, error: 'StoryBlocked' };
    }

    const fromAreaId = state.currentAreaId ?? null;
    if (fromAreaId === areaId) {
      return { success: false, areaId, error: 'AlreadyThere' };
    }
    if (checkAdjacency && fromAreaId !== null) {
      const fromArea = this.opts.registry.areas.get(fromAreaId);
      const adjacent = fromArea?.adjacentAreaIds ?? [];
      if (!adjacent.includes(areaId)) {
        this.opts.devLog.record(`移动失败：${area.name} 与当前位置不相邻`, { source: 'area', level: 'warning', details: 'NotAdjacent' });
        return { success: false, areaId, error: 'NotAdjacent' };
      }
    }
    if (!this.opts.visibilityEngine.isAreaVisible(areaId, state)) {
      this.opts.devLog.record(`移动失败：${area.name} 尚未开放`, { source: 'area', level: 'warning', details: 'Locked' });
      return { success: false, areaId, error: 'Locked' };
    }

    this.opts.storyService.clearPassiveIfPlaying();

    state.currentAreaId = areaId;
    const visitedAreas = state.visitedAreas ?? [];
    const isFirstEnter = !visitedAreas.includes(areaId);
    if (!visitedAreas.includes(areaId)) {
      state.visitedAreas = [...visitedAreas, areaId];
    }
    for (const spotId of area.defaultSpots ?? []) {
      if ((state.spotLevels[spotId] ?? 0) > 0) continue;
      this.opts.mutations.setSpotLevel(spotId, 1);
    }
    this.opts.statsService.recordAreaEntered(areaId);
    this.opts.eventBus.emit({ type: 'areaEntered', areaId, fromAreaId });
    this.applyEntryEffects(area.enterEffects, isFirstEnter);
    this.opts.refreshVisibility();
    this.opts.affectorEngine.recheckAll();
    this.opts.devLog.record(`已移动到 ${area.name}`, { source: 'area', level: 'success' });
    return { success: true, areaId, fromAreaId };
  }

  purchaseInit(initId: string): InitPurchaseResult {
    const init = this.opts.registry.inits.get(initId);
    if (!init) return { success: false, initId, error: 'NotFound' };

    if (this.state.unlockedInits.includes(initId)) return { success: true, initId };

    const cost = init.purchaseCost ?? [];
    if (cost.length === 0) {
      this.unlockInit(initId);
      return { success: true, initId };
    }

    for (const c of cost) {
      if (this.getResourceAmount(c.resourceId) < c.amount) {
        return { success: false, initId, error: 'InsufficientResource' };
      }
    }

    for (const c of cost) {
      this.opts.mutations.changeResource(c.resourceId, -c.amount);
    }
    this.unlockInit(initId);

    this.opts.devLog.record(`已解锁世界线：${init.name}`, {
      source: 'init',
      level: 'success',
      details: cost.map(c => `-${c.amount} ${c.resourceId}`).join('、'),
    });
    return { success: true, initId };
  }

  /** 开启新游戏并进入指定世界线，返回是否成功。 */
  startNewGame(initId: string): boolean {
    const state = this.state;
    const init = this.opts.registry.inits.get(initId);
    if (!init) return false;

    const cost = init.purchaseCost ?? [];
    const isFree = cost.length === 0;
    if (!isFree && !state.unlockedInits.includes(initId)) {
      this.opts.devLog.record(`无法开始世界线：${init.name}（尚未购买）`, {
        source: 'init',
        level: 'warning',
        details: cost.map(c => `${c.amount} ${c.resourceId}`).join('、'),
      });
      return false;
    }

    this.opts.stop();
    const savedUnlockedInits = [...state.unlockedInits];
    const savedGlobalResources = { ...(state.globalResources ?? {}) };
    const savedGlobalSpotLevels = globalSpotEntries(this.opts.registry, state.spotLevels);
    const savedGlobalSpotManagers = globalSpotEntries(this.opts.registry, state.spotManagers);
    const next = this.opts.createDefaultState();
    next.unlockedInits = savedUnlockedInits;
    next.globalResources = savedGlobalResources;
    next.spotLevels = savedGlobalSpotLevels;
    next.spotManagers = savedGlobalSpotManagers;
    next.extras = mergeExtra(extra.dict({}), this.opts.registry.extras);
    next.initExtras = mergeExtra(extra.dict({}), init.extra ?? extra.dict({}));
    this.opts.setState(next);

    this.opts.touchTickTimestamp();
    this.opts.mutations.setState(next);
    this.opts.statsService.setState(next);
    this.opts.statsService.reset();
    this.opts.affectorEngine.setState(next);
    this.opts.triggerSystem.setState(next);
    this.opts.resetVisibility();
    this.opts.storyService.clearCurrentStory();
    this.opts.devLog.clear();

    if (isFree) this.unlockInit(initId);
    this.enterInit(initId);
    this.logInitReachability('世界线可及性：新建世界');
    this.opts.devLog.record(`新的开始：${init.name}`, { source: 'init', level: 'success' });
    return true;
  }

  /** 软重启：保存全量快照并清除当前 Run 的 per-Init 状态。 */
  restartInit(): void {
    const initId = this.state.activeInit;
    if (initId) this.savepoint.save(initId);

    this.opts.stop();
    this.savepoint.clear();
    this.resetPerInitSubsystems();

    this.opts.devLog.record('当前游戏已结束，等待重新选择世界线', { source: 'runtime', level: 'warning' });
  }

  resumeInit(initId: string): boolean {
    const init = this.opts.registry.inits.get(initId);
    if (!init) {
      this.opts.devLog.record(`恢复世界线失败：${initId}`, { source: 'init', level: 'error', details: 'NotFound' });
      return false;
    }

    const snapshots = this.state.initSnapshots ?? {};
    const snapshot = snapshots[initId];

    if (snapshot) {
      this.savepoint.restore(snapshot);
      this.opts.devLog.record(`回到世界线：${init.name}（恢复进度）`, { source: 'init', level: 'success' });
    } else {
      this.savepoint.clear();
      this.savepoint.seed(init);
      this.opts.devLog.record(`进入世界线：${init.name}`, { source: 'init', level: 'success' });
    }

    this.opts.touchTickTimestamp();
    this.opts.mutations.setState(this.state);
    this.opts.statsService.setState(this.state);
    this.opts.statsService.beginSession();
    this.opts.affectorEngine.setState(this.state);
    this.opts.triggerSystem.setState(this.state);

    this.unlockInit(initId);
    this.enterInit(initId);
    this.logInitReachability('世界线可及性：切换世界');
    return true;
  }

  hardRestartInit(): void {
    const initId = this.state.activeInit;
    if (initId && this.state.initSnapshots) {
      delete this.state.initSnapshots[initId];
    }

    this.opts.stop();
    this.savepoint.clear();
    const init = initId ? this.opts.registry.inits.get(initId) : undefined;
    if (init) this.savepoint.seed(init);
    this.resetPerInitSubsystems();

    this.opts.devLog.record(
      initId
        ? `已彻底重置世界线 ${initId} 的当前 Run，下次进入为崭新状态`
        : '当前 Run 已彻底重置，等待重新选择世界线',
      { source: 'init', level: 'warning' },
    );
  }

  hardResetInit(initId: string): void {
    if (this.state.initSnapshots) delete this.state.initSnapshots[initId];
    this.opts.devLog.record(`已彻底重置世界线快照：${initId}`, { source: 'init', level: 'warning' });
  }

  // --- 世界线专属 Trigger ---

  /** @see init-mount.mountInitTriggers */
  mountInitTriggers(initId: string): void {
    mountInitTriggers(this.opts, this.initTriggerGroup, initId);
  }

  /** @see init-mount.unmountInitTriggers */
  unmountInitTriggers(): void {
    unmountInitTriggers(this.opts, this.initTriggerGroup);
  }

  // --- Init 切换辅助 ---
  /** 重置依赖 Init 局部数据的运行时子系统（不碰 PlayerState）。 */
  private resetPerInitSubsystems(): void {
    this.opts.affectorEngine.setState(this.state);
    this.opts.triggerSystem.setState(this.state);
    this.unmountInitTriggers();
    this.opts.clearLocalVisibility();
    this.opts.storyService.clearCurrentStory();
    this.opts.devLog.clear();
  }

  /** 盘点所有世界线的可及性（解锁 + 可见），用于日志审计。 */
  logInitReachability(title: string): void {
    const rows = [...this.opts.registry.inits.values()].map(init => {
      const unlocked = this.state.unlockedInits.includes(init.id);
      const visible = this.opts.getVisibility().inits[init.id] ?? false;
      return `${init.name}${unlocked ? '·已解锁' : '·未解锁'}${visible ? '' : '·不可见'}`;
    });
    this.opts.devLog.record(title, {
      source: 'init',
      level: 'info',
      details: rows.join(' | '),
    });
  }
}
