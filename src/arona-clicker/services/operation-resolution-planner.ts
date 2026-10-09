import type {
  OperationActionCostDef,
  OperationActionDef,
  OperationActionEffectDef,
  OperationCombinationMatch,
  OperationCombinationRuleDef,
} from '../contracts/operation-action';
import type {
  OperationActorDef,
  OperationBoundedValueDef,
  OperationEventDef,
  OperationTeamDef,
  OperationTacticalRandomState,
} from '../contracts/operation';
import type {
  OperationPreparedActorPlan,
  PreparedBeat,
  OperationPreparationContent,
  OperationPreparationSnapshot,
} from '../contracts/operation-beat';
import { getOperationTargetActorIds } from './operation-target-selection';
import type {
  OperationResolutionActorSnapshot,
  OperationResolutionBatch,
  OperationResolutionEffectSource,
  OperationResolutionMembershipChange,
  OperationResolutionNumericChange,
  OperationResolutionPayment,
  OperationResolutionPositionChange,
  OperationResolutionPlannerErrorCode,
  OperationResolutionPlannerInput,
  OperationResolutionTeamSnapshot,
  OperationResolutionValueTarget,
} from '../contracts/operation-resolution';
import type { OperationSceneActionSelection, OperationSceneCardSelection, OperationScenePurchaseSelection } from '../contracts/operation-scene-action';
import { OPERATION_WAIT_ACTION_ID } from '../contracts/operation';
import { previewOperationIntervention } from './operation-intervention-preview';
import { resolveOperationCombinations } from './operation-combination-resolver';
import { prepareOperationBeat } from './operation-plan-preparation';
import { rollOperationStudentSkills } from './operation-tactical-rng';
import { createOperationPlayerSceneCardInstances } from './operation-player-scene-deck';

interface DecimalParts {
  readonly coefficient: bigint;
  readonly scale: number;
}

interface ValueBucket {
  readonly target: OperationResolutionValueTarget;
  readonly before: number;
  readonly bounds: OperationBoundedValueDef;
  readonly contributions: { readonly amount: number; readonly source: OperationResolutionEffectSource }[];
  requestedDelta: DecimalParts;
}

interface PlannerIndexes {
  readonly actorsById: ReadonlyMap<string, OperationActorDef>;
  readonly actorStatesById: ReadonlyMap<string, OperationResolutionActorSnapshot>;
  readonly teamsById: ReadonlyMap<string, OperationTeamDef>;
  readonly teamStatesById: ReadonlyMap<string, OperationResolutionTeamSnapshot>;
  readonly tracksById: ReadonlyMap<string, OperationBoundedValueDef>;
  readonly factsById: ReadonlySet<string>;
  readonly itemsById: ReadonlySet<string>;
  readonly actionDefinitionsById: ReadonlyMap<string, OperationActionDef>;
}

type MembershipTarget = OperationResolutionMembershipChange['target'];
type PositionBucket = { readonly actorId: string; readonly before: string | null; after: string; readonly sources: OperationResolutionEffectSource[] };

export class OperationResolutionPlannerError extends Error {
  constructor(readonly code: OperationResolutionPlannerErrorCode, detail: string) {
    super(code + ': ' + detail);
    this.name = 'OperationResolutionPlannerError';
  }
}

function fail(code: OperationResolutionPlannerErrorCode, detail: string): never {
  throw new OperationResolutionPlannerError(code, detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
  }
  return value;
}

function decimalParts(value: number): DecimalParts {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('operation:resolution:invalid-snapshot', 'numeric values must be finite');
  }
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

function addDecimal(left: DecimalParts, right: DecimalParts): DecimalParts {
  const scale = Math.max(left.scale, right.scale);
  return {
    coefficient: coefficientAtScale(left, scale) + coefficientAtScale(right, scale),
    scale,
  };
}

function subtractDecimal(left: DecimalParts, right: DecimalParts): DecimalParts {
  return addDecimal(left, { coefficient: -right.coefficient, scale: right.scale });
}

function compareDecimal(left: DecimalParts, right: DecimalParts): number {
  const scale = Math.max(left.scale, right.scale);
  const a = coefficientAtScale(left, scale);
  const b = coefficientAtScale(right, scale);
  return a < b ? -1 : a > b ? 1 : 0;
}

function decimalToNumber(value: DecimalParts, label: string): number {
  const result = Number(value.coefficient.toString() + 'e-' + value.scale);
  if (!Number.isFinite(result)) fail('operation:resolution:invalid-effect', label + ' exceeds finite numeric range');
  return result;
}

function sameCost(left: OperationActionCostDef | null, right: OperationActionCostDef | null | undefined): boolean {
  if (left === null) return right === null || right === undefined;
  if (right === null || right === undefined) return false;
  return left.scope === right.scope && left.resourceId === right.resourceId && left.amount === right.amount;
}

function samePlan(left: OperationPreparedActorPlan, right: OperationPreparedActorPlan): boolean {
  return left.actorId === right.actorId
    && left.participantKind === right.participantKind
    && left.kind === right.kind
    && left.source === right.source
    && left.actionId === right.actionId
    && left.targetActorId === right.targetActorId
    && sameCost(left.cost, right.cost)
    && Array.isArray(left.reasonIds)
    && Array.isArray(right.reasonIds)
    && left.reasonIds.length === right.reasonIds.length
    && left.reasonIds.every((reasonId, index) => reasonId === right.reasonIds[index]);
}

function sameBeat(leftValue: unknown, rightValue: unknown): boolean {
  if (!isRecord(leftValue) || !isRecord(rightValue)) return false;
  const leftPlans = leftValue.actorPlans;
  const rightPlans = rightValue.actorPlans;
  if (!Array.isArray(leftPlans) || !Array.isArray(rightPlans) || leftPlans.length !== rightPlans.length) return false;
  return leftValue.planVersion === rightValue.planVersion
    && leftValue.locationId === rightValue.locationId
    && leftPlans.every((plan: unknown, index: number) => isRecord(plan)
      && isRecord(rightPlans[index])
      && samePlan(plan as unknown as OperationPreparedActorPlan, rightPlans[index] as unknown as OperationPreparedActorPlan));
}

function indexUnique<T>(
  values: readonly T[],
  idOf: (value: T) => string,
  label: string,
  code: OperationResolutionPlannerErrorCode,
): Map<string, T> {
  if (!Array.isArray(values)) fail(code, label + ' must be an array');
  const result = new Map<string, T>();
  for (const value of values) {
    if (!isRecord(value)) fail(code, label + ' contains a non-object entry');
    const entry = value as T;
    const id = idOf(entry);
    if (!isNonEmptyId(id)) fail(code, label + ' contains an invalid ID');
    if (result.has(id)) fail(code, label + ' contains duplicate ID: ' + id);
    result.set(id, entry);
  }
  return result;
}

function validateBounds(bounds: OperationBoundedValueDef, label: string): void {
  if (!bounds || !Number.isFinite(bounds.min) || !Number.isFinite(bounds.max)
    || !Number.isFinite(bounds.initial) || bounds.min > bounds.max
    || bounds.initial < bounds.min || bounds.initial > bounds.max) {
    fail('operation:resolution:invalid-content', label + ' has invalid bounded-value declarations');
  }
}

function validateBalanceRecord(value: unknown, label: string): asserts value is Readonly<Record<string, number>> {
  if (!isRecord(value)) fail('operation:resolution:invalid-snapshot', label + ' must be a resource record');
  for (const [id, amount] of Object.entries(value)) {
    if (!isNonEmptyId(id) || typeof amount !== 'number' || !Number.isFinite(amount)) {
      fail('operation:resolution:invalid-snapshot', label + ' contains an invalid ID or non-finite balance');
    }
  }
}

function validateDeclaredBalances(
  declarations: Readonly<Record<string, OperationBoundedValueDef>> | undefined,
  balances: Readonly<Record<string, number>>,
  label: string,
): void {
  const declared = declarations ?? {};
  if (!isRecord(declared)) fail('operation:resolution:invalid-content', label + ' declarations must be a resource record');
  for (const [resourceId, bounds] of Object.entries(declared)) {
    validateBounds(bounds, label + '.' + resourceId);
    if (!Object.prototype.hasOwnProperty.call(balances, resourceId)) {
      fail('operation:resolution:invalid-snapshot', label + ' is missing declared resource: ' + resourceId);
    }
    const balance = balances[resourceId];
    if (balance < bounds.min || balance > bounds.max) {
      fail('operation:resolution:invalid-snapshot', label + '.' + resourceId + ' is outside its bounds');
    }
  }
  for (const resourceId of Object.keys(balances)) {
    if (!Object.prototype.hasOwnProperty.call(declared, resourceId)) {
      fail('operation:resolution:invalid-snapshot', label + ' contains undeclared resource: ' + resourceId);
    }
  }
}

