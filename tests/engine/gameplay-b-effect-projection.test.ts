import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import type { GameplayMapActionDef } from '../../src/data-services/contracts/gameplay-map';
import { normalizeMapActionEffects } from '../../src/data-services/normalization/gameplay-map-effect-program';
import { summarizeMapActionEffects } from '../../src/arona-clicker/services/map/map-effect-summary';
import { baseDatapack } from '../../src/data/test-datapack';

const sourceItemId: string = (() => {
  const itemId = baseDatapack.items?.find(item => item.type === 'consumable')?.id;
  if (!itemId) throw new Error('Base Datapack test fixture has no Consumable Item');
  return itemId;
})();

const map: GameplayMapDef = {
  id: gameplayBMapDatapack.maps![0]!.id,
  name: 'Declared effect projection',
  resumeVersion: 1,
  startNodeId: 'a',
  exitNodeIds: ['c'],
  partyCharacterIds: ['shiroko', 'serika'],
  initialPlayerCost: 4,
  initialPartyHp: ['shiroko', 'serika'].map(characterId => ({ characterId, initialHp: 20, maxHp: 20 })),
  initialActorResources: ['shiroko', 'serika'].flatMap(characterId => [
    { characterId, resourceId: 'focus', value: 0 },
    { characterId, resourceId: 'sCost', value: 2 },
  ]),
  initialTeamResources: [{ resourceId: 'supplies', value: 0 }],
  statuses: [{ id: 'burn', name: 'Burning', kind: 'burn', hpPerStack: 1, maxStacks: 3 }],
  actions: [
    {
      id: 'program', name: 'Program', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
      costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }],
      effectProgram: { resolve: [
        { op: 'hpChange', target: 'source', delta: -1 },
        { op: 'hpChange', target: 'primary', delta: -2 },
        { op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 },
        { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 2 },
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 3 },
        { op: 'when', condition: { kind: 'hpAtMost', target: 'primary', value: 10 },
          then: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }, { op: 'flagSet', flagId: 'clue', value: true }],
          else: [{ op: 'counterAdd', counterId: 'trust', delta: -1 }, { op: 'flagSet', flagId: 'clue', value: false }] },
      ] },
    },
    {
      id: 'discount', name: 'Discount', eligibleCharacterIds: ['serika'], target: { kind: 'card', side: 'ally' },
      effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: [] },
    },
    {
      id: 'enemy-program', name: 'Enemy Program', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] },
    },
    {
      id: 'ability-program', name: 'Ability Program', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [
        { op: 'hpChange', target: 'primary', delta: 1 },
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 },
        { op: 'counterAdd', counterId: 'trust', delta: 1 },
        { op: 'flagSet', flagId: 'clue', value: true },
      ] },
    },
    {
      id: 'item-program', name: 'Item Program', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'flagSet', flagId: 'itemUsed', value: true }] },
    },
  ],
  nodes: [
    { id: 'a', title: 'Start' },
    { id: 'b', title: 'Encounter', encounter: {
      title: 'Projection encounter',
      enemies: [{ id: 'robot', initialHp: 20, maxHp: 20,
        initialResources: [{ resourceId: 'focus', value: 0 }],
        actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] }],
      initialEnemyTeamResources: [{ resourceId: 'supplies', value: 0 }],
      locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 3 }], flags: [{ id: 'clue', initial: false }, { id: 'itemUsed', initial: false }] },
      abilityActionIds: ['ability-program'],
      itemActions: [{ itemId: sourceItemId, actionId: 'item-program' }],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'program', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'discount', tendencyWeight: 1 }] },
      ],
    } },
    { id: 'c', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
};

