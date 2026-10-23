import { OPERATION_NO_ELIGIBLE_ACTION_REASON_ID, OPERATION_WAIT_ACTION_ID, type EventRun, type OperationActionCandidateSnapshot, type OperationEventDef, type OperationStudentProfileSnapshot } from '../../contracts/operation/operation';
import type { OperationActionDef } from '../../contracts/operation/operation-action';
import { getOperationTargetActorIds } from './operation-target-selection';
import type { OperationViewSceneAction } from '../../contracts/operation/operation-view';
import type { OperationPlayerSceneCardInstanceDef } from '../../contracts/operation/operation';
import type {
  OperationInterventionDraft,
  OperationPreparationContent,
  OperationPreparationSnapshot,
  PreparedBeat,
} from '../../contracts/operation/operation-beat';
import {
  OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY,
  OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE,
  OPERATION_WAIT_REASON_NO_LEGAL_TARGET,
} from '../../contracts/operation/operation-beat';
import type {
  OperationView,
  OperationViewActionOffer,
  OperationViewActionOption,
  OperationViewActor,
  OperationViewResolution,
  OperationViewScene,
  OperationViewScenePurchaseOffer,
  OperationViewSceneActionChoice,
  OperationViewSceneStatus,
} from '../../contracts/operation/operation-view';
import { previewOperationIntervention, OperationInterventionPreviewError } from './operation-intervention-preview';
import { resolveOperationCombinations } from './operation-combination-resolver';
import { createOperationPlayerSceneCardInstances } from './operation-player-scene-deck';
import {
  getNextOperationSceneId,
  getOperationSceneDefinitions,
  isOperationObjectiveSatisfied,
  isOperationOutcomeConditionSatisfied,
} from './operation-progress-evaluator';
import { evaluateOperationRoutes } from './operation-route-evaluator';

function eventContentForCurrentScene(event: OperationEventDef, run: EventRun): OperationEventDef | null {
  const location = event.locations.find(row => row.id === run.currentLocationId);
  const progress = run.locationProgress[run.currentLocationId];
  if (!location || !progress) return null;
  const sceneId = getNextOperationSceneId(location, progress);
  if (!sceneId) return null;
  const scene = getOperationSceneDefinitions(location).find(row => row.id === sceneId);
  if (!scene) return null;
  if (location.scenes === undefined) return event;
  const scopedLocation = {
    ...location,
    enabledActionIds: scene.enabledActionIds ?? location.enabledActionIds,
    actionMode: scene.actionMode,
    sceneActions: scene.sceneActions,
    sceneActionBatches: scene.sceneActionBatches,
    sceneActionChoice: scene.sceneActionChoice,
    purchaseOffers: scene.purchaseOffers,
  };
  return { ...event, locations: event.locations.map(row => row.id === location.id ? scopedLocation : row) };
}

function projectScenes(run: EventRun, event: OperationEventDef): readonly OperationViewScene[] {
  const location = event.locations.find(row => row.id === run.currentLocationId);
  const progress = run.locationProgress[run.currentLocationId];
  if (!location || !progress) return [];
  const definitions = getOperationSceneDefinitions(location);
  const completed = new Set(progress.completedSceneIds ?? []);
  const activeSceneId = getNextOperationSceneId(location, progress);
  return definitions.map((scene, index) => {
    let status: OperationViewSceneStatus;
    if (progress.completed || completed.has(scene.id)) status = 'completed';
    else if (scene.id === activeSceneId && run.status === 'inProgress') status = 'active';
    else status = 'ready';
    return {
      sceneId: scene.id,
      title: scene.title.trim() ? scene.title : null,
      description: scene.description ?? null,
      status,
      index: index + 1,
      count: definitions.length,
      ...(scene.autoCharacterActions === true ? { autoCharacterActions: true } : {}),
      completion: scene.completion ?? null,
    };
  });
}

