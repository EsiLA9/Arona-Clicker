import { afterEach, describe, expect, test } from 'vitest';
import type { OperationContentResolver } from '../../src/arona-clicker/contracts/operation-content-resolver';
import type { OperationViewResolution } from '../../src/arona-clicker/contracts/operation-view';
import { OperationAdmissionError } from '../../src/arona-clicker/services/operation-participant-admission';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { carouselSafetySliceContent, carouselSafetySliceResolver } from '../../src/arona-clicker/content/operation-samples/carousel-safety-slice';
import { CAROUSEL_SCENE_ACTION_IDS, carouselSceneActionSliceContent, carouselSceneActionSliceResolver } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';

const STUDENT_CHARACTERS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANT_IDS: Record<typeof STUDENT_CHARACTERS[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};

describe('Gameplay B carousel safety sample', () => {
  const games: GameInstance[] = [];

  function createGame(appRuntime = true, operationContentResolver?: OperationContentResolver): GameInstance {
    const game = appRuntime
      ? createAppRuntime({ ...(operationContentResolver ? { operationContentResolver } : {}) })
      : new GameInstance();
    game.init([baseDatapack], { enterDefaultInit: appRuntime });
    games.push(game);
    return game;
  }

  function acquire(game: GameInstance, characters: readonly (typeof STUDENT_CHARACTERS)[number][] = STUDENT_CHARACTERS): void {
    for (const character of characters) game.mutations.acquireCharacter(VARIANT_IDS[character], 'story');
  }

  function start(game: GameInstance): string {
    return game.operationEntry.start(CAROUSEL_SAFETY_IDS.event, STUDENT_CHARACTERS).runId;
  }

  function runTwoBeats(action?: { readonly actorId: string; readonly actionId: string }): {
    readonly firstDanger: number;
    readonly finalDanger: number;
    readonly rideHp: number;
    readonly defaultHoshinoActionId: string | null;
    readonly hoshinoHandActionIds: readonly string[];
    readonly resolutions: readonly OperationViewResolution[];
  } {
    const game = createGame();
    acquire(game);
    const runId = start(game);
    const initialHoshino = game.operationEntry.getView(runId)!.actorStates
      .find(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.hoshino)!;
    const defaultHoshinoActionId = initialHoshino.currentPlan?.kind === 'studentAction'
      ? initialHoshino.currentPlan.actionId
      : null;
    const hoshinoHandActionIds = initialHoshino.characterHand?.actionIds ?? [];
    let current = game.operationEntry.getSnapshot()!;
    if (action) {
      game.operationEntry.reviseIntervention({
        runId,
        planVersion: current.planVersion,
        draft: action,
      });
      current = game.operationEntry.getSnapshot()!;
    }
    game.operationEntry.commitBeat({ runId, planVersion: current.planVersion });
    const firstDanger = game.operationEntry.getView(runId)!.tracks[CAROUSEL_SAFETY_IDS.track];
    current = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: current.planVersion });
    const finalView = game.operationEntry.getView(runId)!;
    return {
      firstDanger,
      finalDanger: finalView.tracks[CAROUSEL_SAFETY_IDS.track],
      rideHp: finalView.actorStates.find(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.ride)!.hp,
      defaultHoshinoActionId,
      hoshinoHandActionIds,
      resolutions: finalView.resolutions,
    };
  }

  afterEach(() => {
    for (const game of games.splice(0)) {
      if (game.running) game.stop();
    }
  });

  test('attaches only through the Schale app runtime and requires the three real owned students', () => {
    const generic = createGame(false);
    acquire(generic);
    expect(() => start(generic)).toThrow();
    expect(generic.operationEntry.getView()).toBeNull();

    const app = createGame(true, carouselSafetySliceResolver);
    expect(app.state.activeInit).toBe(DEFAULT_INIT_ID);
    acquire(app, [Character.Hoshino, Character.Serika]);
    expect(() => start(app)).toThrow(OperationAdmissionError);
    expect(app.operationEntry.getView()).toBeNull();

    app.mutations.acquireCharacter(VARIANT_IDS[Character.Shiroko], 'story');
    const runId = start(app);
    const view = app.operationEntry.getView(runId)!;
    expect(view.eventId).toBe(CAROUSEL_SAFETY_IDS.event);
    expect(view.actorStates.filter(actor => actor.participantKind === 'student')).toHaveLength(3);
    expect(view.tracks[CAROUSEL_SAFETY_IDS.track]).toBe(3);
    expect(view.beatIndex).toBe(0);
    expect(app.operationEntry.getSnapshot()?.random.seed).toBe(17);
    expect(app.operationEntry.getSnapshot()?.playerRouteState).toEqual({
      playerCost: 0,
      cards: { drawPile: [], hand: [], discard: [] },
    });

    app.inits.enterInit('base:init:millennium');
    expect(app.state.activeInit).toBe('base:init:millennium');
    expect(() => start(app)).toThrow(OperationAdmissionError);
  });

  test('安全闩只指向旋转木马，急救行动说明效果而费用留在包装上', () => {
    const sabotage = carouselSafetySliceContent.actionDefinitions.find(action => action.id === CAROUSEL_SAFETY_IDS.actions.sabotage)!;
    expect(sabotage).toMatchObject({
      title: '破坏安全闩',
      description: '破坏旋转木马安全闩，扣除 1 点设备耐久。',
      target: { kind: 'actor', relation: 'any', allowedActorIds: [CAROUSEL_SAFETY_IDS.actors.ride] },
      effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }],
    });
    const teamAid = carouselSceneActionSliceContent.actionDefinitions.find(action => action.id === CAROUSEL_SCENE_ACTION_IDS.actions.treatTeam)!;
    expect(teamAid.description).toBe('为每名选定队员恢复 1 点 HP，并降低现场危险度。');
    expect(teamAid.description).not.toContain('Cost');
    expect(carouselSceneActionSliceContent.eventDefinition.playerSceneDeck?.cards[0]?.playerCost).toBe(1);
    expect(carouselSceneActionSliceContent.eventDefinition.locations
      .find(location => location.id === CAROUSEL_SCENE_ACTION_IDS.locations.exit)?.sceneActions?.[0]?.playerCost).toBe(2);
  });

  test('keeps profile-specific actions distinct and follows each Profile priority over Hand order', () => {
    const defaultPlan = runTwoBeats();
    const emergencyStop = runTwoBeats({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop,
    });
    const crowdGuide = runTwoBeats({
      actorId: CAROUSEL_SAFETY_IDS.actors.serika,
      actionId: CAROUSEL_SAFETY_IDS.actions.crowdGuide,
    });

    expect(defaultPlan.hoshinoHandActionIds).toContain(CAROUSEL_SAFETY_IDS.actions.brace);
    expect(defaultPlan.defaultHoshinoActionId).toBe(CAROUSEL_SAFETY_IDS.actions.brace);
    expect(defaultPlan).toMatchObject({ firstDanger: 4, finalDanger: 5, rideHp: 4 });
    expect(emergencyStop.resolutions[0].actorPlans).toContainEqual(expect.objectContaining({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop,
    }));
    expect(crowdGuide.resolutions[0].actorPlans).toContainEqual(expect.objectContaining({
      actorId: CAROUSEL_SAFETY_IDS.actors.serika,
      actionId: CAROUSEL_SAFETY_IDS.actions.crowdGuide,
    }));
    expect(emergencyStop).toMatchObject({ firstDanger: 1, finalDanger: 2, rideHp: 3 });
    expect(defaultPlan.resolutions[0].actorPlans).toContainEqual(expect.objectContaining({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      kind: 'studentAction',
      actionId: CAROUSEL_SAFETY_IDS.actions.brace,
    }));
    expect(crowdGuide).toMatchObject({ firstDanger: 3, finalDanger: 4, rideHp: 4 });
    expect(crowdGuide.resolutions[0].actorPlans).toContainEqual(expect.objectContaining({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      actionId: CAROUSEL_SAFETY_IDS.actions.brace,
    }));
    expect(emergencyStop.resolutions[0].payments).toContainEqual(expect.objectContaining({
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      cost: { scope: 'actor', resourceId: 'stamina', amount: 1 },
    }));
    expect(crowdGuide.resolutions[0].payments).toContainEqual(expect.objectContaining({
      actorId: CAROUSEL_SAFETY_IDS.actors.serika,
      cost: { scope: 'team', resourceId: 'coordination', amount: 1 },
    }));
    expect(defaultPlan.resolutions[0].combinations.matches).toHaveLength(1);
    expect(emergencyStop.resolutions[0].combinations.matches).toHaveLength(0);
    expect(crowdGuide.resolutions[0].combinations.matches).toHaveLength(0);
    for (const resolution of defaultPlan.resolutions) {
      const serikaPlan = resolution.actorPlans.find(plan => plan.actorId === CAROUSEL_SAFETY_IDS.actors.serika);
      const triggersSkill = serikaPlan?.kind === 'studentAction'
        && serikaPlan.actionId === CAROUSEL_SAFETY_IDS.actions.signal;
      expect(resolution.studentSkillChecks).toHaveLength(triggersSkill ? 1 : 0);
      if (triggersSkill) expect(resolution.studentSkillChecks[0]).toMatchObject({
        actorId: CAROUSEL_SAFETY_IDS.actors.serika,
        actionId: CAROUSEL_SAFETY_IDS.actions.signal,
      });
    }
    expect(defaultPlan.resolutions.map(result => result.studentSkillChecks))
      .toEqual(runTwoBeats().resolutions.map(result => result.studentSkillChecks));
  });

  test('a missing Hoshino capability removes the unique emergency-stop solution', () => {
    const resolver: OperationContentResolver = {
      resolve(eventId) {
        if (eventId !== CAROUSEL_SAFETY_IDS.event) return carouselSafetySliceResolver.resolve(eventId);
        return {
          ...carouselSafetySliceContent,
          studentProfiles: carouselSafetySliceContent.studentProfiles.map(profile => profile.characterId === Character.Hoshino
            ? { ...profile, capabilityIds: [] }
            : profile),
        };
      },
    };
    const game = createGame(true, resolver);
    acquire(game);
    const runId = start(game);
    const hoshino = game.operationEntry.getView(runId)!.actorStates
      .find(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.hoshino)!;
    const emergencyStop = hoshino.profile!.actionOptions
      .find(option => option.actionId === CAROUSEL_SAFETY_IDS.actions.emergencyStop)!;

    expect(emergencyStop).toMatchObject({
      eligible: false,
      selectable: false,
      missingCapabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
    });
    expect(hoshino.currentPlan).toMatchObject({
      kind: 'studentAction',
      actionId: CAROUSEL_SAFETY_IDS.actions.brace,
    });
  });

  test('projects SceneCard performers and relation-correct targets independently of the current SceneAction mode', () => {
    const game = createGame(true, carouselSceneActionSliceResolver);
    acquire(game);
    const runId = game.operationEntry.start(CAROUSEL_SCENE_ACTION_IDS.event, STUDENT_CHARACTERS).runId;
    const sceneActionIds = Object.values(CAROUSEL_SCENE_ACTION_IDS.actions);
    let launchView = game.operationEntry.getView(runId)!;
    expect(launchView.currentLocationId).toBe(CAROUSEL_SCENE_ACTION_IDS.locations.platform);
    expect(launchView.currentSceneActions).toEqual([]);
    for (const actor of launchView.actorStates.filter(actor => actor.participantKind === 'student')) {
      expect(actor.characterHand?.actionIds).not.toEqual(expect.arrayContaining(sceneActionIds));
    }

    let run = game.operationEntry.getSnapshot()!;
    game.operationEntry.reviseIntervention({
      runId,
      planVersion: run.planVersion,
      draft: { actorId: CAROUSEL_SAFETY_IDS.actors.hoshino, actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop },
    });
    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });

    let view = game.operationEntry.getView(runId)!;
    expect(view.currentActionMode).toBe('individual');
    expect(view.currentSceneActions.some(action => action.actionId === CAROUSEL_SCENE_ACTION_IDS.actions.treatTeam)).toBe(false);
    const individualCard = view.playerCards.hand[0]!;
    expect(individualCard).toMatchObject({
      title: '团队急救包',
      description: '为每名选定队员恢复 1 点 HP，并降低现场危险度。',
      performerPolicy: 'optional-student',
      selectionPolicy: 'required',
      eligibleActorIds: [
        CAROUSEL_SCENE_ACTION_IDS.actors.hoshino,
        CAROUSEL_SCENE_ACTION_IDS.actors.serika,
        CAROUSEL_SCENE_ACTION_IDS.actors.shiroko,
      ],
      legalTargetActorIdsByActorId: {
        [CAROUSEL_SCENE_ACTION_IDS.actors.serika]: [
          CAROUSEL_SCENE_ACTION_IDS.actors.hoshino,
          CAROUSEL_SCENE_ACTION_IDS.actors.serika,
          CAROUSEL_SCENE_ACTION_IDS.actors.shiroko,
        ],
      },
    });
    expect(Object.isFrozen(individualCard)).toBe(true);
    expect(Object.isFrozen(individualCard.eligibleActorIds)).toBe(true);
    expect(Object.isFrozen(individualCard.legalTargetActorIdsByActorId[CAROUSEL_SCENE_ACTION_IDS.actors.serika])).toBe(true);

    run = game.operationEntry.getSnapshot()!;
    const runBeforeViewRead = JSON.parse(JSON.stringify(run));
    game.operationEntry.getView(runId);
    expect(game.operationEntry.getSnapshot()).toEqual(runBeforeViewRead);
    const sceneCardResolution = game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [
        { sceneActionId: CAROUSEL_SCENE_ACTION_IDS.sceneActions.inspect, actorId: CAROUSEL_SCENE_ACTION_IDS.actors.hoshino, targetActorIds: [] },
        { sceneActionId: CAROUSEL_SCENE_ACTION_IDS.sceneActions.guide, actorId: CAROUSEL_SCENE_ACTION_IDS.actors.serika, targetActorIds: [] },
        { sceneActionId: CAROUSEL_SCENE_ACTION_IDS.sceneActions.guide, actorId: CAROUSEL_SCENE_ACTION_IDS.actors.shiroko, targetActorIds: [] },
      ],
      cards: [{
        cardInstanceId: individualCard.cardInstanceId,
        actorId: CAROUSEL_SCENE_ACTION_IDS.actors.serika,
        targetActorIds: [CAROUSEL_SCENE_ACTION_IDS.actors.hoshino],
      }],
    });
    expect(sceneCardResolution.sceneBatch?.cards).toContainEqual(expect.objectContaining({
      cardInstanceId: individualCard.cardInstanceId,
      actionId: CAROUSEL_SCENE_ACTION_IDS.actions.treatTeam,
      actorId: CAROUSEL_SCENE_ACTION_IDS.actors.serika,
      targetActorIds: [CAROUSEL_SCENE_ACTION_IDS.actors.hoshino],
    }));
    expect(game.operationEntry.getView(runId)?.heldItemIds).toContain(CAROUSEL_SCENE_ACTION_IDS.item);

    run = game.operationEntry.getSnapshot()!;
    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: CAROUSEL_SCENE_ACTION_IDS.routes.staffGate });
    view = game.operationEntry.getView(runId)!;
    expect(view.currentActionMode).toBe('global');
    const firstAidSceneAction = view.currentSceneActions.find(action => action.actionId === CAROUSEL_SCENE_ACTION_IDS.actions.treatTeam)!;
    expect(firstAidSceneAction).toMatchObject({
      scope: 'global',
      title: '全队急救',
      description: '为每名选定队员恢复 1 点 HP，并降低现场危险度。',
      performerPolicy: 'optional-student',
      selectionPolicy: 'required',
      eligibleActorIds: [
        CAROUSEL_SCENE_ACTION_IDS.actors.hoshino,
        CAROUSEL_SCENE_ACTION_IDS.actors.serika,
        CAROUSEL_SCENE_ACTION_IDS.actors.shiroko,
      ],
      legalTargetActorIdsByActorId: {
        [CAROUSEL_SCENE_ACTION_IDS.actors.serika]: [
          CAROUSEL_SCENE_ACTION_IDS.actors.hoshino,
          CAROUSEL_SCENE_ACTION_IDS.actors.serika,
          CAROUSEL_SCENE_ACTION_IDS.actors.shiroko,
        ],
      },
    });
    expect(view.playerCards.hand.some(card => card.actionId === CAROUSEL_SCENE_ACTION_IDS.actions.treatTeam)).toBe(true);
    for (const card of view.playerCards.hand) {
      expect(card.eligibleActorIds).toEqual([
        CAROUSEL_SCENE_ACTION_IDS.actors.hoshino,
        CAROUSEL_SCENE_ACTION_IDS.actors.serika,
        CAROUSEL_SCENE_ACTION_IDS.actors.shiroko,
      ]);
      expect(card.legalTargetActorIdsByActorId[CAROUSEL_SCENE_ACTION_IDS.actors.serika]).toContain(CAROUSEL_SCENE_ACTION_IDS.actors.shiroko);
    }
  });

  test('authors Carousel scene options and finite hand cards with copy and explicit selection policies', () => {
    const actions = carouselSceneActionSliceContent.actionDefinitions;
    expect(actions.every(action => action.title.trim().length > 0 && action.description?.trim().length)).toBe(true);
    const sceneActions = carouselSceneActionSliceContent.eventDefinition.locations.flatMap(location => location.sceneActions ?? []);
    expect(sceneActions.every(action => Boolean(action.title?.trim()))).toBe(true);
    expect(sceneActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: CAROUSEL_SCENE_ACTION_IDS.sceneActions.inspect, scope: 'individual', performerPolicy: 'selected-student', selectionPolicy: 'required' }),
      expect.objectContaining({ id: CAROUSEL_SCENE_ACTION_IDS.sceneActions.guide, scope: 'individual', performerPolicy: 'selected-student', selectionPolicy: 'required' }),
      expect.objectContaining({ id: CAROUSEL_SCENE_ACTION_IDS.sceneActions.firstAid, scope: 'global', performerPolicy: 'optional-student', selectionPolicy: 'required' }),
    ]));
    expect(carouselSceneActionSliceContent.eventDefinition.playerSceneDeck?.cards).toEqual([
      expect.objectContaining({
        id: 'team-first-aid',
        title: '团队急救包',
        actionId: CAROUSEL_SCENE_ACTION_IDS.actions.treatTeam,
        copies: 2,
        performerPolicy: 'optional-student',
        selectionPolicy: 'required',
      }),
    ]);
  });
});
