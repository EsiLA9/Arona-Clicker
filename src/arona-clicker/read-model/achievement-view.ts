import type { Registry } from '../../data-services/registry/registry';
import type { StatsSnapshot } from '../../engine/contracts/stats';
import { parseStatCall } from '../../engine/expression/stat-dsl';
import type { Condition } from '../../engine/types/expression';
import type { InitId } from '../../engine/types/ids';
import type { PlayerState } from '../types/state';

export interface AchievementProgressView {
  readonly current: number;
  readonly target: number;
  readonly comparator: '>=' | '>';
}

export interface AchievementViewItem {
  readonly id: string;
  readonly initId: string;
  readonly areaId: string;
  readonly title: string;
  readonly clue: string;
  readonly rewardDescription: string;
  readonly completed: boolean;
  readonly progress?: AchievementProgressView;
}

type AchievementRegistry = Pick<Registry, 'achievements' | 'milestoneListeners' | 'milestones' | 'areas'>;
type AchievementState = Pick<
  PlayerState,
  'activeInit' | 'currentAreaId' | 'visitedAreas' | 'initSnapshots' | 'milestoneProgress'
>;

function progressOf(
  definition: Condition,
  initId: InitId,
  stats: Pick<StatsSnapshot, 'init'>,
): AchievementProgressView | undefined {
  if (definition.target !== 'stat'
    || (definition.comparator !== '>=' && definition.comparator !== '>')
    || !Number.isFinite(definition.value)) return undefined;

  const tokens = definition.key.trim().split(/\s+/);
  if (tokens.length !== 3) return undefined;
  const query = parseStatCall(definition.key);
  if (!query || query.initId !== initId || !query.key) return undefined;

  let current: number | undefined;
  const counters = stats.init[initId];
  if (query.fn === '$InitProducedAmount') current = counters?.produced[query.key];
  else if (query.fn === '$InitCollectedAmount') current = counters?.itemsCollected[query.key];
  else return undefined;

  return {
    current: current ?? 0,
    target: definition.value,
    comparator: definition.comparator,
  };
}

export function buildAchievementView(
  registry: AchievementRegistry,
  state: AchievementState,
  stats: Pick<StatsSnapshot, 'init'>,
): readonly AchievementViewItem[] {
  const completed = new Set(state.milestoneProgress?.completed ?? []);
  const ordered: { rank: number; index: number; item: AchievementViewItem }[] = [];
  let index = 0;

  for (const achievement of registry.achievements.values()) {
    const listener = registry.milestoneListeners.get(achievement.listenerId);
    if (!listener) continue;
    const milestone = registry.milestones.get(listener.milestoneId);
    if (!milestone) continue;
    const area = registry.areas.get(listener.areaId);
    if (!area) continue;

    const visitedAreas = area.initId === state.activeInit
      ? state.visitedAreas
      : state.initSnapshots?.[area.initId]?.visitedAreas;
    if (!visitedAreas?.includes(area.id)) continue;

    const progress = 'conditions' in milestone.condition
      ? undefined
      : progressOf(milestone.condition, area.initId, stats);
    const item: AchievementViewItem = {
      id: achievement.id,
      initId: area.initId,
      areaId: area.id,
      title: achievement.title,
      clue: achievement.clue,
      rewardDescription: achievement.rewardDescription,
      completed: completed.has(milestone.id),
      ...(progress ? { progress } : {}),
    };
    ordered.push({
      rank: area.initId !== state.activeInit ? 2 : area.id === state.currentAreaId ? 0 : 1,
      index: index++,
      item,
    });
  }

  ordered.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ordered.map(entry => entry.item);
}
