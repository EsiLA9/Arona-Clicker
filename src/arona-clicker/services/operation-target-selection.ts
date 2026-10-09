import type { OperationTargetSelection } from '../contracts/operation-beat';
import {
  OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY,
  OPERATION_WAIT_REASON_NO_LEGAL_TARGET,
} from '../contracts/operation-beat';
import type { OperationEventDef, OperationActorDef } from '../contracts/operation';
import type { OperationActionTargetDef } from '../contracts/operation-action';

export class OperationTargetSelectionError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'OperationTargetSelectionError';
  }
}

function fail(message: string): never {
  throw new OperationTargetSelectionError([message]);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function indexActors(event: OperationEventDef): Map<string, OperationActorDef> {
  const actors = new Map<string, OperationActorDef>();
  for (const actor of event.actors) {
    if (!isNonEmptyId(actor.id)) fail('event actors contain an invalid actor ID');
    if (actors.has(actor.id)) fail('event actors contain duplicate actor ID: ' + actor.id);
    actors.set(actor.id, actor);
  }
  return actors;
}

export interface OperationTargetActorState {
  readonly hp?: number;
  readonly positionId?: string;
}

/** State values come from the current Run when available; Event declarations are only a static fallback. */
export type OperationTargetActorStates = ReadonlyMap<string, OperationTargetActorState>;

function validateEventTeams(event: OperationEventDef): Set<string> {
  const teamIds = new Set<string>();
  for (const team of event.teams ?? []) {
    if (!isNonEmptyId(team.id)) fail('event teams contain an invalid Team ID');
    if (teamIds.has(team.id)) fail('event teams contain duplicate Team ID: ' + team.id);
    teamIds.add(team.id);
  }
  for (const actor of event.actors) {
    if (actor.teamId !== undefined && !teamIds.has(actor.teamId)) {
      fail('event actor ' + actor.id + ' references an undeclared Team: ' + actor.teamId);
    }
  }
  return teamIds;
}

function validateActorTarget(target: Extract<OperationActionTargetDef, { readonly kind: 'actor' }>): void {
  if (!['self', 'sameTeam', 'otherTeam', 'any'].includes(String(target.relation))) {
    fail('target relation must be self, sameTeam, otherTeam, or any');
  }
  if (target.selectionMode !== undefined && target.selectionMode !== 'select' && target.selectionMode !== 'all-eligible') {
    fail('target selectionMode must be select or all-eligible');
  }
  for (const [field, values] of [
    ['allowedActorIds', target.allowedActorIds],
    ['allowedActorTypes', target.allowedActorTypes],
    ['allowedPositionIds', target.allowedPositionIds],
  ] as const) {
    if (values !== undefined && (!Array.isArray(values) || values.some(value => !isNonEmptyId(value)))) {
      fail('target ' + field + ' must contain non-empty strings');
    }
  }
}

/**
 * Returns the current legal Actor candidates in stable author-priority / Event order.
 * Relation, ID, type and position restrictions always intersect. A supplied state map is
 * authoritative for life/position; missing Actor states are never treated as alive.
 */
export function getOperationTargetActorIds(
  event: OperationEventDef,
  sourceActorId: string | null,
  target: OperationActionTargetDef,
  actorStates?: OperationTargetActorStates,
): readonly string[] {
  if (!target || typeof target !== 'object' || Array.isArray(target)) fail('target definition must be an object');
  const actorsById = indexActors(event);
  const teamIds = validateEventTeams(event);
  if (target.kind === 'none') return [];
  if (target.kind !== 'actor') fail('target kind must be none or actor');
  validateActorTarget(target);

  const source = sourceActorId === null ? undefined : actorsById.get(sourceActorId);
  if (sourceActorId !== null && !isNonEmptyId(sourceActorId)) fail('target source must be a non-empty Event Actor ID');
  if (sourceActorId !== null && !source) fail('target source references an undeclared Event Actor: ' + sourceActorId);
  if (source && source.teamId !== undefined && !teamIds.has(source.teamId)) {
    fail('target source references an undeclared Team: ' + source.teamId);
  }

  // Actorless Scene use has no relation source; keep its existing explicit ID/type bound.
  if (!source && !target.allowedActorIds?.length && !target.allowedActorTypes?.length) return [];

  const relatedIds = new Set<string>();
  if (!source) {
    event.actors.forEach(actor => relatedIds.add(actor.id));
  } else {
    switch (target.relation) {
      case 'self': relatedIds.add(source.id); break;
      case 'sameTeam':
        if (source.teamId) event.actors.filter(actor => actor.teamId === source.teamId).forEach(actor => relatedIds.add(actor.id));
        break;
      case 'otherTeam':
        if (source.teamId) event.actors.filter(actor => actor.teamId !== undefined && teamIds.has(actor.teamId)
          && actor.teamId !== source.teamId).forEach(actor => relatedIds.add(actor.id));
        break;
      case 'any': event.actors.forEach(actor => relatedIds.add(actor.id)); break;
    }
  }

  const allowedActorIds = target.allowedActorIds === undefined ? undefined : new Set(target.allowedActorIds);
  const allowedActorTypes = target.allowedActorTypes === undefined ? undefined : new Set(target.allowedActorTypes);
  const allowedPositionIds = target.allowedPositionIds === undefined ? undefined : new Set(target.allowedPositionIds);
  const candidates = event.actors.filter(actor => {
    if (!relatedIds.has(actor.id)
      || (allowedActorIds !== undefined && !allowedActorIds.has(actor.id))
      || (allowedActorTypes !== undefined && !allowedActorTypes.has(actor.type))) return false;
    const state = actorStates?.get(actor.id);
    if (actorStates && !state) return false;
    if ((state?.hp ?? actor.hp.initial) <= 0) return false;
    const positionId = actorStates ? state?.positionId : actor.positionId;
    return allowedPositionIds === undefined || (positionId !== undefined && allowedPositionIds.has(positionId));
  });

  if (!source) return candidates.map(actor => actor.id);
  const priorityIds = source.targetPriorityActorIds ?? [];
  if (!Array.isArray(priorityIds)) fail('targetPriorityActorIds must be an array');
  const candidateIds = new Set(candidates.map(actor => actor.id));
  const seenPriorityIds = new Set<string>();
  const ordered: string[] = [];
  for (const actorId of priorityIds) {
    if (!isNonEmptyId(actorId)) fail('targetPriorityActorIds contains an invalid actor ID');
    if (seenPriorityIds.has(actorId)) fail('targetPriorityActorIds contains duplicate actor ID: ' + actorId);
    if (!actorsById.has(actorId)) fail('targetPriorityActorIds references an undeclared Event Actor: ' + actorId);
    seenPriorityIds.add(actorId);
    if (candidateIds.has(actorId)) ordered.push(actorId);
  }
  for (const actor of candidates) if (!seenPriorityIds.has(actor.id)) ordered.push(actor.id);
  return ordered;
}

/** Selects one automatic combat target from an Event-local target relation and stable author preferences. */
export function selectOperationTarget(
  event: OperationEventDef,
  sourceActorId: string,
  target: OperationActionTargetDef,
  actorStates?: OperationTargetActorStates,
): OperationTargetSelection {
  if (!isNonEmptyId(sourceActorId)) fail('target source must be a non-empty Event Actor ID');
  if (!target || typeof target !== 'object' || Array.isArray(target)) fail('target definition must be an object');
  const legalTargetActorIds = getOperationTargetActorIds(event, sourceActorId, target, actorStates);
  if (target.kind === 'none') return { kind: 'none', targetActorId: null };
  if (target.kind !== 'actor') fail('target kind must be none or actor');
  // Tactical Beats expose a single targetActorId. Never silently collapse a declared group
  // into the first candidate; all-eligible is resolved only by SceneAction/Card batches.
  if (target.selectionMode === 'all-eligible') {
    return { kind: 'unavailable', targetActorId: null, reasonId: OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY };
  }
  return legalTargetActorIds[0]
    ? { kind: 'actor', targetActorId: legalTargetActorIds[0] }
    : { kind: 'unavailable', targetActorId: null, reasonId: OPERATION_WAIT_REASON_NO_LEGAL_TARGET };
}
