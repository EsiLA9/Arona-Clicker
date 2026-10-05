import type { OperationTargetSelection } from '../contracts/operation-beat';
import { OPERATION_WAIT_REASON_NO_LEGAL_TARGET } from '../contracts/operation-beat';
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

/** Selects one automatic target from an Event-local target relation and stable author preferences. */
export function selectOperationTarget(
  event: OperationEventDef,
  sourceActorId: string,
  target: OperationActionTargetDef,
): OperationTargetSelection {
  if (!isNonEmptyId(sourceActorId)) fail('target source must be a non-empty Event Actor ID');
  if (!target || typeof target !== 'object' || Array.isArray(target)) fail('target definition must be an object');
  const actorsById = indexActors(event);
  const source = actorsById.get(sourceActorId);
  if (!source) fail('target source references an undeclared Event Actor: ' + sourceActorId);

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
  if (target.kind === 'none') return { kind: 'none', targetActorId: null };
  if (target.kind !== 'actor') fail('target kind must be none or actor');

  let legalTargets: readonly OperationActorDef[];
  switch (target.relation) {
    case 'self':
      legalTargets = [source];
      break;
    case 'sameTeam':
      if (source.teamId !== undefined && !teamIds.has(source.teamId)) {
        fail('target source references an undeclared Team: ' + source.teamId);
      }
      legalTargets = source.teamId
        ? event.actors.filter(actor => actor.teamId !== undefined
            && actor.teamId === source.teamId
            && teamIds.has(actor.teamId))
        : [];
      break;
    case 'otherTeam':
      if (source.teamId !== undefined && !teamIds.has(source.teamId)) {
        fail('target source references an undeclared Team: ' + source.teamId);
      }
      legalTargets = source.teamId
        ? event.actors.filter(actor => actor.teamId !== undefined
            && teamIds.has(actor.teamId)
            && actor.teamId !== source.teamId)
        : [];
      break;
    case 'any':
      legalTargets = event.actors;
      break;
    default:
      fail('target relation must be self, sameTeam, otherTeam, or any');
  }

  const allowedActorIds = target.allowedActorIds === undefined ? undefined : new Set(target.allowedActorIds);
  const allowedActorTypes = target.allowedActorTypes === undefined ? undefined : new Set(target.allowedActorTypes);
  legalTargets = legalTargets.filter(actor =>
    (allowedActorIds === undefined || allowedActorIds.has(actor.id))
    && (allowedActorTypes === undefined || allowedActorTypes.has(actor.type)));

  const legalIds = new Set(legalTargets.map(actor => actor.id));
  const priorityIds = source.targetPriorityActorIds ?? [];
  if (!Array.isArray(priorityIds)) fail('targetPriorityActorIds must be an array');
  const seenPriorityIds = new Set<string>();
  for (const actorId of priorityIds) {
    if (!isNonEmptyId(actorId)) fail('targetPriorityActorIds contains an invalid actor ID');
    if (seenPriorityIds.has(actorId)) fail('targetPriorityActorIds contains duplicate actor ID: ' + actorId);
    if (!actorsById.has(actorId)) fail('targetPriorityActorIds references an undeclared Event Actor: ' + actorId);
    seenPriorityIds.add(actorId);
  }

  const orderedTargets: OperationActorDef[] = [];
  const added = new Set<string>();
  for (const actorId of priorityIds) {
    if (!legalIds.has(actorId)) continue;
    const actor = actorsById.get(actorId);
    if (actor && !added.has(actorId)) {
      added.add(actorId);
      orderedTargets.push(actor);
    }
  }
  for (const actor of event.actors) {
    if (legalIds.has(actor.id) && !added.has(actor.id)) {
      added.add(actor.id);
      orderedTargets.push(actor);
    }
  }

  const selected = orderedTargets[0];
  return selected
    ? { kind: 'actor', targetActorId: selected.id }
    : { kind: 'unavailable', targetActorId: null, reasonId: OPERATION_WAIT_REASON_NO_LEGAL_TARGET };
}
