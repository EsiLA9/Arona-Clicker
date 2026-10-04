import type { EventRun, OperationActorDef, OperationEventDef, OperationStudentProfileSnapshot } from '../contracts/operation';
import type { OperationActionDef, OperationActionTargetDef } from '../contracts/operation-action';
import type {
  OperationInterventionDraft,
  OperationPreparationContent,
  OperationPreparationSnapshot,
  PreparedBeat,
} from '../contracts/operation-beat';
import {
  OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE,
  OPERATION_WAIT_REASON_NO_LEGAL_TARGET,
} from '../contracts/operation-beat';
import type { OperationView, OperationViewActionOption, OperationViewActor, OperationViewResolution } from '../contracts/operation-view';
import { previewOperationIntervention, OperationInterventionPreviewError } from './operation-intervention-preview';
import { resolveOperationCombinations } from './operation-combination-resolver';

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
  }
  return value;
}

function cloneRun(run: EventRun): EventRun {
  return JSON.parse(JSON.stringify(run)) as EventRun;
}

function targetCandidates(
  event: OperationEventDef,
  source: OperationActorDef,
  target: OperationActionTargetDef,
): readonly string[] {
  if (target.kind === 'none') return [];
  let candidates: readonly string[];
  switch (target.relation) {
    case 'self': candidates = [source.id]; break;
    case 'sameTeam':
      candidates = source.teamId
        ? event.actors.filter(actor => actor.teamId === source.teamId).map(actor => actor.id)
        : [];
      break;
    case 'otherTeam':
      candidates = source.teamId
        ? event.actors.filter(actor => actor.teamId !== undefined && actor.teamId !== source.teamId).map(actor => actor.id)
        : [];
      break;
    case 'any': candidates = event.actors.map(actor => actor.id); break;
  }
  const candidateIds = new Set(candidates);
  const preferred = (source.targetPriorityActorIds ?? []).filter(actorId => candidateIds.has(actorId));
  return [...preferred, ...candidates.filter(actorId => !preferred.includes(actorId))];
}

