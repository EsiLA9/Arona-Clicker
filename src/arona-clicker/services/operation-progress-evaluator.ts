import type {
  EventRun,
  OperationEventDef,
  OperationLocationResultKind,
  OperationObjectiveDef,
  OperationOutcomeConditionDef,
  OperationPredicateDef,
  OperationPredicateLeafDef,
} from '../contracts/operation';
import type { OperationLocationTacticsDef } from '../contracts/operation-action';

type EventStateView = Pick<EventRun['eventState'], 'tracks' | 'knownFactIds'>;

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
  definition: OperationLocationTacticsDef | undefined,
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

export function getCurrentLocationDefinition(event: OperationEventDef, locationId: string): OperationLocationTacticsDef | undefined {
  return event.locationTactics?.find(definition => definition.locationId === locationId);
}
