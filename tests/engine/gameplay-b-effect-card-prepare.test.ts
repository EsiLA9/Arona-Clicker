import { afterEach, describe, expect, test } from 'vitest';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { MapRunCardRef } from '../../src/arona-clicker/contracts/map-cards';
import type { MapCardActionChoice } from '../../src/arona-clicker/services/map-card-effects';
import { resolveMapCardEffects } from '../../src/arona-clicker/services/map-card-effects';
import { resolveGameplayBActionPreview } from '../../src/arona-clicker/services/gameplay-b-action-preview-resolver';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { createLegacyGoldenOwner, commitCommand as runtimeCommitCommand } from './gameplay-b-effect-test-fixtures';

describe('Gameplay B CardRef prepare adapter', () => {
  const games: GameInstance[] = [];
  const map: GameplayMapDef = {
    id: 'test:map:card-prepare',
    name: 'Card Prepare',
    resumeVersion: 1,
    startNodeId: 'start',
    exitNodeIds: ['exit'],
    partyCharacterIds: ['shiroko', 'serika'],
    initialPlayerCost: 4,
    initialPartyHp: ['shiroko', 'serika'].map(characterId => ({ characterId, initialHp: 20, maxHp: 20 })),
    initialActorResources: ['shiroko', 'serika'].map(characterId => ({ characterId, resourceId: 'sCost', value: 2 })),
    actions: [
      {
        id: 'discount', name: 'Discount', eligibleCharacterIds: ['shiroko'],
        target: { kind: 'card', side: 'ally' },
        effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: [] },
      },
      ...['strike', 'alternate', 'command', 'reserve'].map(id => ({
        id, name: id, eligibleCharacterIds: ['serika'], target: { kind: 'none' } as const,
        costs: [{ scope: 'actor' as const, resourceId: 'sCost', amount: 1 }],
      })),
    ],
    nodes: [
      { id: 'start', title: 'Start' },
      { id: 'battle', title: 'Battle', encounter: {
        title: 'Battle', enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'discount', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: ['strike', 'alternate', 'command', 'reserve'].map(actionId => ({ actionId, tendencyWeight: 1 })) },
        ],
      } },
      { id: 'exit', title: 'Exit' },
    ],
    edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
  };

  function setup(definition: GameplayMapDef = map) {
    const { game, runId } = createLegacyGoldenOwner(definition);
    games.push(game);
    const current = game.mapRun.getSnapshot();
    if (!current?.activeEncounter) throw new Error('MapRun did not create its Encounter');
    const preview = resolveGameplayBActionPreview({
      runId,
      definition,
      encounter: current.activeEncounter,
      party: current.party,
      partyHp: current.partyHp,
      playerCost: current.playerCost,
      actorResources: current.actorResources,
      teamResources: current.teamResources,
    });
    const cards = game.mapRun.getCards(runId);
    const source = preview.preparedActions.find(row => row.characterId === 'shiroko');
    if (!source?.targetCard) throw new Error('Card prepare preview has no Owner-generated CardRef');
    const choices: MapCardActionChoice[] = [
      ...preview.preparedActions.map(row => ({
        characterId: row.characterId,
        actionId: row.preparedActionId,
        overrideKind: row.overrideKind,
        ...(row.targetCard ? { targetCard: row.targetCard } : {}),
      })),
      ...(preview.preparedEnemyActions ?? []).map(row => ({
        enemyId: row.enemyId,
        actionId: row.naturalActionId,
        overrideKind: null,
        ...(row.targetCard ? { targetCard: row.targetCard } : {}),
      })),
    ];
    expect(current.activeEncounter?.randomState).toMatchObject({ seed: 0x08000000, cursor: expect.any(Number) });
    return { game, runId, definition, current, preview, cards, choices, source };
  }

  afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

  test('new program prepare accepts an Owner-generated CardRef and returns count-free leaf metadata', () => {
    const state = setup();
    const target = state.source.targetCard!;
    expect(state.cards.some(card => card.ref === target || JSON.stringify(card.ref) === JSON.stringify(target))).toBe(true);
    expect(state.source).toMatchObject({ targetKind: 'card', targetCard: target });
    const preparedTarget = state.cards.find(card => card.zone === 'hand' && card.owner.id === 'serika' && card.prepared);
    if (!preparedTarget) throw new Error('Expected the Owner-marked prepared Hand CardRef');
    const choices = state.choices.map(choice => choice.characterId === 'shiroko'
      ? { ...choice, targetCard: preparedTarget.ref }
      : choice);
    const scope = {
      runId: state.runId, mapId: state.definition.id, nodeId: state.current.activeEncounter!.nodeId,
      activityId: state.current.activeEncounter!.activityId ?? null, round: state.current.activeEncounter!.round,
    };
    const before = state.game.mapRun.getSnapshot();
    const first = resolveMapCardEffects(state.definition, scope, choices, choices);
    const repeated = resolveMapCardEffects(state.definition, scope, choices, choices);
    expect(first.prepareMetadata).toEqual([{
      sourceKey: 'shiroko',
      source: { kind: 'partyCharacter', id: 'shiroko' },
      actionId: 'discount',
      effectPath: 'actions.discount.effectProgram.prepare[0]',
      leaf: { op: 'discountSCost', amount: 1, mode: 'program' },
    }]);
    expect(Object.isFrozen(first.prepareMetadata)).toBe(true);
    expect(Object.isFrozen(first.prepareMetadata[0])).toBe(true);
    expect(first.prepareMetadata).toEqual(repeated.prepareMetadata);
    expect(first.reductions.get('serika')).toBe(1n);
    expect(first).not.toHaveProperty('budget');
    expect(first).not.toHaveProperty('visitCount');
    expect(state.game.mapRun.getSnapshot()).toEqual(before);
  });

  test('Enemy new program prepare accepts a real Owner-generated Hand CardRef and returns source metadata', () => {
    const definition: GameplayMapDef = {
      ...map,
      actions: [...map.actions!, {
        id: 'enemy-discount', name: 'Enemy Discount', eligibleCharacterIds: [],
        target: { kind: 'card', side: 'opponent' },
        effectProgram: { prepare: [{ op: 'discountSCost', amount: 2 }], resolve: [] },
      }],
      nodes: map.nodes.map(node => node.id !== 'battle' ? node : {
        ...node,
        encounter: { ...node.encounter!, enemies: [
          { id: 'robot', initialHp: 20, maxHp: 20, actions: [{ actionId: 'enemy-discount', tendencyWeight: 1 }] },
        ] },
      }),
    };
    const state = setup(definition);
    const enemyRow = state.preview.preparedEnemyActions.find(row => row.enemyId === 'robot');
    if (!enemyRow?.targetCard) throw new Error('Enemy program prepare preview has no current target CardRef');
    expect(state.cards.some(card => card.ref.id === enemyRow.targetCard!.id
      && JSON.stringify(card.ref.scope) === JSON.stringify(enemyRow.targetCard!.scope))).toBe(true);
    const scope = {
      runId: state.runId, mapId: definition.id, nodeId: state.current.activeEncounter!.nodeId,
      activityId: state.current.activeEncounter!.activityId ?? null, round: state.current.activeEncounter!.round,
    };
    const plan = resolveMapCardEffects(definition, scope, state.choices, state.choices);
    expect(plan.prepareMetadata).toContainEqual({
      sourceKey: JSON.stringify(['enemy', 'robot']),
      source: { kind: 'enemy', id: 'robot' },
      actionId: 'enemy-discount',
      effectPath: 'actions.enemy-discount.effectProgram.prepare[0]',
      leaf: { op: 'discountSCost', amount: 2, mode: 'program' },
    });
  });

  test('cross-round and forged CardRefs are rejected against current Scope and Hand directory', () => {
    const state = setup();
    const scope = {
      runId: state.runId, mapId: state.definition.id, nodeId: state.current.activeEncounter!.nodeId,
      activityId: state.current.activeEncounter!.activityId ?? null, round: state.current.activeEncounter!.round,
    };
    const original = state.source.targetCard!;
    const invalidRefs: MapRunCardRef[] = [
      { ...original, scope: { ...original.scope, round: original.scope.round + 1 } },
      { ...original, id: JSON.stringify(['hand', 'partyCharacter', 'serika', 'not-in-current-hand']) },
    ];
    for (const targetCard of invalidRefs) {
      const choice = { characterId: 'shiroko', actionId: 'discount', overrideKind: null, targetCard } satisfies MapCardActionChoice;
      expect(() => resolveMapCardEffects(state.definition, scope, [choice], [choice])).toThrow(/another scene or round|eligible scost card/);
    }
  });

  test('a removed PlayerCommand cannot remain a legal prepare target', () => {
    const state = setup();
    const workspace = state.game.mapRun.getWorkspaceView(state.runId)!;
    if (workspace.kind !== 'active' || !workspace.actionPreview) throw new Error('No PlayerCommand preview');
    const preparedActionIds = new Set(state.game.mapRun.getSnapshot()!.activeEncounter!.hands
      .find(row => row.characterId === 'serika')!.actionIds);
    const option = workspace.actionPreview.playerCommandOptions.find(row => row.characterId === 'serika'
      && !preparedActionIds.has(row.action.actionId));
    if (!option) throw new Error('Expected a real command candidate outside the Hand');
    state.game.issueMapPlayerCommand(state.runId, 'serika', option.action.actionId, workspace.actionPreview.draft);
    const commandCard = state.game.mapRun.getCards(state.runId).find(card => card.zone === 'playerCommand');
    if (!commandCard) throw new Error('Expected Owner-generated PlayerCommand CardRef');
    const commandedWorkspace = state.game.mapRun.getWorkspaceView(state.runId);
    if (commandedWorkspace?.kind !== 'active' || !commandedWorkspace.actionPreview) throw new Error('No commanded preview');
    state.game.clearMapActionOverride(state.runId, 'serika', commandedWorkspace.actionPreview.draft);
    const current = state.game.mapRun.getSnapshot()!;
    const staleEncounter = {
      ...current.activeEncounter!,
      targetSelections: [{ characterId: 'shiroko', targetCard: commandCard.ref }],
    };
    expect(() => resolveGameplayBActionPreview({
      runId: state.runId, definition: state.definition, encounter: staleEncounter,
      party: current.party, partyHp: current.partyHp, playerCost: current.playerCost,
      actorResources: current.actorResources, teamResources: current.teamResources,
    })).toThrow(/Card target selection is not legal/);
  });

  test('legacy and program effects cannot be mixed on the same Action', () => {
    const state = setup();
    const mixed = {
      ...state.definition,
      actions: state.definition.actions!.map(action => action.id === 'discount'
        ? { ...action, cardEffects: [{ kind: 'scostDiscount' as const, amount: 1 }] }
        : action),
    };
    expect(() => resolveGameplayBActionPreview({
      runId: state.runId, definition: mixed, encounter: state.current.activeEncounter!,
      party: state.current.party, partyHp: state.current.partyHp, playerCost: state.current.playerCost,
      actorResources: state.current.actorResources, teamResources: state.current.teamResources,
    })).toThrow(/cannot be mixed with legacy effect arrays/);
  });

  test('an unprepared Hand target does not transfer its legacy discount to the executed card', () => {
    const legacy: GameplayMapDef = {
      ...map,
      actions: map.actions!.map(action => action.id === 'discount'
        ? { ...action, effectProgram: undefined, cardEffects: [{ kind: 'scostDiscount', amount: 1 }] }
        : action),
    };
    const state = setup(legacy);
    const activeActionId = state.choices.find(choice => choice.characterId === 'serika')?.actionId;
    const unused = state.cards.find(card => card.zone === 'hand' && card.owner.id === 'serika'
      && card.actionId !== activeActionId);
    if (!unused) throw new Error('Expected Owner-generated alternate Hand CardRef');
    const choices = state.choices.map(choice => choice.characterId === 'shiroko'
      ? { ...choice, targetCard: unused.ref }
      : choice);
    const scope = {
      runId: state.runId, mapId: state.definition.id, nodeId: state.current.activeEncounter!.nodeId,
      activityId: state.current.activeEncounter!.activityId ?? null, round: state.current.activeEncounter!.round,
    };
    const plan = resolveMapCardEffects(state.definition, scope, choices, choices);
    expect(plan.targets.get('shiroko')).toEqual(unused.ref);
    expect(plan.reductions.size).toBe(0);
  });

  test('prepare requires a real card target and its new program commits through the public owner', () => {
    const state = setup();
    const noCardTarget = {
      ...map,
      actions: map.actions!.map(action => action.id === 'discount'
        ? { ...action, target: { kind: 'none' as const } }
        : action),
    };
    const choice = { characterId: 'shiroko', actionId: 'discount', overrideKind: null } satisfies MapCardActionChoice;
    const scope = {
      runId: state.runId, mapId: state.definition.id, nodeId: state.current.activeEncounter!.nodeId,
      activityId: state.current.activeEncounter!.activityId ?? null, round: state.current.activeEncounter!.round,
    };
    expect(() => resolveMapCardEffects(noCardTarget, scope, [choice], [choice])).toThrow(/Unexpected card target or effect/);
    const workspace = state.game.mapRun.getWorkspaceView(state.runId)!;
    if (workspace.kind !== 'active' || !workspace.actionPreview) throw new Error('No Commit draft');
    const committed = state.game.commitMapEncounterRound(runtimeCommitCommand(state.game, state.runId, 'program-transition'));
    expect(committed.lastEncounterCommit).toMatchObject({
      programReceiptVersion: 1,
      executionContractId: 'E1-COMPAT-1',
      effectScope: { runId: state.runId, mapId: state.definition.id, nodeId: 'battle', round: 1 },
    });
    expect(committed.lastEncounterCommit?.effectTrace?.some(row => row.op === 'discountSCost')).toBe(true);
    expect(committed.activeEncounter?.round).toBe(2);
  });
});