function buildIndexes(input: OperationResolutionPlannerInput): PlannerIndexes {
  const { snapshot, trustedContent } = input;
  if (!isRecord(snapshot) || !isNonEmptyId(snapshot.runId) || !isNonEmptyId(snapshot.eventId)
    || !Number.isSafeInteger(snapshot.planVersion) || snapshot.planVersion < 0
    || !isNonEmptyId(snapshot.currentLocationId)) {
    fail('operation:resolution:invalid-snapshot', 'Run, Event, plan version, and Location identifiers are required');
  }
  if (!isRecord(trustedContent)) fail('operation:resolution:invalid-content', 'trustedContent must be an object');
  const event = trustedContent.eventDefinition;
  if (!event || !isNonEmptyId(event.id) || snapshot.eventId !== event.id) {
    fail('operation:resolution:invalid-content', 'snapshot Event does not match trusted Event definitions');
  }
  if (!Array.isArray(event.locations) || !Number.isSafeInteger(event.maxLocationVisits) || event.maxLocationVisits <= 0
    || !Array.isArray(event.actors) || !Array.isArray(event.tracks)
    || !Array.isArray(event.factIds) || !Array.isArray(event.itemIds)
    || (event.teams !== undefined && !Array.isArray(event.teams))) {
    fail('operation:resolution:invalid-content', 'Event content has malformed Location, Actor, Track, Team, or item collections');
  }
  for (const location of event.locations) {
    if (!isRecord(location) || !isNonEmptyId(location.id)
      || !Array.isArray(location.enabledActionIds) || !Array.isArray(location.combinationRules)
      || !Array.isArray(location.routeEdges)) {
      fail('operation:resolution:invalid-content', 'Location definitions must contain Action, Combination, and Route arrays');
    }
  }
  if (!event.locations.some(location => location.id === snapshot.currentLocationId)) {
    fail('operation:resolution:invalid-snapshot', 'snapshot Location is not declared by the Event');
  }
  const actorsById = indexUnique(event.actors, actor => actor.id, 'Event actors', 'operation:resolution:invalid-content');
  const teamsById = indexUnique(event.teams ?? [], team => team.id, 'Event teams', 'operation:resolution:invalid-content');
  const tracksById = indexUnique(event.tracks, track => track.id, 'Event tracks', 'operation:resolution:invalid-content');
  const factsById = new Set(event.factIds);
  const itemsById = new Set(event.itemIds);
  const actorStatesById = indexUnique(snapshot.actors, actor => actor.actorId, 'snapshot actors', 'operation:resolution:invalid-snapshot');
  const teamStatesById = indexUnique(snapshot.teams, team => team.id, 'snapshot teams', 'operation:resolution:invalid-snapshot');
  if (actorsById.size !== actorStatesById.size || teamsById.size !== teamStatesById.size) {
    fail('operation:resolution:invalid-snapshot', 'snapshot Actor and Team sets must exactly match the Event');
  }

  for (const actorDefinition of event.actors) {
    if (!isNonEmptyId(actorDefinition.id)) fail('operation:resolution:invalid-content', 'Event actor ID is invalid');
    validateBounds(actorDefinition.hp, 'Actor ' + actorDefinition.id + '.hp');
    if (actorDefinition.teamId !== undefined && !teamsById.has(actorDefinition.teamId)) {
      fail('operation:resolution:invalid-content', 'Actor references an undeclared Team: ' + actorDefinition.teamId);
    }
    const state = actorStatesById.get(actorDefinition.id);
    if (!state || state.participantKind !== actorDefinition.type || !Number.isFinite(state.hp)
      || state.hp < actorDefinition.hp.min || state.hp > actorDefinition.hp.max) {
      fail('operation:resolution:invalid-snapshot', 'Actor state is missing, mismatched, or outside HP bounds: ' + actorDefinition.id);
    }
    validateBalanceRecord(state.resources, 'Actor ' + actorDefinition.id + '.resources');
    validateDeclaredBalances(actorDefinition.resources, state.resources, 'Actor ' + actorDefinition.id + '.resources');
  }
  for (const teamDefinition of event.teams ?? []) {
    if (!isNonEmptyId(teamDefinition.id)) fail('operation:resolution:invalid-content', 'Event Team ID is invalid');
    const state = teamStatesById.get(teamDefinition.id);
    if (!state) fail('operation:resolution:invalid-snapshot', 'Team state is missing: ' + teamDefinition.id);
    validateBalanceRecord(state.resources, 'Team ' + teamDefinition.id + '.resources');
    validateDeclaredBalances(teamDefinition.resources, state.resources, 'Team ' + teamDefinition.id + '.resources');
  }
  if (!isRecord(snapshot.tracks)) fail('operation:resolution:invalid-snapshot', 'tracks must be a numeric record');
  for (const [trackId, bounds] of tracksById) {
    validateBounds(bounds, 'Track ' + trackId);
    const value = snapshot.tracks[trackId];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds.min || value > bounds.max) {
      fail('operation:resolution:invalid-snapshot', 'Track value is missing or outside bounds: ' + trackId);
    }
  }
  for (const trackId of Object.keys(snapshot.tracks)) {
    if (!tracksById.has(trackId)) fail('operation:resolution:invalid-snapshot', 'snapshot contains undeclared Track: ' + trackId);
  }
  for (const [label, ids, declared] of [
    ['known facts', snapshot.knownFactIds, factsById],
    ['held items', snapshot.heldItemIds, itemsById],
  ] as const) {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) {
      fail('operation:resolution:invalid-snapshot', 'snapshot ' + label + ' must be a unique ID array');
    }
    for (const id of ids) {
      if (!isNonEmptyId(id) || !declared.has(id)) fail('operation:resolution:invalid-snapshot', 'snapshot contains undeclared ' + label + ': ' + id);
    }
  }
  const actionDefinitionsById = indexUnique(
    trustedContent.actionDefinitions,
    action => action.id,
    'Action definitions',
    'operation:resolution:invalid-content',
  );
  if (!Array.isArray(trustedContent.actorInitializations) || !Array.isArray(trustedContent.studentSkillRules)) {
    fail('operation:resolution:invalid-content', 'trusted participant and Student Skill rules must be arrays');
  }
  for (const initialization of trustedContent.actorInitializations) {
    if (!isRecord(initialization) || !isNonEmptyId(initialization.actorId)) {
      fail('operation:resolution:invalid-content', 'Actor initializations contain an invalid entry');
    }
  }
  for (const skillRule of trustedContent.studentSkillRules) {
    if (!isRecord(skillRule)) fail('operation:resolution:invalid-content', 'Student Skill rules contain a non-object entry');
  }
  return { actorsById, actorStatesById, teamsById, teamStatesById, tracksById, factsById, itemsById, actionDefinitionsById };
}

function preparationSnapshot(input: OperationResolutionPlannerInput): OperationPreparationSnapshot {
  return {
    eventId: input.snapshot.eventId,
    planVersion: input.snapshot.planVersion,
    currentLocationId: input.snapshot.currentLocationId,
    actors: input.snapshot.actors.map(actor => ({
      actorId: actor.actorId,
      participantKind: actor.participantKind,
      hp: actor.hp,
      ...(actor.positionId !== undefined ? { positionId: actor.positionId } : {}),
      resources: actor.resources,
    })),
    teams: input.snapshot.teams.map(team => ({ id: team.id, resources: team.resources })),
  };
}

function preparationContent(input: OperationResolutionPlannerInput): OperationPreparationContent {
  return {
    eventDefinition: input.trustedContent.eventDefinition,
    actors: input.trustedContent.actorInitializations,
    actionDefinitions: input.trustedContent.actionDefinitions,
  };
}

function planAndActionIndexes(
  eventActors: readonly OperationActorDef[],
  plans: readonly OperationPreparedActorPlan[],
  actions: ReadonlyMap<string, OperationActionDef>,
): Map<string, OperationActionDef> {
  if (plans.length !== eventActors.length) fail('operation:resolution:invalid-content', 'Beat must contain one plan per Event Actor');
  const selectedActions = new Map<string, OperationActionDef>();
  for (let index = 0; index < eventActors.length; index += 1) {
    const actor = eventActors[index];
    const plan = plans[index];
    if (!plan || plan.actorId !== actor.id || plan.participantKind !== actor.type) {
      fail('operation:resolution:invalid-content', 'Beat plans must follow Event Actor declaration order');
    }
    if (plan.kind === 'wait') {
      if (plan.actionId !== OPERATION_WAIT_ACTION_ID || plan.cost !== null || plan.targetActorId !== null) {
        fail('operation:resolution:invalid-content', 'Wait plans cannot pay costs or carry targets');
      }
      continue;
    }
    if (plan.kind !== 'studentAction' && plan.kind !== 'intent') {
      fail('operation:resolution:invalid-content', 'Beat contains an unknown plan kind');
    }
    if ((plan.kind === 'studentAction') !== (plan.participantKind === 'student')) {
      fail('operation:resolution:invalid-content', 'Plan kind does not match Actor participant kind: ' + actor.id);
    }
    const action = actions.get(plan.actionId);
    if (!action || !action.allowedParticipantKinds.includes(plan.participantKind)) {
      fail('operation:resolution:invalid-content', 'Plan references a missing or disallowed Action: ' + plan.actionId);
    }
    if ((action as { readonly cost?: unknown }).cost === null) {
      fail('operation:resolution:invalid-content', 'Action cost must be omitted or a valid cost object: ' + action.id);
    }
    if (!sameCost(plan.cost, action.cost)) {
      fail('operation:resolution:invalid-content', 'Prepared cost differs from trusted Action cost: ' + action.id);
    }
    if (action.target.kind === 'none' ? plan.targetActorId !== null : plan.targetActorId === null) {
      fail('operation:resolution:invalid-content', 'Prepared target does not match Action target contract: ' + action.id);
    }
    selectedActions.set(actor.id, action);
  }
  return selectedActions;
}

