import { describe, expect, test } from 'vitest';
import type { MapContentResolver } from '../../src/arona-clicker/contracts/map/map-content-resolver';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createMapEffectRandomState } from '../../src/arona-clicker/services/map/gameplay-b-effect-rng';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';

const party = [{ characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' }] as const;
const definition = {
  id: 'test:map:ag1-restore', name: 'AG-1 Restore', resumeVersion: 5, executionContractId: 'AG-1',
  startNodeId: 'start', exitNodeIds: ['exit'], partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  partyAgility: [{ characterId: 'serika', agility: 8 }], initialPlayerCost: 1,
  mapRunFacts: {
    counters: [{ id: 'run-step', initial: 2, min: 0, max: 8 }],
    flags: [{ id: 'route-open', initial: false }],
  },
  actions: [
    { id: 'spend', name: 'Spend', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
      target: { kind: 'none' }, costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }] },
    { id: 'refill', name: 'Refill', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 },
      target: { kind: 'none' }, costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] } },
  ],
  initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
  nodes: [
    { id: 'start', title: 'Start' },
    { id: 'battle', title: 'Battle', encounter: { title: 'Battle', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'spend', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'refill', tendencyWeight: 1 }] },
    ] } },
    { id: 'exit', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
} satisfies GameplayMapDef;

const randomDamageEffect = {
  op: 'damage' as const,
  target: { set: { side: 'enemy' as const, order: 'random' as const, limit: 1 } },
  amount: 1,
};
const randomTargetDefinition: GameplayMapDef = {
  ...definition,
  id: 'test:map:ag1-restore-effect-random',
  partyAgility: [{ characterId: 'shiroko', agility: 8 }],
  initialTeamResources: [],
  actions: [
    { id: 'first-random', name: 'First Random', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
      target: { kind: 'none' }, effectProgram: { resolve: [randomDamageEffect] } },
    { id: 'second-random', name: 'Second Random', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 },
      target: { kind: 'none' }, effectProgram: { resolve: [randomDamageEffect] } },
  ],
  nodes: [
    { id: 'start', title: 'Start' },
    { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
      { id: 'e1', initialHp: 10, maxHp: 10 }, { id: 'e2', initialHp: 10, maxHp: 10 },
      { id: 'e3', initialHp: 10, maxHp: 10 }, { id: 'e4', initialHp: 10, maxHp: 10 },
    ], participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'first-random', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'second-random', tendencyWeight: 1 }] },
    ] } },
    { id: 'exit', title: 'Exit' },
  ],
} satisfies GameplayMapDef;

const orderedFactsDefinition = {
  ...definition,
  id: 'test:map:ag1-restore-owner-facts-balances',
  partyAgility: [{ characterId: 'shiroko', agility: 8 }],
  initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
  actions: [
    { id: 'first', name: 'First', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
      target: { kind: 'enemy' }, costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [
        { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 2 },
        { op: 'damage', target: 'primary', amount: { kind: 'resourceBalance', account: 'sourceTeam', resourceId: 'supplies' } },
        { op: 'mapRunCounterAdd', counterId: 'run-step', delta: 1 },
        { op: 'mapRunFlagSet', flagId: 'route-open', value: true },
      ] } },
    { id: 'later', name: 'Later', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 },
      target: { kind: 'enemy' }, costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [
        { op: 'damage', target: 'primary', amount: { kind: 'resourceBalance', account: 'sourceTeam', resourceId: 'supplies' } },
        { op: 'when', condition: { kind: 'mapRunFlag', flagId: 'route-open', value: true }, then: [
          { op: 'damage', target: 'primary', amount: { kind: 'mapRunCounter', counterId: 'run-step' } },
        ] },
      ] } },
  ],
  nodes: [
    { id: 'start', title: 'Start' },
    { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'first', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'later', tendencyWeight: 1 }] },
    ] } },
    { id: 'exit', title: 'Exit' },
  ],
} satisfies GameplayMapDef;

const shieldDefinition: GameplayMapDef = {
  ...definition,
  id: 'test:map:ag1-restore-shield-v6',
  resumeVersion: 1,
  mapRunFacts: undefined,
  initialTeamResources: [{ resourceId: 'supplies', value: 2 }],
  actions: [
    { id: 'grant-shield', name: 'Grant Shield', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
      target: { kind: 'self' }, costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [
        { op: 'shieldAdd', target: 'source', amount: 3 },
        { op: 'damage', target: 'primary', amount: 1 },
      ] } },
    { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 }, target: { kind: 'none' } },
  ],
  nodes: [
    { id: 'start', title: 'Start' },
    { id: 'battle', title: 'Battle', encounter: { title: 'Battle', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'grant-shield', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
    ] } },
    { id: 'exit', title: 'Exit' },
  ],
} satisfies GameplayMapDef;

