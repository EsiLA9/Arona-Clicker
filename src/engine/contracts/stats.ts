import type { AreaId, InitId, StoryId } from '../types/ids';

export type ResourceAmounts = Record<string, number>;
export interface StatCounters {
  produced: ResourceAmounts;
  consumed: ResourceAmounts;
  itemsCollected: Record<string, number>;
  itemsUsed: Record<string, number>;
  spotsUnlocked: number;
  spotsUpgraded: number;
  storiesCompleted: number;
  enhancementsUnlocked: number;
  initsUnlocked: number;
  framesActive: number;
}
export interface InitStatCounters extends StatCounters { framesInInit: number; }
export interface SessionStatsSnapshot {
  startFrame: number;
  counters: StatCounters;
  currentInit: InitId | null;
  currentArea: AreaId | null;
  resources: ResourceAmounts;
  completedStoryIdsThisRun: StoryId[];
}
export type InitStatsMap = Partial<Record<InitId, InitStatCounters>>;
export interface StatsSnapshot { global: StatCounters; init: InitStatsMap; session: SessionStatsSnapshot; }
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
export interface StatsContext {
  global: StatCounters;
  currentInit: InitId | null;
  currentInitStats: InitStatCounters | null;
  session: SessionStatsSnapshot;
}

/** 统计消费者（Condition / Runtime / UI）所需的只读查询端口。 */
export interface StatsQueryContext {
  getSnapshot(): StatsSnapshot;
  getContext(): StatsContext;
  evaluate(dsl: string): number | null;
  hasCompletedStoryThisRun(storyId: StoryId): boolean;
}
