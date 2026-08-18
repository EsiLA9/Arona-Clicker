// ============================================================
// engine/stats.ts — 三层统计数据服务
//
// 三层：
//   global       贯穿 Init 的总数据（所有世界线累计）
//   init[id]     各 Init 内的总数据（另含 framesInInit 停留帧）
//   session      当前一次游玩（正在进行的 Init 从头到尾，需存档持久化）
//
// 数据流（与状态写入同步、原子）：
//   mutation 请求
//     ① 写 PlayerState（改变自身）
//     ② 同步更新本服务三层统计
//     ③ emit 事件到 EventBus（事件携带变更时点的 StatsContext）
//     ④ 感兴趣者判断条件并执行
//
// 统计查询 DSL（编辑者用）：$GlobalProducedAmount base:resource:credit 等，
// 由 stat-dsl.ts 定义受限函数库，StatsService.evaluate() 求值。
// ============================================================

import {
  PlayerState,
  StatCounters,
  InitStatCounters,
  InitId,
  AreaId,
  ItemId,
  StoryId,
  StatsSnapshot,
  StatsContext,
  InitStatsMap,
} from './types';
import { parseStatCall } from './stat-dsl';

export interface PersistedSession {
  startFrame: number;
  counters: StatCounters;
  completedStoryIdsThisRun: string[];
}

export interface PersistedStats {
  global: StatCounters;
  init: InitStatsMap;
  session: PersistedSession;
}

const bump = (map: Record<string, number> | undefined, key: string, delta: number): void => {
  if (!map) return;
  map[key] = (map[key] ?? 0) + delta;
};

export class StatsService {
  private state: PlayerState | null = null;
  private stats: StatsSnapshot;

  constructor() {
    this.stats = this.freshSnapshot();
  }

  /** 注入运行时状态引用（用于读取 activeInit / currentAreaId / resources）。 */
  setState(state: PlayerState): void {
    this.state = state;
  }

  /** 清空全部统计并开启一次新游玩（新游戏 / 重置）。 */
  reset(): void {
    this.stats = this.freshSnapshot();
  }

  /** 开启一次新的游玩（进入 Init / 新游戏 / 读档后调用）。 */
  beginSession(): void {
    const state = this.state;
    this.stats.session = {
      startFrame: state?.totalFrames ?? 0,
      counters: this.emptyCounters(),
      currentInit: state?.activeInit || null,
      currentArea: state?.currentAreaId ?? null,
      resources: state ? { ...state.resources } : {},
      completedStoryIdsThisRun: [],
    };
  }

  /** 全量快照（供 UI / 存档展示）。 */
  getSnapshot(): StatsSnapshot {
    return {
      global: this.copyCounters(this.stats.global),
      init: this.copyInitMap(this.stats.init),
      session: {
        ...this.stats.session,
        counters: this.copyCounters(this.stats.session.counters),
        resources: { ...this.stats.session.resources },
      },
    };
  }

  /** 事件上下文：变更时点的三层摘要（浅拷贝，避免持有内部引用）。 */
  getContext(): StatsContext {
    return {
      global: this.copyCounters(this.stats.global),
      currentInit: this.stats.session.currentInit,
      currentInitStats: this.currentInitStats() ? this.copyCounters(this.currentInitStats()!) : null,
      session: {
        ...this.stats.session,
        counters: this.copyCounters(this.stats.session.counters),
        resources: { ...this.stats.session.resources },
      },
    };
  }

  // --- 统计查询 DSL ---

  /** 按受限函数 DSL 求值统计值；无法解析或目标不存在返回 null。 */
  evaluate(dsl: string): number | null {
    const query = parseStatCall(dsl);
    if (!query) return null;
    const counters = this.selectCounters(query);
    if (!counters) return null;
    const value = (counters as unknown as Record<string, number | Record<string, number>>)[query.def.metric];
    if (typeof value === 'number') return value;
    if (!query.key) return null;
    return value[query.key] ?? 0;
  }

  // --- 持久化 ---

  getPersistable(): PersistedStats {
    return {
      global: this.copyCounters(this.stats.global),
      init: this.copyInitMap(this.stats.init),
      session: {
        startFrame: this.stats.session.startFrame,
        counters: this.copyCounters(this.stats.session.counters),
        completedStoryIdsThisRun: [...this.stats.session.completedStoryIdsThisRun],
      },
    };
  }

  /** 从存档恢复三层统计，并依据当前状态重建 session 定位信息。 */
  restore(persisted: PersistedStats): void {
    this.stats = this.freshSnapshot();
    this.stats.global = this.copyCounters(persisted.global);
    this.stats.init = this.copyInitMap(persisted.init);
    const state = this.state;
    this.stats.session = {
      startFrame: persisted.session?.startFrame ?? state?.totalFrames ?? 0,
      counters: persisted.session
        ? this.copyCounters(persisted.session.counters)
        : this.emptyCounters(),
      currentInit: state?.activeInit || null,
      currentArea: state?.currentAreaId ?? null,
      resources: state ? { ...state.resources } : {},
      completedStoryIdsThisRun: persisted.session?.completedStoryIdsThisRun
        ? [...persisted.session.completedStoryIdsThisRun]
        : [],
    };
  }

