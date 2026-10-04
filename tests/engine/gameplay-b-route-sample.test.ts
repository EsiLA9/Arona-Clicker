import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { baseDatapack } from '../../src/data/test-datapack';
import { Character } from '../../src/arona-clicker/types/ids';
import { CAROUSEL_ROUTE_IDS as IDS, carouselRouteSliceResolver } from '../../src/arona-clicker/content/operation-samples/carousel-route-slice';
import { carouselRouteSliceContent } from '../../src/arona-clicker/content/operation-samples/carousel-route-slice';
import type { OperationContentResolver } from '../../src/arona-clicker/contracts/operation-content-resolver';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const students = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const variants: Record<typeof students[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};

describe('Gameplay B carousel route sample', () => {
  const games: GameInstance[] = [];

  function startSample(resolver: OperationContentResolver = carouselRouteSliceResolver): { readonly game: GameInstance; readonly runId: string } {
    const game = createAppRuntime({ operationContentResolver: resolver });
    game.init([baseDatapack]);
    for (const character of students) game.mutations.acquireCharacter(variants[character], 'story');
    games.push(game);
    const run = game.operationEntry.start(IDS.event, students);
    return { game, runId: run.runId };
  }

  function resolveAndCollectPass(game: GameInstance, runId: string): void {
    const run = game.operationEntry.getSnapshot()!;
    expect(game.operationEntry.getView(runId)?.currentRoutes.every(route =>
      !route.available && route.lockedReason === 'operation:route:location-incomplete')).toBe(true);
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });
    expect(game.operationEntry.getSnapshot()).toMatchObject({
      beatIndex: 1,
      eventState: { knownFactIds: [IDS.fact], heldItemIds: [IDS.item] },
      locationProgress: { [IDS.locations.platform]: { completed: true, result: 'success' } },
    });
  }

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('uses the Run item gate, one route command, and atomic item consumption', () => {
    const { game, runId } = startSample();
    resolveAndCollectPass(game, runId);
    const choicePoint = game.operationEntry.getSnapshot()!;
    expect(game.operationEntry.getView(runId)?.currentRoutes.map(route => route.available)).toEqual([true, true, true]);

    const inMaintenance = game.operationEntry.transitionRoute({
      runId,
      planVersion: choicePoint.planVersion,
      routeId: IDS.routes.staffGate,
    });
    expect(inMaintenance).toMatchObject({
      currentLocationId: IDS.locations.maintenance,
      beatIndex: 1,
      eventState: { heldItemIds: [] },
      routeHistory: [{
        fromLocationId: IDS.locations.platform,
        routeId: IDS.routes.staffGate,
        toLocationId: IDS.locations.maintenance,
        consumedHeldItemId: IDS.item,
      }],
    });
    expect(game.operationEntry.getSnapshot()?.resolutions).toHaveLength(1);

    const maintenance = game.operationEntry.getSnapshot()!;
    const finished = game.operationEntry.transitionRoute({
      runId,
      planVersion: maintenance.planVersion,
      routeId: IDS.routes.endFromMaintenance,
    });
    expect(finished).toMatchObject({ currentLocationId: IDS.locations.ending, status: 'success' });
    expect(finished.routeHistory).toHaveLength(2);
  });

  test('projects the missing held item as a locked route reason while other exits remain selectable', () => {
    const resolver: OperationContentResolver = {
      resolve(eventId) {
        if (eventId !== IDS.event) return null;
        return {
          ...carouselRouteSliceContent,
          actionDefinitions: carouselRouteSliceContent.actionDefinitions.map(action => action.id === IDS.action
            ? { ...action, effects: action.effects.filter(effect => effect.kind !== 'heldItem') }
            : action),
        };
      },
    };
    const { game, runId } = startSample(resolver);
    const run = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: run.planVersion });

    expect(game.operationEntry.getSnapshot()).toMatchObject({
      currentLocationId: IDS.locations.platform,
      eventState: { knownFactIds: [IDS.fact], heldItemIds: [] },
      locationProgress: { [IDS.locations.platform]: { completed: true } },
    });
    expect(game.operationEntry.getView(runId)?.currentRoutes).toMatchObject([
      { routeId: IDS.routes.staffGate, available: false, lockedReason: 'operation:route:required-held-item-missing', requiredHeldItemId: IDS.item },
      { routeId: IDS.routes.concourse, available: true },
      { routeId: IDS.routes.emergencyExit, available: true },
    ]);
  });

  test('supports a directed loop and ends deterministically at the location visit cap', () => {
    const { game, runId } = startSample();
    resolveAndCollectPass(game, runId);

    for (const routeId of [IDS.routes.concourse, IDS.routes.platformLoop, IDS.routes.concourse, IDS.routes.platformLoop]) {
      const run = game.operationEntry.getSnapshot()!;
      game.operationEntry.transitionRoute({ runId, planVersion: run.planVersion, routeId });
    }
    const finalChoice = game.operationEntry.getSnapshot()!;
    const finished = game.operationEntry.transitionRoute({
      runId,
      planVersion: finalChoice.planVersion,
      routeId: IDS.routes.concourse,
    });

    expect(finished).toMatchObject({ status: 'success', currentLocationId: IDS.locations.concourse, beatIndex: 1 });
    expect(finished.routeHistory).toHaveLength(5);
    expect(game.operationEntry.getView(runId)).toMatchObject({
      totalLocationVisits: 6,
      maxLocationVisits: 6,
    });
    expect(game.operationEntry.getView(runId)?.currentRoutes.every(route =>
      !route.available && route.lockedReason === 'operation:route:max-visits-reached')).toBe(true);
    expect(finished.resolutions).toHaveLength(1);
  });
});
