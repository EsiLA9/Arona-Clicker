import { describe, expect, test } from 'vitest';
import type { MapContentResolver } from '../../src/arona-clicker/contracts/map/map-content-resolver';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { resolveMapCardEffects } from '../../src/arona-clicker/services/map/map-card-effects';
import { validateMapEncounterStatusInstances } from '../../src/arona-clicker/services/map/map-encounter-statuses';
import { isGameplayMapEdgeConditionSatisfied } from '../../src/arona-clicker/services/map/map-edge-conditions';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';

const party = [{ characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' }] as const;

const definition: GameplayMapDef = {
  id: 'test:map:fact-gated-pools', name: 'Fact Gated Pools', resumeVersion: 7, executionContractId: 'AG-1',
  startNodeId: 'first', exitNodeIds: ['exit'], partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [
    { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
    { characterId: 'serika', initialHp: 10, maxHp: 10 },
  ],
  initialPlayerCost: 0,
  mapRunFacts: { counters: [{ id: 'route-step', initial: 0, min: 0, max: 9 }], flags: [{ id: 'route-open', initial: false }] },
  actions: [
    { id: 'advance-route', name: 'Advance Route', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 9 },
      target: { kind: 'none' }, effectProgram: { resolve: [{ op: 'mapRunCounterAdd', counterId: 'route-step', delta: 1 }] } },
    { id: 'flag-action', name: 'Flag Action', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 9 }, target: { kind: 'none' } },
    { id: 'card-action', name: 'Card Action', eligibleCharacterIds: ['shiroko'], target: { kind: 'card', side: 'ally' },
      effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: [] } },
    { id: 'card-target', name: 'Card Target', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
      costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
    { id: 'status-action', name: 'Status Action', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 9 }, target: { kind: 'none' },
      effectProgram: { resolve: [{ op: 'statusApply', statusId: 'burn', target: 'primary', stacks: 1, durationRounds: 2 }] } },
  ],
  statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3 }],
  candidatePools: [
    { id: 'route-root', entries: [{ kind: 'pool', poolId: 'route-initial', weight: 1 }, { kind: 'pool', poolId: 'route-next', weight: 1 }] },
    { id: 'route-initial', gate: { kind: 'counter', counterId: 'route-step', comparison: 'eq', value: 0 },
      entries: [{ kind: 'action', actionId: 'advance-route', weight: 1 }] },
    { id: 'route-next', gate: { kind: 'counter', counterId: 'route-step', comparison: 'gte', value: 1 },
      entries: [{ kind: 'action', actionId: 'flag-action', weight: 1 }] },
    { id: 'flag-pool', gate: { kind: 'flag', flagId: 'route-open', value: true },
      entries: [{ kind: 'action', actionId: 'status-action', weight: 1 }, { kind: 'action', actionId: 'card-action', weight: 1 },
        { kind: 'action', actionId: 'card-target', weight: 1 }] },
  ],
  nodes: [
    { id: 'first', title: 'First', encounter: { title: 'First', rounds: 2,
      participants: [
        { characterId: 'shiroko', actions: [], candidatePoolIds: ['route-root'] },
        { characterId: 'serika', actions: [] },
      ] } },
    { id: 'second', title: 'Second', encounter: { title: 'Second',
      participants: [
        { characterId: 'shiroko', actions: [], candidatePoolIds: ['route-root'] },
        { characterId: 'serika', actions: [] },
      ] } },
    { id: 'exit', title: 'Exit' },
  ],
  edges: [
    { fromNodeId: 'first', toNodeId: 'second', condition: { kind: 'counter', counterId: 'route-step', comparison: 'gte', value: 2 } },
    { fromNodeId: 'second', toNodeId: 'exit' },
  ],
};

function makeService(map: GameplayMapDef = definition): MapRunService {
  const resolver: MapContentResolver = { resolve: id => id === map.id ? map : null };
  return new MapRunService(resolver, id => id === 'Shiroko' ? 'shiroko' : id === 'Serika' ? 'serika' : null);
}

