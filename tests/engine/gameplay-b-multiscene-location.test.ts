import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { ATOMIC_SCENE_DEMO_IDS } from '../../src/arona-clicker/content/operation-samples/atomic-scene-demo';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { Character } from '../../src/arona-clicker/types/ids';

const STUDENTS = [Character.Hoshino, Character.Serika] as const;
const VARIANTS: Record<typeof STUDENTS[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
};

describe('Gameplay B same-Location multi-Scene sample', () => {
  const games: GameInstance[] = [];

  function createGame(): GameInstance {
    const game = createAppRuntime();
    games.push(game);
    game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    for (const student of STUDENTS) game.mutations.acquireCharacter(VARIANTS[student], 'story');
    return game;
  }

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('fixed actions and PlayerSceneCards resolve atomically; rejected commits and restored progress stay consistent', () => {
    const source = createGame();
    const started = source.operationEntry.start(ATOMIC_SCENE_DEMO_IDS.event, STUDENTS);
    const runId = started.runId;
    const initial = source.operationEntry.getView(runId)!;
    const locationId = initial.currentLocationId;

    expect(initial).toMatchObject({
      currentStage: 'scene',
      currentLocationId: ATOMIC_SCENE_DEMO_IDS.location,
      currentSceneId: ATOMIC_SCENE_DEMO_IDS.scene,
      currentScene: { status: 'active', title: '调查故障设备' },
      scenes: [
        { sceneId: ATOMIC_SCENE_DEMO_IDS.scene, status: 'active' },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, status: 'ready' },
      ],
      locationProgress: { [locationId]: { visitCount: 1, completed: false, completedSceneIds: [] } },
      routeHistory: [],
    });

    const cardInstanceId = started.playerRouteState.cards.hand[0];
    expect(cardInstanceId).toBeDefined();
    const firstResolution = source.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: initial.planVersion,
      selections: [],
      cards: [{ cardInstanceId: cardInstanceId!, targetActorIds: [] }],
    });
    expect(firstResolution.sceneBatch?.selections).toEqual([CAROUSEL_SAFETY_IDS.actors.hoshino, CAROUSEL_SAFETY_IDS.actors.serika].map(actorId => ({
      sceneActionId: ATOMIC_SCENE_DEMO_IDS.sceneAction,
      actorId,
      targetActorIds: [CAROUSEL_SAFETY_IDS.actors.ride],
    })));
    expect(firstResolution.sceneBatch?.cards).toEqual([expect.objectContaining({ cardInstanceId: cardInstanceId! })]);
    const afterFirstResolution = source.operationEntry.getSnapshot()!;
    expect(afterFirstResolution.eventState.knownFactIds).toContain(ATOMIC_SCENE_DEMO_IDS.repairClueFact);
    expect(afterFirstResolution.eventState.tracks[CAROUSEL_SAFETY_IDS.track]).toBe(0);
    expect(afterFirstResolution.locationProgress[locationId]).toMatchObject({
      completed: false,
      completedSceneIds: [ATOMIC_SCENE_DEMO_IDS.scene],
      sceneActionBatchesUsedByScene: { [ATOMIC_SCENE_DEMO_IDS.scene]: 1 },
    });
    expect(source.operationEntry.getView(runId)).toMatchObject({
      currentLocationId: locationId,
      currentSceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene,
      scenes: [
        { sceneId: ATOMIC_SCENE_DEMO_IDS.scene, status: 'completed' },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, status: 'active' },
      ],
      routeHistory: [],
    });

    expect(() => source.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: afterFirstResolution.planVersion,
      selections: [{
        sceneActionId: 'missing-scene-action',
        actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
        targetActorIds: [],
      }],
    })).toThrow();
    expect(source.operationEntry.getSnapshot()).toEqual(afterFirstResolution);
    expect(firstResolution.sceneId).toBe(ATOMIC_SCENE_DEMO_IDS.scene);
    expect(source.operationEntry.getView(runId)).toMatchObject({
      currentLocationId: locationId,
      currentSceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene,
      currentScene: { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, status: 'active' },
      scenes: [
        { sceneId: ATOMIC_SCENE_DEMO_IDS.scene, status: 'completed' },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, status: 'active' },
      ],
      locationProgress: {
        [locationId]: {
          completed: false,
          completedSceneIds: [ATOMIC_SCENE_DEMO_IDS.scene],
          sceneActionBatchesUsedByScene: {
            [ATOMIC_SCENE_DEMO_IDS.scene]: 1,
            [ATOMIC_SCENE_DEMO_IDS.alarmScene]: 0,
          },
        },
      },
      currentRoutes: [{ routeId: ATOMIC_SCENE_DEMO_IDS.route, targetLocationId: ATOMIC_SCENE_DEMO_IDS.exitLocation, available: false }],
      routeHistory: [],
    });

    const checkpoint = source.save();
    expect(checkpoint.operationRun).toMatchObject({ eventId: ATOMIC_SCENE_DEMO_IDS.event, resumeVersion: 3 });
    const resumed = createGame();
    resumed.load(checkpoint);
    expect(resumed.operationEntry.getLastRestoreResult()).toMatchObject({ status: 'restored', eventId: ATOMIC_SCENE_DEMO_IDS.event, runId });
    expect(resumed.operationEntry.getView(runId)).toMatchObject({
      currentLocationId: locationId,
      currentSceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene,
      scenes: [
        { sceneId: ATOMIC_SCENE_DEMO_IDS.scene, status: 'completed' },
        { sceneId: ATOMIC_SCENE_DEMO_IDS.alarmScene, status: 'active' },
      ],
      locationProgress: {
        [locationId]: {
          completed: false,
          completedSceneIds: [ATOMIC_SCENE_DEMO_IDS.scene],
        },
      },
      routeHistory: [],
    });

    const beforeAlarm = resumed.operationEntry.getSnapshot()!;
    const alarmView = resumed.operationEntry.getView(runId)!;
    const frontActorIds: string[] = [ATOMIC_SCENE_DEMO_IDS.enemyFrontA, ATOMIC_SCENE_DEMO_IDS.enemyFrontB];
    const alarmLegalIds = [...frontActorIds, ATOMIC_SCENE_DEMO_IDS.enemyBack];
    expect(alarmView.currentSceneActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction,
        targetSelectionMode: 'all-eligible',
        legalTargetActorIdsByActorId: expect.objectContaining({ [CAROUSEL_SAFETY_IDS.actors.hoshino]: frontActorIds }),
      }),
      expect.objectContaining({
        id: ATOMIC_SCENE_DEMO_IDS.alarmSceneAction,
        targetSelectionMode: 'select',
        legalTargetActorIdsByActorId: expect.objectContaining({ [CAROUSEL_SAFETY_IDS.actors.hoshino]: alarmLegalIds }),
      }),
    ]));

    const groupResolution = resumed.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: beforeAlarm.planVersion,
      selections: [{
        sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction,
        actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
        targetActorIds: [],
      }],
    });
    expect(groupResolution.sceneBatch?.selections).toEqual([{
      sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction,
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      targetActorIds: frontActorIds,
    }]);
    expect(resumed.operationEntry.getSnapshot()?.actorStates.filter(actor => frontActorIds.includes(actor.id)).map(actor => actor.hp))
      .toEqual([2, 2]);

    const afterGroup = resumed.operationEntry.getSnapshot()!;
    const movedTargetId = ATOMIC_SCENE_DEMO_IDS.enemyFrontA;
    const moveResolution = resumed.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: afterGroup.planVersion,
      selections: [{
        sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmMoveSceneAction,
        actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
        targetActorIds: [movedTargetId],
      }],
    });
    expect(moveResolution.positionChanges).toEqual([expect.objectContaining({
      actorId: movedTargetId,
      before: 'front',
      after: 'back',
    })]);
    const afterMove = resumed.operationEntry.getSnapshot()!;
    expect(afterMove.actorStates.find(actor => actor.id === movedTargetId)?.positionId).toBe('back');
    const afterMoveView = resumed.operationEntry.getView(runId)!;
    expect(afterMoveView.actorStates.find(actor => actor.id === movedTargetId)?.positionId).toBe('back');
    const remainingFrontActorIds = [ATOMIC_SCENE_DEMO_IDS.enemyFrontB];
    expect(afterMoveView.currentSceneActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction,
        legalTargetActorIdsByActorId: expect.objectContaining({ [CAROUSEL_SAFETY_IDS.actors.hoshino]: remainingFrontActorIds }),
      }),
      expect.objectContaining({
        id: ATOMIC_SCENE_DEMO_IDS.alarmSceneAction,
        legalTargetActorIdsByActorId: expect.objectContaining({
          [CAROUSEL_SAFETY_IDS.actors.hoshino]: alarmLegalIds,
        }),
      }),
    ]));
    expect(() => resumed.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: afterMove.planVersion,
      selections: [{
        sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmMoveSceneAction,
        actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
        targetActorIds: [movedTargetId],
      }],
    })).toThrow(/no longer eligible/);
    expect(resumed.operationEntry.getSnapshot()).toEqual(afterMove);

    const secondGroupResolution = resumed.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: afterMove.planVersion,
      selections: [{
        sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction,
        actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
        targetActorIds: [],
      }],
    });
    expect(secondGroupResolution.sceneBatch?.selections).toEqual([{
      sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction,
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      targetActorIds: remainingFrontActorIds,
    }]);
    const afterSecondGroup = resumed.operationEntry.getSnapshot()!;
    expect(resumed.operationEntry.getView(runId)?.currentSceneActions.find(action => action.id === ATOMIC_SCENE_DEMO_IDS.alarmSceneAction)
      ?.legalTargetActorIdsByActorId[CAROUSEL_SAFETY_IDS.actors.hoshino]).toEqual(alarmLegalIds);
    const finalResolution = resumed.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: afterSecondGroup.planVersion,
      selections: [{
        sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmSceneAction,
        actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
        targetActorIds: [ATOMIC_SCENE_DEMO_IDS.enemyBack],
      }],
    });
    expect(finalResolution.sceneBatch?.selections).toEqual([{
      sceneActionId: ATOMIC_SCENE_DEMO_IDS.alarmSceneAction,
      actorId: CAROUSEL_SAFETY_IDS.actors.hoshino,
      targetActorIds: [ATOMIC_SCENE_DEMO_IDS.enemyBack],
    }]);
    expect(finalResolution.sceneId).toBe(ATOMIC_SCENE_DEMO_IDS.alarmScene);
    expect(resumed.operationEntry.getView(runId)).toMatchObject({
      status: 'success',
      currentLocationId: ATOMIC_SCENE_DEMO_IDS.exitLocation,
      currentRoutes: [],
      locationProgress: {
        [locationId]: {
          visitCount: 1,
          completed: true,
          result: 'success',
          completedSceneIds: [ATOMIC_SCENE_DEMO_IDS.scene, ATOMIC_SCENE_DEMO_IDS.alarmScene],
          sceneActionBatchesUsedByScene: {
            [ATOMIC_SCENE_DEMO_IDS.scene]: 1,
            [ATOMIC_SCENE_DEMO_IDS.alarmScene]: 4,
          },
        },
        [ATOMIC_SCENE_DEMO_IDS.exitLocation]: { visitCount: 1, completed: true, result: 'success' },
      },
      routeHistory: [{
        fromLocationId: locationId,
        toLocationId: ATOMIC_SCENE_DEMO_IDS.exitLocation,
        routeId: ATOMIC_SCENE_DEMO_IDS.route,
      }],
    });
    expect(resumed.operationEntry.getView(runId)?.map.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ locationId, completed: true, current: false }),
    ]));
    expect(resumed.operationEntry.getSnapshot()?.locationProgress[locationId]).toMatchObject({
      completed: true,
      result: 'success',
      completedSceneIds: [ATOMIC_SCENE_DEMO_IDS.scene, ATOMIC_SCENE_DEMO_IDS.alarmScene],
    });
  });

  test('an empty non-skip batch executes the pending fixed SceneAction and resolves its target in Runtime', () => {
    const game = createGame();
    const runId = game.operationEntry.start(ATOMIC_SCENE_DEMO_IDS.event, STUDENTS).runId;
    const before = game.operationEntry.getView(runId)!;
    const preview = game.operationEntry.previewSceneActionBatch({
      runId,
      planVersion: before.planVersion,
      selections: [],
    });
    expect(preview.selections).toEqual(STUDENTS.map((_, index) => ({
      sceneActionId: ATOMIC_SCENE_DEMO_IDS.sceneAction,
      actorId: [CAROUSEL_SAFETY_IDS.actors.hoshino, CAROUSEL_SAFETY_IDS.actors.serika][index],
      targetActorIds: [CAROUSEL_SAFETY_IDS.actors.ride],
    })));
    const resolution = game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: before.planVersion,
      selections: [],
    });
    expect(resolution.sceneBatch?.selections).toEqual(preview.selections);
    const after = game.operationEntry.getView(runId)!;
    expect(after.currentSceneId).toBe(ATOMIC_SCENE_DEMO_IDS.alarmScene);
    expect(after.scenes[0]).toMatchObject({ sceneId: ATOMIC_SCENE_DEMO_IDS.scene, status: 'completed' });
  });
});
