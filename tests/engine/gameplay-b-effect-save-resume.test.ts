import { afterEach, describe, expect, test } from 'vitest';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { gameplayBStatusExampleMap } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-status-example';
import { gameplayBPreparedTagComboExampleMap } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-prepared-tag-combo-example';
import { validateMapEffectCommitReceipt } from '../../src/arona-clicker/services/map/map-effect-receipt-validator';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import {
  createLegacyGoldenRuntime,
  LEGACY_GOLDEN_ITEM_ID,
  legacyGoldenMap,
} from './gameplay-b-effect-test-fixtures';

const games: GameInstance[] = [];

function saveResumeMap(): GameplayMapDef {
  const base = legacyGoldenMap({
    id: 'test:map:effect-save-resume',
    partyCharacterIds: ['shiroko', 'serika'],
    playerCost: 4,
    teamResources: [{ resourceId: 'supplies', value: 0 }],
    actions: [
      { id: 'negotiate', name: 'Negotiate', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' },
        effectProgram: { resolve: [
          { op: 'counterAdd', counterId: 'trust', delta: 1 },
          { op: 'flagSet', flagId: 'briefed', value: true },
        ] } },
      { id: 'zero-probe', name: 'Zero Probe', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
        effectProgram: { resolve: [
          { op: 'hpChange', target: 'primary', delta: -5 },
          { op: 'hpChange', target: 'primary', delta: -1 },
          { op: 'flagSet', flagId: 'cycle', value: true },
          { op: 'flagSet', flagId: 'cycle', value: false },
        ] } },
      { id: 'program-supplies', name: 'Program Supplies', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
        effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] } },
      { id: 'item-probe', name: 'Item Probe', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
        effectProgram: { resolve: [{ op: 'flagSet', flagId: 'itemUsed', value: true }] } },
    ],
    participants: [
      { characterId: 'shiroko', actions: [] },
      { characterId: 'serika', actions: [] },
    ],
  });
  return {
    ...base,
    resumeVersion: 3,
    nodes: base.nodes.map(node => node.id !== 'battle' ? node : {
      id: node.id,
      title: node.title,
      activities: [
        {
          id: 'talk',
          title: 'Trust',
          encounter: {
            title: 'Trust Checkpoint',
            locals: {
              counters: [{ id: 'trust', initial: 2, min: 0, max: 3 }],
              flags: [{ id: 'briefed', initial: false }],
            },
            completion: {
              kind: 'condition', label: 'Trust reached',
              condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 3 },
            },
            participants: ['shiroko', 'serika'].map(characterId => ({
              characterId,
              actions: [{ actionId: 'negotiate', tendencyWeight: 1 }],
            })),
          },
        },
        {
          id: 'battle',
          title: 'Battle',
          encounter: {
            title: 'Receipt Recovery Battle',
            locals: { flags: [{ id: 'cycle', initial: false }, { id: 'itemUsed', initial: false }] },
            enemies: [
              { id: 'robot:alpha', initialHp: 2, maxHp: 10, actions: [] },
              { id: 'robot-beta', initialHp: 10, maxHp: 10, actions: [] },
            ],
            participants: [
              { characterId: 'shiroko', actions: [{ actionId: 'zero-probe', tendencyWeight: 1 }] },
              { characterId: 'serika', actions: [{ actionId: 'program-supplies', tendencyWeight: 1 }] },
            ],
            itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-probe' }],
          },
        },
      ],
    }),
  };
}

function createOwner(definition: GameplayMapDef) {
  const game = createLegacyGoldenRuntime(definition, 1);
  games.push(game);
  for (const characterId of definition.partyCharacterIds) {
    const variant = game.rosterSystem.getAllVariants().find(candidate => candidate.proto === characterId);
    if (!variant) throw new Error(`Base Datapack has no Variant for ${characterId}`);
    game.mutations.acquireCharacter(variant.id, 'story');
  }
  const started = game.startMap(definition.id);
  const edge = definition.edges.find(candidate => candidate.fromNodeId === started.currentNodeId
    && definition.nodes.find(node => node.id === candidate.toNodeId)?.activities?.length);
  if (!edge) throw new Error('Test Map has no activity node reachable from its start');
  const entered = game.moveMap(started.runId, edge.toNodeId);
  if (!entered.activeEncounter || entered.activeActivity?.activityId !== 'talk') {
    throw new Error('MapRun Owner did not open the first activity');
  }
  return { game, runId: started.runId };
}

function loadGame(definition: GameplayMapDef, save: ReturnType<GameInstance['save']>) {
  const game = createLegacyGoldenRuntime(definition, 1);
  games.push(game);
  game.load(save);
  return game;
}

