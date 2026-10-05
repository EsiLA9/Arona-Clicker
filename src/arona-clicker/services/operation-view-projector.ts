import type { EventRun, OperationActorDef, OperationEventDef, OperationStudentProfileSnapshot } from '../contracts/operation';
import type { OperationActionDef, OperationActionTargetDef } from '../contracts/operation-action';
import type { OperationViewSceneAction } from '../contracts/operation-view';
import type { OperationPlayerSceneCardInstanceDef } from '../contracts/operation';
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
import { createOperationPlayerSceneCardInstances } from './operation-player-scene-deck';
import { isOperationObjectiveSatisfied, isOperationOutcomeConditionSatisfied } from './operation-progress-evaluator';
import { evaluateOperationRoutes } from './operation-route-evaluator';

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
  const enabledActionIds = new Set(event.locations
    .find(row => row.id === preparedBeat.locationId)?.enabledActionIds ?? []);
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
    displayName: actor.displayName ?? actor.type,
    avatarRef: actor.avatarRef ?? null,
    ...(actor.participantKind ? { participantKind: actor.participantKind } : {}),
    ...(actor.characterId ? { characterId: actor.characterId } : {}),
    ...(actor.factionId ? { factionId: actor.factionId } : {}),
    ...(actor.teamId ? { teamId: actor.teamId } : {}),
    hp: actor.hp,
    maxHp: actor.maxHp ?? actor.hp,
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

function projectSceneActions(
  run: EventRun,
  content: OperationViewProjectionContent,
): readonly OperationViewSceneAction[] {
  const location = content.eventDefinition.locations.find(row => row.id === run.currentLocationId);
  if (!location?.sceneActions) return [];
  const actionsById = new Map(content.actionDefinitions.map(action => [action.id, action]));
  const statesById = new Map(run.actorStates.map(actor => [actor.id, actor]));
  const actorsById = new Map(content.eventDefinition.actors.map(actor => [actor.id, actor]));
  const initializationsById = new Map(content.actors.map(actor => [actor.actorId, actor]));
  const event = content.eventDefinition;
  return location.sceneActions.map(sceneAction => {
    const action = actionsById.get(sceneAction.actionId);
    const eligibleActorIds = content.eventDefinition.actors
      .filter(actorDefinition => {
        const state = statesById.get(actorDefinition.id);
        const initialization = initializationsById.get(actorDefinition.id);
        const actor = actorsById.get(actorDefinition.id);
        return state?.participantKind === 'student' && state.hp > 0
          && initialization?.participantKind === 'student' && actor !== undefined && action !== undefined
          && action.allowedParticipantKinds.includes(state.participantKind)
          && initialization.profile.eligibleActionIds.includes(action.id)
          && action.requiredCapabilityIds.every(id => initialization.profile.capabilityIds.includes(id));
      })
      .map(actor => actor.id);
    const legalTargetActorIdsByActorId = Object.fromEntries(eligibleActorIds.map(actorId => {
      const source = actorsById.get(actorId)!;
      const targetIds = action?.target.kind === 'none'
        ? []
        : action
          ? targetCandidates(event, source, action.target).filter(targetId => (statesById.get(targetId)?.hp ?? 0) > 0)
          : [];
      return [actorId, targetIds];
    }));
    return {
      id: sceneAction.id,
      actionId: sceneAction.actionId,
      scope: sceneAction.scope,
      playerCost: sceneAction.playerCost,
      eligibleActorIds,
      legalTargetActorIdsByActorId,
    };
  });
}