function resourceBounds(
  indexes: PlannerIndexes,
  cost: OperationActionCostDef,
  actorId: string,
): { readonly scopeId: string; readonly bounds: OperationBoundedValueDef; readonly before: number } {
  if (!isNonEmptyId(cost.resourceId) || !Number.isFinite(cost.amount) || cost.amount <= 0) {
    fail('operation:resolution:invalid-content', 'Action cost must name a resource and have a positive finite amount');
  }
  if (cost.scope === 'actor') {
    const actor = indexes.actorsById.get(actorId);
    const state = indexes.actorStatesById.get(actorId);
    const bounds = actor?.resources?.[cost.resourceId];
    const before = state?.resources[cost.resourceId];
    if (!actor || !state || !bounds || before === undefined) {
      fail('operation:resolution:invalid-content', 'Actor cost references an undeclared resource: ' + cost.resourceId);
    }
    return { scopeId: actorId, bounds, before };
  }
  if (cost.scope === 'team') {
    const actor = indexes.actorsById.get(actorId);
    const teamId = actor?.teamId;
    const team = teamId ? indexes.teamsById.get(teamId) : undefined;
    const state = teamId ? indexes.teamStatesById.get(teamId) : undefined;
    const bounds = team?.resources?.[cost.resourceId];
    const before = state?.resources[cost.resourceId];
    if (!teamId || !team || !state || !bounds || before === undefined) {
      fail('operation:resolution:invalid-content', 'Team cost references an undeclared resource: ' + cost.resourceId);
    }
    return { scopeId: teamId, bounds, before };
  }
  fail('operation:resolution:invalid-content', 'Action cost scope must be actor or team');
}

function preflightPayments(
  eventActors: readonly OperationActorDef[],
  plans: readonly OperationPreparedActorPlan[],
  selectedActions: ReadonlyMap<string, OperationActionDef>,
  indexes: PlannerIndexes,
): OperationResolutionPayment[] {
  const actorBalances = new Map<string, Map<string, DecimalParts>>();
  for (const [actorId, state] of indexes.actorStatesById) {
    actorBalances.set(actorId, new Map(Object.entries(state.resources).map(([id, value]) => [id, decimalParts(value)])));
  }
  const teamBalances = new Map<string, Map<string, DecimalParts>>();
  for (const [teamId, state] of indexes.teamStatesById) {
    teamBalances.set(teamId, new Map(Object.entries(state.resources).map(([id, value]) => [id, decimalParts(value)])));
  }
  const payments: OperationResolutionPayment[] = [];
  for (let index = 0; index < eventActors.length; index += 1) {
    const plan = plans[index];
    const action = selectedActions.get(plan.actorId);
    const cost = action?.cost;
    if (!cost) continue;
    const { scopeId, bounds } = resourceBounds(indexes, cost, plan.actorId);
    const balances = cost.scope === 'actor' ? actorBalances.get(plan.actorId) : teamBalances.get(scopeId);
    const balance = balances?.get(cost.resourceId);
    if (!balance) fail('operation:resolution:invalid-snapshot', 'Cost balance is missing: ' + cost.resourceId);
    const next = subtractDecimal(balance, decimalParts(cost.amount));
    if (compareDecimal(next, decimalParts(bounds.min)) < 0) {
      fail('operation:resolution:unaffordable', 'Action cost exceeds the commit-start balance for Actor ' + plan.actorId);
    }
    balances!.set(cost.resourceId, next);
    payments.push({ actorId: plan.actorId, actionId: action!.id, cost: { ...cost }, scopeId });
  }
  return payments;
}

function targetKey(target: OperationResolutionValueTarget): string {
  switch (target.kind) {
    case 'actorHp': return JSON.stringify(['actorHp', target.actorId]);
    case 'actorResource': return JSON.stringify(['actorResource', target.actorId, target.resourceId]);
    case 'teamResource': return JSON.stringify(['teamResource', target.teamId, target.resourceId]);
    case 'track': return JSON.stringify(['track', target.trackId]);
  }
}

function valueBucket(
  target: OperationResolutionValueTarget,
  indexes: PlannerIndexes,
  snapshot: OperationResolutionPlannerInput['snapshot'],
): Omit<ValueBucket, 'contributions' | 'requestedDelta'> {
  switch (target.kind) {
    case 'actorHp': {
      const definition = indexes.actorsById.get(target.actorId);
      const state = indexes.actorStatesById.get(target.actorId);
      if (!definition || !state) fail('operation:resolution:invalid-effect', 'Effect references an undeclared Actor: ' + target.actorId);
      return { target, before: state.hp, bounds: definition.hp };
    }
    case 'actorResource': {
      const definition = indexes.actorsById.get(target.actorId);
      const state = indexes.actorStatesById.get(target.actorId);
      const bounds = definition?.resources?.[target.resourceId];
      const before = state?.resources[target.resourceId];
      if (!definition || !state || !bounds || before === undefined) {
        fail('operation:resolution:invalid-effect', 'Effect references an undeclared Actor resource: ' + target.resourceId);
      }
      return { target, before, bounds };
    }
    case 'teamResource': {
      const definition = indexes.teamsById.get(target.teamId);
      const state = indexes.teamStatesById.get(target.teamId);
      const bounds = definition?.resources?.[target.resourceId];
      const before = state?.resources[target.resourceId];
      if (!definition || !state || !bounds || before === undefined) {
        fail('operation:resolution:invalid-effect', 'Effect references an undeclared Team resource: ' + target.resourceId);
      }
      return { target, before, bounds };
    }
    case 'track': {
      const bounds = indexes.tracksById.get(target.trackId);
      const before = snapshot.tracks[target.trackId];
      if (!bounds || before === undefined) fail('operation:resolution:invalid-effect', 'Effect references an undeclared Event Track: ' + target.trackId);
      return { target, before, bounds };
    }
  }
}

function addContribution(
  buckets: Map<string, ValueBucket>,
  target: OperationResolutionValueTarget,
  amount: number,
  source: OperationResolutionEffectSource,
  indexes: PlannerIndexes,
  snapshot: OperationResolutionPlannerInput['snapshot'],
): void {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    fail('operation:resolution:invalid-effect', 'Effect amount must be finite');
  }
  const key = targetKey(target);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { ...valueBucket(target, indexes, snapshot), contributions: [], requestedDelta: { coefficient: 0n, scale: 0 } };
    buckets.set(key, bucket);
  }
  bucket.contributions.push({ amount, source });
  bucket.requestedDelta = addDecimal(bucket.requestedDelta, decimalParts(amount));
}

function effectTarget(
  effect: OperationActionEffectDef,
  sourceActorId: string | null,
  targetActorId: string | null,
  indexes: PlannerIndexes,
): OperationResolutionValueTarget | null {
  if (effect.kind === 'eventFact' || effect.kind === 'heldItem') return null;
  if (effect.kind === 'actorPosition') return null;
  if (effect.kind === 'eventTrackDelta') {
    if (!isNonEmptyId(effect.trackId)) fail('operation:resolution:invalid-effect', 'Event Track effect has an invalid Track ID');
    return { kind: 'track', trackId: effect.trackId };
  }
  if (effect.kind === 'actorHpDelta' || effect.kind === 'actorResourceDelta') {
    if (effect.recipient !== 'actor' && effect.recipient !== 'target') {
      fail('operation:resolution:invalid-effect', 'Actor effect recipient must be actor or target');
    }
  }
  if (effect.kind === 'teamResourceDelta'
    && effect.recipient !== 'actorTeam' && effect.recipient !== 'targetTeam') {
    fail('operation:resolution:invalid-effect', 'Team effect recipient must be actorTeam or targetTeam');
  }
  const recipient = effect.recipient === 'actor' ? sourceActorId
    : effect.recipient === 'target' ? targetActorId : null;
  if (effect.kind === 'actorHpDelta') {
    if (!recipient) fail('operation:resolution:invalid-effect', 'Actor HP effect needs a selected target');
    return { kind: 'actorHp', actorId: recipient };
  }
  if (effect.kind === 'actorResourceDelta') {
    if (!recipient) fail('operation:resolution:invalid-effect', 'Actor resource effect needs a selected target');
    if (!isNonEmptyId(effect.resourceId)) fail('operation:resolution:invalid-effect', 'Actor resource effect has an invalid resource ID');
    return { kind: 'actorResource', actorId: recipient, resourceId: effect.resourceId };
  }
  if (effect.kind === 'teamResourceDelta') {
    const teamActorId = effect.recipient === 'actorTeam' ? sourceActorId : targetActorId;
    if (!teamActorId) fail('operation:resolution:invalid-effect', 'Team resource effect needs an actor target');
    if (!isNonEmptyId(effect.resourceId)) fail('operation:resolution:invalid-effect', 'Team resource effect has an invalid resource ID');
    const teamId = indexes.actorsById.get(teamActorId)?.teamId;
    if (!teamId) fail('operation:resolution:invalid-effect', 'Team resource effect actor has no Team: ' + teamActorId);
    return { kind: 'teamResource', teamId, resourceId: effect.resourceId };
  }
  fail('operation:resolution:invalid-effect', 'Effect kind is not supported by the tactical Runtime');
}

