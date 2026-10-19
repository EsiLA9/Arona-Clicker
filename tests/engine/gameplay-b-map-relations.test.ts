import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import type { GameplayMapActionTargetDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { projectMapRelations } from '../../src/arona-clicker/services/map-relation-projector';

describe('Map preparation relation projection', () => {
  const games: GameInstance[] = [];
  function setup(target: GameplayMapActionTargetDef = { kind: 'enemy' }) {
    const original = gameplayBMapDatapack.maps![0]!;
    const map: GameplayMapDef = {
      ...original, initialPlayerCost: 4,
      actions: [
        ...['hit', 'hit-b', 'hit-c', 'hit-d'].map(id => ({ id, name: id, eligibleCharacterIds: ['shiroko'], target,
          ...(target.kind === 'enemy' || target.kind === 'partyCharacter' ? { hpEffects: [{ amount: -1 }] } : {}),
          effects: [{ scope: 'actor' as const, resourceId: 'energy', amount: 1 }, { scope: 'team' as const, resourceId: 'supplies', amount: 1 }] })),
        { id: 'ability', name: 'Ability', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, hpEffects: [{ amount: 1 }] },
      ],
      nodes: original.nodes.map(node => node.id !== 'b' ? node : {
        ...node, encounter: {
          title: 'Relation battle', enemies: [{ id: 'robot', initialHp: 20, maxHp: 20, damage: 2 }, { id: 'robot-b', initialHp: 20, maxHp: 20, damage: 1 }],
          abilityActionIds: ['ability'], itemActions: [{ itemId: 'gameplay-b:item:relation-kit', actionId: 'ability' }],
          participants: [{ characterId: 'shiroko', actions: ['hit', 'hit-b', 'hit-c', 'hit-d'].map(actionId => ({ actionId, tendencyWeight: 1 })) }],
        },
      }),
    };
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack, { ...gameplayBMapDatapack, maps: [map], items: [{
      id: 'gameplay-b:item:relation-kit', name: 'Kit', description: 'Kit', maxStack: 3, rarity: 'common', type: 'consumable',
    }] }], { enterDefaultInit: false });
    for (const characterId of map.partyCharacterIds) {
      const variant = game.rosterSystem.getAllVariants().find(row => row.proto === characterId)!;
      game.mutations.acquireCharacter(variant.id, 'story');
    }
    const started = game.startMap(map.id);
    game.moveMap(started.runId, 'b');
    const view = () => {
      const current = game.mapRun.getWorkspaceView(started.runId);
      if (current?.kind !== 'active' || !current.actionPreview) throw new Error('No active view');
      return current;
    };
    return { game, map, view, relations: () => projectMapRelations(view(), map) };
  }
  afterEach(() => { for (const game of games.splice(0)) game.dispose(); });

  test('separates selected enemy, actor resource and team resource recipients without writing state', () => {
    const { game, view, relations } = setup();
    const initial = view();
    expect(relations()[0]).toMatchObject({ targetState: 'pending', selectedTarget: null, canSelectTarget: true });
    game.setMapPreparedEnemyTarget(initial.run.runId, 'shiroko', 'robot', initial.actionPreview!.draft);
    const before = game.mapRun.getSnapshot();
    const projected = relations();
    expect(view().relations).toEqual(projected);
    expect(projected[0]).toMatchObject({
      phase: 'preparation', source: { kind: 'preparedAction', performer: { id: 'shiroko' } },
      selectedTarget: { kind: 'enemy', id: 'robot' }, targetState: 'determined',
      effectRecipients: [
        { kind: 'hp', recipient: { kind: 'enemy', id: 'robot' } },
        { kind: 'resource', recipient: { kind: 'partyCharacter', id: 'shiroko' } },
        { kind: 'resource', recipient: { kind: 'team' } },
      ],
    });
    expect(projected.filter(row => row.source.kind === 'preparedAction')).toHaveLength(1); // Serika waits.
    expect(projected.filter(row => row.source.kind === 'enemy')).toHaveLength(2);
    expect(projected[1]).toMatchObject({ targetState: 'unknown', selectedTarget: null, candidates: [], canSelectTarget: false, canReplaceAction: false });
    expect(relations()).toEqual(projected);
    expect(game.mapRun.getSnapshot()).toEqual(before);
    expect(Object.isFrozen(projected[0].effectRecipients[0].recipient)).toBe(true);
    expect(Object.isFrozen(projected[0].scope)).toBe(true);
    expect(Object.isFrozen(projected[0].candidates)).toBe(true);
    expect(projected[0].draft).not.toBe(view().actionPreview!.draft);
  });

  test.each(['none', 'self'] as const)('distinguishes %s from pending or unknown', kind => {
    const { relations } = setup({ kind });
    expect(relations()[0]).toMatchObject({ selectionMode: kind, targetState: kind === 'none' ? 'none' : 'determined', canSelectTarget: false });
    expect(relations()[0].selectedTarget?.id ?? null).toBe(kind === 'self' ? 'shiroko' : null);
  });

  test('keeps actorless Ability and Item sources separate without inventing performers', () => {
    const { game, view, relations } = setup();
    let current = view();
    game.setMapAbilityDraft(current.run.runId, 'ability', null, current.actionPreview!.draft);
    current = view();
    game.mutations.addItem('gameplay-b:item:relation-kit', 1);
    game.setMapItemDraft(current.run.runId, 'gameplay-b:item:relation-kit', { kind: 'partyCharacter', characterId: 'serika' }, current.actionPreview!.draft);
    expect(relations().find(row => row.source.kind === 'ability')).toMatchObject({
      source: { performer: null }, targetState: 'pending', selectedTarget: null,
    });
    expect(relations().find(row => row.source.kind === 'item')).toMatchObject({
      source: { performer: null, id: 'gameplay-b:item:relation-kit' }, targetState: 'determined', selectedTarget: { id: 'serika' },
    });
  });

  test('scopes identical local IDs and emits no preparation relations outside an encounter', () => {
    const first = setup();
    const second = setup();
    // A new GameInstance may restart run numbering: map/run context is supplied explicitly.
    const original = first.view();
    const copy = { ...original, run: { ...original.run, runId: 'another-run' } };
    expect(projectMapRelations(copy, first.map)[0].key).not.toBe(first.relations()[0].key);
    expect(second.relations()[0].scope.nodeId).toBe('b');
    expect(projectMapRelations({ ...original, actionPreview: null }, first.map)).toEqual([]);
  });

  test('re-resolves Swap, PlayerCommand and natural restoration rather than inheriting a still-legal target', () => {
    const { game, view } = setup();
    let current = view();
    const runId = current.run.runId;
    const natural = current.actionPreview!.preparedActions[0].naturalAction!.actionId;
    const alternate = current.actionPreview!.preparedActions[0].hand.find(action => action.actionId !== natural)!.actionId;
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot', current.actionPreview!.draft);
    current = view();
    const stale = current.actionPreview!.draft;
    const rng = current.run.activeEncounter!.randomState;
    game.swapMapPreparedAction(runId, 'shiroko', alternate, stale);
    current = view();
    expect(current.relations[0]).toMatchObject({ targetState: 'pending', selectedTarget: null });
    expect(current.relations[0].candidates.map(row => row.id)).toContain('robot');
    expect(current.run.activeEncounter!.targetSelections).toEqual([]);
    expect(() => game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot', stale)).toThrow(/stale/);
    expect(view().run).toEqual(current.run);
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot-b', current.actionPreview!.draft);
    current = view();
    game.clearMapActionOverride(runId, 'shiroko', current.actionPreview!.draft);
    current = view();
    expect(current.relations[0]).toMatchObject({ source: { actionId: natural }, targetState: 'pending', selectedTarget: null });
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot', current.actionPreview!.draft);
    current = view();
    const command = current.actionPreview!.playerCommandOptions[0];
    game.issueMapPlayerCommand(runId, 'shiroko', command.action.actionId, current.actionPreview!.draft);
    current = view();
    expect(current.relations[0]).toMatchObject({ source: { actionId: command.action.actionId }, targetState: 'pending', selectedTarget: null });
    expect(view().relations).toEqual(current.relations);
    expect(view().run.activeEncounter!.randomState).toEqual(rng);
    expect(view().run.playerCost).toBe(4);
  });

  test('previews replacement without inheriting a legal target, writing state or advancing randomness', () => {
    const { game, view } = setup();
    let current = view();
    const runId = current.run.runId;
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot', current.actionPreview!.draft);
    current = view();
    const before = current.run;
    const prepared = current.actionPreview!.preparedActions[0];
    expect(() => game.mapRun.previewReplacement(runId, 'shiroko', prepared.preparedAction!.actionId, current.actionPreview!.draft)).toThrow(/different/);
    const actionId = prepared.hand.find(row => row.actionId !== prepared.preparedAction!.actionId)!.actionId;
    const preview = game.mapRun.previewReplacement(runId, 'shiroko', actionId, current.actionPreview!.draft);
    expect(preview[0]).toMatchObject({ phase: 'replacementPreview', selectedTarget: null, targetState: 'pending', source: { actionId } });
    expect(game.mapRun.previewReplacement(runId, 'shiroko', actionId, current.actionPreview!.draft)).toEqual(preview);
    const command = current.actionPreview!.playerCommandOptions[0];
    expect(game.mapRun.previewReplacement(runId, 'shiroko', command.action.actionId, current.actionPreview!.draft)[0].source.actionId).toBe(command.action.actionId);
    expect(() => game.mapRun.previewReplacement(runId, 'shiroko', 'not-a-candidate', current.actionPreview!.draft)).toThrow();
    expect(game.mapRun.getSnapshot()).toEqual(before);
    game.swapMapPreparedAction(runId, 'shiroko', actionId, current.actionPreview!.draft);
    expect(view().relations[0]).toMatchObject({ source: preview[0].source, selectedTarget: preview[0].selectedTarget, targetState: preview[0].targetState });
    expect(() => game.mapRun.previewReplacement(runId, 'shiroko', actionId, current.actionPreview!.draft)).toThrow(/stale/);
  });
});