function draftFor(game: GameInstance) {
  const encounter = game.mapRun.getSnapshot()?.activeEncounter;
  if (!encounter) throw new Error('Expected an active Encounter draft');
  return {
    nodeId: encounter.nodeId,
    ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
    round: encounter.round,
    draftVersion: encounter.draftVersion,
  };
}

function commitFor(game: GameInstance, runId: string, requestId: string) {
  const run = game.mapRun.getSnapshot();
  if (!run) throw new Error('Expected an active MapRun');
  return {
    runId,
    requestId,
    expectedCommitVersion: run.commitVersion,
    draft: draftFor(game),
  };
}

function createCommittedBattleSave(definition: GameplayMapDef) {
  const { game, runId } = createOwner(definition);
  game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
  const talkCommit = game.commitMapEncounterRound(commitFor(game, runId, 'resume-talk'));
  if (talkCommit.activeActivity?.activityId !== 'battle' || !talkCommit.activeEncounter) {
    throw new Error('Talk completion did not advance into the Battle activity');
  }
  game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot:alpha', draftFor(game));
  game.setMapItemDraft(runId, LEGACY_GOLDEN_ITEM_ID,
    { kind: 'partyCharacter', characterId: 'serika' }, draftFor(game));
  const command = commitFor(game, runId, 'resume-battle');
  game.commitMapEncounterRound(command);
  return { save: game.save(), command, runId };
}

function mutateBothLatestReceipts(save: any, mutate: (receipt: any) => void) {
  mutate(save.mapRun.run.lastEncounterCommit);
  mutate(save.mapRun.run.activeEncounter.lastCommit);
}

afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

