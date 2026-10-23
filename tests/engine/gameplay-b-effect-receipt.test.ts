import { afterEach, describe, expect, test } from 'vitest';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { validateMapEffectCommitReceipt } from '../../src/arona-clicker/services/map/map-effect-receipt-validator';
import type { MapEffectReceiptBalances } from '../../src/arona-clicker/services/map/map-effect-receipt-validator';
import {
  createLegacyGoldenOwner, createLegacyGoldenRuntime, commitCommand, draftToken, LEGACY_GOLDEN_ITEM_ID, legacyGoldenMap,
} from './gameplay-b-effect-test-fixtures';

describe('Gameplay B E1 effect receipt validation', () => {
  const games: GameInstance[] = [];
  const map: GameplayMapDef = {
    id: 'test:map:effect-receipt-validation', name: 'Receipt validation', resumeVersion: 1,
    startNodeId: 'start', exitNodeIds: ['exit'], partyCharacterIds: ['shiroko', 'serika'], initialPlayerCost: 4,
    initialPartyHp: ['shiroko', 'serika'].map(characterId => ({ characterId, initialHp: 10, maxHp: 10 })),
    initialActorResources: [{ characterId: 'serika', resourceId: 'sCost', value: 2 }],
    initialTeamResources: [{ resourceId: 'supplies', value: 0 }],
    actions: [
      { id: 'discount', name: 'Discount', eligibleCharacterIds: ['shiroko'], target: { kind: 'card', side: 'ally' },
        effectProgram: { prepare: [{ op: 'discountSCost', amount: 2 }], resolve: [
          { op: 'counterAdd', counterId: 'uses', delta: 1 },
          { op: 'when', condition: { kind: 'all', conditions: [
            { kind: 'counter', counterId: 'uses', comparison: 'eq', value: 1 },
            { kind: 'any', conditions: [
              { kind: 'flag', flagId: 'ready', value: false },
              { kind: 'not', condition: { kind: 'counter', counterId: 'uses', comparison: 'lt', value: 1 } },
            ] },
          ] }, then: [{ op: 'flagSet', flagId: 'ready', value: true }], else: [] },
          { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 },
        ] } },
      { id: 'shot', name: 'Shot', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
        costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }],
        effectProgram: { resolve: [{ op: 'counterAdd', counterId: 'uses', delta: -1 }] } },
    ],
    nodes: [
      { id: 'start', title: 'Start' },
      { id: 'battle', title: 'Battle', encounter: {
        title: 'Battle', enemies: [{ id: 'robot', initialHp: 20, maxHp: 20 }],
        locals: { counters: [{ id: 'uses', initial: 0, min: 0, max: 3 }], flags: [{ id: 'ready', initial: false }] },
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'discount', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'shot', tendencyWeight: 1 }] },
        ],
      } },
      { id: 'exit', title: 'Exit' },
    ],
    edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
  };

  function installedReceipt() {
    const { game, runId } = createLegacyGoldenOwner(map);
    games.push(game);
    const snapshot = game.mapRun.getSnapshot();
    const encounter = snapshot?.activeEncounter;
    if (!snapshot || !encounter) throw new Error('Expected a live generated Encounter');
    const card = game.mapRun.getCards(runId).find(row => row.owner.kind === 'partyCharacter'
      && row.owner.id === 'serika' && row.actionId === 'shot')?.ref;
    if (!card) throw new Error('Expected an Owner-generated target CardRef');
    game.setMapPreparedCardTarget(runId, 'shiroko', card, {
      nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion,
    });
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-validator-positive'));
    const receipt = committed.lastEncounterCommit;
    const active = committed.activeEncounter;
    const current = active ? { ...active, partyHp: committed.partyHp } : null;
    if (!receipt) throw new Error('Expected a committed E1 Receipt');
    const currentBalances: MapEffectReceiptBalances = {
      partyActor: committed.actorResources,
      partyTeam: committed.teamResources,
      enemyActor: active?.enemyActorResources,
      enemyTeam: active?.enemyTeamResources,
    };
    return { receipt, current, currentBalances, runId };
  }

  function validate(receipt: any, runId: string, current: any, currentBalances?: MapEffectReceiptBalances | null,
    definition: GameplayMapDef = map) {
    const node = definition.nodes.find(row => row.id === receipt.nodeId);
    const encounter = receipt.activityId
      ? node?.activities?.find(activity => activity.id === receipt.activityId)?.encounter
      : node?.encounter;
    if (!encounter) throw new Error('Receipt did not resolve to an Encounter in the supplied Map');
    return validateMapEffectCommitReceipt(receipt, {
      runId, map: definition, encounter, currentEncounter: current, currentBalances,
    });
  }

  function committedContext(game: GameInstance, runId: string) {
    const committed = game.mapRun.getSnapshot();
    const receipt = committed?.lastEncounterCommit;
    if (!committed || !receipt) throw new Error('Expected a real Owner-generated E1 Receipt');
    const current = committed.activeEncounter ? { ...committed.activeEncounter, partyHp: committed.partyHp } : null;
    const currentBalances: MapEffectReceiptBalances = {
      partyActor: committed.actorResources,
      partyTeam: committed.teamResources,
      enemyActor: committed.activeEncounter?.enemyActorResources,
      enemyTeam: committed.activeEncounter?.enemyTeamResources,
    };
    return { receipt, current, currentBalances, runId };
  }

  afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

  test('accepts an installed E1 Receipt with a genuine CardRef, nested short-circuit guard, state chain, and C3 resource settlement', () => {
    const { receipt, current, currentBalances, runId } = installedReceipt();
    const validation = validate(receipt, runId, current, currentBalances);
    expect(receipt?.programVisitCount).toBe(receipt?.programVisits?.length);
    expect(receipt?.programVisits?.filter(row => row.kind === 'condition').map(row => row.path)).toEqual([
      'actions.discount.effectProgram.resolve[1].condition',
      'actions.discount.effectProgram.resolve[1].condition.conditions[0]',
      'actions.discount.effectProgram.resolve[1].condition.conditions[1]',
      'actions.discount.effectProgram.resolve[1].condition.conditions[1].conditions[0]',
    ]);
    expect(validation).toEqual({ ok: true, errors: [] });
  });

  test('requires a program header before validating a receipt', () => {
    const { receipt, current, currentBalances, runId } = installedReceipt();
    const headerless = structuredClone(receipt) as any;
    for (const field of ['programReceiptVersion', 'executionContractId', 'effectScope', 'programVisitCount', 'programVisits', 'plannedLocals', 'effectTrace']) {
      delete headerless[field];
    }
    expect(validate(headerless, runId, current, currentBalances).ok).toBe(false);
  });

  test('recomputes Damage / Heal Trace, identity, declaration path, and signed clamped deltas', () => {
    const definition = legacyGoldenMap({
      id: 'test:map:receipt-damage-heal',
      actions: [
        { id: 'strike-and-revive', name: 'Strike and Heal', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
          effectProgram: { resolve: [
            { op: 'damage' as const, target: 'primary' as const, amount: 8 },
            { op: 'heal' as const, target: 'primary' as const, amount: 4 },
          ] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'strike-and-revive', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      enemies: [{ id: 'robot', initialHp: 5, maxHp: 10 }],
    });
    const { game, runId } = createLegacyGoldenOwner(definition);
    games.push(game);
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-damage-heal'));
    const receipt = committed.lastEncounterCommit;
    if (!receipt) throw new Error('Expected a committed Damage / Heal Receipt');
    const events = receipt.effectTrace?.filter((row: any) => row.op === 'damage' || row.op === 'heal') ?? [];
    expect(events).toMatchObject([
      { op: 'damage', path: 'actions.strike-and-revive.effectProgram.resolve[0]', identity: { kind: 'enemy', id: 'robot' }, before: 5, after: 0, amount: 8, delta: -5 },
      { op: 'heal', path: 'actions.strike-and-revive.effectProgram.resolve[1]', identity: { kind: 'enemy', id: 'robot' }, before: 0, after: 0, amount: 4, delta: 0 },
    ]);
    expect(receipt.settlements[0]?.hpChanges).toEqual([
      { scope: 'enemy', enemyId: 'robot', delta: -5 },
      { scope: 'enemy', enemyId: 'robot', delta: 0 },
    ]);
    expect(validate(receipt, runId, null, null, definition)).toEqual({ ok: true, errors: [] });

    const mutations: readonly ((value: any) => void)[] = [
      value => { value.effectTrace.find((row: any) => row.op === 'damage').op = 'heal'; },
      value => { value.effectTrace.find((row: any) => row.op === 'damage').amount = 7; },
      value => { value.effectTrace.find((row: any) => row.op === 'damage').identity.id = 'robot-other'; },
      value => { value.effectTrace.find((row: any) => row.op === 'damage').path += '.else[0]'; },
      value => { value.effectTrace.find((row: any) => row.op === 'damage').before += 1; },
      value => { value.effectTrace.find((row: any) => row.op === 'damage').after += 1; },
      value => { value.effectTrace.find((row: any) => row.op === 'heal').delta = 1; },
      value => { value.settlements[0].hpChanges[1].delta = 1; },
    ];
    for (const mutate of mutations) {
      const forged = structuredClone(receipt) as any;
      mutate(forged);
      expect(validate(forged, runId, null, null, definition).ok).toBe(false);
    }
  });

  test('replays Status apply evidence and rejects a forged application projection', () => {
    const base = legacyGoldenMap({
      id: 'test:map:receipt-status-apply',
      actions: [{ id: 'apply-burn', name: 'Burn', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
        effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const, statusId: 'burn', stacks: 1, durationRounds: 2 }] } }],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'apply-burn', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      enemies: [{ id: 'robot', initialHp: 8, maxHp: 10 }],
    });
    const definition: GameplayMapDef = { ...base, statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3 }] };
    const { game, runId } = createLegacyGoldenOwner(definition);
    games.push(game);
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-status-apply'));
    const receipt = committed.lastEncounterCommit;
    const current = committed.activeEncounter ? { ...committed.activeEncounter, partyHp: committed.partyHp } : null;
    if (!receipt) throw new Error('Expected a committed Status Receipt');
    expect(receipt.effectTrace).toContainEqual(expect.objectContaining({
      op: 'statusApply', statusId: 'burn', requestedStacks: 1, beforeStacks: 0, afterStacks: 1,
      beforeRemainingRounds: null, afterRemainingRounds: 2,
    }));
    expect(validate(receipt, runId, current, null, definition)).toEqual({ ok: true, errors: [] });
    expect(validate(receipt, runId, null, null, definition)).toEqual({ ok: true, errors: [] });

    const missingStatusProjection = structuredClone(receipt) as any;
    missingStatusProjection.plannedStatuses = [];
    expect(validate(missingStatusProjection, runId, null, null, definition).ok).toBe(false);

    const forged = structuredClone(receipt) as any;
    forged.effectTrace.find((row: any) => row.op === 'statusApply').afterStacks = 2;
    expect(validate(forged, runId, current, null, definition).ok).toBe(false);
  });

  test.each([
    ['version', (receipt: any) => { receipt.programReceiptVersion = 2; }],
    ['legacy trace mode', (receipt: any) => { receipt.effectTrace[0].mode = 'legacy'; }],
    ['legacy visit mode', (receipt: any) => { receipt.programVisits[0].mode = 'legacy'; }],
    ['contract', (receipt: any) => { receipt.executionContractId = 'AG-1'; }],
    ['scope', (receipt: any) => { receipt.effectScope.mapId = 'test:other'; }],
    ['trusted parent Run identity', (receipt: any) => { receipt.effectScope.runId = 'other-run'; }],
    ['synchronized cross-Run CardRef', (receipt: any) => {
      receipt.effectScope.runId = 'other-run';
      receipt.effectTrace.find((row: any) => row.op === 'discountSCost').targetCard.scope.runId = 'other-run';
    }],
    ['visit count', (receipt: any) => { receipt.programVisitCount += 1; }],
    ['unknown visit field', (receipt: any) => { receipt.programVisits[0].extra = true; }],
    ['source identity', (receipt: any) => { receipt.programVisits[0].source.id = 'serika'; }],
    ['source key', (receipt: any) => { receipt.programVisits[0].sourceKey = 'made-up'; }],
    ['action', (receipt: any) => { receipt.programVisits[0].actionId = 'missing'; }],
    ['path', (receipt: any) => { receipt.programVisits[0].path += '.else'; }],
    ['unknown trace field', (receipt: any) => { receipt.effectTrace[0].extra = 1; }],
    ['counter operation', (receipt: any) => { receipt.effectTrace.find((row: any) => row.op === 'counterAdd').after = 2; }],
    ['counter actual delta', (receipt: any) => { receipt.effectTrace.find((row: any) => row.op === 'counterAdd').delta = 2; }],
    ['safe integer overflow', (receipt: any) => { const row = receipt.effectTrace.find((entry: any) => entry.op === 'counterAdd'); row.before = Number.MAX_SAFE_INTEGER; row.after = Number.MAX_SAFE_INTEGER; row.delta = 0; }],
    ['short circuit read', (receipt: any) => { const row = receipt.effectTrace.find((entry: any) => entry.op === 'when'); row.reads.push({ path: 'unreached', op: 'counter', identity: { kind: 'encounterLocal' }, counterId: 'uses', current: 1, comparison: 'lt', value: 1, result: false }); }],
    ['guard actual value', (receipt: any) => { const row = receipt.effectTrace.find((entry: any) => entry.op === 'when'); row.reads[0].current = 0; }],
    ['guard summary', (receipt: any) => { receipt.effectTrace.find((entry: any) => entry.op === 'when').result = false; }],
    ['wrong branch', (receipt: any) => { receipt.programVisits.splice(receipt.programVisits.findIndex((row: any) => row.path.endsWith('.then[0]')), 1); }],
    ['Counter chain', (receipt: any) => { receipt.effectTrace.filter((row: any) => row.op === 'counterAdd')[1].before = 2; }],
    ['resource intent', (receipt: any) => { receipt.effectTrace.find((row: any) => row.op === 'resourceSettlement').intentDelta = 2; }],
    ['resource actual delta', (receipt: any) => { receipt.effectTrace.find((row: any) => row.op === 'resourceSettlement').after += 1; }],
    ['resource identity', (receipt: any) => { receipt.effectTrace.find((row: any) => row.op === 'resourceSettlement').identity.side = 'enemy'; }],
    ['planned locals', (receipt: any) => { receipt.plannedLocals.counters.uses.value = 2; }],
    ['prepare amount', (receipt: any) => { receipt.effectTrace.find((row: any) => row.op === 'discountSCost').amount = 1; }],
    ['prepare CardRef', (receipt: any) => { receipt.effectTrace.find((row: any) => row.op === 'discountSCost').targetCard.id = 'forged'; }],
    ['cost projection', (receipt: any) => { receipt.settlements.find((row: any) => row.characterId === 'serika').scostCost.discount = 0; }],
    ['last local value', (receipt: any) => { receipt.plannedLocals.flags.ready = false; }],
  ])('rejects an independently damaged %s field', (_label, mutate) => {
    const { receipt, current, currentBalances, runId } = installedReceipt();
    const damaged = structuredClone(receipt) as any;
    mutate(damaged);
    expect(validate(damaged, runId, current, currentBalances).ok).toBe(false);
  });

  test('rejects a live same-Encounter end snapshot that disagrees with the receipt', () => {
    const { receipt, current, currentBalances, runId } = installedReceipt();
    const changedCurrent = structuredClone(current) as any;
    changedCurrent.locals.flags.ready = false;
    expect(validate(receipt, runId, changedCurrent, currentBalances).ok).toBe(false);
  });

  test('rejects a visit list over the E1 dynamic budget without trusting its summary count', () => {
    const { receipt, runId, current, currentBalances } = installedReceipt();
    const damaged = structuredClone(receipt) as any;
    damaged.programVisits = Array.from({ length: 4097 }, (_, index) => ({ ...damaged.programVisits[index % damaged.programVisits.length] }));
    damaged.programVisitCount = 4097;
    expect(validateMapEffectCommitReceipt(damaged, { runId, map, encounter: map.nodes[1]!.encounter! }).ok).toBe(false);
  });

  test('does not mutate an unknown receipt while rejecting it', () => {
    const { receipt, runId, current, currentBalances } = installedReceipt();
    const damaged = structuredClone(receipt) as any;
    damaged.effectTrace[0].path = 'unknown';
    const before = structuredClone(damaged);
    validateMapEffectCommitReceipt(damaged, { runId, map, encounter: map.nodes[1]!.encounter! });
    expect(damaged).toEqual(before);

    const rekeyed = structuredClone(receipt) as any;
    rekeyed.programVisits[0].sourceKey = 'unknown-source';
    rekeyed.effectTrace.find((row: any) => row.op !== 'resourceSettlement').sourceKey = 'unknown-source';
    expect(() => validate(rekeyed, runId, current, currentBalances)).not.toThrow();
    expect(validate(rekeyed, runId, current, currentBalances).ok).toBe(false);
  });

  test('accepts an Owner CardRef for an unselected Hand candidate with a null receiver', () => {
    const definition: GameplayMapDef = {
      ...map,
      actions: [...map.actions!, {
        id: 'reserve', name: 'Reserve', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
        costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }],
      }],
      nodes: map.nodes.map(node => node.id !== 'battle' ? node : {
        ...node,
        encounter: { ...node.encounter!, participants: node.encounter!.participants!.map(participant => participant.characterId !== 'serika'
          ? participant : { ...participant, actions: [...participant.actions, { actionId: 'reserve', tendencyWeight: 1 }] }) },
      }),
    };
    const { game, runId } = createLegacyGoldenOwner(definition);
    games.push(game);
    const encounter = game.mapRun.getSnapshot()?.activeEncounter;
    const serikaHand = encounter?.hands.find(row => row.characterId === 'serika')?.actionIds ?? [];
    const unselected = game.mapRun.getCards(runId).find(card => card.zone === 'hand' && card.owner.id === 'serika'
      && card.actionId !== serikaHand[0]);
    if (!unselected) throw new Error('Expected an Owner-generated unselected Hand candidate');
    game.setMapPreparedCardTarget(runId, 'shiroko', unselected.ref, draftToken(game, runId));
    game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-unselected-hand'));
    const state = committedContext(game, runId);
    expect(state.receipt.effectTrace?.find(row => row.op === 'discountSCost')?.receiver).toBeNull();
    expect(state.receipt.settlements.find(row => row.characterId === 'serika')?.scostCost)
      .toEqual({ original: 1, discount: 0, paid: 1 });
    expect(validate(state.receipt, state.runId, state.current, state.currentBalances, definition)).toEqual({ ok: true, errors: [] });

    const forged = structuredClone(state.receipt) as any;
    forged.effectTrace.find((row: any) => row.op === 'discountSCost').targetCard.id = JSON.stringify(['hand', 'partyCharacter', 'serika', 'missing-action']);
    forged.settlements[0].targetCard.id = forged.effectTrace.find((row: any) => row.op === 'discountSCost').targetCard.id;
    expect(validate(forged, state.runId, state.current, state.currentBalances, definition).ok).toBe(false);
  });

  test('validates program HP chains across Party, Ability, and Enemy sources and rejects a forged synchronized guard branch', () => {
    const mixed = legacyGoldenMap({
      id: 'test:map:receipt-mixed-hp-phases',
      partyHp: { shiroko: 5, serika: 10 },
      actions: [
        { id: 'party-program-hit', name: 'Party Program Hit', eligibleCharacterIds: ['shiroko'], target: { kind: 'self' },
          effectProgram: { resolve: [{ op: 'hpChange', target: 'source', delta: -2 }] } },
        { id: 'ability-program-heal', name: 'Ability Program Heal', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter' }, effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] } },
        { id: 'enemy-program-guard', name: 'Enemy Program Guard', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter' }, effectProgram: { resolve: [
            { op: 'when', condition: { kind: 'hpAtLeast', target: 'primary', value: 5 },
              then: [{ op: 'hpChange', target: 'primary', delta: -1 }],
              else: [{ op: 'hpChange', target: 'primary', delta: -2 }] },
          ] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'party-program-hit', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      enemies: [{ id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-program-guard', tendencyWeight: 1 }] }],
      abilityActionIds: ['ability-program-heal'],
    });
    const { game, runId } = createLegacyGoldenOwner(mixed);
    games.push(game);
    game.setMapAbilityDraft(runId, 'ability-program-heal', { kind: 'partyCharacter', characterId: 'shiroko' }, draftToken(game, runId));
    game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-mixed-hp-phase'));
    const state = committedContext(game, runId);
    expect(state.receipt.ability?.hpChanges).toEqual([{ scope: 'party', characterId: 'shiroko', delta: 2 }]);
    const read = state.receipt.effectTrace?.find(row => row.op === 'when')?.reads?.find(row => row.op === 'hpAtLeast');
    expect(read).toMatchObject({ current: 5, result: true });
    expect(state.current?.partyHp).toContainEqual({ characterId: 'shiroko', currentHp: 4 });
    expect(validate(state.receipt, state.runId, state.current, state.currentBalances, mixed)).toEqual({ ok: true, errors: [] });

    const forged = structuredClone(state.receipt) as any;
    const guard = forged.effectTrace.find((row: any) => row.op === 'when');
    guard.reads = [{ path: 'actions.enemy-program-guard.effectProgram.resolve[0].condition', op: 'hpAtLeast',
      identity: { kind: 'partyCharacter', id: 'shiroko' }, current: 4, value: 5, result: false }];
    guard.result = false;
    forged.programVisits = forged.programVisits.filter((row: any) => row.actionId !== 'enemy-program-guard'
      || !row.path.includes('.then['));
    forged.programVisits.push({ sourceKey: JSON.stringify(['enemy', 'e1']), source: { kind: 'enemy', id: 'e1' },
      actionId: 'enemy-program-guard', path: 'actions.enemy-program-guard.effectProgram.resolve[0].else[0]', kind: 'statement', mode: 'program' });
    forged.programVisitCount = forged.programVisits.length;
    const enemyChange = forged.effectTrace.find((row: any) => row.op === 'hpChange' && row.actionId === 'enemy-program-guard');
    enemyChange.path = 'actions.enemy-program-guard.effectProgram.resolve[0].else[0]';
    enemyChange.before = 4; enemyChange.after = 2; enemyChange.delta = -2;
    forged.enemyActions[0].hpChanges[0].delta = -2;
    forged.plannedLocals = { counters: {}, flags: {} };
    expect(validate(forged, state.runId, null, undefined, mixed).ok).toBe(false);
  });

  test('validates ordered Ability and Item programs and closes the shared resource chain', () => {
    const mixed = legacyGoldenMap({
      id: 'test:map:receipt-item-before-ability',
      partyHp: { shiroko: 4, serika: 10 },
      teamResources: [{ resourceId: 'supplies', value: 2 }],
      actions: [
        { id: 'party-program-resource', name: 'Party Program Resource', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] } },
        { id: 'ability-program-heal', name: 'Ability Program Heal', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [
            { op: 'heal', target: 'primary', amount: 2 },
            { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 3 },
          ] } },
        { id: 'item-program-probe', name: 'Item Program Probe', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [
            { op: 'when', condition: { kind: 'hpAtMost', target: 'primary', value: 4 },
              then: [{ op: 'hpChange', target: 'primary', delta: 1 }], else: [] },
            { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 2 },
          ] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'party-program-resource', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }],
      abilityActionIds: ['ability-program-heal'],
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-program-probe' }],
    });
    const { game, runId } = createLegacyGoldenOwner(mixed, 1);
    games.push(game);
    game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
    game.setMapAbilityDraft(runId, 'ability-program-heal', { kind: 'partyCharacter', characterId: 'shiroko' }, draftToken(game, runId));
    game.setMapItemDraft(runId, LEGACY_GOLDEN_ITEM_ID, { kind: 'partyCharacter', characterId: 'shiroko' }, draftToken(game, runId));
    game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-item-before-ability'));
    const state = committedContext(game, runId);
    const guard = state.receipt.effectTrace?.find(row => row.op === 'when');
    expect(guard?.reads).toContainEqual(expect.objectContaining({ current: 6, result: false }));
    expect(state.receipt.item?.hpChanges).toEqual([]);
    expect(state.receipt.ability?.hpChanges).toEqual([{ scope: 'party', characterId: 'shiroko', delta: 2 }]);
    expect(state.current?.partyHp).toContainEqual({ characterId: 'shiroko', currentHp: 6 });
    const resourceEvents = state.receipt.effectTrace?.filter(row => row.op === 'resourceSettlement') ?? [];
    expect(resourceEvents).toHaveLength(3);
    expect(resourceEvents.map(row => [row.before, row.after, row.delta])).toEqual([[2, 3, 1], [3, 6, 3], [6, 8, 2]]);
    expect(state.currentBalances?.partyTeam).toContainEqual({ resourceId: 'supplies', value: 8 });
    expect(validate(state.receipt, state.runId, state.current, state.currentBalances, mixed)).toEqual({ ok: true, errors: [] });

    const shifted = structuredClone(state.receipt) as any;
    const second = shifted.effectTrace.filter((row: any) => row.op === 'resourceSettlement')[2];
    second.before += 1; second.after += 1;
    expect(validate(shifted, state.runId, state.current, state.currentBalances, mixed).ok).toBe(false);
    expect(validate(state.receipt, state.runId, state.current, null, mixed).ok).toBe(false);
    const missingAccount = structuredClone(state.currentBalances) as any;
    missingAccount.partyTeam = [];
    expect(validate(state.receipt, state.runId, state.current, missingAccount, mixed).ok).toBe(false);
  });

  test('applies Enemy prepare only to a later Enemy CardRef after its own cost phase', () => {
    const definition = legacyGoldenMap({
      id: 'test:map:receipt-enemy-prepare-phase',
      actions: [
        { id: 'party-costed', name: 'Party Costed', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
        { id: 'enemy-discount', name: 'Enemy Discount', eligibleCharacterIds: [], target: { kind: 'card', side: 'ally' },
          effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: [] } },
        { id: 'enemy-costed', name: 'Enemy Costed', eligibleCharacterIds: [], target: { kind: 'none' },
          costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
      ],
      actorResources: [{ characterId: 'shiroko', resourceId: 'sCost', value: 1 }],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'party-costed', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      enemies: [
        { id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-discount', tendencyWeight: 1 }] },
        { id: 'e2', initialHp: 10, maxHp: 10, initialResources: [{ resourceId: 'sCost', value: 1 }],
          actions: [{ actionId: 'enemy-costed', tendencyWeight: 1 }] },
      ],
    });
    const { game, runId } = createLegacyGoldenOwner(definition);
    games.push(game);
    game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-enemy-prepare-phase'));
    const state = committedContext(game, runId);
    const discount = state.receipt.effectTrace?.find(row => row.op === 'discountSCost');
    expect(JSON.parse(discount?.targetCard.id ?? 'null')).toEqual(['hand', 'enemy', 'e2', 'enemy-costed']);
    expect(discount?.receiver).toEqual({ kind: 'enemy', id: 'e2' });
    expect(state.receipt.enemyActions?.[1]?.scostCost).toEqual({ original: 1, discount: 1, paid: 0 });
    expect(validate(state.receipt, state.runId, state.current, state.currentBalances, definition)).toEqual({ ok: true, errors: [] });

    const forged = structuredClone(state.receipt) as any;
    forged.enemyActions[1].scostCost.discount = 0;
    forged.enemyActions[1].scostCost.paid = 1;
    expect(validate(forged, state.runId, state.current, state.currentBalances, definition).ok).toBe(false);

    const wrongSide = structuredClone(state.receipt) as any;
    const partyCardId = JSON.stringify(['hand', 'partyCharacter', 'shiroko', 'party-costed']);
    wrongSide.enemyActions[0].targetCard.id = partyCardId;
    wrongSide.effectTrace.find((row: any) => row.op === 'discountSCost').targetCard.id = partyCardId;
    wrongSide.effectTrace.find((row: any) => row.op === 'discountSCost').receiver = { kind: 'partyCharacter', id: 'shiroko' };
    expect(validate(wrongSide, state.runId, state.current, state.currentBalances, definition).ok).toBe(false);
  });

  test('rejects malformed plannedLocals containers and root fields', () => {
    const { receipt, current, currentBalances, runId } = installedReceipt();
    for (const plannedLocals of [
      { counters: [], flags: [] },
      { counters: {}, flags: {}, hp: { partyCharacter: 3 } },
    ]) {
      const damaged = structuredClone(receipt) as any;
      damaged.plannedLocals = plannedLocals;
      expect(validate(damaged, runId, current, currentBalances).ok).toBe(false);
    }
  });

  test('rejects a program resource receipt without trusted live end balances', () => {
    const programMap = legacyGoldenMap({
      id: 'test:map:receipt-program-resource-close',
      teamResources: [{ resourceId: 'supplies', value: 3 }],
      actions: [
        { id: 'party-program-resource', name: 'Party Program Resource', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 2 }] } },
        { id: 'program-noop', name: 'Program Noop', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'party-program-resource', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }],
      abilityActionIds: ['program-noop'],
    });
    const { game, runId } = createLegacyGoldenOwner(programMap);
    games.push(game);
    game.commitMapEncounterRound(commitCommand(game, runId, 'receipt-program-resource-close'));
    const state = committedContext(game, runId);
    expect(state.receipt.effectTrace?.some(row => row.op === 'resourceSettlement')).toBe(true);
    expect(validate(state.receipt, state.runId, state.current, null, programMap).ok).toBe(false);
  });

  test('accepts a later activity round-one HP trace from the carried party balance', () => {
    const base = legacyGoldenMap({
      id: 'test:map:receipt-carried-activity-hp',
      teamResources: [{ resourceId: 'supplies', value: 2 }],
      actions: [
        { id: 'first-activity-hit', name: 'First Activity Hit', eligibleCharacterIds: ['shiroko'], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [
            { op: 'hpChange', target: 'primary', delta: -1 },
            { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 },
          ] } },
        { id: 'second-activity-hit', name: 'Second Activity Hit', eligibleCharacterIds: ['shiroko'], target: { kind: 'self' },
          effectProgram: { resolve: [
            { op: 'hpChange', target: 'source', delta: -1 },
            { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 2 },
          ] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'first-activity-hit', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
    });
    const definition: GameplayMapDef = {
      ...base,
      nodes: base.nodes.map(node => node.id !== 'battle' ? node : ({
        id: node.id,
        title: node.title,
        activities: [
          { id: 'first', encounter: { title: 'First Rest', rounds: 1, participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'first-activity-hit', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [] },
          ] } },
          { id: 'second', encounter: { title: 'Second Battle', enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'second-activity-hit', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [] },
          ] } },
        ],
      })),
    };
    const game = createLegacyGoldenRuntime(definition);
    games.push(game);
    const started = game.startMap(definition.id);
    const entered = game.moveMap(started.runId, 'battle');
    expect(entered.activeEncounter?.activityId).toBe('first');
    const commitActivity = (requestId: string) => {
      const run = game.mapRun.getSnapshot();
      const active = run?.activeEncounter;
      if (!run || !active?.activityId) throw new Error('Expected an active ordered Encounter activity');
      return game.commitMapEncounterRound({ runId: started.runId, requestId, expectedCommitVersion: run.commitVersion,
        draft: { nodeId: active.nodeId, activityId: active.activityId, round: active.round, draftVersion: active.draftVersion } });
    };
    commitActivity('receipt-carried-hp-first');
    const firstReceipt = game.mapRun.getSnapshot()?.lastEncounterCommit;
    const afterFirst = game.mapRun.getSnapshot();
    expect(afterFirst?.activeEncounter?.activityId).toBe('second');
    expect(afterFirst?.partyHp).toContainEqual({ characterId: 'shiroko', currentHp: 9 });
    commitActivity('receipt-carried-hp-second');
    const state = committedContext(game, started.runId);
    expect(state.receipt.activityId).toBe('second');
    expect(state.receipt.round).toBe(1);
    expect(state.receipt.effectTrace?.find(row => row.op === 'hpChange')).toMatchObject({ before: 9, after: 8, delta: -1 });
    expect(validate(state.receipt, state.runId, state.current, state.currentBalances, definition)).toEqual({ ok: true, errors: [] });
    expect(validate(firstReceipt, state.runId, state.current, state.currentBalances, definition)).toEqual({ ok: true, errors: [] });
  });
});
