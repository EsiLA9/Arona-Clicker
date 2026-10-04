import type {
  OperationPreparationActorSnapshot,
  OperationPreparationContent,
  OperationPreparationSnapshot,
  OperationPreparedActorPlan,
  PreparedBeat,
} from '../contracts/operation-beat';
import {
  OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE,
  OPERATION_WAIT_REASON_NO_CANDIDATE_ACTION,
  OPERATION_WAIT_REASON_NO_ENABLED_ACTION,
  OPERATION_WAIT_REASON_NO_LEGAL_TARGET,
} from '../contracts/operation-beat';
import {
  OPERATION_WAIT_ACTION_ID,
  type OperationActionCandidateSnapshot,
  type OperationBoundedValueDef,
  type OperationActorInitialization,
  type OperationActorKind,
  type OperationActorDef,
} from '../contracts/operation';
import type { OperationActionDef, OperationActionCostDef } from '../contracts/operation-action';
import type { OperationStudentProfileSnapshot } from '../contracts/operation';
import { selectOperationTarget, OperationTargetSelectionError } from './operation-target-selection';

export class OperationPlanPreparationError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'OperationPlanPreparationError';
  }
}

interface CandidateAction {
  readonly action: OperationActionDef;
  readonly reasonIds: readonly string[];
}

interface PreparationIndexes {
  readonly actorsById: ReadonlyMap<string, OperationPreparationActorSnapshot>;
  readonly teamsById: ReadonlyMap<string, { readonly id: string; readonly resources: Readonly<Record<string, number>> }>;
  readonly actorDefinitionsById: ReadonlyMap<string, OperationActorDef>;
  readonly initializationsByActorId: ReadonlyMap<string, OperationActorInitialization>;
  readonly actionDefinitionsById: ReadonlyMap<string, OperationActionDef>;
}

function fail(message: string): never {
  throw new OperationPlanPreparationError([message]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function sameOrderedIds(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((id, index) => id === expected[index]);
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
  }
  return value;
}

function indexUnique<T>(values: readonly T[], idOf: (value: T) => string, label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = idOf(value);
    if (!isNonEmptyId(id)) fail(label + ' contains an invalid ID');
    if (result.has(id)) fail(label + ' contains duplicate ID: ' + id);
    result.set(id, value);
  }
  return result;
}

function validateBalanceRecord(resources: Readonly<Record<string, number>>, path: string): void {
  if (!isRecord(resources)) fail(path + ' must be a resource record');
  for (const [resourceId, amount] of Object.entries(resources)) {
    if (!isNonEmptyId(resourceId)) fail(path + ' contains an invalid resource ID');
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      fail(path + '.' + resourceId + ' must be a finite resource balance');
    }
  }
}

function validateResourceSnapshot(
  declarations: Readonly<Record<string, OperationBoundedValueDef>> | undefined,
  balances: Readonly<Record<string, number>>,
  path: string,
): void {
  validateBalanceRecord(balances, path);
  const declaredIds = Object.keys(declarations ?? {});
  const actualIds = Object.keys(balances);
  for (const resourceId of declaredIds) {
    if (!isNonEmptyId(resourceId)) fail(path + ' declarations contain an invalid resource ID');
    if (!Object.prototype.hasOwnProperty.call(balances, resourceId)) {
      fail(path + ' is missing declared resource: ' + resourceId);
    }
    const definition = declarations![resourceId];
    const balance = balances[resourceId];
    if (!Number.isFinite(definition.min) || !Number.isFinite(definition.max) || definition.min > definition.max) {
      fail(path + ' has an invalid bounds declaration for resource: ' + resourceId);
    }
    if (balance < definition.min || balance > definition.max) {
      fail(path + '.' + resourceId + ' is outside its declared bounds');
    }
  }
  for (const resourceId of actualIds) {
    if (!Object.prototype.hasOwnProperty.call(declarations ?? {}, resourceId)) {
      fail(path + ' contains undeclared resource: ' + resourceId);
    }
  }
}

