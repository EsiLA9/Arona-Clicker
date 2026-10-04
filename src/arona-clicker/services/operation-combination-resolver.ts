import type { OperationEventDef } from '../contracts/operation';
import type {
  OperationActionDef,
  OperationCombinationMatch,
  OperationCombinationPreview,
  OperationCombinationRuleDef,
} from '../contracts/operation-action';
import type { PreparedBeat, OperationPreparedActorPlan } from '../contracts/operation-beat';

interface CombinationCandidate {
  readonly rule: OperationCombinationRuleDef;
  readonly actorAIndex: number;
  readonly actorBIndex: number;
  readonly planA: OperationPreparedActorPlan;
  readonly planB: OperationPreparedActorPlan;
  readonly actionA: OperationActionDef;
  readonly actionB: OperationActionDef;
}

export class OperationCombinationResolverError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'OperationCombinationResolverError';
  }
}

function fail(message: string): never {
  throw new OperationCombinationResolverError([message]);
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

function indexActions(actionDefinitions: readonly OperationActionDef[]): Map<string, OperationActionDef> {
  const actions = new Map<string, OperationActionDef>();
  for (const action of actionDefinitions) {
    if (!isNonEmptyId(action.id)) fail('actionDefinitions contain an invalid Action ID');
    if (actions.has(action.id)) fail('actionDefinitions contain duplicate Action ID: ' + action.id);
    actions.set(action.id, action);
  }
  return actions;
}

function validatePlanSequence(event: OperationEventDef, beat: PreparedBeat): void {
  if (!Number.isSafeInteger(beat.planVersion) || beat.planVersion < 0) {
    fail('PreparedBeat planVersion must be a non-negative safe integer');
  }
  if (!isNonEmptyId(beat.locationId) || !event.locations.some(location => location.id === beat.locationId)) {
    fail('PreparedBeat locationId must reference a declared Event Location');
  }
  if (!Array.isArray(beat.actorPlans) || beat.actorPlans.length !== event.actors.length) {
    fail('PreparedBeat must contain exactly one plan for every Event Actor');
  }
  const seenActorIds = new Set<string>();
  for (let index = 0; index < event.actors.length; index += 1) {
    const actor = event.actors[index];
    const plan = beat.actorPlans[index];
    if (!isNonEmptyId(actor.id) || seenActorIds.has(actor.id)) fail('Event actors must have unique stable IDs');
    seenActorIds.add(actor.id);
    if (!plan || plan.actorId !== actor.id) fail('PreparedBeat Actor plans must follow Event Actor declaration order');
    if (plan.participantKind !== actor.type) fail('PreparedBeat participant kind does not match Event Actor: ' + actor.id);
    if (plan.kind === 'studentAction' && plan.participantKind !== 'student') {
      fail('only a student Actor can have a studentAction plan: ' + actor.id);
    }
    if (plan.kind === 'intent' && plan.participantKind === 'student') {
      fail('a student Actor cannot have an Intent plan: ' + actor.id);
    }
    if (plan.kind !== 'studentAction' && plan.kind !== 'intent' && plan.kind !== 'wait') {
      fail('PreparedBeat contains an invalid plan kind for Actor: ' + actor.id);
    }
  }
}

function validateCombinationRule(rule: OperationCombinationRuleDef, seenRuleIds: Set<string>): void {
  if (!isNonEmptyId(rule.id)) fail('Combination rules contain an invalid rule ID');
  if (seenRuleIds.has(rule.id)) fail('Combination rules contain duplicate rule ID: ' + rule.id);
  seenRuleIds.add(rule.id);
  if (!Number.isSafeInteger(rule.priority)) fail('Combination rule priority must be a safe integer: ' + rule.id);
  if (!Array.isArray(rule.inputTagIds) || rule.inputTagIds.length !== 2
    || !isNonEmptyId(rule.inputTagIds[0]) || !isNonEmptyId(rule.inputTagIds[1])
    || rule.inputTagIds[0] === rule.inputTagIds[1]) {
    fail('Combination rule must contain two distinct ordered tag IDs: ' + rule.id);
  }
  if (rule.targetMatch !== 'same-target' && rule.targetMatch !== 'no-target') {
    fail('Combination rule has an invalid targetMatch: ' + rule.id);
  }
}

function matchesTarget(
  rule: OperationCombinationRuleDef,
  planA: OperationPreparedActorPlan,
  planB: OperationPreparedActorPlan,
  actionA: OperationActionDef,
  actionB: OperationActionDef,
): boolean {
  if (rule.targetMatch === 'no-target') {
    return planA.targetActorId === null
      && planB.targetActorId === null
      && actionA.target.kind === 'none'
      && actionB.target.kind === 'none';
  }
  return planA.targetActorId !== null
    && planA.targetActorId === planB.targetActorId
    && actionA.target.kind === 'actor'
    && actionB.target.kind === 'actor';
}

function compareCandidates(left: CombinationCandidate, right: CombinationCandidate): number {
  if (left.rule.priority !== right.rule.priority) return left.rule.priority < right.rule.priority ? -1 : 1;
  if (left.rule.id !== right.rule.id) return left.rule.id < right.rule.id ? -1 : 1;
  if (left.actorAIndex !== right.actorAIndex) return left.actorAIndex < right.actorAIndex ? -1 : 1;
  if (left.actorBIndex !== right.actorBIndex) return left.actorBIndex < right.actorBIndex ? -1 : 1;
  return 0;
}

function validateStudentActionPlan(
  plan: OperationPreparedActorPlan,
  actionsById: ReadonlyMap<string, OperationActionDef>,
): OperationActionDef {
  const action = actionsById.get(plan.actionId);
  if (!action) fail('studentAction references a missing Action: ' + plan.actionId);
  if (!action.allowedParticipantKinds.includes('student')) {
    fail('studentAction references an Action that does not allow students: ' + plan.actionId);
  }
  if (!Array.isArray(action.tagIds) || action.tagIds.some(tagId => !isNonEmptyId(tagId))) {
    fail('studentAction Action tags are malformed: ' + plan.actionId);
  }
  return action;
}

/** Matches disjoint student Action pairs using only current-Location, ordered, finite rules. */
export function resolveOperationCombinations(
  eventDefinition: OperationEventDef,
  preparedBeat: PreparedBeat,
  actionDefinitions: readonly OperationActionDef[],
): OperationCombinationPreview {
  validatePlanSequence(eventDefinition, preparedBeat);
  const actionsById = indexActions(actionDefinitions);
  const location = eventDefinition.locations.find(row => row.id === preparedBeat.locationId);
  if (!location) {
    return freezeTree({ planVersion: preparedBeat.planVersion, locationId: preparedBeat.locationId, matches: [] });
  }
  if (!Array.isArray(location.combinationRules)) {
    fail('current Location combinationRules must be an array');
  }

  const seenRuleIds = new Set<string>();
  const candidates: CombinationCandidate[] = [];
  for (const rule of location.combinationRules) {
    validateCombinationRule(rule, seenRuleIds);
    for (let actorAIndex = 0; actorAIndex < preparedBeat.actorPlans.length; actorAIndex += 1) {
      const planA = preparedBeat.actorPlans[actorAIndex];
      if (planA.participantKind !== 'student' || planA.kind !== 'studentAction') continue;
      const actionA = validateStudentActionPlan(planA, actionsById);
      if (!actionA.tagIds.includes(rule.inputTagIds[0])) continue;
      for (let actorBIndex = actorAIndex + 1; actorBIndex < preparedBeat.actorPlans.length; actorBIndex += 1) {
        const planB = preparedBeat.actorPlans[actorBIndex];
        if (planB.participantKind !== 'student' || planB.kind !== 'studentAction') continue;
        const actionB = validateStudentActionPlan(planB, actionsById);
        if (!actionB.tagIds.includes(rule.inputTagIds[1])) continue;
        if (!matchesTarget(rule, planA, planB, actionA, actionB)) continue;
        candidates.push({ rule, actorAIndex, actorBIndex, planA, planB, actionA, actionB });
      }
    }
  }
  candidates.sort(compareCandidates);

  const consumedActorIds = new Set<string>();
  const matches: OperationCombinationMatch[] = [];
  for (const candidate of candidates) {
    if (consumedActorIds.has(candidate.planA.actorId) || consumedActorIds.has(candidate.planB.actorId)) continue;
    const targetActorId = candidate.rule.targetMatch === 'same-target'
      ? candidate.planA.targetActorId
      : null;
    matches.push({
      ruleId: candidate.rule.id,
      priority: candidate.rule.priority,
      actorAId: candidate.planA.actorId,
      actorBId: candidate.planB.actorId,
      actionAId: candidate.planA.actionId,
      actionBId: candidate.planB.actionId,
      targetActorId,
    });
    consumedActorIds.add(candidate.planA.actorId);
    consumedActorIds.add(candidate.planB.actorId);
  }

  return freezeTree({ planVersion: preparedBeat.planVersion, locationId: preparedBeat.locationId, matches });
}