function addMembershipEffect(
  effect: Extract<OperationActionEffectDef, { readonly kind: 'eventFact' | 'heldItem' }>,
  changes: Map<string, OperationResolutionMembershipChange>,
  indexes: PlannerIndexes,
  snapshot: OperationResolutionPlannerInput['snapshot'],
): void {
  const target: MembershipTarget = effect.kind === 'eventFact'
    ? { kind: 'knownFact', id: effect.factId }
    : { kind: 'heldItem', id: effect.itemId };
  const declaration = effect.kind === 'eventFact' ? indexes.factsById : indexes.itemsById;
  if (!isNonEmptyId(target.id) || !declaration.has(target.id)) {
    fail('operation:resolution:invalid-effect', 'Membership effect references an undeclared ID: ' + target.id);
  }
  if (effect.kind === 'eventFact' && effect.op !== 'reveal' && effect.op !== 'forget') {
    fail('operation:resolution:invalid-effect', 'Event fact operation must be reveal or forget');
  }
  if (effect.kind === 'heldItem' && effect.op !== 'grant' && effect.op !== 'remove') {
    fail('operation:resolution:invalid-effect', 'Held item operation must be grant or remove');
  }
  const key = target.kind + ':' + target.id;
  const existing = changes.get(key);
  const startingIds = target.kind === 'knownFact' ? snapshot.knownFactIds : snapshot.heldItemIds;
  const before = existing?.before ?? startingIds.includes(target.id);
  const after = effect.kind === 'eventFact' ? effect.op === 'reveal' : effect.op === 'grant';
  changes.set(key, { target, before, after });
}

function addEffectList(
  effects: readonly OperationActionEffectDef[],
  sourceActorId: string | null,
  targetActorId: string | null,
  sourceForIndex: (effectIndex: number) => OperationResolutionEffectSource,
  buckets: Map<string, ValueBucket>,
  membershipChanges: Map<string, OperationResolutionMembershipChange>,
  positionChanges: Map<string, PositionBucket>,
  indexes: PlannerIndexes,
  snapshot: OperationResolutionPlannerInput['snapshot'],
): void {
  if (!Array.isArray(effects)) fail('operation:resolution:invalid-effect', 'Effect list must be an array');
  effects.forEach((effect, effectIndex) => {
    if (!isRecord(effect)) fail('operation:resolution:invalid-effect', 'Effect must be an object');
    const typedEffect = effect as unknown as OperationActionEffectDef;
    if (typedEffect.kind === 'eventFact' || typedEffect.kind === 'heldItem') {
      addMembershipEffect(typedEffect, membershipChanges, indexes, snapshot);
      return;
    }
    if (typedEffect.kind === 'actorPosition') {
      const actorId = typedEffect.recipient === 'actor' ? sourceActorId
        : typedEffect.recipient === 'target' ? targetActorId : null;
      if (!actorId || !isNonEmptyId(typedEffect.positionId)) {
        fail('operation:resolution:invalid-effect', 'Position effect needs a valid recipient and position ID');
      }
      const actor = indexes.actorStatesById.get(actorId);
      if (!actor) fail('operation:resolution:invalid-effect', 'Position effect references an unknown Actor: ' + actorId);
      const existing = positionChanges.get(actorId);
      if (existing) {
        existing.after = typedEffect.positionId;
        existing.sources.push(sourceForIndex(effectIndex));
      } else {
        positionChanges.set(actorId, {
          actorId,
          before: actor.positionId ?? null,
          after: typedEffect.positionId,
          sources: [sourceForIndex(effectIndex)],
        });
      }
      return;
    }
    const target = effectTarget(typedEffect, sourceActorId, targetActorId, indexes);
    if (!target || !('amount' in typedEffect)) fail('operation:resolution:invalid-effect', 'Numeric effect is malformed');
    addContribution(buckets, target, typedEffect.amount, sourceForIndex(effectIndex), indexes, snapshot);
  });
}

function validateEffectList(
  effects: readonly OperationActionEffectDef[],
  sourceActorId: string | null,
  targetActorId: string | null,
  indexes: PlannerIndexes,
  snapshot: OperationResolutionPlannerInput['snapshot'],
): void {
  if (!Array.isArray(effects)) fail('operation:resolution:invalid-effect', 'Effect list must be an array');
  for (const effect of effects) {
    if (!isRecord(effect)) fail('operation:resolution:invalid-effect', 'Effect must be an object');
    const typedEffect = effect as unknown as OperationActionEffectDef;
    if (typedEffect.kind === 'eventFact' || typedEffect.kind === 'heldItem') {
      const id = typedEffect.kind === 'eventFact' ? typedEffect.factId : typedEffect.itemId;
      const declared = typedEffect.kind === 'eventFact' ? indexes.factsById : indexes.itemsById;
      if (!isNonEmptyId(id) || !declared.has(id)) {
        fail('operation:resolution:invalid-effect', 'Membership effect references an undeclared ID: ' + id);
      }
      if (typedEffect.kind === 'eventFact' && typedEffect.op !== 'reveal' && typedEffect.op !== 'forget') {
        fail('operation:resolution:invalid-effect', 'Event fact operation must be reveal or forget');
      }
      if (typedEffect.kind === 'heldItem' && typedEffect.op !== 'grant' && typedEffect.op !== 'remove') {
        fail('operation:resolution:invalid-effect', 'Held item operation must be grant or remove');
      }
      continue;
    }
    if (typedEffect.kind === 'actorPosition') {
      const actorId = typedEffect.recipient === 'actor' ? sourceActorId
        : typedEffect.recipient === 'target' ? targetActorId : null;
      if (!actorId || !isNonEmptyId(typedEffect.positionId) || !indexes.actorStatesById.has(actorId)) {
        fail('operation:resolution:invalid-effect', 'Position effect needs a valid recipient actor and position ID');
      }
      continue;
    }
    if (typeof typedEffect.amount !== 'number' || !Number.isFinite(typedEffect.amount)) {
      fail('operation:resolution:invalid-effect', 'Effect amount must be finite');
    }
    const target = effectTarget(typedEffect, sourceActorId, targetActorId, indexes);
    if (!target) fail('operation:resolution:invalid-effect', 'Numeric effect has no numeric target');
    valueBucket(target, indexes, snapshot);
  }
}

function addPayments(
  payments: readonly OperationResolutionPayment[],
  buckets: Map<string, ValueBucket>,
  indexes: PlannerIndexes,
  snapshot: OperationResolutionPlannerInput['snapshot'],
): void {
  for (const payment of payments) {
    const target: OperationResolutionValueTarget = payment.cost.scope === 'actor'
      ? { kind: 'actorResource', actorId: payment.actorId, resourceId: payment.cost.resourceId }
      : { kind: 'teamResource', teamId: payment.scopeId, resourceId: payment.cost.resourceId };
    addContribution(buckets, target, -payment.cost.amount, {
      kind: 'payment',
      actorId: payment.actorId,
      actionId: payment.actionId,
      scopeId: payment.scopeId,
      resourceId: payment.cost.resourceId,
    }, indexes, snapshot);
  }
}

function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareTargets(
  left: OperationResolutionValueTarget,
  right: OperationResolutionValueTarget,
  indexes: PlannerIndexes,
  input: OperationResolutionPlannerInput,
): number {
  const rank = (target: OperationResolutionValueTarget): number =>
    target.kind === 'actorHp' ? 0 : target.kind === 'actorResource' ? 1 : target.kind === 'teamResource' ? 2 : 3;
  const category = rank(left) - rank(right);
  if (category !== 0) return category;
  const eventActors = input.trustedContent.eventDefinition.actors;
  const teams = input.trustedContent.eventDefinition.teams ?? [];
  const tracks = input.trustedContent.eventDefinition.tracks;
  const actorIndex = (id: string) => eventActors.findIndex(actor => actor.id === id);
  const teamIndex = (id: string) => teams.findIndex(team => team.id === id);
  const trackIndex = (id: string) => tracks.findIndex(track => track.id === id);
  if (left.kind === 'actorHp' && right.kind === 'actorHp') return actorIndex(left.actorId) - actorIndex(right.actorId);
  if (left.kind === 'actorResource' && right.kind === 'actorResource') {
    return actorIndex(left.actorId) - actorIndex(right.actorId) || compareId(left.resourceId, right.resourceId);
  }
  if (left.kind === 'teamResource' && right.kind === 'teamResource') {
    return teamIndex(left.teamId) - teamIndex(right.teamId) || compareId(left.resourceId, right.resourceId);
  }
  if (left.kind === 'track' && right.kind === 'track') return trackIndex(left.trackId) - trackIndex(right.trackId);
  return compareId(targetKey(left), targetKey(right));
}

function resolveChanges(
  buckets: ReadonlyMap<string, ValueBucket>,
  indexes: PlannerIndexes,
  input: OperationResolutionPlannerInput,
): OperationResolutionNumericChange[] {
  return [...buckets.values()]
    .sort((left, right) => compareTargets(left.target, right.target, indexes, input))
    .map(bucket => {
      const requestedDelta = decimalToNumber(bucket.requestedDelta, 'Requested aggregate delta');
      const total = addDecimal(decimalParts(bucket.before), bucket.requestedDelta);
      const minimum = decimalParts(bucket.bounds.min);
      const maximum = decimalParts(bucket.bounds.max);
      const clamped = compareDecimal(total, minimum) < 0 ? minimum
        : compareDecimal(total, maximum) > 0 ? maximum : total;
      const after = decimalToNumber(clamped, 'Clamped value');
      const delta = decimalToNumber(subtractDecimal(clamped, decimalParts(bucket.before)), 'Actual delta');
      return {
        target: bucket.target,
        before: bucket.before,
        requestedDelta,
        delta,
        after,
        contributions: bucket.contributions,
      };
    });
}