interface DecimalParts {
  readonly coefficient: bigint;
  readonly scale: number;
}

function decimalParts(value: number): DecimalParts {
  const [mantissa, exponentText] = value.toString().toLowerCase().split('e');
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const negative = mantissa.startsWith('-');
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  let coefficient = BigInt(integerPart + fractionPart);
  if (negative) coefficient = -coefficient;
  let scale = fractionPart.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

function coefficientAtScale(value: DecimalParts, scale: number): bigint {
  return value.coefficient * 10n ** BigInt(scale - value.scale);
}

/** Subtracts authored decimal values without binary floating-point drift across the resource minimum. */
function subtractCostWithinMinimum(balanceParts: DecimalParts, cost: number, minimum: number): DecimalParts | undefined {
  const costParts = decimalParts(cost);
  const minimumParts = decimalParts(minimum);
  const scale = Math.max(balanceParts.scale, costParts.scale, minimumParts.scale);
  const remaining = coefficientAtScale(balanceParts, scale) - coefficientAtScale(costParts, scale);
  if (remaining < coefficientAtScale(minimumParts, scale)) return undefined;
  return { coefficient: remaining, scale };
}

function indexPreparationInputs(
  snapshot: OperationPreparationSnapshot,
  content: OperationPreparationContent,
): PreparationIndexes {
  if (!Number.isSafeInteger(snapshot.planVersion) || snapshot.planVersion < 0) {
    fail('planVersion must be a non-negative safe integer');
  }
  if (!isNonEmptyId(snapshot.eventId)) fail('eventId must be a non-empty ID');
  if (!isNonEmptyId(snapshot.currentLocationId)) fail('currentLocationId must be a non-empty Location ID');
  if (!isNonEmptyId(content.eventDefinition.id)) fail('eventDefinition.id must be non-empty');
  if (snapshot.eventId !== content.eventDefinition.id) fail('snapshot eventId does not match trusted Event definition');
  if (!content.eventDefinition.locationIds.includes(snapshot.currentLocationId)) {
    fail('currentLocationId references an undeclared Location: ' + snapshot.currentLocationId);
  }

  const actorDefinitionsById = indexUnique(content.eventDefinition.actors, actor => actor.id, 'eventDefinition.actors');
  const teamDefinitionsById = indexUnique(content.eventDefinition.teams ?? [], team => team.id, 'eventDefinition.teams');
  for (const [actorId, actorDefinition] of actorDefinitionsById) {
    if (actorDefinition.teamId !== undefined && !teamDefinitionsById.has(actorDefinition.teamId)) {
      fail('eventDefinition.actors[' + actorId + '].teamId references an undeclared Team: ' + actorDefinition.teamId);
    }
  }
  const actorsById = indexUnique(snapshot.actors, actor => actor.actorId, 'snapshot.actors');
  if (actorsById.size !== actorDefinitionsById.size) fail('snapshot.actors must contain every Event Actor exactly once');
  for (const actorId of actorDefinitionsById.keys()) {
    if (!actorsById.has(actorId)) fail('snapshot.actors is missing Event Actor: ' + actorId);
  }
  for (const [actorId, actor] of actorsById) {
    if (!['student', 'opponent', 'environment'].includes(actor.participantKind)) {
      fail('snapshot.actors[' + actorId + '].participantKind is invalid');
    }
    validateResourceSnapshot(
      actorDefinitionsById.get(actorId)!.resources,
      actor.resources,
      'snapshot.actors[' + actorId + '].resources',
    );
  }

  const teamsById = indexUnique(snapshot.teams, team => team.id, 'snapshot.teams');
  if (teamsById.size !== teamDefinitionsById.size) fail('snapshot.teams must contain every declared Team exactly once');
  for (const [teamId] of teamDefinitionsById) {
    if (!teamsById.has(teamId)) fail('snapshot.teams is missing declared Team: ' + teamId);
  }
  for (const [teamId, team] of teamsById) {
    validateResourceSnapshot(
      teamDefinitionsById.get(teamId)!.resources,
      team.resources,
      'snapshot.teams[' + teamId + '].resources',
    );
  }

  const initializationsByActorId = indexUnique(content.actors, actor => actor.actorId, 'content.actors');
  if (initializationsByActorId.size !== actorDefinitionsById.size) {
    fail('content.actors must contain every Event Actor exactly once');
  }
  for (const actorId of actorDefinitionsById.keys()) {
    if (!initializationsByActorId.has(actorId)) fail('content.actors is missing Event Actor: ' + actorId);
    const actor = actorsById.get(actorId)!;
    const initialization = initializationsByActorId.get(actorId)!;
    if (actor.participantKind !== initialization.participantKind) {
      fail('snapshot actor participantKind does not match trusted initialization for ' + actorId);
    }
  }

  const actionDefinitionsById = indexUnique(content.actionDefinitions, action => action.id, 'actionDefinitions');
  return {
    actorsById,
    teamsById,
    actorDefinitionsById,
    initializationsByActorId,
    actionDefinitionsById,
  };
}

function validateStudentCandidateRows(
  actorId: string,
  profile: OperationStudentProfileSnapshot,
  actionsById: ReadonlyMap<string, OperationActionDef>,
): readonly OperationActionCandidateSnapshot[] {
  const candidateIds = profile.candidateActionIds;
  if (!Array.isArray(candidateIds) || !Array.isArray(profile.actionPriorityIds)
    || !Array.isArray(profile.eligibleActionIds) || !Array.isArray(profile.capabilityIds)) {
    fail('content.actors[' + actorId + '].profile candidate lists must be arrays');
  }
  if (profile.capabilityIds.some(id => !isNonEmptyId(id))
    || new Set(profile.capabilityIds).size !== profile.capabilityIds.length) {
    fail('content.actors[' + actorId + '].profile.capabilityIds must contain unique stable IDs');
  }
  const candidateSet = new Set(candidateIds);
  if (candidateSet.size !== candidateIds.length || candidateIds.some(id => !isNonEmptyId(id))) {
    fail('content.actors[' + actorId + '].profile.candidateActionIds must contain unique stable IDs');
  }
  const priorityIds = profile.actionPriorityIds;
  if (new Set(priorityIds).size !== priorityIds.length || priorityIds.some(id => !candidateSet.has(id))) {
    fail('content.actors[' + actorId + '].profile.actionPriorityIds must be unique declared candidates');
  }
  const prioritySet = new Set(priorityIds);
  const expectedOrder = [
    ...priorityIds,
    ...candidateIds.filter(id => !prioritySet.has(id)),
  ];
  const rows = profile.actionCandidates;
  if (!Array.isArray(rows)) fail('content.actors[' + actorId + '].profile.actionCandidates must be an array');
  if (!rows.every(row => isRecord(row) && isNonEmptyId(row.actionId))) {
    fail('content.actors[' + actorId + '].profile.actionCandidates must contain Action IDs');
  }
  const rowIds = rows.map(row => row.actionId);
  if (!sameOrderedIds(rowIds, expectedOrder)) {
    fail('content.actors[' + actorId + '].profile.actionCandidates must match Profile priority and candidate order');
  }
  for (const row of rows) {
    const action = actionsById.get(row.actionId);
    if (!action) fail('student Profile references a missing Action: ' + row.actionId);
    if (!action.allowedParticipantKinds.includes('student')) {
      fail('student Profile Action does not allow student participants: ' + row.actionId);
    }
    if (!Array.isArray(row.requiredCapabilityIds)
      || !Array.isArray(row.missingCapabilityIds)
      || typeof row.eligible !== 'boolean'
      || !Array.isArray(row.reasonIds)
      || row.reasonIds.some((reasonId: unknown) => !isNonEmptyId(reasonId))) {
      fail('student Profile Action candidate is malformed: ' + row.actionId);
    }
    if (!Array.isArray(action.requiredCapabilityIds)
      || !sameOrderedIds(row.requiredCapabilityIds, action.requiredCapabilityIds)) {
      fail('student Profile Action requirements do not match Action definition: ' + row.actionId);
    }
    const expectedMissing = action.requiredCapabilityIds.filter(id => !profile.capabilityIds.includes(id));
    if (!sameOrderedIds(row.missingCapabilityIds, expectedMissing)) {
      fail('student Profile Action missing capabilities do not match Profile: ' + row.actionId);
    }
    if (row.eligible !== (expectedMissing.length === 0)) {
      fail('student Profile Action eligibility does not match required capabilities: ' + row.actionId);
    }
  }
  const expectedEligibleIds = rows.filter(row => row.eligible).map(row => row.actionId);
  if (!sameOrderedIds(profile.eligibleActionIds, expectedEligibleIds)) {
    fail('content.actors[' + actorId + '].profile.eligibleActionIds must match candidate eligibility');
  }
  if (expectedEligibleIds.length === 0) {
    if (!profile.fallback || profile.fallback.actionId !== OPERATION_WAIT_ACTION_ID
      || !Array.isArray(profile.fallback.reasonIds)) {
      fail('content.actors[' + actorId + '].profile needs a valid Wait fallback when no Action is eligible');
    }
  } else if (profile.fallback !== undefined) {
    fail('content.actors[' + actorId + '].profile must omit fallback when an Action is eligible');
  }
  return rows;
}

function candidateActionsForActor(
  actorId: string,
  participantKind: OperationActorKind,
  initialization: OperationActorInitialization,
  actionsById: ReadonlyMap<string, OperationActionDef>,
): { readonly source: 'student-profile' | 'participant'; readonly candidates: readonly CandidateAction[]; readonly staticWaitReasons?: readonly string[] } {
  if (participantKind === 'student') {
    if (initialization.participantKind !== 'student') fail('trusted initialization kind mismatch for student ' + actorId);
    const profile = initialization.profile;
    if (profile.characterId !== initialization.characterId) fail('student Profile Character mismatch for ' + actorId);
    const rows = validateStudentCandidateRows(actorId, profile, actionsById);
    const candidates = rows.filter(row => row.eligible).map(row => ({
      action: actionsById.get(row.actionId)!,
      reasonIds: unique(row.reasonIds),
    }));
    return {
      source: 'student-profile',
      candidates,
      ...(candidates.length === 0 ? { staticWaitReasons: profile.fallback?.reasonIds } : {}),
    };
  }

  if (initialization.participantKind !== participantKind) fail('trusted initialization kind mismatch for ' + actorId);
  const candidateIds = initialization.candidateActionIds;
  if (!Array.isArray(candidateIds) || candidateIds.some(id => !isNonEmptyId(id))
    || new Set(candidateIds).size !== candidateIds.length) {
    fail('content.actors[' + actorId + '].candidateActionIds must contain unique stable IDs');
  }
  const candidates = candidateIds.map(actionId => {
    const action = actionsById.get(actionId);
    if (!action) fail('content.actors[' + actorId + '].candidateActionIds references a missing Action: ' + actionId);
    if (!action.allowedParticipantKinds.includes(participantKind)) {
      fail('candidate Action does not allow ' + participantKind + ' participants: ' + actionId);
    }
    if (action.requiredCapabilityIds.length > 0) {
      fail('candidate Action requires student capabilities unavailable to ' + participantKind + ' participants: ' + actionId);
    }
    return { action, reasonIds: unique(action.reasonIds) };
  });
  return { source: 'participant', candidates };
}

function candidateCostBalance(
  actorId: string,
  action: OperationActionDef,
  sourceDefinition: OperationActorDef,
  content: OperationPreparationContent,
  actorBalances: ReadonlyMap<string, Map<string, DecimalParts>>,
  teamBalances: ReadonlyMap<string, Map<string, DecimalParts>>,
): { readonly cost: OperationActionCostDef | null; readonly scopeId?: string; readonly minimumBalance?: number; readonly affordable: boolean } {
  if (action.cost === undefined) return { cost: null, affordable: true };
  const cost = action.cost;
  if (!isNonEmptyId(cost.resourceId) || typeof cost.amount !== 'number' || !Number.isFinite(cost.amount) || cost.amount <= 0) {
    fail('Action ' + action.id + ' has an invalid cost');
  }
  let balance: DecimalParts | undefined;
  let scopeId: string;
  let minimumBalance: number;
  if (cost.scope === 'actor') {
    if (!Object.prototype.hasOwnProperty.call(sourceDefinition.resources ?? {}, cost.resourceId)) {
      fail('Action ' + action.id + ' cost references an undeclared Actor resource: ' + cost.resourceId);
    }
    const actorResources = actorBalances.get(actorId);
    if (!actorResources?.has(cost.resourceId)) {
      fail('snapshot.actors[' + actorId + '].resources is missing cost resource: ' + cost.resourceId);
    }
    balance = actorResources.get(cost.resourceId);
    minimumBalance = sourceDefinition.resources![cost.resourceId].min;
    scopeId = actorId;
  } else if (cost.scope === 'team') {
    const teamId = sourceDefinition.teamId;
    if (!teamId) fail('Action ' + action.id + ' team cost requires an Actor teamId');
    const teamDefinition = content.eventDefinition.teams?.find(team => team.id === teamId);
    if (!teamDefinition) fail('Action ' + action.id + ' cost references an undeclared Team: ' + teamId);
    if (!Object.prototype.hasOwnProperty.call(teamDefinition.resources ?? {}, cost.resourceId)) {
      fail('Action ' + action.id + ' cost references an undeclared Team resource: ' + cost.resourceId);
    }
    const teamResources = teamBalances.get(teamId);
    if (!teamResources?.has(cost.resourceId)) {
      fail('snapshot.teams[' + teamId + '].resources is missing cost resource: ' + cost.resourceId);
    }
    balance = teamResources.get(cost.resourceId);
    minimumBalance = teamDefinition.resources![cost.resourceId].min;
    scopeId = teamId;
  } else {
    fail('Action ' + action.id + ' cost scope must be actor or team');
  }
  return {
    cost: { scope: cost.scope, resourceId: cost.resourceId, amount: cost.amount },
    scopeId,
    minimumBalance,
    affordable: subtractCostWithinMinimum(balance!, cost.amount, minimumBalance) !== undefined,
  };
}

function reserveCost(
  actorId: string,
  cost: OperationActionCostDef | null,
  sourceDefinition: OperationActorDef,
  scopeId: string | undefined,
  minimumBalance: number | undefined,
  actorBalances: Map<string, Map<string, DecimalParts>>,
  teamBalances: Map<string, Map<string, DecimalParts>>,
): void {
  if (!cost) return;
  const balances = cost.scope === 'actor'
    ? actorBalances.get(actorId)
    : teamBalances.get(scopeId ?? sourceDefinition.teamId ?? '');
  if (!balances) fail('resource reservation scope disappeared during preparation');
  const remaining = balances.get(cost.resourceId);
  const remainingAfterCost = remaining === undefined || minimumBalance === undefined
    ? undefined
    : subtractCostWithinMinimum(remaining, cost.amount, minimumBalance);
  if (remainingAfterCost === undefined) {
    fail('resource reservation changed after affordability check');
  }
  balances.set(cost.resourceId, remainingAfterCost);
}

function waitPlan(
  actorId: string,
  participantKind: OperationActorKind,
  source: 'student-profile' | 'participant',
  reasonIds: readonly string[],
): OperationPreparedActorPlan {
  return {
    actorId,
    participantKind,
    kind: 'wait',
    source,
    actionId: OPERATION_WAIT_ACTION_ID,
    targetActorId: null,
    cost: null,
    reasonIds: unique(reasonIds),
  };
}

/** Builds a deterministic Beat plan without mutating the dynamic snapshot or trusted content. */
export function prepareOperationBeat(
  snapshot: OperationPreparationSnapshot,
  content: OperationPreparationContent,
): PreparedBeat {
  const indexes = indexPreparationInputs(snapshot, content);
  const tacticRows = (content.eventDefinition.locationTactics ?? [])
    .filter(row => row.locationId === snapshot.currentLocationId);
  if (tacticRows.length > 1) fail('locationTactics contains duplicate current Location: ' + snapshot.currentLocationId);
  const currentTactics = tacticRows[0];
  const enabledActionIds = new Set(currentTactics?.enabledActionIds ?? []);

  const actorBalances = new Map<string, Map<string, DecimalParts>>();
  for (const [actorId, actor] of indexes.actorsById) {
    actorBalances.set(actorId, new Map(Object.entries(actor.resources).map(([id, balance]) => [id, decimalParts(balance)])));
  }
  const teamBalances = new Map<string, Map<string, DecimalParts>>();
  for (const [teamId, team] of indexes.teamsById) {
    teamBalances.set(teamId, new Map(Object.entries(team.resources).map(([id, balance]) => [id, decimalParts(balance)])));
  }

  const actorPlans: OperationPreparedActorPlan[] = [];
  for (const actorDefinition of content.eventDefinition.actors) {
    const actorId = actorDefinition.id;
    const actorState = indexes.actorsById.get(actorId)!;
    const initialization = indexes.initializationsByActorId.get(actorId)!;
    const candidateSet = candidateActionsForActor(
      actorId,
      actorState.participantKind,
      initialization,
      indexes.actionDefinitionsById,
    );

    if (candidateSet.candidates.length === 0) {
      actorPlans.push(waitPlan(
        actorId,
        actorState.participantKind,
        candidateSet.source,
        candidateSet.staticWaitReasons?.length
          ? candidateSet.staticWaitReasons
          : [OPERATION_WAIT_REASON_NO_CANDIDATE_ACTION],
      ));
      continue;
    }

    const rejectedReasons = new Set<string>();
    let selectedPlan: OperationPreparedActorPlan | undefined;
    for (const candidate of candidateSet.candidates) {
      const action = candidate.action;
      if (!enabledActionIds.has(action.id)) {
        rejectedReasons.add(OPERATION_WAIT_REASON_NO_ENABLED_ACTION);
        continue;
      }

      let targetActorId: string | null;
      try {
        const target = selectOperationTarget(content.eventDefinition, actorId, action.target);
        if (target.kind === 'unavailable') {
          rejectedReasons.add(target.reasonId);
          continue;
        }
        targetActorId = target.kind === 'actor' ? target.targetActorId : null;
      } catch (error) {
        const detail = error instanceof OperationTargetSelectionError
          ? error.diagnostics.join('; ')
          : error instanceof Error ? error.message : 'unknown target selection error';
        fail('Action ' + action.id + ' target selection failed for Actor ' + actorId + ': ' + detail);
      }

      const affordability = candidateCostBalance(
        actorId,
        action,
        actorDefinition,
        content,
        actorBalances,
        teamBalances,
      );
      if (!affordability.affordable) {
        rejectedReasons.add(OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE);
        continue;
      }

      reserveCost(
        actorId,
        affordability.cost,
        actorDefinition,
        affordability.scopeId,
        affordability.minimumBalance,
        actorBalances,
        teamBalances,
      );
      selectedPlan = {
        actorId,
        participantKind: actorState.participantKind,
        kind: actorState.participantKind === 'student' ? 'studentAction' : 'intent',
        source: candidateSet.source,
        actionId: action.id,
        targetActorId,
        cost: affordability.cost,
        reasonIds: unique(candidate.reasonIds),
      };
      break;
    }

    if (selectedPlan) {
      actorPlans.push(selectedPlan);
    } else if (rejectedReasons.size > 0) {
      actorPlans.push(waitPlan(actorId, actorState.participantKind, candidateSet.source, [...rejectedReasons]));
    } else {
      actorPlans.push(waitPlan(actorId, actorState.participantKind, candidateSet.source, [OPERATION_WAIT_REASON_NO_CANDIDATE_ACTION]));
    }
  }

  return freezeTree({
    planVersion: snapshot.planVersion,
    locationId: snapshot.currentLocationId,
    actorPlans,
  });
}
