// ============================================================
// engine/stats-counters.ts — 三层统计：计数器纯函数（构造/复制/增长）
// 从 stats.ts 拆出的无状态工具，供 StatsService 复用并可独立测试。
// ============================================================

import { StatCounters, InitStatCounters, InitId, InitStatsMap, StatsSnapshot } from './types';

/** 安全地对计数 map 累加（map 为 undefined 时忽略）。 */
export function bump(map: Record<string, number> | undefined, key: string, delta: number): void {
  if (!map) return;
  map[key] = (map[key] ?? 0) + delta;
}

export function emptyCounters(): StatCounters {
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

export function emptyInitCounters(): InitStatCounters {
  return { ...emptyCounters(), framesInInit: 0 };
}

/** 复制计数器（嵌套 map 深拷贝，标量共享）。 */
export function copyCounters<T extends StatCounters>(c: T): T {
  return {
    ...c,
    produced: { ...c.produced },
    consumed: { ...c.consumed },
    itemsCollected: { ...c.itemsCollected },
    itemsUsed: { ...c.itemsUsed },
  };
}

export function copyInitMap(map: InitStatsMap): InitStatsMap {
  const out: InitStatsMap = {};
  for (const [id, counters] of Object.entries(map)) {
    if (counters) out[id as InitId] = copyCounters(counters);
  }
  return out;
}

/** 全新空快照（新游戏 / 重置起点）。 */
export function freshSnapshot(): StatsSnapshot {
  return {
    global: emptyCounters(),
    init: {},
    session: {
      startFrame: 0,
      counters: emptyCounters(),
      currentInit: null,
      currentArea: null,
      resources: {},
      completedStoryIdsThisRun: [],
    },
  };
}