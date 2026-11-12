import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { createGameCommands } from '../../../src/arona-clicker/runtime/runtime-commands';
import { baseDatapack } from '../../../src/data/base/datapack';
import { gameplayBMapDatapack } from '../../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';

const SPOT = 'base:spot:variant_training';
const FUNCTION = 'base:funclet:variant_training_entry';
const MAP = 'gameplay-b:map:variant-training-scenario';
const games: GameInstance[] = [];
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function setup(owned = true): GameInstance {
  const game = new GameInstance();
  games.push(game);
  game.init([baseDatapack, gameplayBMapDatapack]);
  if (owned) game.mutations.acquireCharacter('Hoshino', 'story');
  return game;
}

function enter(game: GameInstance) {
  return createGameCommands(game).enterVariantTraining(SPOT, FUNCTION);
}

function winBattle(game: GameInstance): void {
  for (let i = 0; i < 12; i++) {
    const run = game.mapRun.getSnapshot()!;
    const encounter = run.activeEncounter;
    if (!encounter) return;
    game.commitMapEncounterRound({ runId: run.runId, requestId: `${run.runId}:${run.commitVersion}`,
      expectedCommitVersion: run.commitVersion,
      draft: { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion } });
  }
  throw new Error('Training battle did not finish');
}

afterEach(() => games.splice(0).forEach(game => game.dispose()));