function makeService(mapDefinition: GameplayMapDef = definition) {
  const resolver: MapContentResolver = { resolve: id => id === mapDefinition.id ? mapDefinition : null };
  return new MapRunService(resolver, id => id === 'Shiroko' ? 'shiroko' : id === 'Serika' ? 'serika' : null);
}
function draftToken(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

function committedCheckpoint(mapDefinition: GameplayMapDef = definition, commandAction: string | null = 'refill') {
  const source = makeService(mapDefinition);
  const started = source.start(mapDefinition.id, party);
  source.move(started.runId, 'battle');
  const current = source.getSnapshot()!;
  const active = current.activeEncounter!;
  if (commandAction) source.issuePlayerCommand(started.runId, 'serika', commandAction, draftToken(active));
  const commitStart = source.getSnapshot()!;
  source.commitEncounterRound({ runId: started.runId, requestId: 'restore-test',
    expectedCommitVersion: commitStart.commitVersion, draft: draftToken(commitStart.activeEncounter!) });
  return source.createSaveSnapshot()!;
}

function committedShieldCheckpoint() {
  const source = makeService(shieldDefinition);
  const started = source.start(shieldDefinition.id, party);
  source.move(started.runId, 'battle');
  const current = source.getSnapshot()!;
  source.commitEncounterRound({ runId: started.runId, requestId: 'shield-restore-v6',
    expectedCommitVersion: current.commitVersion, draft: draftToken(current.activeEncounter!) });
  return source.createSaveSnapshot()!;
}

function committedSecondaryCheckpoint() {
  const action = { id: 'secondary-resource', name: 'Secondary Resource', eligibleCharacterIds: ['shiroko'],
    agility: { base: 0, max: 8 }, target: { kind: 'enemy' as const }, additionalTarget: 'partyCharacter' as const,
    effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'additionalActor' as const, resourceId: 'focus', delta: 1 }] } };
  const map: GameplayMapDef = { ...definition, id: 'test:map:ag1-restore-secondary', resumeVersion: 5,
    executionContractId: 'AG-1', partyAgility: [], initialActorResources: [
      { characterId: 'shiroko', resourceId: 'focus', value: 0 },
      { characterId: 'serika', resourceId: 'focus', value: 0 },
    ], initialTeamResources: [], actions: [action], nodes: [
      { id: 'start', title: 'Start' },
      { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }],
        participants: [{ characterId: 'shiroko', actions: [{ actionId: action.id, tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [] }] } },
      { id: 'exit', title: 'Exit' },
    ], edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }] };
  const source = makeService(map);
  const started = source.start(map.id, party);
  source.move(started.runId, 'battle');
  const active = source.getSnapshot()!.activeEncounter!;
  const selected = source.setPreparedAdditionalTarget(started.runId, 'shiroko',
    { kind: 'partyCharacter', characterId: 'serika' }, draftToken(active));
  const ready = source.getSnapshot()!;
  source.commitEncounterRound({ runId: started.runId, requestId: 'restore-secondary',
    expectedCommitVersion: ready.commitVersion, draft: draftToken(selected.activeEncounter!) });
  return { map, checkpoint: source.createSaveSnapshot()! };
}