function token(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

function commit(service: MapRunService, runId: string, requestId: string) {
  const snapshot = service.getSnapshot()!;
  const encounter = snapshot.activeEncounter!;
  return service.commitEncounterRound({ runId, requestId, expectedCommitVersion: snapshot.commitVersion, draft: token(encounter) });
}

function hasAction(encounter: MapRunEncounterSnapshot, actionId: string): boolean {
  return encounter.hands.find(hand => hand.characterId === 'shiroko')?.actionIds.includes(actionId) ?? false;
}

describe('AG-1 fact-gated candidate Pools in MapRun', () => {
  test.each([
    ['eq', 2, true], ['eq', 3, false], ['lt', 3, true], ['lte', 2, true],
    ['gt', 1, true], ['gte', 2, true],
  ] as const)('evaluates the current Counter for an Edge using %s', (comparison, expectedValue, satisfied) => {
    expect(isGameplayMapEdgeConditionSatisfied(
      { kind: 'counter', counterId: 'route-step', comparison, value: expectedValue },
      { teamResources: [], mapRunFacts: { counters: [{ id: 'route-step', value: 2 }], flags: [] } },
    )).toBe(satisfied);
  });

  test('evaluates Flag and existing Team resource gates without changing MapRun state', () => {
    const run = {
      teamResources: [{ resourceId: 'pass', value: 2 }],
      mapRunFacts: { counters: [], flags: [{ id: 'route-open', value: false }] },
    };
    expect(isGameplayMapEdgeConditionSatisfied({ kind: 'flag', flagId: 'route-open', value: false }, run)).toBe(true);
    expect(isGameplayMapEdgeConditionSatisfied({ kind: 'flag', flagId: 'route-open', value: true }, run)).toBe(false);
    expect(isGameplayMapEdgeConditionSatisfied({ kind: 'teamResourceAtLeast', resourceId: 'pass', amount: 2 }, run)).toBe(true);
    expect(run).toEqual({ teamResources: [{ resourceId: 'pass', value: 2 }], mapRunFacts: { counters: [], flags: [{ id: 'route-open', value: false }] } });
  });

  test('freezes nested Pool gates per Encounter, resamples on the next Encounter, and saves the snapshot', () => {
    const service = makeService();
    const started = service.start(definition.id, party);
    const first = service.getSnapshot()!.activeEncounter!;
    expect(first.candidateSourceSnapshot).toEqual({ formatVersion: 1, mapRunFacts: {
      counters: [{ id: 'route-step', value: 0 }], flags: [{ id: 'route-open', value: false }],
    } });
    expect(hasAction(first, 'advance-route')).toBe(true);

    commit(service, started.runId, 'first-round');
    const sameEncounter = service.getSnapshot()!.activeEncounter!;
    expect(sameEncounter.round).toBe(2);
    expect(service.getSnapshot()!.mapRunFacts?.counters).toEqual([{ id: 'route-step', value: 1 }]);
    expect(sameEncounter.candidateSourceSnapshot).toEqual(first.candidateSourceSnapshot);
    expect(hasAction(sameEncounter, 'advance-route')).toBe(true);
    expect(hasAction(sameEncounter, 'flag-action')).toBe(false);

    commit(service, started.runId, 'second-round');
    service.move(started.runId, 'second');
    const nextEncounter = service.getSnapshot()!.activeEncounter!;
    expect(nextEncounter.nodeId).toBe('second');
    expect(nextEncounter.candidateSourceSnapshot?.mapRunFacts.counters).toEqual([{ id: 'route-step', value: 2 }]);
    expect(hasAction(nextEncounter, 'advance-route')).toBe(false);
    expect(hasAction(nextEncounter, 'flag-action')).toBe(true);

    const checkpoint = service.createSaveSnapshot()!;
    expect(checkpoint.run.lastEncounterCommit).toMatchObject({
      schedulerFormatVersion: 5,
      schedulerStartSnapshot: { encounter: { candidateSourceSnapshot: first.candidateSourceSnapshot } },
    });
    const resumed = makeService();
    expect(resumed.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(resumed.getSnapshot()).toEqual(checkpoint.run);
    const oldScheduler = JSON.parse(JSON.stringify(checkpoint));
    oldScheduler.run.lastEncounterCommit.schedulerFormatVersion = 4;
    const rejected = makeService();
    expect(rejected.restoreSaveSnapshot(oldScheduler)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(rejected.getSnapshot()).toBeNull();
  });

  test('blocks an Edge from the live Counter until the Encounter installs a satisfying value', () => {
    const gatedMap: GameplayMapDef = {
      ...definition,
      edges: [
        { fromNodeId: 'first', toNodeId: 'second', condition: { kind: 'counter', counterId: 'route-step', comparison: 'gte', value: 3 } },
        { fromNodeId: 'second', toNodeId: 'exit' },
      ],
    };
    const service = makeService(gatedMap);
    const started = service.start(gatedMap.id, party);
    commit(service, started.runId, 'edge-counter-1');
    commit(service, started.runId, 'edge-counter-2');
    const beforeRejectedMove = service.getSnapshot();
    expect(beforeRejectedMove?.mapRunFacts?.counters).toEqual([{ id: 'route-step', value: 2 }]);
    expect(() => service.move(started.runId, 'second')).toThrow(/unsatisfied MapRun condition/);
    expect(service.getSnapshot()).toEqual(beforeRejectedMove);
  });

  test('recomputes a live Edge gate after restoring the Run', () => {
    const source = makeService();
    const started = source.start(definition.id, party);
    const checkpoint = source.createSaveSnapshot()!;
    const resumed = makeService();
    expect(resumed.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });

    commit(resumed, started.runId, 'restore-edge-counter-1');
    commit(resumed, started.runId, 'restore-edge-counter-2');
    expect(resumed.getSnapshot()?.mapRunFacts?.counters).toEqual([{ id: 'route-step', value: 2 }]);
    expect(resumed.move(started.runId, 'second').currentNodeId).toBe('second');
  });

  test('rejects forged candidate snapshots in the active Encounter and scheduler start snapshot', () => {
    const service = makeService();
    const started = service.start(definition.id, party);
    commit(service, started.runId, 'snapshot-tamper');
    const checkpoint = service.createSaveSnapshot()!;
    const tamper = (mutate: (value: any) => void) => {
      const forged = JSON.parse(JSON.stringify(checkpoint));
      mutate(forged);
      const restored = makeService();
      expect(restored.restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
      expect(restored.getSnapshot()).toBeNull();
    };
    tamper(value => { value.run.activeEncounter.candidateSourceSnapshot.mapRunFacts.counters[0].value += 1; });
    tamper(value => { value.run.activeEncounter.candidateSourceSnapshot.unknown = true; });
    tamper(value => { value.run.lastEncounterCommit.schedulerStartSnapshot.encounter.candidateSourceSnapshot.mapRunFacts.counters[0].value += 1; });
  });

  test('uses the Encounter snapshot for CardRef and Status action eligibility', () => {
    const map: GameplayMapDef = { ...definition,
      candidatePools: [...(definition.candidatePools ?? []), {
        id: 'eligible-only-when-flag', gate: { kind: 'flag', flagId: 'route-open', value: true },
        entries: [{ kind: 'action', actionId: 'status-action', weight: 1 }, { kind: 'action', actionId: 'card-action', weight: 1 },
          { kind: 'action', actionId: 'card-target', weight: 1 }],
      }],
      nodes: definition.nodes.map(node => node.id === 'first' && node.encounter ? { ...node, encounter: {
        ...node.encounter, participants: [
          { characterId: 'shiroko', actions: [], candidatePoolIds: ['eligible-only-when-flag'] },
          { characterId: 'serika', actions: [], candidatePoolIds: ['eligible-only-when-flag'] },
        ],
      } } : node),
    };
    const encounter = map.nodes[0].encounter!;
    const frozenClosed = { formatVersion: 1 as const, mapRunFacts: {
      counters: [{ id: 'route-step', value: 0 }], flags: [{ id: 'route-open', value: false }],
    } };
    const frozenOpen = { formatVersion: 1 as const, mapRunFacts: {
      counters: [{ id: 'route-step', value: 0 }], flags: [{ id: 'route-open', value: true }],
    } };
    const status = [{ holder: { kind: 'partyCharacter' as const, id: 'shiroko' }, statusId: 'burn',
      source: { kind: 'partyCharacter' as const, id: 'shiroko' }, actionId: 'status-action', appliedRound: 1,
      lastTriggeredRound: null, stacks: 1, remainingRounds: 1 }];
    const validateStatus = (candidateSourceSnapshot: typeof frozenOpen) => validateMapEncounterStatusInstances(status, {
      map, encounter, currentRound: 2, candidateSourceSnapshot,
    });
    expect(validateStatus(frozenClosed)).toBeNull();
    expect(validateStatus(frozenOpen)).toHaveLength(1);

    const scope = { runId: 'card-test-run', mapId: map.id, nodeId: 'first', activityId: null, round: 1 } as const;
    const cardRef = { kind: 'card' as const, scope, id: JSON.stringify(['hand', 'partyCharacter', 'serika', 'card-target']) };
    const cardChoice = { characterId: 'shiroko', actionId: 'card-action', overrideKind: null, targetCard: cardRef } as const;
    const activeChoices = [cardChoice, { characterId: 'serika', actionId: 'card-target', overrideKind: null } as const];
    expect(() => resolveMapCardEffects(map, scope, [cardChoice], activeChoices, frozenClosed)).toThrow(/eligible scost card/);
    expect(() => resolveMapCardEffects(map, scope, [cardChoice], activeChoices, frozenOpen)).not.toThrow();
  });
});
