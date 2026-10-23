import type { GameplayMapEdgeConditionDef } from '../../../data-services/contracts/gameplay-map';
import type { MapRun } from '../../contracts/map/map-run';

/** Evaluates a read-only Edge gate against the currently installed MapRun state. */
export function isGameplayMapEdgeConditionSatisfied(
  condition: GameplayMapEdgeConditionDef,
  run: Pick<MapRun, 'teamResources' | 'mapRunFacts'>,
): boolean {
  if (condition.kind === 'teamResourceAtLeast') {
    const balance = run.teamResources.find(row => row.resourceId === condition.resourceId)?.value ?? 0;
    return balance >= condition.amount;
  }
  if (condition.kind === 'counter') {
    const value = run.mapRunFacts?.counters.find(row => row.id === condition.counterId)?.value;
    if (value === undefined) return false;
    switch (condition.comparison) {
      case 'eq': return value === condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      default: return false;
    }
  }
  const value = run.mapRunFacts?.flags.find(row => row.id === condition.flagId)?.value;
  return value !== undefined && value === condition.value;
}
