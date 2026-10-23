import type {
  OperationActionCandidateSnapshot,
  OperationActorInitialization,
  OperationStudentProfileSnapshot,
} from '../../contracts/operation/operation';
import {
  OPERATION_NO_ELIGIBLE_ACTION_REASON_ID,
  OPERATION_WAIT_ACTION_ID,
} from '../../contracts/operation/operation';
import type { OperationActionDef } from '../../contracts/operation/operation-action';
import {
  OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY,
  OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE,
  OPERATION_WAIT_REASON_NO_LEGAL_TARGET,
  type OperationInterventionDraft,
  type OperationInterventionPreview,
  type OperationInterventionPreviewErrorCode,
  type OperationInterventionPreviewInput,
  type OperationPreparationContent,
  type OperationPreparedActorPlan,
  type PreparedBeat,
} from '../../contracts/operation/operation-beat';
import { prepareOperationBeat } from './operation-plan-preparation';
import { OperationTargetSelectionError, selectOperationTarget } from './operation-target-selection';

export class OperationInterventionPreviewError extends Error {
  constructor(readonly code: OperationInterventionPreviewErrorCode, detail: string) {
    super(code + ': ' + detail);
    this.name = 'OperationInterventionPreviewError';
  }
}

function fail(code: OperationInterventionPreviewErrorCode, detail: string): never {
  throw new OperationInterventionPreviewError(code, detail);
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

function sameCost(left: OperationPreparedActorPlan['cost'], right: OperationPreparedActorPlan['cost']): boolean {
  if (left === null || right === null) return left === right;
  return left.scope === right.scope
    && left.resourceId === right.resourceId
    && left.amount === right.amount;
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

function sameBeat(left: PreparedBeat, right: PreparedBeat): boolean {
  return left.planVersion === right.planVersion
    && left.locationId === right.locationId
    && Array.isArray(left.actorPlans)
    && Array.isArray(right.actorPlans)
    && left.actorPlans.length === right.actorPlans.length
    && left.actorPlans.every((plan, index) => samePlan(plan, right.actorPlans[index]));
}

function validateDraftShape(value: unknown): asserts value is OperationInterventionDraft {
  if (!isRecord(value)) fail('operation:intervention:invalid-draft', 'draft must be an object');
  const allowedKeys = new Set(['actorId', 'actionId', 'targetActorId', 'reasonId']);
  if (Object.keys(value).some(key => !allowedKeys.has(key))) {
    fail('operation:intervention:invalid-draft', 'draft may contain only actorId, actionId, targetActorId, and reasonId');
  }
  if (!isNonEmptyId(value.actorId)) fail('operation:intervention:invalid-draft', 'actorId must be a stable ID');
  if (Object.prototype.hasOwnProperty.call(value, 'actionId') && !isNonEmptyId(value.actionId)) {
    fail('operation:intervention:invalid-draft', 'actionId must be a stable ID when supplied');
  }
  if (Object.prototype.hasOwnProperty.call(value, 'targetActorId') && !isNonEmptyId(value.targetActorId)) {
    fail('operation:intervention:invalid-draft', 'targetActorId must be a stable ID when supplied');
  }
  if (Object.prototype.hasOwnProperty.call(value, 'reasonId') && !isNonEmptyId(value.reasonId)) {
    fail('operation:intervention:invalid-draft', 'reasonId must be a stable ID when supplied');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'actionId')
    && !Object.prototype.hasOwnProperty.call(value, 'targetActorId')) {
    fail('operation:intervention:invalid-draft', 'draft must revise an action or target');
  }
}

function getStudentInitialization(
  content: OperationPreparationContent,
  actorId: string,
): Extract<OperationActorInitialization, { readonly participantKind: 'student' }> {
  const initialization = content.actors.find(actor => actor.actorId === actorId);
  if (!initialization || initialization.participantKind !== 'student') {
    fail('operation:intervention:invalid-actor', 'draft actor must have a trusted student Profile');
  }
  return initialization;
}

function getCandidateRow(
  profile: OperationStudentProfileSnapshot,
  actionId: string,
  action: OperationActionDef,
): OperationActionCandidateSnapshot {
  const row = profile.actionCandidates.find(candidate => candidate.actionId === actionId);
  if (row) {
    if (row.eligible !== true || !profile.eligibleActionIds.includes(actionId)) {
      fail('operation:intervention:invalid-action', 'Action must be eligible in the student Profile');
    }
    return row;
  }
  if (!action.allowedParticipantKinds.includes('student')) fail('operation:intervention:invalid-action', 'Action does not allow student participants');
  const missingCapabilityIds = action.requiredCapabilityIds.filter(id => !profile.capabilityIds.includes(id));
  if (missingCapabilityIds.length > 0) fail('operation:intervention:invalid-action', 'Action requires missing student capabilities');
  return {
    actionId,
    eligible: true,
    requiredCapabilityIds: [...action.requiredCapabilityIds],
    missingCapabilityIds: [],
    reasonIds: [...new Set([...profile.reasonIds, ...action.reasonIds])],
  };
}

function getActionDefinition(content: OperationPreparationContent, actionId: string): OperationActionDef {
  const action = content.actionDefinitions.find(candidate => candidate.id === actionId);
  if (!action || !action.allowedParticipantKinds.includes('student')) {
    fail('operation:intervention:invalid-action', 'Action must exist and allow student participants');
  }
  return action;
}

function fixedPlanContent(
  content: OperationPreparationContent,
  baseline: PreparedBeat,
  directedActorId: string,
  selectedRow: OperationActionCandidateSnapshot,
  explicitTargetActorId: string | undefined,
): OperationPreparationContent {
  const plansByActorId = new Map(baseline.actorPlans.map(plan => [plan.actorId, plan]));
  const actors = content.actors.map(initialization => {
    const plan = plansByActorId.get(initialization.actorId);
    if (!plan) fail('operation:intervention:stale-plan', 'PreparedBeat is missing a trusted Actor plan');
    if (initialization.participantKind === 'student') {
      const profile = initialization.profile;
      const row = initialization.actorId === directedActorId
        ? selectedRow
        : plan.kind === 'studentAction'
          ? getCandidateRow(profile, plan.actionId, getActionDefinition(content, plan.actionId))
          : undefined;
      if (row) {
        if (row.eligible !== true) {
          fail('operation:intervention:invalid-action', 'retained Action is not eligible for its Profile');
        }
        return {
          ...initialization,
          profile: {
            ...profile,
            candidateActionIds: [row.actionId],
            actionPriorityIds: [row.actionId],
            actionCandidates: [row],
            eligibleActionIds: [row.actionId],
            fallback: undefined,
          },
        };
      }
      return {
        ...initialization,
        profile: {
          ...profile,
          candidateActionIds: [],
          actionPriorityIds: [],
          actionCandidates: [],
          eligibleActionIds: [],
          fallback: { actionId: OPERATION_WAIT_ACTION_ID, reasonIds: [OPERATION_NO_ELIGIBLE_ACTION_REASON_ID] as const },
        },
      };
    }
    return {
      ...initialization,
      candidateActionIds: plan.kind === 'intent' ? [plan.actionId] : [],
    };
  });
  const targetPlans = new Map(baseline.actorPlans.map(plan => [plan.actorId, plan.targetActorId]));
  const eventDefinition = {
    ...content.eventDefinition,
    actors: content.eventDefinition.actors.map(actor => {
      const targetActorId = actor.id === directedActorId && explicitTargetActorId !== undefined
        ? explicitTargetActorId
        : actor.id === directedActorId ? undefined : targetPlans.get(actor.id) ?? undefined;
      if (targetActorId === undefined) return actor;
      const preferredIds = [
        targetActorId,
        ...(actor.targetPriorityActorIds ?? []).filter(id => id !== targetActorId),
      ];
      return { ...actor, targetPriorityActorIds: preferredIds };
    }),
  };
  return { ...content, actors, eventDefinition };
}

function validateExplicitTarget(
  content: OperationPreparationContent,
  snapshot: OperationInterventionPreviewInput['snapshot'],
  actorId: string,
  action: OperationActionDef,
  targetActorId: string,
): OperationPreparationContent {
  const targetContent = {
    ...content,
    eventDefinition: {
      ...content.eventDefinition,
      actors: content.eventDefinition.actors.map(eventActor => eventActor.id === actorId
        ? {
          ...eventActor,
          targetPriorityActorIds: [
            targetActorId,
            ...(eventActor.targetPriorityActorIds ?? []).filter(id => id !== targetActorId),
          ],
        }
        : eventActor),
    },
  };
  try {
    const targetStates = new Map(snapshot.actors.map(actor => [actor.actorId, actor]));
    const selected = selectOperationTarget(targetContent.eventDefinition, actorId, action.target, targetStates);
    if (selected.kind !== 'actor' || selected.targetActorId !== targetActorId) {
      fail('operation:intervention:invalid-target', 'target is not legal for this Action');
    }
  } catch (error) {
    if (error instanceof OperationInterventionPreviewError) throw error;
    const detail = error instanceof OperationTargetSelectionError
      ? error.diagnostics.join('; ')
      : error instanceof Error ? error.message : 'unknown target selection error';
    fail('operation:intervention:invalid-target', detail);
  }
  return targetContent;
}

function selectedActionPlan(beat: PreparedBeat, actorId: string): OperationPreparedActorPlan {
  const plan = beat.actorPlans.find(candidate => candidate.actorId === actorId);
  if (!plan || plan.participantKind !== 'student') {
    fail('operation:intervention:invalid-actor', 'draft actor has no prepared student plan');
  }
  return plan;
}

/** Produces a detached, deterministic preview for one student's limited command Draft. */
export function previewOperationIntervention(
  input: OperationInterventionPreviewInput,
): OperationInterventionPreview {
  validateDraftShape(input?.draft);
  const { snapshot, trustedContent, preparedBeat, currentDraft, draft } = input;
  if (currentDraft !== null) {
    if (!isRecord(currentDraft) || !isNonEmptyId(currentDraft.actorId)) {
      fail('operation:intervention:invalid-draft', 'current Draft must have a valid actorId');
    }
    if (currentDraft.actorId !== draft.actorId) {
      fail('operation:intervention:student-slot-occupied', "clear the existing student's Draft before switching students");
    }
  }

  const baselineBeat = prepareOperationBeat(snapshot, trustedContent);
  if (!sameBeat(baselineBeat, preparedBeat)) {
    fail('operation:intervention:stale-plan', 'PreparedBeat does not match the current Run snapshot and version');
  }
  const eventActor = trustedContent.eventDefinition.actors.find(actor => actor.id === draft.actorId);
  const actorSnapshot = snapshot.actors.find(actor => actor.actorId === draft.actorId);
  if (!eventActor || eventActor.type !== 'student' || !actorSnapshot || actorSnapshot.participantKind !== 'student') {
    fail('operation:intervention:invalid-actor', 'only a declared student Actor can be directed');
  }

  const baseStudentPlan = selectedActionPlan(baselineBeat, draft.actorId);
  if (!Object.prototype.hasOwnProperty.call(draft, 'actionId') && baseStudentPlan.kind !== 'studentAction') {
    fail('operation:intervention:invalid-action', 'target-only Draft requires an existing student Action plan');
  }
  const actionId = Object.prototype.hasOwnProperty.call(draft, 'actionId')
    ? draft.actionId!
    : baseStudentPlan.actionId;
  const handMap = snapshot.studentActionIdsByActorId;
  if (handMap && Object.prototype.hasOwnProperty.call(handMap, draft.actorId)
    && !handMap[draft.actorId].includes(actionId)) {
    fail('operation:intervention:action-not-in-hand', 'Action is not in the Actor current Character Hand');
  }
  const initialization = getStudentInitialization(trustedContent, draft.actorId);
  const action = getActionDefinition(trustedContent, actionId);
  const candidateRow = getCandidateRow(initialization.profile, actionId, action);
  const location = trustedContent.eventDefinition.locations
    .find(row => row.id === snapshot.currentLocationId);
  if (!location?.enabledActionIds.includes(actionId)) {
    fail('operation:intervention:action-not-enabled', 'Action is not enabled at the current Location');
  }
  if (draft.reasonId !== undefined
    && !candidateRow.reasonIds.includes(draft.reasonId)
    && !action.reasonIds.includes(draft.reasonId)) {
    fail('operation:intervention:invalid-reason', 'reasonId is not declared for the selected Action/Profile candidate');
  }

  if (draft.targetActorId !== undefined) {
    validateExplicitTarget(trustedContent, snapshot, draft.actorId, action, draft.targetActorId);
  }

  const previewContent = fixedPlanContent(
    trustedContent,
    baselineBeat,
    draft.actorId,
    candidateRow,
    draft.targetActorId,
  );
  const previewSnapshot = snapshot.studentActionIdsByActorId === undefined
    ? snapshot
    : {
        ...snapshot,
        studentActionIdsByActorId: Object.fromEntries(
          snapshot.studentActionIdsByActorId && Object.keys(snapshot.studentActionIdsByActorId).map(actorId => {
            if (actorId === draft.actorId) return [actorId, [actionId]];
            const existingPlan = baselineBeat.actorPlans.find(plan => plan.actorId === actorId);
            return [actorId, existingPlan?.kind === 'studentAction' ? [existingPlan.actionId] : []];
          }) || [],
        ),
      };
  const previewBeat = prepareOperationBeat(previewSnapshot, previewContent);
  const selectedPlan = selectedActionPlan(previewBeat, draft.actorId);
  if (selectedPlan.kind === 'wait') {
    if (selectedPlan.reasonIds.includes(OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE)) {
      fail('operation:intervention:action-not-affordable', 'Actor or shared Team resources cannot pay this Action cost');
    }
    if (selectedPlan.reasonIds.includes(OPERATION_WAIT_REASON_NO_LEGAL_TARGET)) {
      fail('operation:intervention:no-legal-target', 'Action has no legal automatic target');
    }
    if (selectedPlan.reasonIds.includes(OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY)) {
      fail('operation:intervention:group-target-scene-only', 'all-eligible targets are only supported by SceneAction/Card batches');
    }
    fail('operation:intervention:invalid-action', 'Action could not produce a legal prepared plan');
  }
  if (selectedPlan.actionId !== actionId) {
    fail('operation:intervention:invalid-action', 'preview did not retain the requested Action');
  }
  if (draft.targetActorId !== undefined && selectedPlan.targetActorId !== draft.targetActorId) {
    fail('operation:intervention:invalid-target', 'preview did not retain the requested target');
  }

  for (let index = 0; index < baselineBeat.actorPlans.length; index += 1) {
    const baselinePlan = baselineBeat.actorPlans[index];
    if (baselinePlan.actorId === draft.actorId) continue;
    const checkedPlan = previewBeat.actorPlans[index];
    const stillWaiting = baselinePlan.kind === 'wait' && checkedPlan.kind === 'wait';
    if (!stillWaiting && !samePlan(baselinePlan, checkedPlan)) {
      fail('operation:intervention:plan-conflict', 'Draft would change another Actor plan or its reserved resources');
    }
  }

  const safeDraft: OperationInterventionDraft = {
    actorId: draft.actorId,
    ...(draft.actionId !== undefined ? { actionId: draft.actionId } : {}),
    ...(draft.targetActorId !== undefined ? { targetActorId: draft.targetActorId } : {}),
    ...(draft.reasonId !== undefined ? { reasonId: draft.reasonId } : {}),
  };
  const finalBeat = freezeTree({
    planVersion: baselineBeat.planVersion,
    locationId: baselineBeat.locationId,
    actorPlans: baselineBeat.actorPlans.map(plan => plan.actorId === draft.actorId ? selectedPlan : plan),
  });
  return freezeTree({ planVersion: preparedBeat.planVersion, draft: safeDraft, preparedBeat: finalBeat });
}