function addActionEffects(
  plans: readonly OperationPreparedActorPlan[],
  selectedActions: ReadonlyMap<string, OperationActionDef>,
  consumedActorIds: ReadonlySet<string>,
  buckets: Map<string, ValueBucket>,
  membershipChanges: Map<string, OperationResolutionMembershipChange>,
  positionChanges: Map<string, PositionBucket>,
  indexes: PlannerIndexes,
  input: OperationResolutionPlannerInput,
): void {
  for (const plan of plans) {
    if (plan.kind === 'wait' || consumedActorIds.has(plan.actorId)) continue;
    const action = selectedActions.get(plan.actorId);
    if (!action) fail('operation:resolution:invalid-content', 'Selected Action disappeared for Actor ' + plan.actorId);
    addEffectList(action.effects, plan.actorId, plan.targetActorId, effectIndex => ({
      kind: 'action', actorId: plan.actorId, actionId: action.id, effectIndex,
    }), buckets, membershipChanges, positionChanges, indexes, input.snapshot);
}
}

function addCombinationEffects(
  matches: readonly OperationCombinationMatch[],
  buckets: Map<string, ValueBucket>,
  membershipChanges: Map<string, OperationResolutionMembershipChange>,
  positionChanges: Map<string, PositionBucket>,
  indexes: PlannerIndexes,
  input: OperationResolutionPlannerInput,
): void {
  const rulesById = new Map<string, OperationCombinationRuleDef>();
  const location = input.trustedContent.eventDefinition.locations.find(row => row.id === input.snapshot.currentLocationId);
  for (const rule of location?.combinationRules ?? []) rulesById.set(rule.id, rule);
  for (const match of matches) {
    const rule = rulesById.get(match.ruleId);
    if (!rule) fail('operation:resolution:invalid-content', 'Combination match references a missing rule: ' + match.ruleId);
    addEffectList(rule.effects, match.actorAId, match.targetActorId, effectIndex => ({
      kind: 'combination', ruleId: match.ruleId, actorAId: match.actorAId, actorBId: match.actorBId, effectIndex,
    }), buckets, membershipChanges, positionChanges, indexes, input.snapshot);
}
}

function addSkillEffects(
  checks: OperationResolutionBatch['studentSkillChecks'],
  plans: readonly OperationPreparedActorPlan[],
  buckets: Map<string, ValueBucket>,
  membershipChanges: Map<string, OperationResolutionMembershipChange>,
  positionChanges: Map<string, PositionBucket>,
  indexes: PlannerIndexes,
  input: OperationResolutionPlannerInput,
): void {
  const plansByActorId = new Map(plans.map(plan => [plan.actorId, plan]));
  const rulesById = new Map(input.trustedContent.studentSkillRules.map(rule => [rule.id, rule]));
  for (const check of checks) {
    const rule = rulesById.get(check.skillRuleId);
    const plan = plansByActorId.get(check.actorId);
    if (!rule || !plan) fail('operation:resolution:invalid-content', 'Skill check references a missing rule or Actor');
    if (!rule.triggerActionIds.includes(check.actionId) || plan.kind !== 'studentAction' || plan.actionId !== check.actionId) {
      fail('operation:resolution:invalid-content', 'Skill check does not match the final student Action');
    }
    if (!check.succeeded) {
      validateEffectList(rule.effects, check.actorId, plan.targetActorId, indexes, input.snapshot);
      continue;
    }
    addEffectList(rule.effects, check.actorId, plan.targetActorId, effectIndex => ({
      kind: 'studentSkill', actorId: check.actorId, skillRuleId: check.skillRuleId,
      actionId: check.actionId, effectIndex,
    }), buckets, membershipChanges, positionChanges, indexes, input.snapshot);
}
}

function resolveMembershipChanges(
  changes: ReadonlyMap<string, OperationResolutionMembershipChange>,
): OperationResolutionMembershipChange[] {
  return [...changes.values()].filter(change => change.before !== change.after);
}

function resolvePositionChanges(changes: ReadonlyMap<string, PositionBucket>): OperationResolutionPositionChange[] {
  return [...changes.values()]
    .filter(change => change.before !== change.after)
    .map(change => ({ actorId: change.actorId, before: change.before, after: change.after, sources: change.sources.slice() }));
}

function skillRandomState(input: OperationResolutionPlannerInput): OperationTacticalRandomState {
  const value = input.snapshot.randomState;
  if (!value || !Number.isSafeInteger(value.seed) || !Number.isSafeInteger(value.tacticalCursor)
    || value.tacticalCursor < 0) {
    fail('operation:resolution:rng-failure', 'Run tactical RNG state is invalid');
  }
  return value;
}

