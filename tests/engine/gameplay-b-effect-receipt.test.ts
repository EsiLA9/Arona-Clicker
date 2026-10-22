import { afterEach, describe, expect, test } from 'vitest';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { validateMapEffectCommitReceipt } from '../../src/arona-clicker/services/map-effect-receipt-validator';
import { createLegacyGoldenOwner, commitCommand } from './gameplay-b-effect-test-fixtures';

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
    const current = committed.activeEncounter;
    if (!receipt) throw new Error('Expected a committed E1 Receipt');
    return { receipt, current, runId };
  }

  afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

  test('accepts an installed E1 Receipt with a genuine CardRef, nested short-circuit guard, state chain, and C3 resource settlement', () => {
    const { receipt, current, runId } = installedReceipt();
    const validation = validateMapEffectCommitReceipt(receipt, { runId, map, encounter: map.nodes[1]!.encounter!, currentEncounter: current });
    expect(receipt?.programVisitCount).toBe(receipt?.programVisits?.length);
    expect(receipt?.programVisits?.filter(row => row.kind === 'condition').map(row => row.path)).toEqual([
      'actions.discount.effectProgram.resolve[1].condition',
      'actions.discount.effectProgram.resolve[1].condition.conditions[0]',
      'actions.discount.effectProgram.resolve[1].condition.conditions[1]',
      'actions.discount.effectProgram.resolve[1].condition.conditions[1].conditions[0]',
    ]);
    expect(validation).toEqual({ ok: true, errors: [] });
  });

  test.each([
    ['version', (receipt: any) => { receipt.programReceiptVersion = 2; }],
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
    const { receipt, current, runId } = installedReceipt();
    const damaged = structuredClone(receipt) as any;
    mutate(damaged);
    expect(validateMapEffectCommitReceipt(damaged, { runId, map, encounter: map.nodes[1]!.encounter!, currentEncounter: current }).ok).toBe(false);
  });

  test('rejects a live same-Encounter end snapshot that disagrees with the receipt', () => {
    const { receipt, current, runId } = installedReceipt();
    const changedCurrent = structuredClone(current) as any;
    changedCurrent.locals.flags.ready = false;
    expect(validateMapEffectCommitReceipt(receipt, { runId, map, encounter: map.nodes[1]!.encounter!, currentEncounter: changedCurrent }).ok).toBe(false);
  });

  test('rejects a visit list over the E1 dynamic budget without trusting its summary count', () => {
    const { receipt, runId } = installedReceipt();
    const damaged = structuredClone(receipt) as any;
    damaged.programVisits = Array.from({ length: 4097 }, (_, index) => ({ ...damaged.programVisits[index % damaged.programVisits.length] }));
    damaged.programVisitCount = 4097;
    expect(validateMapEffectCommitReceipt(damaged, { runId, map, encounter: map.nodes[1]!.encounter! }).ok).toBe(false);
  });

  test('does not mutate an unknown receipt while rejecting it', () => {
    const { receipt, runId } = installedReceipt();
    const damaged = structuredClone(receipt) as any;
    damaged.effectTrace[0].path = 'unknown';
    const before = structuredClone(damaged);
    validateMapEffectCommitReceipt(damaged, { runId, map, encounter: map.nodes[1]!.encounter! });
    expect(damaged).toEqual(before);
  });
});