function projectActionOffers(
  sceneId: string | null,
  actors: readonly OperationViewActor[],
  sceneActions: readonly OperationViewSceneAction[],
  playerCards: OperationView['playerCards'],
  purchases: readonly OperationViewScenePurchaseOffer[],
): readonly OperationViewActionOffer[] {
  if (!sceneId) return [];
  const offers: OperationViewActionOffer[] = [];
  for (const actor of actors) {
    for (const option of actor.profile?.actionOptions ?? []) {
      offers.push({
        offerId: 'student-action:' + encodeURIComponent(sceneId) + ':' + encodeURIComponent(actor.id) + ':' + encodeURIComponent(option.actionId),
        source: 'student-action',
        sceneId,
        actorId: actor.id,
        actionId: option.actionId,
        option,
      });
    }
  }
  for (const action of sceneActions) {
    offers.push({
      offerId: 'scene-action:' + encodeURIComponent(sceneId) + ':' + encodeURIComponent(action.id),
      source: 'scene-action',
      sceneId,
      sceneActionId: action.id,
      actionId: action.actionId,
      action,
    });
  }
  for (const card of playerCards.hand) {
    offers.push({
      offerId: 'player-scene-card:' + encodeURIComponent(sceneId) + ':' + encodeURIComponent(card.cardInstanceId),
      source: 'player-scene-card',
      sceneId,
      cardInstanceId: card.cardInstanceId,
      actionId: card.actionId,
      card,
    });
  }
  for (const purchase of purchases) {
    offers.push({
      offerId: 'purchase:' + encodeURIComponent(sceneId) + ':' + encodeURIComponent(purchase.id),
      source: 'purchase',
      sceneId,
      purchaseOfferId: purchase.id,
      actionId: purchase.actionId,
      purchase,
    });
  }
  return offers;
}

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
  const targetActorStates = new Map(preparationSnapshot.actors.map(actor => [actor.actorId, actor]));

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
        const targets = getOperationTargetActorIds(event, actorId, action.target, targetActorStates);
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
      title: action?.title ?? candidate.actionId,
      description: action?.description ?? null,
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
      targetSelectionMode: action?.target.kind === 'actor' ? action.target.selectionMode ?? 'select' : 'select',
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

function projectionSnapshot(run: EventRun, eventDefinition: OperationEventDef): OperationPreparationSnapshot {
  const location = eventDefinition.locations.find(row => row.id === run.currentLocationId);
  const progress = run.locationProgress[run.currentLocationId];
  const activeSceneId = location && progress ? getNextOperationSceneId(location, progress) : null;
  const activeScene = location?.scenes?.find(scene => scene.id === activeSceneId);
  const autoCharacterActions = location?.stage === 'scene' && activeScene?.autoCharacterActions === true;
  const handIds = (actorId: string, profile: OperationStudentProfileSnapshot): readonly string[] => {
    const hand = run.characterHands?.[actorId]?.actionIds ?? [];
    const handSet = new Set(hand);
    const seen = new Set<string>();
    return [...profile.actionPriorityIds, ...profile.candidateActionIds, ...hand].filter(actionId => {
      if (!handSet.has(actionId) || seen.has(actionId)) return false;
      seen.add(actionId);
      return true;
    });
  };
  return {
    eventId: run.eventId,
    planVersion: run.planVersion,
    currentLocationId: run.currentLocationId,
    actors: run.actorStates.map(actor => {
      if (!actor.participantKind) throw new Error('OperationView requires admitted participant kinds');
      return {
        actorId: actor.id,
        participantKind: actor.participantKind,
        hp: actor.hp,
        ...(actor.positionId !== undefined ? { positionId: actor.positionId } : {}),
        resources: actor.resources,
      };
    }),
    teams: run.teamStates,
    ...(autoCharacterActions ? {
      actorIds: run.actorStates.filter(actor => actor.participantKind === 'student' && actor.hp > 0).map(actor => actor.id),
      studentActionIdsByActorId: Object.fromEntries(run.actorStates.flatMap(actor => actor.participantKind === 'student' && actor.profile
        ? [[actor.id, handIds(actor.id, actor.profile)]] : [])),
    } : {}),
  };
}