function planSceneBatch(input: OperationResolutionPlannerInput, indexes: PlannerIndexes): OperationResolutionBatch {
  const request = input.sceneBatch;
  if (!request || !Array.isArray(request.selections)) {
    fail('operation:resolution:invalid-content', 'SceneAction batch selections must be an array');
  }
  if (request.skip !== undefined && request.skip !== true) fail('operation:resolution:invalid-content', 'SceneAction skip flag must be true when supplied');
  if (request.skip === true && (request.selections.length > 0 || (request.cards?.length ?? 0) > 0 || (request.purchases?.length ?? 0) > 0)) {
    fail('operation:resolution:invalid-content', 'Explicit skip cannot include selectable offers');
  }
  const { snapshot, trustedContent } = input;
  const event = trustedContent.eventDefinition;
  const location = event.locations.find(row => row.id === snapshot.currentLocationId);
  if (!location?.actionMode || (!Array.isArray(location.sceneActions) && !location.purchaseOffers?.length) || !Number.isSafeInteger(location.sceneActionBatches)
    || location.sceneActionBatches! <= 0) {
    fail('operation:resolution:invalid-content', 'current Location has no finite SceneAction contract');
  }
  const batchesUsed = snapshot.sceneActionBatchesUsed;
  if (!Number.isSafeInteger(batchesUsed) || batchesUsed! < 0 || batchesUsed! >= location.sceneActionBatches!) {
    fail('operation:resolution:stale-plan', 'current Location has no SceneAction batches remaining');
  }
  const playerCost = snapshot.playerCost;
  if (typeof playerCost !== 'number' || !Number.isFinite(playerCost) || playerCost < 0 || playerCost > Number.MAX_SAFE_INTEGER) {
    fail('operation:resolution:invalid-snapshot', 'shared PlayerCost balance is invalid');
  }
  const activeStudents = snapshot.actors.filter(actor => actor.participantKind === 'student' && actor.hp > 0);
  if (location.actionMode === 'individual' && activeStudents.length === 0) fail('operation:resolution:invalid-snapshot', 'Individual SceneAction batch has no active Student participants');
  const sceneActions = new Map((location.sceneActions ?? []).map(row => [row.id, row]));
  const selectableActionSelections = request.selections.filter(row => sceneActions.get(row.sceneActionId)?.selectionPolicy !== 'fixed');
  if (location.actionMode === 'individual' && selectableActionSelections.some(row => !row.actorId
    || selectableActionSelections.filter(other => other.actorId === row.actorId).length > 1)) {
    fail('operation:resolution:invalid-content', 'Individual batches allow at most one selected SceneAction per Student');
  }
  if (location.actionMode === 'global'
    && new Set(selectableActionSelections.map(row => row.sceneActionId)).size !== selectableActionSelections.length) {
    fail('operation:resolution:invalid-content', 'A SceneAction offer can be selected only once per batch');
  }
  const choice = location.sceneActionChoice;
  if (choice) {
    const candidateIds = new Set(choice.candidateSceneActionIds);
    const selectedCandidateIds = selectableActionSelections.map(row => row.sceneActionId);
    if (selectedCandidateIds.some(id => !candidateIds.has(id))) {
      fail('operation:resolution:invalid-content', 'SceneAction selection is outside the declared M-of-N candidate set');
    }
    if (request.skip !== true && selectedCandidateIds.length !== choice.chooseExactly) {
      fail('operation:resolution:invalid-content', 'SceneAction choice requires exactly ' + choice.chooseExactly + ' of '
        + choice.candidateSceneActionIds.length + ' offers; received ' + selectedCandidateIds.length);
    }
  } else if (location.actionMode === 'global' && selectableActionSelections.length > 1) {
    fail('operation:resolution:invalid-content', 'Global batches allow at most one selectable SceneAction');
  }

  const actorInitializations = new Map(trustedContent.actorInitializations.map(row => [row.actorId, row]));
  const resolvePerformer = (action: OperationActionDef, preferred?: string): string | undefined => {
    const candidates = activeStudents.filter(actor => {
      const init = actorInitializations.get(actor.actorId);
      return Boolean(init?.participantKind === 'student'
        && action.allowedParticipantKinds.includes('student')
        && action.requiredCapabilityIds.every(id => init.profile.capabilityIds.includes(id)));
    }).map(actor => actor.actorId);
    return preferred && candidates.includes(preferred) ? preferred : candidates[0];
  };
  const resolveDefaultTargets = (action: OperationActionDef, actorId: string | null): readonly string[] => {
    const targetSpec = action.target;
    if (targetSpec.kind === 'none') return [];
    const candidates = getOperationTargetActorIds(event, actorId, targetSpec, indexes.actorStatesById);
    if (candidates.length === 0) fail('operation:resolution:invalid-content', 'fixed Scene option has no legal default Actor target: ' + action.id);
    return targetSpec.selectionMode === 'all-eligible' ? [] : [candidates[0]!];
  };
  const actionSelections: OperationSceneActionSelection[] = [...request.selections];
  for (const fixed of (location.sceneActions ?? []).filter(row => row.selectionPolicy === 'fixed')) {
    const suppliedFixed = request.selections.filter(row => row.sceneActionId === fixed.id);
    if (fixed.scope === 'global' && suppliedFixed.length > 1) {
      fail('operation:resolution:invalid-content', 'fixed Global SceneAction may appear only once: ' + fixed.id);
    }
    if (fixed.scope === 'individual') {
      for (const row of suppliedFixed) {
        if (!row.actorId || !activeStudents.some(actor => actor.actorId === row.actorId)) {
          fail('operation:resolution:invalid-content', 'fixed Individual SceneAction must bind to an active Student: ' + fixed.id);
        }
      }
      if (new Set(suppliedFixed.map(row => row.actorId)).size !== suppliedFixed.length) {
        fail('operation:resolution:invalid-content', 'fixed Individual SceneAction cannot contain duplicate performer bindings: ' + fixed.id);
      }
    }
    const action = indexes.actionDefinitionsById.get(fixed.actionId);
    if (!action) fail('operation:resolution:invalid-content', 'fixed SceneAction references an unknown Action: ' + fixed.actionId);
    const expectedActorIds: readonly (string | null)[] = fixed.scope === 'individual'
      ? activeStudents.map(actor => actor.actorId)
      : [null];
    for (const expectedActorId of expectedActorIds) {
      const existing = request.selections.find(row => row.sceneActionId === fixed.id
        && (fixed.scope === 'global' || row.actorId === expectedActorId));
      const resolvedActor = fixed.performerPolicy === 'none' || (fixed.performerPolicy === 'optional-student' && !existing?.actorId)
        ? null
        : existing?.actorId ?? expectedActorId ?? resolvePerformer(action);
      if (fixed.performerPolicy !== 'none' && !resolvedActor) fail('operation:resolution:invalid-content', 'fixed SceneAction has no qualified Student performer: ' + fixed.id);
      const normalized: OperationSceneActionSelection = {
        sceneActionId: fixed.id,
        ...(resolvedActor ? { actorId: resolvedActor } : {}),
        targetActorIds: existing?.targetActorIds.length ? existing.targetActorIds : resolveDefaultTargets(action, resolvedActor ?? null),
      };
      if (existing) {
        const index = actionSelections.indexOf(existing);
        if (index >= 0) actionSelections[index] = normalized;
      } else actionSelections.push(normalized);
    }
  }
  const selectedActorIds = new Set<string>();
  const selected: { readonly request: OperationSceneActionSelection; readonly actionId: string; readonly playerCost: number; readonly actorId: string | null; readonly targets: readonly (string | null)[]; readonly cost?: OperationActionCostDef }[] = [];
  let totalCost = decimalParts(0);
  for (const candidate of actionSelections) {
    if (!isRecord(candidate) || !isNonEmptyId(candidate.sceneActionId) || (candidate.actorId !== undefined && !isNonEmptyId(candidate.actorId))
      || !Array.isArray(candidate.targetActorIds) || !candidate.targetActorIds.every(isNonEmptyId)
      || (candidate.cardInstanceIds !== undefined && (!Array.isArray(candidate.cardInstanceIds) || candidate.cardInstanceIds.length > 0))) {
      fail('operation:resolution:invalid-content', 'SceneAction selection has an invalid shape or includes unavailable SceneCards');
    }
    const selection = candidate as unknown as OperationSceneActionSelection;
    const sceneAction = sceneActions.get(selection.sceneActionId);
    const action = sceneAction ? indexes.actionDefinitionsById.get(sceneAction.actionId) : undefined;
    const performerPolicy = sceneAction?.performerPolicy ?? 'selected-student';
    const actorId = selection.actorId ?? null;
    const sourceState = actorId ? indexes.actorStatesById.get(actorId) : undefined;
    const initialization = actorId ? actorInitializations.get(actorId) : undefined;
    if (!sceneAction || sceneAction.scope !== location.actionMode || !action) {
      fail('operation:resolution:invalid-content', 'selection references an unavailable SceneAction');
    }
    const actorless = performerPolicy === 'none' || (performerPolicy === 'optional-student' && actorId === null);
    if (actorless) {
      if (actorId !== null) fail('operation:resolution:invalid-content', 'actorless SceneAction must not name a performer');
      if (action.cost !== undefined) fail('operation:resolution:invalid-content', 'actorless SceneAction cannot pay Action actor/team cost');
      if (action.effects.some(effect => 'recipient' in effect && (effect.recipient === 'actor' || effect.recipient === 'actorTeam'))) {
        fail('operation:resolution:invalid-content', 'actorless SceneAction cannot use performer-relative effects');
      }
      if (action.target.kind === 'actor' && !action.target.allowedActorIds?.length && !action.target.allowedActorTypes?.length) {
        fail('operation:resolution:invalid-content', 'actorless Action target requires an absolute Actor ID/type filter');
      }
    } else if (!sourceState || sourceState.participantKind !== 'student' || sourceState.hp <= 0
      || (location.actionMode === 'individual' && sceneAction.selectionPolicy !== 'fixed' && selectedActorIds.has(actorId!))) {
      fail('operation:resolution:invalid-content', 'SceneAction performer must be a unique active Student');
    } else if (!action.allowedParticipantKinds.includes('student') || !initialization || initialization.participantKind !== 'student'
      || !action.requiredCapabilityIds.every(id => initialization.profile.capabilityIds.includes(id))) {
      fail('operation:resolution:invalid-content', 'performer is not qualified for Action ' + action.id);
    }
    if (location.actionMode === 'individual' && (!actorId || !activeStudents.some(actor => actor.actorId === actorId))) {
      fail('operation:resolution:invalid-content', 'Individual batches must include each active Student exactly once');
    }
    if (action.target.kind === 'none') {
      if (selection.targetActorIds.length !== 0) fail('operation:resolution:invalid-content', 'Action does not accept Actor targets: ' + action.id);
      selected.push({ request: selection, actionId: action.id, playerCost: sceneAction.playerCost, actorId, targets: [null], ...(action.cost ? { cost: action.cost } : {}) });
    } else {
      const legalTargetIds = getOperationTargetActorIds(event, actorId, action.target, indexes.actorStatesById);
      let targets: readonly string[];
      if (action.target.selectionMode === 'all-eligible') {
        if (selection.targetActorIds.length !== 0) {
          fail('operation:resolution:invalid-content', 'all-eligible Action must not include explicit target IDs: ' + action.id);
        }
        if (legalTargetIds.length === 0) fail('operation:resolution:invalid-content', 'all-eligible Action has no legal targets: ' + action.id);
        targets = legalTargetIds;
      } else {
        if ((location.actionMode === 'individual' && selection.targetActorIds.length !== 1)
          || (location.actionMode === 'global' && selection.targetActorIds.length < 1)
          || new Set(selection.targetActorIds).size !== selection.targetActorIds.length) {
          fail('operation:resolution:invalid-content', 'selected Actor target count is invalid for Action ' + action.id);
        }
        for (const targetActorId of selection.targetActorIds) {
          if (!legalTargetIds.includes(targetActorId)) {
            fail('operation:resolution:invalid-content', 'selected target is no longer eligible for Action ' + action.id + ': ' + targetActorId);
          }
        }
        targets = selection.targetActorIds;
      }
      selected.push({ request: selection, actionId: action.id, playerCost: sceneAction.playerCost, actorId, targets, ...(action.cost ? { cost: action.cost } : {}) });
    }
    if (actorId && sceneAction.selectionPolicy !== 'fixed') selectedActorIds.add(actorId);
    totalCost = addDecimal(totalCost, decimalParts(sceneAction.playerCost));
  }
  const cardSelections = request.cards ?? [];
  if (!Array.isArray(cardSelections)) fail('operation:resolution:invalid-content', 'SceneCard selections must be an array');
  const handIds = snapshot.playerCardZones?.hand;
  if (!Array.isArray(handIds)) fail('operation:resolution:invalid-snapshot', 'current Player SceneCard hand is missing');
  const cardInstances = trustedContent.playerSceneCardInstances ?? createOperationPlayerSceneCardInstances(event);
  const cardInstancesById = new Map(cardInstances.map(card => [card.cardInstanceId, card]));
  const selectedCardIds = new Set<string>();
  const selectedCards: { readonly request: OperationSceneCardSelection; readonly instance: (typeof cardInstances)[number]; readonly actionId: string; readonly actorId: string | null; readonly targets: readonly (string | null)[]; readonly cost?: OperationActionCostDef }[] = [];
  const normalizedCardSelections: OperationSceneCardSelection[] = [...cardSelections];
  for (const cardInstanceId of handIds) {
    const instance = cardInstancesById.get(cardInstanceId);
    if (!instance || instance.timing !== 'scene' || instance.selectionPolicy !== 'fixed') continue;
    const action = indexes.actionDefinitionsById.get(instance.actionId);
    if (!action) fail('operation:resolution:invalid-content', 'fixed SceneCard references an unknown Action: ' + instance.actionId);
    const existing = normalizedCardSelections.find(row => row.cardInstanceId === cardInstanceId);
    const performerPolicy = instance.performerPolicy ?? 'selected-student';
    const actorId = performerPolicy === 'none' || (performerPolicy === 'optional-student' && !existing?.actorId)
      ? null : existing?.actorId ?? resolvePerformer(action);
    if (performerPolicy === 'selected-student' && !actorId) {
      fail('operation:resolution:invalid-content', 'fixed SceneCard has no qualified Student performer: ' + instance.actionId);
    }
    const normalized: OperationSceneCardSelection = {
      cardInstanceId,
      ...(actorId ? { actorId } : {}),
      targetActorIds: existing?.targetActorIds.length ? existing.targetActorIds : resolveDefaultTargets(action, actorId ?? null),
    };
    if (existing) {
      const index = normalizedCardSelections.indexOf(existing);
      if (index >= 0) normalizedCardSelections[index] = normalized;
    } else normalizedCardSelections.push(normalized);
  }
  for (const candidate of normalizedCardSelections) {
    if (!isRecord(candidate) || !isNonEmptyId(candidate.cardInstanceId) || (candidate.actorId !== undefined && !isNonEmptyId(candidate.actorId))
      || !Array.isArray(candidate.targetActorIds) || !candidate.targetActorIds.every(isNonEmptyId)) {
      fail('operation:resolution:invalid-content', 'SceneCard selection has an invalid shape');
    }
    const selection = candidate as unknown as OperationSceneCardSelection;
    const instance = cardInstancesById.get(selection.cardInstanceId);
    if (!instance || !handIds.includes(selection.cardInstanceId) || selectedCardIds.has(selection.cardInstanceId)) {
      fail('operation:resolution:invalid-content', 'SceneCard must be a unique instance currently in hand: ' + selection.cardInstanceId);
    }
    if (instance.timing !== 'scene') fail('operation:resolution:invalid-content', 'SceneCard timing does not match the current SceneAction batch');
    const performerPolicy = instance.performerPolicy ?? 'selected-student';
    const actorId = selection.actorId ?? null;
    const actorState = actorId ? indexes.actorStatesById.get(actorId) : undefined;
    const initialization = actorId ? actorInitializations.get(actorId) : undefined;
    const action = indexes.actionDefinitionsById.get(instance.actionId);
    if (!action) fail('operation:resolution:invalid-content', 'SceneCard Action definition is missing: ' + instance.actionId);
    const actorless = performerPolicy === 'none' || (performerPolicy === 'optional-student' && actorId === null);
    if (actorless) {
      if (actorId !== null) fail('operation:resolution:invalid-content', 'actorless SceneCard must not name a performer');
      if (action.cost !== undefined) fail('operation:resolution:invalid-content', 'actorless SceneCard cannot pay Action actor/team cost');
      if (action.effects.some(effect => 'recipient' in effect && (effect.recipient === 'actor' || effect.recipient === 'actorTeam'))) {
        fail('operation:resolution:invalid-content', 'actorless SceneCard cannot use performer-relative effects');
      }
      if (action.target.kind === 'actor' && !action.target.allowedActorIds?.length && !action.target.allowedActorTypes?.length) {
        fail('operation:resolution:invalid-content', 'actorless Action target requires an absolute Actor ID/type filter');
      }
    } else if (!actorState || actorState.participantKind !== 'student' || actorState.hp <= 0
      || !initialization || initialization.participantKind !== 'student'
      || !action.allowedParticipantKinds.includes('student')
      || !action.requiredCapabilityIds.every(id => initialization.profile.capabilityIds.includes(id))) {
      fail('operation:resolution:invalid-content', 'SceneCard Action has no qualified active Student performer: ' + instance.actionId);
    }
    if (action.target.kind === 'none') {
      if (selection.targetActorIds.length !== 0) fail('operation:resolution:invalid-content', 'SceneCard Action does not accept Actor targets: ' + action.id);
      selectedCards.push({ request: selection, instance, actionId: action.id, actorId, targets: [null], ...(action.cost ? { cost: action.cost } : {}) });
    } else {
      const legalTargetIds = getOperationTargetActorIds(event, actorId, action.target, indexes.actorStatesById);
      let targets: readonly string[];
      if (action.target.selectionMode === 'all-eligible') {
        if (selection.targetActorIds.length !== 0) {
          fail('operation:resolution:invalid-content', 'all-eligible SceneCard Action must not include explicit target IDs: ' + action.id);
        }
        if (legalTargetIds.length === 0) fail('operation:resolution:invalid-content', 'all-eligible SceneCard Action has no legal targets: ' + action.id);
        targets = legalTargetIds;
      } else {
        if ((location.actionMode === 'individual' && selection.targetActorIds.length !== 1)
          || (location.actionMode === 'global' && selection.targetActorIds.length < 1)
          || new Set(selection.targetActorIds).size !== selection.targetActorIds.length) {
          fail('operation:resolution:invalid-content', 'SceneCard target count is invalid for Action ' + action.id);
        }
        for (const targetActorId of selection.targetActorIds) {
          if (!legalTargetIds.includes(targetActorId)) {
            fail('operation:resolution:invalid-content', 'SceneCard target is no longer eligible for Action ' + action.id + ': ' + targetActorId);
          }
        }
        targets = selection.targetActorIds;
      }
      selectedCards.push({ request: selection, instance, actionId: action.id, actorId, targets, ...(action.cost ? { cost: action.cost } : {}) });
    }
    selectedCardIds.add(selection.cardInstanceId);
    totalCost = addDecimal(totalCost, decimalParts(instance.playerCost));
  }
  const purchaseSelections = request.purchases ?? [];
  if (!Array.isArray(purchaseSelections)) fail('operation:resolution:invalid-content', 'Purchase selections must be an array');
  const purchaseOffers = new Map((location.purchaseOffers ?? []).map(offer => [offer.id, offer]));
  const selectedPurchaseIds = new Set<string>();
  const selectedPurchases: {
    readonly request: OperationScenePurchaseSelection;
    readonly offer: NonNullable<typeof location.purchaseOffers>[number];
    readonly action: OperationActionDef;
  }[] = [];
  for (const candidate of purchaseSelections) {
    if (!isRecord(candidate) || Object.keys(candidate).some(key => key !== 'offerId') || !isNonEmptyId(candidate.offerId)) {
      fail('operation:resolution:invalid-content', 'Purchase selection has an invalid shape');
    }
    const selection = candidate as unknown as OperationScenePurchaseSelection;
    const offer = purchaseOffers.get(selection.offerId);
    if (!offer || selectedPurchaseIds.has(selection.offerId)) {
      fail('operation:resolution:invalid-content', 'PurchaseOffer is unavailable or repeated in this batch: ' + selection.offerId);
    }
    if (!indexes.factsById.has(offer.purchaseFactId)) {
      fail('operation:resolution:invalid-content', 'PurchaseOffer marker is not a declared Event fact: ' + offer.purchaseFactId);
    }
    if (snapshot.knownFactIds.includes(offer.purchaseFactId)) {
      fail('operation:resolution:invalid-content', 'PurchaseOffer was already purchased in this Run: ' + offer.id);
    }
    const action = indexes.actionDefinitionsById.get(offer.actionId);
    if (!action || action.target.kind !== 'none' || action.cost !== undefined || action.effects.length === 0
      || action.effects.some(effect => effect.kind !== 'eventTrackDelta' && effect.kind !== 'eventFact' && effect.kind !== 'heldItem')) {
      fail('operation:resolution:invalid-content', 'PurchaseOffer must use an admitted targetless Action with at least one Event-only reward effect: ' + offer.id);
    }
    if (!Number.isSafeInteger(offer.playerCost) || offer.playerCost < 0 || offer.playerCost > Number.MAX_SAFE_INTEGER) {
      fail('operation:resolution:invalid-content', 'PurchaseOffer PlayerCost is invalid: ' + offer.id);
    }
    selectedPurchaseIds.add(selection.offerId);
    selectedPurchases.push({ request: selection, offer, action });
    totalCost = addDecimal(totalCost, decimalParts(offer.playerCost));
  }
  const totalCostNumber = decimalToNumber(totalCost, 'SceneAction batch PlayerCost');
  if (totalCostNumber > Number.MAX_SAFE_INTEGER) {
    fail('operation:resolution:invalid-content', 'SceneAction batch PlayerCost exceeds the safe numeric range');
  }
  const remainingCost = subtractDecimal(decimalParts(playerCost), totalCost);
  if (compareDecimal(remainingCost, decimalParts(0)) < 0) fail('operation:resolution:unaffordable', 'SceneAction batch exceeds the shared PlayerCost balance');
  const nextCost = decimalToNumber(remainingCost, 'Remaining PlayerCost');

  const buckets = new Map<string, ValueBucket>();
  const membershipChanges = new Map<string, OperationResolutionMembershipChange>();
  const positionChanges = new Map<string, PositionBucket>();
  const scenePayments: OperationResolutionPayment[] = [];
  const paymentBalances = new Map<string, DecimalParts>();
  for (const row of [...selected, ...selectedCards]) {
    if (!row.cost) continue;
    if (!row.actorId) fail('operation:resolution:invalid-content', 'Action resource cost requires a selected Student performer');
    const { scopeId, bounds } = resourceBounds(indexes, row.cost, row.actorId);
    const key = row.cost.scope + ':' + scopeId + ':' + row.cost.resourceId;
    const initialBalance = row.cost.scope === 'actor'
      ? indexes.actorStatesById.get(scopeId)?.resources[row.cost.resourceId]
      : indexes.teamStatesById.get(scopeId)?.resources[row.cost.resourceId];
    if (initialBalance === undefined) fail('operation:resolution:invalid-snapshot', 'Action resource balance is missing: ' + row.cost.resourceId);
    const balance = paymentBalances.get(key) ?? decimalParts(initialBalance);
    const nextBalance = subtractDecimal(balance, decimalParts(row.cost.amount));
    if (compareDecimal(nextBalance, decimalParts(bounds.min)) < 0) fail('operation:resolution:unaffordable', 'Scene Action resource costs exceed the commit-start balance for ' + scopeId);
    paymentBalances.set(key, nextBalance);
    scenePayments.push({ actorId: row.actorId, actionId: row.actionId, cost: { ...row.cost }, scopeId });
  }
  addPayments(scenePayments, buckets, indexes, snapshot);
  for (const row of selected) {
    const action = indexes.actionDefinitionsById.get(row.actionId)!;
    for (const targetActorId of row.targets) {
      validateEffectList(action.effects, row.actorId, targetActorId, indexes, snapshot);
      addEffectList(action.effects, row.actorId, targetActorId, effectIndex => ({
        kind: 'sceneAction', ...(row.actorId ? { actorId: row.actorId } : {}), sceneActionId: row.request.sceneActionId,
        actionId: row.actionId, targetActorId, effectIndex,
      }), buckets, membershipChanges, positionChanges, indexes, snapshot);
    }
  }
  for (const row of selectedCards) {
    const action = indexes.actionDefinitionsById.get(row.actionId)!;
    for (const targetActorId of row.targets) {
      validateEffectList(action.effects, row.actorId, targetActorId, indexes, snapshot);
      addEffectList(action.effects, row.actorId, targetActorId, effectIndex => ({
        kind: 'sceneCard', cardInstanceId: row.request.cardInstanceId, ...(row.actorId ? { actorId: row.actorId } : {}),
        actionId: row.actionId, targetActorId, effectIndex,
      }), buckets, membershipChanges, positionChanges, indexes, snapshot);
    }
  }
  for (const row of selectedPurchases) {
    validateEffectList(row.action.effects, null, null, indexes, snapshot);
    addEffectList(row.action.effects, null, null, effectIndex => ({
      kind: 'scenePurchase', purchaseOfferId: row.offer.id, actionId: row.offer.actionId, effectIndex,
    }), buckets, membershipChanges, positionChanges, indexes, snapshot);
    const markerKey = 'knownFact:' + row.offer.purchaseFactId;
    if (membershipChanges.has(markerKey)) {
      fail('operation:resolution:invalid-content', 'PurchaseOffer marker conflicts with another effect in the same batch: ' + row.offer.purchaseFactId);
    }
    membershipChanges.set(markerKey, {
      target: { kind: 'knownFact', id: row.offer.purchaseFactId },
      before: false,
      after: true,
    });
  }
  const randomState = skillRandomState(input);
  const selections = selected.map(row => ({
    sceneActionId: row.request.sceneActionId,
    ...(row.actorId ? { actorId: row.actorId } : {}),
    targetActorIds: row.targets.filter((targetActorId): targetActorId is string => targetActorId !== null),
  }));
  const resolvedCards = selectedCards.map(row => ({
    cardInstanceId: row.request.cardInstanceId,
    ...(row.actorId ? { actorId: row.actorId } : {}),
    targetActorIds: row.targets.filter((targetActorId): targetActorId is string => targetActorId !== null),
    actionId: row.actionId,
    playerCost: row.instance.playerCost,
  }));
  const resolvedPurchases = selectedPurchases.map(row => ({
    offerId: row.request.offerId,
    actionId: row.offer.actionId,
    playerCost: row.offer.playerCost,
    purchaseFactId: row.offer.purchaseFactId,
  }));
  const usedAfter = batchesUsed! + 1;
  if (!Number.isSafeInteger(usedAfter)) fail('operation:resolution:invalid-snapshot', 'SceneAction batch count cannot advance safely');
  return freezeTree({
    runId: snapshot.runId,
    eventId: snapshot.eventId,
    basePlanVersion: snapshot.planVersion,
    locationId: snapshot.currentLocationId,
    actorPlans: [],
    intervention: null,
    payments: scenePayments,
    combinations: { planVersion: snapshot.planVersion, locationId: snapshot.currentLocationId, matches: [] },
    studentSkillChecks: [],
    randomCursorBefore: randomState.tacticalCursor,
    randomCursorAfter: randomState.tacticalCursor,
    numericChanges: resolveChanges(buckets, indexes, input),
    membershipChanges: resolveMembershipChanges(membershipChanges),
    positionChanges: resolvePositionChanges(positionChanges),
    sceneBatch: {
      selections,
      cards: resolvedCards,
      ...(resolvedPurchases.length ? { purchases: resolvedPurchases } : {}),
      ...(request.skip === true ? { skip: true } : {}),
      actionCosts: scenePayments,
      playerCostBefore: playerCost,
      playerCostPaid: totalCostNumber,
      playerCostAfter: nextCost,
      sceneActionBatchesUsed: usedAfter,
    },
    nextRandomState: randomState,
  });
}

