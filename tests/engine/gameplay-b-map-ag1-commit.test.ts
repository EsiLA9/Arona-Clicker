import { describe, expect, test, vi } from 'vitest';
import { createGameCommands } from '../../src/arona-clicker/runtime/runtime-commands';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { baseDatapack } from '../../src/data/test-datapack';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import type { MapContentResolver } from '../../src/arona-clicker/contracts/map/map-content-resolver';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { MapRunError, MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createMapEffectRandomState } from '../../src/arona-clicker/services/map/gameplay-b-effect-rng';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';

const party = [{ characterId: 'shiroko', variantId: 'Shiroko' }, { characterId: 'serika', variantId: 'Serika' }] as const;
const common = {
  id: 'test:map:ag1-queue', name: 'AG-1 Queue', resumeVersion: 5, executionContractId: 'AG-1' as const,
  startNodeId: 'start', exitNodeIds: ['exit'], partyCharacterIds: ['shiroko', 'serika'],
  initialPartyHp: [{ characterId: 'shiroko', initialHp: 10, maxHp: 10 }, { characterId: 'serika', initialHp: 10, maxHp: 10 }],
  partyAgility: [{ characterId: 'serika', agility: 8 }],
  initialPlayerCost: 1,
  mapRunFacts: {
    counters: [{ id: 'run-step', initial: 2, min: 0, max: 8 }],
    flags: [{ id: 'route-open', initial: false }],
  },
  actions: [
    { id: 'shiroko-spend', name: 'Spend', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 }, target: { kind: 'none' as const },
      costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }] },
    { id: 'serika-refill', name: 'Refill', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 }, target: { kind: 'none' as const },
      costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'supplies', delta: 1 }] } },
  ],
  initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
  nodes: [
    { id: 'start', title: 'Start' },
    { id: 'battle', title: 'Battle', encounter: { title: 'Battle', participants: [
      { characterId: 'shiroko', actions: [{ actionId: 'shiroko-spend', tendencyWeight: 1 }] },
      { characterId: 'serika', actions: [{ actionId: 'serika-refill', tendencyWeight: 1 }] },
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
const randomTargetMap: GameplayMapDef = {
  ...common,
  id: 'test:map:ag1-effect-random',
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

function resolverOf(definition: GameplayMapDef): MapContentResolver {
  return { resolve: mapId => mapId === definition.id ? definition : null };
}
function resolveVariant(variantId: string): string | null {
  return variantId === 'Shiroko' ? 'shiroko' : variantId === 'Serika' ? 'serika' : null;
}
function token(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, ...(encounter.activityId ? { activityId: encounter.activityId } : {}),
    round: encounter.round, draftVersion: encounter.draftVersion };
}
function startEncounter(definition: GameplayMapDef) {
  const service = new MapRunService(resolverOf(definition), resolveVariant);
  const started = service.start(definition.id, party);
  const encounter = service.move(started.runId, 'battle');
  if (!encounter.activeEncounter) throw new Error('Expected active Encounter');
  return { service, runId: started.runId, snapshot: encounter, active: encounter.activeEncounter };
}

function additionalTargetMap(id: string, primary: 'partyCharacter' | 'enemy', additional: 'partyCharacter' | 'enemy'): GameplayMapDef {
  const enemyId = primary === 'partyCharacter' && additional === 'enemy' ? 'shiroko' : 'e1';
  const action = { id: 'secondary-target', name: 'Secondary Target', eligibleCharacterIds: ['shiroko'],
    agility: { base: 0, max: 8 },
    target: primary === 'partyCharacter' ? { kind: 'partyCharacter' as const } : { kind: 'enemy' as const },
    additionalTarget: additional };
  return { ...common, id, resumeVersion: 5, executionContractId: 'AG-1', initialTeamResources: [], partyAgility: [],
    actions: [action], nodes: [
      { id: 'start', title: 'Start' },
      { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [{ id: enemyId, initialHp: 10, maxHp: 10 }],
        participants: [{ characterId: 'shiroko', actions: [{ actionId: action.id, tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [] }] } },
      { id: 'exit', title: 'Exit' },
    ], edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }] };
}

const reviveQueueMap: GameplayMapDef = {
  id: 'test:map:ag1-revive-queue', name: 'Revive Queue', resumeVersion: 1, executionContractId: 'AG-1',
  startNodeId: 'start', exitNodeIds: ['exit'], partyCharacterIds: ['shiroko', 'serika'],
  partyAgility: [{ characterId: 'shiroko', agility: 0 }, { characterId: 'serika', agility: 0 }],
  initialPartyHp: [{ characterId: 'shiroko', initialHp: 10, maxHp: 10 }, { characterId: 'serika', initialHp: 1, maxHp: 10 }],
  initialPlayerCost: 2,
  actions: [
    { id: 'knockout', name: 'Knockout', eligibleCharacterIds: [], agility: { base: 20, max: 20 },
      target: { kind: 'partyCharacter', preference: 'lowestHpRatio' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
    { id: 'revive', name: 'Revive', eligibleCharacterIds: [], agility: { base: 10, max: 10 },
      target: { kind: 'partyCharacter', includeDefeated: true },
      effectProgram: { resolve: [{ op: 'revive', target: 'primary', amount: 3 }] } },
    { id: 'serika-followup', name: 'Serika Follow-up', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 0 },
      target: { kind: 'none' }, effectProgram: { resolve: [{ op: 'hpChange', target: 'source', delta: 1 }] } },
  ],
  nodes: [
    { id: 'start', title: 'Start' },
    { id: 'battle', title: 'Battle', encounter: { title: 'Revive Queue', abilityActionIds: ['revive'],
      enemies: [{ id: 'raider', initialHp: 10, maxHp: 10, agility: 20, actions: [{ actionId: 'knockout', tendencyWeight: 1 }] }],
      participants: [{ characterId: 'serika', actions: [{ actionId: 'serika-followup', tendencyWeight: 1 }] }] } },
    { id: 'exit', title: 'Exit' },
  ],
  edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }],
};

describe('AG-1 MapRun commit queue', () => {
  test('allows a selected downed Party primary and lets a later queued source act after revive', () => {
    const { service, runId, active } = startEncounter(reviveQueueMap);
    service.setAbilityDraft(runId, 'revive', { kind: 'partyCharacter', characterId: 'serika' }, token(active));
    const ready = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId)!;
    expect(preview.canCommit).toBe(true);
    expect((preview.executionSequence ?? []).map(row => row.sourceKind)).toEqual(['enemyAction', 'ability', 'partyAction']);
    expect(preview.effectTrace).toMatchObject([
      { op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, after: 0 },
      { op: 'revive', identity: { kind: 'partyCharacter', id: 'serika' }, beforeHp: 0, afterHp: 3, outcome: 'revived' },
      { op: 'hpChange', identity: { kind: 'partyCharacter', id: 'serika' }, before: 3, after: 4 },
    ]);
    const committed = service.commitEncounterRound({ runId, requestId: 'revive-queue',
      expectedCommitVersion: ready.commitVersion, draft: token(ready.activeEncounter!) });
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(4);
    expect(committed.lastEncounterCommit?.executionSequence?.map(row => row.sourceKind))
      .toEqual(['enemyAction', 'ability', 'partyAction']);
    expect(committed.lastEncounterCommit).toMatchObject({ schedulerFormatVersion: 5, programReceiptVersion: 1 });
    const checkpoint = service.createSaveSnapshot()!;
    const restored = new MapRunService(resolverOf(reviveQueueMap), resolveVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()?.lastEncounterCommit?.effectTrace).toEqual(committed.lastEncounterCommit?.effectTrace);
    const forged = structuredClone(checkpoint) as any;
    forged.run.lastEncounterCommit.effectTrace.find((row: any) => row.op === 'revive').afterHp = 5;
    forged.run.activeEncounter.lastCommit.effectTrace.find((row: any) => row.op === 'revive').afterHp = 5;
    expect(new MapRunService(resolverOf(reviveQueueMap), resolveVariant).restoreSaveSnapshot(forged))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('selects scheduler v6 and receipts Shield independently from Program evidence', () => {
    const shieldMap: GameplayMapDef = { ...common, id: 'test:map:ag1-shield-receipt', resumeVersion: 1,
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
    };
    const { service, runId, active } = startEncounter(shieldMap);
    expect(active.shields).toEqual({});
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId)!;
    expect(preview).toMatchObject({ canCommit: true, schedulerFormatVersion: 6, shieldReceiptVersion: 1,
      shieldStart: {}, plannedShields: { 'partyCharacter:shiroko': 2 },
      shieldTrace: [
        { op: 'shieldAdd', identity: { kind: 'partyCharacter', id: 'shiroko' }, requestedAmount: 3, shieldBefore: 0, added: 3, shieldAfter: 3 },
        { op: 'damage', identity: { kind: 'partyCharacter', id: 'shiroko' }, requestedAmount: 1, shieldBefore: 3, absorbed: 1, shieldAfter: 2, remainingDamage: 0, hpBefore: 10, hpAfter: 10 },
      ] });
    expect(service.getSnapshot()).toEqual(before);

    const committed = service.commitEncounterRound({ runId, requestId: 'shield-v6',
      expectedCommitVersion: before.commitVersion, draft: token(active) });
    expect(committed.lastEncounterCommit).toMatchObject({ executionContractId: 'AG-1', schedulerFormatVersion: 6,
      schedulerStartSnapshot: { encounter: { shields: {} } }, shieldReceiptVersion: 1, shieldStart: {},
      plannedShields: { 'partyCharacter:shiroko': 2 }, programReceiptVersion: 1 });
    expect(committed.activeEncounter?.shields).toEqual({ 'partyCharacter:shiroko': 2 });
    expect(committed.partyHp.find(row => row.characterId === 'shiroko')?.currentHp).toBe(10);
    expect(committed.teamResources).toContainEqual({ resourceId: 'supplies', value: 1 });
  });

  test('threads the v6 Shield ledger through forTargets, loopTarget, and targetCount', () => {
    const shieldLoopMap: GameplayMapDef = { ...common, id: 'test:map:ag1-shield-loop-ledger', resumeVersion: 1,
      mapRunFacts: undefined, partyAgility: [], initialTeamResources: [],
      actions: [
        { id: 'shield-loop', name: 'Shield Loop', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [
            { op: 'forTargets', targetSet: { side: 'enemy', order: 'definition' }, body: [
              { op: 'shieldAdd', target: 'primary', amount: { kind: 'targetCount' } },
            ] },
            { op: 'forTargets', targetSet: { side: 'enemy', order: 'definition' }, body: [
              { op: 'hpChange', target: 'loopTarget', delta: -1 },
            ] },
          ] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 }, target: { kind: 'none' } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 10, maxHp: 10 }, { id: 'e2', initialHp: 10, maxHp: 10 },
        ], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'shield-loop', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(shieldLoopMap);
    const committed = service.commitEncounterRound({ runId, requestId: 'shield-loop-v6',
      expectedCommitVersion: service.getSnapshot()!.commitVersion, draft: token(active) });
    expect(committed.lastEncounterCommit).toMatchObject({ schedulerFormatVersion: 6, shieldReceiptVersion: 1,
      plannedShields: { 'enemy:e1': 4 },
      shieldTrace: [
        { op: 'shieldAdd', identity: { kind: 'enemy', id: 'e1' }, requestedAmount: 2, shieldAfter: 2 },
        { op: 'shieldAdd', identity: { kind: 'enemy', id: 'e1' }, requestedAmount: 2, shieldAfter: 4 },
      ] });
    expect(committed.activeEncounter?.enemies).toEqual([
      { enemyId: 'e1', currentHp: 9 }, { enemyId: 'e2', currentHp: 9 },
    ]);
  });

  test('keeps the Shield Receipt v1 on a Shield Map when the Shield source is skipped', () => {
    const skippedShieldMap: GameplayMapDef = { ...common, id: 'test:map:ag1-shield-skipped-source', resumeVersion: 1,
      mapRunFacts: undefined, partyAgility: [], initialTeamResources: [],
      actions: [
        { id: 'finish-battle', name: 'Finish Battle', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: -1 }] } },
        { id: 'late-shield', name: 'Late Shield', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 },
          target: { kind: 'self' }, effectProgram: { resolve: [{ op: 'shieldAdd', target: 'source', amount: 3 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [{ id: 'e1', initialHp: 1, maxHp: 1 }], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'finish-battle', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'late-shield', tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(skippedShieldMap);
    const committed = service.commitEncounterRound({ runId, requestId: 'shield-skipped-v6',
      expectedCommitVersion: service.getSnapshot()!.commitVersion, draft: token(active) });
    expect(committed.lastEncounterCommit).toMatchObject({ schedulerFormatVersion: 6, shieldReceiptVersion: 1,
      shieldStart: {}, plannedShields: {}, shieldTrace: [],
      executionSequence: [
        { actionId: 'finish-battle', skipReason: null },
        { actionId: 'late-shield', skipReason: 'roundEnded' },
      ] });
  });

  test('applies one later prepared CardRef amount modifier and receipts hit evidence', () => {
    const definition: GameplayMapDef = { ...common, id: 'test:map:ag1-card-modifier', resumeVersion: 6, initialTeamResources: [], partyAgility: [],
      actions: [
        { id: 'boost', name: 'Boost', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'card', side: 'ally' }, effectProgram: { resolve: [
            { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 },
          ] } },
        { id: 'hit', name: 'Hit', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 8 }, target: { kind: 'enemy' },
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] } },
      ],
      nodes: [{ id: 'start', title: 'Start' }, { id: 'battle', title: 'Battle', encounter: { title: 'Battle',
        enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'boost', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'hit', tendencyWeight: 1 }] },
        ] } }, { id: 'exit', title: 'Exit' }],
    };
    const { service, runId, active } = startEncounter(definition);
    const target = service.getCards(runId).find(card => card.owner.kind === 'partyCharacter'
      && card.owner.id === 'serika' && card.actionId === 'hit')?.ref;
    if (!target) throw new Error('Expected the selected target CardRef');
    service.setPreparedCardTarget(runId, 'shiroko', target, token(active));
    const committed = service.commitEncounterRound({ runId, requestId: 'modifier-hit',
      expectedCommitVersion: service.getSnapshot()!.commitVersion,
      draft: token(service.getSnapshot()!.activeEncounter!) });
    expect(committed.lastEncounterCommit).toMatchObject({ programReceiptVersion: 2,
      cardEffectModifierReceipts: [{ sourceOwnerId: 'shiroko', targetOwnerId: 'serika', delta: 2,
        sourceExecutionIndex: 0, targetExecutionIndex: 1, outcome: 'applied', hits: [{
          op: 'damage', requestedAmount: 3, modifierDelta: 2, modifiedRequestedAmount: 5, before: 10, after: 5, hpDelta: -5,
        }] }] });
    expect(committed.activeEncounter?.enemies[0]?.currentHp).toBe(5);
  });

  test.each([
    ['sourceSkipped', 1, 10, 6, 9],
    ['notApplied', 10, 1, 9, 7],
  ] as const)('records CardRef modifier %s outcome and reason', (outcome, sourceHp, targetHp, boostAgility, enemyAgility) => {
    const definition: GameplayMapDef = { ...common, id: `test:map:ag1-card-modifier-${outcome}`, resumeVersion: 6,
      initialTeamResources: [], partyAgility: [],
      partyCharacterIds: outcome === 'notApplied' ? ['serika', 'shiroko'] : ['shiroko', 'serika'],
      initialPartyHp: outcome === 'notApplied'
        ? [{ characterId: 'serika', initialHp: targetHp, maxHp: 10 }, { characterId: 'shiroko', initialHp: sourceHp, maxHp: 10 }]
        : [{ characterId: 'shiroko', initialHp: sourceHp, maxHp: 10 }, { characterId: 'serika', initialHp: targetHp, maxHp: 10 }],
      actions: [
        { id: 'boost', name: 'Boost', eligibleCharacterIds: ['shiroko'], agility: { base: boostAgility, max: 10 },
          target: { kind: 'card', side: 'ally' }, effectProgram: { resolve: [
            { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 },
          ] } },
        { id: 'hit', name: 'Hit', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 10 }, target: { kind: 'enemy' },
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 3 }] } },
        { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], agility: { base: enemyAgility, max: 10 },
          target: { kind: 'partyCharacter' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 2 }] } },
      ],
      nodes: [{ id: 'start', title: 'Start' }, { id: 'battle', title: 'Battle', encounter: { title: 'Battle',
        enemies: [{ id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] }], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'boost', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'hit', tendencyWeight: 1 }] },
        ] } }, { id: 'exit', title: 'Exit' }],
    };
    const service = new MapRunService(resolverOf(definition), resolveVariant);
    const started = service.start(definition.id, outcome === 'notApplied' ? [party[1], party[0]] : party);
    const runId = started.runId;
    const active = service.move(runId, 'battle').activeEncounter!;
    const card = service.getCards(runId).find(row => row.owner.kind === 'partyCharacter'
      && row.owner.id === 'serika' && row.actionId === 'hit')?.ref;
    if (!card) throw new Error('Expected target CardRef');
    service.setPreparedCardTarget(runId, 'shiroko', card, token(active));
    const ready = service.getSnapshot()!;
    const committed = service.commitEncounterRound({ runId, requestId: `modifier-${outcome}`,
      expectedCommitVersion: ready.commitVersion, draft: token(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit?.cardEffectModifierReceipts?.[0]).toMatchObject({ outcome,
      reason: 'defeated', sourceOwnerId: 'shiroko', targetOwnerId: 'serika' });
    expect(committed.lastEncounterCommit?.programReceiptVersion).toBe(2);
    expect(committed.lastEncounterCommit?.cardEffectModifierReceipts?.[0]?.hits).toEqual([]);
  });
  test.each([
    ['Enemy primary with Party secondary', 'enemy', 'partyCharacter', { kind: 'partyCharacter', characterId: 'serika' },
      { targetEnemyId: 'e1', additionalTargetCharacterId: 'serika' }, { kind: 'enemy', enemyId: 'e1' }],
    ['Party primary with Enemy secondary of the same text ID', 'partyCharacter', 'enemy', { kind: 'enemy', enemyId: 'shiroko' },
      { targetCharacterId: 'shiroko', additionalTargetEnemyId: 'shiroko' }, { kind: 'partyCharacter', characterId: 'shiroko' }],
  ] as const)('binds and replays cross-side secondary identity: %s', (_label, primaryKind, additionalKind, target, selection, primaryReceiptTarget) => {
    const definition = additionalTargetMap(`test:map:ag1-cross-side-${primaryKind}-${additionalKind}`, primaryKind, additionalKind);
    const { service, runId, active } = startEncounter(definition);
    const selected = service.setPreparedAdditionalTarget(runId, 'shiroko', target, token(active));
    const encounter = selected.activeEncounter!;
    expect(encounter.targetSelections).toContainEqual({ characterId: 'shiroko', ...selection });
    const draftCheckpoint = service.createSaveSnapshot()!;
    const draftRestored = new MapRunService(resolverOf(definition), resolveVariant);
    expect(draftRestored.restoreSaveSnapshot(draftCheckpoint)).toMatchObject({ status: 'restored' });
    expect(draftRestored.getSnapshot()?.activeEncounter?.targetSelections).toContainEqual({ characterId: 'shiroko', ...selection });
    const preview = service.previewEncounterCommit(runId)!;
    expect(preview).toMatchObject({ canCommit: true, executionContractId: 'AG-1', schedulerFormatVersion: 5,
      executionSequence: [{ sourceKind: 'partyAction', actionId: 'secondary-target', target: primaryReceiptTarget,
        additionalTarget: target }] });
    const committed = service.commitEncounterRound({ runId, requestId: `secondary-${primaryKind}-${additionalKind}`,
      expectedCommitVersion: selected.commitVersion, draft: token(encounter) });
    expect(committed.lastEncounterCommit?.settlements).toContainEqual(expect.objectContaining({
      characterId: 'shiroko', actionId: 'secondary-target', additionalTarget: target,
    }));
    expect(committed.lastEncounterCommit?.schedulerStartSnapshot?.encounter.targetSelections).toContainEqual({
      characterId: 'shiroko', ...selection,
    });
    const checkpoint = service.createSaveSnapshot()!;
    const restored = new MapRunService(resolverOf(definition), resolveVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    expect(restored.getSnapshot()?.lastEncounterCommit?.executionSequence).toMatchObject([
      { additionalTarget: target },
    ]);
  });

  test('rejects a Party secondary that is the source or the selected Party primary', () => {
    const definition = additionalTargetMap('test:map:ag1-secondary-identity', 'partyCharacter', 'partyCharacter');
    const { service, runId, active } = startEncounter(definition);
    const primarySelected = service.setPreparedTarget(runId, 'shiroko', 'serika', token(active));
    expect(() => service.setPreparedAdditionalTarget(runId, 'shiroko',
      { kind: 'partyCharacter', characterId: 'serika' }, token(primarySelected.activeEncounter!)))
      .toThrow(/Additional target is not legal/);
    expect(() => service.setPreparedAdditionalTarget(runId, 'shiroko',
      { kind: 'partyCharacter', characterId: 'shiroko' }, token(primarySelected.activeEncounter!)))
      .toThrow(/Additional target is not legal/);
  });

  test('settles ordered additionalActor balances before the next source reads after paying its cost', () => {
    const first = { id: 'write-secondary', name: 'Write Secondary', eligibleCharacterIds: ['shiroko'],
      agility: { base: 0, max: 8 }, target: { kind: 'partyCharacter' as const }, additionalTarget: 'enemy' as const,
      costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [
        { op: 'resourceChange' as const, account: 'additionalActor' as const, resourceId: 'focus', delta: 3 },
        { op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'supplies', delta: 1 },
      ] } };
    const later = { id: 'read-secondary', name: 'Read Secondary', eligibleCharacterIds: ['serika'],
      agility: { base: 0, max: 8 }, target: { kind: 'partyCharacter' as const }, additionalTarget: 'enemy' as const,
      costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: {
        kind: 'add' as const,
        left: { kind: 'resourceBalance' as const, account: 'additionalActor' as const, resourceId: 'focus' },
        right: { kind: 'resourceBalance' as const, account: 'sourceTeam' as const, resourceId: 'supplies' },
      } }] } };
    const definition: GameplayMapDef = { ...common, id: 'test:map:ag1-additional-ledger', resumeVersion: 5,
      executionContractId: 'AG-1', partyAgility: [{ characterId: 'shiroko', agility: 8 }],
      initialTeamResources: [{ resourceId: 'supplies', value: 2 }], actions: [first, later], nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 10, maxHp: 10, initialResources: [{ resourceId: 'focus', value: 0 }] },
          { id: 'e2', initialHp: 10, maxHp: 10, initialResources: [{ resourceId: 'focus', value: 0 }] },
        ], participants: [
          { characterId: 'shiroko', actions: [{ actionId: first.id, tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: later.id, tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ], edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }] };
    const { service, runId, active } = startEncounter(definition);
    const firstSelected = service.setPreparedAdditionalTarget(runId, 'shiroko', { kind: 'enemy', enemyId: 'e2' }, token(active));
    const laterSelected = service.setPreparedAdditionalTarget(runId, 'serika', { kind: 'enemy', enemyId: 'e2' },
      token(firstSelected.activeEncounter!));
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId)!;
    expect(preview.executionSequence).toMatchObject([
      { actionId: first.id, additionalTarget: { kind: 'enemy', enemyId: 'e2' } },
        { actionId: later.id, additionalTarget: { kind: 'enemy', enemyId: 'e2' },
        hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -4 }] },
    ]);
    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-additional-ledger',
      expectedCommitVersion: before.commitVersion, draft: token(laterSelected.activeEncounter!) });
    expect(committed.activeEncounter?.enemyActorResources).toContainEqual({ enemyId: 'e2', resourceId: 'focus', value: 3 });
    expect(committed.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
    expect(committed.partyHp.find(row => row.characterId === 'shiroko')?.currentHp).toBe(6);
    expect(committed.lastEncounterCommit?.effectTrace).toContainEqual(expect.objectContaining({
      source: { kind: 'partyCharacter', id: 'serika' }, op: 'damage', amount: 4,
    }));
  });

  test('preserves a downed queued secondary identity, pays source cost, and zeros its Actor write', () => {
    const fast = { id: 'fast-kill-secondary', name: 'Fast Kill', eligibleCharacterIds: ['shiroko'],
      agility: { base: 8, max: 8 }, target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 10 }] } };
    const slow = { id: 'slow-write-secondary', name: 'Slow Write', eligibleCharacterIds: ['serika'],
      agility: { base: 0, max: 0 }, target: { kind: 'partyCharacter' as const }, additionalTarget: 'enemy' as const,
      costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }],
      effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'additionalActor' as const, resourceId: 'focus', delta: 1 }] } };
    const definition: GameplayMapDef = { ...common, id: 'test:map:ag1-downed-secondary', resumeVersion: 5,
      executionContractId: 'AG-1', partyAgility: [{ characterId: 'shiroko', agility: 8 }],
      initialTeamResources: [{ resourceId: 'supplies', value: 1 }], actions: [fast, slow], nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 1, maxHp: 1, initialResources: [{ resourceId: 'focus', value: 2 }] },
          { id: 'e2', initialHp: 10, maxHp: 10, initialResources: [{ resourceId: 'focus', value: 0 }] },
        ], participants: [
          { characterId: 'shiroko', actions: [{ actionId: fast.id, tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: slow.id, tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ], edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }] };
    const { service, runId, active } = startEncounter(definition);
    const additionalSelected = service.setPreparedAdditionalTarget(runId, 'serika', { kind: 'enemy', enemyId: 'e1' }, token(active));
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId)!;
    expect(preview.executionSequence).toMatchObject([
      { actionId: fast.id, additionalTarget: null },
      { actionId: slow.id, target: { kind: 'partyCharacter', characterId: 'shiroko' }, additionalTarget: { kind: 'enemy', enemyId: 'e1' },
        resourceChanges: [{ kind: 'cost', resourceId: 'supplies', delta: -1 }, { kind: 'effect', enemyId: 'e1', resourceId: 'focus', delta: 0 }] },
    ]);
    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-downed-secondary',
      expectedCommitVersion: before.commitVersion, draft: token(additionalSelected.activeEncounter!) });
    expect(committed.activeEncounter?.enemyActorResources).toContainEqual({ enemyId: 'e1', resourceId: 'focus', value: 2 });
    expect(committed.activeEncounter?.enemyTeamResources).toEqual([]);
    expect(committed.activeEncounter?.enemies.find(row => row.enemyId === 'e1')?.currentHp).toBe(0);
    expect(committed.lastEncounterCommit?.effectTrace).toContainEqual(expect.objectContaining({
      source: { kind: 'partyCharacter', id: 'serika' }, op: 'resourceSettlement',
      identity: { kind: 'enemy', id: 'e1' }, intentDelta: 1, delta: 0,
    }));
  });

  test('leaves a run unchanged when a secondary Actor ledger would become negative', () => {
    const invalid = { id: 'negative-secondary', name: 'Negative Secondary', eligibleCharacterIds: ['shiroko'],
      agility: { base: 0, max: 8 }, target: { kind: 'partyCharacter' as const }, additionalTarget: 'enemy' as const,
      effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'additionalActor' as const, resourceId: 'focus', delta: -1 }] } };
    const definition: GameplayMapDef = { ...common, id: 'test:map:ag1-secondary-failure', resumeVersion: 5,
      executionContractId: 'AG-1', initialTeamResources: [], actions: [invalid], nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 10, maxHp: 10, initialResources: [{ resourceId: 'focus', value: 0 }] },
          { id: 'e2', initialHp: 10, maxHp: 10, initialResources: [{ resourceId: 'focus', value: 0 }] },
        ], participants: [{ characterId: 'shiroko', actions: [{ actionId: invalid.id, tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [] }] } },
        { id: 'exit', title: 'Exit' },
      ], edges: [{ fromNodeId: 'start', toNodeId: 'battle' }, { fromNodeId: 'battle', toNodeId: 'exit' }] };
    const { service, runId, active } = startEncounter(definition);
    const selected = service.setPreparedAdditionalTarget(runId, 'shiroko', { kind: 'enemy', enemyId: 'e2' }, token(active));
    const before = service.getSnapshot()!;
    expect(() => service.commitEncounterRound({ runId, requestId: 'ag1-secondary-failure',
      expectedCommitVersion: before.commitVersion, draft: token(selected.activeEncounter!) })).toThrow(/invalid balance/);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('previews and commits the approved refill-before-spend sequence with matching projections', () => {
    const { service, runId, snapshot, active } = startEncounter(common);
    expect(active.hands).toEqual([
      { characterId: 'shiroko', actionIds: ['shiroko-spend'] },
      { characterId: 'serika', actionIds: [] },
    ]);
    const commanded = service.issuePlayerCommand(runId, 'serika', 'serika-refill', token(active));
    const commitToken = token(commanded.activeEncounter!);
    const preview = service.previewEncounterCommit(runId);
    if (!preview) throw new Error('Expected AG-1 Commit preview');
    expect(preview?.diagnostics).toEqual([]);
    expect(preview).toMatchObject({ canCommit: true, executionContractId: 'AG-1', schedulerFormatVersion: 5,
      plannedMapRunFacts: { counters: [{ id: 'run-step', value: 2 }], flags: [{ id: 'route-open', value: false }] },
      executionSequence: [
        { executionIndex: 0, sourceKind: 'partyAction', actionId: 'serika-refill', finalAgility: 8, playerCostSpent: 1,
          sideRank: 0, sourceRank: 0, ownerDeclarationIndex: 1, logicalIndex: 0 },
        { executionIndex: 1, sourceKind: 'partyAction', actionId: 'shiroko-spend', finalAgility: 0, playerCostSpent: 0,
          sideRank: 0, sourceRank: 0, ownerDeclarationIndex: 0, logicalIndex: 0 },
      ] });
    const before = service.getSnapshot()!;
    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-golden', expectedCommitVersion: before.commitVersion, draft: commitToken });
    expect(committed.teamResources).toEqual([{ resourceId: 'supplies', value: 0 }]);
    expect(committed.playerCost).toBe(0);
    expect(committed.lastEncounterCommit).toMatchObject({
      executionContractId: 'AG-1', schedulerFormatVersion: 5,
      plannedMapRunFacts: { counters: [{ id: 'run-step', value: 2 }], flags: [{ id: 'route-open', value: false }] },
      schedulerTerminal: { outcome: 'none', checkpoint: null },
      executionSequence: preview.executionSequence,
      settlements: [
        { characterId: 'shiroko', actionId: 'shiroko-spend', resourceChanges: [{ kind: 'cost', delta: -1 }] },
        { characterId: 'serika', actionId: 'serika-refill', overrideKind: 'playerCommand', resourceChanges: [
          { kind: 'cost', delta: -1 }, { kind: 'effect', delta: 1 },
        ] },
      ],
    });
    const schedulerStart = committed.lastEncounterCommit!.schedulerStartSnapshot!;
    expect(committed.lastEncounterCommit?.plannedEffectRandomState).toEqual(schedulerStart.encounter.effectRandomState);
    expect(schedulerStart).toMatchObject({
      runId, mapId: common.id, party, partyAgility: snapshot.partyAgility,
      partyHp: snapshot.partyHp, playerCost: 1, actorResources: snapshot.actorResources,
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      mapRunFacts: { counters: [{ id: 'run-step', value: 2 }], flags: [{ id: 'route-open', value: false }] },
      encounter: {
        nodeId: 'battle', round: 1, draftVersion: commitToken.draftVersion,
        hands: active.hands, enemyHands: active.enemyHands,
        overrides: [{ kind: 'playerCommand', characterId: 'serika', actionId: 'serika-refill' }],
        targetSelections: [], abilityDraft: null, itemDraft: null,
        enemies: [], enemyAgility: [], randomState: active.randomState,
        drawCursorStart: active.drawCursorStart, locals: { counters: {}, flags: {} }, statuses: [],
      },
    });
    expect(Object.isFrozen(schedulerStart)).toBe(true);
    expect(Object.isFrozen(schedulerStart.partyHp)).toBe(true);
    expect(Object.isFrozen(schedulerStart.encounter.hands[0].actionIds)).toBe(true);
    expect(schedulerStart.partyHp).not.toBe(committed.partyHp);
  });

  test('reads source-start balances after cost and carries successful MapRun Facts through the source queue', () => {
    const orderedFacts: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-owner-facts-balances',
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
    };
    const { service, runId, active } = startEncounter(orderedFacts);
    const commanded = service.issuePlayerCommand(runId, 'serika', 'later', token(active));
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: true, diagnostics: [],
      plannedMapRunFacts: { counters: [{ id: 'run-step', value: 3 }], flags: [{ id: 'route-open', value: true }] },
      executionSequence: [{ actionId: 'first' }, { actionId: 'later' }],
    });
    expect(service.getSnapshot()).toEqual(before);

    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-owner-facts-balances',
      expectedCommitVersion: before.commitVersion, draft: token(commanded.activeEncounter!) });
    expect(committed.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
    expect(committed.mapRunFacts).toEqual({ counters: [{ id: 'run-step', value: 3 }], flags: [{ id: 'route-open', value: true }] });
    expect(committed.activeEncounter?.enemies).toEqual([{ enemyId: 'e1', currentHp: 6 }]);
    expect(committed.lastEncounterCommit?.plannedMapRunFacts).toEqual(committed.mapRunFacts);
    expect(committed.lastEncounterCommit?.schedulerStartSnapshot?.mapRunFacts).toEqual({
      counters: [{ id: 'run-step', value: 2 }], flags: [{ id: 'route-open', value: false }],
    });
    expect(committed.lastEncounterCommit?.effectTrace?.filter(row => row.op === 'damage'))
      .toMatchObject([{ amount: 0 }, { amount: 1 }, { amount: 3 }]);
  });

  test('derives Encounter Effect RNG and carries one cursor across sources and rounds', () => {
    const { service, runId, active } = startEncounter(randomTargetMap);
    const startEffectState = createMapEffectRandomState(active.randomState.seed);
    expect(active.effectRandomState).toEqual(startEffectState);
    expect(active.effectRandomState?.algorithm).not.toBe(active.randomState.algorithm);
    const staleDraft = token(active);
    const before = service.getSnapshot()!;
    expect(() => service.commitEncounterRound({ runId, requestId: 'ag1-effect-random-expired',
      expectedCommitVersion: before.commitVersion - 1, draft: staleDraft })).toThrow(MapRunError);
    expect(service.getSnapshot()).toEqual(before);

    const preview = service.previewEncounterCommit(runId)!;
    const repeatedPreview = service.previewEncounterCommit(runId)!;
    const randomTrace = preview.effectTrace?.filter(row => row.op === 'targetSet') ?? [];
    expect(preview).toMatchObject({ canCommit: true, schedulerFormatVersion: 5,
      plannedEffectRandomState: { ...startEffectState, cursor: 2 },
    });
    expect(randomTrace).toHaveLength(2);
    expect(randomTrace.map(row => row.op === 'targetSet' ? row.random : undefined)).toMatchObject([
      { seed: startEffectState.seed, cursorBefore: 0, cursorAfter: 1 },
      { seed: startEffectState.seed, cursorBefore: 1, cursorAfter: 2 },
    ]);
    expect(repeatedPreview.effectTrace).toEqual(preview.effectTrace);
    expect(repeatedPreview.plannedEffectRandomState).toEqual(preview.plannedEffectRandomState);
    expect(service.getSnapshot()).toEqual(before);

    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-effect-random-success',
      expectedCommitVersion: before.commitVersion, draft: token(active) });
    expect(committed.lastEncounterCommit).toMatchObject({ schedulerFormatVersion: 5,
      schedulerStartSnapshot: { encounter: { effectRandomState: startEffectState } },
      plannedEffectRandomState: { ...startEffectState, cursor: 2 },
    });
    expect(committed.activeEncounter?.effectRandomState).toEqual(committed.lastEncounterCommit?.plannedEffectRandomState);
    expect(committed.activeEncounter?.effectRandomState?.cursor).toBe(2);
  });

  test('leaves Effect RNG unchanged for an empty random target set', () => {
    const emptyTargets: GameplayMapDef = {
      ...randomTargetMap,
      id: 'test:map:ag1-effect-random-empty-targets',
      nodes: randomTargetMap.nodes.map(node => node.id === 'battle' && node.encounter
        ? { ...node, encounter: { ...node.encounter, enemies: [] } } : node),
    };
    const { service, runId, active } = startEncounter(emptyTargets);
    const initialState = active.effectRandomState;
    const preview = service.previewEncounterCommit(runId)!;
    expect(preview.plannedEffectRandomState).toEqual(initialState);
    expect(preview.effectTrace?.find(row => row.op === 'targetSet')).toMatchObject({
      identities: [], random: { cursorBefore: 0, cursorAfter: 0 },
    });
    const before = service.getSnapshot()!;
    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-effect-random-empty',
      expectedCommitVersion: before.commitVersion, draft: token(active) });
    expect(committed.activeEncounter?.effectRandomState).toEqual(initialState);
    expect(committed.lastEncounterCommit?.plannedEffectRandomState).toEqual(initialState);
  });

  test('does not install Effect RNG after a failed source plan', () => {
    const overflowRandom: GameplayMapDef = {
      ...randomTargetMap,
      id: 'test:map:ag1-effect-random-overflow',
      initialTeamResources: [{ resourceId: 'supplies', value: Number.MAX_SAFE_INTEGER }],
      actions: (randomTargetMap.actions ?? []).map(action => action.id === 'first-random' ? {
        ...action,
        effectProgram: { resolve: [randomDamageEffect,
          { op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'supplies', delta: 1 }] },
      } : action),
    };
    const { service, runId, active } = startEncounter(overflowRandom);
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: false });
    expect(service.getSnapshot()).toEqual(before);
    const command = { runId, requestId: 'ag1-effect-random-overflow',
      expectedCommitVersion: before.commitVersion, draft: token(active) };
    expect(() => service.commitEncounterRound(command)).toThrow(MapRunError);
    expect(service.getSnapshot()).toEqual(before);
    expect(() => service.commitEncounterRound(command)).toThrow(MapRunError);
    expect(service.getSnapshot()).toEqual(before);
    expect(service.getSnapshot()?.activeEncounter?.effectRandomState).toEqual(active.effectRandomState);
  });

  test('derives a fresh Effect RNG for a new Encounter after terminal Commit', () => {
    const terminalMap: GameplayMapDef = {
      ...randomTargetMap,
      id: 'test:map:ag1-effect-random-new-encounter',
      actions: [{ id: 'finish-random', name: 'Finish Random', eligibleCharacterIds: ['shiroko'],
        agility: { base: 0, max: 8 }, target: { kind: 'none' }, effectProgram: { resolve: [randomDamageEffect] } }],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle-a', title: 'Battle A', encounter: { title: 'Battle A', enemies: [{ id: 'e1', initialHp: 1, maxHp: 1 }],
          participants: [{ characterId: 'shiroko', actions: [{ actionId: 'finish-random', tendencyWeight: 1 }] }] } },
        { id: 'battle-b', title: 'Battle B', encounter: { title: 'Battle B', enemies: [{ id: 'e2', initialHp: 5, maxHp: 5 }],
          participants: [{ characterId: 'shiroko', actions: [{ actionId: 'finish-random', tendencyWeight: 1 }] }] } },
        { id: 'exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'start', toNodeId: 'battle-a' }, { fromNodeId: 'battle-a', toNodeId: 'battle-b' },
        { fromNodeId: 'battle-b', toNodeId: 'exit' }],
    };
    const seedSamples = [0.125, 0.75];
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seedSamples.shift() ?? 0);
    try {
      const service = new MapRunService(resolverOf(terminalMap), resolveVariant);
      const started = service.start(terminalMap.id, party);
      const first = service.move(started.runId, 'battle-a').activeEncounter!;
      expect(first.effectRandomState).toEqual(createMapEffectRandomState(first.randomState.seed));
      const before = service.getSnapshot()!;
      const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'ag1-effect-random-terminal',
        expectedCommitVersion: before.commitVersion, draft: token(first) });
      expect(committed.activeEncounter).toBeNull();
      expect(committed.lastEncounterCommit).toMatchObject({
        schedulerTerminal: { outcome: 'victory', checkpoint: 'afterSource' },
        plannedEffectRandomState: { cursor: 1 },
      });
      const second = service.move(started.runId, 'battle-b').activeEncounter!;
      expect(second.effectRandomState).toEqual(createMapEffectRandomState(second.randomState.seed));
      expect(second.effectRandomState?.cursor).toBe(0);
      expect(second.effectRandomState?.seed).not.toBe(committed.lastEncounterCommit?.plannedEffectRandomState?.seed);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('does not admit a Party source that would rely on its own effect to pay cost', () => {
    const selfFund: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-no-self-funding',
      initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
      partyAgility: [{ characterId: 'shiroko', agility: 8 }],
      actions: [
        { id: 'drain-first', name: 'Drain First', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
          target: { kind: 'none' }, effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: -1 }] } },
        { ...common.actions[1], effectProgram: common.actions[1].effectProgram },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'drain-first', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'serika-refill', tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(selfFund);
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: false,
      diagnostics: ['the fixed-party source "serika-refill" cannot afford its resource cost'] });
    expect(() => service.commitEncounterRound({ runId, requestId: 'ag1-no-self-funding',
      expectedCommitVersion: before.commitVersion, draft: token(active) })).toThrow(MapRunError);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('keeps E1 on its grouped upfront affordability path without AG-1 receipt fields', () => {
    const e1 = { ...common, id: 'test:map:e1-queue', resumeVersion: 3, executionContractId: undefined, partyAgility: undefined,
      actions: common.actions.map(action => Object.fromEntries(Object.entries(action).filter(([key]) => key !== 'agility'))) } as unknown as GameplayMapDef;
    const { service, runId, active } = startEncounter(e1);
    service.issuePlayerCommand(runId, 'serika', 'serika-refill', token(active));
    const before = service.getSnapshot();
    expect(service.previewEncounterCommit(runId)).toMatchObject({ canCommit: false });
    expect(service.getSnapshot()).toEqual(before);
  });

  test('rejects a later Party cost after an earlier source without installing any partial state', () => {
    const insufficient: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-late-cost-failure',
      initialTeamResources: [{ resourceId: 'supplies', value: 1 }],
      actions: common.actions.map(action => ({ ...action,
        effectProgram: undefined,
        costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }],
      })),
    };
    const { service, runId, active } = startEncounter(insufficient);
    const commanded = service.issuePlayerCommand(runId, 'serika', 'serika-refill', token(active));
    const before = service.getSnapshot();
    const command = { runId, requestId: 'ag1-late-insufficient', expectedCommitVersion: before!.commitVersion, draft: token(commanded.activeEncounter!) };
    expect(service.previewEncounterCommit(runId)).toMatchObject({ canCommit: false });
    expect(() => service.commitEncounterRound(command)).toThrow(MapRunError);
    expect(service.getSnapshot()).toEqual(before);
    expect(service.getSnapshot()?.commitVersion).toBe(0);
  });

  test('rejects an overflowing later Effect after an earlier HP change without installing either source', () => {
    const effectFailure: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-late-effect-failure',
      partyAgility: [{ characterId: 'shiroko', agility: 8 }],
      initialTeamResources: [{ resourceId: 'supplies', value: Number.MAX_SAFE_INTEGER }],
      actions: [
        { id: 'first-damage', name: 'First Damage', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
          target: { kind: 'self' }, effectProgram: { resolve: [
            { op: 'mapRunCounterAdd', counterId: 'run-step', delta: 1 },
            { op: 'damage', target: 'primary', amount: 2 },
          ] } },
        { id: 'overflow', name: 'Overflow', eligibleCharacterIds: ['serika'], target: { kind: 'self' },
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'first-damage', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'overflow', tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(effectFailure);
    const before = service.getSnapshot()!;
    const command = { runId, requestId: 'ag1-effect-overflow', expectedCommitVersion: before.commitVersion, draft: token(active) };
    expect(service.previewEncounterCommit(runId)).toMatchObject({ canCommit: false });
    expect(() => service.commitEncounterRound(command)).toThrow(MapRunError);
    expect(service.getSnapshot()).toEqual(before);
    expect(service.getSnapshot()?.partyHp).toEqual(before.partyHp);
    expect(service.getSnapshot()?.commitVersion).toBe(0);
  });

  test('does not fabricate an Effect Program Receipt for a successful AG-1 round with plain Actions', () => {
    const plain: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-plain-sequence',
      initialTeamResources: [],
      actions: common.actions.map(action => ({ ...action, costs: undefined, effectProgram: undefined })),
    };
    const { service, runId, active } = startEncounter(plain);
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: true, executionContractId: 'AG-1', schedulerFormatVersion: 5,
      executionSequence: [
        { executionIndex: 0, sourceKind: 'partyAction', actionId: 'serika-refill' },
        { executionIndex: 1, sourceKind: 'partyAction', actionId: 'shiroko-spend' },
      ] });
    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-plain-sequence',
      expectedCommitVersion: before.commitVersion, draft: token(active) });
    expect(committed.lastEncounterCommit).toMatchObject({ executionContractId: 'AG-1', schedulerFormatVersion: 5,
      executionSequence: preview?.executionSequence });
    expect(committed.lastEncounterCommit).not.toHaveProperty('programReceiptVersion');
  });

  test('marks an unaffordable Enemy source free and continues the Party sequence', () => {
    const enemyCost: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-enemy-unaffordable',
      initialTeamResources: [],
      partyAgility: [],
      actions: [
        { id: 'enemy-fast', name: 'Enemy Fast', eligibleCharacterIds: [], agility: { base: 8, max: 8 }, target: { kind: 'none' },
          costs: [{ scope: 'team', resourceId: 'ammo', amount: 1 }],
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'ammo', delta: -1 }] } },
        { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], agility: { base: 0, max: 0 }, target: { kind: 'none' },
          costs: [{ scope: 'team', resourceId: 'ammo', amount: 1 }] },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle',
          initialEnemyTeamResources: [{ resourceId: 'ammo', value: 2 }],
          enemies: [
            { id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-fast', tendencyWeight: 1 }] },
            { id: 'e2', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
          ], participants: [
          { characterId: 'shiroko', actions: [] },
          { characterId: 'serika', actions: [] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(enemyCost);
    const preview = service.previewEncounterCommit(runId);
    expect(preview?.diagnostics).toEqual([]);
    expect(preview).toMatchObject({ canCommit: true, executionSequence: [
      { sourceKind: 'enemyAction', actionId: 'enemy-fast', skipReason: null },
      { sourceKind: 'enemyAction', actionId: 'enemy-hit', skipReason: 'unaffordable', resourceChanges: [] },
    ] });
    const before = service.getSnapshot()!;
    const result = service.commitEncounterRound({ runId, requestId: 'ag1-enemy-unaffordable',
      expectedCommitVersion: before.commitVersion, draft: token(active) });
    expect(result.lastEncounterCommit?.enemyActions).toEqual([
      { enemyId: 'e1', actionId: 'enemy-fast', resourceChanges: [
        { kind: 'cost', scope: 'team', teamSide: 'enemy', resourceId: 'ammo', delta: -1 },
        { kind: 'effect', scope: 'team', teamSide: 'enemy', resourceId: 'ammo', delta: -1 },
      ] },
      { enemyId: 'e2', actionId: 'enemy-hit', skipReason: 'unaffordable', resourceChanges: [] },
    ]);
    expect(result.activeEncounter?.enemyTeamResources).toEqual([{ resourceId: 'ammo', value: 0 }]);
  });

  test('records a terminal reached by RoundEnd Status ticks after the source queue', () => {
    const statusTerminal: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-status-terminal-checkpoint',
      initialTeamResources: [],
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 1 }],
      actions: [{ id: 'apply-burn', name: 'Apply Burn', eligibleCharacterIds: [], target: { kind: 'enemy' },
        effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const,
          statusId: 'burn', stacks: 1, durationRounds: 1 }] } }],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 1, maxHp: 1 },
        ], abilityActionIds: ['apply-burn'], participants: [
          { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(statusTerminal);
    const checkpoint: any = JSON.parse(JSON.stringify(service.createSaveSnapshot()));
    checkpoint.run.activeEncounter.round = 2;
    checkpoint.run.activeEncounter.drawCursorStart = active.randomState.cursor;
    checkpoint.run.activeEncounter.randomState = active.randomState;
    checkpoint.run.activeEncounter.statuses = [{
      holder: { kind: 'enemy', id: 'e1' }, statusId: 'burn',
      source: { kind: 'ability', actionId: 'apply-burn' }, actionId: 'apply-burn',
      appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 1,
    }];
    const restoredOwner = new MapRunService(resolverOf(statusTerminal), resolveVariant);
    expect(restoredOwner.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored' });
    const restoredRun = restoredOwner.getSnapshot()!;
    const restoredActive = restoredRun.activeEncounter!;
    const preview = restoredOwner.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: true,
      schedulerTerminal: { outcome: 'victory', checkpoint: 'afterStatusRoundEnd' },
      executionSequence: [],
    });
    const committed = restoredOwner.commitEncounterRound({ runId, requestId: 'ag1-status-terminal',
      expectedCommitVersion: restoredRun.commitVersion, draft: token(restoredActive) });
    expect(committed.lastEncounterCommit?.schedulerTerminal).toEqual({ outcome: 'victory', checkpoint: 'afterStatusRoundEnd' });
  });

  test('records non-Battle round completion after an empty source sequence', () => {
    const rest: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-nonbattle-terminal-checkpoint',
      initialTeamResources: [],
      actions: [],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Rest', encounter: { title: 'Rest', rounds: 1, participants: [
          { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, snapshot, active } = startEncounter(rest);
    expect(service.previewEncounterCommit(runId)).toMatchObject({ canCommit: true, executionSequence: [] });
    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-nonbattle-terminal',
      expectedCommitVersion: snapshot.commitVersion, draft: token(active) });
    expect(committed.lastEncounterCommit?.schedulerStartSnapshot?.encounter.hands).toEqual(active.hands);
    expect(committed.lastEncounterCommit?.schedulerTerminal).toEqual({ outcome: 'victory', checkpoint: 'afterNonBattleCompletion' });
  });

  test('records later Enemy sources as roundEnded after a faster Party source ends the Battle', () => {
    const battle: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-terminal-order',
      partyAgility: [{ characterId: 'shiroko', agility: 8 }],
      initialTeamResources: [],
      actions: [
        { id: 'kill', name: 'Kill', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
          target: { kind: 'enemy' }, effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 10 }] } },
        { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], agility: { base: 0, max: 0 },
          target: { kind: 'partyCharacter' }, tendencyRole: 'attack',
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
        ], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'kill', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(battle);
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(runId);
    expect(preview?.diagnostics).toEqual([]);
    expect(preview).toMatchObject({ canCommit: true, executionSequence: [
      { executionIndex: 0, sourceKind: 'partyAction', actionId: 'kill', finalAgility: 8, skipReason: null },
      { executionIndex: 1, sourceKind: 'enemyAction', actionId: 'enemy-hit', skipReason: 'roundEnded', playerCostSpent: 0 },
    ] });
    const result = service.commitEncounterRound({ runId, requestId: 'ag1-fast-victory',
      expectedCommitVersion: before.commitVersion, draft: token(active) });
    expect(result.activeEncounter).toBeNull();
    expect(result.completedEncounterNodeIds).toContain('battle');
    expect(result.lastEncounterCommit?.schedulerTerminal).toEqual({ outcome: 'victory', checkpoint: 'afterSource', executionIndex: 0 });
    expect(result.lastEncounterCommit?.enemyActions).toEqual([{ enemyId: 'e1', actionId: 'enemy-hit', skipReason: 'roundEnded', resourceChanges: [] }]);
  });

  test('reselects an automatic target after a faster source defeats the original candidate', () => {
    const fallback: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-automatic-target-fallback',
      initialTeamResources: [],
      actions: [
        { id: 'fast-kill', name: 'Fast Kill', eligibleCharacterIds: ['shiroko'], agility: { base: 8, max: 8 },
          target: { kind: 'enemy', preference: 'stableOrder' },
          effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 1 }] } },
        { id: 'slow-hit', name: 'Slow Hit', eligibleCharacterIds: ['serika'], agility: { base: 0, max: 0 },
          target: { kind: 'enemy', preference: 'stableOrder' },
          effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 1 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [
          { id: 'e1', initialHp: 1, maxHp: 1 }, { id: 'e2', initialHp: 1, maxHp: 1 },
        ], participants: [
          { characterId: 'shiroko', actions: [{ actionId: 'fast-kill', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'slow-hit', tendencyWeight: 1 }] },
        ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, snapshot, active } = startEncounter(fallback);
    expect(active.targetSelections).toEqual([]);
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: true, executionSequence: [
      { executionIndex: 0, actionId: 'fast-kill', target: { kind: 'enemy', enemyId: 'e1' },
        sideRank: 0, sourceRank: 0, ownerDeclarationIndex: 0, logicalIndex: 0 },
      { executionIndex: 1, actionId: 'slow-hit', target: { kind: 'enemy', enemyId: 'e2' },
        sideRank: 0, sourceRank: 0, ownerDeclarationIndex: 1, logicalIndex: 0 },
    ] });
    const committed = service.commitEncounterRound({ runId, requestId: 'ag1-auto-target-fallback',
      expectedCommitVersion: snapshot.commitVersion, draft: token(active) });
    expect(committed.lastEncounterCommit?.schedulerStartSnapshot?.encounter.targetSelections).toEqual([]);
    expect(committed.lastEncounterCommit?.executionSequence?.map(row => row.target)).toEqual([
      { kind: 'enemy', enemyId: 'e1' }, { kind: 'enemy', enemyId: 'e2' },
    ]);
    expect(committed.lastEncounterCommit?.schedulerTerminal).toEqual({ outcome: 'victory', checkpoint: 'afterSource', executionIndex: 1 });
  });

  test('keeps an actorless explicit target locked after a faster Party source downs it', () => {
    const lockedTargetMap: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-locked-actorless-target',
      initialPlayerCost: 2,
      partyAgility: [{ characterId: 'shiroko', agility: 8 }],
      initialTeamResources: [],
      actions: [
        { id: 'party-hit', name: 'Party Hit', eligibleCharacterIds: ['shiroko'], agility: { base: 0, max: 8 },
          target: { kind: 'partyCharacter' }, additionalTarget: 'enemy',
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 10 }] } },
        { id: 'ability-hit', name: 'Ability Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, additionalTarget: 'enemy',
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
        { id: 'item-hit', name: 'Item Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, additionalTarget: 'enemy',
          effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] } },
      ],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }],
          abilityActionIds: ['ability-hit'],
          itemActions: [{ itemId: 'potion', actionId: 'item-hit' }], participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'party-hit', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(lockedTargetMap);
    const selectedParty = service.setPreparedTarget(runId, 'shiroko', 'serika', token(active));
    const selectedPartyAdditional = service.setPreparedAdditionalTarget(runId, 'shiroko', { kind: 'enemy', enemyId: 'e1' },
      token(selectedParty.activeEncounter!));
    const selectedAbility = service.setAbilityDraft(runId, 'ability-hit', { kind: 'partyCharacter', characterId: 'serika' },
      token(selectedPartyAdditional.activeEncounter!));
    const selectedAbilityAdditional = service.setAbilityAdditionalTarget(runId, { kind: 'enemy', enemyId: 'e1' },
      token(selectedAbility.activeEncounter!));
    const selectedItem = service.setItemDraft(runId, 'potion', { kind: 'partyCharacter', characterId: 'serika' },
      token(selectedAbilityAdditional.activeEncounter!));
    const selectedItemAdditional = service.setItemAdditionalTarget(runId, { kind: 'enemy', enemyId: 'e1' },
      token(selectedItem.activeEncounter!));
    const before = service.getSnapshot()!;
    const command = { runId, requestId: 'ag1-locked-target', expectedCommitVersion: before.commitVersion,
      draft: token(selectedItemAdditional.activeEncounter!) };
    const preview = service.previewEncounterCommit(runId);
    expect(preview).toMatchObject({ canCommit: true, executionSequence: [
      { executionIndex: 0, sourceKind: 'partyAction', actionId: 'party-hit', finalAgility: 8,
        sideRank: 0, sourceRank: 0, ownerDeclarationIndex: 0, logicalIndex: 0,
        additionalTarget: { kind: 'enemy', enemyId: 'e1' } },
      { executionIndex: 1, sourceKind: 'ability', actionId: 'ability-hit',
        target: { kind: 'partyCharacter', characterId: 'serika' }, playerCostSpent: 1,
        sideRank: 0, sourceRank: 1, ownerDeclarationIndex: 0, logicalIndex: 0,
        additionalTarget: { kind: 'enemy', enemyId: 'e1' } },
      { executionIndex: 2, sourceKind: 'item', actionId: 'item-hit',
        target: { kind: 'partyCharacter', characterId: 'serika' }, itemConsumed: true,
        sideRank: 0, sourceRank: 2, ownerDeclarationIndex: 0, logicalIndex: 0,
        additionalTarget: { kind: 'enemy', enemyId: 'e1' } },
    ] });
    const prepared = service.prepareEncounterRoundCommit(command);
    expect(prepared.itemId).toBe('potion');
    expect(prepared.snapshot.lastEncounterCommit?.ability?.target).toEqual({ kind: 'partyCharacter', characterId: 'serika' });
    expect(prepared.snapshot.lastEncounterCommit?.ability?.additionalTarget).toEqual({ kind: 'enemy', enemyId: 'e1' });
    expect(prepared.snapshot.lastEncounterCommit?.item?.target).toEqual({ kind: 'partyCharacter', characterId: 'serika' });
    expect(prepared.snapshot.lastEncounterCommit?.item?.additionalTarget).toEqual({ kind: 'enemy', enemyId: 'e1' });
    expect(prepared.snapshot.lastEncounterCommit?.settlements[0]?.additionalTarget).toEqual({ kind: 'enemy', enemyId: 'e1' });
    expect(prepared.snapshot.lastEncounterCommit?.ability?.hpChanges).toEqual([{ scope: 'party', characterId: 'serika', delta: 0 }]);
    expect(prepared.snapshot.lastEncounterCommit?.item?.hpChanges).toEqual([{ scope: 'party', characterId: 'serika', delta: 0 }]);
    const schedulerStart = prepared.snapshot.lastEncounterCommit?.schedulerStartSnapshot;
    expect(schedulerStart).toMatchObject({
      partyHp: before.partyHp, playerCost: 2, teamResources: [],
      encounter: {
        targetSelections: [{ characterId: 'shiroko', targetCharacterId: 'serika', additionalTargetEnemyId: 'e1' }],
        abilityDraft: { actionId: 'ability-hit', target: { kind: 'partyCharacter', characterId: 'serika' },
          additionalTarget: { kind: 'enemy', enemyId: 'e1' } },
        itemDraft: { itemId: 'potion', actionId: 'item-hit', target: { kind: 'partyCharacter', characterId: 'serika' },
          additionalTarget: { kind: 'enemy', enemyId: 'e1' } },
      },
    });
    expect(Object.isFrozen(schedulerStart)).toBe(true);
    expect(Object.isFrozen(schedulerStart?.encounter.targetSelections)).toBe(true);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('consumes an executed AG-1 Item through the existing two-owner coordinator exactly once', () => {
    const baseMap = gameplayBMapDatapack.maps?.[0];
    if (!baseMap) throw new Error('Gameplay B sample Map is missing');
    const itemId = 'test:item:ag1-potion';
    const itemAction = { id: 'ag1-item-hit', name: 'AG-1 Item Hit', eligibleCharacterIds: [],
      target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 1 }] } };
    const map: GameplayMapDef = {
      ...baseMap,
      id: 'test:map:ag1-item-coordinator',
      resumeVersion: baseMap.resumeVersion + 1,
      executionContractId: 'AG-1',
      startNodeId: 'ag1-start',
      exitNodeIds: ['ag1-exit'],
      actions: [itemAction],
      nodes: [
        { id: 'ag1-start', title: 'Start' },
        { id: 'ag1-battle', title: 'Battle', encounter: { title: 'AG-1 Item Battle',
          enemies: [{ id: 'ag1-enemy', initialHp: 10, maxHp: 10 }], participants: [],
          itemActions: [{ itemId, actionId: itemAction.id }] } },
        { id: 'ag1-exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'ag1-start', toNodeId: 'ag1-battle' }, { fromNodeId: 'ag1-battle', toNodeId: 'ag1-exit' }],
    };
    const item = { id: itemId, name: 'AG-1 Potion', description: 'Test Map Item.', maxStack: 3,
      rarity: 'common' as const, type: 'consumable' as const, useEffects: [] };
    const datapack: Datapack = { ...gameplayBMapDatapack,
      maps: [...(gameplayBMapDatapack.maps ?? []), map],
      items: [...(gameplayBMapDatapack.items ?? []), item],
    };
    const game = new GameInstance();
    try {
      game.init([baseDatapack, datapack], { enterDefaultInit: false });
      const shiroko = game.rosterSystem.getAllVariants().find(row => row.proto === 'shiroko');
      const serika = game.rosterSystem.getAllVariants().find(row => row.proto === 'serika');
      if (!shiroko || !serika) throw new Error('Base party Variants are missing');
      game.mutations.acquireCharacter(shiroko.id, 'story');
      game.mutations.acquireCharacter(serika.id, 'story');
      game.mutations.addItem(itemId, 1, 3);
      const started = game.startMap(map.id);
      const edge = map.edges.find(row => row.fromNodeId === started.currentNodeId);
      if (!edge) throw new Error('Map entry has no Encounter edge');
      let run = game.moveMap(started.runId, edge.toNodeId);
      const enemyId = run.activeEncounter?.enemies[0]?.enemyId;
      if (!enemyId || !run.activeEncounter) throw new Error('Encounter Enemy is missing');
      const target = { kind: 'enemy' as const, enemyId };
      run = game.setMapItemDraft(run.runId, itemId, target, token(run.activeEncounter));
      if (!run.activeEncounter) throw new Error('Active Encounter is missing');
      const command = { runId: run.runId, requestId: 'ag1-item-owner-commit', expectedCommitVersion: run.commitVersion,
        draft: token(run.activeEncounter) };
      const result = createGameCommands(game).commitMapEncounterRound(command);
      expect(result.lastEncounterCommit).toMatchObject({ executionContractId: 'AG-1', schedulerFormatVersion: 5,
        executionSequence: [{ sourceKind: 'item', actionId: itemAction.id, itemConsumed: true }],
        item: { itemId, actionId: itemAction.id, consumedCount: 1 } });
      expect(game.state.inventory[itemId]).toBeUndefined();
      expect(createGameCommands(game).commitMapEncounterRound(command)).toEqual(result);
      expect(game.state.inventory[itemId]).toBeUndefined();
    } finally {
      game.dispose();
    }
  });

  test('keeps an Item selected after terminal victory in the sequence without consuming inventory', () => {
    const baseMap = gameplayBMapDatapack.maps?.[0];
    if (!baseMap) throw new Error('Gameplay B sample Map is missing');
    const itemId = 'test:item:ag1-skipped-potion';
    const kill = { id: 'ag1-fast-kill', name: 'AG-1 Fast Kill', eligibleCharacterIds: ['shiroko'],
      agility: { base: 0, max: 8 }, target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 10 }] } };
    const itemAction = { id: 'ag1-slow-item-hit', name: 'AG-1 Slow Item Hit', eligibleCharacterIds: [],
      agility: { base: 0, max: 0 }, target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 1 }] } };
    const map: GameplayMapDef = {
      ...baseMap,
      id: 'test:map:ag1-skipped-item-coordinator',
      resumeVersion: baseMap.resumeVersion + 2,
      executionContractId: 'AG-1',
      partyAgility: [{ characterId: 'shiroko', agility: 8 }],
      startNodeId: 'ag1-skip-start',
      exitNodeIds: ['ag1-skip-exit'],
      actions: [kill, itemAction],
      nodes: [
        { id: 'ag1-skip-start', title: 'Start' },
        { id: 'ag1-skip-battle', title: 'Battle', encounter: { title: 'AG-1 Skip Item Battle',
          enemies: [{ id: 'ag1-skip-enemy', initialHp: 1, maxHp: 1 }],
          participants: [
            { characterId: 'shiroko', actions: [{ actionId: kill.id, tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [] },
          ], itemActions: [{ itemId, actionId: itemAction.id }] } },
        { id: 'ag1-skip-exit', title: 'Exit' },
      ],
      edges: [{ fromNodeId: 'ag1-skip-start', toNodeId: 'ag1-skip-battle' },
        { fromNodeId: 'ag1-skip-battle', toNodeId: 'ag1-skip-exit' }],
    };
    const item = { id: itemId, name: 'AG-1 Skipped Potion', description: 'Test Map Item.', maxStack: 3,
      rarity: 'common' as const, type: 'consumable' as const, useEffects: [] };
    const datapack: Datapack = { ...gameplayBMapDatapack,
      maps: [...(gameplayBMapDatapack.maps ?? []), map],
      items: [...(gameplayBMapDatapack.items ?? []), item],
    };
    const game = new GameInstance();
    try {
      game.init([baseDatapack, datapack], { enterDefaultInit: false });
      const shiroko = game.rosterSystem.getAllVariants().find(row => row.proto === 'shiroko');
      const serika = game.rosterSystem.getAllVariants().find(row => row.proto === 'serika');
      if (!shiroko || !serika) throw new Error('Base party Variants are missing');
      game.mutations.acquireCharacter(shiroko.id, 'story');
      game.mutations.acquireCharacter(serika.id, 'story');
      game.mutations.addItem(itemId, 1, 3);
      const started = game.startMap(map.id);
      const edge = map.edges.find(row => row.fromNodeId === started.currentNodeId);
      if (!edge) throw new Error('Map entry has no Encounter edge');
      let run = game.moveMap(started.runId, edge.toNodeId);
      const enemyId = run.activeEncounter?.enemies[0]?.enemyId;
      if (!enemyId || !run.activeEncounter) throw new Error('Encounter Enemy is missing');
      run = game.setMapItemDraft(run.runId, itemId, { kind: 'enemy', enemyId }, token(run.activeEncounter));
      if (!run.activeEncounter) throw new Error('Active Encounter is missing');
      const command = { runId: run.runId, requestId: 'ag1-skipped-item-owner-commit',
        expectedCommitVersion: run.commitVersion, draft: token(run.activeEncounter) };
      const result = createGameCommands(game).commitMapEncounterRound(command);
      expect(result.lastEncounterCommit?.executionSequence).toMatchObject([
        { sourceKind: 'partyAction', actionId: kill.id, skipReason: null },
        { sourceKind: 'item', actionId: itemAction.id, skipReason: 'roundEnded', itemConsumed: false },
      ]);
      expect(result.lastEncounterCommit?.schedulerTerminal).toEqual({ outcome: 'victory', checkpoint: 'afterSource', executionIndex: 0 });
      expect(result.lastEncounterCommit).not.toHaveProperty('item');
      expect(game.state.inventory[itemId]).toBe(1);
    } finally {
      game.dispose();
    }
  });

  test('AG-1 Status Remove preview and stale retries do not install a partial Status Receipt v2', () => {
    const statusMap: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-status-remove-commit',
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
    const { service, runId, active } = startEncounter(statusMap);
    const seeded: any = JSON.parse(JSON.stringify(service.createSaveSnapshot()));
    seeded.run.activeEncounter.round = 2;
    seeded.run.activeEncounter.drawCursorStart = active.randomState.cursor;
    seeded.run.activeEncounter.randomState = active.randomState;
    seeded.run.activeEncounter.statuses = [{
      holder: { kind: 'enemy', id: 'e1' }, statusId: 'burn',
      source: { kind: 'ability', actionId: 'apply-burn' }, actionId: 'apply-burn',
      appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
    }];
    const owner = new MapRunService(resolverOf(statusMap), resolveVariant);
    expect(owner.restoreSaveSnapshot(seeded)).toMatchObject({ status: 'restored' });
    const readyAtRoundTwo = owner.getSnapshot()!;
    owner.setAbilityDraft(runId, 'remove-burn', { kind: 'enemy', enemyId: 'e1' }, token(readyAtRoundTwo.activeEncounter!));
    const ready = owner.getSnapshot()!;
    const beforePreview = owner.getSnapshot();
    const preview = owner.previewEncounterCommit(runId)!;
    expect(preview.diagnostics).toEqual([]);
    expect(preview).toMatchObject({ canCommit: true, statusReceiptVersion: 2,
      statusRemoveTrace: [{ statusId: 'burn', removed: [{ statusIndexBefore: 0 }] }] });
    expect(owner.getSnapshot()).toEqual(beforePreview);

    const staleCommand = { runId, requestId: 'status-remove-stale-commit',
      expectedCommitVersion: ready.commitVersion - 1, draft: token(ready.activeEncounter!) };
    expect(() => owner.commitEncounterRound(staleCommand)).toThrow(MapRunError);
    expect(owner.getSnapshot()).toEqual(beforePreview);

    const removed = owner.commitEncounterRound({ runId, requestId: 'status-remove-valid-commit',
      expectedCommitVersion: ready.commitVersion, draft: token(ready.activeEncounter!) });
    expect(removed.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 2,
      schedulerFormatVersion: 5,
      programReceiptVersion: 1,
      plannedStatuses: [],
      statusRemoveTrace: [{ identity: { kind: 'enemy', id: 'e1' }, removed: [{ statusIndexBefore: 0,
        status: { statusId: 'burn', actionId: 'apply-burn' } }] }],
    });
    expect(removed.activeEncounter?.statuses).toEqual([]);
  });

  test('AG-1 Status Consume emits v3 evidence for an empty match and an explicitly empty trace when skipped', () => {
    const consume = { id: 'consume-burn', name: 'Consume Burn', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusConsume' as const, target: 'primary' as const, statusId: 'burn', stacks: 2 }] } };
    const statusMap: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-status-consume-commit',
      resumeVersion: 3,
      initialTeamResources: [],
      statuses: [{ id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3 }],
      actions: [consume],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: [consume.id],
          enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(statusMap);
    service.setAbilityDraft(runId, consume.id, { kind: 'enemy', enemyId: 'e1' }, token(active));
    const ready = service.getSnapshot()!;
    const beforePreview = service.getSnapshot();
    const preview = service.previewEncounterCommit(runId)!;
    expect(preview).toMatchObject({ canCommit: true, statusReceiptVersion: 3, schedulerFormatVersion: 5,
      statusRemoveTrace: [], statusConsumeTrace: [{ statusId: 'burn', requestedStacks: 2,
        consumedStacks: 0, unmetStacks: 2, changes: [] }] });
    expect(service.getSnapshot()).toEqual(beforePreview);
    const committed = service.commitEncounterRound({ runId, requestId: 'consume-empty-match',
      expectedCommitVersion: ready.commitVersion, draft: token(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 3,
      statusConsumeTrace: [{ statusId: 'burn', requestedStacks: 2, consumedStacks: 0, unmetStacks: 2, changes: [] }] });

    const kill = { id: 'finish-before-consume', name: 'Finish', eligibleCharacterIds: ['shiroko'],
      agility: { base: 8, max: 8 }, target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 10 }] } };
    const skippedMap: GameplayMapDef = { ...statusMap, id: 'test:map:ag1-status-consume-skipped',
      actions: [kill, consume], nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: [consume.id],
          enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [{ actionId: kill.id, tendencyWeight: 1 }] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ] };
    const skippedOwner = new MapRunService(resolverOf(skippedMap), resolveVariant);
    const skippedStart = skippedOwner.start(skippedMap.id, party);
    const entered = skippedOwner.move(skippedStart.runId, 'battle');
    skippedOwner.setAbilityDraft(skippedStart.runId, consume.id, { kind: 'enemy', enemyId: 'e1' }, token(entered.activeEncounter!));
    const skippedReady = skippedOwner.getSnapshot()!;
    const skipped = skippedOwner.commitEncounterRound({ runId: skippedStart.runId, requestId: 'consume-skipped',
      expectedCommitVersion: skippedReady.commitVersion, draft: token(skippedReady.activeEncounter!) });
    expect(skipped.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 3, statusConsumeTrace: [] });
  });

  test('AG-1 category removal emits the complete v4 Status receipt, including empty and skipped traces', () => {
    const clear = { id: 'clear-harmful', name: 'Clear Harmful', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusRemoveCategory' as const, target: 'primary' as const, category: 'harmful' as const }] } };
    const applyBurn = { id: 'apply-burn', name: 'Apply Burn', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const, statusId: 'burn', stacks: 1, durationRounds: 3 }] } };
    const applyRegen = { id: 'apply-regen', name: 'Apply Regen', eligibleCharacterIds: [], target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'statusApply' as const, target: 'primary' as const, statusId: 'regen', stacks: 1, durationRounds: 3 }] } };
    const statusMap: GameplayMapDef = {
      ...common,
      id: 'test:map:ag1-status-category-commit',
      resumeVersion: 4,
      initialTeamResources: [],
      statuses: [
        { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 1, maxStacks: 3, category: 'harmful' },
        { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 3, category: 'beneficial' },
      ],
      actions: [clear, applyBurn, applyRegen],
      nodes: [
        { id: 'start', title: 'Start' },
        { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: [clear.id],
          enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
            { characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] },
          ] } },
        { id: 'exit', title: 'Exit' },
      ],
    };
    const { service, runId, active } = startEncounter(statusMap);
    service.setAbilityDraft(runId, clear.id, { kind: 'enemy', enemyId: 'e1' }, token(active));
    const ready = service.getSnapshot()!;
    const emptyPreview = service.previewEncounterCommit(runId)!;
    expect(emptyPreview).toMatchObject({ canCommit: true, statusReceiptVersion: 4,
      statusRemoveTrace: [], statusConsumeTrace: [],
      statusCategoryRemoveTrace: [{ category: 'harmful', removed: [] }] });
    const committed = service.commitEncounterRound({ runId, requestId: 'status-category-empty',
      expectedCommitVersion: ready.commitVersion, draft: token(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 4,
      statusRemoveTrace: [], statusConsumeTrace: [],
      statusCategoryRemoveTrace: [{ identity: { kind: 'enemy', id: 'e1' }, category: 'harmful', removed: [] }] });

    const kill = { id: 'finish-before-category-cleanse', name: 'Finish', eligibleCharacterIds: ['shiroko'],
      agility: { base: 8, max: 8 }, target: { kind: 'enemy' as const },
      effectProgram: { resolve: [{ op: 'damage' as const, target: 'primary' as const, amount: 10 }] } };
    const skippedMap: GameplayMapDef = { ...statusMap, id: 'test:map:ag1-status-category-skipped', actions: [kill, clear], nodes: [
      { id: 'start', title: 'Start' },
      { id: 'battle', title: 'Battle', encounter: { title: 'Battle', abilityActionIds: [clear.id],
        enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }], participants: [
          { characterId: 'shiroko', actions: [{ actionId: kill.id, tendencyWeight: 1 }] }, { characterId: 'serika', actions: [] },
        ] } },
      { id: 'exit', title: 'Exit' },
    ] };
    const skippedOwner = new MapRunService(resolverOf(skippedMap), resolveVariant);
    const skippedStart = skippedOwner.start(skippedMap.id, party);
    const entered = skippedOwner.move(skippedStart.runId, 'battle');
    skippedOwner.setAbilityDraft(skippedStart.runId, clear.id, { kind: 'enemy', enemyId: 'e1' }, token(entered.activeEncounter!));
    const skippedReady = skippedOwner.getSnapshot()!;
    const skipped = skippedOwner.commitEncounterRound({ runId: skippedStart.runId, requestId: 'status-category-skipped',
      expectedCommitVersion: skippedReady.commitVersion, draft: token(skippedReady.activeEncounter!) });
    expect(skipped.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 4,
      statusRemoveTrace: [], statusConsumeTrace: [], statusCategoryRemoveTrace: [] });
  });
});
