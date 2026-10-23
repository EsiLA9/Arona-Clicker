import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import type { GameplayMapActionTargetDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { projectMapRelations } from '../../src/arona-clicker/services/map/map-relation-projector';

describe('Map preparation relation projection', () => {
  const games: GameInstance[] = [];
  function datapackFor(map: GameplayMapDef) {
    return {
      ...gameplayBMapDatapack,
      spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot,
        functionalities: (spot.functionalities ?? []).filter(functionality =>
          functionality.kind !== 'mapEntry' || functionality.mapId === map.id),
      })),
      maps: [map],
    };
  }
  function setup(target: GameplayMapActionTargetDef = { kind: 'enemy' }, ag1 = false) {
    const original = gameplayBMapDatapack.maps![0]!;
    const map: GameplayMapDef = {
      ...original, ...(ag1 ? { executionContractId: 'AG-1' as const,
        partyAgility: original.partyCharacterIds.map(characterId => ({ characterId, agility: 1 })) } : {}),
      initialPlayerCost: 4,
      initialActorResources: original.partyCharacterIds.map(characterId => ({ characterId, resourceId: 'energy', value: 0 })),
      initialTeamResources: [{ resourceId: 'supplies', value: 0 }],
      actions: [
        ...['hit', 'hit-b', 'hit-c', 'hit-d'].map(id => ({ id, name: id, eligibleCharacterIds: ['shiroko'], target,
          ...(ag1 ? { agility: { base: 1, max: 8 } } : {}),
          effectProgram: { resolve: [
            ...(target.kind === 'enemy' || target.kind === 'partyCharacter'
              ? [{ op: 'hpChange' as const, target: 'primary' as const, delta: -1 }] : []),
            { op: 'resourceChange' as const, account: 'sourceActor' as const, resourceId: 'energy', delta: 1 },
            { op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'supplies', delta: 1 },
          ] } })),
        { id: 'enemy-hit', name: 'enemy-hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          ...(ag1 ? { agility: { base: 1, max: 8 } } : {}),
          tendencyRole: 'attack', effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: -2 }] } },
        { id: 'ability', name: 'Ability', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          ...(ag1 ? { agility: { base: 1, max: 8 } } : {}),
          effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: 1 }] } },
      ],
      nodes: original.nodes.map(node => node.id !== 'b' ? node : {
        ...node, encounter: {
          title: 'Relation battle', enemies: [
            { id: 'robot', initialHp: 20, maxHp: 20, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
            { id: 'robot-b', initialHp: 20, maxHp: 20, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
          ],
          abilityActionIds: ['ability'], itemActions: [{ itemId: 'gameplay-b:item:relation-kit', actionId: 'ability' }],
          participants: [{ characterId: 'shiroko', actions: ['hit', 'hit-b', 'hit-c', 'hit-d'].map(actionId => ({ actionId, tendencyWeight: 1 })) }],
        },
      }),
    };
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack, { ...datapackFor(map), items: [{
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
    expect(relations()[0]).toMatchObject({ targetState: 'determined', selectedTarget: { kind: 'enemy', id: 'robot' }, canSelectTarget: true });
    game.setMapPreparedEnemyTarget(initial.run.runId, 'shiroko', 'robot-b', initial.actionPreview!.draft);
    const before = game.mapRun.getSnapshot();
    const projected = relations();
    expect(view().relations).toEqual(projected);
    expect(projected[0]).toMatchObject({
      phase: 'preparation', source: { kind: 'preparedAction', performer: { id: 'shiroko' } },
      selectedTarget: { kind: 'enemy', id: 'robot-b' }, targetState: 'determined',
      declaredEffects: [
        { kind: 'hp', target: 'primary', delta: -1, path: expect.stringMatching(/^actions\.hit(?:-[b-d])?\.effectProgram\.resolve\[0\]$/),
          recipient: { kind: 'enemy', id: 'robot-b' } },
        { kind: 'resource', account: 'sourceActor', resourceId: 'energy', delta: 1, recipient: { kind: 'partyCharacter', id: 'shiroko' } },
        { kind: 'resource', account: 'sourceTeam', resourceId: 'supplies', delta: 1,
          recipient: { kind: 'team', side: 'party' } },
      ],
    });
    expect(projected[0]).not.toHaveProperty('effectRecipients');
    expect(projected.filter(row => row.source.kind === 'preparedAction')).toHaveLength(1); // Serika waits.
    expect(projected.filter(row => row.source.kind === 'enemy')).toHaveLength(2);
    expect(projected[1]).toMatchObject({
      source: { actionId: 'enemy-hit', performer: { kind: 'enemy', id: 'robot' } },
      targetState: 'determined', selectedTarget: { kind: 'partyCharacter', id: 'shiroko' },
      candidates: [{ kind: 'partyCharacter', id: 'shiroko' }, { kind: 'partyCharacter', id: 'serika' }],
      canSelectTarget: false, canReplaceAction: false,
    });
    expect(relations()).toEqual(projected);
    expect(game.mapRun.getSnapshot()).toEqual(before);
    expect(Object.isFrozen(projected[0].declaredEffects?.[0]?.recipient)).toBe(true);
    expect(Object.isFrozen(projected[0].scope)).toBe(true);
    expect(Object.isFrozen(projected[0].candidates)).toBe(true);
    expect(projected[0].draft).not.toBe(view().actionPreview!.draft);
  });

  test('projects AG-1 Effect Program relations when the Action carries execution agility', () => {
    const { relations } = setup({ kind: 'enemy' }, true);
    expect(relations()[0]).toMatchObject({
      source: { kind: 'preparedAction' },
      declaredEffects: [
        { kind: 'hp', target: 'primary', delta: -1 },
        { kind: 'resource', account: 'sourceActor', resourceId: 'energy', delta: 1 },
        { kind: 'resource', account: 'sourceTeam', resourceId: 'supplies', delta: 1 },
      ],
    });
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
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot-b', current.actionPreview!.draft);
    current = view();
    const stale = current.actionPreview!.draft;
    const rng = current.run.activeEncounter!.randomState;
    game.swapMapPreparedAction(runId, 'shiroko', alternate, stale);
    current = view();
    expect(current.relations[0]).toMatchObject({ targetState: 'determined', selectedTarget: { kind: 'enemy', id: 'robot' } });
    expect(current.relations[0].candidates.map(row => row.id)).toContain('robot');
    expect(current.run.activeEncounter!.targetSelections).toEqual([]);
    expect(() => game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot', stale)).toThrow(/stale/);
    expect(view().run).toEqual(current.run);
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot-b', current.actionPreview!.draft);
    current = view();
    game.clearMapActionOverride(runId, 'shiroko', current.actionPreview!.draft);
    current = view();
    expect(current.relations[0]).toMatchObject({
      source: { actionId: natural }, targetState: 'determined', selectedTarget: { kind: 'enemy', id: 'robot' },
    });
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot-b', current.actionPreview!.draft);
    current = view();
    const command = current.actionPreview!.playerCommandOptions[0];
    game.issueMapPlayerCommand(runId, 'shiroko', command.action.actionId, current.actionPreview!.draft);
    current = view();
    expect(current.relations[0]).toMatchObject({
      source: { actionId: command.action.actionId }, targetState: 'determined', selectedTarget: { kind: 'enemy', id: 'robot' },
    });
    expect(view().relations).toEqual(current.relations);
    expect(view().run.activeEncounter!.randomState).toEqual(rng);
    expect(view().run.playerCost).toBe(4);
  });

  test('previews replacement without inheriting a legal target, writing state or advancing randomness', () => {
    const { game, view } = setup();
    let current = view();
    const runId = current.run.runId;
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot-b', current.actionPreview!.draft);
    current = view();
    const before = current.run;
    const prepared = current.actionPreview!.preparedActions[0];
    expect(() => game.mapRun.previewReplacement(runId, 'shiroko', prepared.preparedAction!.actionId, current.actionPreview!.draft)).toThrow(/different/);
    const actionId = prepared.hand.find(row => row.actionId !== prepared.preparedAction!.actionId)!.actionId;
    const preview = game.mapRun.previewReplacement(runId, 'shiroko', actionId, current.actionPreview!.draft);
    expect(preview[0]).toMatchObject({
      phase: 'replacementPreview',
      selectedTarget: { kind: 'enemy', id: 'robot' },
      targetState: 'determined',
      source: { actionId },
    });
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
