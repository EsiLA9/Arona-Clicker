import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { carouselSceneActionSliceResolver } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { Character } from '../../src/arona-clicker/types/ids';
import { baseDatapack } from '../../src/data/test-datapack';
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

  test('plays Individual and Global batches, then follows the held-item branch to an Event outcome', () => {
    const game = createAppRuntime({ operationContentResolver: carouselSceneActionSliceResolver });
    game.init([baseDatapack], { enterDefaultInit: true });
    games.push(game);
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    for (const student of STUDENTS) game.mutations.acquireCharacter(VARIANTS[student], 'story');

    const runId = game.operationEntry.start(IDS.event, STUDENTS).runId;
    let run = game.operationEntry.getSnapshot()!;
    const initialTacticalRandom = run.random;
    let view = game.operationEntry.getView(runId)!;
    expect(view).toMatchObject({
      currentLocationId: IDS.locations.platform,
      currentActionMode: 'individual',
      playerCost: 5,
      sceneActionBatchesRemaining: 1,
    });

    game.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [
        { sceneActionId: IDS.sceneActions.inspect, actorId: IDS.actors.hoshino, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.serika, targetActorIds: [] },
        { sceneActionId: IDS.sceneActions.guide, actorId: IDS.actors.shiroko, targetActorIds: [] },
      ],
    });
    view = game.operationEntry.getView(runId)!;
    run = game.operationEntry.getSnapshot()!;
    expect(view.currentLocationId).toBe(IDS.locations.platform);
    expect(view.currentRoutes.filter(route => route.available).map(route => route.routeId)).toEqual([
      IDS.routes.staffGate,
      IDS.routes.publicPath,
    ]);
    expect(view.heldItemIds).toContain(IDS.item);

    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.staffGate });
    run = game.operationEntry.getSnapshot()!;
    view = game.operationEntry.getView(runId)!;
    expect(view).toMatchObject({ currentLocationId: IDS.locations.concourse, currentActionMode: 'global', playerCost: 3 });
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
    view = game.operationEntry.getView(runId)!;
    run = game.operationEntry.getSnapshot()!;
    expect(view).toMatchObject({
      currentLocationId: IDS.locations.concourse,
      sceneActionBatchesRemaining: 0,
      playerCost: 0,
      tracks: { [IDS.track]: 0 },
    });
    expect(globalResolution.sceneBatch?.playerCostPaid).toBe(3);
    expect(globalResolution.sceneBatch?.cards[0]).toMatchObject({ cardInstanceId: playedCardId, playerCost: 1 });
    expect(run.playerRouteState.cards.discard).toEqual([playedCardId]);
    expect(run.playerRouteState.cards.hand).toHaveLength(1);
    expect(view.playerCards.discardCount).toBe(1);
    expect(run.random).toEqual(initialTacticalRandom);
    expect(view.currentRoutes.map(route => route.routeId)).toEqual([IDS.routes.returnLoop, IDS.routes.parkExit]);

    game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId: IDS.routes.parkExit });
    expect(game.operationEntry.getSnapshot()!.status).toBe('success');
  });
});