function candidateOptions(
  actorId: string,
  profile: OperationStudentProfileSnapshot,
  event: OperationEventDef,
  actionDefinitions: readonly OperationActionDef[],
  preparationContent: OperationPreparationContent,
  preparationSnapshot: OperationPreparationSnapshot,
  preparedBeat: PreparedBeat,
  currentDraft: OperationInterventionDraft | null,
): readonly OperationViewActionOption[] {
  const eventActor = event.actors.find(actor => actor.id === actorId);
  if (!eventActor) return [];
  const enabledActionIds = new Set(event.locationTactics
    ?.find(row => row.locationId === preparedBeat.locationId)?.enabledActionIds ?? []);
  const planByActorId = new Map(preparedBeat.actorPlans.map(plan => [plan.actorId, plan]));

  return profile.actionCandidates.map(candidate => {
    const action = actionDefinitions.find(row => row.id === candidate.actionId);
    const enabledAtLocation = enabledActionIds.has(candidate.actionId);
    const blockedReasonIds: string[] = [];
    const rejectedPreviewReasonIds: string[] = [];
    const legalTargetActorIds: string[] = [];
    let defaultTargetActorId: string | null = null;
    const canDirectActor = currentDraft === null || currentDraft.actorId === actorId;
    if (!candidate.eligible) blockedReasonIds.push('operation:intervention:invalid-action');
    if (!enabledAtLocation) blockedReasonIds.push('operation:intervention:action-not-enabled');
    if (!canDirectActor) blockedReasonIds.push('operation:intervention:student-slot-occupied');
    if (!action) blockedReasonIds.push('operation:intervention:invalid-action');

    if (candidate.eligible && enabledAtLocation && canDirectActor && action) {
      const tryPreview = (targetActorId?: string): void => {
        const draft = {
          actorId,
          actionId: candidate.actionId,
          ...(targetActorId !== undefined ? { targetActorId } : {}),
        };
        try {
          const preview = previewOperationIntervention({
            snapshot: preparationSnapshot,
            trustedContent: preparationContent,
            preparedBeat,
            currentDraft,
            draft,
          });
          const plan = preview.preparedBeat.actorPlans.find(row => row.actorId === actorId);
          if (plan?.kind !== 'studentAction') {
            blockedReasonIds.push('operation:intervention:invalid-action');
            return;
          }
          if (targetActorId !== undefined) legalTargetActorIds.push(targetActorId);
          if (defaultTargetActorId === null) defaultTargetActorId = plan.targetActorId;
        } catch (error) {
          const code = error instanceof OperationInterventionPreviewError
            ? error.code
            : 'operation:intervention:invalid-action';
          rejectedPreviewReasonIds.push(code);
        }
      };

      if (action.target.kind === 'none') {
        tryPreview();
      } else {
        const targets = targetCandidates(event, eventActor, action.target);
        tryPreview();
        targets.forEach(targetActorId => tryPreview(targetActorId));
        if (legalTargetActorIds.length === 0 && !rejectedPreviewReasonIds.length) rejectedPreviewReasonIds.push('operation:intervention:no-legal-target');
      }
    }

    const basePlan = planByActorId.get(actorId);
    const selectable = candidate.eligible
      && enabledAtLocation
      && canDirectActor
      && (action?.target.kind === 'none'
        ? !blockedReasonIds.length && rejectedPreviewReasonIds.length === 0
        : legalTargetActorIds.length > 0);
    return {
      actionId: candidate.actionId,
      eligible: candidate.eligible,
      enabledAtLocation,
      requiredCapabilityIds: [...candidate.requiredCapabilityIds],
      missingCapabilityIds: [...candidate.missingCapabilityIds],
      reasonIds: [...candidate.reasonIds],
      cost: action?.cost ? { ...action.cost } : null,
      selectable,
      defaultTargetActorId: basePlan?.actionId === candidate.actionId
        ? basePlan.targetActorId
        : legalTargetActorIds[0] ?? defaultTargetActorId,
      legalTargetActorIds: [...new Set(legalTargetActorIds)],
      blockedReasonIds: [...new Set([...blockedReasonIds, ...(legalTargetActorIds.length === 0 ? rejectedPreviewReasonIds : [])])],
    };
  });
}

function projectResolution(resolution: EventRun['resolutions'][number]): OperationViewResolution {
  const { randomCursorBefore: _randomCursorBefore, randomCursorAfter: _randomCursorAfter, studentSkillChecks, ...safe } = resolution;
  return {
    ...safe,
    studentSkillChecks: studentSkillChecks.map(({ actorId, skillRuleId, actionId, succeeded }) => ({
      actorId,
      skillRuleId,
      actionId,
      succeeded,
    })),
  };
}

function projectionSnapshot(run: EventRun): OperationPreparationSnapshot {
  return {
    eventId: run.eventId,
    planVersion: run.planVersion,
    currentLocationId: run.currentLocationId,
    actors: run.actorStates.map(actor => {
      if (!actor.participantKind) throw new Error('OperationView requires admitted participant kinds');
      return { actorId: actor.id, participantKind: actor.participantKind, resources: actor.resources };
    }),
    teams: run.teamStates,
  };
}

function activeBeat(
  run: EventRun,
  content: OperationPreparationContent,
  snapshot: OperationPreparationSnapshot,
): PreparedBeat | null {
  if (!run.preparedBeat) return null;
  if (!run.interventionDraft) return run.preparedBeat;
  return previewOperationIntervention({
    snapshot,
    trustedContent: content,
    preparedBeat: run.preparedBeat,
    currentDraft: run.interventionDraft,
    draft: run.interventionDraft,
  }).preparedBeat;
}