function projectSceneCardCandidates(
  run: EventRun,
  content: OperationViewProjectionContent,
  actionId: string,
): Pick<OperationView['playerCards']['hand'][number], 'eligibleActorIds' | 'legalTargetActorIdsByActorId'> {
  const event = content.eventDefinition;
  const action = content.actionDefinitions.find(row => row.id === actionId);
  if (!action || action.cost !== undefined) return { eligibleActorIds: [], legalTargetActorIdsByActorId: {} };

  const statesById = new Map(run.actorStates.map(actor => [actor.id, actor]));
  const initializationsById = new Map(content.actors.map(actor => [actor.actorId, actor]));
  const eligibleActorIds = event.actors.flatMap(actor => {
    const state = statesById.get(actor.id);
    const initialization = initializationsById.get(actor.id);
    const eligible = state?.participantKind === 'student' && state.hp > 0
      && initialization?.participantKind === 'student'
      && action.allowedParticipantKinds.includes('student')
      && initialization.profile.eligibleActionIds.includes(action.id)
      && action.requiredCapabilityIds.every(id => initialization.profile.capabilityIds.includes(id));
    return eligible ? [actor.id] : [];
  });
  const legalTargetActorIdsByActorId = Object.fromEntries(eligibleActorIds.map(actorId => {
    const source = event.actors.find(actor => actor.id === actorId)!;
    const targets = action.target.kind === 'none'
      ? []
      : targetCandidates(event, source, action.target).filter(targetId => statesById.has(targetId));
    return [actorId, targets];
  }));
  return { eligibleActorIds, legalTargetActorIdsByActorId };
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
  const currentLocation = content.eventDefinition.locations
    .find(row => row.id === run.currentLocationId);
  const routeAvailability = evaluateOperationRoutes(content.eventDefinition, run);
  const view: OperationView = {
    runId: run.runId,
    eventId: run.eventId,
    status: run.status,
    rewardClaimed: run.rewardClaimed,
    currentLocationId: run.currentLocationId,
    planVersion: run.planVersion,
    beatIndex: run.beatIndex,
    tracks: { ...run.eventState.tracks },
    knownFactIds: [...run.eventState.knownFactIds],
    heldItemIds: [...run.eventState.heldItemIds],
    objectives: (content.eventDefinition.objectives ?? []).map(objective => ({
      id: objective.id,
      description: objective.description,
      kind: objective.kind,
      achieved: isOperationObjectiveSatisfied(run.eventState, objective),
    })),
    currentLocationObjectives: (currentLocation?.objectives ?? []).map(objective => ({
      id: objective.id,
      description: objective.description,
      kind: objective.kind,
      achieved: isOperationObjectiveSatisfied(run.eventState, objective),
    })),
    partialOutcomes: (content.eventDefinition.partialOutcomes ?? []).map(condition => ({
      id: condition.id,
      description: condition.description,
      met: isOperationOutcomeConditionSatisfied(run.eventState, condition),
    })),
    hardFailureConditions: (content.eventDefinition.hardFailureConditions ?? []).map(condition => ({
      id: condition.id,
      description: condition.description,
      met: isOperationOutcomeConditionSatisfied(run.eventState, condition),
    })),
    actorStates: run.actorStates.map(actor => projectActor(run, preparationContent, snapshot, actor, effectiveBeat)),
    teamStates: run.teamStates.map(team => ({ id: team.id, resources: { ...team.resources } })),
    locationProgress: { ...run.locationProgress },
    routeHistory: run.routeHistory.map(entry => ({ ...entry })),
    locationEntryCostHistory: run.locationEntryCostHistory?.map(entry => ({ ...entry })) ?? [],
    currentRoutes: routeAvailability.options.map(({ route, available, lockedReason }) => ({
      routeId: route.id,
      targetLocationId: route.targetLocationId,
      label: route.label,
      description: route.description,
      available,
      lockedReason,
      requiredHeldItemId: route.requiredHeldItemId ?? null,
      consumesHeldItem: route.consumeRequiredHeldItem === true,
    })),
    totalLocationVisits: routeAvailability.totalLocationVisits,
    maxLocationVisits: content.eventDefinition.maxLocationVisits,
    playerCost: run.playerRouteState.playerCost,
    maxCarryCost: currentLocation?.maxCarryCost ?? null,
    currentActionMode: currentLocation?.actionMode ?? null,
    currentSceneActions: projectSceneActions(run, content),
    pendingSceneActionBatch: run.pendingSceneActionBatch ? {
      command: {
        ...run.pendingSceneActionBatch.command,
        selections: run.pendingSceneActionBatch.command.selections.map(selection => ({
          ...selection,
          targetActorIds: [...selection.targetActorIds],
        })),
        ...(run.pendingSceneActionBatch.command.cards ? {
          cards: run.pendingSceneActionBatch.command.cards.map(selection => ({
            ...selection,
            targetActorIds: [...selection.targetActorIds],
          })),
        } : {}),
      },
      preview: {
        ...run.pendingSceneActionBatch.preview,
        selections: run.pendingSceneActionBatch.preview.selections.map(selection => ({
          ...selection,
          targetActorIds: [...selection.targetActorIds],
        })),
        cards: run.pendingSceneActionBatch.preview.cards.map(selection => ({
          ...selection,
          targetActorIds: [...selection.targetActorIds],
        })),
        cost: { ...run.pendingSceneActionBatch.preview.cost },
      },
    } : null,
    playerCards: projectPlayerCards(run, content),
    sceneActionBatchesUsed: run.locationProgress[run.currentLocationId]?.sceneActionBatchesUsed ?? 0,
    sceneActionBatchesRemaining: Math.max(0,
      (currentLocation?.sceneActionBatches ?? 0) - (run.locationProgress[run.currentLocationId]?.sceneActionBatchesUsed ?? 0)),
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
  readonly playerSceneCardInstances?: readonly OperationPlayerSceneCardInstanceDef[];
}

function projectPlayerCards(
  run: EventRun,
  content: OperationViewProjectionContent,
): OperationView['playerCards'] {
  const instances = content.playerSceneCardInstances ?? createOperationPlayerSceneCardInstances(content.eventDefinition);
  const byId = new Map(instances.map(card => [card.cardInstanceId, card]));
  return {
    drawPileCount: run.playerRouteState.cards.drawPile.length,
    hand: run.playerRouteState.cards.hand.flatMap(cardInstanceId => {
      const card = byId.get(cardInstanceId);
      return card ? [{ ...card, ...projectSceneCardCandidates(run, content, card.actionId) }] : [];
    }),
    discardCount: run.playerRouteState.cards.discard.length,
    maxHandSize: content.eventDefinition.playerSceneDeck?.maxHandSize ?? 0,
  };
}
