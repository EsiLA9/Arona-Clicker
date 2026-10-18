import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/operation-samples/gameplay-b-map-datapack';
import { MapRunService } from '../../src/arona-clicker/services/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/registry-map-content-resolver';
import type { MapRun, MapRunEncounterDraftToken } from '../../src/arona-clicker/contracts/map-run';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { baseDatapack } from '../../src/data/test-datapack';

const LINEAR_MAP = 'gameplay-b:map:linear-battle';
const ACTIVITY_MAP = 'gameplay-b:map:activity-hall';
const FORK_MAP = 'gameplay-b:map:forked-route';
const CONDITIONAL_MAP = 'gameplay-b:map:continuous-conditional';
const DAMAGING_ACTION_IDS = new Set(['standard-shot', 'focused-shot']);
const PARTY = ['shiroko', 'serika'] as const;

let requestSequence = 0;

function draftOf(run: MapRun): MapRunEncounterDraftToken {
  const encounter = run.activeEncounter;
  if (!encounter) throw new Error('the Run has no active Encounter');
  return {
    nodeId: encounter.nodeId,
    ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
    round: encounter.round,
    draftVersion: encounter.draftVersion,
  };
}

function requireRun(game: GameInstance): MapRun {
  const run = game.mapRun.getSnapshot();
  if (!run) throw new Error('the GameInstance has no active MapRun');
  return run;
}

function requireActiveView(game: GameInstance): Extract<NonNullable<ReturnType<GameInstance['mapRun']['getWorkspaceView']>>, { kind: 'active' }> {
  const run = requireRun(game);
  const view = game.mapRun.getWorkspaceView(run.runId);
  if (!view || view.kind !== 'active') throw new Error('the active MapRun has no Workspace view');
  return view;
}

/** Resolves every pending party target to the acting character so Rest rounds can commit. */
function selectPendingSelfTargets(game: GameInstance): void {
  for (const characterId of PARTY) {
    const view = requireActiveView(game);
    const row = view.actionPreview?.preparedActions.find(candidate => candidate.characterId === characterId);
    if (!row || row.targetKind !== 'partyCharacter' || !row.targetSelectionRequired) continue;
    game.setMapPreparedTarget(requireRun(game).runId, characterId, characterId, draftOf(requireRun(game)));
  }
}

function commitRound(game: GameInstance, requestId?: string): MapRun {
  selectPendingSelfTargets(game);
  const run = requireRun(game);
  return game.commitMapEncounterRound({
    runId: run.runId,
    requestId: requestId ?? `req-${++requestSequence}`,
    expectedCommitVersion: run.commitVersion,
    draft: draftOf(run),
  });
}

/** Free Swap keeps at least one damaging Hand Action prepared during Battle rounds. */
function prepareDamagingActions(game: GameInstance): void {
  const runId = requireRun(game).runId;
  const battleView = requireActiveView(game);
  if (!battleView.currentEncounter || battleView.currentEncounter.enemies.every(enemy => enemy.currentHp === 0)) return;
  for (const characterId of PARTY) {
    const run = requireRun(game);
    const view = requireActiveView(game);
    const prepared = view.actionPreview?.preparedActions.find(row => row.characterId === characterId);
    if (!prepared) continue;
    if (prepared.preparedAction && DAMAGING_ACTION_IDS.has(prepared.preparedAction.actionId)) continue;
    const handDamaging = prepared.hand.find(action => DAMAGING_ACTION_IDS.has(action.actionId));
    if (!handDamaging) continue;
    game.swapMapPreparedAction(runId, characterId, handDamaging.actionId, draftOf(run));
  }
}

/** Prefers the zero-cost Rest Action so shared-supply costs never over-commit. */
function prepareRestActions(game: GameInstance): void {
  for (const characterId of PARTY) {
    const run = requireRun(game);
    const view = requireActiveView(game);
    const row = view.actionPreview?.preparedActions.find(candidate => candidate.characterId === characterId);
    if (!row || row.preparedAction?.actionId === 'catch-breath') continue;
    const rest = row.hand.find(action => action.actionId === 'catch-breath');
    if (rest) game.swapMapPreparedAction(run.runId, characterId, rest.actionId, draftOf(run));
  }
}

