import type { MilestoneDef } from '../../data-services/contracts/datapack';
import type { Registry } from '../../data-services/registry/registry';
import type { Condition, ConditionGroup } from '../../engine/types/expression';
import { isGlobalResource } from '../types/ids';
import type { PlayerState } from '../types/state';

export type MilestoneWakeSource =
  | { kind: 'resource'; resourceId: string }
  | { kind: 'spotLevel'; spotId: string }
  | { kind: 'story'; storyId: string };

export interface DesiredMilestoneWatch {
  milestoneId: string;
  condition: Condition | ConditionGroup;
  sources: readonly MilestoneWakeSource[];
}

function leaves(expr: Condition | ConditionGroup): Condition[] {
  return 'conditions' in expr ? expr.conditions.flatMap(child => leaves(child)) : [expr];
}

function sourceOf(condition: Condition): MilestoneWakeSource | null | undefined {
  switch (condition.target) {
    case 'alwaysTrue': return null;
    case 'resource': return isGlobalResource(condition.key) ? undefined : { kind: 'resource', resourceId: condition.key };
    case 'spotLevel': return { kind: 'spotLevel', spotId: condition.key };
    case 'hasReadStory':
    case 'hasReadStoryInRun': return { kind: 'story', storyId: condition.key };
    default: return undefined;
  }
}

function sourcesOf(condition: Condition | ConditionGroup): readonly MilestoneWakeSource[] | undefined {
  const sources = new Map<string, MilestoneWakeSource>();
  for (const leaf of leaves(condition)) {
    const source = sourceOf(leaf);
    if (source === undefined) return undefined;
    if (source !== null) sources.set(JSON.stringify(source), source);
  }
  return [...sources.values()];
}

export function deriveDesiredMilestoneWatches(
  registry: Pick<Registry, 'milestones'>,
  state: Pick<PlayerState, 'milestoneProgress'>,
): DesiredMilestoneWatch[] {
  const completed = new Set(state.milestoneProgress?.completed ?? []);
  const watches: DesiredMilestoneWatch[] = [];
  for (const definition of registry.milestones?.values() ?? []) {
    if (completed.has(definition.id)) continue;
    const sources = sourcesOf(definition.condition);
    if (sources) watches.push({ milestoneId: definition.id, condition: definition.condition, sources });
  }
  return watches;
}