describe('AG-1 MapRun receipt Restore', () => {
  test('replays scheduler v6 Shield receipts and rejects changed evidence or saved ledger', () => {
    const checkpoint = committedShieldCheckpoint();
    expect(checkpoint.run.lastEncounterCommit).toMatchObject({
      schedulerFormatVersion: 6,
      schedulerStartSnapshot: { encounter: { shields: {} } },
      shieldReceiptVersion: 1,
      shieldStart: {},
      plannedShields: { 'partyCharacter:shiroko': 2 },
      shieldTrace: [
        { op: 'shieldAdd', path: 'actions.grant-shield.effectProgram.resolve[0]', added: 3 },
        { op: 'damage', path: 'actions.grant-shield.effectProgram.resolve[1]', absorbed: 1, remainingDamage: 0 },
      ],
    });
    expect(checkpoint.run.activeEncounter?.shields).toEqual({ 'partyCharacter:shiroko': 2 });
    const restored = makeService(shieldDefinition);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()).toEqual(checkpoint.run);

    const mutations: Array<[string, (value: any) => void]> = [
      ['scheduler version', value => { value.run.lastEncounterCommit.schedulerFormatVersion = 5; }],
      ['receipt version', value => { value.run.lastEncounterCommit.shieldReceiptVersion = 2; }],
      ['missing start ledger', value => { delete value.run.lastEncounterCommit.schedulerStartSnapshot.encounter.shields; }],
      ['changed start ledger', value => { value.run.lastEncounterCommit.schedulerStartSnapshot.encounter.shields['partyCharacter:shiroko'] = 1; }],
      ['missing Shield evidence', value => { delete value.run.lastEncounterCommit.shieldTrace; }],
      ['changed trace identity', value => { value.run.lastEncounterCommit.shieldTrace[0].identity.id = 'serika'; }],
      ['changed trace amount', value => { value.run.lastEncounterCommit.shieldTrace[0].added = 2; }],
      ['changed final receipt ledger', value => { value.run.lastEncounterCommit.plannedShields['partyCharacter:shiroko'] = 3; }],
      ['changed active ledger', value => { value.run.activeEncounter.shields['partyCharacter:shiroko'] = 3; }],
      ['missing active ledger', value => { delete value.run.activeEncounter.shields; }],
      ['unknown active unit', value => { value.run.activeEncounter.shields['enemy:forged'] = 1; }],
    ];
    for (const [label, mutate] of mutations) {
      const corrupted = structuredClone(checkpoint);
      mutate(corrupted);
      const owner = makeService(shieldDefinition);
      expect(owner.restoreSaveSnapshot(corrupted), label).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
      expect(owner.getSnapshot(), label).toBeNull();
    }
  });
  test('retains empty planned Encounter locals for a non-terminal Program Receipt v2 modifier successor', () => {
    const modifierMap: GameplayMapDef = { ...definition, mapRunFacts: undefined,
      id: 'test:map:ag1-restore-card-modifier-heal', resumeVersion: 7,
      initialTeamResources: [], partyAgility: [],
      actions: [
        { id: 'boost', name: 'Boost', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'card', side: 'ally' }, effectProgram: { resolve: [
            { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 },
          ] } },
        { id: 'heal', name: 'Heal', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 },
          target: { kind: 'partyCharacter' }, effectProgram: { resolve: [{ op: 'heal', target: 'primary', amount: 2 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }],
          participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'boost', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [{ actionId: 'heal', tendencyWeight: 1 }] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
    };
    const source = makeService(modifierMap);
    const started = source.start(modifierMap.id, party);
    source.move(started.runId, 'battle');
    const active = source.getSnapshot()!.activeEncounter!;
    const target = source.getCards(started.runId).find(card => card.owner.kind === 'partyCharacter'
      && card.owner.id === 'serika' && card.actionId === 'heal')?.ref;
    if (!target) throw new Error('Expected the actual Prepared heal CardRef');
    source.setPreparedCardTarget(started.runId, 'shiroko', target, draftToken(active));
    const selected = source.getSnapshot()!;
    source.setPreparedTarget(started.runId, 'serika', 'shiroko', draftToken(selected.activeEncounter!));
    const ready = source.getSnapshot()!;
    const committed = source.commitEncounterRound({ runId: started.runId, requestId: 'restore-card-modifier-heal',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit).toMatchObject({ programReceiptVersion: 2,
      cardEffectModifierReceipts: [{ outcome: 'applied', hits: [{ op: 'heal', requestedAmount: 2, modifierDelta: 2,
        modifiedRequestedAmount: 4 }] }] });
    expect(committed.activeEncounter).not.toBeNull();
    expect(committed.activeEncounter?.locals).toEqual({ counters: {}, flags: {} });
    const checkpoint = source.createSaveSnapshot()!;
    const restored = makeService(modifierMap);
    expect(restored.restoreSaveSnapshot(checkpoint)).toEqual({ status: 'restored', mapId: modifierMap.id, runId: started.runId });
  });

  test('replays CardRef modifier evidence and rejects field tampering', () => {
    const modifierMap: GameplayMapDef = { ...definition, id: 'test:map:ag1-restore-card-modifier', resumeVersion: 6, initialTeamResources: [], partyAgility: [],
      actions: [
        { id: 'boost', name: 'Boost', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'card', side: 'ally' }, effectProgram: { resolve: [
            { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 },
          ] } },
        { id: 'hit', name: 'Hit', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 }, target: { kind: 'enemy' },
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] } },
      ],
      nodes: [{ id: 'start', title: 'Start' }, { id: 'battle', title: 'Battle', encounter: { title: 'Battle',
        enemies: [{ id: 'e1', initialHp: 5, maxHp: 10 }], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'boost', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'hit', tendencyWeight: 1 }] },
        ] } }, { id: 'exit', title: 'Exit' }],
    };
    const source = makeService(modifierMap);
    const started = source.start(modifierMap.id, party);
    source.move(started.runId, 'battle');
    const active = source.getSnapshot()!.activeEncounter!;
    const target = source.getCards(started.runId).find(card => card.owner.kind === 'partyCharacter'
      && card.owner.id === 'serika' && card.actionId === 'hit')?.ref;
    if (!target) throw new Error('Expected target CardRef');
    source.setPreparedCardTarget(started.runId, 'shiroko', target, draftToken(active));
    const ready = source.getSnapshot()!;
    source.commitEncounterRound({ runId: started.runId, requestId: 'restore-card-modifier',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    const checkpoint = source.createSaveSnapshot()!;
    expect(checkpoint.run.lastEncounterCommit).toMatchObject({ programReceiptVersion: 2,
      cardEffectModifierReceipts: [{ outcome: 'applied', sourceExecutionIndex: 0, targetExecutionIndex: 1,
        hits: [{ requestedAmount: 3, modifiedRequestedAmount: 5, before: 5, after: 0, hpDelta: -5 }] }] });
    expect(makeService(modifierMap).restoreSaveSnapshot(checkpoint)).toEqual({ status: 'restored', mapId: modifierMap.id, runId: started.runId });
    const corrupt = (mutate: (receipt: any) => void) => {
      const value: any = JSON.parse(JSON.stringify(checkpoint));
      mutate(value.run.lastEncounterCommit);
      if (value.run.activeEncounter?.lastCommit) mutate(value.run.activeEncounter.lastCommit);
      expect(makeService(modifierMap).restoreSaveSnapshot(value)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    };
    corrupt(receipt => { receipt.cardEffectModifierReceipts[0].targetCardRef.id = 'forged'; });
    corrupt(receipt => { receipt.cardEffectModifierReceipts[0].delta = 3; });
    corrupt(receipt => { receipt.cardEffectModifierReceipts[0].targetExecutionIndex = 0; });
    corrupt(receipt => { receipt.cardEffectModifierReceipts[0].hits[0].modifiedRequestedAmount = 4; });
    corrupt(receipt => { receipt.programReceiptVersion = 1; });
  });
  test('restores a scheduler receipt by replaying its commit-start snapshot', () => {
    const checkpoint = committedCheckpoint();
    const receipt = checkpoint.run.lastEncounterCommit;
    expect(receipt).toMatchObject({ executionContractId: 'AG-1', schedulerFormatVersion: 5,
      plannedMapRunFacts: { counters: [{ id: 'run-step', value: 2 }], flags: [{ id: 'route-open', value: false }] },
      schedulerStartSnapshot: expect.any(Object), schedulerTerminal: { outcome: 'none', checkpoint: null },
      executionSequence: expect.any(Array) });
    expect(receipt?.schedulerStartSnapshot?.mapRunFacts).toEqual(receipt?.plannedMapRunFacts);
    expect(receipt?.plannedEffectRandomState).toEqual(receipt?.schedulerStartSnapshot?.encounter.effectRandomState);

    const restored = makeService();
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()).toEqual(checkpoint.run);
  });

  test('replays a scheduler v4 secondary identity and rejects secondary, ledger, and trace tampering', () => {
    const { map, checkpoint } = committedSecondaryCheckpoint();
    const receipt = checkpoint.run.lastEncounterCommit!;
    expect(receipt).toMatchObject({ executionContractId: 'AG-1', schedulerFormatVersion: 5,
      settlements: [
        { characterId: 'shiroko', additionalTarget: { kind: 'partyCharacter', characterId: 'serika' } },
        { characterId: 'serika', additionalTarget: null },
      ],
      executionSequence: [{ sourceKind: 'partyAction', additionalTarget: { kind: 'partyCharacter', characterId: 'serika' } }],
      effectTrace: [expect.objectContaining({ op: 'resourceSettlement', identity: { kind: 'partyCharacter', id: 'serika' }, delta: 1 })],
      schedulerStartSnapshot: { encounter: { targetSelections: [
        { characterId: 'shiroko', targetEnemyId: 'e1', additionalTargetCharacterId: 'serika' },
      ] } },
    });
    const restored = makeService(map);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()).toEqual(checkpoint.run);

    const tamperCases: readonly [string, (value: any) => void][] = [
      ['execution secondary identity', value => { value.run.lastEncounterCommit.executionSequence[0].additionalTarget.characterId = 'shiroko'; }],
      ['settlement secondary identity', value => { value.run.lastEncounterCommit.settlements[0].additionalTarget.characterId = 'shiroko'; }],
      ['start snapshot secondary identity', value => { value.run.lastEncounterCommit.schedulerStartSnapshot.encounter.targetSelections[0].additionalTargetCharacterId = 'shiroko'; }],
      ['secondary ledger delta', value => {
        value.run.lastEncounterCommit.executionSequence[0].resourceChanges.find((row: any) => row.kind === 'effect').delta += 1;
      }],
      ['secondary trace identity', value => {
        value.run.lastEncounterCommit.effectTrace.find((row: any) => row.op === 'resourceSettlement').identity.id = 'shiroko';
      }],
      ['missing secondary field', value => { delete value.run.lastEncounterCommit.executionSequence[0].additionalTarget; }],
    ];
    for (const [_label, mutate] of tamperCases) {
      const forged = JSON.parse(JSON.stringify(checkpoint));
      mutate(forged);
      const candidate = makeService(map);
      expect(candidate.restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
      expect(candidate.getSnapshot()).toBeNull();
    }
  });

  test('replays ordered MapRun Facts and source-start balances from the scheduler v2 snapshot', () => {
    const checkpoint = committedCheckpoint(orderedFactsDefinition, 'later');
    const receipt = checkpoint.run.lastEncounterCommit;
    expect(receipt?.schedulerStartSnapshot).toMatchObject({
      mapRunFacts: { counters: [{ id: 'run-step', value: 2 }], flags: [{ id: 'route-open', value: false }] },
      teamResources: [{ resourceId: 'supplies', value: 1 }],
    });
    expect(receipt?.plannedMapRunFacts).toEqual({
      counters: [{ id: 'run-step', value: 3 }], flags: [{ id: 'route-open', value: true }],
    });
    expect(checkpoint.run.mapRunFacts).toEqual(receipt?.plannedMapRunFacts);
    expect(checkpoint.run.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
    expect(checkpoint.run.activeEncounter?.enemies).toEqual([{ enemyId: 'e1', currentHp: 6 }]);

    const restored = makeService(orderedFactsDefinition);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()).toEqual(checkpoint.run);
  });

  test('replays scheduler v5 random target identities and the cross-source Effect cursor', () => {
    const checkpoint = committedCheckpoint(randomTargetDefinition, null);
    const receipt = checkpoint.run.lastEncounterCommit!;
    const start = receipt.schedulerStartSnapshot!.encounter;
    expect(receipt.schedulerFormatVersion).toBe(5);
    expect(start.effectRandomState).toEqual(createMapEffectRandomState(start.randomState.seed));
    expect(receipt.plannedEffectRandomState).toEqual({ ...start.effectRandomState, cursor: 2 });
    const randomTrace = receipt.effectTrace?.filter(row => row.op === 'targetSet') ?? [];
    expect(randomTrace).toHaveLength(2);
    expect(randomTrace.map(row => row.op === 'targetSet' ? row.random : undefined)).toMatchObject([
      { seed: start.effectRandomState.seed, cursorBefore: 0, cursorAfter: 1 },
      { seed: start.effectRandomState.seed, cursorBefore: 1, cursorAfter: 2 },
    ]);
    expect(checkpoint.run.activeEncounter?.effectRandomState).toEqual(receipt.plannedEffectRandomState);

    const restored = makeService(randomTargetDefinition);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()).toEqual(checkpoint.run);
  });

  test.each([
    ['scheduler v2 receipt', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerFormatVersion = 2; }],
    ['changed planned Effect state', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.plannedEffectRandomState.cursor += 1; }],
    ['changed starting Effect state seed', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerStartSnapshot.encounter.effectRandomState.seed += 1; }],
    ['changed starting Effect state cursor', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerStartSnapshot.encounter.effectRandomState.cursor += 1; }],
    ['changed current Encounter Effect state', (checkpoint: any) => { checkpoint.run.activeEncounter.effectRandomState.cursor += 1; }],
    ['extra Effect state field', (checkpoint: any) => { checkpoint.run.activeEncounter.effectRandomState.unknown = true; }],
    ['changed random target identity trace', (checkpoint: any) => {
      checkpoint.run.lastEncounterCommit.effectTrace.find((entry: any) => entry.op === 'targetSet').identities[0].id = 'forged';
    }],
    ['changed random cursor trace', (checkpoint: any) => {
      checkpoint.run.lastEncounterCommit.effectTrace.find((entry: any) => entry.op === 'targetSet').random.cursorAfter += 1;
    }],
    ['scheduler v4 receipt', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerFormatVersion = 4; }],
    ['unknown scheduler version', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerFormatVersion = 6; }],
  ])('rejects %s during scheduler v5 replay', (_label, mutate) => {
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint(randomTargetDefinition, null)));
    mutate(checkpoint);
    const restored = makeService(randomTargetDefinition);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(restored.getSnapshot()).toBeNull();
  });

  test('rejects a scheduler v5 checkpoint from resumeVersion 4 without migration', () => {
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint(randomTargetDefinition, null)));
    checkpoint.resumeVersion = 4;
    const restored = makeService(randomTargetDefinition);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'content-version-mismatch' });
    expect(restored.getSnapshot()).toBeNull();
  });

  test.each([
    ['changed source-start Team balance', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerStartSnapshot.teamResources[0].value += 1; }],
    ['changed current Team balance', (checkpoint: any) => { checkpoint.run.teamResources[0].value += 1; }],
  ])('rejects %s when replaying ordered MapRun Facts and balances', (_label, mutate) => {
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint(orderedFactsDefinition, 'later')));
    mutate(checkpoint);
    const restored = makeService(orderedFactsDefinition);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(restored.getSnapshot()).toBeNull();
  });

  test('rejects a forged scheduler sequence without installing a partial MapRun', () => {
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint()));
    checkpoint.run.lastEncounterCommit.executionSequence[0].actionId = 'forged-action';

    const restored = makeService();
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(restored.getSnapshot()).toBeNull();
  });

  test('validates AG-1 scheduling when the receipt has no Effect Program', () => {
    const noProgram: GameplayMapDef = { ...definition, actions: [], initialTeamResources: [],
      nodes: definition.nodes.map(node => node.id === 'battle' && node.encounter
        ? { ...node, encounter: { ...node.encounter, participants: [
          { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
        ] } } : node) };
    const checkpoint = committedCheckpoint(noProgram, null);
    expect(checkpoint.run.lastEncounterCommit).not.toHaveProperty('programReceiptVersion');
    const restored = makeService(noProgram);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
  });

  test('replays a closed Encounter receipt from its retained commit-start snapshot', () => {
    const oneRound: GameplayMapDef = {
      ...definition,
      nodes: definition.nodes.map(node => node.id === 'battle' && node.encounter
        ? { ...node, encounter: { ...node.encounter, rounds: 1 } } : node),
    };
    const checkpoint = committedCheckpoint(oneRound);
    expect(checkpoint.run.activeEncounter).toBeNull();
    expect(checkpoint.run.lastEncounterCommit?.schedulerTerminal).toEqual({
      outcome: 'victory', checkpoint: 'afterNonBattleCompletion',
    });
    const restored = makeService(oneRound);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
  });

  test('restores a terminal receipt with a selected but skipped Ability source', () => {
    const abilityMap: GameplayMapDef = {
      ...definition,
      id: 'test:map:ag1-restore-skipped-ability',
      initialTeamResources: [],
      actions: [
        { id: 'kill', name: 'Kill', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 5 }] } },
        { id: 'ability-hit', name: 'Ability Hit', eligibleCharacterIds: [], agility: { base: 0, max: 0 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: ['ability-hit'],
          enemies: [{ id: 'e1', initialHp: 1, maxHp: 1 }], participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'kill', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const source = makeService(abilityMap);
    const started = source.start(abilityMap.id, party);
    const entered = source.move(started.runId, 'battle');
    source.setAbilityDraft(started.runId, 'ability-hit', { kind: 'enemy', enemyId: 'e1' }, draftToken(entered.activeEncounter!));
    const ready = source.getSnapshot()!;
    const committed = source.commitEncounterRound({ runId: started.runId, requestId: 'skipped-ability',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit?.executionSequence).toMatchObject([
      { sourceKind: 'partyAction', actionId: 'kill', skipReason: null },
      { sourceKind: 'ability', actionId: 'ability-hit', skipReason: 'roundEnded', playerCostSpent: 0 },
    ]);
    const checkpoint = source.createSaveSnapshot()!;
    expect(checkpoint.run.activeEncounter).toBeNull();
    const restored = makeService(abilityMap);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
  });

  test('restores a terminal receipt with a selected but skipped Item source', () => {
    const itemMap: GameplayMapDef = {
      ...definition,
      id: 'test:map:ag1-restore-skipped-item',
      initialTeamResources: [],
      actions: [
        { id: 'kill', name: 'Kill', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 5 }] } },
        { id: 'item-hit', name: 'Item Hit', eligibleCharacterIds: [], agility: { base: 0, max: 0 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', itemActions: [{ itemId: 'potion', actionId: 'item-hit' }],
          enemies: [{ id: 'e1', initialHp: 1, maxHp: 1 }], participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'kill', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const source = makeService(itemMap);
    const started = source.start(itemMap.id, party);
    const entered = source.move(started.runId, 'battle');
    source.setItemDraft(started.runId, 'potion', { kind: 'enemy', enemyId: 'e1' }, draftToken(entered.activeEncounter!));
    const ready = source.getSnapshot()!;
    const committed = source.commitEncounterRound({ runId: started.runId, requestId: 'skipped-item',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit?.executionSequence).toMatchObject([
      { sourceKind: 'partyAction', actionId: 'kill', skipReason: null },
      { sourceKind: 'item', actionId: 'item-hit', skipReason: 'roundEnded', itemConsumed: false },
    ]);
    expect(committed.lastEncounterCommit).not.toHaveProperty('item');
    const checkpoint = source.createSaveSnapshot()!;
    expect(checkpoint.run.activeEncounter).toBeNull();
    const restored = makeService(itemMap);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
  });

  test('replays a real CardRef source and rejects a forged sequence CardRef', () => {
    const cardMap: GameplayMapDef = {
      ...definition,
      id: 'test:map:ag1-restore-card-ref',
      initialActorResources: party.map(member => ({ characterId: member.characterId, resourceId: 'sCost', value: 2 })),
      actions: [
        { id: 'discount-card', name: 'Discount', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] } },
        { id: 'cost-card', name: 'Cost', eligibleCharacterIds: ['serika'],
          target: { kind: 'none' }, costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
        { id: 'cost-card-2', name: 'Cost 2', eligibleCharacterIds: ['serika'],
          target: { kind: 'none' }, costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'discount-card', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [
            { actionId: 'cost-card', tendencyWeight: 1 }, { actionId: 'cost-card-2', tendencyWeight: 1 },
          ] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const source = makeService(cardMap);
    const started = source.start(cardMap.id, party);
    const entered = source.move(started.runId, 'battle');
    const before = source.getSnapshot()!;
    const preview = source.previewEncounterCommit(started.runId);
    expect(preview?.canCommit).toBe(true);
    const committed = source.commitEncounterRound({ runId: started.runId, requestId: 'card-ref-replay',
      expectedCommitVersion: before.commitVersion, draft: draftToken(entered.activeEncounter!) });
    const executionSequence = committed.lastEncounterCommit?.executionSequence;
    if (!executionSequence) throw new Error('AG-1 execution sequence is missing');
    expect(executionSequence[0].cardRef).toMatchObject({
      kind: 'card', scope: { runId: started.runId, mapId: cardMap.id, nodeId: 'battle', round: 1 },
    });
    const checkpoint = source.createSaveSnapshot()!;
    const restored = makeService(cardMap);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });

    const forged = JSON.parse(JSON.stringify(checkpoint));
    forged.run.lastEncounterCommit.executionSequence[0].cardRef.scope.round += 1;
    const rejected = makeService(cardMap);
    expect(rejected.restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(rejected.getSnapshot()).toBeNull();
  });

  test('replays Status Trace and rejects a forged Status Trace entry', () => {
    const statusMap: GameplayMapDef = {
      ...definition,
      id: 'test:map:ag1-restore-status-trace',
      initialTeamResources: [],
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 1 }],
      actions: [{ id: 'apply-burn', name: 'Apply Burn', eligibleCharacterIds: [], target: { kind: 'enemy' },
        effectProgram: { resolve: [{ op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 1 }] } }],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: ['apply-burn'],
          enemies: [{ id: 'e1', initialHp: 1, maxHp: 1 }], participants: [
            { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const source = makeService(statusMap);
    const started = source.start(statusMap.id, party);
    const entered = source.move(started.runId, 'battle');
    const statusStart: any = JSON.parse(JSON.stringify(source.createSaveSnapshot()));
    statusStart.run.activeEncounter.round = 2;
    statusStart.run.activeEncounter.drawCursorStart = entered.activeEncounter!.randomState.cursor;
    statusStart.run.activeEncounter.randomState = entered.activeEncounter!.randomState;
    statusStart.run.activeEncounter.statuses = [{
      holder: { kind: 'enemy', id: 'e1' }, statusId: 'burn', source: { kind: 'ability', actionId: 'apply-burn' },
      actionId: 'apply-burn', appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 1,
    }];
    const statusOwner = makeService(statusMap);
    expect(statusOwner.restoreSaveSnapshot(statusStart)).toMatchObject({ status: 'restored' });
    const ready = statusOwner.getSnapshot()!;
    const committed = statusOwner.commitEncounterRound({ runId: started.runId, requestId: 'status-trace',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit?.schedulerTerminal).toEqual({ outcome: 'victory', checkpoint: 'afterStatusRoundEnd' });
    expect(committed.lastEncounterCommit?.statusTrace?.length).toBeGreaterThan(0);
    const checkpoint = statusOwner.createSaveSnapshot()!;
    const restored = makeService(statusMap);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });

    const forged = JSON.parse(JSON.stringify(checkpoint));
    forged.run.lastEncounterCommit.statusTrace[0].hpAfter += 1;
    const rejected = makeService(statusMap);
    expect(rejected.restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('replays Status Remove Receipt v2 and rejects version, identity, position, and final-list tampering', () => {
    const statusMap: GameplayMapDef = {
      ...definition,
      id: 'test:map:ag1-restore-status-remove',
      initialPlayerCost: 2,
      initialTeamResources: [],
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 2 }],
      actions: [
        { id: 'apply-burn', name: 'Apply Burn', eligibleCharacterIds: [], target: { kind: 'enemy' },
          effectProgram: { resolve: [{ op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 }] } },
        { id: 'remove-burn', name: 'Remove Burn', eligibleCharacterIds: [], target: { kind: 'enemy' },
          effectProgram: { resolve: [{ op: 'statusRemove', target: 'primary', statusId: 'burn' }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: ['apply-burn', 'remove-burn'],
          enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const source = makeService(statusMap);
    const started = source.start(statusMap.id, party);
    const entered = source.move(started.runId, 'battle');
    const seeded: any = JSON.parse(JSON.stringify(source.createSaveSnapshot()));
    seeded.run.activeEncounter.round = 2;
    seeded.run.activeEncounter.drawCursorStart = entered.activeEncounter!.randomState.cursor;
    seeded.run.activeEncounter.randomState = entered.activeEncounter!.randomState;
    seeded.run.activeEncounter.statuses = [{
      holder: { kind: 'enemy', id: 'e1' }, statusId: 'burn',
      source: { kind: 'ability', actionId: 'apply-burn' }, actionId: 'apply-burn',
      appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
    }];
    const owner = makeService(statusMap);
    expect(owner.restoreSaveSnapshot(seeded)).toMatchObject({ status: 'restored' });
    let ready = owner.getSnapshot()!;
    owner.setAbilityDraft(started.runId, 'remove-burn', { kind: 'enemy', enemyId: 'e1' }, draftToken(ready.activeEncounter!));
    ready = owner.getSnapshot()!;
    const previewState = owner.getSnapshot();
    const preview = owner.previewEncounterCommit(started.runId)!;
    expect(preview.diagnostics).toEqual([]);
    expect(preview.canCommit).toBe(true);
    expect(preview.effectTrace).toContainEqual(expect.objectContaining({ op: 'statusRemove', statusId: 'burn' }));
    expect(owner.getSnapshot()).toEqual(previewState);

    const removed = owner.commitEncounterRound({ runId: started.runId, requestId: 'status-remove-commit',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    expect(removed.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 2,
      schedulerFormatVersion: 5,
      programReceiptVersion: 1,
      plannedStatuses: [],
      statusTrace: [],
      statusRemoveTrace: [{ statusId: 'burn', identity: { kind: 'enemy', id: 'e1' }, removed: [{ statusIndexBefore: 0,
        status: { statusId: 'burn', source: { kind: 'ability', actionId: 'apply-burn' }, actionId: 'apply-burn' } }] }],
    });
    expect(removed.activeEncounter?.statuses).toEqual([]);

    const checkpoint = owner.createSaveSnapshot()!;
    const restored = makeService(statusMap);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });

    const mutateReceiptCopies = (value: any, mutate: (receipt: any) => void) => {
      mutate(value.run.lastEncounterCommit);
      mutate(value.run.activeEncounter.lastCommit);
    };
    const versionOne = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(versionOne, receipt => { receipt.statusReceiptVersion = 1; });
    expect(makeService(statusMap).restoreSaveSnapshot(versionOne)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const unknownVersion = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(unknownVersion, receipt => { receipt.statusReceiptVersion = 3; });
    expect(makeService(statusMap).restoreSaveSnapshot(unknownVersion)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const identity = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(identity, receipt => { receipt.statusRemoveTrace[0].identity.id = 'shiroko'; });
    expect(makeService(statusMap).restoreSaveSnapshot(identity)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const position = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(position, receipt => { receipt.statusRemoveTrace[0].removed[0].statusIndexBefore = 1; });
    expect(makeService(statusMap).restoreSaveSnapshot(position)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const finalList = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(finalList, receipt => { receipt.plannedStatuses = [receipt.statusRemoveTrace[0].removed[0].status]; });
    finalList.run.activeEncounter.statuses = [finalList.run.lastEncounterCommit.plannedStatuses[0]];
    expect(makeService(statusMap).restoreSaveSnapshot(finalList)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('replays Status Consume Receipt v3 and rejects trace, version, and active Status tampering', () => {
    const consume = { id: 'consume-burn', name: 'Consume Burn', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusConsume' as const, target: 'primary' as const, statusId: 'burn', stacks: 1 }] } };
    const apply = { id: 'apply-burn', name: 'Apply Burn', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const, statusId: 'burn', stacks: 2, durationRounds: 3 }] } };
    const statusMap: GameplayMapDef = {
      ...definition,
      id: 'test:map:ag1-restore-status-consume',
      resumeVersion: 3,
      initialPlayerCost: 3,
      initialTeamResources: [],
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3 }],
      actions: [apply, consume],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: [apply.id, consume.id],
          enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const source = makeService(statusMap);
    const started = source.start(statusMap.id, party);
    const entered = source.move(started.runId, 'battle');
    const seeded: any = JSON.parse(JSON.stringify(source.createSaveSnapshot()));
    seeded.run.activeEncounter.round = 2;
    seeded.run.activeEncounter.drawCursorStart = entered.activeEncounter!.randomState.cursor;
    seeded.run.activeEncounter.randomState = entered.activeEncounter!.randomState;
    seeded.run.activeEncounter.statuses = [{
      holder: { kind: 'enemy', id: 'e1' }, statusId: 'burn',
      source: { kind: 'ability', actionId: 'apply-burn' }, actionId: 'apply-burn',
      appliedRound: 1, lastTriggeredRound: null, stacks: 2, remainingRounds: 2,
    }];
    const owner = makeService(statusMap);
    expect(owner.restoreSaveSnapshot(seeded)).toMatchObject({ status: 'restored' });
    const ready = owner.getSnapshot()!;
    owner.setAbilityDraft(started.runId, consume.id, { kind: 'enemy', enemyId: 'e1' }, draftToken(ready.activeEncounter!));
    const planned = owner.getSnapshot()!;
    const committed = owner.commitEncounterRound({ runId: started.runId, requestId: 'status-consume-replay',
      expectedCommitVersion: planned.commitVersion, draft: draftToken(planned.activeEncounter!) });
    expect(committed.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 3, schedulerFormatVersion: 5,
      plannedStatuses: [{ statusId: 'burn', stacks: 1, remainingRounds: 1 }],
      statusRemoveTrace: [],
      statusConsumeTrace: [{ source: { kind: 'ability', actionId: consume.id }, identity: { kind: 'enemy', id: 'e1' },
        statusId: 'burn', requestedStacks: 1, consumedStacks: 1, unmetStacks: 0,
        changes: [{ statusIndexBefore: 0, statusBefore: { stacks: 2 }, consumedStacks: 1, statusAfter: { stacks: 1 } }] }],
    });
    const checkpoint = owner.createSaveSnapshot()!;
    expect(makeService(statusMap).restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });

    const mutateReceiptCopies = (value: any, mutate: (receipt: any) => void) => {
      mutate(value.run.lastEncounterCommit);
      mutate(value.run.activeEncounter.lastCommit);
    };
    const changedTrace = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(changedTrace, receipt => { receipt.statusConsumeTrace[0].changes[0].statusAfter.stacks = 2; });
    expect(makeService(statusMap).restoreSaveSnapshot(changedTrace)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const changedVersion = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(changedVersion, receipt => { receipt.statusReceiptVersion = 2; });
    expect(makeService(statusMap).restoreSaveSnapshot(changedVersion)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const changedActiveStatus = JSON.parse(JSON.stringify(checkpoint));
    changedActiveStatus.run.activeEncounter.statuses[0].stacks = 2;
    expect(makeService(statusMap).restoreSaveSnapshot(changedActiveStatus)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('replays v4 category removal from the scheduler start and rejects category, instance, list, or HP forgery', () => {
    const clear = { id: 'clear-harmful', name: 'Clear Harmful', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusRemoveCategory' as const, target: 'primary' as const, category: 'harmful' as const }] } };
    const applyBurn = { id: 'apply-burn', name: 'Apply Burn', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const, statusId: 'burn', stacks: 1, durationRounds: 3 }] } };
    const applyRegen = { id: 'apply-regen', name: 'Apply Regen', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const, statusId: 'regen', stacks: 1, durationRounds: 3 }] } };
    const statusMap: GameplayMapDef = {
      ...definition,
      id: 'test:map:ag1-status-category-restore',
      resumeVersion: 4,
      initialTeamResources: [],
      statuses: [
        { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3, category: 'harmful' },
        { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 3, category: 'beneficial' },
      ],
      actions: [clear, applyBurn, applyRegen],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: [clear.id, applyBurn.id, applyRegen.id],
          enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const source = makeService(statusMap);
    const started = source.start(statusMap.id, party);
    const entered = source.move(started.runId, 'battle');
    const seeded: any = JSON.parse(JSON.stringify(source.createSaveSnapshot()));
    seeded.run.activeEncounter.round = 2;
    seeded.run.activeEncounter.drawCursorStart = entered.activeEncounter!.randomState.cursor;
    seeded.run.activeEncounter.randomState = entered.activeEncounter!.randomState;
    seeded.run.activeEncounter.enemies = [{ enemyId: 'e1', currentHp: 5 }];
    seeded.run.playerCost = 2;
    seeded.run.activeEncounter.statuses = [
      { holder: { kind: 'enemy', id: 'e1' }, statusId: 'burn', source: { kind: 'ability', actionId: applyBurn.id },
        actionId: applyBurn.id, appliedRound: 1, lastTriggeredRound: null, stacks: 2, remainingRounds: 2 },
      { holder: { kind: 'enemy', id: 'e1' }, statusId: 'regen', source: { kind: 'ability', actionId: applyRegen.id },
        actionId: applyRegen.id, appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2 },
    ];
    const owner = makeService(statusMap);
    expect(owner.restoreSaveSnapshot(seeded)).toMatchObject({ status: 'restored' });
    const ready = owner.getSnapshot()!;
    owner.setAbilityDraft(started.runId, clear.id, { kind: 'enemy', enemyId: 'e1' }, draftToken(ready.activeEncounter!));
    const planned = owner.getSnapshot()!;
    const committed = owner.commitEncounterRound({ runId: started.runId, requestId: 'status-category-replay',
      expectedCommitVersion: planned.commitVersion, draft: draftToken(planned.activeEncounter!) });
    expect(committed.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 4, schedulerFormatVersion: 5,
      plannedStatuses: [{ statusId: 'regen', stacks: 1, remainingRounds: 1 }],
      statusRemoveTrace: [], statusConsumeTrace: [],
      statusCategoryRemoveTrace: [{ source: { kind: 'ability', actionId: clear.id }, identity: { kind: 'enemy', id: 'e1' },
        category: 'harmful', removed: [{ statusIndexBefore: 0, status: { statusId: 'burn', stacks: 2 } }] }],
    });
    expect(committed.activeEncounter?.enemies).toEqual([{ enemyId: 'e1', currentHp: 6 }]);
    const checkpoint = owner.createSaveSnapshot()!;
    const checkpointRestore = makeService(statusMap).restoreSaveSnapshot(checkpoint);
    expect(checkpointRestore).toMatchObject({ status: 'restored' });

    const mutateReceiptCopies = (value: any, mutate: (receipt: any) => void) => {
      mutate(value.run.lastEncounterCommit);
      mutate(value.run.activeEncounter.lastCommit);
    };
    const changedCategory = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(changedCategory, receipt => { receipt.statusCategoryRemoveTrace[0].category = 'beneficial'; });
    expect(makeService(statusMap).restoreSaveSnapshot(changedCategory)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const changedInstance = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(changedInstance, receipt => { receipt.statusCategoryRemoveTrace[0].removed[0].status.statusId = 'regen'; });
    expect(makeService(statusMap).restoreSaveSnapshot(changedInstance)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const changedIndex = JSON.parse(JSON.stringify(checkpoint));
    mutateReceiptCopies(changedIndex, receipt => { receipt.statusCategoryRemoveTrace[0].removed[0].statusIndexBefore = 1; });
    expect(makeService(statusMap).restoreSaveSnapshot(changedIndex)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const changedStatus = JSON.parse(JSON.stringify(checkpoint));
    changedStatus.run.activeEncounter.statuses[0].remainingRounds += 1;
    expect(makeService(statusMap).restoreSaveSnapshot(changedStatus)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const changedHp = JSON.parse(JSON.stringify(checkpoint));
    changedHp.run.activeEncounter.enemies[0].currentHp -= 1;
    expect(makeService(statusMap).restoreSaveSnapshot(changedHp)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('accepts reordered JSON object fields while preserving array order', () => {
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint()));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorder(child)]))
        : value;
    const reordered = reorder(checkpoint);
    const restored = makeService();
    expect(restored.restoreSaveSnapshot(reordered)).toMatchObject({ status: 'restored' });
  });

  test('rejects an active successor checkpoint whose HP diverges from the replayed plan', () => {
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint()));
    checkpoint.run.partyHp[0].currentHp -= 1;
    const restored = makeService();
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(restored.getSnapshot()).toBeNull();
  });

  test('rejects a missing tracked locals field in an active successor checkpoint', () => {
    const withLocals: GameplayMapDef = {
      ...definition,
      nodes: definition.nodes.map(node => node.id === 'battle' && node.encounter
        ? { ...node, encounter: { ...node.encounter, locals: { counters: [{ id: 'uses', initial: 0, min: 0, max: 3 }] } } }
        : node),
    };
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint(withLocals)));
    delete checkpoint.run.activeEncounter.locals;
    const restored = makeService(withLocals);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('keeps scheduler v5 snapshots closed when the Map declares no MapRun Facts', () => {
    const noFacts = { ...definition, mapRunFacts: undefined };
    const checkpoint = committedCheckpoint(noFacts);
    expect(checkpoint.run).not.toHaveProperty('mapRunFacts');
    expect(checkpoint.run.lastEncounterCommit).not.toHaveProperty('plannedMapRunFacts');
    expect(checkpoint.run.lastEncounterCommit?.schedulerStartSnapshot).not.toHaveProperty('mapRunFacts');
    const restored = makeService(noFacts);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()).toEqual(checkpoint.run);
  });

  test.each([
    ['legacy scheduler version', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerFormatVersion = 1; }],
    ['scheduler v4 receipt', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerFormatVersion = 4; }],
    ['unknown scheduler version', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerFormatVersion = 6; }],
    ['changed planned MapRun Facts', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.plannedMapRunFacts.counters[0].value += 1; }],
    ['changed starting MapRun Facts', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerStartSnapshot.mapRunFacts.counters[0].value += 1; }],
    ['changed current MapRun Facts', (checkpoint: any) => { checkpoint.run.mapRunFacts.counters[0].value += 1; }],
    ['missing scheduler start snapshot', (checkpoint: any) => { delete checkpoint.run.lastEncounterCommit.schedulerStartSnapshot; }],
    ['wrong terminal checkpoint', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerTerminal.checkpoint = 'afterSource'; }],
    ['missing sequence source', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.executionSequence.pop(); }],
    ['extra sequence tail row', (checkpoint: any) => {
      const rows = checkpoint.run.lastEncounterCommit.executionSequence;
      rows.push({ ...rows[rows.length - 1], executionIndex: rows.length, sourceKey: 'extra-source' });
    }],
    ['duplicate sequence source', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.executionSequence[1] = checkpoint.run.lastEncounterCommit.executionSequence[0]; }],
    ['reordered sequence', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.executionSequence.reverse(); }],
    ['changed agility', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.executionSequence[0].finalAgility += 1; }],
    ['changed ordering key', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.executionSequence[0].sideRank += 1; }],
    ['changed source identity', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.executionSequence[0].sourceKey = 'forged-source'; }],
    ['changed target', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.executionSequence[0].target = { kind: 'enemy', enemyId: 'forged-enemy' }; }],
    ['changed starting Hand', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerStartSnapshot.encounter.hands[0].actionIds[0] = 'forged-action'; }],
    ['changed projection', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.settlements[0].actionId = 'forged'; }],
    ['changed cost projection', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.settlements[0].resourceChanges[0].delta += 1; }],
    ['changed start agility snapshot', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.schedulerStartSnapshot.partyAgility[0].agility += 1; }],
    ['extra receipt field', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.unrecognized = true; }],
    ['changed Program visit', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.programVisits[0].forged = true; }],
    ['changed Effect trace', (checkpoint: any) => { checkpoint.run.lastEncounterCommit.effectTrace[0].forged = true; }],
  ])('rejects %s', (_label, mutate) => {
    const checkpoint = JSON.parse(JSON.stringify(committedCheckpoint()));
    mutate(checkpoint);
    const restored = makeService();
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(restored.getSnapshot()).toBeNull();
  });
});
