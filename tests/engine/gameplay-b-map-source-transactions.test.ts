import { afterEach, describe, expect, test } from 'vitest';
import { Resource } from '../../src/arona-clicker/types/ids';
import { createGameCommands } from '../../src/arona-clicker/runtime-commands';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { MapRunError, MapRunService } from '../../src/arona-clicker/services/map-run-service';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { GameplayMapActionDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import type { MapRun, MapRunEncounterCommitCommand, MapRunEncounterDraftToken, MapRunEncounterSourceTarget } from '../../src/arona-clicker/contracts/map-run';

const MAP_ID = gameplayBMapDatapack.maps![0]!.id;
const ITEM_ID = 'gameplay-b:item:map-kit';
const SECOND_ITEM_ID = 'gameplay-b:item:map-kit-2';
const ABILITY_ID = 'ability-hit';
const SECOND_ABILITY_ID = 'ability-hit-2';
const ITEM_ACTION_ID = 'item-hit';
const ENEMY_ID = 'wolf';

interface BattleOptions {
  readonly playerCost?: number;
  readonly enemyHp?: number;
  readonly characterDamage?: number;
  readonly characterTarget?: 'enemy' | 'none';
  readonly abilityDamage?: number;
  readonly itemDamage?: number;
  readonly itemTarget?: 'enemy' | 'partyCharacter';
  readonly enemyDamage?: number;
  readonly enemyCount?: number;
  readonly useCondition?: boolean;
}

function battleDatapack(options: BattleOptions = {}): Datapack {
  const baseMap = gameplayBMapDatapack.maps?.[0];
  if (!baseMap) throw new Error('Gameplay B sample Map is missing');
  const characterActionIds = ['char-hit-1', 'char-hit-2', 'char-hit-3', 'char-hit-4'];
  const characterActions: GameplayMapActionDef[] = characterActionIds.map(id => ({
    id,
    name: id,
    eligibleCharacterIds: ['shiroko', 'serika'],
    target: { kind: options.characterTarget ?? 'enemy' },
    ...(options.characterDamage === undefined || options.characterDamage === 0
      ? {}
      : { hpEffects: [{ amount: options.characterDamage }] }),
  }));
  const actions: GameplayMapActionDef[] = [
    ...characterActions,
    {
      id: ABILITY_ID,
      name: 'Map Ability',
      eligibleCharacterIds: [],
      target: { kind: 'enemy' },
      hpEffects: [{ amount: options.abilityDamage ?? -1 }],
    },
    {
      id: SECOND_ABILITY_ID,
      name: 'Second Map Ability',
      eligibleCharacterIds: [],
      target: { kind: 'enemy' },
      hpEffects: [{ amount: options.abilityDamage ?? -1 }],
    },
    {
      id: ITEM_ACTION_ID,
      name: 'Map Item',
      eligibleCharacterIds: [],
      target: { kind: options.itemTarget ?? 'enemy' },
      hpEffects: [{ amount: options.itemDamage ?? -1 }],
    },
  ];
  const enemyAction: GameplayMapActionDef | null = options.enemyDamage === undefined ? null : {
    id: 'enemy-attack',
    name: 'Enemy Attack',
    eligibleCharacterIds: [],
    target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
    tendencyRole: 'attack',
    hpEffects: [{ amount: -options.enemyDamage }],
  };
  const enemies = Array.from({ length: options.enemyCount ?? 1 }, (_, index) => ({
    id: index === 0 ? ENEMY_ID : `wolf-${index + 1}`,
    initialHp: options.enemyHp ?? 20,
    maxHp: options.enemyHp ?? 20,
    ...(enemyAction ? { actions: [{ actionId: enemyAction.id, tendencyWeight: 1 }] } : {}),
  }));
  const encounter = baseMap.nodes.find(node => node.id === 'b')?.encounter;
  if (!encounter) throw new Error('Gameplay B sample Encounter is missing');
  const { completion: _completion, ...encounterWithoutCompletion } = encounter;
  void _completion;
  const map: GameplayMapDef = {
    ...baseMap,
    resumeVersion: baseMap.resumeVersion + 1,
    initialPlayerCost: options.playerCost ?? 2,
    actions: enemyAction ? [...actions, enemyAction] : actions,
    nodes: baseMap.nodes.map(node => node.id !== 'b' ? node : ({
      ...node,
      encounter: {
        ...encounterWithoutCompletion,
        enemies,
        abilityActionIds: [ABILITY_ID, SECOND_ABILITY_ID],
        itemActions: [
          { itemId: ITEM_ID, actionId: ITEM_ACTION_ID },
          { itemId: SECOND_ITEM_ID, actionId: ITEM_ACTION_ID },
        ],
        participants: ['shiroko', 'serika'].map(characterId => ({
          characterId,
          actions: characterActionIds.map(actionId => ({ actionId, tendencyWeight: 1 })),
        })),
      },
    })),
  };
  const useCondition = options.useCondition === false ? undefined : {
    type: 'AND' as const,
    conditions: [{ target: 'resource' as const, key: Resource.Credit, comparator: '>=' as const, value: 10 }],
  };
  const items = [ITEM_ID, SECOND_ITEM_ID].map((id, index) => ({
    id,
    name: `Map Kit ${index + 1}`,
    description: 'MapRun-only test consumable.',
    maxStack: 3,
    rarity: 'common' as const,
    type: 'consumable' as const,
    ...(useCondition ? { useCondition } : {}),
    // MapRun must not run this generic PlayerState effect.
    useEffects: [{ op: 'addResource' as const, target: Resource.Credit, value: 100 }],
  }));
  return {
    ...gameplayBMapDatapack,
    spots: gameplayBMapDatapack.spots.map(spot => ({
      ...spot,
      functionalities: (spot.functionalities ?? []).filter(functionality =>
        functionality.kind !== 'mapEntry' || functionality.mapId === map.id),
    })),
    maps: [map],
    items,
  };
}

describe('Gameplay B Ability / Item source transactions', () => {
  const games: GameInstance[] = [];

  function createGame(options: BattleOptions = {}): GameInstance {
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack, battleDatapack(options)], { enterDefaultInit: false });
    return game;
  }

  function enterBattle(game: GameInstance): MapRun {
    const shiroko = game.rosterSystem.getAllVariants().find(candidate => candidate.proto === 'shiroko');
    const serika = game.rosterSystem.getAllVariants().find(candidate => candidate.proto === 'serika');
    if (!shiroko || !serika) throw new Error('Base Datapack party Variants are missing');
    game.mutations.acquireCharacter(shiroko.id, 'story');
    game.mutations.acquireCharacter(serika.id, 'story');
    const started = game.startMap(MAP_ID);
    const edge = game.registry.maps.get(MAP_ID)?.edges.find(candidate => candidate.fromNodeId === started.currentNodeId);
    if (!edge) throw new Error('Map entry has no Encounter edge');
    return game.moveMap(started.runId, edge.toNodeId);
  }

  function token(run: MapRun): MapRunEncounterDraftToken {
    const encounter = run.activeEncounter;
    if (!encounter) throw new Error('Active Encounter is missing');
    return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
  }

  function command(run: MapRun, requestId: string): MapRunEncounterCommitCommand {
    return { runId: run.runId, requestId, expectedCommitVersion: run.commitVersion, draft: token(run) };
  }

  function draftItem(game: GameInstance, run: MapRun, itemId = ITEM_ID, target: MapRunEncounterSourceTarget = { kind: 'enemy', enemyId: ENEMY_ID }): MapRun {
    return game.setMapItemDraft(run.runId, itemId, target, token(run));
  }

  function setCreditForUseCondition(game: GameInstance): void {
    game.mutations.setResource(Resource.Credit, 10);
  }

  afterEach(() => {
    for (const game of games.splice(0)) game.dispose();
  });

  test('combines Ability and PlayerCommand PlayerCost from the Commit start balance', () => {
    const game = createGame({ playerCost: 2, enemyHp: 100 });
    const commands = createGameCommands(game);
    let run = enterBattle(game);
    const preview = game.mapRun.getWorkspaceView(run.runId);
    if (!preview || preview.kind !== 'active' || !preview.actionPreview) throw new Error('Missing Character action preview');
    const commandOption = preview.actionPreview.playerCommandOptions[0];
    if (!commandOption) throw new Error('No Hand-out PlayerCommand candidate is available');
    run = commands.issueMapPlayerCommand(run.runId, commandOption.characterId, commandOption.action.actionId, token(run));
    run = commands.setMapAbilityDraft(run.runId, ABILITY_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(run));
    expect(game.mapRun.getWorkspaceView(run.runId)).toMatchObject({
      kind: 'active',
      actionPreview: { commitPreview: { canCommit: true, playerCostRequired: 2 } },
      sourcePreview: { abilityOptions: expect.arrayContaining([
        expect.objectContaining({ actionId: ABILITY_ID, canPayPlayerCost: true, selected: true }),
      ]) },
    });
    const committed = commands.commitMapEncounterRound(command(run, 'ability-command-cost'));
    expect(committed.playerCost).toBe(0);
    expect(committed.lastEncounterCommit?.settlements.reduce((sum, row) => sum + row.playerCostSpent, 0)).toBe(1);
    expect(committed.lastEncounterCommit?.ability?.playerCostSpent).toBe(1);

    const underfunded = createGame({ playerCost: 1, enemyHp: 100 });
    const underfundedCommands = createGameCommands(underfunded);
    let shortRun = enterBattle(underfunded);
    const shortPreview = underfunded.mapRun.getWorkspaceView(shortRun.runId);
    if (!shortPreview || shortPreview.kind !== 'active' || !shortPreview.actionPreview) throw new Error('Missing action preview');
    const shortOption = shortPreview.actionPreview.playerCommandOptions[0];
    if (!shortOption) throw new Error('No PlayerCommand candidate is available');
    shortRun = underfundedCommands.issueMapPlayerCommand(shortRun.runId, shortOption.characterId, shortOption.action.actionId, token(shortRun));
    shortRun = underfundedCommands.setMapAbilityDraft(shortRun.runId, ABILITY_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(shortRun));
    const before = underfunded.mapRun.getSnapshot();
    const beforeState = structuredClone(underfunded.state);
    const beforeStats = underfunded.statsService.getSnapshot();
    expect(underfunded.mapRun.getWorkspaceView(shortRun.runId)).toMatchObject({
      kind: 'active', actionPreview: { commitPreview: { canCommit: false, playerCostRequired: null } },
    });
    expect(() => underfundedCommands.commitMapEncounterRound(command(shortRun, 'ability-command-underfunded'))).toThrow(MapRunError);
    expect(underfunded.mapRun.getSnapshot()).toEqual(before);
    expect(underfunded.state).toEqual(beforeState);
    expect(underfunded.statsService.getSnapshot()).toEqual(beforeStats);
  });

  test('settles all Character Actions, Ability, and Item in order; later sources pay and consume after an Enemy is defeated', () => {
    const game = createGame({ enemyHp: 5, characterDamage: -5, abilityDamage: -2, itemDamage: -1 });
    const commands = createGameCommands(game);
    let run = enterBattle(game);
    setCreditForUseCondition(game);
    game.mutations.addItem(ITEM_ID, 1, 3);
    const beforePreview = game.mapRun.getWorkspaceView(run.runId);
    if (!beforePreview || beforePreview.kind !== 'active' || !beforePreview.actionPreview) throw new Error('Missing source Encounter preview');
    const beforeActions = beforePreview.actionPreview.preparedActions.map(row => row.preparedAction?.actionId ?? null);
    run = commands.setMapAbilityDraft(run.runId, ABILITY_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(run));
    const handsBeforeItem = run.activeEncounter?.hands;
    run = draftItem(game, run);
    expect(run.activeEncounter?.hands).toEqual(handsBeforeItem);
    expect(run.activeEncounter?.overrides).toEqual([]);
    const afterPreview = game.mapRun.getWorkspaceView(run.runId);
    if (!afterPreview || afterPreview.kind !== 'active' || !afterPreview.actionPreview) throw new Error('Missing drafted Encounter preview');
    expect(afterPreview.actionPreview.preparedActions.map(row => row.preparedAction?.actionId ?? null)).toEqual(beforeActions);
    expect(commands.previewMapEncounterSources(run.runId)?.itemOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: ITEM_ID, canUse: true, selected: true }),
    ]));

    const result = commands.commitMapEncounterRound(command(run, 'all-sources-overkill'));
    expect(result.activeEncounter).toBeNull();
    expect(result.lastEncounterCommit?.settlements.map(row => row.actionId)).toEqual(beforeActions);
    expect(result.lastEncounterCommit?.ability).toMatchObject({
      actionId: ABILITY_ID, playerCostSpent: 1, hpChanges: [{ scope: 'enemy', enemyId: ENEMY_ID, delta: 0 }],
    });
    expect(result.lastEncounterCommit?.item).toMatchObject({
      itemId: ITEM_ID, actionId: ITEM_ACTION_ID, consumedCount: 1,
      hpChanges: [{ scope: 'enemy', enemyId: ENEMY_ID, delta: 0 }],
    });
    expect(result.lastEncounterCommit?.enemyActions).toEqual([
      { enemyId: ENEMY_ID, actionId: null, resourceChanges: [] },
    ]);
    expect(result.playerCost).toBe(1);
    expect(game.state.inventory[ITEM_ID]).toBeUndefined();
    expect(game.statsService.getSnapshot().global.itemsUsed[ITEM_ID]).toBe(1);
  });

  test('keeps separate one-slot Ability and Item drafts, and rejects missing targets and stale versions without writes', () => {
    const game = createGame({ enemyHp: 100 });
    const commands = createGameCommands(game);
    let run = enterBattle(game);
    setCreditForUseCondition(game);
    game.mutations.addItem(ITEM_ID, 1, 3);
    run = commands.setMapAbilityDraft(run.runId, ABILITY_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(run));
    run = commands.setMapAbilityDraft(run.runId, SECOND_ABILITY_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(run));
    run = commands.setMapItemDraft(run.runId, ITEM_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(run));
    run = commands.setMapItemDraft(run.runId, SECOND_ITEM_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(run));
    expect(run.activeEncounter?.abilityDraft).toMatchObject({ actionId: SECOND_ABILITY_ID });
    expect(run.activeEncounter?.itemDraft).toMatchObject({ itemId: SECOND_ITEM_ID, actionId: ITEM_ACTION_ID });
    expect(() => commands.commitMapEncounterRound(command(run, 'missing-item-inventory'))).toThrow(/inventory/i);
    expect(game.mapRun.getSnapshot()).toEqual(run);

    run = commands.setMapItemDraft(run.runId, null, null, token(run));
    run = commands.setMapAbilityDraft(run.runId, null, null, token(run));
    run = commands.setMapAbilityDraft(run.runId, ABILITY_ID, null, token(run));
    const beforeTargetFailure = game.mapRun.getSnapshot();
    const beforeState = structuredClone(game.state);
    const beforeStats = game.statsService.getSnapshot();
    expect(() => commands.commitMapEncounterRound(command(run, 'missing-ability-target'))).toThrow(/target/i);
    expect(game.mapRun.getSnapshot()).toEqual(beforeTargetFailure);
    expect(game.state).toEqual(beforeState);
    expect(game.statsService.getSnapshot()).toEqual(beforeStats);
    const targetFailureEvents: unknown[] = [];
    game.eventBus.on('itemCollected', event => targetFailureEvents.push(event));
    run = commands.setMapAbilityDraft(run.runId, null, null, token(run));
    run = commands.setMapItemDraft(run.runId, ITEM_ID, null, token(run));
    const beforeItemTargetFailure = game.mapRun.getSnapshot();
    const beforeItemTargetState = structuredClone(game.state);
    const beforeItemTargetStats = game.statsService.getSnapshot();
    expect(() => commands.commitMapEncounterRound(command(run, 'missing-item-target'))).toThrow(/target/i);
    expect(game.mapRun.getSnapshot()).toEqual(beforeItemTargetFailure);
    expect(game.state).toEqual(beforeItemTargetState);
    expect(game.statsService.getSnapshot()).toEqual(beforeItemTargetStats);
    expect(targetFailureEvents).toEqual([]);
    expect(() => commands.commitMapEncounterRound({ ...command(run, 'stale-map-version'), expectedCommitVersion: run.commitVersion + 1 })).toThrow(/stale/i);
    expect(() => commands.commitMapEncounterRound({ ...command(run, 'stale-draft-version'), draft: { ...token(run), draftVersion: token(run).draftVersion - 1 } })).toThrow(/stale/i);
    expect(game.mapRun.getSnapshot()).toEqual(beforeItemTargetFailure);
    expect(game.state).toEqual(beforeItemTargetState);
    expect(game.statsService.getSnapshot()).toEqual(beforeItemTargetStats);
  });

  test('rechecks useCondition at Commit and rejects missing Inventory with zero writes and no item event', () => {
    const game = createGame({ enemyHp: 100 });
    const commands = createGameCommands(game);
    let run = enterBattle(game);
    setCreditForUseCondition(game);
    game.mutations.addItem(ITEM_ID, 1, 3);
    run = draftItem(game, run);
    expect(commands.previewMapEncounterSources(run.runId)?.itemOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: ITEM_ID, useConditionSatisfied: true, canUse: true }),
    ]));
    game.mutations.setResource(Resource.Credit, 0);
    expect(commands.previewMapEncounterSources(run.runId)?.itemOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: ITEM_ID, useConditionSatisfied: false, canUse: false }),
    ]));
    const before = game.mapRun.getSnapshot();
    const beforeState = structuredClone(game.state);
    const beforeStats = game.statsService.getSnapshot();
    const events: unknown[] = [];
    game.eventBus.on('itemCollected', event => events.push(event));
    expect(() => commands.commitMapEncounterRound(command(run, 'expired-item-condition'))).toThrow(/useCondition/i);
    expect(game.mapRun.getSnapshot()).toEqual(before);
    expect(game.state).toEqual(beforeState);
    expect(game.statsService.getSnapshot()).toEqual(beforeStats);
    expect(events).toEqual([]);

    game.mutations.setResource(Resource.Credit, 10);
    game.mutations.removeItem(ITEM_ID, 1);
    const noInventoryRun = game.mapRun.getSnapshot()!;
    const beforeMissingState = structuredClone(game.state);
    const beforeMissingRun = game.mapRun.getSnapshot();
    const beforeMissingStats = game.statsService.getSnapshot();
    events.length = 0;
    expect(() => commands.commitMapEncounterRound(command(noInventoryRun, 'missing-map-item'))).toThrow(/inventory/i);
    expect(game.mapRun.getSnapshot()).toEqual(beforeMissingRun);
    expect(game.state).toEqual(beforeMissingState);
    expect(game.statsService.getSnapshot()).toEqual(beforeMissingStats);
    expect(events).toEqual([]);
  });

  test('saves an Item draft without consuming, commits once after Load, and replay never repeats Stats, events, or effects', () => {
    const source = createGame({ enemyHp: 100, useCondition: false });
    const sourceCommands = createGameCommands(source);
    let run = enterBattle(source);
    source.mutations.addItem(ITEM_ID, 1, 3);
    run = draftItem(source, run);
    const draftSave = source.save();
    expect(draftSave.mapRun?.run.activeEncounter?.itemDraft).toEqual({
      itemId: ITEM_ID,
      actionId: ITEM_ACTION_ID,
      target: { kind: 'enemy', enemyId: ENEMY_ID },
    });
    expect(draftSave.playerState.inventory[ITEM_ID]).toBe(1);

    const loaded = createGame({ enemyHp: 100, useCondition: false });
    loaded.load(draftSave);
    const loadedCommands = createGameCommands(loaded);
    const loadedRun = loaded.mapRun.getSnapshot();
    if (!loadedRun) throw new Error('Saved MapRun did not load');
    expect(loadedRun.activeEncounter?.itemDraft?.itemId).toBe(ITEM_ID);
    expect(loaded.state.inventory[ITEM_ID]).toBe(1);
    const eventViews: { inventory: number; runVersion: number; committedItem: string | undefined }[] = [];
    loaded.eventBus.on('itemCollected', event => {
      if (event.itemId !== ITEM_ID || event.count !== -1) return;
      const currentRun = loaded.mapRun.getSnapshot();
      eventViews.push({
        inventory: loaded.state.inventory[ITEM_ID] ?? 0,
        runVersion: currentRun?.commitVersion ?? -1,
        committedItem: currentRun?.lastEncounterCommit?.item?.itemId,
      });
    });
    const commit = command(loadedRun, 'saved-item-commit');
    const committed = loadedCommands.commitMapEncounterRound(commit);
    expect(committed.lastEncounterCommit?.item?.itemId).toBe(ITEM_ID);
    expect(loaded.state.inventory[ITEM_ID]).toBeUndefined();
    expect(eventViews).toEqual([{ inventory: 0, runVersion: 1, committedItem: ITEM_ID }]);
    expect(loaded.statsService.getSnapshot().global.itemsUsed[ITEM_ID]).toBe(1);
    expect(loaded.state.resources[Resource.Credit]).toBe(draftSave.playerState.resources[Resource.Credit]);

    const committedSave = loaded.save();
    const replayed = createGame({ enemyHp: 100, useCondition: false });
    replayed.load(committedSave);
    const replayCommands = createGameCommands(replayed);
    const statsBeforeReplay = replayed.statsService.getSnapshot();
    const runBeforeReplay = replayed.mapRun.getSnapshot();
    const replayEvents: unknown[] = [];
    replayed.eventBus.on('itemCollected', event => { if (event.itemId === ITEM_ID) replayEvents.push(event); });
    expect(replayCommands.commitMapEncounterRound(commit)).toEqual(runBeforeReplay);
    expect(replayed.state.inventory[ITEM_ID]).toBeUndefined();
    expect(replayed.statsService.getSnapshot()).toEqual(statsBeforeReplay);
    expect(replayed.mapRun.getSnapshot()).toEqual(runBeforeReplay);
    expect(replayEvents).toEqual([]);
  });

  test('retains Item debit on party failure, exposes runtime-only failure, and permits explicit rollback to an older Save', () => {
    const game = createGame({
      enemyHp: 100,
      enemyCount: 2,
      characterTarget: 'none',
      itemDamage: -1,
      itemTarget: 'enemy',
      enemyDamage: 10,
      useCondition: false,
    });
    const commands = createGameCommands(game);
    let run = enterBattle(game);
    game.mutations.addItem(ITEM_ID, 1, 3);
    run = draftItem(game, run, ITEM_ID, { kind: 'enemy', enemyId: ENEMY_ID });
    const saveBeforeFailure = game.save();
    const itemUseEvents: unknown[] = [];
    game.eventBus.on('itemCollected', event => { if (event.itemId === ITEM_ID && event.count === -1) itemUseEvents.push(event); });
    const failureCommand = command(run, 'item-causes-failure');
    const failed = commands.commitMapEncounterRound(failureCommand);
    expect(failed.status).toBe('failure');
    expect(game.state.inventory[ITEM_ID]).toBeUndefined();
    expect(game.statsService.getSnapshot().global.itemsUsed[ITEM_ID]).toBe(1);
    expect(itemUseEvents).toHaveLength(1);
    expect(game.mapRun.getResult(run.runId)).toBeNull();
    expect(game.mapRun.getFailureResult(run.runId)).toMatchObject({ outcome: 'failure', runId: run.runId });
    expect(game.mapRun.getFailureWorkspaceView(run.runId)).toMatchObject({ kind: 'failure', result: { outcome: 'failure' } });
    expect(game.save().mapRun).toBeUndefined();

    const failedState = structuredClone(game.state);
    const failedStats = game.statsService.getSnapshot();
    expect(commands.commitMapEncounterRound(failureCommand)).toEqual(failed);
    expect(game.state).toEqual(failedState);
    expect(game.statsService.getSnapshot()).toEqual(failedStats);
    expect(itemUseEvents).toHaveLength(1);

    game.load(saveBeforeFailure);
    expect(game.mapRun.getSnapshot()?.runId).toBe(run.runId);
    expect(game.state.inventory[ITEM_ID]).toBe(1);
    expect(game.mapRun.getFailureResult(run.runId)).toBeNull();
    expect(game.mapRun.getWorkspaceView(run.runId)?.kind).toBe('active');
  });

  test('MapRunService refuses an Item Commit outside the GameInstance cross-owner coordinator', () => {
    const map = battleDatapack({ useCondition: false }).maps?.[0];
    if (!map) throw new Error('Test Battle map is missing');
    const service = new MapRunService({ resolve: id => id === map.id ? map : null }, variantId =>
      variantId.endsWith('serika') ? 'serika' : 'shiroko');
    const started = service.start(map.id, [
      { characterId: 'shiroko', variantId: 'test:variant:shiroko' },
      { characterId: 'serika', variantId: 'test:variant:serika' },
    ]);
    const entered = service.move(started.runId, 'b');
    const drafted = service.setItemDraft(entered.runId, ITEM_ID, { kind: 'enemy', enemyId: ENEMY_ID }, token(entered));
    const before = service.getSnapshot(started.runId);
    const request: MapRunEncounterCommitCommand = command(drafted, 'uncoordinated-item');
    expect(() => service.commitEncounterRound(request)).toThrow(/GameInstance/i);
    expect(service.getSnapshot(started.runId)).toEqual(before);
  });
});