function projectActor(
  run: EventRun,
  content: OperationPreparationContent | null,
  snapshot: OperationPreparationSnapshot,
  actor: EventRun['actorStates'][number],
  beat: PreparedBeat | null,
): OperationViewActor {
  const currentPlan = beat?.actorPlans.find(plan => plan.actorId === actor.id) ?? null;
  const identity: Omit<OperationViewActor, 'currentPlan'> = {
    id: actor.id,
    type: actor.type,
    ...(actor.participantKind ? { participantKind: actor.participantKind } : {}),
    ...(actor.characterId ? { characterId: actor.characterId } : {}),
    ...(actor.factionId ? { factionId: actor.factionId } : {}),
    ...(actor.teamId ? { teamId: actor.teamId } : {}),
    hp: actor.hp,
    resources: { ...actor.resources },
  };
  if (!actor.profile || !content) return { ...identity, currentPlan };
  return {
    ...identity,
    currentPlan,
    profile: {
      id: actor.profile.id,
      capabilityIds: [...actor.profile.capabilityIds],
      reasonIds: [...actor.profile.reasonIds],
      ...(actor.profile.randomSkillRuleId ? { randomSkillRuleId: actor.profile.randomSkillRuleId } : {}),
      actionOptions: beat && run.preparedBeat ? candidateOptions(
        actor.id,
        actor.profile,
        content.eventDefinition,
        content.actionDefinitions,
        content,
        snapshot,
        run.preparedBeat!,
        run.interventionDraft,
      ) : [],
    },
  };
}

export function projectOperationView(
  sourceRun: EventRun,
  content: OperationViewProjectionContent,
): OperationView {
  const run = cloneRun(sourceRun);
  const preparationContent: OperationPreparationContent = {
    eventDefinition: content.eventDefinition,
    actors: content.actors,
    actionDefinitions: content.actionDefinitions,
  };
  const snapshot = projectionSnapshot(run);
  const effectiveBeat = activeBeat(run, preparationContent, snapshot);
  const plans = effectiveBeat?.actorPlans;
  const commitmentBlockedReasons = new Set<string>();
  if (run.status !== 'inProgress') commitmentBlockedReasons.add('operation:run:terminal');
  if (!run.preparedBeat) commitmentBlockedReasons.add('operation:view:no-prepared-beat');
  for (const plan of plans ?? []) {
    if (plan.participantKind !== 'student' || plan.kind !== 'wait') continue;
    for (const reasonId of plan.reasonIds) {
      if (reasonId === OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE
        || reasonId === OPERATION_WAIT_REASON_NO_LEGAL_TARGET) {
        commitmentBlockedReasons.add(reasonId);
      }
    }
  }
  const combinationPreview = effectiveBeat
    ? resolveOperationCombinations(
      preparationContent.eventDefinition,
      effectiveBeat,
      preparationContent.actionDefinitions,
    )
    : null;
  const view: OperationView = {
    runId: run.runId,
    eventId: run.eventId,
    status: run.status,
    currentLocationId: run.currentLocationId,
    planVersion: run.planVersion,
    beatIndex: run.beatIndex,
    tracks: { ...run.eventState.tracks },
    knownFactIds: [...run.eventState.knownFactIds],
    heldItemIds: [...run.eventState.heldItemIds],
    actorStates: run.actorStates.map(actor => projectActor(run, preparationContent, snapshot, actor, effectiveBeat)),
    teamStates: run.teamStates.map(team => ({ id: team.id, resources: { ...team.resources } })),
    locationProgress: { ...run.locationProgress },
    basePreparedBeat: run.preparedBeat,
    effectivePreparedBeat: effectiveBeat && plans ? { ...effectiveBeat, actorPlans: [...plans] } : null,
    interventionDraft: run.interventionDraft,
    combinationPreview,
    canCommit: commitmentBlockedReasons.size === 0,
    commitBlockedReasonIds: [...commitmentBlockedReasons],
    resolutions: run.resolutions.map(projectResolution),
    resolutionSequence: run.resolutionSequence,
  };
  return freezeTree(view);
}

export interface OperationViewProjectionContent {
  readonly eventDefinition: OperationEventDef;
  readonly actors: OperationPreparationContent['actors'];
  readonly actionDefinitions: readonly OperationActionDef[];
}
