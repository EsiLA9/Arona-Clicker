import { afterEach, describe, expect, test } from 'vitest';
import { createAppRuntime, DEFAULT_INIT_ID } from '../../src/app/runtime-bootstrap';
import {
  gameplayBAutonomousTargetBattleDefinition,
  gameplayBMapDatapack,
} from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { Character } from '../../src/arona-clicker/types/ids';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';

const STUDENTS = [Character.Hoshino, Character.Serika, Character.Shiroko] as const;
const VARIANTS: Record<typeof STUDENTS[number], string> = {
  [Character.Hoshino]: 'Hoshino',
  [Character.Serika]: 'Serika',
  [Character.Shiroko]: 'Shiroko',
};
const DATAPACKS = [defaultDatapack, gameplayBMapDatapack];
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

  function createMapOnlyGame(): GameInstance {
    const game = createAppRuntime();
    game.init([defaultDatapack, gameplayBMapDatapack], { enterDefaultInit: true });
    games.push(game);
    for (const student of [Character.Shiroko, Character.Serika]) game.mutations.acquireCharacter(VARIANTS[student], 'story');
    expect(game.state.activeInit).toBe(DEFAULT_INIT_ID);
    return game;
  }

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  test('rejects Maps without a valid resumeVersion instead of silently omitting their active Run', () => {
    const map = gameplayBMapDatapack.maps?.[0];
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

  test('round-trips declared MapRun Facts and rejects missing, extra, duplicate, or out-of-range saved values', () => {
    const baseMap = gameplayBMapDatapack.maps?.[0];
    expect(baseMap).toBeDefined();
    if (!baseMap) throw new Error('Gameplay B sample Map is missing');
    const map = {
      ...baseMap,
      mapRunFacts: {
        counters: [{ id: 'route-progress', initial: 1, min: 0, max: 3 }],
        flags: [{ id: 'alerted', initial: false }],
      },
    };
    const resolver = { resolve: (mapId: string) => mapId === map.id ? map : null };
    const source = new MapRunService(resolver, resolveVariantCharacterId);
    source.start(map.id, MAP_PARTY);
    const checkpoint = source.createSaveSnapshot();
    expect(checkpoint?.run.mapRunFacts).toEqual({
      counters: [{ id: 'route-progress', value: 1 }],
      flags: [{ id: 'alerted', value: false }],
    });
    if (!checkpoint) throw new Error('MapRun checkpoint is missing');

    const progressed = {
      ...checkpoint,
      run: {
        ...checkpoint.run,
        mapRunFacts: {
          counters: [{ id: 'route-progress', value: 2 }],
          flags: [{ id: 'alerted', value: true }],
        },
      },
    };
    const restored = new MapRunService(resolver, resolveVariantCharacterId);
    expect(restored.restoreSaveSnapshot(progressed)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()?.mapRunFacts).toEqual(progressed.run.mapRunFacts);

    const invalidSnapshots = [
      { ...checkpoint.run, mapRunFacts: undefined },
      { ...checkpoint.run, mapRunFacts: { ...checkpoint.run.mapRunFacts!, extra: true } },
      { ...checkpoint.run, mapRunFacts: { counters: [{ id: 'route-progress', value: 4 }], flags: [{ id: 'alerted', value: false }] } },
      { ...checkpoint.run, mapRunFacts: { counters: [{ id: 'route-progress', value: 1 }, { id: 'route-progress', value: 1 }], flags: [{ id: 'alerted', value: false }] } },
      { ...checkpoint.run, mapRunFacts: { counters: [{ id: 'forged', value: 1 }], flags: [{ id: 'alerted', value: false }] } },
      { ...checkpoint.run, mapRunFacts: { counters: [{ id: 'route-progress', value: Number.MAX_SAFE_INTEGER + 1 }], flags: [{ id: 'alerted', value: false }] } },
      { ...checkpoint.run, mapRunFacts: { counters: [{ id: 'route-progress', value: 1 }], flags: [{ id: 'alerted', value: 0 }] } },
      { ...checkpoint.run, mapRunFacts: { counters: [{ id: 'route-progress', value: 1 }], flags: [{ id: 'alerted', value: false, extra: 0 }] } },
    ];
    for (const run of invalidSnapshots) {
      const owner = new MapRunService(resolver, resolveVariantCharacterId);
      expect(owner.restoreSaveSnapshot({ ...checkpoint, run })).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
      expect(owner.getSnapshot()).toBeNull();
    }

    const noFactsMap = { ...baseMap };
    const noFactsResolver = { resolve: (mapId: string) => mapId === noFactsMap.id ? noFactsMap : null };
    const legacyOwner = new MapRunService(noFactsResolver, resolveVariantCharacterId);
    expect(legacyOwner.restoreSaveSnapshot({ ...checkpoint, run: checkpoint.run })).toMatchObject({
      status: 'rejected', reason: 'invalid-run',
    });
    expect(legacyOwner.getSnapshot()).toBeNull();
  });

  test('rejects checkpoint restore without a Registry Variant lookup and leaves the owner empty', () => {
    const map = gameplayBMapDatapack.maps?.[0];
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
    const map = gameplayBMapDatapack.maps?.[0];
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
    expect(save.mapRun?.run).not.toHaveProperty('partyAgility');
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
    expect(save.mapRun?.run.activeEncounter).not.toHaveProperty('enemyAgility');
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

  test('runs and restores the real Map-only two-round autonomous battle against three Robots', () => {
    expect(gameplayBMapDatapack.maps).toContainEqual(gameplayBAutonomousTargetBattleDefinition);
    const source = createMapOnlyGame();
    const started = source.startMap(gameplayBAutonomousTargetBattleDefinition.id);
    expect(started.currentNodeId).toBe('entry');
    const round1Run = source.moveMap(started.runId, 'battle');
    const round1View = source.mapRun.getWorkspaceView(started.runId);
    if (round1View?.kind !== 'active' || !round1View.actionPreview) throw new Error('Map-only battle Preview is missing');
    expect(round1View.currentEncounter?.enemies.map(enemy => [enemy.enemyId, enemy.currentHp])).toEqual([
      ['robot-a', 2], ['robot-b', 8], ['robot-c', 8],
    ]);
    expect(round1View.actionPreview.preparedActions.map(row => row.preparedAction?.actionId)).toEqual([
      'autonomous-standard-shot', 'autonomous-standard-shot',
    ]);
    expect(round1View.actionPreview.preparedActions.map(row => row.targetEnemyId)).toEqual(['robot-a', 'robot-a']);
    expect(round1View.actionPreview.preparedEnemyActions.map(row => [row.enemyId, row.naturalAction?.actionId, row.targetCharacterId]))
      .toEqual([
        ['robot-a', 'robot-counterattack', 'shiroko'],
        ['robot-b', 'robot-counterattack', 'shiroko'],
        ['robot-c', 'robot-counterattack', 'shiroko'],
      ]);
    const beforePreview = source.mapRun.getSnapshot();
    const repeatedRound1View = source.mapRun.getWorkspaceView(started.runId);
    if (repeatedRound1View?.kind !== 'active' || !repeatedRound1View.actionPreview) throw new Error('Repeated Preview is missing');
    expect(repeatedRound1View.actionPreview.commitPreview).toMatchObject({ canCommit: true });
    expect(repeatedRound1View.actionPreview.commitPreview).toEqual(round1View.actionPreview.commitPreview);
    expect(source.mapRun.getSnapshot()).toEqual(beforePreview);

    const round1 = source.commitMapEncounterRound({
      runId: started.runId,
      requestId: 'autonomous-target-round-1',
      expectedCommitVersion: round1Run.commitVersion,
      draft: round1View.actionPreview.draft,
    });
    expect(round1.lastEncounterCommit?.settlements[0]).toMatchObject({
      characterId: 'shiroko', actionId: 'autonomous-standard-shot', targetEnemyId: 'robot-a',
      hpChanges: [{ scope: 'enemy', enemyId: 'robot-a', delta: -2 }],
    });
    expect(round1.lastEncounterCommit?.settlements[1]).toMatchObject({
      characterId: 'serika', actionId: 'autonomous-standard-shot', targetEnemyId: 'robot-b',
      hpChanges: [{ scope: 'enemy', enemyId: 'robot-b', delta: -2 }],
    });
    expect(round1.lastEncounterCommit?.enemyActions).toMatchObject([
      { enemyId: 'robot-a', actionId: 'robot-counterattack', skipReason: 'defeated' },
      { enemyId: 'robot-b', actionId: 'robot-counterattack', targetCharacterId: 'shiroko', hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -3 }] },
      { enemyId: 'robot-c', actionId: 'robot-counterattack', targetCharacterId: 'shiroko', hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -3 }] },
    ]);
    expect(round1.activeEncounter).toMatchObject({ round: 2 });
    expect(round1.activeEncounter?.drawCursorStart).toBeGreaterThan(round1Run.activeEncounter!.drawCursorStart);
    expect(round1.activeEncounter?.enemies.map(enemy => [enemy.enemyId, enemy.currentHp])).toEqual([
      ['robot-a', 0], ['robot-b', 6], ['robot-c', 8],
    ]);
    expect(round1.partyHp.map(row => [row.characterId, row.currentHp])).toEqual([
      ['shiroko', 4], ['serika', 10],
    ]);
    expect(round1.teamResources.find(row => row.resourceId === 'clues')?.value).toBe(2);

    const round2Start = round1.activeEncounter!;
    const shirokoHand = round2Start.hands.find(hand => hand.characterId === 'shiroko');
    if (!shirokoHand?.actionIds.includes('autonomous-take-cover')) throw new Error('Round 2 Shiroko Hand lacks Take Cover');
    const round2View = source.mapRun.getWorkspaceView(started.runId);
    if (round2View?.kind !== 'active' || !round2View.actionPreview) throw new Error('Round 2 Preview is missing');
    expect(round2View.actionPreview.preparedActions.map(row => row.targetEnemyId)).toEqual(['robot-b', 'robot-b']);
    expect(round2View.actionPreview.preparedEnemyActions.map(row => row.enemyId)).toEqual(['robot-a', 'robot-b', 'robot-c']);
    expect(round2View.actionPreview.preparedEnemyActions.slice(1).every(row => row.naturalAction?.actionId === 'robot-counterattack')).toBe(true);

    const swapped = source.swapMapPreparedAction(
      started.runId, 'shiroko', 'autonomous-take-cover', round2View.actionPreview.draft,
    );
    const swappedView = source.mapRun.getWorkspaceView(started.runId);
    if (swappedView?.kind !== 'active' || !swappedView.actionPreview) throw new Error('Swap Preview is missing');
    const swappedShiroko = swappedView.actionPreview.preparedActions[0];
    expect(swappedShiroko).toMatchObject({ targetKind: 'self', targetCharacterId: 'shiroko', targetEnemyId: null });
    expect(swappedView.actionPreview.commitPreview).toMatchObject({ canCommit: true });
    expect(swapped.activeEncounter?.hands).toEqual(round2Start.hands);
    expect(swapped.activeEncounter?.randomState).toEqual(round2Start.randomState);
    expect(swapped.actorResources).toEqual(round1.actorResources);
    expect(swapped.teamResources).toEqual(round1.teamResources);

    const natural = source.clearMapActionOverride(started.runId, 'shiroko', swappedView.actionPreview.draft);
    const naturalView = source.mapRun.getWorkspaceView(started.runId);
    if (naturalView?.kind !== 'active' || !naturalView.actionPreview) throw new Error('Natural Action Preview is missing');
    expect(naturalView.actionPreview.preparedActions[0]).toMatchObject({
      preparedAction: { actionId: 'autonomous-standard-shot' }, targetEnemyId: 'robot-b', targetSelectionRequired: false,
    });
    expect(natural.activeEncounter?.hands).toEqual(round2Start.hands);
    expect(natural.activeEncounter?.randomState).toEqual(round2Start.randomState);

    const manual = source.setMapPreparedEnemyTarget(
      started.runId, 'shiroko', 'robot-c', naturalView.actionPreview.draft,
    );
    const manualView = source.mapRun.getWorkspaceView(started.runId);
    if (manualView?.kind !== 'active' || !manualView.actionPreview) throw new Error('Manual-target Preview is missing');
    expect(manualView.actionPreview.preparedActions[0].targetEnemyId).toBe('robot-c');
    expect(manual.activeEncounter?.hands).toEqual(round2Start.hands);
    expect(manual.activeEncounter?.randomState).toEqual(round2Start.randomState);
    const preparedBeforeSave = source.mapRun.getSnapshot();
    expect(source.mapRun.getWorkspaceView(started.runId)).toEqual(manualView);
    expect(source.mapRun.getSnapshot()).toEqual(preparedBeforeSave);

    const checkpoint = source.save();
    expect(checkpoint.mapRun?.run.activeEncounter?.targetSelections).toContainEqual({
      characterId: 'shiroko', targetEnemyId: 'robot-c',
    });
    const resumed = createMapOnlyGame();
    resumed.load(checkpoint);
    expect(resumed.mapRun.getSnapshot()).toEqual(preparedBeforeSave);
    expect(resumed.mapRun.getWorkspaceView(started.runId)).toEqual(manualView);
    const resumedManualView = resumed.mapRun.getWorkspaceView(started.runId);
    if (resumedManualView?.kind !== 'active' || !resumedManualView.actionPreview) throw new Error('Resumed Preview is missing');
    expect(resumedManualView.actionPreview.commitPreview).toMatchObject({ canCommit: true });

    const round2Command = {
      runId: started.runId,
      requestId: 'autonomous-target-round-2',
      expectedCommitVersion: manual.commitVersion,
      draft: manualView.actionPreview.draft,
    };
    const round2 = source.commitMapEncounterRound(round2Command);
    expect(resumed.commitMapEncounterRound(round2Command)).toEqual(round2);
    expect(round2.lastEncounterCommit?.settlements.map(row => [row.characterId, row.targetEnemyId])).toEqual([
      ['shiroko', 'robot-c'], ['serika', 'robot-b'],
    ]);
    expect(round2.lastEncounterCommit?.enemyActions).toHaveLength(3);
    expect(round2.activeEncounter?.enemies.map(enemy => [enemy.enemyId, enemy.currentHp])).toEqual([
      ['robot-a', 0], ['robot-b', 4], ['robot-c', 6],
    ]);
    expect(round2.teamResources.find(row => row.resourceId === 'clues')?.value).toBe(4);
    const committedSave = source.save();
    const receiptAfterResume = createMapOnlyGame();
    receiptAfterResume.load(committedSave);
    expect(receiptAfterResume.mapRun.getSnapshot()?.lastEncounterCommit).toEqual(round2.lastEncounterCommit);
  });

  test('restores detached party identities and a non-initial PlayerCost without checkpoint field leakage', () => {
    const source = createGame();
    const map = gameplayBMapDatapack.maps?.[0];
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
    const map = gameplayBMapDatapack.maps?.[0];
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

  test('rejects an unknown Map or mismatched resumeVersion without changing PlayerState', () => {
    const source = createGame();
    expect(gameplayBMapDatapack.maps?.every(candidate => Number.isSafeInteger(candidate.resumeVersion)
      && candidate.resumeVersion >= 1)).toBe(true);
    const map = gameplayBMapDatapack.maps?.[0];
    expect(map).toBeDefined();
    if (!map) throw new Error('Gameplay B sample Map is missing');
    const started = source.startMap(map.id);
    const encounterEdge = map.edges.find(edge => edge.fromNodeId === map.startNodeId
      && map.nodes.find(node => node.id === edge.toNodeId)?.encounter);
    expect(encounterEdge).toBeDefined();
    if (!encounterEdge) throw new Error('Sample Map start Node has no Encounter edge');
    source.moveMap(started.runId, encounterEdge.toNodeId);
    const save = source.save();
    expect(save.mapRun).toBeDefined();
    if (!save.mapRun) throw new Error('MapRun checkpoint is missing');

    const rejectedCheckpoints = [
      { checkpoint: { ...save.mapRun, mapId: 'gameplay-b:map:missing' }, diagnostic: 'Map is not available' },
      { checkpoint: { ...save.mapRun, resumeVersion: save.mapRun.resumeVersion + 1 }, diagnostic: 'resumeVersion changed' },
      { checkpoint: { ...save.mapRun, resumeVersion: map.resumeVersion - 1 }, diagnostic: 'resumeVersion changed' },
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