function multiActivityMap(): GameplayMapDef {
  const encounter = (title: string) => ({
    title,
    locals: { counters: [{ id: 'trust', initial: 0, min: 0, max: 3 }], flags: [] },
    completion: {
      kind: 'condition' as const,
      label: 'Trust reached',
      condition: { kind: 'counter' as const, counterId: 'trust', comparison: 'gte' as const, value: 1 },
    },
    participants: ['shiroko', 'serika'].map(characterId => ({
      characterId,
      actions: [{ actionId: 'trust-step', tendencyWeight: 1 }],
    })),
  });
  return {
    ...map,
    actions: [{
      id: 'trust-step', name: 'Trust Step', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }] },
    }],
    nodes: map.nodes.map(node => node.id !== 'b' ? node : {
      id: node.id,
      title: node.title,
      activities: [
        { id: 'first', title: 'First Talk', encounter: encounter('First Talk') },
        { id: 'second', title: 'Second Talk', encounter: encounter('Second Talk') },
      ],
    }),
  };
}

function commandProjectionMap(): GameplayMapDef {
  const commandIds = ['command-a', 'command-b', 'command-c', 'command-d'];
  return {
    ...map,
    actions: [...(map.actions ?? []), ...commandIds.map(id => ({
      id, name: id, eligibleCharacterIds: ['serika'], target: { kind: 'partyCharacter' as const },
      effectProgram: { resolve: [{ op: 'hpChange' as const, target: 'primary' as const, delta: -1 }] },
    }))],
    nodes: map.nodes.map(node => node.id !== 'b' || !node.encounter ? node : ({
      ...node,
      encounter: {
        ...node.encounter,
        participants: (node.encounter.participants ?? []).map(participant => participant.characterId !== 'serika' ? participant : ({
          ...participant,
          actions: [...participant.actions, ...commandIds.map(actionId => ({ actionId, tendencyWeight: 1 }))],
        })),
      },
    })),
  };
}

function statusProjectionMap(): GameplayMapDef {
  const statusActionId = 'apply-burn';
  return {
    ...map,
    actions: [...(map.actions ?? []), {
      id: statusActionId, name: 'Apply Burn', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const,
        statusId: 'burn', stacks: 2, durationRounds: 3 }] },
    }],
    nodes: map.nodes.map(node => node.id !== 'b' || !node.encounter ? node : ({
      ...node,
      encounter: { ...node.encounter, participants: (node.encounter.participants ?? []).map(participant =>
        participant.characterId === 'shiroko'
          ? { ...participant, actions: [{ actionId: statusActionId, tendencyWeight: 1 }] }
          : { ...participant, actions: [] }) },
    })),
  };
}

