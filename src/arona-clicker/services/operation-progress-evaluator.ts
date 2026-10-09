import type {
  EventRun,
  OperationEventDef,
  OperationLocationResultKind,
  OperationLocationProgress,
  OperationObjectiveDef,
  OperationOutcomeConditionDef,
  OperationPredicateDef,
  OperationPredicateLeafDef,
  OperationSceneDef,
} from '../contracts/operation';
import type { OperationLocationDef } from '../contracts/operation-action';

type EventStateView = Pick<EventRun['eventState'], 'tracks' | 'knownFactIds'>;

/** Stable fallback identity for Locations that have not authored an explicit Scene list. */
export const OPERATION_IMPLICIT_SCENE_ID = 'main' as const;

/** Returns explicit ordered Scene content or a detached singleton projection of the legacy Location fields. */
export function getOperationSceneDefinitions(location: OperationLocationDef): readonly OperationSceneDef[] {
  if (location.scenes !== undefined) return location.scenes;
  return [{
    id: OPERATION_IMPLICIT_SCENE_ID,
    title: '',
    enabledActionIds: location.enabledActionIds,
    ...(location.actionMode !== undefined ? { actionMode: location.actionMode } : {}),
    ...(location.sceneActions !== undefined ? { sceneActions: location.sceneActions } : {}),
    ...(location.sceneActionBatches !== undefined ? { sceneActionBatches: location.sceneActionBatches } : {}),
    ...(location.sceneActionChoice !== undefined ? { sceneActionChoice: location.sceneActionChoice } : {}),
    ...(location.purchaseOffers !== undefined ? { purchaseOffers: location.purchaseOffers } : {}),
  }];
}

/** The next Scene is derived from its ordered definitions and the Run's durable completion IDs. */
export function getNextOperationSceneId(
  location: OperationLocationDef,
  progress: OperationLocationProgress,
): string | null {
  if (progress.completed) return null;
  if (location.scenes === undefined) return OPERATION_IMPLICIT_SCENE_ID;
  const completed = new Set(progress.completedSceneIds ?? []);
  return location.scenes.find(scene => !completed.has(scene.id))?.id ?? null;
}

/** Legacy implicit Scenes keep Location completion rules; explicit sequences must finish before a Location can exit. */
export function isOperationSceneSequenceComplete(
  location: OperationLocationDef,
  progress: OperationLocationProgress,
): boolean {
  return location.scenes === undefined
    || location.scenes.every(scene => (progress.completedSceneIds ?? []).includes(scene.id));
}

function evaluateLeaf(state: EventStateView, predicate: OperationPredicateLeafDef): boolean {
  if (predicate.kind === 'knownFact') return state.knownFactIds.includes(predicate.factId) === predicate.present;
  const current = state.tracks[predicate.trackId];
  if (current === undefined) return false;
  switch (predicate.operator) {
    case 'eq': return current === predicate.value;
    case 'neq': return current !== predicate.value;
    case 'gt': return current > predicate.value;
    case 'gte': return current >= predicate.value;
    case 'lt': return current < predicate.value;
    case 'lte': return current <= predicate.value;
  }
}

export function isOperationPredicateSatisfied(state: EventStateView, predicate: OperationPredicateDef): boolean {
  if (predicate.kind === 'track' || predicate.kind === 'knownFact') return evaluateLeaf(state, predicate);
  return predicate.kind === 'all'
    ? predicate.terms.every(term => evaluateLeaf(state, term))
    : predicate.terms.some(term => evaluateLeaf(state, term));
}

export function isOperationObjectiveSatisfied(state: EventStateView, objective: OperationObjectiveDef): boolean {
  return isOperationPredicateSatisfied(state, objective.predicate);
}

export function isOperationOutcomeConditionSatisfied(
  state: EventStateView,
  condition: OperationOutcomeConditionDef,
): boolean {
  return isOperationPredicateSatisfied(state, condition.predicate);
}

export function hasOperationHardFailure(event: OperationEventDef, state: EventStateView): boolean {
  return (event.hardFailureConditions ?? []).some(condition => isOperationOutcomeConditionSatisfied(state, condition));
}

export function evaluateOperationEventOutcome(event: OperationEventDef, state: EventStateView): 'success' | 'partialSuccess' | 'failure' {
  if (hasOperationHardFailure(event, state)) return 'failure';
  const primary = (event.objectives ?? []).filter(objective => objective.kind === 'primary');
  if (primary.length > 0 && primary.every(objective => isOperationObjectiveSatisfied(state, objective))) return 'success';
  if ((event.partialOutcomes ?? []).some(condition => isOperationOutcomeConditionSatisfied(state, condition))) return 'partialSuccess';
  return 'failure';
}

export function evaluateOperationLocationOutcome(
  definition: OperationLocationDef | undefined,
  state: EventStateView,
  beatCount: number,
): OperationLocationResultKind | null {
  if (!definition) return null;
  if ((definition.failureConditions ?? []).some(condition => isOperationOutcomeConditionSatisfied(state, condition))) return 'failure';
  const primary = (definition.objectives ?? []).filter(objective => objective.kind === 'primary');
  if (primary.length > 0 && primary.every(objective => isOperationObjectiveSatisfied(state, objective))) return 'success';
  if ((definition.partialOutcomes ?? []).some(condition => isOperationOutcomeConditionSatisfied(state, condition))) return 'partialSuccess';
  if (definition.maxBeats !== undefined && beatCount >= definition.maxBeats) return 'failure';
  return null;
}

export function getCurrentLocationDefinition(event: OperationEventDef, locationId: string): OperationLocationDef | undefined {
  return event.locations.find(definition => definition.id === locationId);
}