function bindCharacterHands(run: EventRun, content: OperationPreparationContent): OperationPreparationContent {
  const actionsById = new Map(content.actionDefinitions.map(action => [action.id, action]));
  return {
    ...content,
    actors: content.actors.map(initialization => {
      if (initialization.participantKind !== 'student') return initialization;
      const rawIds = run.characterHands?.[initialization.actorId]?.actionIds;
      if (!rawIds) return initialization;
      const hand = new Set(rawIds);
      const seen = new Set<string>();
      const actionIds = [...initialization.profile.actionPriorityIds, ...initialization.profile.candidateActionIds, ...rawIds]
        .filter(id => hand.has(id) && !seen.has(id) && Boolean(seen.add(id)));
      const actionCandidates: OperationActionCandidateSnapshot[] = actionIds.map(actionId => {
        const action = actionsById.get(actionId);
        if (!action) throw new Error('Character Hand references a missing Action: ' + actionId);
        const missingCapabilityIds = action.requiredCapabilityIds.filter(id => !initialization.profile.capabilityIds.includes(id));
        return {
          actionId,
          eligible: missingCapabilityIds.length === 0,
          requiredCapabilityIds: [...action.requiredCapabilityIds],
          missingCapabilityIds,
          reasonIds: [...new Set([...initialization.profile.reasonIds, ...action.reasonIds])],
        };
      });
      const eligibleActionIds = actionCandidates.filter(candidate => candidate.eligible).map(candidate => candidate.actionId);
      const profile: OperationStudentProfileSnapshot = {
        ...initialization.profile,
        candidateActionIds: actionIds,
        actionPriorityIds: initialization.profile.actionPriorityIds.filter(id => hand.has(id)),
        actionCandidates,
        eligibleActionIds,
        ...(eligibleActionIds.length === 0
          ? { fallback: { actionId: OPERATION_WAIT_ACTION_ID, reasonIds: [OPERATION_NO_ELIGIBLE_ACTION_REASON_ID] } }
          : { fallback: undefined }),
      };
      return { ...initialization, profile };
    }),
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
    ...(actor.positionId !== undefined ? { positionId: actor.positionId } : {}),
    maxHp: actor.maxHp ?? actor.hp,
    resources: { ...actor.resources },
    ...(run.characterHands?.[actor.id] ? { characterHand: {
      actorId: run.characterHands[actor.id].actorId,
      actionIds: [...run.characterHands[actor.id].actionIds],
      matchedPoolIds: [...run.characterHands[actor.id].matchedPoolIds],
      candidates: run.characterHands[actor.id].candidates.map(candidate => ({
        ...candidate,
        sourcePoolIds: [...candidate.sourcePoolIds],
        reasonIds: [...candidate.reasonIds],
      })),
    } } : {}),
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
  const initializationsById = new Map(content.actors.map(actor => [actor.actorId, actor]));
  const event = content.eventDefinition;
  return location.sceneActions.map(sceneAction => {
    const action = actionsById.get(sceneAction.actionId);
    const performerPolicy = sceneAction.performerPolicy ?? 'selected-student';
    const eligibleActorIds = content.eventDefinition.actors
      .filter(actorDefinition => {
        if (performerPolicy === 'none') return false;
        const state = statesById.get(actorDefinition.id);
        const initialization = initializationsById.get(actorDefinition.id);
        return state?.participantKind === 'student' && state.hp > 0
          && initialization?.participantKind === 'student' && action !== undefined
          && action.allowedParticipantKinds.includes(state.participantKind)
          && action.requiredCapabilityIds.every(id => initialization.profile.capabilityIds.includes(id));
      })
      .map(actor => actor.id);
  const legalTargetActorIdsByActorId = Object.fromEntries(eligibleActorIds.map(actorId => {
      const targetIds = action?.target.kind === 'none'
        ? []
        : action
          ? getOperationTargetActorIds(event, actorId, action.target, statesById)
          : [];
      return [actorId, targetIds];
    }));
    return {
      id: sceneAction.id,
      actionId: sceneAction.actionId,
      title: sceneAction.title ?? action?.title ?? sceneAction.id,
      description: sceneAction.description ?? action?.description ?? null,
      scope: sceneAction.scope,
      playerCost: sceneAction.playerCost,
      targetSelectionMode: action?.target.kind === 'actor' ? action.target.selectionMode ?? 'select' : 'select',
      selectionPolicy: sceneAction.selectionPolicy ?? 'required',
      performerPolicy,
      eligibleActorIds,
      legalTargetActorIdsByActorId,
      legalActorlessTargetActorIds: (performerPolicy === 'none' || performerPolicy === 'optional-student') && action
        ? getOperationTargetActorIds(event, null, action.target, statesById)
        : [],
    };
  });
}

function purchaseRewardPreview(action: OperationActionDef | undefined): readonly string[] {
  if (!action) return [];
  const description = action.description?.trim();
  if (description) return [description];
  const title = action.title.trim();
  return [title || '按内容定义应用奖励。'];
}

function projectScenePurchaseOffers(
  run: EventRun,
  content: OperationViewProjectionContent,
): readonly OperationViewScenePurchaseOffer[] {
  const location = content.eventDefinition.locations.find(row => row.id === run.currentLocationId);
  const actionsById = new Map(content.actionDefinitions.map(action => [action.id, action]));
  return (location?.purchaseOffers ?? []).map(offer => {
    const action = actionsById.get(offer.actionId);
    const purchased = run.eventState.knownFactIds.includes(offer.purchaseFactId);
    const affordable = run.playerRouteState.playerCost >= offer.playerCost;
    return {
      id: offer.id,
      actionId: offer.actionId,
      title: offer.title ?? action?.title ?? offer.id,
      description: offer.description ?? action?.description ?? null,
      playerCost: offer.playerCost,
      purchased,
      affordable,
      unavailableReason: purchased ? '已购买，本次 Run 仅可购买一次' : affordable ? null : 'PlayerCost 不足',
      rewardPreview: purchaseRewardPreview(action),
    };
  });
}

function projectSceneCardCandidates(
  run: EventRun,
  content: OperationViewProjectionContent,
  actionId: string,
  performerPolicy: 'selected-student' | 'none' | 'optional-student',
): Pick<OperationView['playerCards']['hand'][number], 'eligibleActorIds' | 'legalTargetActorIdsByActorId' | 'legalActorlessTargetActorIds' | 'targetSelectionMode'> {
  const event = content.eventDefinition;
  const action = content.actionDefinitions.find(row => row.id === actionId);
  if (!action) return { eligibleActorIds: [], legalTargetActorIdsByActorId: {}, legalActorlessTargetActorIds: [], targetSelectionMode: 'select' };

  const statesById = new Map(run.actorStates.map(actor => [actor.id, actor]));
  const initializationsById = new Map(content.actors.map(actor => [actor.actorId, actor]));
  const eligibleActorIds = performerPolicy === 'none' ? [] : event.actors.flatMap(actor => {
    const state = statesById.get(actor.id);
    const initialization = initializationsById.get(actor.id);
    const eligible = state?.participantKind === 'student' && state.hp > 0
      && initialization?.participantKind === 'student'
      && action.allowedParticipantKinds.includes('student')
      && action.requiredCapabilityIds.every(id => initialization.profile.capabilityIds.includes(id));
    return eligible ? [actor.id] : [];
  });
  const legalTargetActorIdsByActorId = Object.fromEntries(eligibleActorIds.map(actorId => {
    const targets = getOperationTargetActorIds(event, actorId, action.target, statesById);
    return [actorId, targets];
  }));
  return {
    eligibleActorIds,
    legalTargetActorIdsByActorId,
    legalActorlessTargetActorIds: performerPolicy === 'none' || performerPolicy === 'optional-student'
      ? getOperationTargetActorIds(event, null, action.target, statesById)
      : [],
    targetSelectionMode: action.target.kind === 'actor' ? action.target.selectionMode ?? 'select' : 'select',
  };
}

export function projectOperationView(
  sourceRun: EventRun,
  content: OperationViewProjectionContent,
): OperationView {
  const run = cloneRun(sourceRun);
  const originalLocation = content.eventDefinition.locations.find(row => row.id === run.currentLocationId);
  const currentLocationProgress = run.locationProgress[run.currentLocationId];
  const currentSceneId = originalLocation && currentLocationProgress && run.status === 'inProgress'
    ? getNextOperationSceneId(originalLocation, currentLocationProgress)
    : null;
  const scenes = projectScenes(run, content.eventDefinition);
  const currentScene = currentSceneId ? scenes.find(scene => scene.sceneId === currentSceneId) ?? null : null;
  const currentSceneDefinition = currentSceneId && originalLocation
    ? getOperationSceneDefinitions(originalLocation).find(scene => scene.id === currentSceneId) ?? null
    : null;
  const currentSceneBatchCount = originalLocation && currentLocationProgress && currentSceneDefinition
    ? originalLocation.scenes !== undefined
      ? currentLocationProgress.sceneActionBatchesUsedByScene?.[currentSceneDefinition.id] ?? 0
      : currentLocationProgress.sceneActionBatchesUsed ?? 0
    : 0;
  const currentSceneActionMode = currentSceneDefinition?.actionMode ?? null;
  const currentSceneHasBatch = currentSceneActionMode !== null || currentSceneDefinition?.autoCharacterActions === true;
  const currentSceneBatchLimit = currentSceneHasBatch ? currentSceneDefinition?.sceneActionBatches : 0;
  const activeEventDefinition = eventContentForCurrentScene(content.eventDefinition, run) ?? content.eventDefinition;
  const projectionContent: OperationViewProjectionContent = { ...content, eventDefinition: activeEventDefinition };
  const preparationContent: OperationPreparationContent = {
    eventDefinition: activeEventDefinition,
    actors: bindCharacterHands(run, { eventDefinition: activeEventDefinition, actors: content.actors, actionDefinitions: content.actionDefinitions }).actors,
    actionDefinitions: content.actionDefinitions,
  };
  const snapshot = projectionSnapshot(run, content.eventDefinition);
  const effectiveBeat = activeBeat(run, preparationContent, snapshot);
  const plans = effectiveBeat?.actorPlans;
  const commitmentBlockedReasons = new Set<string>();
  if (run.status !== 'inProgress') commitmentBlockedReasons.add('operation:run:terminal');
  if (!run.preparedBeat) commitmentBlockedReasons.add('operation:view:no-prepared-beat');
  for (const plan of originalLocation?.stage === 'combat' ? plans ?? [] : []) {
    if (plan.participantKind !== 'student' || plan.kind !== 'wait') continue;
    for (const reasonId of plan.reasonIds) {
      if (reasonId === OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE
        || reasonId === OPERATION_WAIT_REASON_NO_LEGAL_TARGET
        || reasonId === OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY) {
        commitmentBlockedReasons.add(reasonId);
      }
    }
  }
  const combinationPreview = effectiveBeat && originalLocation?.stage === 'combat'
    ? resolveOperationCombinations(
      preparationContent.eventDefinition,
      effectiveBeat,
      preparationContent.actionDefinitions,
    )
    : null;
  const currentLocation = content.eventDefinition.locations
    .find(row => row.id === run.currentLocationId);
  const routeAvailability = evaluateOperationRoutes(content.eventDefinition, run);
  const projectedActors = run.actorStates.map(actor => projectActor(run, preparationContent, snapshot, actor, effectiveBeat));
  const currentSceneActions = projectSceneActions(run, projectionContent);
  const currentScenePurchaseOffers = projectScenePurchaseOffers(run, projectionContent);
  const currentSceneActionChoice: OperationViewSceneActionChoice | null = currentSceneDefinition?.sceneActionChoice
    ? { ...currentSceneDefinition.sceneActionChoice, candidateSceneActionIds: [...currentSceneDefinition.sceneActionChoice.candidateSceneActionIds] }
    : null;
  const playerCards = projectPlayerCards(run, projectionContent);
  const actionOffers = projectActionOffers(currentSceneId, projectedActors, currentSceneActions, playerCards, currentScenePurchaseOffers);
  const view: OperationView = {
    runId: run.runId,
    eventId: run.eventId,
    eventTitle: content.eventDefinition.title ?? null,
    eventDescription: content.eventDefinition.description ?? null,
    status: run.status,
    rewardClaimed: run.rewardClaimed,
    currentLocationId: run.currentLocationId,
    currentStage: currentLocation!.stage,
    currentSceneId,
    currentScene,
    scenes,
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
    actorStates: projectedActors,
    actionPresentations: Object.fromEntries(content.actionDefinitions.map(action => [action.id, {
      title: action.title,
      description: action.description ?? null,
    }])),
    sceneActionPresentations: Object.fromEntries(content.eventDefinition.locations.flatMap(location =>
      [...(location.sceneActions ?? []), ...(location.scenes ?? []).flatMap(scene => scene.sceneActions ?? [])].map(sceneAction => {
        const action = content.actionDefinitions.find(row => row.id === sceneAction.actionId);
        return [sceneAction.id, {
          title: sceneAction.title ?? action?.title ?? sceneAction.id,
          description: sceneAction.description ?? action?.description ?? null,
        }];
      }))),
    purchaseOfferPresentations: Object.fromEntries(content.eventDefinition.locations.flatMap(location =>
      [...(location.purchaseOffers ?? []), ...(location.scenes ?? []).flatMap(scene => scene.purchaseOffers ?? [])].map(offer => {
        const action = content.actionDefinitions.find(row => row.id === offer.actionId);
        return [offer.id, {
          title: offer.title ?? action?.title ?? offer.id,
          description: offer.description ?? action?.description ?? null,
        }];
      }))),
    playerSceneCardPresentations: Object.fromEntries((content.playerSceneCardInstances
      ?? createOperationPlayerSceneCardInstances(content.eventDefinition)).map(card => {
      const action = content.actionDefinitions.find(row => row.id === card.actionId);
      return [card.cardInstanceId, {
        title: card.title ?? action?.title ?? card.cardDefId,
        description: card.description ?? action?.description ?? null,
      }];
    })),
    teamStates: run.teamStates.map(team => ({ id: team.id, resources: { ...team.resources } })),
    locationProgress: { ...run.locationProgress },
    routeHistory: run.routeHistory.map(entry => ({ ...entry })),
    locationEntryCostHistory: run.locationEntryCostHistory?.map(entry => ({ ...entry })) ?? [],
    timelineSequence: run.timelineSequence,
    currentRoutes: routeAvailability.options.map(({ route, available, lockedReason }) => ({
      routeId: route.id,
      targetLocationId: route.targetLocationId,
      label: route.label,
      description: route.description,
      available,
      lockedReason,
      requiredHeldItemId: route.requiredHeldItemId ?? null,
      anyOfHeldItemIds: [...(route.anyOfHeldItemIds ?? [])],
      consumesHeldItem: route.consumeRequiredHeldItem === true,
    })),
    map: {
      nodes: content.eventDefinition.locations.map(location => {
        const progress = run.locationProgress[location.id];
        return {
          locationId: location.id,
          visitCount: progress?.visitCount ?? 0,
          maxVisits: location.maxVisits ?? null,
          current: location.id === run.currentLocationId,
          visited: (progress?.visitCount ?? 0) > 0,
          completed: progress?.completed ?? false,
        };
      }),
      edges: content.eventDefinition.locations.flatMap(location => location.routeEdges.map(route => {
        const currentRoute = routeAvailability.options.find(option => option.route.id === route.id);
        return {
          routeId: route.id,
          sourceLocationId: location.id,
          targetLocationId: route.targetLocationId,
          label: route.label,
          description: route.description,
          available: currentRoute?.available ?? null,
          lockedReason: currentRoute?.lockedReason ?? null,
          requiredHeldItemId: route.requiredHeldItemId ?? null,
          anyOfHeldItemIds: [...(route.anyOfHeldItemIds ?? [])],
          consumesHeldItem: route.consumeRequiredHeldItem === true,
        };
      })),
    },
    totalLocationVisits: routeAvailability.totalLocationVisits,
    maxLocationVisits: content.eventDefinition.maxLocationVisits,
    playerCost: run.playerRouteState.playerCost,
    maxCarryCost: currentLocation?.maxCarryCost ?? null,
    currentActionMode: currentSceneActionMode,
    currentSceneActions,
    currentSceneActionChoice,
    currentScenePurchaseOffers,
    actionOffers,
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
        plan: {
          ...run.pendingSceneActionBatch.preview.plan,
          selections: run.pendingSceneActionBatch.preview.plan.selections.map(selection => ({
            ...selection,
            targetActorIds: [...selection.targetActorIds],
          })),
          cards: run.pendingSceneActionBatch.preview.plan.cards.map(selection => ({
            ...selection,
            targetActorIds: [...selection.targetActorIds],
          })),
        },
        selections: run.pendingSceneActionBatch.preview.selections.map(selection => ({
          ...selection,
          targetActorIds: [...selection.targetActorIds],
        })),
        cards: run.pendingSceneActionBatch.preview.cards.map(selection => ({
          ...selection,
          targetActorIds: [...selection.targetActorIds],
        })),
        cost: { ...run.pendingSceneActionBatch.preview.cost },
        ...(run.pendingSceneActionBatch.preview.actorPlans ? {
          actorPlans: run.pendingSceneActionBatch.preview.actorPlans.map(plan => ({ ...plan, reasonIds: [...plan.reasonIds] })),
        } : {}),
        ...(Object.prototype.hasOwnProperty.call(run.pendingSceneActionBatch.preview, 'intervention') ? {
          intervention: run.pendingSceneActionBatch.preview.intervention
            ? {
                ...run.pendingSceneActionBatch.preview.intervention,
                before: { ...run.pendingSceneActionBatch.preview.intervention.before, reasonIds: [...run.pendingSceneActionBatch.preview.intervention.before.reasonIds] },
                after: { ...run.pendingSceneActionBatch.preview.intervention.after, reasonIds: [...run.pendingSceneActionBatch.preview.intervention.after.reasonIds] },
              }
            : null,
        } : {}),
      },
    } : null,
    playerCards,
    sceneActionBatchesUsed: currentSceneBatchCount,
    sceneActionBatchesRemaining: currentSceneBatchLimit === undefined
      ? currentSceneHasBatch ? null : 0
      : Math.max(0, currentSceneBatchLimit - currentSceneBatchCount),
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
      if (!card) return [];
      const action = content.actionDefinitions.find(row => row.id === card.actionId);
      const performerPolicy = card.performerPolicy ?? 'selected-student';
      return [{
        ...card,
        title: card.title ?? action?.title ?? card.cardDefId,
        description: card.description ?? action?.description ?? null,
        selectionPolicy: card.selectionPolicy ?? 'required',
        performerPolicy,
        ...projectSceneCardCandidates(run, content, card.actionId, performerPolicy),
      }];
    }),
    discardCount: run.playerRouteState.cards.discard.length,
    maxHandSize: content.eventDefinition.playerSceneDeck?.maxHandSize ?? 0,
  };
}