describe('Gameplay B declared effect projection', () => {
  const games: GameInstance[] = [];
  function setup(definition: GameplayMapDef = map, withItem = false) {
    const datapack = {
      ...gameplayBMapDatapack,
      spots: gameplayBMapDatapack.spots.map(spot => ({
        ...spot,
        functionalities: (spot.functionalities ?? []).filter(functionality =>
          functionality.kind !== 'mapEntry' || functionality.mapId === map.id),
      })),
      maps: [definition],
    };
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack, datapack], { enterDefaultInit: false });
    for (const characterId of definition.partyCharacterIds) {
      const variant = game.rosterSystem.getAllVariants().find(row => row.proto === characterId)!;
      game.mutations.acquireCharacter(variant.id, 'story');
    }
    if (withItem) game.mutations.addItem(sourceItemId, 1, 3);
    const run = game.startMap(definition.id);
    expect(game.mapRun.getCards(run.runId)).toEqual([]);
    game.moveMap(run.runId, 'b');
    const view = () => {
      const current = game.mapRun.getWorkspaceView(run.runId);
      if (current?.kind !== 'active' || !current.actionPreview) throw new Error('No active Owner preview');
      return current;
    };
    return { game, runId: run.runId, view, cards: () => game.mapRun.getCards(run.runId) };
  }
  afterEach(() => { for (const game of games.splice(0)) game.dispose(); });

  test('keeps loop, additionalActor, and MapRun Fact declarations safe for existing projections', () => {
    const scope = { runId: 'run', mapId: map.id, nodeId: 'b', activityId: null, round: 1 };
    const context = { scope, source: null, primary: null };
    const cases = [
      { op: 'forTargets', targetSet: { side: 'enemy', order: 'definition' }, body: [
        { op: 'resourceChange', account: 'loopTargetActor', resourceId: 'focus', delta: 1 },
      ] },
      { op: 'resourceChange', account: 'additionalActor', resourceId: 'focus', delta: 1 },
      { op: 'mapRunCounterAdd', counterId: 'steps', delta: 1 },
      { op: 'mapRunFlagSet', flagId: 'open', value: true },
    ] as const;
    for (const [index, statement] of cases.entries()) {
      const action = {
        id: `unsupported-${index}`, name: 'Unsupported', eligibleCharacterIds: [], target: { kind: 'none' },
        effectProgram: { resolve: [statement] },
      } as unknown as GameplayMapActionDef;
      const effects = normalizeMapActionEffects(action, `actions.unsupported-${index}`);
      expect(summarizeMapActionEffects(effects, context)).toEqual([]);
    }
  });

  test('projects source, primary, both conditional paths, Encounter facts, and enemy-side Team declarations', () => {
    const { game, view } = setup();
    const current = view();
    const before = game.mapRun.getSnapshot();
    const rng = current.run.activeEncounter!.randomState;
    const player = current.relations.find(row => row.source.kind === 'preparedAction' && row.source.id === 'shiroko')!;
    expect(player.source.performer).toEqual({ scope: player.scope, kind: 'partyCharacter', id: 'shiroko' });
    const declarations = player.declaredEffects!;
    expect(declarations.find(effect => effect.kind === 'hp' && effect.target === 'source')).toMatchObject({
      recipient: { kind: 'partyCharacter', id: 'shiroko' }, delta: -1,
    });
    expect(declarations.find(effect => effect.kind === 'hp' && effect.target === 'primary')).toMatchObject({
      recipient: { kind: 'enemy', id: 'robot' }, delta: -2,
    });
    expect(declarations.find(effect => effect.kind === 'resource' && effect.account === 'sourceActor')).toMatchObject({
      recipient: { kind: 'partyCharacter', id: 'shiroko' },
    });
    expect(declarations.find(effect => effect.kind === 'resource' && effect.account === 'primaryActor')).toMatchObject({
      recipient: { kind: 'enemy', id: 'robot' },
    });
    expect(declarations.find(effect => effect.kind === 'resource' && effect.account === 'sourceTeam')).toMatchObject({
      recipient: { kind: 'team', side: 'party', scope: player.scope },
    });
    expect(declarations.find(effect => effect.kind === 'counter')).toMatchObject({ counterId: 'trust', recipient: null });
    expect(declarations.find(effect => effect.kind === 'flag')).toMatchObject({ flagId: 'clue', value: true, recipient: null });
    const conditional = player.declaredEffects!.filter(effect => effect.certainty === 'conditional');
    expect(conditional).toHaveLength(4);
    expect(conditional.map(effect => effect.branches[0]?.branch)).toEqual(['then', 'then', 'else', 'else']);
    expect(conditional.every(effect => effect.branches[0]?.whenPath === 'actions.program.effectProgram.resolve[5]'
      && effect.branches[0].condition.kind === 'hpAtMost')).toBe(true);
    expect(conditional.every(effect => effect.path.includes('.then[') || effect.path.includes('.else['))).toBe(true);

    const enemy = current.relations.find(row => row.source.kind === 'enemy')!;
    expect(enemy.declaredEffects).toMatchObject([
      { kind: 'resource', account: 'sourceTeam', recipient: { kind: 'team', side: 'enemy', scope: enemy.scope } },
    ]);
    expect(game.mapRun.getSnapshot()).toEqual(before);
    expect(view().run.activeEncounter!.randomState).toEqual(rng);
  });

  test('projects statusApply as a declaration with selected unit and original path', () => {
    const { view } = setup(statusProjectionMap());
    const relation = view().relations.find(row => row.source.kind === 'preparedAction' && row.source.id === 'shiroko')!;
    expect(relation.declaredEffects).toContainEqual(expect.objectContaining({
      kind: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 3,
      path: 'actions.apply-burn.effectProgram.resolve[0]', recipient: expect.objectContaining({ kind: 'enemy', id: 'robot' }),
      declaration: 'declared', certainty: 'unconditional', branches: [],
    }));
  });

  test('keeps actorless Ability source-free and leaves its unresolved primary recipient null', () => {
    const { game, runId, view } = setup();
    let current = view();
    game.setMapAbilityDraft(runId, 'ability-program', null, current.actionPreview!.draft);
    current = view();
    const ability = current.relations.find(row => row.source.kind === 'ability')!;
    expect(ability).toMatchObject({ source: { performer: null }, selectedTarget: null, targetState: 'pending' });
    expect(ability.declaredEffects!.find(effect => effect.kind === 'hp')).toMatchObject({ target: 'primary', recipient: null });
    expect(ability.declaredEffects!.find(effect => effect.kind === 'resource')).toMatchObject({
      account: 'sourceTeam', recipient: { kind: 'team', side: 'party' },
    });
    expect(ability.declaredEffects!.find(effect => effect.kind === 'counter')).toMatchObject({ recipient: null });
    expect(ability.declaredEffects!.find(effect => effect.kind === 'flag')).toMatchObject({ recipient: null });
    const before = game.mapRun.getSnapshot();
    const rng = current.run.activeEncounter!.randomState;
    expect(ability.declaredEffects!.every(effect => effect.kind !== 'hp' || effect.recipient === null)).toBe(true);
    expect(game.mapRun.getSnapshot()).toEqual(before);
    expect(view().run.activeEncounter!.randomState).toEqual(rng);
  });

  test('uses an Owner-issued CardRef for prepare discounts', () => {
    const { view, cards } = setup();
    const current = view();
    const prepared = current.actionPreview!.preparedActions.find(row => row.characterId === 'serika')!;
    const card = prepared.targetCard;
    expect(card?.kind).toBe('card');
    expect(cards().some(instance => JSON.stringify(instance.ref) === JSON.stringify(card))).toBe(true);
    const relation = current.relations.find(row => row.source.kind === 'preparedAction' && row.source.id === 'serika')!;
    expect(relation.selectedTarget).toEqual(card);
    expect(relation.declaredEffects).toEqual([
      expect.objectContaining({ kind: 'cardCost', resourceId: 'sCost', amount: -1, certainty: 'unconditional', recipient: card,
        path: 'actions.discount.effectProgram.prepare[0]' }),
    ]);

  });

  test('projects Owner preview and persisted E1 receipt through repeatable read-only queries', () => {
    const { game, runId, view } = setup(map, true);
    let current = view();
    const preview = current.actionPreview!;
    const partyRelation = current.relations.find(row => row.source.kind === 'preparedAction' && row.source.id === 'shiroko')!;
    const partyPrepared = preview.preparedActions.find(row => row.characterId === 'shiroko')!;
    expect(partyPrepared.preparedAction?.declaredEffects).toEqual(partyRelation.declaredEffects);
    const handProgram = partyPrepared.hand.find(action => action.actionId === 'program')!;
    expect(handProgram.declaredEffects?.find(effect => effect.kind === 'hp' && effect.target === 'source'))
      .toMatchObject({ recipient: { kind: 'partyCharacter', id: 'shiroko' } });
    expect(handProgram.declaredEffects?.find(effect => effect.kind === 'hp' && effect.target === 'primary'))
      .toMatchObject({ recipient: null });
    expect(partyPrepared.preparedAction?.declaredEffects?.filter(effect => effect.certainty === 'conditional'))
      .toHaveLength(4);
    const discountPrepared = preview.preparedActions.find(row => row.characterId === 'serika')!;
    expect(discountPrepared.playerCost).toBe(0);
    expect(discountPrepared.preparedAction?.declaredEffects).toMatchObject([
      { kind: 'cardCost', resourceId: 'sCost', recipient: discountPrepared.targetCard },
    ]);
    const enemyPrepared = preview.preparedEnemyActions.find(row => row.enemyId === 'robot')!;
    const enemyRelation = current.relations.find(row => row.source.kind === 'enemy')!;
    expect(enemyPrepared.naturalAction?.declaredEffects).toEqual(enemyRelation.declaredEffects);
    expect(preview.commitPreview).toMatchObject({
      programReceiptVersion: 1,
      executionContractId: 'E1-COMPAT-1',
      effectScope: { runId, mapId: map.id, nodeId: 'b', activityId: null, round: 1 },
      plannedLocals: { counters: { trust: { value: 0, min: 0, max: 3 } }, flags: { clue: false, itemUsed: false } },
    });
    expect(preview.commitPreview.settlements?.find(row => row.characterId === 'shiroko')?.action?.declaredEffects)
      .toEqual(partyRelation.declaredEffects);
    const abilityOption = current.sourcePreview?.abilityOptions.find(row => row.actionId === 'ability-program');
    const itemOption = current.sourcePreview?.itemOptions.find(row => row.actionId === 'item-program');
    expect(abilityOption?.declaredEffects?.map(effect => effect.kind)).toEqual(['hp', 'resource', 'counter', 'flag']);
    expect(itemOption?.declaredEffects).toMatchObject([{ kind: 'flag', flagId: 'itemUsed', value: true }]);

    game.setMapAbilityDraft(runId, 'ability-program', { kind: 'partyCharacter', characterId: 'serika' }, preview.draft);
    current = view();
    game.setMapItemDraft(runId, sourceItemId, { kind: 'partyCharacter', characterId: 'serika' }, current.actionPreview!.draft);
    current = view();
    const readyPreview = current.actionPreview!.commitPreview;
    expect(readyPreview.effectTrace?.some(entry => entry.source?.kind === 'ability')).toBe(true);
    expect(readyPreview.effectTrace?.some(entry => entry.source?.kind === 'item')).toBe(true);
    expect(readyPreview.effectTrace?.find(entry => entry.op === 'when' && entry.actionId === 'program'))
      .toMatchObject({ result: false });
    expect(readyPreview.effectTrace).toContainEqual(expect.objectContaining({
      op: 'counterAdd', actionId: 'program', before: 0, after: 0, delta: 0,
    }));
    expect(readyPreview.effectTrace).toContainEqual(expect.objectContaining({
      op: 'hpChange', before: 20, after: 20, delta: 0,
      source: { kind: 'ability', actionId: 'ability-program' },
    }));
    expect(readyPreview.effectTrace?.filter(entry => entry.op === 'flagSet' && entry.flagId === 'clue')
      .map(entry => entry.op === 'flagSet' ? [entry.before, entry.after] : null)).toEqual([[false, false], [false, true]]);
    expect(readyPreview.plannedLocals?.flags.clue).toBe(true);

    const stateBeforeReads = game.mapRun.getSnapshot();
    const cardsBeforeReads = game.mapRun.getCards(runId);
    const inventoryBeforeReads = structuredClone(game.state.inventory);
    const handBeforeReads = stateBeforeReads?.activeEncounter?.hands;
    const rngBeforeReads = stateBeforeReads?.activeEncounter?.randomState;
    const draftBeforeReads = stateBeforeReads?.activeEncounter?.draftVersion;
    expect(view().actionPreview).toEqual(view().actionPreview);
    expect(game.mapRun.getSnapshot()).toEqual(stateBeforeReads);
    expect(game.mapRun.getCards(runId)).toEqual(cardsBeforeReads);
    expect(game.state.inventory).toEqual(inventoryBeforeReads);
    expect(game.mapRun.getSnapshot()?.activeEncounter?.hands).toEqual(handBeforeReads);
    expect(game.mapRun.getSnapshot()?.activeEncounter?.randomState).toEqual(rngBeforeReads);
    expect(game.mapRun.getSnapshot()?.activeEncounter?.draftVersion).toBe(draftBeforeReads);

    const committed = game.commitMapEncounterRound({
      runId,
      requestId: 'u15-readmodel-e1',
      expectedCommitVersion: current.run.commitVersion,
      draft: current.actionPreview!.draft,
    });
    const receipt = view().actionPreview!.recentCommit!;
    expect(receipt.programReceiptVersion).toBe(1);
    expect(receipt.effectScope).toEqual(readyPreview.effectScope);
    expect(receipt.plannedLocals).toEqual(readyPreview.plannedLocals);
    expect(receipt.effectTrace).toEqual(readyPreview.effectTrace);
    expect(receipt.programVisits).toEqual(readyPreview.programVisits);
    expect(receipt.item?.resourceChanges).toEqual(committed.lastEncounterCommit?.item?.resourceChanges);
    expect(receipt.ability?.resourceChanges).toEqual(committed.lastEncounterCommit?.ability?.resourceChanges);
    expect(receipt.settlements).toEqual(expect.arrayContaining([...(readyPreview.settlements ?? [])]));

    const stateAfterCommit = game.mapRun.getSnapshot();
    const cardsAfterCommit = game.mapRun.getCards(runId);
    const inventoryAfterCommit = structuredClone(game.state.inventory);
    view();
    view();
    expect(game.mapRun.getSnapshot()).toEqual(stateAfterCommit);
    expect(game.mapRun.getCards(runId)).toEqual(cardsAfterCommit);
    expect(game.state.inventory).toEqual(inventoryAfterCommit);
  });

  test('projects E1 PlayerCommand choices without charging PlayerCost during reads or drafting', () => {
    const definition = commandProjectionMap();
    const { game, runId, view } = setup(definition);
    let current = view();
    const command = current.actionPreview!.playerCommandOptions.find(row => row.characterId === 'serika'
      && row.action.actionId.startsWith('command-'));
    expect(command).toBeDefined();
    if (!command) throw new Error('Expected an E1 PlayerCommand candidate outside the active Hand');
    expect(command.action.declaredEffects).toContainEqual(expect.objectContaining({
      kind: 'hp', target: 'primary', recipient: null, delta: -1,
    }));
    const playerCostBefore = current.run.playerCost;
    game.issueMapPlayerCommand(runId, 'serika', command.action.actionId, current.actionPreview!.draft);
    current = view();
    const prepared = current.actionPreview!.preparedActions.find(row => row.characterId === 'serika')!;
    expect(prepared.preparedAction?.actionId).toBe(command.action.actionId);
    expect(prepared.preparedAction?.declaredEffects).toContainEqual(expect.objectContaining({
      kind: 'hp', target: 'primary', recipient: expect.objectContaining({
        kind: 'partyCharacter', id: prepared.targetCharacterId,
      }), delta: -1,
    }));
    expect(prepared.playerCost).toBe(1);
    expect(current.actionPreview!.commitPreview.playerCostRequired).toBe(1);
    expect(current.run.playerCost).toBe(playerCostBefore);
    expect(game.mapRun.getSnapshot()?.playerCost).toBe(playerCostBefore);
  });

  test('keeps the previous Activity Receipt visible with its original scope', () => {
    const definition = multiActivityMap();
    const { game, runId, view } = setup(definition);
    const current = view();
    expect(current.currentEncounter?.completion).toMatchObject({
      kind: 'condition',
      label: 'Trust reached',
      condition: { kind: 'counter', counterId: 'trust', comparison: 'gte', value: 1 },
      locals: { counters: { trust: { value: 0, min: 0, max: 3 } } },
    });
    const completed = game.commitMapEncounterRound({
      runId,
      requestId: 'u15-cross-activity',
      expectedCommitVersion: current.run.commitVersion,
      draft: current.actionPreview!.draft,
    });
    expect(completed.activeActivity?.activityId).toBe('second');
    const secondActivityView = view();
    expect(secondActivityView.actionPreview?.recentCommit).toMatchObject({
      nodeId: 'b', activityId: 'first',
      effectScope: { nodeId: 'b', activityId: 'first' },
    });
    expect(secondActivityView.currentEncounter?.activityId).toBe('second');
    expect(secondActivityView.currentEncounter?.completion).toMatchObject({
      kind: 'condition', locals: { counters: { trust: { value: 0 } } },
    });
  });
});