describe('Gameplay B E1/E2 Save/Load and MapRun Owner recovery', () => {
  test('saves and resumes the active Encounter Shield ledger under scheduler v6', () => {
    const definition: GameplayMapDef = {
      id: 'test:map:effect-shield-save-resume', name: 'Shield Save Resume', resumeVersion: 1,
      executionContractId: 'AG-1', startNodeId: 'start', exitNodeIds: ['exit'],
      partyCharacterIds: ['shiroko', 'serika'],
      initialPartyHp: [{ characterId: 'shiroko', initialHp: 10, maxHp: 10 }, { characterId: 'serika', initialHp: 10, maxHp: 10 }],
      initialPlayerCost: 1,
      actions: [
        { id: 'shield-self', name: 'Shield Self', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'self' }, effectProgram: { resolve: [
            { op: 'shieldAdd', target: 'source', amount: 3 },
            { op: 'damage', target: 'primary', amount: 1 },
          ] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 }, target: { kind: 'none' } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'shield-self', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
    };
    const makeOwner = () => new MapRunService({ resolve: id => id === definition.id ? definition : null },
      variant => variant === 'Shiroko' ? 'shiroko' : variant === 'Serika' ? 'serika' : null);
    const owner = makeOwner();
    const started = owner.start(definition.id, [
      { characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' },
    ]);
    owner.move(started.runId, 'battle');
    const first = owner.getSnapshot()!;
    owner.commitEncounterRound({ runId: started.runId, requestId: 'shield-save-resume', expectedCommitVersion: first.commitVersion,
      draft: { nodeId: 'battle', round: first.activeEncounter!.round, draftVersion: first.activeEncounter!.draftVersion } });
    const saved = owner.createSaveSnapshot()!;
    expect(saved.run.activeEncounter?.shields).toEqual({ 'partyCharacter:shiroko': 2 });

    const resumed = makeOwner();
    expect(resumed.restoreSaveSnapshot(saved)).toMatchObject({ status: 'restored' });
    expect(resumed.getSnapshot()?.activeEncounter?.shields).toEqual({ 'partyCharacter:shiroko': 2 });
    expect(resumed.getSnapshot()?.lastEncounterCommit).toEqual(saved.run.lastEncounterCommit);

    const forged = structuredClone(saved);
    (forged as any).run.activeEncounter.shields['partyCharacter:shiroko'] = 4;
    const rejected = makeOwner();
    expect(rejected.restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(rejected.getSnapshot()).toBeNull();
  });

  test('restores trust=2, then advances once; carries the prior activity Receipt and resumes an Item draft and E1 trace', () => {
    const definition = saveResumeMap();
    const { game: source, runId } = createOwner(definition);
    source.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
    const trustSave = source.save();
    expect(trustSave.mapRun?.run.activeEncounter?.locals?.counters.trust?.value).toBe(2);

    const talk = loadGame(definition, trustSave);
    const restoredTalk = talk.mapRun.getSnapshot();
    expect(restoredTalk?.activeEncounter?.locals?.counters.trust?.value).toBe(2);
    expect(talk.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBe(1);
    const talkCommit = talk.commitMapEncounterRound(commitFor(talk, runId, 'resume-talk'));
    const uninterruptedCommit = source.commitMapEncounterRound(commitFor(source, runId, 'resume-talk'));
    expect(talkCommit).toEqual(uninterruptedCommit);
    expect(talkCommit.lastEncounterCommit?.activityId).toBe('talk');
    expect(talkCommit.lastEncounterCommit?.programReceiptVersion).toBe(1);
    expect(talkCommit.lastEncounterCommit?.effectTrace?.filter(entry => entry.op === 'counterAdd')
      .map(entry => [entry.before, entry.after, entry.delta])).toEqual([[2, 3, 1], [3, 3, 0]]);
    expect(talkCommit.activeActivity?.activityId).toBe('battle');
    expect(talkCommit.activeEncounter?.round).toBe(1);
    expect(talkCommit.activeEncounter?.locals).toEqual({ counters: {}, flags: { cycle: false, itemUsed: false } });

    const crossActivitySave = talk.save();
    const talkReceipt = crossActivitySave.mapRun?.run.lastEncounterCommit;
    const talkEncounter = definition.nodes.find(node => node.id === talkReceipt?.nodeId)?.activities
      ?.find(activity => activity.id === talkReceipt?.activityId)?.encounter;
    if (!talkReceipt || !talkEncounter || !crossActivitySave.mapRun) throw new Error('Talk checkpoint Receipt is missing');
    expect(validateMapEffectCommitReceipt(talkReceipt, {
      runId, map: definition, encounter: talkEncounter,
    })).toEqual({ ok: true, errors: [] });
    const crossActivity = loadGame(definition, crossActivitySave);
    const afterActivityRestore = crossActivity.mapRun.getSnapshot();
    expect(afterActivityRestore?.lastEncounterCommit?.activityId).toBe('talk');
    expect(afterActivityRestore?.activeActivity?.activityId).toBe('battle');
    expect(afterActivityRestore?.activeEncounter?.locals?.flags).toEqual({ cycle: false, itemUsed: false });
    expect(crossActivity.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBe(1);

    crossActivity.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot:alpha', draftFor(crossActivity));
    crossActivity.setMapItemDraft(runId, LEGACY_GOLDEN_ITEM_ID,
      { kind: 'partyCharacter', characterId: 'serika' }, draftFor(crossActivity));
    const draftSave = crossActivity.save();
    const resumed = loadGame(definition, draftSave);
    const resumedRun = resumed.mapRun.getSnapshot();
    expect(resumedRun?.activeEncounter?.itemDraft).toEqual({
      itemId: LEGACY_GOLDEN_ITEM_ID,
      actionId: 'item-probe',
      target: { kind: 'partyCharacter', characterId: 'serika' },
      additionalTarget: null,
    });
    expect(resumedRun?.activeEncounter?.targetSelections).toContainEqual({
      characterId: 'shiroko', targetEnemyId: 'robot:alpha',
    });
    expect(resumed.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBe(1);

    const itemEvents: number[] = [];
    resumed.eventBus.on('itemCollected', event => {
      if (event.itemId === LEGACY_GOLDEN_ITEM_ID && event.count === -1) itemEvents.push(event.count);
    });
    const battleCommand = commitFor(resumed, runId, 'resume-battle');
    const battleCommit = resumed.commitMapEncounterRound(battleCommand);
    const hpEvents = battleCommit.lastEncounterCommit?.effectTrace?.filter(entry => entry.op === 'hpChange') ?? [];
    expect(hpEvents.map(entry => [entry.before, entry.after, entry.delta])).toEqual([[2, 0, -2], [0, 0, 0]]);
    expect(battleCommit.lastEncounterCommit?.settlements.find(row => row.characterId === 'serika')?.resourceChanges)
      .toContainEqual(expect.objectContaining({ kind: 'effect', resourceId: 'supplies', delta: 1 }));
    expect(battleCommit.lastEncounterCommit?.item).toMatchObject({ itemId: LEGACY_GOLDEN_ITEM_ID, consumedCount: 1 });
    expect(battleCommit.activeEncounter?.enemies).toContainEqual({ enemyId: 'robot:alpha', currentHp: 0 });
    expect(battleCommit.activeEncounter?.locals?.flags).toEqual({ cycle: false, itemUsed: true });
    expect(resumed.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBeUndefined();
    expect(resumed.statsService.getSnapshot().global.itemsUsed[LEGACY_GOLDEN_ITEM_ID]).toBe(1);
    expect(itemEvents).toEqual([-1]);

    const committedSave = resumed.save();
    const savedReceipt = committedSave.mapRun?.run.lastEncounterCommit;
    expect(savedReceipt).toBeTruthy();
    expect(savedReceipt).not.toHaveProperty('effects');
    expect(savedReceipt).not.toHaveProperty('hpEffects');
    expect(savedReceipt).not.toHaveProperty('cardEffects');
    const reopened = loadGame(definition, committedSave);
    const reopenedRun = reopened.mapRun.getSnapshot();
    expect(reopenedRun?.lastEncounterCommit).toEqual(battleCommit.lastEncounterCommit);
    expect(reopenedRun?.activeEncounter?.enemies).toContainEqual({ enemyId: 'robot:alpha', currentHp: 0 });
    expect(reopenedRun?.activeEncounter?.locals?.flags).toEqual({ cycle: false, itemUsed: true });
    expect(reopened.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBeUndefined();

    const statsBeforeReplay = reopened.statsService.getSnapshot();
    const runBeforeReplay = reopened.mapRun.getSnapshot();
    const replayEvents: number[] = [];
    reopened.eventBus.on('itemCollected', event => {
      if (event.itemId === LEGACY_GOLDEN_ITEM_ID && event.count === -1) replayEvents.push(event.count);
    });
    expect(reopened.commitMapEncounterRound(battleCommand)).toEqual(runBeforeReplay);
    expect(reopened.statsService.getSnapshot()).toEqual(statsBeforeReplay);
    expect(reopened.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBeUndefined();
    expect(replayEvents).toEqual([]);
    expect(() => reopened.commitMapEncounterRound({
      ...battleCommand,
      expectedCommitVersion: battleCommand.expectedCommitVersion + 1,
    })).toThrow(/request ID was already used with different input/);
    expect(reopened.mapRun.getSnapshot()).toEqual(runBeforeReplay);
    expect(reopened.statsService.getSnapshot()).toEqual(statsBeforeReplay);
    expect(replayEvents).toEqual([]);
  });

  test('commits and restores deterministic E2 TargetSet, Counter Value, and repeated hits', () => {
    const base = legacyGoldenMap({
      id: 'test:map:effect-e2-save-resume',
      actions: [
        { id: 'kill-lowest', name: 'Finish', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'damage', target: { set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 1 } }, amount: 3 }] } },
        { id: 'area-strike', name: 'Area Strike', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
        effectProgram: { resolve: [
          { op: 'counterAdd', counterId: 'power', delta: 1 },
          { op: 'damage', target: { set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 1 } },
            amount: { kind: 'counter', counterId: 'power' },
            repeat: { kind: 'min', left: { kind: 'counter', counterId: 'power' }, right: { kind: 'literal', value: 8 } } },
        ] } }],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'kill-lowest', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'area-strike', tendencyWeight: 1 }] },
      ],
      enemies: [
        { id: 'robot:down', initialHp: 3, maxHp: 10, actions: [] },
        { id: 'robot:beta', initialHp: 3, maxHp: 10, actions: [] },
        { id: 'robot:gamma', initialHp: 9, maxHp: 10, actions: [] },
      ],
    });
    const definition: GameplayMapDef = { ...base, nodes: base.nodes.map(node => node.id !== 'battle' ? node : ({
      ...node,
      encounter: { ...node.encounter!, locals: { counters: [{ id: 'power', initial: 2, min: 0, max: 8 }] } },
    })) };
    const source = createLegacyGoldenRuntime(definition);
    games.push(source);
    const started = source.startMap(definition.id);
    const edge = definition.edges.find(candidate => candidate.fromNodeId === started.currentNodeId
      && definition.nodes.find(node => node.id === candidate.toNodeId)?.encounter);
    if (!edge) throw new Error('E2 test Map has no reachable Encounter');
    source.moveMap(started.runId, edge.toNodeId);
    const committed = source.commitMapEncounterRound(commitFor(source, started.runId, 'e2-target-set'));
    const receipt = committed.lastEncounterCommit;
    const active = committed.activeEncounter;
    if (!receipt || !active) throw new Error('E2 Commit should retain a live Encounter checkpoint');
    expect(receipt.effectTrace).toMatchObject([
      { op: 'targetSet', source: { kind: 'partyCharacter', id: 'shiroko' }, identities: [{ id: 'robot:down' }] },
      { op: 'damage', source: { kind: 'partyCharacter', id: 'shiroko' }, identity: { id: 'robot:down' }, before: 3, after: 0 },
      { op: 'counterAdd', counterId: 'power', before: 2, after: 3 },
      { op: 'targetSet', selection: 'set', identities: [{ kind: 'enemy', id: 'robot:beta' }], repeatCount: 3 },
      { op: 'damage', identity: { kind: 'enemy', id: 'robot:beta' }, amount: 3, before: 3, after: 0,
        batch: { targetIndex: 0, hitIndex: 0, targetCount: 1, repeatCount: 3 } },
      { op: 'damage', identity: { kind: 'enemy', id: 'robot:beta' }, amount: 3, before: 0, after: 0,
        batch: { targetIndex: 0, hitIndex: 1, targetCount: 1, repeatCount: 3 } },
      { op: 'damage', identity: { kind: 'enemy', id: 'robot:beta' }, amount: 3, before: 0, after: 0,
        batch: { targetIndex: 0, hitIndex: 2, targetCount: 1, repeatCount: 3 } },
    ]);
    const encounter = definition.nodes.find(node => node.id === receipt.nodeId)?.encounter;
    if (!encounter) throw new Error('E2 test Encounter missing from Map');
    expect(validateMapEffectCommitReceipt(receipt, {
      runId: started.runId, map: definition, encounter,
      currentEncounter: { ...active, partyHp: committed.partyHp },
    })).toEqual({ ok: true, errors: [] });

    const saved = source.save();
    const savedRun = saved.mapRun?.run;
    const savedEncounter = savedRun?.activeEncounter;
    if (!savedRun || !savedEncounter || !savedRun.lastEncounterCommit) throw new Error('E2 save did not retain its Receipt checkpoint');
    expect(validateMapEffectCommitReceipt(savedRun.lastEncounterCommit, {
      runId: started.runId, map: definition, encounter,
      currentEncounter: { ...savedEncounter, partyHp: savedRun.partyHp },
    })).toEqual({ ok: true, errors: [] });
    const restored = loadGame(definition, saved);
    expect(restored.mapRun.getSnapshot()?.lastEncounterCommit).toEqual(receipt);
    expect(restored.mapRun.getSnapshot()?.activeEncounter?.lastCommit).toEqual(receipt);
    expect(restored.mapRun.getSnapshot()?.activeEncounter?.enemies).toEqual(active.enemies);

    const forged = structuredClone(receipt) as any;
    forged.effectTrace.find((event: any) => event.op === 'targetSet').identities[0].id = 'robot:gamma';
    const validationContext = {
      runId: started.runId, map: definition, encounter,
      currentEncounter: { ...active, partyHp: committed.partyHp },
    };
    expect(validateMapEffectCommitReceipt(forged, validationContext).ok).toBe(false);
    const mutations: readonly [string, (candidate: any) => void][] = [
      ['repeat count', (candidate: any) => { candidate.effectTrace.find((event: any) => event.op === 'targetSet').repeatCount = 2; }],
      ['amount', (candidate: any) => { candidate.effectTrace.find((event: any) => event.op === 'damage').amount = 4; }],
      ['hit order', (candidate: any) => { candidate.effectTrace.filter((event: any) => event.op === 'damage')[2].batch.hitIndex = 0; }],
    ];
    for (const [label, mutate] of mutations) {
      const changed = structuredClone(receipt) as any;
      mutate(changed);
      expect(validateMapEffectCommitReceipt(changed, validationContext).ok, label).toBe(false);
    }
  });

  test('replays an E2 source-HP Value from a later Activity checkpoint with carried Party HP', () => {
    const base = saveResumeMap();
    const definition: GameplayMapDef = {
      ...base,
      actions: base.actions!.map(action => action.id === 'negotiate'
        ? { ...action, effectProgram: { resolve: [...(action.effectProgram?.resolve ?? []), { op: 'hpChange', target: 'source', delta: -3 }] } }
        : action.id === 'zero-probe'
          ? { ...action, effectProgram: { resolve: [{
            op: 'damage', target: { set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 1 } },
            amount: { kind: 'hp', unit: 'source' },
          }] } }
          : action),
    };
    const { game, runId } = createOwner(definition);
    const talk = game.commitMapEncounterRound(commitFor(game, runId, 'e2-carry-talk'));
    expect(talk.activeActivity?.activityId).toBe('battle');
    expect(talk.partyHp.map(row => row.currentHp)).toEqual([7, 7]);
    const battle = game.commitMapEncounterRound(commitFor(game, runId, 'e2-carry-battle'));
    const receipt = battle.lastEncounterCommit;
    if (!receipt || !battle.activeEncounter) throw new Error('E2 carried-HP Encounter should remain active');
    expect(receipt.effectTrace?.find(entry => entry.op === 'damage')).toMatchObject({ amount: 7, identity: { id: 'robot:alpha' } });
    const saved = game.save();
    const restored = loadGame(definition, saved);
    expect(restored.mapRun.getSnapshot()?.lastEncounterCommit).toEqual(receipt);
    expect(restored.mapRun.getSnapshot()?.partyHp).toEqual(battle.partyHp);
  });

  test('retains a structurally valid E2 Receipt when a victory closes its Encounter', () => {
    const definition = legacyGoldenMap({
      id: 'test:map:effect-e2-closed-receipt',
      actions: [
        { id: 'finish-area', name: 'Finish Area', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'damage', target: { set: { side: 'enemy', filter: 'living' } }, amount: 10 }] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'finish-area', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
      enemies: [
        { id: 'alpha', initialHp: 3, maxHp: 3, actions: [] },
        { id: 'beta', initialHp: 5, maxHp: 5, actions: [] },
      ],
    });
    const game = createLegacyGoldenRuntime(definition);
    games.push(game);
    const started = game.startMap(definition.id);
    const edge = definition.edges.find(candidate => candidate.fromNodeId === started.currentNodeId
      && definition.nodes.find(node => node.id === candidate.toNodeId)?.encounter);
    if (!edge) throw new Error('Closed Receipt Map has no reachable Encounter');
    game.moveMap(started.runId, edge.toNodeId);
    const runId = started.runId;
    const result = game.commitMapEncounterRound(commitFor(game, runId, 'e2-close-victory'));
    expect(result.activeEncounter).toBeNull();
    expect(result.lastEncounterCommit?.effectTrace?.filter(entry => entry.op === 'damage')).toHaveLength(2);
    const restored = loadGame(definition, game.save());
    expect(restored.mapRun.getSnapshot()?.lastEncounterCommit).toEqual(result.lastEncounterCommit);
    expect(restored.mapRun.getSnapshot()?.activeEncounter).toBeNull();
  });

  test('rejects damaged E1 checkpoints and retains Owner receipt invariants', () => {
    const definition = saveResumeMap();
    const { save } = createCommittedBattleSave(definition);
    const { game: talkOwner } = createOwner(definition);
    const talkSave = talkOwner.save();
    const corruptions: { readonly label: string; readonly source?: 'talk'; readonly mutate: (checkpoint: any) => void }[] = [
      { label: 'missing declared locals', mutate: checkpoint => { delete checkpoint.mapRun.run.activeEncounter.locals; } },
      { label: 'non-boolean Flag', mutate: checkpoint => { checkpoint.mapRun.run.activeEncounter.locals.flags.cycle = 'false'; } },
      { label: 'out-of-range Counter', source: 'talk', mutate: checkpoint => { checkpoint.mapRun.run.activeEncounter.locals.counters.trust.value = 4; } },
      { label: 'unknown local key', mutate: checkpoint => { checkpoint.mapRun.run.activeEncounter.locals.flags.unknown = true; } },
      { label: 'invalid E1 contract version', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => { receipt.programReceiptVersion = 2; }) },
      { label: 'invalid planned locals', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => { receipt.plannedLocals.flags.cycle = 'false'; }) },
      { label: 'unknown E1 receipt key', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => { receipt.unknownField = true; }) },
      { label: 'invalid E1 Scope', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => { receipt.effectScope.activityId = 'talk'; }) },
      { label: 'program visit group count mismatch', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => { receipt.programVisitCount += 1; }) },
      { label: 'tampered trace path', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => { receipt.effectTrace[0].path = 'actions.unknown.resolve[0]'; }) },
      { label: 'live Enemy HP mismatch', mutate: checkpoint => {
        checkpoint.mapRun.run.activeEncounter.enemies.find((enemy: any) => enemy.enemyId === 'robot:alpha').currentHp = 1;
      } },
      { label: 'PlayerCost without PlayerCommand', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => {
        receipt.settlements.find((row: any) => row.characterId === 'serika').playerCostSpent = 1;
      }) },
      { label: 'null action with a target', mutate: checkpoint => mutateBothLatestReceipts(checkpoint, receipt => {
        const row = receipt.settlements.find((settlement: any) => settlement.characterId === 'serika');
        row.actionId = null;
        row.targetEnemyId = 'robot:alpha';
      }) },
    ];

    for (const corruption of corruptions) {
      const checkpoint = structuredClone(corruption.source === 'talk' ? talkSave : save) as any;
      corruption.mutate(checkpoint);
      const rejected = loadGame(definition, checkpoint);
      expect(rejected.mapRun.getSnapshot(), corruption.label).toBeNull();
      expect(rejected.getDevLogs(), corruption.label).toContainEqual(expect.objectContaining({
        source: 'map-run', level: 'warning', details: expect.stringContaining('does not match the current Map'),
      }));
    }
  });

  test('saves, restores, reapplies and ticks a source-qualified Status through the active Encounter Receipt', () => {
    // The formal example now runs under AG-1 and therefore emits Status Receipt v2.
    // Keep this regression pinned to the legacy E1/v1 compatibility path.
    const { executionContractId: _executionContractId, entryInfo: _entryInfo, ...statusExample } = gameplayBStatusExampleMap;
    void _executionContractId;
    void _entryInfo;
    const definition: GameplayMapDef = {
      ...statusExample,
      resumeVersion: 1,
      actions: (statusExample.actions ?? [])
        .filter(action => action.id === 'apply-burn')
        .map(action => {
          const { agility: _agility, ...legacyAction } = action;
          void _agility;
          return { ...legacyAction, effectProgram: { resolve: (legacyAction.effectProgram?.resolve ?? []).map(statement =>
            statement.op === 'statusApply' ? { ...statement, stacks: 1 } : statement) } };
        }),
      nodes: statusExample.nodes.filter(node => node.id !== 'category-test').map(node => node.id !== 'burn-test' || !node.encounter ? node : {
        ...node,
        encounter: {
          ...node.encounter,
          participants: node.encounter.participants?.map(participant => ({
            ...participant,
            actions: participant.actions.filter(candidate => candidate.actionId === 'apply-burn'),
          })),
        },
      }),
      edges: statusExample.edges?.filter(edge => edge.fromNodeId !== 'category-test' && edge.toNodeId !== 'category-test'),
    };
    const source = createLegacyGoldenRuntime(definition);
    games.push(source);
    const started = source.startMap(definition.id);
    source.moveMap(started.runId, 'burn-test');

    const first = source.commitMapEncounterRound(commitFor(source, started.runId, 'status-round-one'));
    const firstStatus = first.activeEncounter?.statuses?.[0];
    expect(firstStatus).toMatchObject({
      holder: { kind: 'enemy', id: 'training-target' },
      statusId: 'burn',
      source: { kind: 'partyCharacter', id: 'shiroko' },
      actionId: 'apply-burn',
      appliedRound: 1,
      stacks: 1,
      remainingRounds: 2,
    });
    expect(first.activeEncounter?.enemies).toEqual([{ enemyId: 'training-target', currentHp: 8 }]);
    expect(first.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 1,
      plannedStatuses: [firstStatus],
      statusTrace: [],
    });

    const resumed = loadGame(definition, source.save());
    const resumedState = resumed.mapRun.getSnapshot();
    expect(resumedState?.activeEncounter?.statuses).toEqual(first.activeEncounter?.statuses);
    expect(resumedState?.activeEncounter?.lastCommit).toEqual(first.lastEncounterCommit);

    const second = resumed.commitMapEncounterRound(commitFor(resumed, started.runId, 'status-round-two'));
    expect(second.activeEncounter?.enemies).toEqual([{ enemyId: 'training-target', currentHp: 6 }]);
    expect(second.activeEncounter?.statuses).toMatchObject([{
      holder: { kind: 'enemy', id: 'training-target' },
      statusId: 'burn',
      source: { kind: 'partyCharacter', id: 'shiroko' },
      actionId: 'apply-burn',
      appliedRound: 1,
      lastTriggeredRound: 2,
      stacks: 2,
      remainingRounds: 1,
    }]);
    expect(second.lastEncounterCommit?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'statusApply', beforeStacks: 1, afterStacks: 2, beforeRemainingRounds: 2, afterRemainingRounds: 2,
    }));
    expect(second.lastEncounterCommit?.statusTrace).toMatchObject([{
      kind: 'roundEnd', round: 2, statusKind: 'burn', stacks: 2,
      remainingRoundsBefore: 2, remainingRoundsAfter: 1,
      hpBefore: 8, hpAfter: 6, hpDelta: -2, removed: false,
    }]);

    const forged = structuredClone(resumed.save()) as any;
    mutateBothLatestReceipts(forged, receipt => { receipt.statusTrace[0].hpDelta = -1; });
    const rejected = loadGame(definition, forged);
    expect(rejected.mapRun.getSnapshot()).toBeNull();
    expect(rejected.getDevLogs()).toContainEqual(expect.objectContaining({
      source: 'map-run', level: 'warning', details: expect.stringContaining('does not match the current Map'),
    }));
  });

  test('saves and restores a Prepared Tag guard from Party settlements, rejecting a forged count', () => {
    const definition = gameplayBPreparedTagComboExampleMap;
    const source = createLegacyGoldenRuntime(definition);
    games.push(source);
    const started = source.startMap(definition.id);
    source.moveMap(started.runId, 'battle');

    const committed = source.commitMapEncounterRound(commitFor(source, started.runId, 'prepared-tag-save'));
    const receipt = committed.lastEncounterCommit;
    if (!receipt) throw new Error('Prepared Tag Commit did not retain a Receipt');
    expect(receipt.effectTrace?.find(row => row.op === 'when')).toMatchObject({
      result: true,
      reads: [{ op: 'preparedTagCount', count: 2, side: 'party', tag: 'gameplay-b:action/explosive', result: true }],
    });

    const saved = source.save();
    const resumed = loadGame(definition, saved);
    expect(resumed.mapRun.getSnapshot()?.lastEncounterCommit).toEqual(receipt);
    expect(resumed.mapRun.getSnapshot()?.activeEncounter?.enemies).toEqual([{ enemyId: 'training-target', currentHp: 5 }]);

    const forged = structuredClone(saved) as any;
    mutateBothLatestReceipts(forged, candidate => {
      candidate.effectTrace.find((row: any) => row.op === 'when').reads[0].count = 1;
    });
    const rejected = loadGame(definition, forged);
    expect(rejected.mapRun.getSnapshot()).toBeNull();
    expect(rejected.getDevLogs()).toContainEqual(expect.objectContaining({
      source: 'map-run', level: 'warning', details: expect.stringContaining('does not match the current Map'),
    }));
  });

  test('saves and restores an AG-1 v4 Status category receipt and rejects a forged category trace', () => {
    const definition: GameplayMapDef = {
      id: 'test:map:status-category-save-resume', name: 'Status Category Save Resume', resumeVersion: 4,
      executionContractId: 'AG-1', startNodeId: 'start', exitNodeIds: ['exit'],
      partyCharacterIds: ['shiroko', 'serika'],
      initialPartyHp: [
        { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
        { characterId: 'serika', initialHp: 10, maxHp: 10 },
      ],
      initialPlayerCost: 2,
      statuses: [
        { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3, category: 'harmful' },
        { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 3, category: 'beneficial' },
      ],
      actions: [{ id: 'apply-and-cleanse', name: 'Apply and Cleanse', eligibleCharacterIds: [], target: { kind: 'enemy' },
        effectProgram: { resolve: [
          { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 3 },
          { op: 'statusApply', target: 'primary', statusId: 'regen', stacks: 1, durationRounds: 3 },
          { op: 'statusRemoveCategory', target: 'primary', category: 'harmful' },
        ] } }],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: ['apply-and-cleanse'],
          enemies: [{ id: 'e1', initialHp: 5, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
    };
    const makeOwner = () => new MapRunService({ resolve: id => id === definition.id ? definition : null },
      variant => variant === 'Shiroko' ? 'shiroko' : variant === 'Serika' ? 'serika' : null);
    const owner = makeOwner();
    const started = owner.start(definition.id, [
      { characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' },
    ]);
    const entered = owner.move(started.runId, 'battle');
    owner.setAbilityDraft(started.runId, 'apply-and-cleanse', { kind: 'enemy', enemyId: 'e1' }, {
      nodeId: 'battle', round: entered.activeEncounter!.round, draftVersion: entered.activeEncounter!.draftVersion,
    });
    const ready = owner.getSnapshot()!;
    const committed = owner.commitEncounterRound({ runId: started.runId, requestId: 'status-category-save',
      expectedCommitVersion: ready.commitVersion,
      draft: { nodeId: 'battle', round: ready.activeEncounter!.round, draftVersion: ready.activeEncounter!.draftVersion } });
    expect(committed.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 4,
      plannedStatuses: [{ statusId: 'regen' }], statusRemoveTrace: [], statusConsumeTrace: [],
      statusCategoryRemoveTrace: [{ category: 'harmful', removed: [{ status: { statusId: 'burn', stacks: 2 } }] }],
    });

    const saved = owner.createSaveSnapshot()!;
    const resumed = makeOwner();
    expect(resumed.restoreSaveSnapshot(saved)).toMatchObject({ status: 'restored' });
    expect(resumed.getSnapshot()?.lastEncounterCommit).toEqual(committed.lastEncounterCommit);
    expect(resumed.getSnapshot()?.activeEncounter?.statuses).toEqual(committed.activeEncounter?.statuses);

    const forged = structuredClone(saved) as any;
    forged.run.lastEncounterCommit.statusCategoryRemoveTrace[0].category = 'beneficial';
    forged.run.activeEncounter.lastCommit.statusCategoryRemoveTrace[0].category = 'beneficial';
    const rejected = makeOwner();
    expect(rejected.restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(rejected.getSnapshot()).toBeNull();
  });
});