function commitRestRound(game: GameInstance): MapRun {
  prepareRestActions(game);
  return commitRound(game);
}

function activityKey(run: MapRun): string {
  return run.activeActivity?.activityId ?? '__legacy__';
}

/** Commits only the current Encounter; a following Node activity is never auto-played. */
function commitCurrentEncounter(game: GameInstance): MapRun {
  const startKey = activityKey(requireRun(game));
  for (let round = 0; round < 12; round += 1) {
    prepareDamagingActions(game);
    const run = commitRound(game);
    if (run.activeEncounter === null || run.status !== 'inProgress' || activityKey(run) !== startKey) return run;
  }
  throw new Error('the Encounter did not finish within 12 rounds');
}

describe('Gameplay B basic map P0—P3', () => {
  const games: GameInstance[] = [];

  function createGame(maps?: readonly GameplayMapDef[]): GameInstance {
    const datapack = maps === undefined ? gameplayBMapDatapack : {
      ...gameplayBMapDatapack,
      maps: [...(gameplayBMapDatapack.maps ?? []), ...maps],
    };
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack, datapack], { enterDefaultInit: false });
    for (const characterId of PARTY) {
      const variant = game.rosterSystem.getAllVariants()
        .filter(candidate => candidate.proto === characterId)
        .sort((left, right) => left.id.localeCompare(right.id))[0];
      if (!variant) throw new Error(`no registered Variant for "${characterId}"`);
      if (!game.state.roster?.[variant.id]) game.mutations.acquireCharacter(variant.id, 'story');
    }
    return game;
  }

  afterEach(() => {
    for (const game of games.splice(0)) game.dispose();
  });

  describe('P0 linear battle invariants', () => {
    test('moves A → B, blocks movement during the battle, and succeeds only after reaching C', () => {
      const game = createGame();
      const started = game.startMap(LINEAR_MAP);
      expect(started.currentNodeId).toBe('a');
      expect(started.activeEncounter).toBeNull();

      const atB = game.moveMap(started.runId, 'b');
      expect(atB.currentNodeId).toBe('b');
      expect(atB.activeEncounter?.nodeId).toBe('b');
      expect(atB.status).toBe('inProgress');
      expect(() => game.moveMap(started.runId, 'c')).toThrow(/Encounter is active/);

      const cleared = commitCurrentEncounter(game);
      expect(cleared.status).toBe('inProgress');
      expect(cleared.currentNodeId).toBe('b');
      expect(cleared.activeEncounter).toBeNull();
      expect(cleared.completedEncounterNodeIds).toEqual(['b']);
      expect(game.mapRun.getResult(started.runId)).toBeNull();

      const atExit = game.moveMap(started.runId, 'c');
      expect(atExit.status).toBe('success');
      expect(game.mapRun.getSnapshot()).toBeNull();
      expect(game.mapRun.getResult(started.runId)?.exitNodeId).toBe('c');
    });

    test('keeps Swap and PlayerCommand distinct and spends exactly one PlayerCost for a command', () => {
      const game = createGame();
      const started = game.startMap(LINEAR_MAP);
      game.moveMap(started.runId, 'b');

      const before = requireActiveView(game);
      const shiroko = before.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')!;
      expect(shiroko.hand.length).toBe(3);
      const swapTarget = shiroko.hand.find(action => action.actionId !== shiroko.naturalAction?.actionId);
      expect(swapTarget).toBeDefined();

      const swapped = game.swapMapPreparedAction(started.runId, 'shiroko', swapTarget!.actionId, draftOf(requireRun(game)));
      expect(swapped.activeEncounter?.overrides).toEqual([
        { kind: 'swap', characterId: 'shiroko', actionId: swapTarget!.actionId },
      ]);
      expect(swapped.playerCost).toBe(1);

      const restoredDefault = game.clearMapActionOverride(started.runId, 'shiroko', draftOf(requireRun(game)));
      expect(restoredDefault.activeEncounter?.overrides).toEqual([]);

      const commandView = requireActiveView(game);
      const option = commandView.actionPreview!.playerCommandOptions.find(row => row.characterId === 'serika');
      expect(option).toBeDefined();
      const commanded = game.issueMapPlayerCommand(started.runId, 'serika', option!.action.actionId, draftOf(requireRun(game)));
      expect(commanded.activeEncounter?.overrides).toEqual([
        { kind: 'playerCommand', characterId: 'serika', actionId: option!.action.actionId },
      ]);

      const committed = commitRound(game, 'command-round');
      expect(committed.playerCost).toBe(0);
      const settlement = committed.lastEncounterCommit?.settlements.find(row => row.characterId === 'serika');
      expect(settlement?.overrideKind).toBe('playerCommand');
      expect(settlement?.playerCostSpent).toBe(1);
    });

    test('rejects stale drafts, stale commit versions, and replays the same request idempotently', () => {
      const game = createGame();
      const started = game.startMap(LINEAR_MAP);
      game.moveMap(started.runId, 'b');
      const run = requireRun(game);
      const staleDraft = draftOf(run);
      const first = game.commitMapEncounterRound({
        runId: run.runId,
        requestId: 'idempotent-commit',
        expectedCommitVersion: run.commitVersion,
        draft: staleDraft,
      });
      expect(first.commitVersion).toBe(run.commitVersion + 1);

      const replay = game.commitMapEncounterRound({
        runId: run.runId,
        requestId: 'idempotent-commit',
        expectedCommitVersion: run.commitVersion,
        draft: staleDraft,
      });
      expect(replay.commitVersion).toBe(first.commitVersion);
      expect(replay.lastEncounterCommit).toEqual(first.lastEncounterCommit);

      expect(() => game.commitMapEncounterRound({
        runId: run.runId,
        requestId: 'stale-commit',
        expectedCommitVersion: run.commitVersion,
        draft: draftOf(requireRun(game)),
      })).toThrow(/Commit version is stale/);
      expect(() => game.swapMapPreparedAction(
        run.runId,
        'shiroko',
        requireActiveView(game).actionPreview!.preparedActions[0].hand[0].actionId,
        staleDraft,
      )).toThrow(/draft is stale/);
    });

    test('fails the whole MapRun on party defeat without auto-advancing', () => {
      const lethalMap: GameplayMapDef = {
        id: 'test:map:p0-lethal',
        name: 'Lethal Probe',
        resumeVersion: 1,
        startNodeId: 'a',
        exitNodeIds: ['c'],
        partyCharacterIds: ['shiroko', 'serika'],
        initialPartyHp: [
          { characterId: 'shiroko', initialHp: 1, maxHp: 1 },
          { characterId: 'serika', initialHp: 1, maxHp: 1 },
        ],
        initialPlayerCost: 0,
        actions: [
          {
            id: 'wait-safe',
            name: 'Wait',
            eligibleCharacterIds: ['shiroko', 'serika'],
            target: { kind: 'none' },
          },
        ],
        nodes: [
          { id: 'a', title: 'A' },
          {
            id: 'b',
            title: 'B',
            encounter: {
              title: 'Lethal',
              enemies: [{ id: '守门者', initialHp: 10, maxHp: 10, damage: 1 }],
              participants: [
                { characterId: 'shiroko', actions: [{ actionId: 'wait-safe', tendencyWeight: 1 }] },
                { characterId: 'serika', actions: [{ actionId: 'wait-safe', tendencyWeight: 1 }] },
              ],
            },
          },
          { id: 'c', title: 'C' },
        ],
        edges: [
          { fromNodeId: 'a', toNodeId: 'b' },
          { fromNodeId: 'b', toNodeId: 'c' },
        ],
      };
      const game = createGame([lethalMap]);
      const started = game.startMap(lethalMap.id);
      game.moveMap(started.runId, 'b');
      const first = commitRound(game);
      expect(first.partyHp.some(row => row.currentHp === 0)).toBe(true);
      expect(first.status).toBe('inProgress');
      const second = commitRound(game);
      expect(second.partyHp.every(row => row.currentHp === 0)).toBe(true);
      expect(second.status).toBe('failure');
      expect(second.currentNodeId).toBe('b');
      expect(game.mapRun.getSnapshot()).toBeNull();
      const failure = game.mapRun.getFailureResult(started.runId);
      expect(failure?.failedNodeId).toBe('b');
      expect(failure?.reason).toBe('partyDefeated');
      expect(game.mapRun.getResult(started.runId)).toBeNull();
    });

    test('restores a mid-Encounter checkpoint without a free Hand redraw', () => {
      const game = createGame();
      const started = game.startMap(LINEAR_MAP);
      game.moveMap(started.runId, 'b');
      const before = commitRound(game);
      const save = game.save();
      expect(save.mapRun).toBeTruthy();

      const service = new MapRunService(
        createRegistryMapContentResolver(game.registry),
        variantId => game.registry.characterVariants.get(variantId)?.proto,
      );
      expect(service.restoreSaveSnapshot(save.mapRun).status).toBe('restored');
      const restored = service.getSnapshot()!;
      expect(restored.activeEncounter).toEqual(before.activeEncounter);
      expect(restored.partyHp).toEqual(before.partyHp);
      expect(restored.playerCost).toBe(before.playerCost);
    });
  });

  describe('P1 fixed-order Node activities', () => {
    test('runs Battle → Rest → Shop in order and only then returns to the map', () => {
      const game = createGame();
      const started = game.startMap(ACTIVITY_MAP);
      const atB = game.moveMap(started.runId, 'b');
      expect(atB.activeActivity).toEqual(expect.objectContaining({
        nodeId: 'b',
        activityId: 'clear-patrol',
        index: 0,
        kind: 'battle',
      }));
      expect(atB.activeEncounter?.activityId).toBe('clear-patrol');
      expect(() => game.moveMap(started.runId, 'c')).toThrow(/Encounter is active/);

      const afterBattle = commitCurrentEncounter(game);
      expect(afterBattle.status).toBe('inProgress');
      expect(afterBattle.activeActivity).toEqual(expect.objectContaining({
        activityId: 'rest',
        index: 1,
        kind: 'rest',
      }));
      expect(afterBattle.activeEncounter?.activityId).toBe('rest');
      expect(afterBattle.activeEncounter?.round).toBe(1);
      expect(afterBattle.completedActivityIds).toEqual(['b/clear-patrol']);
      expect(afterBattle.completedEncounterNodeIds).toEqual([]);
      expect(() => game.moveMap(started.runId, 'c')).toThrow(/Encounter is active/);

      // Activity identity isolates the previous receipt's request id and stale drafts.
      expect(() => game.commitMapEncounterRound({
        runId: started.runId,
        requestId: afterBattle.lastEncounterCommit!.requestId,
        expectedCommitVersion: afterBattle.commitVersion,
        draft: draftOf(afterBattle),
      })).toThrow(/already used with different input/);
      expect(() => game.commitMapEncounterRound({
        runId: started.runId,
        requestId: 'battle-draft-after-victory',
        expectedCommitVersion: afterBattle.commitVersion,
        draft: { nodeId: 'b', activityId: 'clear-patrol', round: 1, draftVersion: 0 },
      })).toThrow(/draft is stale/);

      const afterRestRoundOne = commitRestRound(game);
      expect(afterRestRoundOne.activeEncounter?.round).toBe(2);
      const afterRest = commitRestRound(game);
      expect(afterRest.activeActivity).toEqual(expect.objectContaining({
        activityId: 'supply',
        index: 2,
        kind: 'shop',
      }));
      expect(afterRest.activeEncounter).toBeNull();
      expect(afterRest.completedActivityIds).toEqual(['b/clear-patrol', 'b/rest']);
      expect(afterRest.completedEncounterNodeIds).toEqual([]);
      expect(() => game.moveMap(started.runId, 'c')).toThrow(/Node activity is in progress/);

      const shopView = requireActiveView(game);
      expect(shopView.shop?.offers.map(offer => offer.offerId)).toEqual(['field-ration', 'spare-parts']);
      const suppliesBefore = afterRest.teamResources.find(row => row.resourceId === 'supplies')!.value;
      const cluesBefore = afterRest.teamResources.find(row => row.resourceId === 'clues')!.value;
      const draft = { nodeId: 'b', activityId: 'supply', draftVersion: shopView.shop!.draftVersion };
      const purchased = game.purchaseMapShopOffer(started.runId, 'spare-parts', 'buy-1', draft);
      expect(purchased.teamResources.find(row => row.resourceId === 'supplies')!.value).toBe(suppliesBefore - 1);
      expect(purchased.teamResources.find(row => row.resourceId === 'clues')!.value).toBe(cluesBefore + 2);
      expect(purchased.activeActivity?.lastPurchase).toEqual(expect.objectContaining({
        requestId: 'buy-1',
        offerId: 'spare-parts',
        resultingDraftVersion: 1,
      }));

      const replayed = game.purchaseMapShopOffer(started.runId, 'spare-parts', 'buy-1', draft);
      expect(replayed.teamResources).toEqual(purchased.teamResources);
      expect(() => game.purchaseMapShopOffer(started.runId, 'spare-parts', 'buy-2', draft))
        .toThrow(/Shop draft is stale/);

      const left = game.leaveMapShop(started.runId, { nodeId: 'b', activityId: 'supply', draftVersion: 1 });
      expect(left.activeActivity).toBeNull();
      expect(left.status).toBe('inProgress');
      expect(left.completedActivityIds).toEqual(['b/clear-patrol', 'b/rest', 'b/supply']);
      expect(left.completedEncounterNodeIds).toEqual(['b']);

      const atExit = game.moveMap(started.runId, 'c');
      expect(atExit.status).toBe('success');
      expect(game.mapRun.getResult(started.runId)?.exitNodeId).toBe('c');
    });

    test('keeps HP damage from Battle into Rest and lets Rest restore it before the Shop', () => {
      const game = createGame();
      const started = game.startMap(ACTIVITY_MAP);
      game.moveMap(started.runId, 'b');
      const damaged = commitCurrentEncounter(game);
      const anyDamaged = damaged.partyHp.some(row => row.currentHp < 10);
      expect(damaged.activeActivity?.kind).toBe('rest');

      const healAll = () => {
        for (const characterId of PARTY) {
          const run = requireRun(game);
          const view = requireActiveView(game);
          const prepared = view.actionPreview!.preparedActions.find(row => row.characterId === characterId);
          if (!prepared || prepared.preparedAction?.actionId === 'catch-breath') continue;
          const rest = prepared.hand.find(action => action.actionId === 'catch-breath');
          if (rest) game.swapMapPreparedAction(run.runId, characterId, rest.actionId, draftOf(run));
        }
      };
      const hpBeforeRest = damaged.partyHp;
      healAll();
      const afterRoundOne = commitRound(game);
      expect(afterRoundOne.activeEncounter?.round).toBe(2);
      healAll();
      const afterRest = commitRound(game);
      expect(afterRest.activeActivity?.kind).toBe('shop');
      const hpAfterRest = new Map(afterRest.partyHp.map(row => [row.characterId, row.currentHp]));
      for (const row of hpBeforeRest) {
        expect(hpAfterRest.get(row.characterId) ?? 0).toBeGreaterThanOrEqual(row.currentHp);
      }
      if (anyDamaged) {
        expect(afterRest.partyHp.some(row => row.currentHp > (hpBeforeRest.find(before => before.characterId === row.characterId)?.currentHp ?? 0)))
          .toBe(true);
      } else {
        expect(afterRest.partyHp).toEqual(hpBeforeRest);
      }
    });

    test('restores a mid-Shop checkpoint at the same activity and draft version', () => {
      const game = createGame();
      const started = game.startMap(ACTIVITY_MAP);
      game.moveMap(started.runId, 'b');
      commitCurrentEncounter(game);
      commitRestRound(game);
      commitRestRound(game);
      const shop = requireActiveView(game).shop!;
      const purchased = game.purchaseMapShopOffer(
        started.runId,
        'spare-parts',
        'shop-save',
        { nodeId: 'b', activityId: 'supply', draftVersion: shop.draftVersion },
      );
      expect(purchased.activeActivity?.kind).toBe('shop');

      const save = game.save();
      const service = new MapRunService(
        createRegistryMapContentResolver(game.registry),
        variantId => game.registry.characterVariants.get(variantId)?.proto,
      );
      expect(service.restoreSaveSnapshot(save.mapRun).status).toBe('restored');
      const restored = service.getSnapshot()!;
      expect(restored.activeActivity).toEqual(purchased.activeActivity);
      expect(restored.completedActivityIds).toEqual(['b/clear-patrol', 'b/rest']);
      expect(restored.completedEncounterNodeIds).toEqual([]);
      expect(restored.teamResources).toEqual(purchased.teamResources);
    });

    test('does not restart completed Node activities on revisit', () => {
      const game = createGame();
      const started = game.startMap(ACTIVITY_MAP);
      game.moveMap(started.runId, 'b');
      commitCurrentEncounter(game);
      commitRestRound(game);
      commitRestRound(game);
      const shop = requireActiveView(game).shop!;
      game.leaveMapShop(started.runId, { nodeId: 'b', activityId: 'supply', draftVersion: shop.draftVersion });
      const atExit = game.moveMap(started.runId, 'c');
      expect(atExit.status).toBe('success');

      // A second Run proves the Node content itself is deterministic and fresh.
      const second = game.startMap(ACTIVITY_MAP);
      const revisiting = game.moveMap(second.runId, 'b');
      expect(revisiting.activeActivity?.activityId).toBe('clear-patrol');
      expect(revisiting.completedActivityIds).toEqual([]);
    });
  });

  describe('P2 one-way fork and convergence', () => {
    function playRoute(game: GameInstance, first: 'b' | 'c'): MapRun {
      const started = game.startMap(FORK_MAP);
      const branch = game.moveMap(started.runId, first);
      expect(branch.currentNodeId).toBe(first);
      if (first === 'b') {
        expect(branch.activeEncounter?.nodeId).toBe('b');
        commitCurrentEncounter(game);
      } else {
        expect(branch.activeActivity?.kind).toBe('shop');
        const shop = requireActiveView(game).shop!;
        const purchased = game.purchaseMapShopOffer(started.runId, 'supply-box', `fork-${first}`, {
          nodeId: 'c',
          activityId: 'supply',
          draftVersion: shop.draftVersion,
        });
        game.leaveMapShop(started.runId, {
          nodeId: 'c',
          activityId: 'supply',
          draftVersion: purchased.activeActivity!.shopDraftVersion,
        });
      }
      const atMerge = game.moveMap(started.runId, 'd');
      expect(atMerge.currentNodeId).toBe('d');
      expect(atMerge.activeEncounter).toBeNull();
      expect(atMerge.activeActivity).toBeNull();
      expect(atMerge.status).toBe('inProgress');
      const atExit = game.moveMap(started.runId, 'e');
      expect(atExit.status).toBe('success');
      return atMerge;
    }

    test('completes both routes and keeps their different MapRun state at the merge Node', () => {
      const game = createGame();
      const battleRoute = playRoute(game, 'b');
      expect(battleRoute.teamResources.find(row => row.resourceId === 'clues')!.value).toBeGreaterThan(0);
      expect(battleRoute.teamResources.find(row => row.resourceId === 'supplies')!.value).toBe(0);
      expect(battleRoute.teamResources.find(row => row.resourceId === 'credits')!.value).toBe(2);

      const supplyRoute = playRoute(game, 'c');
      expect(supplyRoute.partyHp.every(row => row.currentHp === 10)).toBe(true);
      expect(supplyRoute.teamResources.find(row => row.resourceId === 'credits')!.value).toBe(1);
      expect(supplyRoute.teamResources.find(row => row.resourceId === 'supplies')!.value).toBe(2);
      expect(supplyRoute.teamResources.find(row => row.resourceId === 'clues')!.value).toBe(0);
    });

    test('rejects reverse and cross-edge movement', () => {
      const game = createGame();
      const started = game.startMap(FORK_MAP);
      expect(() => game.moveMap(started.runId, 'd')).toThrow(/not reachable/);
      expect(() => game.moveMap(started.runId, 'e')).toThrow(/not reachable/);
      game.moveMap(started.runId, 'c');
      const shop = requireActiveView(game).shop!;
      game.leaveMapShop(started.runId, { nodeId: 'c', activityId: 'supply', draftVersion: shop.draftVersion });
      game.moveMap(started.runId, 'd');
      expect(() => game.moveMap(started.runId, 'a')).toThrow(/not reachable/);
      expect(() => game.moveMap(started.runId, 'c')).toThrow(/not reachable/);
    });
  });

  describe('P3 continuous Nodes and conditional Edge', () => {
    function reachRestNode(game: GameInstance, runId: string, takePass: boolean): MapRun {
      const atBattle = game.moveMap(runId, 'b');
      expect(atBattle.activeEncounter?.activityId).toBeUndefined();
      if (takePass) {
        const view = requireActiveView(game);
        const shiroko = view.actionPreview!.preparedActions.find(row => row.characterId === 'shiroko')!;
        const draft = draftOf(requireRun(game));
        game.setMapAbilityDraft(runId, 'search-terminal', {
          kind: 'partyCharacter',
          characterId: shiroko.characterId,
        }, draft);
      }
      commitCurrentEncounter(game);
      const atRest = game.moveMap(runId, 'c');
      expect(atRest.currentNodeId).toBe('c');
      expect(atRest.activeActivity).toBeNull();
      expect(atRest.activeEncounter?.activityId).toBeUndefined();
      expect(atRest.activeEncounter?.round).toBe(1);
      commitRestRound(game);
      const rested = commitRestRound(game);
      expect(rested.activeEncounter).toBeNull();
      expect(rested.status).toBe('inProgress');
      return rested;
    }

    test('carries HP, PlayerCost and resources across separate Nodes', () => {
      const game = createGame();
      const started = game.startMap(CONDITIONAL_MAP);
      const atRest = reachRestNode(game, started.runId, false);
      const shiroko = atRest.partyHp.find(row => row.characterId === 'shiroko')!;
      expect(shiroko.currentHp).toBeGreaterThan(0);
      expect(shiroko.currentHp).toBeLessThanOrEqual(10);
      // Battle + Rest reopen Encounters without resetting MapRun HP or PlayerCost.
      expect(atRest.playerCost).toBe(1);
      expect(atRest.completedActivityIds).toEqual([]);
      expect(atRest.completedEncounterNodeIds).toEqual(['b', 'c']);

      const view = requireActiveView(game);
      const gate = view.map.edges.find(edge => edge.fromNodeId === 'c' && edge.toNodeId === 'f')!;
      expect(gate.condition).toEqual({ resourceId: 'pass', amount: 1, satisfied: false });
      expect(() => game.moveMap(started.runId, 'f')).toThrow(/unsatisfied MapRun condition/);

      const atShop = game.moveMap(started.runId, 'd');
      expect(atShop.activeActivity?.kind).toBe('shop');
      const shop = requireActiveView(game).shop!;
      game.leaveMapShop(started.runId, { nodeId: 'd', activityId: 'checkpoint-shop', draftVersion: shop.draftVersion });
      const atExit = game.moveMap(started.runId, 'e');
      expect(atExit.status).toBe('success');
    });

    test('opens the condition-gated shortcut once the MapRun-local pass exists', () => {
      const game = createGame();
      const started = game.startMap(CONDITIONAL_MAP);
      const atRest = reachRestNode(game, started.runId, true);
      const pass = atRest.teamResources.find(row => row.resourceId === 'pass')!.value;
      expect(pass).toBe(1);
      expect(atRest.playerCost).toBe(0);

      const view = requireActiveView(game);
      const gate = view.map.edges.find(edge => edge.fromNodeId === 'c' && edge.toNodeId === 'f')!;
      expect(gate.condition).toEqual({ resourceId: 'pass', amount: 1, satisfied: true });

      const atShortcut = game.moveMap(started.runId, 'f');
      expect(atShortcut.currentNodeId).toBe('f');
      // The pass is a read-only gate: moving never consumes it, and re-querying is stable.
      expect(atShortcut.teamResources.find(row => row.resourceId === 'pass')!.value).toBe(1);
      const atExit = game.moveMap(started.runId, 'e');
      expect(atExit.status).toBe('success');
    });

    test('restores continuous conditional progress with the gate state intact', () => {
      const game = createGame();
      const started = game.startMap(CONDITIONAL_MAP);
      const atRest = reachRestNode(game, started.runId, true);
      const save = game.save();
      const service = new MapRunService(
        createRegistryMapContentResolver(game.registry),
        variantId => game.registry.characterVariants.get(variantId)?.proto,
      );
      expect(service.restoreSaveSnapshot(save.mapRun).status).toBe('restored');
      const restored = service.getSnapshot()!;
      expect(restored.currentNodeId).toBe('c');
      expect(restored.teamResources).toEqual(atRest.teamResources);
      expect(restored.partyHp).toEqual(atRest.partyHp);
      expect(restored.completedEncounterNodeIds).toEqual(['b', 'c']);
      expect(restored.activeEncounter).toBeNull();
    });
  });
});