  // --- mutation 同步钩子（由 StateMutationService 在同点调用） ---

  recordResourceChange(resource: string, delta: number): void {
    const { global, init, run } = this.counters();
    if (delta >= 0) {
      bump(global.produced, resource, delta);
      bump(init?.produced, resource, delta);
      bump(run.produced, resource, delta);
    } else {
      bump(global.consumed, resource, -delta);
      bump(init?.consumed, resource, -delta);
      bump(run.consumed, resource, -delta);
    }
    this.stats.session.resources[resource] = this.state?.resources[resource] ?? 0;
  }

  recordItemChange(itemId: ItemId, count: number): void {
    const { global, init, run } = this.counters();
    if (count >= 0) {
      bump(global.itemsCollected, itemId, count);
      bump(init?.itemsCollected, itemId, count);
      bump(run.itemsCollected, itemId, count);
    } else {
      bump(global.itemsUsed, itemId, -count);
      bump(init?.itemsUsed, itemId, -count);
      bump(run.itemsUsed, itemId, -count);
    }
  }

  recordSpotLevel(oldLevel: number, newLevel: number): void {
    if (oldLevel <= 0 && newLevel > 0) {
      this.stats.global.spotsUnlocked++;
      this.stats.session.counters.spotsUnlocked++;
      const init = this.currentInitStats();
      if (init) init.spotsUnlocked++;
    } else if (newLevel > oldLevel) {
      this.stats.global.spotsUpgraded++;
      this.stats.session.counters.spotsUpgraded++;
      const init = this.currentInitStats();
      if (init) init.spotsUpgraded++;
    }
  }

  recordEnhancementUnlocked(): void {
    this.stats.global.enhancementsUnlocked++;
    this.stats.session.counters.enhancementsUnlocked++;
    const init = this.currentInitStats();
    if (init) init.enhancementsUnlocked++;
  }

  recordStoryCompleted(storyId: string): void {
    this.stats.global.storiesCompleted++;
    this.stats.session.counters.storiesCompleted++;
    const init = this.currentInitStats();
    if (init) init.storiesCompleted++;
    this.stats.session.completedStoryIdsThisRun.push(storyId);
  }

  hasCompletedStoryThisRun(storyId: StoryId): boolean {
    return this.stats.session.completedStoryIdsThisRun.includes(storyId);
  }

  recordInitUnlocked(): void {
    this.stats.global.initsUnlocked++;
    this.stats.session.counters.initsUnlocked++;
    const init = this.currentInitStats();
    if (init) init.initsUnlocked++;
  }

  recordInitEntered(initId: InitId): void {
    this.stats.session.currentInit = initId;
  }

  recordAreaEntered(areaId: AreaId): void {
    this.stats.session.currentArea = areaId;
  }

  recordTick(): void {
    this.stats.global.framesActive++;
    this.stats.session.counters.framesActive++;
    const init = this.currentInitStats();
    if (init) init.framesInInit++;
  }

  // --- 内部 ---

  private selectCounters(query: { def: { scope: string }; initId?: string }): StatCounters | null {
    switch (query.def.scope) {
      case 'global':
        return this.stats.global;
      case 'currentRun':
        return this.stats.session.counters;
      case 'init':
        // 未进入过的 Init 视为无统计（返回 0），不视为查询错误
        return query.initId ? (this.stats.init[query.initId as InitId] ?? this.emptyCounters()) : null;
      default:
        return null;
    }
  }

  private currentInitStats(): InitStatCounters | null {
    const initId = this.state?.activeInit;
    if (!initId) return null;
    if (!this.stats.init[initId]) this.stats.init[initId] = this.emptyInitCounters();
    return this.stats.init[initId]!;
  }

  private counters(): { global: StatCounters; init: InitStatCounters | null; run: StatCounters } {
    return { global: this.stats.global, init: this.currentInitStats(), run: this.stats.session.counters };
  }

  private freshSnapshot(): StatsSnapshot {
    return {
      global: this.emptyCounters(),
      init: {},
      session: {
        startFrame: 0,
        counters: this.emptyCounters(),
        currentInit: null,
        currentArea: null,
        resources: {},
        completedStoryIdsThisRun: [],
      },
    };
  }

  private emptyCounters(): StatCounters {
    return {
      produced: {},
      consumed: {},
      itemsCollected: {},
      itemsUsed: {},
      spotsUnlocked: 0,
      spotsUpgraded: 0,
      storiesCompleted: 0,
      enhancementsUnlocked: 0,
      initsUnlocked: 0,
      framesActive: 0,
    };
  }

  private emptyInitCounters(): InitStatCounters {
    return { ...this.emptyCounters(), framesInInit: 0 };
  }

  private copyCounters<T extends StatCounters>(c: T): T {
    return {
      ...c,
      produced: { ...c.produced },
      consumed: { ...c.consumed },
      itemsCollected: { ...c.itemsCollected },
      itemsUsed: { ...c.itemsUsed },
    };
  }

  private copyInitMap(map: InitStatsMap): InitStatsMap {
    const out: InitStatsMap = {};
    for (const [id, counters] of Object.entries(map)) {
      if (counters) out[id as InitId] = this.copyCounters(counters);
    }
    return out;
  }
}