/** Plans all payments, rolls, combinations, and local deltas without writing EventRun. */
export function planOperationResolution(input: OperationResolutionPlannerInput): OperationResolutionBatch {
  if (!isRecord(input)) fail('operation:resolution:invalid-snapshot', 'planner input must be an object');
  const indexes = buildIndexes(input);
  if (input.sceneBatch !== undefined) return planSceneBatch(input, indexes);
  if (!input.preparedBeat || input.interventionDraft === undefined) {
    fail('operation:resolution:invalid-content', 'Beat planning requires a stored PreparedBeat and intervention draft slot');
  }
  const preparationInput = preparationSnapshot(input);
  const content = preparationContent(input);
  let canonicalBase: PreparedBeat;
  try {
    canonicalBase = prepareOperationBeat(preparationInput, content);
  } catch (error) {
    fail('operation:resolution:invalid-content', error instanceof Error ? error.message : 'canonical preparation failed');
  }
  if (!input.preparedBeat || !sameBeat(canonicalBase, input.preparedBeat)) {
    fail('operation:resolution:stale-plan', 'stored base PreparedBeat does not match the current snapshot');
  }

  let finalBeat = canonicalBase;
  let intervention: OperationResolutionBatch['intervention'] = null;
  if (input.interventionDraft !== null) {
    const storedDraft = { ...input.interventionDraft };
    try {
      const preview = previewOperationIntervention({
        snapshot: preparationInput,
        trustedContent: content,
        preparedBeat: canonicalBase,
        currentDraft: storedDraft,
        draft: storedDraft,
      });
      finalBeat = preview.preparedBeat;
      const before = canonicalBase.actorPlans.find(plan => plan.actorId === input.interventionDraft!.actorId);
      const after = finalBeat.actorPlans.find(plan => plan.actorId === input.interventionDraft!.actorId);
      if (!before || !after) fail('operation:resolution:invalid-content', 'intervention Actor plan is missing');
      intervention = {
        actorId: input.interventionDraft.actorId,
        before,
        after,
        ...(input.interventionDraft.reasonId ? { reasonId: input.interventionDraft.reasonId } : {}),
      };
    } catch (error) {
      fail('operation:resolution:invalid-content', error instanceof Error ? error.message : 'intervention preview failed');
    }
  }

  const selectedActions = planAndActionIndexes(input.trustedContent.eventDefinition.actors, finalBeat.actorPlans, indexes.actionDefinitionsById);
  const payments = preflightPayments(input.trustedContent.eventDefinition.actors, finalBeat.actorPlans, selectedActions, indexes);

  let skillBatch;
  try {
    skillBatch = rollOperationStudentSkills(
      input.trustedContent.eventDefinition,
      input.trustedContent.actorInitializations,
      finalBeat,
      input.trustedContent.studentSkillRules,
      skillRandomState(input),
    );
  } catch (error) {
    fail('operation:resolution:rng-failure', error instanceof Error ? error.message : 'skill roll failed');
  }

  let combinations;
  try {
    combinations = resolveOperationCombinations(
      input.trustedContent.eventDefinition,
      finalBeat,
      input.trustedContent.actionDefinitions,
    );
  } catch (error) {
    fail('operation:resolution:invalid-content', error instanceof Error ? error.message : 'combination resolution failed');
  }

  const buckets = new Map<string, ValueBucket>();
  const membershipChanges = new Map<string, OperationResolutionMembershipChange>();
  const positionChanges = new Map<string, PositionBucket>();
  addPayments(payments, buckets, indexes, input.snapshot);
  const consumedActorIds = new Set(combinations.matches.flatMap(match => [match.actorAId, match.actorBId]));
  addActionEffects(finalBeat.actorPlans, selectedActions, consumedActorIds, buckets, membershipChanges, positionChanges, indexes, input);
  addCombinationEffects(combinations.matches, buckets, membershipChanges, positionChanges, indexes, input);
  addSkillEffects(skillBatch.checks, finalBeat.actorPlans, buckets, membershipChanges, positionChanges, indexes, input);
  const randomState = skillRandomState(input);

  return freezeTree({
    runId: input.snapshot.runId,
    eventId: input.snapshot.eventId,
    basePlanVersion: input.snapshot.planVersion,
    locationId: input.snapshot.currentLocationId,
    actorPlans: finalBeat.actorPlans,
    intervention,
    payments,
    combinations,
    studentSkillChecks: skillBatch.checks,
    randomCursorBefore: randomState.tacticalCursor,
    randomCursorAfter: skillBatch.nextRandomState.tacticalCursor,
    numericChanges: resolveChanges(buckets, indexes, input),
    membershipChanges: resolveMembershipChanges(membershipChanges),
    positionChanges: resolvePositionChanges(positionChanges),
    nextRandomState: skillBatch.nextRandomState,
  });
}
