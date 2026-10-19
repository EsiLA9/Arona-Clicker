import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { baseDatapack } from '../../src/data/test-datapack';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b-map-datapack';
import type { MapRunCardRef } from '../../src/arona-clicker/contracts/map-cards';
import { resolveGameplayBActionPreview } from '../../src/arona-clicker/services/gameplay-b-action-preview-resolver';
import { createGameCommands } from '../../src/arona-clicker/runtime-commands';

describe('MapRun domain cards', () => {
  const games: GameInstance[] = [];
  const map: GameplayMapDef = {
    id: gameplayBMapDatapack.maps![0].id, name: 'Cards', resumeVersion: 1, startNodeId: 'a', exitNodeIds: ['c'],
    partyCharacterIds: ['shiroko', 'serika'], initialPlayerCost: 4,
    initialPartyHp: ['shiroko', 'serika'].map(characterId => ({ characterId, initialHp: 20, maxHp: 20 })),
    actions: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id, eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' } })),
    nodes: [{ id: 'a', title: 'Start' }, { id: 'b', title: 'Battle', encounter: {
      title: 'Battle', enemies: [{ id: 'robot', initialHp: 100, maxHp: 100, damage: 1 }],
      participants: ['shiroko', 'serika'].map(characterId => ({ characterId,
        actions: ['a', 'b', 'c', 'd'].map(actionId => ({ actionId, tendencyWeight: 1 })) })),
    } }, { id: 'c', title: 'Exit' }],
    edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
  };
  function setup(definition = map) {
    const game = new GameInstance(); games.push(game);
    game.init([baseDatapack, { ...gameplayBMapDatapack, maps: [definition] }], { enterDefaultInit: false });
    for (const id of definition.partyCharacterIds) {
      game.mutations.acquireCharacter(game.rosterSystem.getAllVariants().find(row => row.proto === id)!.id, 'story');
    }
    const run = game.startMap(definition.id);
    expect(game.mapRun.getCards(run.runId)).toEqual([]);
    game.moveMap(run.runId, 'b');
    const view = () => {
      const current = game.mapRun.getWorkspaceView(run.runId);
      if (current?.kind !== 'active' || !current.actionPreview) throw new Error('No preparation');
      return current;
    };
    return { game, runId: run.runId, view, cards: () => game.mapRun.getCards(run.runId) };
  }
  afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

  function discountMap(side: 'self' | 'ally' | 'opponent' | 'any' = 'ally', one = false): GameplayMapDef {
    return { ...map, initialActorResources: map.partyCharacterIds.map(characterId => ({ characterId, resourceId: 'sCost', value: 2 })),
      actions: map.actions!.map(action => action.id === 'a'
        ? { ...action, target: { kind: 'card', side }, cardEffects: [{ kind: 'scostDiscount', amount: 1 }] }
        : { ...action, costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] }),
      nodes: map.nodes.map(node => node.id !== 'b' ? node : { ...node, encounter: { ...node.encounter!, participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'a', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: (one ? ['b'] : ['b', 'c', 'd']).map(actionId => ({ actionId, tendencyWeight: 1 })) },
      ] } }),
    };
  }

  test('Workspace relations project current card choices and declared effects, separately from actual charges', () => {
    const { game, runId, view, cards } = setup(discountMap());
    const initial = view();
    expect(initial.cards).toEqual(cards());
    const before = initial.run;
    const defaultTarget = initial.actionPreview!.preparedActions[0].targetCard;
    expect(defaultTarget).toEqual(initial.actionPreview!.preparedActions[0].legalTargetCards![0]);
    expect(initial.relations[0]).toMatchObject({ selectedTarget: defaultTarget, targetState: 'determined', canSelectTarget: true,
      source: { performer: { kind: 'partyCharacter', id: 'shiroko' } },
      effectRecipients: [{ kind: 'cardCost', resourceId: 'sCost', amount: -1, recipient: defaultTarget }] });
    expect(initial.relations[0].candidates).toEqual(initial.actionPreview!.preparedActions[0].legalTargetCards);
    expect(game.mapRun.getSnapshot()).toEqual(before);
    const target = initial.relations[0].candidates[0];
    if (target.kind !== 'card') throw new Error('Expected a domain card');
    game.setMapPreparedCardTarget(runId, 'shiroko', target, initial.actionPreview!.draft);
    expect(view().relations[0]).toMatchObject({ selectedTarget: target, targetState: 'determined',
      effectRecipients: [{ kind: 'cardCost', recipient: target, amount: -1 }] });
    expect(Object.isFrozen(view().relations[0].selectedTarget!.scope)).toBe(true);
    const unused = view().cards.find(card => card.ref.id === target.id && !card.prepared);
    const after = game.commitMapEncounterRound({ runId, requestId: 'projected', expectedCommitVersion: 0, draft: view().actionPreview!.draft });
    expect(after.lastEncounterCommit!.settlements[1].scostCost?.discount).toBe(unused ? 0 : 1);
    expect(after.lastEncounterCommit!.settlements[0].targetCard).toEqual(target);
  });

  test('card targets resolve existing scost-bearing cards by source-relative side, without writing the draft', () => {
    const definition = discountMap();
    const { game, runId, cards } = setup(definition);
    const run = game.mapRun.getSnapshot()!;
    const input = { runId, definition, encounter: run.activeEncounter!, party: run.party, partyHp: run.partyHp,
      playerCost: run.playerCost, actorResources: run.actorResources, teamResources: run.teamResources };
    const prepared = resolveGameplayBActionPreview(input).preparedActions[0];
    expect(prepared).toMatchObject({
      targetKind: 'card', targetCard: prepared.legalTargetCards![0], targetSelectionRequired: false,
    });
    expect(prepared.legalTargetCards).toHaveLength(3);
    const target = prepared.legalTargetCards![0];
    expect(cards().find(card => card.ref.id === target.id)?.owner.id).toBe('serika');
    const selected = resolveGameplayBActionPreview({ ...input, encounter: { ...input.encounter,
      targetSelections: [{ characterId: 'shiroko', targetCard: target }] } }).preparedActions[0];
    expect(selected).toMatchObject({ targetSelectionRequired: false, targetCard: target, targetCharacterId: null });
    for (const invalid of [cards().find(card => card.owner.kind === 'enemy')!.ref,
      cards().find(card => card.owner.id === 'shiroko')!.ref,
      { ...target, scope: { ...target.scope, runId: 'other-run' } },
      { ...target, scope: { ...target.scope, round: 2 } }]) {
      expect(() => resolveGameplayBActionPreview({ ...input, encounter: { ...input.encounter,
        targetSelections: [{ characterId: 'shiroko', targetCard: invalid }] } })).toThrow(/Card target selection/);
    }
    expect(game.mapRun.getSnapshot()).toEqual(run);
  });

  test.each(['self', 'opponent'] as const)('does not invent a target when %s has no scost-bearing card', side => {
    const definition = discountMap(side);
    const { game, runId, view } = setup(definition);
    const run = game.mapRun.getSnapshot()!;
    const prepared = resolveGameplayBActionPreview({ runId, definition, encounter: run.activeEncounter!, party: run.party,
      partyHp: run.partyHp, playerCost: run.playerCost, actorResources: run.actorResources, teamResources: run.teamResources }).preparedActions[0];
    expect(prepared).toMatchObject({
      targetCard: null, legalTargetCards: [], targetSelectionRequired: false, skipReason: 'noLegalTarget',
    });
    const before = game.mapRun.getSnapshot();
    const committed = game.commitMapEncounterRound({ runId, requestId: 'skip-no-card-target', expectedCommitVersion: 0,
      draft: view().actionPreview!.draft });
    const skipped = committed.lastEncounterCommit!.settlements[0];
    expect(skipped).toMatchObject({
      characterId: 'shiroko', actionId: 'a', targetCharacterId: null, overrideKind: null,
      playerCostSpent: 0, resourceChanges: [], skipReason: 'noLegalTarget',
    });
    expect(skipped).not.toHaveProperty('targetCard');
    expect(skipped).not.toHaveProperty('scostCost');
    expect(committed.actorResources.find(row => row.characterId === 'shiroko' && row.resourceId === 'sCost')?.value)
      .toBe(before?.actorResources.find(row => row.characterId === 'shiroko' && row.resourceId === 'sCost')?.value);
    const receipt = committed.lastEncounterCommit;
    game.load(game.save());
    expect(game.mapRun.getSnapshot()?.lastEncounterCommit).toEqual(receipt);
  });

  test('uniquely resolves a real card and commits its real scost reduction', () => {
    const definition = discountMap('ally', true);
    const { game, runId, view } = setup(definition);
    const run = game.mapRun.getSnapshot()!;
    const prepared = resolveGameplayBActionPreview({ runId, definition, encounter: run.activeEncounter!, party: run.party,
      partyHp: run.partyHp, playerCost: run.playerCost, actorResources: run.actorResources, teamResources: run.teamResources }).preparedActions[0];
    expect(prepared).toMatchObject({ targetSelectionRequired: false, targetCard: { kind: 'card' } });
    const after = game.commitMapEncounterRound({ runId, requestId: 'discount', expectedCommitVersion: 0,
      draft: view().actionPreview!.draft });
    expect(after.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'sCost')?.value).toBe(2);
    expect(after.lastEncounterCommit!.settlements[1].scostCost).toEqual({ original: 1, discount: 1, paid: 0 });
    expect(after.lastEncounterCommit!.settlements[0].targetCard).toEqual(prepared.targetCard);
    expect(Object.isFrozen(after.lastEncounterCommit!.settlements[1].scostCost)).toBe(true);
    const projectedCost = view().actionPreview!.recentCommit!.settlements[1].scostCost;
    expect(projectedCost).toEqual(after.lastEncounterCommit!.settlements[1].scostCost);
    expect(Object.isFrozen(projectedCost)).toBe(true);
  });

  test('auto-selects the first real card instance in catalog order and applies the effect to that instance', () => {
    const partyCharacterIds = ['shiroko', 'serika', 'hoshino'];
    const definition: GameplayMapDef = {
      ...map,
      partyCharacterIds,
      initialPartyHp: partyCharacterIds.map(characterId => ({ characterId, initialHp: 20, maxHp: 20 })),
      initialActorResources: partyCharacterIds.map(characterId => ({ characterId, resourceId: 'sCost', value: 1 })),
      actions: [
        {
          id: 'source-card', name: 'Discount Card', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'card', side: 'ally' }, cardEffects: [{ kind: 'scostDiscount', amount: 1 }],
        },
        {
          id: 'shared-cost-action', name: 'Shared Cost', eligibleCharacterIds: ['serika', 'hoshino'],
          target: { kind: 'none' }, costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }],
        },
      ],
      nodes: map.nodes.map(node => node.id !== 'b' ? node : { ...node, encounter: { ...node.encounter!, participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'source-card', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'shared-cost-action', tendencyWeight: 1 }] },
        { characterId: 'hoshino', actions: [{ actionId: 'shared-cost-action', tendencyWeight: 1 }] },
      ] } }),
    };
    const { game, runId, view, cards } = setup(definition);
    const initial = view();
    const source = initial.actionPreview!.preparedActions[0];
    const duplicateInstances = cards().filter(card => card.zone === 'hand' && card.actionId === 'shared-cost-action');
    expect(duplicateInstances.map(card => card.owner.id)).toEqual(['serika', 'hoshino']);
    expect(duplicateInstances[0].ref).not.toEqual(duplicateInstances[1].ref);
    expect(source.legalTargetCards).toEqual(duplicateInstances.map(card => card.ref));
    expect(source.targetCard).toEqual(source.legalTargetCards![0]);
    expect(source.targetSelectionRequired).toBe(false);

    const committed = game.commitMapEncounterRound({ runId, requestId: 'auto-card-target', expectedCommitVersion: 0,
      draft: initial.actionPreview!.draft });
    expect(committed.lastEncounterCommit!.settlements[0].targetCard).toEqual(source.legalTargetCards![0]);
    expect(committed.lastEncounterCommit!.settlements[1].scostCost).toEqual({ original: 1, discount: 1, paid: 0 });
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'sCost')?.value).toBe(1);
    expect(committed.actorResources.find(row => row.characterId === 'hoshino' && row.resourceId === 'sCost')?.value).toBe(0);
    const receipt = committed.lastEncounterCommit;
    game.load(game.save());
    expect(game.mapRun.getSnapshot()?.lastEncounterCommit).toEqual(receipt);
  });

  test('discounts on an unplayed Hand card do not transfer to the executed card', () => {
    const { game, runId, view, cards } = setup(discountMap());
    const unused = cards().find(card => card.owner.id === 'serika' && !card.prepared)!.ref;
    game.setMapPreparedCardTarget(runId, 'shiroko', unused, view().actionPreview!.draft);
    const after = game.commitMapEncounterRound({ runId, requestId: 'unplayed', expectedCommitVersion: 0, draft: view().actionPreview!.draft });
    expect(after.lastEncounterCommit!.settlements[1].scostCost).toEqual({ original: 1, discount: 0, paid: 1 });
    expect(after.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'sCost')?.value).toBe(1);
    expect(after.activeEncounter!.targetSelections).toEqual([]);
    game.load(game.save());
    expect(game.mapRun.getSnapshot()!.lastEncounterCommit!.settlements[0].targetCard).toEqual(unused);
  });

  test('large stacked reductions clamp at zero and stay independent from fixed PlayerCost', () => {
    const base = discountMap('ally', true);
    const definition: GameplayMapDef = { ...base, actions: base.actions!.map(action => action.id === 'a' || action.id === 'b'
      ? { ...action, target: { kind: 'card', side: 'ally' }, cardEffects: [{ kind: 'scostDiscount', amount: Number.MAX_SAFE_INTEGER }] }
      : action) };
    const { game, runId, view } = setup(definition);
    const after = game.commitMapEncounterRound({ runId, requestId: 'stacked', expectedCommitVersion: 0, draft: view().actionPreview!.draft });
    expect(after.lastEncounterCommit!.settlements[1].scostCost).toEqual({ original: 1, discount: 1, paid: 0 });
    expect(after.playerCost).toBe(4);
    expect(after.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'sCost')?.value).toBe(2);
    game.load(game.save());
    expect(game.mapRun.getSnapshot()!.lastEncounterCommit).toEqual(after.lastEncounterCommit);
  });

  test('the real PlayerCommand still costs one PlayerCost; retries and save/load never charge or discount twice', () => {
    const base = discountMap();
    const definition: GameplayMapDef = { ...base, actions: [...base.actions!, { ...base.actions![1], id: 'e' }],
      nodes: base.nodes.map(node => node.id !== 'b' ? node : { ...node, encounter: { ...node.encounter!, participants: [
        node.encounter!.participants![0], { characterId: 'serika', actions: ['b', 'c', 'd', 'e'].map(actionId => ({ actionId, tendencyWeight: 1 })) },
      ] } }),
    };
    const { game, runId, view, cards } = setup(definition);
    const option = view().actionPreview!.playerCommandOptions.find(row => row.characterId === 'serika')!;
    game.issueMapPlayerCommand(runId, 'serika', option.action.actionId, view().actionPreview!.draft);
    game.setMapPreparedCardTarget(runId, 'shiroko', cards().find(card => card.zone === 'playerCommand')!.ref, view().actionPreview!.draft);
    const command = { runId, requestId: 'command-discount', expectedCommitVersion: 0, draft: view().actionPreview!.draft };
    const after = game.commitMapEncounterRound(command);
    expect(after.playerCost).toBe(3);
    expect(after.lastEncounterCommit!.settlements[1]).toMatchObject({ playerCostSpent: 1, scostCost: { original: 1, discount: 1, paid: 0 } });
    expect(game.commitMapEncounterRound(command)).toEqual(after);
    game.load(game.save());
    expect(game.commitMapEncounterRound(command)).toEqual(after);
  });

  test('a new round has no inherited discount when its source can no longer prepare the action', () => {
    const base = discountMap('ally', true);
    const definition: GameplayMapDef = { ...base, actions: base.actions!.map(action => action.id === 'a'
      ? { ...action, costs: [{ scope: 'actor', resourceId: 'sCost', amount: 2 }] } : action) };
    const { game, runId, view, cards } = setup(definition);
    game.setMapPreparedCardTarget(runId, 'shiroko', cards().find(card => card.owner.id === 'serika')!.ref, view().actionPreview!.draft);
    game.commitMapEncounterRound({ runId, requestId: 'first', expectedCommitVersion: 0, draft: view().actionPreview!.draft });
    expect(view().actionPreview!.preparedActions[0].preparedAction).toBeNull();
    const after = game.commitMapEncounterRound({ runId, requestId: 'second', expectedCommitVersion: 1, draft: view().actionPreview!.draft });
    expect(after.lastEncounterCommit!.settlements[1].scostCost).toEqual({ original: 1, discount: 0, paid: 1 });
  });

  test('discounts cannot fund unrelated costs, and forged actual discount receipts are rejected', () => {
    const base = discountMap('ally');
    const definition: GameplayMapDef = { ...base, initialTeamResources: [{ resourceId: 'supplies', value: 3 }],
      actions: [
        ...base.actions!.map(action => ({ ...action, costs: [...(action.costs ?? []), { scope: 'team' as const, resourceId: 'supplies', amount: 2 }] })),
        { ...base.actions![1], id: 'serika-free', costs: undefined },
      ],
      nodes: base.nodes.map(node => node.id !== 'b' ? node : { ...node, encounter: { ...node.encounter!, participants: [
        node.encounter!.participants![0], {
          ...node.encounter!.participants![1],
          actions: [...node.encounter!.participants![1].actions, { actionId: 'serika-free', tendencyWeight: 1 }],
        },
      ] } }),
    };
    const first = setup(definition);
    const initial = first.view();
    const serikaHand = first.game.mapRun.getSnapshot()?.activeEncounter?.hands
      .find(row => row.characterId === 'serika')?.actionIds;
    const alternate = serikaHand?.find(actionId => ['b', 'c', 'd'].includes(actionId));
    if (!alternate) throw new Error('Expected a payable Serika Swap candidate: ' + JSON.stringify(serikaHand));
    first.game.swapMapPreparedAction(first.runId, 'serika', alternate, initial.actionPreview!.draft);
    const afterSwap = first.view();
    const cardTarget = afterSwap.actionPreview!.preparedActions[0].legalTargetCards?.[0];
    if (!cardTarget) throw new Error('Expected a legal card target for Shiroko after Swap');
    first.game.setMapPreparedCardTarget(first.runId, 'shiroko', cardTarget, afterSwap.actionPreview!.draft);
    const before = first.game.mapRun.getSnapshot();
    expect(() => first.game.commitMapEncounterRound({ runId: first.runId, requestId: 'fail', expectedCommitVersion: 0,
      draft: first.view().actionPreview!.draft })).toThrow(/cannot afford/);
    expect(first.game.mapRun.getSnapshot()).toEqual(before);
    const second = setup(discountMap('ally', true));
    second.game.commitMapEncounterRound({ runId: second.runId, requestId: 'valid', expectedCommitVersion: 0, draft: second.view().actionPreview!.draft });
    const forged = JSON.parse(JSON.stringify(second.game.save()));
    forged.mapRun.run.lastEncounterCommit.settlements[1].scostCost.discount = 99;
    second.game.load(forged);
    expect(second.game.mapRun.getSnapshot()).toBeNull();
  });

  test('public card-target commands are versioned, idempotent, pure until confirmation, and survive save/load', () => {
    const { game, runId, view, cards } = setup(discountMap());
    const commands = createGameCommands(game);
    const initial = view();
    const target = initial.actionPreview!.preparedActions[0].legalTargetCards!.at(-1)!;
    const draft = initial.actionPreview!.draft;
    commands.setMapPreparedCardTarget(runId, 'shiroko', target, draft);
    const selected = view();
    expect(selected.actionPreview!.draft.draftVersion).toBe(draft.draftVersion + 1);
    expect(selected.actionPreview!.preparedActions[0].targetCard).toEqual(target);
    expect(selected.run.activeEncounter!.randomState).toEqual(initial.run.activeEncounter!.randomState);
    expect(selected.run.actorResources).toEqual(initial.run.actorResources);
    expect(selected.run.playerCost).toBe(initial.run.playerCost);
    commands.setMapPreparedCardTarget(runId, 'shiroko', target, selected.actionPreview!.draft);
    expect(view().run).toEqual(selected.run);
    expect(() => commands.setMapPreparedCardTarget(runId, 'shiroko', target, draft)).toThrow(/stale/);
    expect(() => commands.setMapPreparedCardTarget(runId, 'shiroko', cards().find(card => !card.controllable)!.ref,
      selected.actionPreview!.draft)).toThrow(/legal candidate/);
    expect(() => commands.setMapPreparedCardTarget(runId, 'robot', target, selected.actionPreview!.draft)).toThrow(/does not accept/);
    expect(view().run).toEqual(selected.run);
    game.load(game.save());
    expect(view().actionPreview!.preparedActions[0].targetCard).toEqual(target);
    commands.setMapPreparedCardTarget(runId, 'shiroko', null, view().actionPreview!.draft);
    const reset = view().actionPreview!.preparedActions[0];
    expect(reset).toMatchObject({ targetCard: reset.legalTargetCards![0], targetSelectionRequired: false });
    expect(reset.targetCard).not.toEqual(target);
  });

  test('a removed command card clears incoming choices in preview and replacement; a Hand card survives Swap', () => {
    const original = discountMap();
    const definition: GameplayMapDef = { ...original,
      actions: [...original.actions!, { ...original.actions![1], id: 'e' }],
      nodes: original.nodes.map(node => node.id !== 'b' ? node : { ...node, encounter: { ...node.encounter!,
        participants: [node.encounter!.participants![0], { characterId: 'serika',
          actions: ['b', 'c', 'd', 'e'].map(actionId => ({ actionId, tendencyWeight: 1 })) }],
      } }),
    };
    const { game, runId, view, cards } = setup(definition);
    const command = view().actionPreview!.playerCommandOptions.find(row => row.characterId === 'serika')!;
    game.issueMapPlayerCommand(runId, 'serika', command.action.actionId, view().actionPreview!.draft);
    const target = cards().find(card => card.zone === 'playerCommand')!.ref;
    game.setMapPreparedCardTarget(runId, 'shiroko', target, view().actionPreview!.draft);
    const before = view();
    const natural = before.actionPreview!.preparedActions[1].naturalAction!.actionId;
    expect(() => game.mapRun.previewReplacement(runId, 'serika', natural, before.actionPreview!.draft)).not.toThrow();
    expect(view().run).toEqual(before.run);
    game.clearMapActionOverride(runId, 'serika', before.actionPreview!.draft);
    const cleared = view().actionPreview!.preparedActions[0];
    expect(cleared).toMatchObject({ targetCard: cleared.legalTargetCards![0], targetSelectionRequired: false });
    const hand = cards().find(card => card.zone === 'hand' && card.owner.id === 'serika')!.ref;
    game.setMapPreparedCardTarget(runId, 'shiroko', hand, view().actionPreview!.draft);
    const alternate = view().actionPreview!.preparedActions[1].hand.find(action => action.actionId !== natural)!.actionId;
    game.swapMapPreparedAction(runId, 'serika', alternate, view().actionPreview!.draft);
    expect(view().actionPreview!.preparedActions[0].targetCard).toEqual(hand);
  });

  test('a saved card choice for another round is rejected by the Owner', () => {
    const { game, runId, view } = setup(discountMap());
    const target = view().actionPreview!.preparedActions[0].legalTargetCards![0];
    game.setMapPreparedCardTarget(runId, 'shiroko', target, view().actionPreview!.draft);
    const forged = JSON.parse(JSON.stringify(game.save()));
    forged.mapRun.run.activeEncounter.targetSelections[0].targetCard.scope.round += 1;
    game.load(forged);
    expect(game.mapRun.getSnapshot()).toBeNull();
  });

  test('changing or restoring the source card never inherits its old explicit card target', () => {
    const base = discountMap();
    const definition: GameplayMapDef = { ...base, actions: [...base.actions!, { ...base.actions![0], id: 'discount-b' }],
      nodes: base.nodes.map(node => node.id !== 'b' ? node : { ...node, encounter: { ...node.encounter!, participants: [
        { characterId: 'shiroko', actions: ['a', 'discount-b'].map(actionId => ({ actionId, tendencyWeight: 1 })) },
        node.encounter!.participants![1],
      ] } }),
    };
    const { game, runId, view } = setup(definition);
    const source = view().actionPreview!.preparedActions[0];
    const target = source.legalTargetCards!.at(-1)!;
    game.setMapPreparedCardTarget(runId, 'shiroko', target, view().actionPreview!.draft);
    const other = source.hand.find(action => action.actionId !== source.preparedAction!.actionId)!;
    game.swapMapPreparedAction(runId, 'shiroko', other.actionId, view().actionPreview!.draft);
    const swapped = view().actionPreview!.preparedActions[0];
    expect(swapped).toMatchObject({ targetCard: swapped.legalTargetCards![0], targetSelectionRequired: false });
    expect(swapped.targetCard).not.toEqual(target);
    game.clearMapActionOverride(runId, 'shiroko', view().actionPreview!.draft);
    const natural = view().actionPreview!.preparedActions[0];
    expect(natural).toMatchObject({ targetCard: natural.legalTargetCards![0], targetSelectionRequired: false });
  });

  test('public query exposes unique round-local Hand objects, not replacement offers or visual copies', () => {
    const { game, cards, view, runId } = setup();
    const before = game.mapRun.getSnapshot();
    const first = cards();
    expect(first.filter(card => card.zone === 'hand')).toHaveLength(6);
    expect(first.filter(card => card.prepared && card.controllable)).toHaveLength(2);
    expect(first.find(card => card.zone === 'enemyIntent')).toMatchObject({ controllable: false, prepared: true, actionId: null });
    expect(new Set(first.map(card => JSON.stringify(card.ref))).size).toBe(first.length);
    const command = view().actionPreview!.playerCommandOptions[0];
    game.mapRun.previewReplacement(runId, command.characterId, command.action.actionId, view().actionPreview!.draft);
    expect(cards()).toEqual(first);
    expect(game.mapRun.getSnapshot()).toEqual(before);
    expect(game.mapRun.getCards('other-run')).toEqual([]);
    expect(first.every(card => Object.isFrozen(card) && Object.isFrozen(card.ref) && Object.isFrozen(card.ref.scope) && Object.isFrozen(card.owner))).toBe(true);
    for (const card of first) {
      expect(game.mapRun.resolveCardReference(JSON.parse(JSON.stringify(card.ref)))).toEqual(card);
      expect(game.mapRun.resolveCardReference({ ...card.ref, scope: { ...card.ref.scope, mapId: 'other-map' } })).toBeNull();
      expect(game.mapRun.resolveCardReference({ ...card.ref, scope: { ...card.ref.scope, activityId: 'other-activity' } })).toBeNull();
    }
    const malformed = JSON.parse(JSON.stringify(first[0].ref));
    delete malformed.scope.activityId;
    expect(game.mapRun.resolveCardReference(malformed)).toBeNull();
    expect(game.mapRun.resolveCardReference(null as unknown as MapRunCardRef)).toBeNull();
  });

  test('Swap changes preparation without minting cards; PlayerCommand materializes only the selected command', () => {
    const { game, cards, view, runId } = setup();
    const first = cards();
    const prepared = view().actionPreview!.preparedActions[0];
    const alternate = prepared.hand.find(action => action.actionId !== prepared.preparedAction!.actionId)!;
    game.swapMapPreparedAction(runId, prepared.characterId, alternate.actionId, view().actionPreview!.draft);
    expect(cards().map(card => card.ref)).toEqual(first.map(card => card.ref));
    expect(cards().find(card => card.owner.id === prepared.characterId && card.prepared)?.actionId).toBe(alternate.actionId);
    const command = view().actionPreview!.playerCommandOptions.find(row => row.characterId === prepared.characterId)!;
    game.issueMapPlayerCommand(runId, prepared.characterId, command.action.actionId, view().actionPreview!.draft);
    const commandCard = cards().find(card => card.zone === 'playerCommand')!;
    expect(cards()).toHaveLength(first.length + 1);
    expect(commandCard).toMatchObject({ prepared: true, actionId: command.action.actionId });
    expect(cards().filter(card => card.zone === 'hand' && card.owner.id === prepared.characterId).every(card => !card.prepared)).toBe(true);
    game.clearMapActionOverride(runId, prepared.characterId, view().actionPreview!.draft);
    expect(game.mapRun.resolveCardReference(commandCard.ref)).toBeNull();
    expect(cards()).toEqual(first);
  });

  test('save/load preserves current identities; committing a new round invalidates every old reference', () => {
    const { game, cards, view, runId } = setup();
    const first = cards();
    game.load(game.save());
    expect(cards()).toEqual(first);
    const current = view();
    game.commitMapEncounterRound({ runId, requestId: 'card-round', expectedCommitVersion: current.run.commitVersion,
      draft: current.actionPreview!.draft });
    expect(view().run.activeEncounter!.round).toBe(2);
    expect(first.every(card => game.mapRun.resolveCardReference(card.ref) === null)).toBe(true);
    expect(cards().every(card => card.ref.scope.round === 2)).toBe(true);
  });
});
