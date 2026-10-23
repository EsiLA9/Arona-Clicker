import type { MilestoneDef } from '../../../data-services/contracts/datapack';
import type { Registry } from '../../../data-services/registry/registry';
import type { Condition, ConditionGroup } from '../../../engine/types/expression';
import { parseStatCall } from '../../../engine/expression/stat-dsl';
import { isGlobalResource } from '../../types/ids';
import type { PlayerState } from '../../types/state';

export type MilestoneWakeSource =
  | { kind: 'resource'; resourceId: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'spotLevel'; spotId: string }
  | { kind: 'story'; storyId: string };

export interface DesiredMilestoneWatch {
  milestoneId: string;
  condition: Condition | ConditionGroup;
  sources: readonly MilestoneWakeSource[];
}

export interface UnsupportedMilestoneLeaf {
  target: Condition['target'];
  key: Condition['key'];
  comparator: Condition['comparator'];
}

function leaves(expr: Condition | ConditionGroup): Condition[] {
  return 'conditions' in expr ? expr.conditions.flatMap(child => leaves(child)) : [expr];
}

function statSourceOf(condition: Condition, listenerInitId?: string): MilestoneWakeSource | undefined {
  if (!listenerInitId || (condition.comparator !== '>=' && condition.comparator !== '>')
    || typeof condition.value !== 'number' || !Number.isFinite(condition.value)) return undefined;

  const tokens = condition.key.trim().split(/\s+/);
  if (tokens.length !== 3) return undefined;
  const query = parseStatCall(condition.key);
  if (!query || query.initId !== listenerInitId || !query.key) return undefined;
  if (query.fn === '$InitProducedAmount') return { kind: 'resource', resourceId: query.key };
  if (query.fn === '$InitCollectedAmount') return { kind: 'item', itemId: query.key };
  return undefined;
}

function sourceOf(condition: Condition, listenerInitId?: string): MilestoneWakeSource | null | undefined {
  switch (condition.target) {
    case 'alwaysTrue': return null;
    case 'resource': return isGlobalResource(condition.key) ? undefined : { kind: 'resource', resourceId: condition.key };
    case 'spotLevel': return { kind: 'spotLevel', spotId: condition.key };
    case 'hasReadStory':
    case 'hasReadStoryInRun': return { kind: 'story', storyId: condition.key };
    case 'stat': return statSourceOf(condition, listenerInitId);
    default: return undefined;
  }
}

function sourcesOf(condition: Condition | ConditionGroup, listenerInitId?: string): readonly MilestoneWakeSource[] | undefined {
  const sources = new Map<string, MilestoneWakeSource>();
  for (const leaf of leaves(condition)) {
    const source = sourceOf(leaf, listenerInitId);
    if (source === undefined) return undefined;
    if (source !== null) sources.set(JSON.stringify(source), source);
  }
  return [...sources.values()];
}

export function firstUnsupportedMilestoneLeaf(
  condition: Condition | ConditionGroup,
  listenerInitId: string,
): UnsupportedMilestoneLeaf | undefined {
  const leaf = leaves(condition).find(candidate => sourceOf(candidate, listenerInitId) === undefined);
  return leaf ? { target: leaf.target, key: leaf.key, comparator: leaf.comparator } : undefined;
}

export function deriveDesiredMilestoneWatches(
  registry: Pick<Registry, 'milestones' | 'milestoneListeners' | 'areas'>,
  state: Pick<PlayerState, 'milestoneProgress' | 'activeInit' | 'visitedAreas'>,
): DesiredMilestoneWatch[] {
  const completed = new Set(state.milestoneProgress?.completed ?? []);
  const listeners = new Map(
    [...registry.milestoneListeners.values()].map(listener => [listener.milestoneId, listener]),
  );
  const watches: DesiredMilestoneWatch[] = [];
  for (const definition of registry.milestones?.values() ?? []) {
    if (completed.has(definition.id)) continue;
    const listener = listeners.get(definition.id);
    let listenerInitId: string | undefined;
    if (listener) {
      const area = registry.areas.get(listener.areaId);
      if (!area || area.initId !== state.activeInit || !state.visitedAreas?.includes(area.id)) continue;
      listenerInitId = area.initId;
    }
    const sources = sourcesOf(definition.condition, listenerInitId);
    if (sources) watches.push({ milestoneId: definition.id, condition: definition.condition, sources });
  }
  return watches;
}