describe('formal Variant training uses the primary MapRun', () => {
  test('requires the exact owned Variant, validates Spot, and cannot be started by mapId', () => {
    const game = setup(false);
    const before = wire(game.state);
    expect(() => enter(game)).toThrow();
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(game.state).toEqual(before);
    game.mutations.acquireCharacter('Hoshino', 'story');
    expect(() => game.enterVariantTraining(SPOT, 'forged')).toThrow();
    expect(() => game.startMap(MAP)).toThrow();
    game.mutations.setSpotLevel(SPOT, 0);
    expect(() => enter(game)).toThrow();
    game.mutations.setSpotLevel(SPOT, 1);
    const run = enter(game);
    expect(run.currentNodeId).toBe('battle-owned');
    expect(run.activeEncounter).not.toBeNull();
    expect(game.mapRun.getWorkspaceView(run.runId)?.kind).toBe('active');
    expect(enter(game).runId).toBe(run.runId);
    expect(() => game.startMap(MAP)).toThrow();
  });

  test('blocks another active map without replacing either run', () => {
    const game = setup();
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    const ordinary = game.startMap('gameplay-b:map:minimal-battle');
    expect(() => enter(game)).toThrow();
    expect(game.mapRun.getSnapshot()?.runId).toBe(ordinary.runId);
    game.abandonMap(ordinary.runId);
    const training = enter(game);
    expect(() => game.startMap('gameplay-b:map:minimal-battle')).toThrow();
    expect(game.mapRun.getSnapshot()?.runId).toBe(training.runId);
  });

  test('a completed training scenario does not attach its binding to the next ordinary map save', () => {
    const game = setup();
    const run = enter(game);
    for (const next of ['battle-normal', 'battle-enhanced', 'exit']) {
      winBattle(game);
      game.moveMap(run.runId, next);
    }
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    const ordinary = game.startMap('gameplay-b:map:minimal-battle');
    const save = wire(game.save());
    expect(save.mapRun?.mapId).toBe(ordinary.mapId);
    expect(save.mapRun).not.toHaveProperty('scenario');
    game.load(save);
    expect(game.mapRun.getSnapshot()?.runId).toBe(ordinary.runId);
  });

  test('uses one run in fixed order, with fresh normal and advanced HP/agility and real cards', () => {
    const game = setup();
    const state = wire(game.state);
    const first = enter(game);
    expect(() => game.moveMap(first.runId, 'battle-enhanced')).toThrow();
    const cards = game.mapRun.getCards(first.runId);
    expect(new Set(cards.map(card => card.actionId)).size).toBeGreaterThanOrEqual(2);
    const alternative = cards.find(card => card.owner.kind === 'partyCharacter' && card.zone === 'hand' && !card.prepared)!;
    expect(alternative).toBeDefined();
    let encounter = first.activeEncounter!;
    const swapped = game.swapMapPreparedAction(first.runId, 'hoshino', alternative.actionId!, {
      nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion });
    encounter = swapped.activeEncounter!;
    game.setMapPreparedEnemyTarget(first.runId, 'hoshino', encounter.enemies[0].enemyId, {
      nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion });
    expect(game.mapRun.getCards(first.runId).find(card => card.ref.id === alternative.ref.id)?.prepared).toBe(true);
    winBattle(game);
    const normal = game.moveMap(first.runId, 'battle-normal');
    expect(normal.runId).toBe(first.runId);
    expect(normal.partyHp[0].currentHp).toBe(10);
    expect(normal.partyAgility?.[0].agility).toBe(2);
    winBattle(game);
    const advanced = game.moveMap(first.runId, 'battle-enhanced');
    expect(advanced.partyHp[0].currentHp).toBe(16);
    expect(advanced.partyAgility?.[0].agility).toBe(6);
    winBattle(game);
    expect(game.moveMap(first.runId, 'exit').status).toBe('success');
    expect(game.mapRun.getResult(first.runId)?.outcome).toBe('success');
    expect(game.state).toEqual(state);
  });

  test.each(['battle-normal', 'battle-enhanced'])('main SaveData round-trip resumes %s without reinitialization', stage => {
    const game = setup();
    const run = enter(game);
    winBattle(game);
    game.moveMap(run.runId, 'battle-normal');
    if (stage === 'battle-enhanced') {
      winBattle(game);
      game.moveMap(run.runId, stage);
    }
    const before = game.mapRun.getSnapshot()!;
    const encounter = before.activeEncounter!;
    game.commitMapEncounterRound({ runId: run.runId, requestId: 'before-save', expectedCommitVersion: before.commitVersion,
      draft: { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion } });
    const frozen = wire(game.mapRun.getSnapshot());
    const cards = wire(game.mapRun.getCards(run.runId));
    const save = wire(game.save());
    expect(save.mapRun).toHaveProperty('scenario');
    game.load(save);
    expect(wire(game.mapRun.getSnapshot())).toEqual(frozen);
    expect(wire(game.mapRun.getCards(run.runId))).toEqual(cards);
    expect(enter(game).currentNodeId).toBe(stage);
    const resumed = game.mapRun.getSnapshot()!;
    const resumedEncounter = resumed.activeEncounter!;
    game.commitMapEncounterRound({ runId: resumed.runId, requestId: 'after-load', expectedCommitVersion: resumed.commitVersion,
      draft: { nodeId: resumedEncounter.nodeId, round: resumedEncounter.round, draftVersion: resumedEncounter.draftVersion } });
    const progressed = wire(game.mapRun.getSnapshot());
    game.load(wire(game.save()));
    expect(wire(game.mapRun.getSnapshot())).toEqual(progressed);
  });

  test('restart keeps frozen builds and abandonment permits a newly cultivated build', () => {
    const game = setup();
    const first = enter(game);
    const frozen = wire(game.save().mapRun!.scenario);
    game.mutations.addExp('Hoshino', 100_000);
    const restarted = game.restartMap(first.runId);
    expect(restarted.currentNodeId).toBe('battle-owned');
    expect(wire(game.save().mapRun!.scenario)).toMatchObject({ stages: frozen!.stages });
    game.abandonMap(restarted.runId);
    const fresh = enter(game);
    expect(fresh.partyHp[0].currentHp).toBe(16);
    expect(game.save().mapRun!.scenario).not.toEqual(frozen);
  });

  test('rejects damaged scene bindings without installing a partial training run; Init changes clear it', () => {
    const game = setup();
    enter(game);
    const saved = wire(game.save());
    (saved.mapRun!.scenario as any).templateVersion = 999;
    game.load(saved);
    expect(game.mapRun.getSnapshot()).toBeNull();
    const fresh = enter(game);
    expect(fresh.currentNodeId).toBe('battle-owned');
    game.inits.enterInit('base:init:millennium');
    expect(game.mapRun.getSnapshot()).toBeNull();
    expect(() => enter(game)).toThrow();
  });
});
