import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import { gameplayBCarouselDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-datapack';
import { CAROUSEL_SCENE_ACTION_IDS as IDS } from '../../src/arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { MapRunService } from '../../src/arona-clicker/services/map-run-service';
import { Character } from '../../src/arona-clicker/types/ids';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const STUDENTS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANTS: Record<typeof STUDENTS[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};
const DATAPACKS = [defaultDatapack, gameplayBCarouselDatapack];
const MAP_PARTY = [
  { characterId: Character.Shiroko, variantId: VARIANTS[Character.Shiroko] },
  { characterId: Character.Serika, variantId: VARIANTS[Character.Serika] },
] as const;
const MAP_HAND_ACTION_IDS = ['inspect-site', 'steady-equipment', 'assist-teammate'];

function resolveVariantCharacterId(variantId: string): string | null {
  return DATAPACKS.flatMap(datapack => datapack.characterVariants ?? [])
    .find(variant => variant.id === variantId)?.proto ?? null;
}

describe('Gameplay B MapRun Save/Resume', () => {
  const games: GameInstance[] = [];

  function createGame(): GameInstance {
    const game = createAppRuntime();
    game.init(DATAPACKS, { enterDefaultInit: true });
    games.push(game);
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    for (const student of STUDENTS) game.mutations.acquireCharacter(VARIANTS[student], 'story');
    return game;
  }

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('rejects Maps without a valid resumeVersion instead of silently omitting their active Run', () => {
    const map = gameplayBCarouselDatapack.maps?.[0];
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map is missing');

    const invalidMap = { ...map, resumeVersion: 0 };
    const invalidOwner = new MapRunService(
      { resolve: mapId => mapId === map.id ? invalidMap : null },
      resolveVariantCharacterId,
    );
    expect(() => invalidOwner.start(map.id, MAP_PARTY)).toThrow(/resumeVersion/);
    expect(invalidOwner.getSnapshot()).toBeNull();
    expect(invalidOwner.createSaveSnapshot()).toBeNull();

    const mutableMap = { ...map };
    const activeOwner = new MapRunService({ resolve: () => mutableMap }, resolveVariantCharacterId);
    const active = activeOwner.start(map.id, MAP_PARTY);
    mutableMap.resumeVersion = 0;
    expect(() => activeOwner.createSaveSnapshot()).toThrow(/resumeVersion/);
    expect(activeOwner.getSnapshot()).toEqual(active);
  });

  test('rejects checkpoint restore without a Registry Variant lookup and leaves the owner empty', () => {
    const map = gameplayBCarouselDatapack.maps?.[0];
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map is missing');
    const mapResolver = { resolve: (mapId: string) => mapId === map.id ? map : null };

    const inMemoryOwner = new MapRunService(mapResolver);
    inMemoryOwner.start(map.id, MAP_PARTY);
    const checkpoint = inMemoryOwner.createSaveSnapshot();
    expect(checkpoint).not.toBeNull();
    if (!checkpoint) throw new Error('MapRun checkpoint is missing');

    const restoreOwner = new MapRunService(mapResolver);
    expect(restoreOwner.restoreSaveSnapshot(checkpoint)).toMatchObject({
      status: 'rejected',
      reason: 'invalid-run',
      diagnostics: [expect.stringContaining('Registry Variant lookup')],
    });
    expect(restoreOwner.getSnapshot()).toBeNull();
  });

  test('round-trips an in-progress MapRun and active Encounter without replaying entry', () => {
    const source = createGame();
    const map = gameplayBCarouselDatapack.maps?.[0];
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map is missing');

    const started = source.startMap(map.id);
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === started.currentNodeId
      && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
    expect(encounterEdge).toBeDefined();
    if (!encounterEdge) throw new Error('Sample Map start Node has no Encounter edge');
    const active = source.moveMap(started.runId, encounterEdge.toNodeId);
    const save = source.save();

    expect(save.mapRun).toMatchObject({ mapId: map.id, resumeVersion: map.resumeVersion, run: active });
    expect(save.mapRun?.run.runId).toBe(started.runId);
    expect(save.mapRun?.run.visitedNodeIds).toEqual([started.currentNodeId, encounterEdge.toNodeId]);
    expect(save.mapRun?.run.activeEncounter?.nodeId).toBe(encounterEdge.toNodeId);
    expect(save.mapRun?.run.activeEncounter).toMatchObject({
      nodeId: encounterEdge.toNodeId,
      round: 1,
      drawCursorStart: 0,
      hands: [
        { characterId: Character.Shiroko, actionIds: expect.arrayContaining(MAP_HAND_ACTION_IDS) },
        { characterId: Character.Serika, actionIds: expect.arrayContaining(MAP_HAND_ACTION_IDS) },
      ],
    });
    expect(Object.keys(save.mapRun!.run)).not.toContain('activeEncounterNodeId');
    expect(JSON.parse(JSON.stringify(save.mapRun!.run))).not.toHaveProperty('activeEncounterNodeId');
    expect(save.mapRun?.run.actorResources).toEqual([
      { characterId: Character.Shiroko, resourceId: 'focus', value: 0 },
      { characterId: Character.Shiroko, resourceId: 'stamina', value: 2 },
      { characterId: Character.Serika, resourceId: 'focus', value: 0 },
      { characterId: Character.Serika, resourceId: 'stamina', value: 2 },
    ]);
    expect(save.mapRun?.run.teamResources).toEqual([
      { resourceId: 'clues', value: 0 },
      { resourceId: 'supplies', value: 1 },
    ]);
    expect(save.mapRun?.run.completedEncounterNodeIds).toEqual([]);

    const resumed = createGame();
    resumed.load(save);
    expect(resumed.mapRun.getSnapshot()).toEqual(active);
    expect(resumed.mapRun.getCurrentEncounter()).toEqual(source.mapRun.getCurrentEncounter());

    const resumedCompleted = resumed.completeMapEncounter(started.runId);
    const sourceCompleted = source.completeMapEncounter(started.runId);
    expect(resumedCompleted).toEqual(sourceCompleted);
    const exitEdge = map.edges.find(edge => edge.fromNodeId === active.currentNodeId);
    expect(exitEdge).toBeDefined();
    if (!exitEdge) throw new Error('Sample Encounter Node has no Exit edge');
    const resumedExit = resumed.moveMap(started.runId, exitEdge.toNodeId);
    const sourceExit = source.moveMap(started.runId, exitEdge.toNodeId);
    expect(resumedExit).toEqual(sourceExit);
    expect(source.save().mapRun).toBeUndefined();
  });

  test('restores detached party identities and a non-initial PlayerCost without checkpoint field leakage', () => {
    const source = createGame();
    const map = gameplayBCarouselDatapack.maps?.[0];
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map is missing');

    source.startMap(map.id);
    const save = source.save();
    expect(save.mapRun).toBeDefined();
    if (!save.mapRun) throw new Error('MapRun checkpoint is missing');
    const sourceRun = source.mapRun.getSnapshot();
    expect(sourceRun).not.toBeNull();
    expect(save.mapRun.run.party).not.toBe(sourceRun?.party);
    expect(save.mapRun.run.party[0]).not.toBe(sourceRun?.party[0]);

    const resumedPlayerCost = map.initialPlayerCost + 11;
    const checkpoint = {
      ...save,
      mapRun: {
        ...save.mapRun,
        run: {
          ...save.mapRun.run,
          playerCost: resumedPlayerCost,
          party: save.mapRun.run.party.map(member => ({
            ...member,
            runtimeHp: 1,
            runtimeActorId: 'untrusted-checkpoint-field',
          })),
        },
      },
    };
    const resumed = createGame();
    resumed.load(checkpoint);

    const restored = resumed.mapRun.getSnapshot();
    expect(restored).toMatchObject({ party: MAP_PARTY, playerCost: resumedPlayerCost });
    expect(restored?.party[0]).toEqual(MAP_PARTY[0]);
    expect(restored?.party[0]).not.toHaveProperty('runtimeHp');
    expect(restored?.party[0]).not.toHaveProperty('runtimeActorId');
    expect(restored?.party).not.toBe(checkpoint.mapRun.run.party);
    expect(restored?.party[0]).not.toBe(checkpoint.mapRun.run.party[0]);

    Object.assign(checkpoint.mapRun.run.party[0], {
      characterId: Character.Hoshino,
      variantId: VARIANTS[Character.Hoshino],
    });
    const resaved = resumed.save();
    expect(resaved.mapRun?.run.playerCost).toBe(resumedPlayerCost);
    expect(resaved.mapRun?.run.party).toEqual(MAP_PARTY);
  });

  test('round-trips completed Encounter progress with no active Encounter', () => {
    const source = createGame();
    const map = gameplayBCarouselDatapack.maps?.[0];
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map is missing');

    const started = source.startMap(map.id);
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === started.currentNodeId
      && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
    expect(encounterEdge).toBeDefined();
    if (!encounterEdge) throw new Error('Sample Map start Node has no Encounter edge');
    const active = source.moveMap(started.runId, encounterEdge.toNodeId);
    const completed = source.completeMapEncounter(started.runId);
    const save = source.save();

    expect(save.mapRun?.run).toEqual(completed);
    expect(save.mapRun?.run.activeEncounter).toBeNull();
    expect(save.mapRun?.run.completedEncounterNodeIds).toEqual([encounterEdge.toNodeId]);
    expect(active.runId).toBe(completed.runId);

    const resumed = createGame();
    resumed.load(save);
    expect(resumed.mapRun.getSnapshot()).toEqual(completed);
    expect(resumed.mapRun.getCurrentEncounter()).toBeNull();
    const exitEdge = map.edges.find(edge => edge.fromNodeId === completed.currentNodeId);
    expect(exitEdge).toBeDefined();
    if (!exitEdge) throw new Error('Sample Encounter Node has no Exit edge');
    expect(resumed.moveMap(started.runId, exitEdge.toNodeId)).toEqual(source.moveMap(started.runId, exitEdge.toNodeId));
  });

  test('rejects an unknown Map or mismatched resumeVersion without changing PlayerState or OperationRun', () => {
    const source = createGame();
    const map = gameplayBCarouselDatapack.maps?.[0];
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map is missing');
    const operationRunId = source.operationEntry.start(IDS.event, STUDENTS).runId;
    const started = source.startMap(map.id);
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === map.startNodeId
      && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
    expect(encounterEdge).toBeDefined();
    if (!encounterEdge) throw new Error('Sample Map start Node has no Encounter edge');
    source.moveMap(started.runId, encounterEdge.toNodeId);
    const save = source.save();
    expect(save.mapRun).toBeDefined();
    expect(save.operationRun?.run.runId).toBe(operationRunId);
    if (!save.mapRun) throw new Error('MapRun checkpoint is missing');

    const rejectedCheckpoints = [
      { checkpoint: { ...save.mapRun, mapId: 'gameplay-b:map:missing' }, diagnostic: 'Map is not available' },
      { checkpoint: { ...save.mapRun, resumeVersion: save.mapRun.resumeVersion + 1 }, diagnostic: 'resumeVersion changed' },
      {
        checkpoint: {
          ...save.mapRun,
          run: {
            ...save.mapRun.run,
            party: [{ characterId: Character.Shiroko, variantId: VARIANTS[Character.Hoshino] }],
          },
        },
        diagnostic: 'does not match the current Map',
      },
    ] as const;

    for (const { checkpoint, diagnostic } of rejectedCheckpoints) {
      const resumed = createGame();
      resumed.load({ ...save, mapRun: checkpoint });

      expect(resumed.mapRun.getSnapshot()).toBeNull();
      expect(resumed.state).toEqual(save.playerState);
      expect(resumed.operationEntry.getSnapshot()).toEqual(save.operationRun?.run);
      expect(resumed.operationEntry.getLastRestoreResult()).toMatchObject({ status: 'restored', runId: operationRunId });
      expect(resumed.getDevLogs()).toContainEqual(expect.objectContaining({
        source: 'map-run',
        level: 'warning',
        details: expect.stringContaining(diagnostic),
      }));
    }

    const mapResolver = { resolve: (mapId: string) => mapId === map.id ? map : null };
    const startOwner = new MapRunService(mapResolver, resolveVariantCharacterId);
    expect(() => startOwner.start(map.id, [{
      characterId: Character.Shiroko,
      variantId: VARIANTS[Character.Hoshino],
    }])).toThrow(/complete admitted party snapshot/);
    expect(startOwner.getSnapshot()).toBeNull();

    const owner = new MapRunService(mapResolver, resolveVariantCharacterId);
    const mismatchedCheckpoint = {
      ...save.mapRun,
      run: {
        ...save.mapRun.run,
        party: [{ characterId: Character.Shiroko, variantId: VARIANTS[Character.Hoshino] }],
      },
    };
    expect(owner.restoreSaveSnapshot(mismatchedCheckpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(owner.getSnapshot()).toBeNull();
    expect(owner.restoreSaveSnapshot(save.mapRun)).toMatchObject({ status: 'restored', mapId: map.id });
    expect(owner.getSnapshot()?.party).toEqual(MAP_PARTY);
  });
});
