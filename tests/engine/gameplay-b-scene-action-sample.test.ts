import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SCENE_ACTION_IDS as IDS, carouselSceneActionSliceContent } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { carouselSafetySliceContent } from '../../src/arona-clicker/content/operation-samples/carousel-safety-slice';
import { Character } from '../../src/arona-clicker/types/ids';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { validateOperationActionContent } from '../../src/arona-clicker/services/operation-action-content-validation';
import { OperationAdmissionError } from '../../src/arona-clicker/services/operation-participant-admission';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const STUDENTS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANTS: Record<typeof STUDENTS[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};

describe('Gameplay B carousel SceneAction sample', () => {
  const games: GameInstance[] = [];

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('plays battle, Individual scene choices, held-item branch, Global action, card and one-time reward', () => {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    games.push(game);
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    for (const student of STUDENTS) game.mutations.acquireCharacter(VARIANTS[student], 'story');

    const runId = game.operationEntry.start(IDS.event, STUDENTS).runId;
    let run = game.operationEntry.getSnapshot()!;
    let sceneTacticalRandom = run.random;
    let view = game.operationEntry.getView(runId)!;
    expect(carouselSceneActionSliceContent.eventDefinition.locations.every(location => location.scenes === undefined)).toBe(true);
    expect(view).toMatchObject({
      currentLocationId: IDS.locations.platform,
      currentSceneId: 'main',
      currentScene: { sceneId: 'main', status: 'active', index: 1, count: 1 },
    });
    expect(view).toMatchObject({ currentLocationId: IDS.locations.platform, currentActionMode: null, playerCost: 5 });
    for (const actor of view.actorStates.filter(row => row.participantKind === 'student')) {
      const battleActionIds = actor.profile?.actionOptions.map(option => option.actionId) ?? [];
      for (const sceneActionId of Object.values(IDS.actions)) expect(battleActionIds).not.toContain(sceneActionId);
    }
    const scopedActions = [
      { actorId: IDS.actors.hoshino, actionId: CAROUSEL_SAFETY_IDS.actions.brace },
      { actorId: IDS.actors.serika, actionId: CAROUSEL_SAFETY_IDS.actions.signal },
      { actorId: IDS.actors.shiroko, actionId: CAROUSEL_SAFETY_IDS.actions.shield },
    ];
    for (const scopedAction of scopedActions) {
      const option = view.actorStates.find(actor => actor.id === scopedAction.actorId)
        ?.profile?.actionOptions.find(candidate => candidate.actionId === scopedAction.actionId);
      expect(option?.legalTargetActorIds).toEqual([IDS.actors.ride]);
    }
    const unchangedBeforeInvalidTarget = game.operationEntry.getSnapshot()!;
    expect(() => game.operationEntry.reviseIntervention({
      runId,
      planVersion: unchangedBeforeInvalidTarget.planVersion,
      draft: {
        actorId: IDS.actors.hoshino,
        actionId: CAROUSEL_SAFETY_IDS.actions.brace,
        targetActorId: IDS.actors.saboteur,
      },
    })).toThrow();
    expect(game.operationEntry.getSnapshot()).toEqual(unchangedBeforeInvalidTarget);
    const hoshinoPlan = view.actorStates.find(actor => actor.id === IDS.actors.hoshino)?.currentPlan;
    expect(hoshinoPlan?.kind).toBe('studentAction');
    game.operationEntry.reviseIntervention({
      runId,
      planVersion: run.planVersion,
      draft: { actorId: IDS.actors.hoshino, actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop },
    });
    run = game.operationEntry.getSnapshot()!;
    const battleResolution = game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
    expect(battleResolution).toMatchObject({ eventId: IDS.event, locationId: IDS.locations.platform, sceneId: 'main' });
    view = game.operationEntry.getView(runId)!;
    run = game.operationEntry.getSnapshot()!;
    sceneTacticalRandom = run.random;
    expect(view).toMatchObject({ currentLocationId: IDS.locations.concourse, currentSceneId: 'main' });
    expect(view).toMatchObject({ currentLocationId: IDS.locations.concourse, currentActionMode: 'individual', playerCost: 5, sceneActionBatchesRemaining: 1 });

    game.operationEntry.stageSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [
        { sceneActionId: IDS.sceneActions.inspect, actorId: IDS.actors.hoshino, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.serika, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.shiroko, targetActorIds: [] },
      ],
    });
    const staged = game.operationEntry.getSnapshot()!;
    expect(staged.playerRouteState.playerCost).toBe(5);
    const concourseResolution = game.operationEntry.commitStagedSceneActionBatch({ runId, planVersion: staged.planVersion });
    expect(concourseResolution).toMatchObject({
      eventId: IDS.event,
      locationId: IDS.locations.concourse,
      sceneId: 'main',
      sceneBatch: { playerCostPaid: 3, sceneActionBatchesUsed: 1 },
    });
    view = game.operationEntry.getView(runId)!;
    run = game.operationEntry.getSnapshot()!;
    expect(view.currentRoutes.filter(route => route.available).map(route => route.routeId)).toEqual([
      IDS.routes.staffGate,
      IDS.routes.publicPath,
    ]);
    expect(view.heldItemIds).toContain(IDS.item);

    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.staffGate });
    run = game.operationEntry.getSnapshot()!;
    view = game.operationEntry.getView(runId)!;
    expect(view).toMatchObject({ currentLocationId: IDS.locations.exit, currentSceneId: 'main' });
    expect(view.routeHistory.at(-1)).toMatchObject({
      routeId: IDS.routes.staffGate,
      fromLocationId: IDS.locations.concourse,
      toLocationId: IDS.locations.exit,
    });
    expect(view).toMatchObject({ currentLocationId: IDS.locations.exit, currentActionMode: 'global', playerCost: 3 });
    expect(view.playerCards).toMatchObject({ drawPileCount: 0, discardCount: 0 });
    expect(view.playerCards.hand).toHaveLength(2);
    expect(view.heldItemIds).not.toContain(IDS.item);

    const globalAction = view.currentSceneActions.find(action => action.id === IDS.sceneActions.firstAid)!;
    expect(globalAction.eligibleActorIds).toContain(IDS.actors.hoshino);
    const playedCardId = run.playerRouteState.cards.hand[0];
    const globalResolution = game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [{
        sceneActionId: IDS.sceneActions.firstAid,
        actorId: IDS.actors.hoshino,
        targetActorIds: [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko],
      }],
      cards: [{
        cardInstanceId: playedCardId,
        actorId: IDS.actors.serika,
        targetActorIds: [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko],
      }],
    });
    expect(globalResolution).toMatchObject({
      eventId: IDS.event,
      locationId: IDS.locations.exit,
      sceneId: 'main',
      sceneBatch: { playerCostPaid: 3, sceneActionBatchesUsed: 1 },
    });
    view = game.operationEntry.getView(runId)!;
    run = game.operationEntry.getSnapshot()!;
    expect(view).toMatchObject({
      currentLocationId: IDS.locations.exit,
      status: 'success',
      sceneActionBatchesRemaining: 0,
      playerCost: 0,
      tracks: { [IDS.track]: 0 },
    });
    expect(globalResolution.sceneBatch?.playerCostPaid).toBe(3);
    expect(globalResolution.sceneBatch?.cards[0]).toMatchObject({ cardInstanceId: playedCardId, playerCost: 1 });
    expect(run.playerRouteState.cards.discard).toEqual([playedCardId]);
    expect(run.playerRouteState.cards.hand).toHaveLength(1);
    expect(view.playerCards.discardCount).toBe(1);
    expect(run.random).toEqual(sceneTacticalRandom);
    expect(run.resolutions.map(({ eventId, locationId, sceneId }) => ({ eventId, locationId, sceneId }))).toEqual([
      { eventId: IDS.event, locationId: IDS.locations.platform, sceneId: 'main' },
      { eventId: IDS.event, locationId: IDS.locations.concourse, sceneId: 'main' },
      { eventId: IDS.event, locationId: IDS.locations.exit, sceneId: 'main' },
    ]);
    expect(game.save().operationRun?.run.resolutions).toEqual(run.resolutions);
    expect(view.routeHistory.at(-1)).toMatchObject({
      routeId: IDS.routes.staffGate,
      fromLocationId: IDS.locations.concourse,
      toLocationId: IDS.locations.exit,
    });
    expect(game.operationEntry.getSnapshot()!.status).toBe('success');
    const beforeReward = game.getView().resources['base:resource:credit'] ?? 0;
    expect(game.operationEntry.claimOutcomeReward()).toMatchObject({ status: 'claimed', reward: { amount: 200 } });
    expect(game.getView().resources['base:resource:credit']).toBe(beforeReward + 200);
    expect(game.operationEntry.claimOutcomeReward()).toMatchObject({ status: 'alreadyClaimed' });
    expect(game.getView().resources['base:resource:credit']).toBe(beforeReward + 200);

    game.inits.enterInit('base:init:millennium');
    expect(() => game.operationEntry.start(IDS.event, STUDENTS)).toThrow(OperationAdmissionError);
  });

  test('the carousel battle is a single encounter and its completed route does not offer a second battle', () => {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    games.push(game);
    for (const student of STUDENTS) game.mutations.acquireCharacter(VARIANTS[student], 'story');

    const runId = game.operationEntry.start(IDS.event, STUDENTS).runId;
    let run = game.operationEntry.getSnapshot()!;
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.platform);
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
    run = game.operationEntry.getSnapshot()!;
    expect(game.operationEntry.getView(runId)?.currentLocationId).toBe(IDS.locations.concourse);
    const view = game.operationEntry.getView(runId)!;
    expect(view.currentLocationId).toBe(IDS.locations.concourse);
    expect(view.locationProgress[IDS.locations.platform]?.completed).toBe(true);
    expect(view.currentRoutes.some(route => route.targetLocationId === IDS.locations.platform)).toBe(false);
  });

  test('rejects target allowlist IDs that do not reference an Event Actor', () => {
    const nonStudentCandidates = carouselSafetySliceContent.participants.flatMap(participant =>
      participant.kind === 'student' ? [] : [{
        actorId: participant.actorId,
        participantKind: participant.kind,
        candidateActionIds: participant.candidateActionIds,
      }]);
    const validate = (actionDefinitions: typeof carouselSafetySliceContent.actionDefinitions) =>
      validateOperationActionContent(
        carouselSafetySliceContent.eventDefinition,
        actionDefinitions,
        carouselSafetySliceContent.studentSkillRules ?? [],
        carouselSafetySliceContent.studentProfiles,
        nonStudentCandidates,
      );
    const invalidActionDefinitions = carouselSafetySliceContent.actionDefinitions.map(actionDefinition =>
      actionDefinition.id === CAROUSEL_SAFETY_IDS.actions.brace
        ? {
          ...actionDefinition,
          target: {
            kind: 'actor' as const,
            relation: 'any' as const,
            allowedActorIds: ['gameplay-b:operation-actor:missing-target'],
          },
        }
        : actionDefinition);
    const declaredTypeActionDefinitions = carouselSafetySliceContent.actionDefinitions.map(actionDefinition =>
      actionDefinition.id === CAROUSEL_SAFETY_IDS.actions.brace
        ? {
          ...actionDefinition,
          target: { kind: 'actor' as const, relation: 'any' as const, allowedActorTypes: ['environment'] },
        }
        : actionDefinition);
    const unknownTypeActionDefinitions = carouselSafetySliceContent.actionDefinitions.map(actionDefinition =>
      actionDefinition.id === CAROUSEL_SAFETY_IDS.actions.brace
        ? {
          ...actionDefinition,
          target: { kind: 'actor' as const, relation: 'any' as const, allowedActorTypes: ['carousel-platform'] },
        }
        : actionDefinition);

    expect(validate(carouselSafetySliceContent.actionDefinitions).issues).toEqual([]);
    expect(validate(declaredTypeActionDefinitions).issues).toEqual([]);
    expect(validate(invalidActionDefinitions).issues.join('\n'))
      .toMatch(/allowedActorIds\[0\] references an undeclared Event Actor: gameplay-b:operation-actor:missing-target/);
    expect(validate(unknownTypeActionDefinitions).issues.join('\n'))
      .toMatch(/allowedActorTypes\[0\] references an Actor type not declared by this Event: carousel-platform/);
  });

  test('the same fixed seed resolves the formal Character Hand and completes the carousel safety objective', () => {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    games.push(game);
    for (const student of STUDENTS) game.mutations.acquireCharacter(VARIANTS[student], 'story');

    const runId = game.operationEntry.start(IDS.event, STUDENTS).runId;
    let run = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
    run = game.operationEntry.getSnapshot()!;
    expect(run.currentLocationId).toBe(IDS.locations.concourse);
    game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [
        { sceneActionId: IDS.sceneActions.inspect, actorId: IDS.actors.hoshino, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.serika, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.shiroko, targetActorIds: [] },
      ],
    });
    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.staffGate });
    run = game.operationEntry.getSnapshot()!;
    const targets = [IDS.actors.hoshino, IDS.actors.serika, IDS.actors.shiroko];
    game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [{ sceneActionId: IDS.sceneActions.firstAid, actorId: IDS.actors.hoshino, targetActorIds: targets }],
    });

    expect(game.operationEntry.getView(runId)).toMatchObject({ status: 'success', knownFactIds: [IDS.fact] });
    expect(game.operationEntry.claimOutcomeReward()).toMatchObject({ status: 'claimed', reward: { amount: 200 } });
  });
});
