import { describe, expect, it } from 'vitest';
import type { GameplayMapActionDef } from '../../src/data-services/contracts/gameplay-map';
import type { GameplayEncounterDef, GameplayMapDef, GameplayMapStatusDef } from '../../src/data-services/contracts/gameplay-map';
import type { GameplayMapEffectPrepareDef, GameplayMapEffectStatementDef, GameplayMapEffectTriggerDef } from '../../src/data-services/contracts/gameplay-map-effects';
import { normalizeMapActionEffects } from '../../src/data-services/normalization/gameplay-map-effect-program';
import { MapEffectPlanError, planMapEffectSource } from '../../src/arona-clicker/services/map/map-effect-planner';
import type { MapEffectPlannerOptions, MapEffectSourceInput, MapEffectVisit } from '../../src/arona-clicker/contracts/map/map-effects';
import {
  applyMapEncounterStatusRoundEnd,
  copyMapEncounterStatusInstances,
  reverseMapEncounterStatusTrace,
  validateMapEncounterStatusInstances,
  validateMapEncounterStatusTrace,
} from '../../src/arona-clicker/services/map/map-encounter-statuses';
import type { MapEncounterStatusInstance } from '../../src/arona-clicker/contracts/map/map-effects';
import { tagRef } from '../../src/engine/core/tag';

const party = { kind: 'partyCharacter' as const, id: 'p1' };
const enemy = { kind: 'enemy' as const, id: 'e1' };
const baseInput = (): MapEffectSourceInput => ({
  sourceKey: 'run/map/node/round/source/action',
  actionId: 'action',
  source: party,
  primary: enemy,
  sourceTeam: { kind: 'team' as const, side: 'party' as const },
  preparedPartyTagSources: [],
  hp: { 'partyCharacter:p1': { current: 4, cap: 10 }, 'enemy:e1': { current: 5, cap: 10 } },
  locals: { counters: { trust: { value: 2, min: 0, max: 3 } }, flags: { ready: false } },
});

function program(
  resolve: readonly GameplayMapEffectStatementDef[],
  prepare?: readonly GameplayMapEffectPrepareDef[],
  triggers?: readonly GameplayMapEffectTriggerDef[],
) {
  const action = {
    id: 'action', name: 'Test', eligibleCharacterIds: [], target: { kind: 'none' },
    effectProgram: { ...(prepare === undefined ? {} : { prepare }), resolve, ...(triggers === undefined ? {} : { triggers }) },
  } as GameplayMapActionDef;
  return normalizeMapActionEffects(action);
}

function run(resolve: readonly GameplayMapEffectStatementDef[], input = baseInput(), visit?: (event: MapEffectVisit) => void, prepare?: readonly GameplayMapEffectPrepareDef[]) {
  const options: MapEffectPlannerOptions = {
    input,
    effects: program(resolve, prepare),
    visit: visit ?? (() => {}),
  };
  return planMapEffectSource(options);
}

function runWithTriggers(
  resolve: readonly GameplayMapEffectStatementDef[],
  triggers: readonly GameplayMapEffectTriggerDef[],
  input = baseInput(),
  options: Omit<MapEffectPlannerOptions, 'input' | 'effects' | 'visit'> = {},
) {
  return planMapEffectSource({ input, effects: program(resolve, undefined, triggers), visit: () => {}, ...options });
}

describe('single-source pure effect planning', () => {
  it('runs all Action events for a Hit before its stable Status holder callbacks', () => {
    const definitions: GameplayMapStatusDef[] = ['zeta', 'alpha'].map(id => ({ id, name: id, kind: 'regen',
      hpPerStack: 1, maxStacks: 3, onDamageTaken: { resourceId: 'focus', delta: 1 } }));
    const statuses: MapEncounterStatusInstance[] = definitions.map(definition => ({ holder: enemy,
      statusId: definition.id, source: party, actionId: `${definition.id}-source`, appliedRound: 1,
      lastTriggeredRound: null, stacks: 3, remainingRounds: 2 }));
    const trigger: GameplayMapEffectTriggerDef = { id: 'damage-signal', event: 'damageApplied',
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } };
    const defeated: GameplayMapEffectTriggerDef = { id: 'defeat-signal', event: 'enemyDefeated',
      effect: { op: 'resourceChange', account: 'sourceActor', resourceId: 'focus', delta: 1 } };
    const result = runWithTriggers([{ op: 'damage', target: 'primary', amount: 10 },
      { op: 'statusRemove', target: 'primary', statusId: 'alpha' }], [trigger, defeated], {
      ...baseInput(), statusDefinitions: definitions, statuses,
      shields: { 'enemy:e1': 1 },
    });
    expect(result.triggerTrace.map(row => [row.queueIndex, row.event])).toEqual([[1, 'damageApplied'], [2, 'enemyDefeated']]);
    expect(result.statusDamageTriggerTrace.map(row => [row.queueIndex, row.status.statusId])).toEqual([[3, 'alpha'], [4, 'zeta']]);
    expect(result.resourceLedger.slice(-2).map(row => row.resourceId)).toEqual(['focus', 'focus']);
    expect(result.plannedStatuses.map(row => row.statusId)).toEqual(['zeta']);
    const removedBeforeHit = run([{ op: 'statusRemove', target: 'primary', statusId: 'alpha' },
      { op: 'damage', target: 'primary', amount: 1 }], { ...baseInput(), statusDefinitions: definitions, statuses });
    expect(removedBeforeHit.statusDamageTriggerTrace.map(row => row.status.statusId)).toEqual(['zeta']);
  });

  it('captures Status independently for each actual Hit, including a Hit that downs its holder', () => {
    const status: GameplayMapStatusDef = { id: 'steadfast', name: 'Steadfast', kind: 'regen', hpPerStack: 1,
      maxStacks: 1, onDamageTaken: { resourceId: 'focus', delta: 1 } };
    const instance: MapEncounterStatusInstance = { holder: enemy, statusId: status.id, source: party,
      actionId: 'apply', appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 3 };
    const result = planMapEffectSource({ input: { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 1, cap: 10 } },
      statusDefinitions: [status], statuses: [instance] }, effects: program([{ op: 'damage', target: 'primary', amount: 2, repeat: 2 }]),
      triggerQueueStart: 7, visit: () => {} });
    expect(result.hp['enemy:e1']?.current).toBe(0);
    expect(result.statusDamageTriggerTrace.map(row => [row.queueIndex, row.actualAppliedAmount])).toEqual([[7, 1]]);
    const repeated = planMapEffectSource({ input: { ...baseInput(), statusDefinitions: [status], statuses: [instance] },
      effects: program([{ op: 'damage', target: 'primary', amount: 2, repeat: 2 }]), visit: () => {} });
    expect(repeated.statusDamageTriggerTrace.map(row => row.actualAppliedAmount)).toEqual([2, 2]);
  });

  it('does not fire for shield-only, protected, or zero-damage requests and enforces the shared callback budget', () => {
    const status: GameplayMapStatusDef = { id: 'warded', name: 'Warded', kind: 'damageProtection', category: 'beneficial',
      maxStacks: 1, onDamageTaken: { resourceId: 'focus', delta: 1 } };
    const instance: MapEncounterStatusInstance = { holder: enemy, statusId: status.id, source: party,
      actionId: 'apply', appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2 };
    const warded = { ...baseInput(), statusDefinitions: [status], statuses: [instance] };
    expect(planMapEffectSource({ input: warded, effects: program([{ op: 'damage', target: 'primary', amount: 2 }]), visit: () => {} })
      .statusDamageTriggerTrace).toEqual([]);
    const regen: GameplayMapStatusDef = { id: 'warded', name: 'Warded', kind: 'regen', hpPerStack: 1, maxStacks: 1,
      onDamageTaken: status.onDamageTaken };
    const noHpLoss = { ...baseInput(), statusDefinitions: [regen], statuses: [{ ...instance, statusId: 'warded' }],
      shields: { 'enemy:e1': 5 } };
    expect(planMapEffectSource({ input: noHpLoss as any,
      effects: program([{ op: 'damage', target: 'primary', amount: 2 }]), visit: () => {} }).statusDamageTriggerTrace).toEqual([]);
    expect(planMapEffectSource({ input: { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } },
      statusDefinitions: [regen], statuses: [{ ...instance, statusId: 'warded' }] },
    effects: program([{ op: 'damage', target: 'primary', amount: 2 }]), visit: () => {} }).statusDamageTriggerTrace).toEqual([]);

    const manyDefinitions = Array.from({ length: 33 }, (_, index): GameplayMapStatusDef => ({ id: `reward-${index}`,
      name: `Reward ${index}`, kind: 'regen', hpPerStack: 1, maxStacks: 1,
      onDamageTaken: { resourceId: 'focus', delta: 1 } }));
    const manyStatuses: MapEncounterStatusInstance[] = manyDefinitions.map(definition => ({ holder: enemy,
      statusId: definition.id, source: party, actionId: 'apply', appliedRound: 1, lastTriggeredRound: null,
      stacks: 1, remainingRounds: 2 }));
    const many = { ...baseInput(), statusDefinitions: manyDefinitions, statuses: manyStatuses };
    expect(() => planMapEffectSource({ input: many, effects: program([{ op: 'damage', target: 'primary', amount: 1 }]),
      triggerActivationBudget: 32, visit: () => {} })).toThrow(/activation budget/);
    const thirtyTwoDefinitions = manyDefinitions.slice(0, 32);
    const thirtyTwoStatuses = manyStatuses.slice(0, 32);
    expect(planMapEffectSource({ input: { ...baseInput(), statusDefinitions: thirtyTwoDefinitions, statuses: thirtyTwoStatuses },
      effects: program([{ op: 'damage', target: 'primary', amount: 1 }]),
      triggerActivationBudget: 32, visit: () => {} }).statusDamageTriggerTrace).toHaveLength(32);
  });

  it('keeps holder callbacks invisible to later statements in the same source', () => {
    const status: GameplayMapStatusDef = { id: 'steady', name: 'Steady', kind: 'regen', hpPerStack: 1, maxStacks: 1,
      onDamageTaken: { resourceId: 'focus', delta: 1 } };
    const input = { ...baseInput(), locals: { counters: {}, flags: { sawFocus: false } }, statusDefinitions: [status],
      statuses: [{ holder: enemy, statusId: 'steady', source: party, actionId: 'apply', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }], resourceBalances: {
        actors: { 'enemy:e1': { focus: 0 } }, teams: { party: {}, enemy: {} },
      } };
    const result = run([{ op: 'damage', target: 'primary', amount: 1 },
      { op: 'when', condition: { kind: 'resourceAtLeast', account: 'primaryActor', resourceId: 'focus', value: 1 },
        then: [{ op: 'flagSet', flagId: 'sawFocus', value: true }], else: [] }], input);
    expect(result.statusDamageTriggerTrace).toHaveLength(1);
    expect(result.locals.flags.sawFocus).toBe(false);
  });
  it('consumes one damageProtection charge before reduction and Shield for each living positive hit', () => {
    const ward: GameplayMapStatusDef = {
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 1,
    };
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 1, maxStacks: 2,
    };
    const trigger: GameplayMapEffectTriggerDef = {
      id: 'damage-reward', event: 'damageApplied',
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
    };
    const result = runWithTriggers([{ op: 'damage', target: 'primary', amount: 3, repeat: 2 }], [trigger], {
      ...baseInput(), statusDefinitions: [ward, guard],
      statuses: [
        { holder: enemy, statusId: 'ward', source: party, actionId: 'ward-action', appliedRound: 1,
          lastTriggeredRound: null, stacks: 1, remainingRounds: 2 },
        { holder: enemy, statusId: 'guard', source: party, actionId: 'guard-action', appliedRound: 1,
          lastTriggeredRound: null, stacks: 1, remainingRounds: 2 },
      ],
      shields: { 'enemy:e1': 1 },
    });

    expect(result.trace.filter(row => row.op === 'damage')).toMatchObject([
      { amount: 0, before: 5, after: 5, delta: 0, damageProtection: {
        requestedAmount: 3, blockedAmount: 3,
        statusBefore: { statusId: 'ward', stacks: 1, holder: enemy, source: party }, statusAfter: null,
      } },
      { amount: 2, before: 5, after: 4, delta: -1,
        damageReduction: { total: 1, sources: [{ statusId: 'guard', reducedAmount: 1 }] },
        batch: { hitIndex: 1 } },
    ]);
    expect(result.shieldTrace).toMatchObject([
      { op: 'damage', requestedAmount: 2, shieldBefore: 1, absorbed: 1, shieldAfter: 0,
        remainingDamage: 1, hpBefore: 5, hpAfter: 4 },
    ]);
    expect(result.plannedStatuses).toMatchObject([{ statusId: 'guard', stacks: 1 }]);
    expect(result.plannedShields).toEqual({});
    expect(result.triggerTrace).toMatchObject([{
      queueIndex: 1, event: 'damageApplied', triggerId: 'damage-reward',
      requestedAmount: 3, actualAppliedAmount: 1, target: enemy,
    }]);
  });

  it('does not consume damageProtection for zero requests or defeated holders', () => {
    const ward: GameplayMapStatusDef = {
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 1,
    };
    const status: MapEncounterStatusInstance = {
      holder: enemy, statusId: 'ward', source: party, actionId: 'ward-action',
      appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
    };
    const input = { ...baseInput(), statusDefinitions: [ward], statuses: [status] };
    const zero = planMapEffectSource({ input, effects: program([{ op: 'damage', target: 'primary', amount: 1 }]),
      pendingCardEffectModifier: { sourceKey: 'modifier-source', actionId: 'modifier-action', delta: -1 }, visit: () => {} });
    expect(zero.trace.find(row => row.op === 'damage')).not.toHaveProperty('damageProtection');
    expect(zero.plannedStatuses).toEqual([status]);

    const downed = run([{ op: 'damage', target: 'primary', amount: 2 }], {
      ...input, hp: { ...input.hp, 'enemy:e1': { current: 0, cap: 10 } },
    });
    expect(downed.trace.find(row => row.op === 'damage')).not.toHaveProperty('damageProtection');
    expect(downed.plannedStatuses).toEqual([status]);
  });

  it('consumes protection independently in frozen TargetSet order', () => {
    const ward: GameplayMapStatusDef = {
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 1,
    };
    const input: MapEffectSourceInput = {
      ...baseInput(),
      targetOrder: { party: ['p1'], enemy: ['e1', 'e2'] },
      hp: { ...baseInput().hp, 'enemy:e2': { current: 5, cap: 10 } },
      statusDefinitions: [ward],
      statuses: [{ holder: enemy, statusId: 'ward', source: party, actionId: 'ward-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
    };
    const result = run([{ op: 'damage', target: { set: { side: 'enemy', order: 'definition' } }, amount: 2 }], input);
    expect(result.trace.filter(row => row.op === 'damage')).toMatchObject([
      { identity: { kind: 'enemy', id: 'e1' }, amount: 0, damageProtection: { blockedAmount: 2 } },
      { identity: { kind: 'enemy', id: 'e2' }, amount: 2, after: 3 },
    ]);
    expect(result.plannedStatuses).toEqual([]);
  });

  it('lets an earlier Status statement protect only the next hit in the same Program', () => {
    const ward: GameplayMapStatusDef = {
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 1,
    };
    const result = run([
      { op: 'statusApply', target: 'primary', statusId: 'ward', stacks: 1, durationRounds: 2 },
      { op: 'damage', target: 'primary', amount: 2, repeat: 2 },
    ], { ...baseInput(), round: 2, sourceIdentity: party, statusDefinitions: [ward] });
    expect(result.trace.filter(row => row.op === 'damage')).toMatchObject([
      { amount: 0, before: 5, after: 5, delta: 0, damageProtection: { blockedAmount: 2 } },
      { amount: 2, before: 5, after: 3, delta: -2, batch: { hitIndex: 1 } },
    ]);
    expect(result.plannedStatuses).toEqual([]);
  });

  it('applies outgoing modifiers, then per-hit Status reduction, then Shield and HP', () => {
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 2, maxStacks: 3,
    };
    const input: MapEffectSourceInput = {
      ...baseInput(),
      statusDefinitions: [guard],
      statuses: [{ holder: enemy, statusId: 'guard', source: party, actionId: 'guard-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
      shields: { 'enemy:e1': 1 },
    };
    const result = planMapEffectSource({ input, effects: program([
      { op: 'damage', target: 'primary', amount: 5, repeat: 2 },
    ]), visit: () => {}, pendingCardEffectModifier: { sourceKey: 'outgoing-key', actionId: 'outgoing-action', delta: -1 } });

    expect(result.trace.filter(row => row.op === 'damage')).toMatchObject([
      { amount: 2, requestedAmount: 5, modifierDelta: -1, modifiedRequestedAmount: 4,
        damageReduction: { total: 2, sources: [{ statusId: 'guard', source: party, actionId: 'guard-action',
          stacks: 1, damageReductionPerStack: 2, reducedAmount: 2 }] },
        batch: { hitIndex: 0 } },
      { amount: 2, requestedAmount: 5, modifierDelta: -1, modifiedRequestedAmount: 4,
        damageReduction: { total: 2, sources: [{ statusId: 'guard', reducedAmount: 2 }] },
        batch: { hitIndex: 1 } },
    ]);
    expect(result.shieldTrace).toMatchObject([
      { op: 'damage', requestedAmount: 2, shieldBefore: 1, absorbed: 1, remainingDamage: 1, hpBefore: 5, hpAfter: 4 },
      { op: 'damage', requestedAmount: 2, shieldBefore: 0, absorbed: 0, remainingDamage: 2, hpBefore: 4, hpAfter: 2 },
    ]);
  });

  it('uses active Status array order and applies earlier Status statements immediately', () => {
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 2, maxStacks: 3,
    };
    const secondSource = { kind: 'partyCharacter' as const, id: 'p2' };
    const input: MapEffectSourceInput = {
      ...baseInput(), round: 2, sourceIdentity: party,
      statusDefinitions: [guard],
      statuses: [{ holder: enemy, statusId: 'guard', source: secondSource, actionId: 'z-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 },
      { holder: enemy, statusId: 'guard', source: party, actionId: 'a-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
    };
    const result = run([
      { op: 'damage', target: 'primary', amount: 5 },
      { op: 'statusApply', target: 'primary', statusId: 'guard', stacks: 1, durationRounds: 2 },
      { op: 'damage', target: 'primary', amount: 5 },
      { op: 'statusConsume', target: 'primary', statusId: 'guard', stacks: 1 },
      { op: 'damage', target: 'primary', amount: 5 },
    ], input);
    const damage = result.trace.filter(row => row.op === 'damage');
    expect(damage[0]).toMatchObject({ amount: 1, damageReduction: { total: 4, sources: [
      { source: secondSource, actionId: 'z-action', reducedAmount: 2 },
      { source: party, actionId: 'a-action', reducedAmount: 2 },
    ] } });
    expect(damage[1]).toMatchObject({ amount: 0, damageReduction: { total: 5, sources: [
      { source: secondSource, actionId: 'z-action' },
      { source: party, actionId: 'a-action' },
      { source: party, actionId: 'action', stacks: 1, reducedAmount: 1 },
    ] } });
    expect(damage[2]).toMatchObject({ amount: 1, damageReduction: { total: 4 } });
    expect(result.plannedStatuses).toHaveLength(2);
  });

  it('reduces TargetSet damage only for living holders with matching active Statuses', () => {
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 1, maxStacks: 3,
    };
    const input: MapEffectSourceInput = {
      ...baseInput(),
      targetOrder: { party: ['p1'], enemy: ['e1', 'e2'] },
      hp: { ...baseInput().hp, 'enemy:e2': { current: 5, cap: 10 } },
      statusDefinitions: [guard],
      statuses: [{ holder: enemy, statusId: 'guard', source: party, actionId: 'guard-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
      shields: { 'enemy:e1': 2, 'enemy:e2': 1 },
    };
    const result = run([{ op: 'damage', target: { set: { side: 'enemy', order: 'definition' } }, amount: 2 }], input);
    expect(result.trace.filter(row => row.op === 'damage')).toMatchObject([
      { identity: { kind: 'enemy', id: 'e1' }, amount: 1, damageReduction: { total: 1 } },
      { identity: { kind: 'enemy', id: 'e2' }, amount: 2 },
    ]);
    expect(result.trace.find(row => row.op === 'damage' && row.identity?.kind === 'enemy' && row.identity.id === 'e2'))
      .not.toHaveProperty('damageReduction');
    expect(result.shieldTrace).toMatchObject([
      { op: 'damage', requestedAmount: 1, absorbed: 1, hpAfter: 5 },
      { op: 'damage', requestedAmount: 2, absorbed: 1, hpAfter: 4 },
    ]);
  });

  it('does not apply reductions to defeated targets or non-damage HP effects', () => {
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 2, maxStacks: 3,
    };
    const downed = { kind: 'enemy' as const, id: 'e1' };
    const input: MapEffectSourceInput = {
      ...baseInput(),
      hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } },
      statusDefinitions: [guard],
      statuses: [{ holder: downed, statusId: 'guard', source: party, actionId: 'guard-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
      shields: { 'enemy:e1': 2 },
    };
    const result = run([
      { op: 'damage', target: 'primary', amount: 3 },
      { op: 'heal', target: 'primary', amount: 2 },
      { op: 'hpChange', target: 'primary', delta: 1 },
    ], input);
    expect(result.trace.find(row => row.op === 'damage')).not.toHaveProperty('damageReduction');
    expect(result.shieldTrace).toMatchObject([{ op: 'damage', requestedAmount: 3, absorbed: 0, shieldAfter: 2, hpAfter: 0 }]);
    expect(result.plannedShields).toEqual({ 'enemy:e1': 2 });
  });

  it('plans aggregate Shield grants and consumes Shield before HP on each repeated hit', () => {
    const input = { ...baseInput(), shields: { 'enemy:e1': 3 } };
    const original = structuredClone(input);
    const result = run([
      { op: 'shieldAdd', target: 'primary', amount: 2 },
      { op: 'damage', target: 'primary', amount: 4, repeat: 2 },
    ], input);
    expect(result.plannedShields).toEqual({});
    expect(result.hp['enemy:e1']?.current).toBe(2);
    expect(result.shieldTrace).toMatchObject([
      { op: 'shieldAdd', identity: enemy, requestedAmount: 2, shieldBefore: 3, added: 2, shieldAfter: 5, outcome: 'applied' },
      { op: 'damage', identity: enemy, requestedAmount: 4, shieldBefore: 5, absorbed: 4, shieldAfter: 1, remainingDamage: 0, hpBefore: 5, hpAfter: 5 },
      { op: 'damage', identity: enemy, requestedAmount: 4, shieldBefore: 1, absorbed: 1, shieldAfter: 0, remainingDamage: 3, hpBefore: 5, hpAfter: 2 },
    ]);
    expect(result.trace.filter(row => row.op === 'damage')).toMatchObject([
      { before: 5, after: 5, amount: 4, delta: 0 },
      { before: 5, after: 2, amount: 4, delta: -3 },
    ]);
    expect(input).toEqual(original);
  });

  it('keeps TargetSet target and repeat order while consuming each target’s own pool', () => {
    const input = { ...baseInput(), targetOrder: { party: ['p1'], enemy: ['e1', 'e2'] },
      hp: { ...baseInput().hp, 'enemy:e2': { current: 5, cap: 10 } },
      shields: { 'enemy:e1': 1, 'enemy:e2': 2 } };
    const result = run([{ op: 'damage', target: { set: { side: 'enemy', order: 'definition' } }, amount: 2, repeat: 2 }], input);
    expect(result.shieldTrace?.map(row => [row.identity.kind, row.identity.id, row.op === 'damage' && row.hpAfter]))
      .toEqual([['enemy', 'e1', 4], ['enemy', 'e1', 2], ['enemy', 'e2', 5], ['enemy', 'e2', 3]]);
    expect(result.plannedShields).toEqual({});
  });

  it('keeps Shield evidence present when empty and ignores HP-zero and non-damage HP paths', () => {
    const empty = run([], { ...baseInput(), shields: {} });
    expect(empty.plannedShields).toEqual({});
    expect(empty.shieldTrace).toEqual([]);

    const input = { ...baseInput(), shields: { 'enemy:e1': 4 },
      hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } } };
    const result = run([
      { op: 'shieldAdd', target: 'primary', amount: 3 },
      { op: 'damage', target: 'primary', amount: 2 },
      { op: 'heal', target: 'primary', amount: 2 },
      { op: 'hpChange', target: 'primary', delta: 2 },
    ], input);
    expect(result.plannedShields).toEqual({ 'enemy:e1': 4 });
    expect(result.hp['enemy:e1']?.current).toBe(0);
    expect(result.shieldTrace).toMatchObject([
      { op: 'shieldAdd', requestedAmount: 3, shieldBefore: 4, added: 0, shieldAfter: 4, outcome: 'notApplied/defeated' },
      { op: 'damage', shieldBefore: 4, absorbed: 0, shieldAfter: 4, remainingDamage: 2, hpBefore: 0, hpAfter: 0 },
    ]);
  });

  it('revives only downed Party primaries, clamps HP, and preserves statement order in trace', () => {
    const target = { kind: 'partyCharacter' as const, id: 'p2' };
    const input = { ...baseInput(), primary: target,
      hp: { ...baseInput().hp, 'partyCharacter:p2': { current: 0, cap: 6 } },
      shields: { 'partyCharacter:p2': 2 },
      statusDefinitions: [{ id: 'burn', name: 'Burn', kind: 'burn' as const, hpPerStack: 1, maxStacks: 2 }],
      statuses: [{ holder: target, statusId: 'burn', source: party, actionId: 'old-status', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }] };
    const original = structuredClone(input);
    const result = run([
      { op: 'revive', target: 'primary', amount: 9 },
      { op: 'heal', target: 'primary', amount: 2 },
    ], input);
    expect(result.hp['partyCharacter:p2']).toEqual({ current: 6, cap: 6 });
    expect(result.plannedShields).toEqual({ 'partyCharacter:p2': 2 });
    expect(result.plannedStatuses).toEqual(input.statuses);
    expect(result.trace).toMatchObject([
      { op: 'revive', identity: target, requestedHp: 9, restoredHp: 6, beforeHp: 0, afterHp: 6, outcome: 'revived' },
      { op: 'heal', identity: target, before: 6, after: 6, amount: 2, delta: 0 },
    ]);
    expect(input).toEqual(original);

    const living = run([{ op: 'revive', target: 'primary', amount: 4 }],
      { ...input, hp: { ...input.hp, 'partyCharacter:p2': { current: 3, cap: 6 } } });
    expect(living.hp['partyCharacter:p2']?.current).toBe(3);
    expect(living.trace).toMatchObject([{ op: 'revive', outcome: 'alreadyAlive', restoredHp: 0, beforeHp: 3, afterHp: 3 }]);
    expect(() => run([{ op: 'revive', target: 'primary', amount: 1 }])).toThrow(/Party Character primary target/);
    expect(() => run([{ op: 'revive', target: 'primary', amount: 0 }], input)).toThrow(/positive safe integer/);
  });

  it('rejects invalid Shield ledgers, non-positive grants, and pool overflow without mutating input', () => {
    const invalidLedgers: NonNullable<MapEffectSourceInput['shields']>[] = [
      { 'enemy:e1': 0 }, { 'enemy:e1': -1 }, { 'enemy:missing': 2 }, { 'bad:e1': 2 },
    ];
    for (const shields of invalidLedgers) {
      expect(() => run([], { ...baseInput(), shields })).toThrow(/Shield/);
    }
    expect(() => run([{ op: 'shieldAdd', target: 'primary', amount: 0 }], { ...baseInput(), shields: {} }))
      .toThrow(/positive safe integer/);

    const input = { ...baseInput(), shields: { 'enemy:e1': Number.MAX_SAFE_INTEGER } };
    const original = structuredClone(input);
    expect(() => run([{ op: 'shieldAdd', target: 'primary', amount: 1 }], input)).toThrow(/exceeds safe integer range/);
    expect(input).toEqual(original);

    const sequential = { ...baseInput(), shields: { 'enemy:e1': Number.MAX_SAFE_INTEGER - 1 } };
    const sequentialOriginal = structuredClone(sequential);
    expect(() => run([
      { op: 'shieldAdd', target: 'primary', amount: 1 },
      { op: 'shieldAdd', target: 'primary', amount: 1 },
    ], sequential)).toThrow(/exceeds safe integer range/);
    expect(sequential).toEqual(sequentialOriginal);
  });

  it('preserves old plan shape when no Shield ledger was supplied', () => {
    const result = run([{ op: 'damage', target: 'primary', amount: 2 }]);
    expect(result).not.toHaveProperty('plannedShields');
    expect(result).not.toHaveProperty('shieldTrace');
  });

  it('emits immutable modifier intents and applies one pending delta per target hit deterministically', () => {
    const intent = run([{ op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2 }]);
    expect(intent.cardEffectModifierIntents).toEqual([{
      sourceKey: baseInput().sourceKey, actionId: 'action', path: 'resolve[0].amount', delta: 2,
    }]);
    expect(intent.trace).toMatchObject([{ op: 'cardEffectModifier', delta: 2 }]);
    expect(Object.isFrozen(intent.cardEffectModifierIntents)).toBe(true);

    const targetInput = { ...baseInput(), targetOrder: { party: ['p1', 'p2'], enemy: ['e1', 'e2'] },
      hp: { ...baseInput().hp, 'enemy:e2': { current: 8, cap: 10 } } };
    const effects = program([{ op: 'damage', target: { set: { side: 'enemy', order: 'definition' } },
      amount: { kind: 'literal', value: 3 }, repeat: 2 }]);
    const options: MapEffectPlannerOptions = { input: targetInput, effects, visit: () => {},
      pendingCardEffectModifier: { sourceKey: 'mod-key', actionId: 'mod-action', delta: -1 } };
    const originalInput = structuredClone(targetInput);
    const first = planMapEffectSource(options);
    const second = planMapEffectSource(options);
    expect(first).toEqual(second);
    expect(first.trace.filter(row => row.op === 'damage')).toMatchObject([
      { amount: 2, requestedAmount: 3, modifierDelta: -1, modifiedRequestedAmount: 2, modifierSourceKey: 'mod-key', modifierActionId: 'mod-action', batch: { targetIndex: 0, hitIndex: 0 } },
      { amount: 2, batch: { targetIndex: 0, hitIndex: 1 } },
      { amount: 2, batch: { targetIndex: 1, hitIndex: 0 } },
      { amount: 2, batch: { targetIndex: 1, hitIndex: 1 } },
    ]);
    expect(targetInput).toEqual(originalInput);
  });

  it('clamps modified requests at zero, rejects overflow, and validates pending modifier inputs and target shape', () => {
    const target = [{ op: 'heal', target: 'primary', amount: 1 } as const];
    const effects = program(target);
    const make = (delta: number, amount = 1) => planMapEffectSource({
      input: baseInput(), effects: program([{ op: 'heal', target: 'primary', amount }]), visit: () => {},
      pendingCardEffectModifier: { sourceKey: 'source', actionId: 'modifier', delta },
    });
    expect(make(-9).trace.find(row => row.op === 'heal')).toMatchObject({ amount: 0, requestedAmount: 1, modifierDelta: -9, modifiedRequestedAmount: 0 });
    expect(() => make(Number.MAX_SAFE_INTEGER, 1)).toThrow(/exceeds safe integer range/);
    expect(() => planMapEffectSource({ input: baseInput(), effects, visit: () => {},
      pendingCardEffectModifier: { sourceKey: 'source', actionId: 'modifier', delta: 0 } })).toThrow(/invalid source identity or delta/);
    expect(() => planMapEffectSource({ input: baseInput(), effects: program([
      ...target, { op: 'damage', target: 'primary', amount: 1 },
    ]), visit: () => {}, pendingCardEffectModifier: { sourceKey: 'source', actionId: 'modifier', delta: 1 } }))
      .toThrow(/exactly one top-level damage or heal/);
  });

  it('reads HP at each guard position and emits the selected branch only', () => {
    const sourceSnapshot = baseInput();
    const originalSnapshot = structuredClone(sourceSnapshot);
    const beforeHeal = run([
      { op: 'when', condition: { kind: 'hpAtMost', target: 'source', value: 4 }, then: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supply', delta: 1 }] },
      { op: 'hpChange', target: 'source', delta: 3 },
      { op: 'when', condition: { kind: 'hpRatioAtMost', target: 'source', numerator: 1, denominator: 2 }, then: [{ op: 'counterAdd', counterId: 'trust', delta: 1 }], else: [{ op: 'counterAdd', counterId: 'trust', delta: -1 }] },
    ], sourceSnapshot);
    expect(beforeHeal.hp['partyCharacter:p1']?.current).toBe(7);
    expect(beforeHeal.resourceLedger).toMatchObject([{ resourceId: 'supply', delta: 1, identity: { kind: 'team', side: 'party' } }]);
    expect(beforeHeal.resourceLedger[0]).not.toHaveProperty('before');
    expect(beforeHeal.resourceLedger[0]).not.toHaveProperty('after');
    expect(beforeHeal.locals.counters.trust?.value).toBe(1);
    expect(beforeHeal.trace.filter(row => row.op === 'when').map(row => row.op === 'when' && row.result)).toEqual([true, false]);
    expect(sourceSnapshot).toEqual(originalSnapshot);

    const afterHeal = run([
      { op: 'hpChange', target: 'source', delta: 3 },
      { op: 'when', condition: { kind: 'hpRatioAtLeast', target: 'source', numerator: 1, denominator: 2 }, then: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supply', delta: 1 }] },
    ]);
    expect(afterHeal.resourceLedger).toHaveLength(1);

    const fiveHp = run([
      { op: 'when', condition: { kind: 'hpAtMost', target: 'source', value: 4 }, then: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supply', delta: 1 }], else: [{ op: 'flagSet', flagId: 'ready', value: true }] },
    ], { ...baseInput(), hp: { ...baseInput().hp, 'partyCharacter:p1': { current: 5, cap: 10 } } });
    expect(fiveHp.resourceLedger).toHaveLength(0);
    expect(fiveHp.locals.flags.ready).toBe(true);
    expect(fiveHp.trace.filter(row => row.op === 'flagSet')).toHaveLength(1);
  });

  it('reads one frozen Party Prepared Tag source per Character with hierarchical matching', () => {
    const explosive = tagRef('gameplay-b', ['action', 'explosive']);
    const preparedPartyTagSources = [
      { characterId: 'p1', actionId: 'grenade', origin: 'hand' as const,
        tags: [tagRef('gameplay-b', ['action', 'explosive', 'grenade']), tagRef('gameplay-b', ['action', 'explosive', 'grenade'])] },
      { characterId: 'p2', actionId: 'command', origin: 'playerCommand' as const,
        tags: [tagRef('gameplay-b', ['action', 'explosive', 'charge'])] },
    ];
    const resolve = [{ op: 'when' as const, condition: {
      kind: 'preparedTagCount' as const, side: 'party' as const, tag: explosive, comparison: 'gte' as const, value: 2,
    }, then: [{ op: 'damage' as const, target: 'primary' as const, amount: 1 }] }];
    const complete = run(resolve, { ...baseInput(), preparedPartyTagSources });
    expect(complete.trace.find(row => row.op === 'when')).toMatchObject({ result: true,
      reads: [{ op: 'preparedTagCount', side: 'party', tag: explosive, count: 2, comparison: 'gte', value: 2, result: true }] });
    expect(complete.trace.filter(row => row.op === 'damage')).toHaveLength(1);

    const onePrepared = run(resolve, { ...baseInput(), preparedPartyTagSources: preparedPartyTagSources.slice(0, 1) });
    expect(onePrepared.trace.find(row => row.op === 'when')).toMatchObject({ result: false,
      reads: [{ count: 1, result: false }] });
    expect(onePrepared.trace.some(row => row.op === 'damage')).toBe(false);
    expect(() => run(resolve, { ...baseInput(), preparedPartyTagSources: [preparedPartyTagSources[0]!, preparedPartyTagSources[0]!] }))
      .toThrow(/duplicate source/);
  });

  it('saturates Counter changes after safe addition and keeps zero actual deltas', () => {
    const result = run([
      { op: 'counterAdd', counterId: 'trust', delta: 1 },
      { op: 'counterAdd', counterId: 'trust', delta: 1 },
      { op: 'counterAdd', counterId: 'trust', delta: -1 },
    ]);
    expect(result.locals.counters.trust?.value).toBe(2);
    expect(result.trace.filter(row => row.op === 'counterAdd').map(row => row.op === 'counterAdd' && row.delta)).toEqual([1, 0, -1]);

    const lowerBound = run([{ op: 'counterAdd', counterId: 'trust', delta: -1 }], {
      ...baseInput(), locals: { counters: { trust: { value: 0, min: 0, max: 3 } }, flags: {} },
    });
    expect(lowerBound.trace[0]).toMatchObject({ before: 0, after: 0, delta: 0 });
  });

  it('rejects safe-integer overflow before clamping and preserves the caller snapshot', () => {
    const input = { ...baseInput(), locals: { counters: { trust: { value: Number.MAX_SAFE_INTEGER - 1, min: 0, max: Number.MAX_SAFE_INTEGER } }, flags: {} } };
    const before = structuredClone(input);
    expect(() => run([{ op: 'counterAdd', counterId: 'trust', delta: 2 }], input)).toThrow(/safe integer range/);
    expect(input).toEqual(before);
  });

  it('records repeated Flag writes, HP zero non-revival, and exact large rational comparisons', () => {
    const result = run([
      { op: 'flagSet', flagId: 'ready', value: true },
      { op: 'flagSet', flagId: 'ready', value: true },
      { op: 'hpChange', target: 'source', delta: -10 },
      { op: 'hpChange', target: 'source', delta: 10 },
      { op: 'when', condition: { kind: 'hpRatioAtLeast', target: 'primary', numerator: Number.MAX_SAFE_INTEGER - 2, denominator: Number.MAX_SAFE_INTEGER }, then: [{ op: 'flagSet', flagId: 'ready', value: false }] },
    ], { ...baseInput(), hp: { ...baseInput().hp, 'partyCharacter:p1': { current: 4, cap: 10 }, 'enemy:e1': { current: Number.MAX_SAFE_INTEGER - 2, cap: Number.MAX_SAFE_INTEGER } } });
    expect(result.locals.flags.ready).toBe(false);
    expect(result.trace.filter(row => row.op === 'flagSet')).toHaveLength(3);
    expect(result.hp['partyCharacter:p1']?.current).toBe(0);
    expect(result.trace.filter(row => row.op === 'hpChange').map(row => row.op === 'hpChange' && row.delta)).toEqual([-4, 0]);
    expect(result.trace.find(row => row.op === 'when')).toMatchObject({ reads: [{ op: 'hpRatioAtLeast', current: Number.MAX_SAFE_INTEGER - 2, cap: Number.MAX_SAFE_INTEGER, result: true }] });
  });

  it('plans damage/heal in order with requested amounts and actual clamped deltas', () => {
    const overkillInput = baseInput();
    const originalOverkillInput = structuredClone(overkillInput);
    const overkill = run([{ op: 'damage', target: 'primary', amount: 8 }], overkillInput);
    expect(overkill.hp['enemy:e1']?.current).toBe(0);
    expect(overkill.trace).toMatchObject([{ op: 'damage', amount: 8, before: 5, after: 0, delta: -5, identity: enemy }]);
    expect(overkillInput).toEqual(originalOverkillInput);

    const healToCap = run([{ op: 'heal', target: 'primary', amount: 4 }], {
      ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 9, cap: 10 } },
    });
    expect(healToCap.hp['enemy:e1']?.current).toBe(10);
    expect(healToCap.trace).toMatchObject([{ op: 'heal', amount: 4, before: 9, after: 10, delta: 1 }]);

    const downed = run([
      { op: 'heal', target: 'primary', amount: 4 },
      { op: 'damage', target: 'primary', amount: 2 },
    ], { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } } });
    expect(downed.hp['enemy:e1']?.current).toBe(0);
    expect(downed.trace).toMatchObject([
      { op: 'heal', amount: 4, before: 0, after: 0, delta: 0 },
      { op: 'damage', amount: 2, before: 0, after: 0, delta: 0 },
    ]);
  });

  it('queues healApplied activations by actual Heal order and trigger declaration order', () => {
    const triggers: GameplayMapEffectTriggerDef[] = [
      { id: 'focus-reward', event: 'healApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } },
      { id: 'signal-reward', event: 'healApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'signal', delta: 2 } },
    ];
    const result = runWithTriggers([
      { op: 'heal', target: 'primary', amount: 2, repeat: 2 },
      { op: 'heal', target: 'primary', amount: 5 },
    ], triggers, { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 5, cap: 10 } } });

    expect(result.triggerTrace.map(entry => [entry.queueIndex, entry.triggerId, entry.eventPath, entry.requestedAmount, entry.actualAppliedAmount]))
      .toEqual([
        [1, 'focus-reward', 'actions.action.effectProgram.resolve[0]', 2, 2],
        [2, 'signal-reward', 'actions.action.effectProgram.resolve[0]', 2, 2],
        [3, 'focus-reward', 'actions.action.effectProgram.resolve[0]', 2, 2],
        [4, 'signal-reward', 'actions.action.effectProgram.resolve[0]', 2, 2],
        [5, 'focus-reward', 'actions.action.effectProgram.resolve[1]', 5, 1],
        [6, 'signal-reward', 'actions.action.effectProgram.resolve[1]', 5, 1],
      ]);
    expect(result.triggerTrace.every(entry => entry.target.kind === 'enemy' && entry.target.id === 'e1')).toBe(true);
    expect(result.resourceLedger.map(entry => [entry.path, entry.resourceId, entry.identity, entry.delta, entry.intentDelta]))
      .toEqual([
        ['actions.action.effectProgram.triggers[0].effect', 'focus', enemy, 1, 1],
        ['actions.action.effectProgram.triggers[1].effect', 'signal', enemy, 2, 2],
        ['actions.action.effectProgram.triggers[0].effect', 'focus', enemy, 1, 1],
        ['actions.action.effectProgram.triggers[1].effect', 'signal', enemy, 2, 2],
        ['actions.action.effectProgram.triggers[0].effect', 'focus', enemy, 1, 1],
        ['actions.action.effectProgram.triggers[1].effect', 'signal', enemy, 2, 2],
      ]);
  });

  it('does not emit healApplied triggers for full, downed, or zero-restoration targets', () => {
    const triggers: GameplayMapEffectTriggerDef[] = [
      { id: 'heal-reward', event: 'healApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } },
    ];
    const cases: Array<{ readonly name: string; readonly resolve: readonly GameplayMapEffectStatementDef[]; readonly current: number }> = [
      { name: 'full', resolve: [{ op: 'heal', target: 'primary', amount: 2 }], current: 10 },
      { name: 'downed', resolve: [{ op: 'heal', target: 'primary', amount: 2 }], current: 0 },
      { name: 'zero amount', resolve: [{ op: 'heal', target: 'primary', amount: { kind: 'literal', value: 0 } }], current: 5 },
    ];
    for (const testCase of cases) {
      const result = runWithTriggers(testCase.resolve, triggers, {
        ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: testCase.current, cap: 10 } },
      });
      expect(result.triggerTrace, testCase.name).toEqual([]);
      expect(result.resourceLedger, testCase.name).toEqual([]);
    }
  });

  it('rejects healApplied activations that exceed the remaining Commit budget', () => {
    const triggers: GameplayMapEffectTriggerDef[] = [
      { id: 'heal-reward', event: 'healApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } },
    ];
    const resolve: GameplayMapEffectStatementDef[] = Array.from({ length: 5 }, () => ({
      op: 'heal', target: 'primary', amount: 1, repeat: 8,
    }));
    const input = { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 1, cap: 100 } } };
    expect(() => runWithTriggers(resolve, triggers, input, { triggerActivationBudget: 32 }))
      .toThrow(/exceeds the remaining Commit Trigger activation budget of 32/);
  });

  it('records damageApplied using the pre-reduction, pre-Shield request after actual HP loss', () => {
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 2, maxStacks: 3,
    };
    const trigger: GameplayMapEffectTriggerDef = {
      id: 'damage-reward', event: 'damageApplied',
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
    };
    const result = runWithTriggers([{ op: 'damage', target: 'primary', amount: 5 }], [trigger], {
      ...baseInput(), statusDefinitions: [guard], statuses: [{ holder: enemy, statusId: 'guard', source: party,
        actionId: 'guard-action', appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
      shields: { 'enemy:e1': 1 },
    });

    expect(result.trace.find(row => row.op === 'damage')).toMatchObject({ amount: 3, before: 5, after: 3, delta: -2 });
    expect(result.shieldTrace).toMatchObject([{ op: 'damage', requestedAmount: 3, absorbed: 1, remainingDamage: 2 }]);
    expect(result.triggerTrace).toMatchObject([{
      queueIndex: 1, event: 'damageApplied', triggerId: 'damage-reward',
      requestedAmount: 5, actualAppliedAmount: 2, target: enemy,
    }]);
    expect(result.resourceLedger).toMatchObject([{
      account: 'primaryActor', identity: enemy, resourceId: 'focus', delta: 1, intentDelta: 1,
    }]);
  });

  it('gates Trigger activations on actual HP change, including reduction and Shield results', () => {
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 2, maxStacks: 3,
    };
    const triggers: GameplayMapEffectTriggerDef[] = [1, 2, 3].map(minimumActualAmount => ({
      id: `threshold-${minimumActualAmount}`, event: 'damageApplied', minimumActualAmount,
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: minimumActualAmount },
    }));
    const result = runWithTriggers([{ op: 'damage', target: 'primary', amount: 5 }], triggers, {
      ...baseInput(), statusDefinitions: [guard], statuses: [{ holder: enemy, statusId: 'guard', source: party,
        actionId: 'guard-action', appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
      shields: { 'enemy:e1': 1 },
    });

    expect(result.trace.find(row => row.op === 'damage')).toMatchObject({ before: 5, after: 3, delta: -2 });
    expect(result.triggerTrace.map(entry => [entry.triggerId, entry.requestedAmount, entry.actualAppliedAmount]))
      .toEqual([['threshold-1', 5, 2], ['threshold-2', 5, 2]]);
    expect(result.resourceLedger.map(entry => entry.delta)).toEqual([1, 2]);
  });

  it('uses HP-capped healing rather than the requested Heal amount for thresholds', () => {
    const triggers: GameplayMapEffectTriggerDef[] = [
      { id: 'one-restored', event: 'healApplied', minimumActualAmount: 1,
        effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } },
      { id: 'two-restored', event: 'healApplied', minimumActualAmount: 2,
        effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'signal', delta: 1 } },
    ];
    const result = runWithTriggers([{ op: 'heal', target: 'primary', amount: 3 }], triggers, {
      ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 9, cap: 10 } },
    });

    expect(result.triggerTrace.map(entry => [entry.triggerId, entry.requestedAmount, entry.actualAppliedAmount]))
      .toEqual([['one-restored', 3, 1]]);
    expect(result.resourceLedger.map(entry => [entry.resourceId, entry.delta])).toEqual([['focus', 1]]);
  });

  it('does not charge the shared activation budget for below-threshold Trigger candidates', () => {
    const triggers: GameplayMapEffectTriggerDef[] = [
      ...Array.from({ length: 32 }, (_, index) => ({
        id: `unmet-${index}`, event: 'damageApplied' as const, minimumActualAmount: 2,
        effect: { op: 'resourceChange' as const, account: 'primaryActor' as const, resourceId: 'focus', delta: 1 },
      })),
      { id: 'met', event: 'damageApplied', minimumActualAmount: 1,
        effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } },
    ];
    const result = runWithTriggers([{ op: 'damage', target: 'primary', amount: 1 }], triggers, baseInput(), {
      triggerActivationBudget: 1,
    });

    expect(result.triggerTrace.map(entry => entry.triggerId)).toEqual(['met']);
    expect(result.resourceLedger.map(entry => entry.delta)).toEqual([1]);
  });

  it('does not emit damageApplied triggers when no HP is lost or the damage uses a TargetSet', () => {
    const trigger: GameplayMapEffectTriggerDef = {
      id: 'damage-reward', event: 'damageApplied',
      effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 },
    };
    const guard: GameplayMapStatusDef = {
      id: 'guard', name: 'Guard', kind: 'damageReduction', category: 'beneficial',
      damageReductionPerStack: 5, maxStacks: 3,
    };
    const cases: Array<{ readonly name: string; readonly resolve: readonly GameplayMapEffectStatementDef[]; readonly input: MapEffectSourceInput }> = [
      { name: 'reduced to zero', resolve: [{ op: 'damage', target: 'primary', amount: 2 }], input: {
        ...baseInput(), statusDefinitions: [guard], statuses: [{ holder: enemy, statusId: 'guard', source: party,
          actionId: 'guard-action', appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2 }],
      } },
      { name: 'fully shield absorbed', resolve: [{ op: 'damage', target: 'primary', amount: 2 }], input: {
        ...baseInput(), shields: { 'enemy:e1': 2 },
      } },
      { name: 'downed', resolve: [{ op: 'damage', target: 'primary', amount: 2 }], input: {
        ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } },
      } },
      { name: 'TargetSet damage', resolve: [{ op: 'damage', target: { set: { side: 'enemy' } }, amount: 2 }], input: {
        ...baseInput(), targetOrder: { party: ['p1'], enemy: ['e1'] },
      } },
    ];
    for (const testCase of cases) {
      const result = runWithTriggers(testCase.resolve, [trigger], testCase.input);
      expect(result.triggerTrace, testCase.name).toEqual([]);
      expect(result.resourceLedger, testCase.name).toEqual([]);
    }
  });

  it('emits enemyDefeated once for a direct Party primary hit and rewards the source Actor', () => {
    const trigger: GameplayMapEffectTriggerDef = {
      id: 'ammo-on-defeat', event: 'enemyDefeated',
      effect: { op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1 },
    };
    const input = { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 5, cap: 10 } } };
    const result = runWithTriggers([
      { op: 'damage', target: 'primary', amount: 2 },
      { op: 'damage', target: 'primary', amount: 3, repeat: 2 },
    ], [trigger], input);

    expect(result.trace.filter(row => row.op === 'damage')).toMatchObject([
      { before: 5, after: 3, delta: -2 },
      { before: 3, after: 0, delta: -3, batch: { hitIndex: 0 } },
      { before: 0, after: 0, delta: 0, batch: { hitIndex: 1 } },
    ]);
    expect(result.triggerTrace).toMatchObject([{
      queueIndex: 1, event: 'enemyDefeated', triggerId: 'ammo-on-defeat',
      target: enemy, rewardRecipient: party, requestedAmount: 3, actualAppliedAmount: 3,
    }]);
    expect(result.resourceLedger).toMatchObject([{
      account: 'sourceActor', identity: party, resourceId: 'ammo', delta: 1, intentDelta: 1,
    }]);

    const cases: Array<{ name: string; input: MapEffectSourceInput; resolve?: GameplayMapEffectStatementDef[] }> = [
      { name: 'downed target', input: { ...input, hp: { ...input.hp, 'enemy:e1': { current: 0, cap: 10 } } } },
      { name: 'fully absorbed', input: { ...input, hp: { ...input.hp, 'enemy:e1': { current: 1, cap: 10 } }, shields: { 'enemy:e1': 6 } } },
      { name: 'target set', input: { ...input, targetOrder: { party: ['p1'], enemy: ['e1'] } },
        resolve: [{ op: 'damage', target: { set: { side: 'enemy' } }, amount: 5 }] },
      { name: 'forTargets body', input: { ...input, targetOrder: { party: ['p1'], enemy: ['e1'] } },
        resolve: [{ op: 'forTargets', targetSet: { side: 'enemy' }, body: [{ op: 'damage', target: 'primary', amount: 5 }] }] },
    ];
    for (const testCase of cases) {
      const noKill = runWithTriggers(testCase.resolve ?? [{ op: 'damage', target: 'primary', amount: 5 }], [trigger], testCase.input);
      expect(noKill.triggerTrace, testCase.name).toEqual([]);
      expect(noKill.resourceLedger, testCase.name).toEqual([]);
    }

    const partialShieldKill = runWithTriggers([{ op: 'damage', target: 'primary', amount: 5 }], [trigger], {
      ...input, hp: { ...input.hp, 'enemy:e1': { current: 3, cap: 10 } }, shields: { 'enemy:e1': 2 },
    });
    expect(partialShieldKill.triggerTrace).toMatchObject([{ event: 'enemyDefeated', requestedAmount: 5, actualAppliedAmount: 3 }]);

    const ward: GameplayMapStatusDef = { id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 1 };
    const protectedHit = runWithTriggers([{ op: 'damage', target: 'primary', amount: 5 }], [trigger], {
      ...input, hp: { ...input.hp, 'enemy:e1': { current: 3, cap: 10 } }, statusDefinitions: [ward],
      statuses: [{ holder: enemy, statusId: 'ward', source: party, actionId: 'ward-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 1 }],
    });
    expect(protectedHit.triggerTrace).toEqual([]);
    expect(protectedHit.resourceLedger).toEqual([]);

    const reduction: GameplayMapStatusDef = { id: 'barrier', name: 'Barrier', kind: 'damageReduction',
      category: 'beneficial', damageReductionPerStack: 5, maxStacks: 1 };
    const reducedToZero = runWithTriggers([{ op: 'damage', target: 'primary', amount: 5 }], [trigger], {
      ...input, hp: { ...input.hp, 'enemy:e1': { current: 3, cap: 10 } }, statusDefinitions: [reduction],
      statuses: [{ holder: enemy, statusId: 'barrier', source: party, actionId: 'barrier-action', appliedRound: 1,
        lastTriggeredRound: null, stacks: 1, remainingRounds: 1 }],
    });
    expect(reducedToZero.triggerTrace).toEqual([]);
    expect(reducedToZero.resourceLedger).toEqual([]);
  });

  it('queues mixed Heal and Damage events in FIFO order and runs only matching handlers', () => {
    const triggers: GameplayMapEffectTriggerDef[] = [
      { id: 'heal-focus', event: 'healApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } },
      { id: 'damage-signal', event: 'damageApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'signal', delta: 2 } },
      { id: 'heal-signal', event: 'healApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'signal', delta: 3 } },
      { id: 'damage-focus', event: 'damageApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 4 } },
    ];
    const result = runWithTriggers([
      { op: 'heal', target: 'primary', amount: 2 },
      { op: 'damage', target: 'primary', amount: 3 },
    ], triggers, { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 5, cap: 10 } } });

    expect(result.triggerTrace.map(entry => [entry.queueIndex, entry.event, entry.triggerId, entry.requestedAmount, entry.actualAppliedAmount]))
      .toEqual([
        [1, 'healApplied', 'heal-focus', 2, 2],
        [2, 'healApplied', 'heal-signal', 2, 2],
        [3, 'damageApplied', 'damage-signal', 3, 3],
        [4, 'damageApplied', 'damage-focus', 3, 3],
      ]);
    expect(result.resourceLedger.map(entry => [entry.resourceId, entry.delta]))
      .toEqual([['focus', 1], ['signal', 3], ['signal', 2], ['focus', 4]]);
  });

  it('shares the remaining Trigger activation budget across Heal and Damage events', () => {
    const triggers: GameplayMapEffectTriggerDef[] = [
      { id: 'heal-reward', event: 'healApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1 } },
      { id: 'damage-reward', event: 'damageApplied', effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'signal', delta: 1 } },
    ];
    const resolve: GameplayMapEffectStatementDef[] = [
      ...Array.from({ length: 16 }, () => ({ op: 'heal' as const, target: 'primary' as const, amount: 1 })),
      ...Array.from({ length: 17 }, () => ({ op: 'damage' as const, target: 'primary' as const, amount: 1 })),
    ];
    const input = { ...baseInput(), hp: { ...baseInput().hp, 'enemy:e1': { current: 20, cap: 100 } } };
    expect(() => runWithTriggers(resolve, triggers, input, { triggerActivationBudget: 32 }))
      .toThrow(/exceeds the remaining Commit Trigger activation budget of 32/);
  });

  it('resolves deterministic TargetSets once and reapplies Value / repeat against live planning HP', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(),
      round: 3,
      primary: null,
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1', 'e2', 'e3'] },
      hp: {
        'partyCharacter:p1': { current: 5, cap: 10 },
        'partyCharacter:p2': { current: 1, cap: 2 },
        'enemy:e1': { current: 9, cap: 10 },
        'enemy:e2': { current: 3, cap: 10 },
        'enemy:e3': { current: 0, cap: 10 },
      },
    };
    const result = run([{
      op: 'damage',
      target: { set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 2 } },
      amount: { kind: 'max', left: { kind: 'literal', value: 1 }, right: { kind: 'missingHp', unit: 'target' } },
      repeat: 2,
    }], input);
    expect(result.trace[0]).toMatchObject({
      op: 'targetSet', selection: 'set', identities: [{ kind: 'enemy', id: 'e2' }, enemy], repeatCount: 2,
    });
    const hits = result.trace.filter(row => row.op === 'damage');
    expect(hits).toMatchObject([
      { identity: { id: 'e2' }, before: 3, after: 0, amount: 7, batch: { targetIndex: 0, hitIndex: 0, targetCount: 2, repeatCount: 2 } },
      { identity: { id: 'e2' }, before: 0, after: 0, amount: 10, batch: { targetIndex: 0, hitIndex: 1 } },
      { identity: { id: 'e1' }, before: 9, after: 8, amount: 1, batch: { targetIndex: 1, hitIndex: 0 } },
      { identity: { id: 'e1' }, before: 8, after: 6, amount: 2, batch: { targetIndex: 1, hitIndex: 1 } },
    ]);
    expect(result.hp['enemy:e1']?.current).toBe(6);
    expect(result.hp['enemy:e2']?.current).toBe(0);
    expect(result.expansionCount).toBe(4);
    expect(input.hp['enemy:e2']?.current).toBe(3);
  });

  it('executes nested deterministic loops with shadowed loopTarget, restoration, budget visits, and replay trace', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(),
      primary: enemy,
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1', 'e2'] },
      hp: {
        'partyCharacter:p1': { current: 4, cap: 10 },
        'partyCharacter:p2': { current: 2, cap: 10 },
        'enemy:e1': { current: 8, cap: 10 },
        'enemy:e2': { current: 4, cap: 10 },
      },
    };
    const original = structuredClone(input);
    const visits: MapEffectVisit[] = [];
    const result = run([{
      op: 'forTargets', targetSet: { side: 'party', order: 'definition', limit: 2 }, body: [
        { op: 'when', condition: { kind: 'hpAtLeast', target: 'loopTarget', value: 3 }, then: [
          { op: 'hpChange', target: 'loopTarget', delta: 1 },
        ], else: [
          { op: 'hpChange', target: 'loopTarget', delta: -1 },
        ] },
        { op: 'forTargets', targetSet: { side: 'enemy', order: 'hpRatioAscending', limit: 2 }, body: [
          { op: 'when', condition: { kind: 'hpAtLeast', target: 'loopTarget', value: 5 }, then: [
            { op: 'hpChange', target: 'loopTarget', delta: -2 },
          ], else: [
            { op: 'hpChange', target: 'loopTarget', delta: 1 },
          ] },
        ] },
        { op: 'hpChange', target: 'loopTarget', delta: 1 },
        { op: 'heal', target: 'primary', amount: { kind: 'hp', unit: 'loopTarget' } },
      ],
    }], input, event => visits.push(event));

    expect(result.hp).toMatchObject({
      'partyCharacter:p1': { current: 6 },
      'partyCharacter:p2': { current: 2 },
      'enemy:e1': { current: 10 },
      'enemy:e2': { current: 3 },
    });
    expect(result.trace.filter(row => row.op === 'forTargets')).toMatchObject([
      { selector: { side: 'party' }, identities: [party, { kind: 'partyCharacter', id: 'p2' }] },
      { selector: { side: 'enemy' }, identities: [{ kind: 'enemy', id: 'e2' }, enemy] },
      { selector: { side: 'enemy' }, identities: [{ kind: 'enemy', id: 'e2' }, enemy] },
    ]);
    expect(result.trace.filter(row => row.op === 'forTarget')).toMatchObject([
      { iterationIndex: 0, targetCount: 2, identity: party },
      { iterationIndex: 0, targetCount: 2, identity: { kind: 'enemy', id: 'e2' } },
      { iterationIndex: 1, targetCount: 2, identity: enemy },
      { iterationIndex: 1, targetCount: 2, identity: { kind: 'partyCharacter', id: 'p2' } },
      { iterationIndex: 0, targetCount: 2, identity: { kind: 'enemy', id: 'e2' } },
      { iterationIndex: 1, targetCount: 2, identity: enemy },
    ]);
    expect(result.trace.filter(row => row.op === 'heal').map(row => row.op === 'heal' ? row.amount : null)).toEqual([6, 2]);
    expect(visits.filter(visit => visit.path === 'actions.action.effectProgram.resolve[0].body[0]'
      && visit.kind === 'statement')).toHaveLength(2);
    expect(input).toEqual(original);
  });

  it('evaluates shieldAdd Value against the active nested loopTarget and targetCount', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(),
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1', 'e2'] },
      hp: {
        'partyCharacter:p1': { current: 4, cap: 10 },
        'partyCharacter:p2': { current: 6, cap: 10 },
        'enemy:e1': { current: 5, cap: 10 },
        'enemy:e2': { current: 7, cap: 10 },
      },
      shields: {},
    };
    const amount = { kind: 'add', left: { kind: 'hp', unit: 'loopTarget' }, right: { kind: 'targetCount' } } as never;
    const result = run([{
      op: 'forTargets', targetSet: { side: 'enemy', order: 'definition' }, body: [
        { op: 'forTargets', targetSet: { side: 'party', order: 'definition' }, body: [
          { op: 'shieldAdd', target: 'primary', amount },
        ] },
        // After the nested loop, both loopTarget and targetCount return to the outer loop.
        { op: 'shieldAdd', target: 'primary', amount },
        { op: 'damage', target: 'primary', amount: 1, repeat: 2 },
      ],
    }], input);

    expect(result.shieldTrace?.map(row => row.op === 'shieldAdd' ? row.requestedAmount : null))
      .toEqual([6, 8, 7, null, null, 6, 8, 9, null, null]);
    expect(result.shieldTrace?.filter(row => row.op === 'damage')).toMatchObject([
      { requestedAmount: 1, absorbed: 1, remainingDamage: 0, hpBefore: 5, hpAfter: 5 },
      { requestedAmount: 1, absorbed: 1, remainingDamage: 0, hpBefore: 5, hpAfter: 5 },
      { requestedAmount: 1, absorbed: 1, remainingDamage: 0, hpBefore: 5, hpAfter: 5 },
      { requestedAmount: 1, absorbed: 1, remainingDamage: 0, hpBefore: 5, hpAfter: 5 },
    ]);
    expect(result.plannedShields).toEqual({ 'enemy:e1': 40 });
  });

  it('plans random damage sets and forTargets from one cursor and traces both fixed orders', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(), primary: null,
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1', 'e2', 'e3'] },
      hp: {
        'partyCharacter:p1': { current: 4, cap: 10 },
        'partyCharacter:p2': { current: 2, cap: 10 },
        'enemy:e1': { current: 9, cap: 10 },
        'enemy:e2': { current: 8, cap: 10 },
        'enemy:e3': { current: 7, cap: 10 },
      },
      effectRandomState: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursor: 0 },
    };
    const original = structuredClone(input);
    const result = run([
      { op: 'damage', target: { set: { side: 'enemy', order: 'random', limit: 2 } }, amount: 1 },
      { op: 'forTargets', targetSet: { side: 'party', order: 'random', limit: 1 }, body: [
        { op: 'hpChange', target: 'loopTarget', delta: 1 },
      ] },
    ], input);
    expect(result.trace.find(row => row.op === 'targetSet')).toMatchObject({
      identities: [{ kind: 'enemy', id: 'e2' }, { kind: 'enemy', id: 'e3' }],
      random: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursorBefore: 0, cursorAfter: 2 },
    });
    expect(result.trace.find(row => row.op === 'forTargets')).toMatchObject({
      identities: [party],
      random: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursorBefore: 2, cursorAfter: 3 },
    });
    expect(result.trace.find(row => row.op === 'hpChange')).toMatchObject({ identity: party, before: 4, after: 5 });
    expect(result.effectRandomState).toEqual({ algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursor: 3 });
    expect(input).toEqual(original);

    const deterministic = run([{ op: 'heal', target: 'primary', amount: 1 }], {
      ...baseInput(), effectRandomState: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 23, cursor: 7 },
    });
    expect(deterministic.effectRandomState).toEqual({ algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 23, cursor: 7 });

    const short = run([{ op: 'heal', target: { set: { side: 'enemy', order: 'random', limit: 5 } }, amount: 1 }], {
      ...baseInput(), targetOrder: { party: ['p1'], enemy: ['e1'] }, effectRandomState: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursor: 0 },
    });
    expect(short.trace.find(row => row.op === 'targetSet')).toMatchObject({
      identities: [enemy], random: { cursorBefore: 0, cursorAfter: 1 },
    });

    const empty = run([{ op: 'forTargets', targetSet: { side: 'enemy', order: 'random', limit: 2 }, body: [] }], {
      ...baseInput(), targetOrder: { party: ['p1'], enemy: [] }, effectRandomState: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursor: 7 },
    });
    expect(empty.trace.find(row => row.op === 'forTargets')).toMatchObject({
      identities: [], random: { cursorBefore: 7, cursorAfter: 7 },
    });
    expect(empty.effectRandomState?.cursor).toBe(7);
  });

  it('requires random state, validates runtime limit, and preserves input on random or budget errors', () => {
    const random = [{ op: 'forTargets' as const, targetSet: { side: 'enemy' as const, order: 'random' as const, limit: 2 }, body: [] }];
    const missingState = baseInput();
    const missingBefore = structuredClone(missingState);
    expect(() => run(random, missingState)).toThrow(/no Effect Random state.*actions\.action\.effectProgram\.resolve\[0\]/);
    expect(missingState).toEqual(missingBefore);

    const effects = program([]);
    for (const limit of [undefined, 0, 33, Number.NaN, 1.5]) {
      const malformed = {
        op: 'forTargets', targetSet: { side: 'enemy', order: 'random', ...(limit === undefined ? {} : { limit }) },
        body: [], originPath: 'actions.invalid.effectProgram.resolve[0]', mode: 'program',
      } as never;
      expect(() => planMapEffectSource({
        input: { ...baseInput(), effectRandomState: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursor: 0 } },
        effects, instructions: [malformed], visit: () => {},
      })).toThrow(/requires limit 1\.\.32/);
    }

    const input: MapEffectSourceInput = {
      ...baseInput(), targetOrder: { party: ['p1'], enemy: [] },
      effectRandomState: { algorithm: 'counter-addressed-murmur3-fmix32-v1', seed: 0, cursor: 0 },
    };
    const original = structuredClone(input);
    let bodyVisits = 0;
    const budget = (visit: MapEffectVisit) => {
      if (visit.path.endsWith('.body[0]') && ++bodyVisits > 0) throw new MapEffectPlanError(`budget exceeded at ${visit.path}`);
    };
    expect(() => run([{
      op: 'forTargets', targetSet: { side: 'party', order: 'random', limit: 1 },
      body: [{ op: 'hpChange', target: 'loopTarget', delta: 1 }],
    }], input, budget)).toThrow(/budget exceeded/);
    expect(input).toEqual(original);
  });

  it('keeps stable HP-ratio ties, permits empty sets, and floors negative division', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(), primary: null, round: 5,
      targetOrder: { party: ['p1', 'p2'], enemy: ['e2', 'e1'] },
      hp: {
        'partyCharacter:p1': { current: 2, cap: 4 },
        'partyCharacter:p2': { current: 5, cap: 10 },
        'enemy:e1': { current: 0, cap: 10 },
        'enemy:e2': { current: 0, cap: 10 },
      },
    };
    const empty = run([{ op: 'heal', target: { set: { side: 'enemy' } }, amount: 4 }], input);
    expect(empty.trace).toMatchObject([{ op: 'targetSet', identities: [], repeatCount: 1 }]);
    expect(empty.trace.filter(row => row.op === 'heal')).toHaveLength(0);

    const equalRatios = run([{
      op: 'heal', target: { set: { side: 'party', filter: 'all', order: 'hpRatioDescending' } }, amount: 0 + 1,
    }], input);
    expect(equalRatios.trace.find(row => row.op === 'targetSet')).toMatchObject({ identities: [{ id: 'p1' }, { id: 'p2' }] });

    const floored = run([{
      op: 'heal', target: { set: { side: 'party', limit: 1 } },
      amount: { kind: 'abs', value: { kind: 'divFloor', left: { kind: 'literal', value: -3 }, right: { kind: 'literal', value: 2 } } },
    }], input);
    expect(floored.trace.find(row => row.op === 'heal')).toMatchObject({ amount: 2 });
  });

  it('evaluates source, primary, Round, cap, target count, and clamp Values at the instruction position', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(), round: 2,
      primary: enemy,
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1'] },
      hp: {
        'partyCharacter:p1': { current: 4, cap: 10 },
        'partyCharacter:p2': { current: 5, cap: 10 },
        'enemy:e1': { current: 5, cap: 10 },
      },
    };
    const result = run([{
      op: 'damage', target: { set: { side: 'party' } },
      amount: {
        kind: 'clamp',
        value: { kind: 'add', left: { kind: 'hp', unit: 'source' }, right: { kind: 'round' } },
        min: { kind: 'literal', value: 2 },
        max: { kind: 'min', left: { kind: 'hpCap', unit: 'primary' }, right: {
          kind: 'add', left: { kind: 'targetCount' }, right: { kind: 'literal', value: 4 },
        } },
      },
    }], input);
    expect(result.trace.filter(row => row.op === 'damage').map(row => row.op === 'damage' ? row.amount : null)).toEqual([6, 2]);
    expect(result.hp['partyCharacter:p1']?.current).toBe(0);
    expect(result.hp['partyCharacter:p2']?.current).toBe(3);
  });

  it('rejects unsafe, negative, zero-divisor, and over-budget E2 Value / expansion plans', () => {
    const input = { ...baseInput(), round: 1 };
    const value = (kind: 'add' | 'divFloor', left: number, right: number) => ({ kind, left: { kind: 'literal', value: left }, right: { kind: 'literal', value: right } } as const);
    expect(() => run([{ op: 'damage', target: 'primary', amount: value('add', Number.MAX_SAFE_INTEGER, 1) }], input)).toThrow(/safe integer range/);
    expect(() => run([{ op: 'damage', target: 'primary', amount: value('divFloor', 1, 0) }], input)).toThrow(/divides by zero/);
    expect(() => run([{ op: 'damage', target: 'primary', amount: value('add', 1, -2) }], input)).toThrow(/non-negative safe integer/);
    expect(() => run([{ op: 'damage', target: 'primary', amount: 1, repeat: 9 } as GameplayMapEffectStatementDef], input)).toThrow(/repeat/);

    const roster = Array.from({ length: 32 }, (_, index) => `e${index}`);
    const hp = Object.fromEntries(roster.map(id => [`enemy:${id}`, { current: 10, cap: 10 }])) as MapEffectSourceInput['hp'];
    const many = { ...baseInput(), primary: null, targetOrder: { party: [], enemy: roster }, hp };
    const statements = Array.from({ length: 5 }, () => ({ op: 'heal' as const,
      target: { set: { side: 'enemy' as const } }, amount: 1, repeat: 8 }));
    expect(() => run(statements, many)).toThrow(/source expansion/);
  });

  it('does not expose partial HP plans when a later source identity fails', () => {
    const input = { ...baseInput(), source: null };
    const before = structuredClone(input);
    expect(() => run([
      { op: 'damage', target: 'primary', amount: 3 },
      { op: 'hpChange', target: 'source', delta: 1 },
    ], input)).toThrow(/no bound source identity/);
    expect(input).toEqual(before);
  });

  it('rejects missing bound identities and local keys without partial output', () => {
    expect(() => run([{ op: 'hpChange', target: 'primary', delta: -1 }], { ...baseInput(), primary: null })).toThrow(/no bound primary/);
    expect(() => run([{ op: 'counterAdd', counterId: 'absent', delta: 1 }], { ...baseInput(), locals: { counters: {}, flags: {} } })).toThrow(/Counter "absent" state/);
    expect(() => run([{ op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1 }], { ...baseInput(), source: null })).toThrow(/no bound source/);
    expect(() => run([{ op: 'hpChange', target: 'source', delta: -1 }], {
      ...baseInput(), hp: { ...baseInput().hp, 'partyCharacter:p1': { current: 0, cap: 0 } },
    })).toThrow(/valid HP\/cap/);
  });

  it('keeps equal resource keys attached to their separately bound accounts', () => {
    const result = run([
      { op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1 },
      { op: 'resourceChange', account: 'primaryActor', resourceId: 'ammo', delta: -1 },
      { op: 'resourceChange', account: 'sourceTeam', resourceId: 'ammo', delta: 2 },
    ]);
    expect(result.resourceLedger.map(row => [row.resourceId, row.identity])).toEqual([
      ['ammo', { kind: 'partyCharacter', id: 'p1' }],
      ['ammo', { kind: 'enemy', id: 'e1' }],
      ['ammo', { kind: 'team', side: 'party' }],
    ]);
  });

  it('binds additionalActor to the selected unit and preserves ordered loopTargetActor writes', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(),
      additionalTarget: { kind: 'enemy', id: 'e2' },
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1', 'e2'] },
      hp: { ...baseInput().hp, 'partyCharacter:p2': { current: 6, cap: 10 }, 'enemy:e2': { current: 7, cap: 10 } },
      resourceBalances: { actors: {
        'partyCharacter:p1': { focus: 1 }, 'partyCharacter:p2': { focus: 2 },
        'enemy:e1': { focus: 3 }, 'enemy:e2': { focus: 4 },
      }, teams: { party: {}, enemy: {} } },
    };
    const read = run([{ op: 'when', condition: { kind: 'resourceAtLeast', account: 'additionalActor', resourceId: 'focus', value: 4 }, then: [
      { op: 'damage', target: 'primary', amount: { kind: 'resourceBalance', account: 'additionalActor', resourceId: 'focus' } },
    ] }], input);
    expect(read.trace.find(row => row.op === 'when')).toMatchObject({ result: true,
      reads: [{ account: 'additionalActor', identity: { kind: 'enemy', id: 'e2' }, current: 4, result: true }] });
    expect(read.trace.find(row => row.op === 'damage')).toMatchObject({ amount: 4 });

    const loop = run([{ op: 'forTargets', targetSet: { side: 'party', order: 'definition' }, body: [
      { op: 'resourceChange', account: 'loopTargetActor', resourceId: 'focus', delta: 1 },
    ] }], input);
    expect(loop.resourceLedger.map(row => ({ account: row.account, identity: row.identity, delta: row.delta, intentDelta: row.intentDelta })))
      .toEqual([
        { account: 'loopTargetActor', identity: { kind: 'partyCharacter', id: 'p1' }, delta: 1, intentDelta: 1 },
        { account: 'loopTargetActor', identity: { kind: 'partyCharacter', id: 'p2' }, delta: 1, intentDelta: 1 },
      ]);
  });

  it('keeps a bound additional identity after it falls and zeros only its target-side resource write', () => {
    const input: MapEffectSourceInput = {
      ...baseInput(), primary: null, additionalTarget: { kind: 'enemy', id: 'e1' },
      hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } },
      resourceBalances: { actors: { 'partyCharacter:p1': {}, 'enemy:e1': { focus: 2 } }, teams: { party: {}, enemy: {} } },
    };
    const result = run([{ op: 'resourceChange', account: 'additionalActor', resourceId: 'focus', delta: 3 }], input);
    expect(result.resourceLedger).toMatchObject([{ identity: { kind: 'enemy', id: 'e1' }, delta: 0, intentDelta: 3 }]);
    expect(result.trace.find(row => row.op === 'resourceChange')).toMatchObject({ identity: { kind: 'enemy', id: 'e1' }, delta: 3 });
  });

  it('reads frozen source-start balances for Actor, Team, and loopTarget accounts', () => {
    const resourceBalances = {
      actors: {
        'partyCharacter:p1': { focus: 3 },
        'partyCharacter:p2': { focus: 2 },
        'enemy:e1': { focus: 4 },
      },
      teams: { party: { supplies: 2 }, enemy: { supplies: 7 } },
    };
    const input: MapEffectSourceInput = {
      ...baseInput(),
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1'] },
      hp: { ...baseInput().hp, 'partyCharacter:p2': { current: 6, cap: 10 } },
      resourceBalances,
    };
    const original = structuredClone(input);
    const result = run([
      { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 5 },
      { op: 'when', condition: { kind: 'resourceAtLeast', account: 'sourceTeam', resourceId: 'supplies', value: 2 }, then: [
        { op: 'damage', target: 'primary', amount: { kind: 'resourceBalance', account: 'sourceActor', resourceId: 'focus' } },
      ] },
      { op: 'when', condition: { kind: 'resourceAtLeast', account: 'primaryActor', resourceId: 'focus', value: 4 }, then: [
        { op: 'heal', target: 'primary', amount: { kind: 'resourceBalance', account: 'primaryActor', resourceId: 'focus' } },
      ] },
      { op: 'forTargets', targetSet: { side: 'party', order: 'definition' }, body: [
        { op: 'when', condition: { kind: 'resourceAtLeast', account: 'loopTargetActor', resourceId: 'focus', value: 2 }, then: [
          { op: 'damage', target: 'primary', amount: { kind: 'resourceBalance', account: 'loopTargetActor', resourceId: 'focus' } },
        ] },
      ] },
    ], input);

    expect(result.resourceLedger).toMatchObject([{ account: 'sourceTeam', resourceId: 'supplies', delta: 5 }]);
    expect(result.trace.filter(row => row.op === 'damage' || row.op === 'heal').map(row => row.op === 'damage' || row.op === 'heal' ? row.amount : null))
      .toEqual([3, 4, 3, 2]);
    expect(result.trace.filter(row => row.op === 'when').map(row => row.op === 'when' && row.reads[0]))
      .toMatchObject([
        { op: 'resourceAtLeast', account: 'sourceTeam', identity: { kind: 'team', side: 'party' }, current: 2, result: true },
        { op: 'resourceAtLeast', account: 'primaryActor', identity: enemy, current: 4, result: true },
        { op: 'resourceAtLeast', account: 'loopTargetActor', identity: party, current: 3, result: true },
        { op: 'resourceAtLeast', account: 'loopTargetActor', identity: { kind: 'partyCharacter', id: 'p2' }, current: 2, result: true },
      ]);
    expect(result.hp['enemy:e1']?.current).toBe(1);
    const teamValue = run([
      { op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 5 },
      { op: 'damage', target: 'primary', amount: { kind: 'resourceBalance', account: 'sourceTeam', resourceId: 'supplies' } },
    ], input);
    expect(teamValue.trace.find(row => row.op === 'damage')).toMatchObject({ amount: 2 });
    expect(teamValue.resourceLedger).toHaveLength(1);
    expect(input).toEqual(original);
  });

  it('rejects unbound, undeclared, and invalid resource balances without defaulting to zero', () => {
    const valueRead = [{ op: 'damage' as const, target: 'primary' as const,
      amount: { kind: 'resourceBalance' as const, account: 'sourceActor' as const, resourceId: 'focus' } }];
    expect(() => run(valueRead, baseInput())).toThrow(/no source-start resource balance snapshot/);
    expect(() => run(valueRead, { ...baseInput(), source: null, resourceBalances: {
      actors: { 'enemy:e1': { focus: 1 } }, teams: { party: {}, enemy: {} },
    } })).toThrow(/no bound source identity/);
    expect(() => run(valueRead, { ...baseInput(), resourceBalances: {
      actors: { 'partyCharacter:p1': {} }, teams: { party: {}, enemy: {} },
    } })).toThrow(/no declared resource "focus"/);
    expect(() => run(valueRead, { ...baseInput(), resourceBalances: {
      actors: { 'enemy:e1': { focus: 1 } }, teams: { party: {}, enemy: {} },
    } })).toThrow(/no materialized partyCharacter "p1"/);
    expect(() => run([{ op: 'when', condition: { kind: 'resourceAtLeast', account: 'sourceTeam', resourceId: 'focus', value: 1 }, then: [] }], {
      ...baseInput(), resourceBalances: { actors: { 'partyCharacter:p1': {} }, teams: { party: {}, enemy: {} } },
    })).toThrow(/no declared party Team resource "focus"/);
    expect(() => run([], { ...baseInput(), resourceBalances: {
      actors: { 'partyCharacter:p1': { focus: -1 } }, teams: { party: {}, enemy: {} },
    } })).toThrow(/invalid Actor resource balance/);
    expect(() => run([], { ...baseInput(), resourceBalances: {
      actors: { 'partyCharacter:p1': { focus: Number.MAX_SAFE_INTEGER + 1 } }, teams: { party: {}, enemy: {} },
    } })).toThrow(/invalid Actor resource balance/);
    expect(() => run([], { ...baseInput(), resourceBalances: {
      actors: { 'partyCharacter:p1': {} }, teams: { party: { focus: -1 }, enemy: {} },
    } })).toThrow(/invalid Team resource balance/);

    const additionalActorRead = [{ op: 'damage' as const, target: 'primary' as const,
      amount: { kind: 'resourceBalance' as const, account: 'additionalActor' as const, resourceId: 'focus' } }];
    expect(() => run(additionalActorRead, { ...baseInput(), resourceBalances: {
      actors: { 'partyCharacter:p1': { focus: 1 }, 'enemy:e1': { focus: 1 } }, teams: { party: {}, enemy: {} },
    } })).toThrow(/no bound additionalTarget identity/);
    expect(() => run([{ op: 'when', condition: { kind: 'resourceAtLeast', account: 'additionalActor', resourceId: 'focus', value: 1 }, then: [] }], {
      ...baseInput(), resourceBalances: { actors: { 'partyCharacter:p1': { focus: 1 } }, teams: { party: {}, enemy: {} } },
    })).toThrow(/no bound additionalTarget identity/);
    expect(() => run([{ op: 'when', condition: { kind: 'resourceAtLeast', account: 'loopTargetActor', resourceId: 'focus', value: 1 }, then: [] }], {
      ...baseInput(), resourceBalances: { actors: { 'partyCharacter:p1': { focus: 1 } }, teams: { party: {}, enemy: {} } },
    })).toThrow(/loopTargetActor used outside forTargets/);
  });

  it('reads and writes MapRun Facts in order, saturates Counters, and traces Fact reads/writes', () => {
    const mapRunFacts: NonNullable<MapEffectSourceInput['mapRunFacts']> = {
      declarations: {
        counters: [{ id: 'steps', initial: 1, min: 0, max: 3 }],
        flags: [{ id: 'ready', initial: false }],
      },
      state: { counters: [{ id: 'steps', value: 1 }], flags: [{ id: 'ready', value: false }] },
    };
    const input = { ...baseInput(), mapRunFacts };
    const original = structuredClone(input);
    const result = run([
      { op: 'mapRunCounterAdd', counterId: 'steps', delta: 1 },
      { op: 'when', condition: { kind: 'mapRunCounter', counterId: 'steps', comparison: 'gte', value: 2 }, then: [
        { op: 'mapRunFlagSet', flagId: 'ready', value: true },
      ] },
      { op: 'when', condition: { kind: 'mapRunFlag', flagId: 'ready', value: true }, then: [
        { op: 'damage', target: 'primary', amount: { kind: 'mapRunCounter', counterId: 'steps' } },
      ] },
      { op: 'mapRunCounterAdd', counterId: 'steps', delta: 5 },
    ], input);

    expect(result.plannedMapRunFacts).toEqual({
      counters: [{ id: 'steps', value: 3 }], flags: [{ id: 'ready', value: true }],
    });
    expect(result.trace.filter(row => ['mapRunCounterAdd', 'when', 'mapRunFlagSet', 'damage'].includes(row.op))).toMatchObject([
      { op: 'mapRunCounterAdd', counterId: 'steps', before: 1, after: 2, delta: 1, requestedDelta: 1 },
      { op: 'when', reads: [{ op: 'mapRunCounter', counterId: 'steps', current: 2, result: true }] },
      { op: 'mapRunFlagSet', flagId: 'ready', before: false, after: true },
      { op: 'when', reads: [{ op: 'mapRunFlag', flagId: 'ready', current: true, result: true }] },
      { op: 'damage', amount: 2, before: 5, after: 3 },
      { op: 'mapRunCounterAdd', counterId: 'steps', before: 2, after: 3, delta: 1, requestedDelta: 5 },
    ]);
    expect(input).toEqual(original);
    expect(Object.isFrozen(result.plannedMapRunFacts?.counters)).toBe(true);
    expect(Object.isFrozen(result.plannedMapRunFacts?.counters[0])).toBe(true);
    expect(Object.isFrozen(result.plannedMapRunFacts)).toBe(true);

    const looped = run([{
      op: 'forTargets', targetSet: { side: 'party', order: 'definition' }, body: [
        { op: 'mapRunCounterAdd', counterId: 'steps', delta: 1 },
        { op: 'when', condition: { kind: 'mapRunCounter', counterId: 'steps', comparison: 'eq', value: 1 },
          then: [{ op: 'mapRunFlagSet', flagId: 'ready', value: false }],
          else: [{ op: 'mapRunFlagSet', flagId: 'ready', value: true }] },
      ],
    }], {
      ...baseInput(),
      targetOrder: { party: ['p1', 'p2'], enemy: ['e1'] },
      hp: { ...baseInput().hp, 'partyCharacter:p2': { current: 5, cap: 10 } },
      mapRunFacts: {
        declarations: { counters: [{ id: 'steps', initial: 0, min: 0, max: 3 }], flags: [{ id: 'ready', initial: false }] },
        state: { counters: [{ id: 'steps', value: 0 }], flags: [{ id: 'ready', value: false }] },
      },
    });
    expect(looped.plannedMapRunFacts).toEqual({
      counters: [{ id: 'steps', value: 2 }], flags: [{ id: 'ready', value: true }],
    });
    expect(looped.trace.filter(row => row.op === 'mapRunCounterAdd' || row.op === 'mapRunFlagSet')).toMatchObject([
      { op: 'mapRunCounterAdd', before: 0, after: 1 },
      { op: 'mapRunFlagSet', before: false, after: false },
      { op: 'mapRunCounterAdd', before: 1, after: 2 },
      { op: 'mapRunFlagSet', before: false, after: true },
    ]);
  });

  it('rejects absent, undeclared, duplicated, or malformed MapRun Facts and Counter overflow atomically', () => {
    const counterRead = [{ op: 'damage' as const, target: 'primary' as const,
      amount: { kind: 'mapRunCounter' as const, counterId: 'steps' } }];
    expect(() => run(counterRead)).toThrow(/missing MapRun Counter "steps"/);
    expect(Object.prototype.hasOwnProperty.call(run([]), 'plannedMapRunFacts')).toBe(false);

    const validFacts: NonNullable<MapEffectSourceInput['mapRunFacts']> = {
      declarations: { counters: [{ id: 'steps', initial: 0, min: 0, max: 3 }] },
      state: { counters: [{ id: 'steps', value: 1 }], flags: [] },
    };
    expect(() => run(counterRead, { ...baseInput(), mapRunFacts: {
      declarations: validFacts.declarations, state: { counters: [], flags: [] },
    } })).toThrow(/missing or invalid MapRun Counter "steps" state/);
    expect(() => run(counterRead, { ...baseInput(), mapRunFacts: {
      declarations: { counters: [{ id: 'steps', initial: 0, min: 0, max: 3 }], flags: [{ id: 'steps', initial: false }] },
      state: { counters: [{ id: 'steps', value: 1 }], flags: [{ id: 'steps', value: false }] },
    } })).toThrow(/invalid or duplicate MapRun Fact Flag declaration/);
    expect(() => run(counterRead, { ...baseInput(), mapRunFacts: {
      declarations: validFacts.declarations,
      state: { counters: [{ id: 'steps', value: 4 }], flags: [] },
    } })).toThrow(/missing or invalid MapRun Counter "steps" state/);
    expect(() => run([{ op: 'mapRunFlagSet', flagId: 'missing', value: true }], { ...baseInput(), mapRunFacts: validFacts }))
      .toThrow(/reads or writes missing MapRun Flag "missing"/);
    expect(() => run(counterRead, { ...baseInput(), mapRunFacts: {
      declarations: { flags: [{ id: 'ready', initial: false }] },
      state: { counters: [], flags: [{ id: 'ready', value: 'false' as never }] },
    } })).toThrow(/missing or invalid MapRun Flag "ready" state/);

    const overflowFacts: NonNullable<MapEffectSourceInput['mapRunFacts']> = {
      declarations: { counters: [{ id: 'steps', initial: 0, min: 0, max: Number.MAX_SAFE_INTEGER }] },
      state: { counters: [{ id: 'steps', value: Number.MAX_SAFE_INTEGER - 1 }], flags: [] },
    };
    const input = { ...baseInput(), mapRunFacts: overflowFacts };
    const original = structuredClone(input);
    expect(() => run([{ op: 'mapRunCounterAdd', counterId: 'steps', delta: 2 }], input)).toThrow(/MapRun Counter "steps" addition exceeds safe integer range/);
    expect(input).toEqual(original);
  });

  it('reports only reached dynamic accesses to the injected shared budget', () => {
    const visits: MapEffectVisit[] = [];
    const shortCircuit = run([
      { op: 'when', condition: { kind: 'all', conditions: [
        { kind: 'hpAtMost', target: 'source', value: 0 },
        { kind: 'flag', flagId: 'ready', value: true },
      ] }, then: [{ op: 'flagSet', flagId: 'ready', value: true }] },
    ], baseInput(), event => visits.push(event));
    expect(visits.map(row => row.kind)).toEqual(['statement', 'condition', 'condition']);
    expect(visits.some(row => row.path.endsWith('conditions[1]'))).toBe(false);
    expect(shortCircuit.trace[0]).toMatchObject({ op: 'when', result: false });

    let sharedVisits = 0;
    const shared = (event: MapEffectVisit) => {
      sharedVisits += 1;
      if (sharedVisits > 4096) throw new MapEffectPlanError(`shared visit budget exceeded at ${event.path}`);
    };
    const leaf = [{ op: 'flagSet' as const, flagId: 'ready', value: true }];
    for (let index = 0; index < 4096; index += 1) run(leaf, baseInput(), shared);
    expect(sharedVisits).toBe(4096);
    expect(() => run(leaf, baseInput(), shared)).toThrow(/shared visit budget exceeded/);
    expect(sharedVisits).toBe(4097);
  });

  it('returns prepare discounts as metadata without reporting prepare access', () => {
    const visits: MapEffectVisit[] = [];
    const result = run([], baseInput(), event => visits.push(event), [{ op: 'discountSCost', amount: 2 }]);
    expect(result.prepareDiscounts).toMatchObject([{ op: 'discountSCost', amount: 2 }]);
    expect(visits).toEqual([]);
  });

  it('rejects an unknown normalized instruction instead of treating it as a resource leaf', () => {
    const effects = program([]);
    const malformed = { op: 'unknown', originPath: 'bad.path', mode: 'program' } as never;
    expect(() => planMapEffectSource({ input: baseInput(), effects, instructions: [malformed], visit: () => {} })).toThrow(/unknown effect instruction/);
  });

  it('plans Status application by holder, Status, source identity, and source Action', () => {
    const burn: GameplayMapStatusDef = { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 };
    const sourceIdentity = { kind: 'partyCharacter' as const, id: 'p1' };
    const initialStatus: MapEncounterStatusInstance = {
      holder: enemy,
      statusId: 'burn',
      source: sourceIdentity,
      actionId: 'action',
      appliedRound: 2,
      lastTriggeredRound: null,
      stacks: 2,
      remainingRounds: 1,
    };
    const input: MapEffectSourceInput = {
      ...baseInput(),
      round: 3,
      sourceIdentity,
      statusDefinitions: [burn],
      statuses: [initialStatus],
    };
    const original = structuredClone(input);
    const result = run([
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 4 },
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 5 },
    ], input);

    expect(result.plannedStatuses).toEqual([{
      holder: enemy,
      statusId: 'burn',
      source: sourceIdentity,
      actionId: 'action',
      appliedRound: 2,
      lastTriggeredRound: null,
      stacks: 3,
      remainingRounds: 5,
    }]);
    expect(result.statusApplyTrace).toMatchObject([
      { beforeStacks: 2, afterStacks: 3, beforeRemainingRounds: 1, afterRemainingRounds: 4, beforeAppliedRound: 2, beforeLastTriggeredRound: null },
      { beforeStacks: 3, afterStacks: 3, beforeRemainingRounds: 4, afterRemainingRounds: 5, beforeAppliedRound: 2, beforeLastTriggeredRound: null },
    ]);
    expect(result.trace.filter(entry => entry.op === 'statusApply')).toHaveLength(2);
    expect(input).toEqual(original);
    expect(Object.isFrozen(result.plannedStatuses)).toBe(true);
    expect(Object.isFrozen(result.plannedStatuses[0]?.source)).toBe(true);

    const atRoundEnd = applyMapEncounterStatusRoundEnd({
      round: 3,
      definitions: [burn],
      statuses: result.plannedStatuses,
      hp: baseInput().hp,
      partyOrder: ['p1'],
      enemyOrder: ['e1'],
    });
    expect(atRoundEnd.trace).toMatchObject([{ statusId: 'burn', remainingRoundsBefore: 5, remainingRoundsAfter: 4 }]);
    expect(atRoundEnd.hp['enemy:e1']?.current).toBe(0);
  });

  it('removes all matching holder/Status instances in stable order and supports ordered apply/remove', () => {
    const burn: GameplayMapStatusDef = { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 };
    const regen: GameplayMapStatusDef = { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 2 };
    const makeStatus = (holder: typeof party | typeof enemy, statusId: string, sourceId: string, actionId: string): MapEncounterStatusInstance => ({
      holder, statusId, source: { kind: 'partyCharacter', id: sourceId }, actionId,
      appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
    });
    const input: MapEffectSourceInput = {
      ...baseInput(),
      round: 2,
      sourceIdentity: { kind: 'partyCharacter', id: 'p1' },
      statusDefinitions: [burn, regen],
      statuses: [
        makeStatus(enemy, 'burn', 'p2', 'z-hit'),
        makeStatus(enemy, 'regen', 'p1', 'regen-action'),
        makeStatus(enemy, 'burn', 'p1', 'z-hit'),
        makeStatus(enemy, 'burn', 'p1', 'a-hit'),
        makeStatus({ kind: 'enemy', id: 'e2' }, 'burn', 'p1', 'other-holder'),
      ],
    };
    const original = structuredClone(input);
    const removed = run([{ op: 'statusRemove', target: 'primary', statusId: 'burn' }], input);

    expect(removed.plannedStatuses).toEqual([input.statuses?.[1], input.statuses?.[4]]);
    expect(removed.statusRemoveTrace).toMatchObject([{
      identity: enemy,
      statusId: 'burn',
      removed: [
        { statusIndexBefore: 3, status: { source: { id: 'p1' }, actionId: 'a-hit' } },
        { statusIndexBefore: 2, status: { source: { id: 'p1' }, actionId: 'z-hit' } },
        { statusIndexBefore: 0, status: { source: { id: 'p2' }, actionId: 'z-hit' } },
      ],
    }]);
    expect(removed.trace).toMatchObject([{ op: 'statusRemove', identity: enemy, statusId: 'burn' }]);
    expect(removed.hp).toEqual(input.hp);
    expect(removed.locals).toEqual(input.locals);
    expect(input).toEqual(original);

    const noMatch = run([{ op: 'statusRemove', target: 'source', statusId: 'regen' }], input);
    expect(noMatch.statusRemoveTrace).toMatchObject([{ identity: party, statusId: 'regen', removed: [] }]);
    expect(noMatch.plannedStatuses).toEqual(input.statuses);

    const emptyInput = { ...baseInput(), round: 2, sourceIdentity: { kind: 'partyCharacter' as const, id: 'p1' }, statusDefinitions: [burn] };
    const applyThenRemove = run([
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 },
      { op: 'statusRemove', target: 'primary', statusId: 'burn' },
    ], emptyInput);
    expect(applyThenRemove.plannedStatuses).toEqual([]);
    expect(applyThenRemove.trace.map(row => row.op)).toEqual(['statusApply', 'statusRemove']);
    expect(applyThenRemove.statusRemoveTrace[0]?.removed).toMatchObject([{ statusIndexBefore: 0 }]);

    const removeThenApply = run([
      { op: 'statusRemove', target: 'primary', statusId: 'burn' },
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 },
    ], emptyInput);
    expect(removeThenApply.plannedStatuses).toHaveLength(1);
    expect(removeThenApply.statusRemoveTrace[0]?.removed).toEqual([]);
    expect(removeThenApply.trace.map(row => row.op)).toEqual(['statusRemove', 'statusApply']);

    const badLaterStatement = structuredClone(input);
    expect(() => run([
      { op: 'statusRemove', target: 'primary', statusId: 'burn' },
      { op: 'statusRemove', target: 'primary', statusId: 'missing' },
    ], badLaterStatement)).toThrow(/references missing Status "missing"/);
    expect(badLaterStatement).toEqual(original);
  });

  it('removes every Status in the requested Map category from one holder in stable order', () => {
    const definitions: GameplayMapStatusDef[] = [
      { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3, category: 'harmful' },
      { id: 'poison', name: 'Poison', kind: 'burn', hpPerStack: 1, maxStacks: 3, category: 'harmful' },
      { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 2, category: 'beneficial' },
      { id: 'uncategorized', name: 'Uncategorized', kind: 'burn', hpPerStack: 1, maxStacks: 2 },
    ];
    const makeStatus = (statusId: string, sourceId: string, actionId: string): MapEncounterStatusInstance => ({
      holder: enemy, statusId, source: { kind: 'partyCharacter', id: sourceId }, actionId,
      appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
    });
    const input: MapEffectSourceInput = {
      ...baseInput(),
      hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } },
      statusDefinitions: definitions,
      statuses: [
        makeStatus('burn', 'p1', 'z-action'),
        makeStatus('regen', 'p1', 'regen-action'),
        makeStatus('poison', 'p2', 'poison-action'),
        makeStatus('uncategorized', 'p1', 'uncategorized-action'),
        makeStatus('burn', 'p1', 'a-action'),
        { ...makeStatus('burn', 'p1', 'other-holder-action'), holder: { kind: 'enemy', id: 'e2' } },
      ],
    };
    const original = structuredClone(input);
    const result = run([
      { op: 'statusRemoveCategory', target: 'primary', category: 'harmful' },
      { op: 'statusRemoveCategory', target: 'primary', category: 'beneficial' },
    ], input);

    expect(result.plannedStatuses).toEqual([input.statuses?.[3], input.statuses?.[5]]);
    expect(result.statusCategoryRemoveTrace).toMatchObject([
      {
        op: 'statusRemoveCategory', identity: enemy, category: 'harmful',
        removed: [
          { statusIndexBefore: 4, status: { statusId: 'burn', actionId: 'a-action' } },
          { statusIndexBefore: 0, status: { statusId: 'burn', actionId: 'z-action' } },
          { statusIndexBefore: 2, status: { statusId: 'poison', actionId: 'poison-action' } },
        ],
      },
      { op: 'statusRemoveCategory', identity: enemy, category: 'beneficial', removed: [{ statusIndexBefore: 0, status: { statusId: 'regen' } }] },
    ]);
    expect(result.trace.map(row => row.op)).toEqual(['statusRemoveCategory', 'statusRemoveCategory']);
    expect(result.hp['enemy:e1']?.current).toBe(0);
    expect(input).toEqual(original);

    const noMatch = run([{ op: 'statusRemoveCategory', target: 'source', category: 'harmful' }], input);
    expect(noMatch.statusCategoryRemoveTrace).toMatchObject([{ identity: party, category: 'harmful', removed: [] }]);
    expect(noMatch.plannedStatuses).toEqual(input.statuses);

    const ordered = run([
      { op: 'statusRemoveCategory', target: 'primary', category: 'harmful' },
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 },
      { op: 'statusRemoveCategory', target: 'primary', category: 'harmful' },
    ], {
      ...baseInput(), sourceIdentity: party, round: 2,
      statusDefinitions: definitions,
      statuses: [makeStatus('burn', 'p2', 'preexisting')],
    });
    expect(ordered.plannedStatuses).toEqual([]);
    expect(ordered.trace.map(row => row.op)).toEqual(['statusRemoveCategory', 'statusApply', 'statusRemoveCategory']);
    expect(ordered.statusCategoryRemoveTrace.map(row => row.removed.length)).toEqual([1, 1]);
  });

  it('consumes Status stacks by earliest expiry, records full changes, and composes statements in order', () => {
    const burn: GameplayMapStatusDef = { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 5 };
    const regen: GameplayMapStatusDef = { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 1, maxStacks: 2 };
    const makeStatus = (statusId: string, sourceId: string, actionId: string, stacks: number, remainingRounds: number): MapEncounterStatusInstance => ({
      holder: enemy,
      statusId,
      source: { kind: 'partyCharacter', id: sourceId },
      actionId,
      appliedRound: 1,
      lastTriggeredRound: null,
      stacks,
      remainingRounds,
    });
    const input: MapEffectSourceInput = {
      ...baseInput(),
      hp: { ...baseInput().hp, 'enemy:e1': { current: 0, cap: 10 } },
      sourceIdentity: party,
      statusDefinitions: [burn, regen],
      statuses: [
        makeStatus('burn', 'p2', 'later-expiry', 2, 5),
        makeStatus('burn', 'p2', 'earlier-z', 2, 1),
        makeStatus('burn', 'p1', 'earlier-a', 2, 1),
        makeStatus('regen', 'p1', 'different-status', 1, 1),
      ],
    };
    const original = structuredClone(input);
    const consumed = run([
      { op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 3 },
      { op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 8 },
      { op: 'statusConsume', target: 'source', statusId: 'burn', stacks: 1 },
    ], input);

    expect(consumed.statusConsumeTrace).toMatchObject([
      {
        identity: enemy,
        statusId: 'burn',
        requestedStacks: 3,
        consumedStacks: 3,
        unmetStacks: 0,
        changes: [
          { statusIndexBefore: 2, statusBefore: { actionId: 'earlier-a', stacks: 2 }, consumedStacks: 2, statusAfter: null },
          { statusIndexBefore: 1, statusBefore: { actionId: 'earlier-z', stacks: 2 }, consumedStacks: 1,
            statusAfter: { actionId: 'earlier-z', stacks: 1, remainingRounds: 1 } },
        ],
      },
      {
        identity: enemy,
        requestedStacks: 8,
        consumedStacks: 3,
        unmetStacks: 5,
        changes: [
          { statusIndexBefore: 1, statusBefore: { actionId: 'earlier-z', stacks: 1 }, consumedStacks: 1, statusAfter: null },
          { statusIndexBefore: 0, statusBefore: { actionId: 'later-expiry', stacks: 2 }, consumedStacks: 2, statusAfter: null },
        ],
      },
      { identity: party, requestedStacks: 1, consumedStacks: 0, unmetStacks: 1, changes: [] },
    ]);
    expect(consumed.plannedStatuses).toEqual([input.statuses?.[3]]);
    expect(consumed.trace.map(row => row.op)).toEqual(['statusConsume', 'statusConsume', 'statusConsume']);
    expect(consumed.hp['enemy:e1']?.current).toBe(0);
    expect(input).toEqual(original);
  });

  it('keeps apply, consume, and remove traces independent and in statement order', () => {
    const burn: GameplayMapStatusDef = { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 };
    const input: MapEffectSourceInput = {
      ...baseInput(),
      round: 2,
      sourceIdentity: party,
      statusDefinitions: [burn],
    };
    const result = run([
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 4 },
      { op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 1 },
      { op: 'statusRemove', target: 'primary', statusId: 'burn' },
    ], input);

    expect(result.trace.map(row => row.op)).toEqual(['statusApply', 'statusConsume', 'statusRemove']);
    expect(result.statusApplyTrace).toHaveLength(1);
    expect(result.statusConsumeTrace[0]?.changes).toMatchObject([{ statusBefore: { stacks: 2 }, consumedStacks: 1, statusAfter: { stacks: 1 } }]);
    expect(result.statusRemoveTrace[0]?.removed).toMatchObject([{ status: { stacks: 1 }, statusIndexBefore: 0 }]);
    expect(result.plannedStatuses).toEqual([]);
  });

  it('applies round-end Statuses in roster and source order without reviving, and reverses Receipt trace', () => {
    const definitions: GameplayMapStatusDef[] = [
      { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 5 },
      { id: 'regen', name: 'Regen', kind: 'regen', hpPerStack: 4, maxStacks: 3 },
    ];
    const makeStatus = (
      holder: typeof party | typeof enemy,
      statusId: string,
      sourceId: string,
      actionId: string,
      appliedRound: number,
      stacks = 1,
      remainingRounds = 2,
    ): MapEncounterStatusInstance => ({
      holder,
      statusId,
      source: { kind: 'partyCharacter', id: sourceId },
      actionId,
      appliedRound,
      lastTriggeredRound: null,
      stacks,
      remainingRounds,
    });
    const statuses = [
      makeStatus(enemy, 'burn', 'p1', 'z-action', 2, 2),
      makeStatus(party, 'regen', 'p1', 'heal-action', 2, 1, 1),
      makeStatus(enemy, 'burn', 'p2', 'a-action', 2, 2, 1),
      makeStatus({ kind: 'enemy', id: 'e2' }, 'burn', 'p1', 'enemy-burn', 2),
      makeStatus({ kind: 'enemy', id: 'e1' }, 'burn', 'p1', 'new-burn', 3),
    ];
    const hp = {
      'partyCharacter:p1': { current: 0, cap: 10 },
      'partyCharacter:p2': { current: 8, cap: 10 },
      'enemy:e1': { current: 6, cap: 10 },
      'enemy:e2': { current: 4, cap: 10 },
    };
    const beforeStatuses = structuredClone(statuses);
    const beforeHp = structuredClone(hp);
    const result = applyMapEncounterStatusRoundEnd({
      round: 3,
      definitions,
      statuses,
      hp,
      partyOrder: ['p2', 'p1'],
      enemyOrder: ['e2', 'e1'],
    });

    expect(result.trace.map(entry => entry.holder)).toEqual([party, { kind: 'enemy', id: 'e2' }, enemy, enemy]);
    expect(result.hp['partyCharacter:p2']?.current).toBe(8);
    expect(result.hp['partyCharacter:p1']?.current).toBe(0);
    expect(result.hp['enemy:e2']?.current).toBe(2);
    expect(result.hp['enemy:e1']?.current).toBe(0);
    expect(result.statuses).toHaveLength(3);
    expect(result.statuses.find(status => status.holder.id === 'e1' && status.actionId === 'new-burn')).toMatchObject({ appliedRound: 3, remainingRounds: 2, lastTriggeredRound: null });
    expect(result.trace.find(entry => entry.holder.id === 'p1')).toMatchObject({ removed: true, hpBefore: 0, hpAfter: 0, hpDelta: 0 });
    expect(statuses).toEqual(beforeStatuses);
    expect(hp).toEqual(beforeHp);

    const reversed = reverseMapEncounterStatusTrace(result.statuses, result.hp, result.trace, 3);
    expect(reversed?.statuses).toEqual(statuses);
    expect(reversed?.hp).toEqual(hp);
    expect(validateMapEncounterStatusTrace({
      statusReceiptVersion: 1,
      statusTrace: result.trace,
      round: 3,
      definitions,
      plannedStatuses: result.statuses,
      receiptHp: result.hp,
      partyOrder: ['p2', 'p1'],
      enemyOrder: ['e2', 'e1'],
      tickSkipped: false,
    })).toEqual(result);
    const tamperedTrace = result.trace.map((entry, index) => index === 0 ? { ...entry, hpDelta: entry.hpDelta + 1 } : entry);
    expect(validateMapEncounterStatusTrace({
      statusReceiptVersion: 1,
      statusTrace: tamperedTrace,
      round: 3,
      definitions,
      plannedStatuses: result.statuses,
      receiptHp: result.hp,
      partyOrder: ['p2', 'p1'],
      enemyOrder: ['e2', 'e1'],
      tickSkipped: false,
    })).toBeNull();
  });

  it('validates restored Status attribution against the owning Encounter source', () => {
    const burn: GameplayMapStatusDef = { id: 'burn', name: 'Burn', kind: 'burn', hpPerStack: 2, maxStacks: 3 };
    const action: GameplayMapActionDef = {
      id: 'burn-action',
      name: 'Burning Strike',
      eligibleCharacterIds: ['p1' as never],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 }] },
    };
    const map = {
      partyCharacterIds: ['p1'],
      statuses: [burn],
      actions: [action],
      candidatePools: [],
    } as unknown as GameplayMapDef;
    const encounter: GameplayEncounterDef = {
      title: 'Status Test',
      participants: [{ characterId: 'p1' as never, actions: [{ actionId: 'burn-action', tendencyWeight: 1 }] }],
      enemies: [{ id: 'e1', initialHp: 5, maxHp: 5 }],
    };
    const instance: MapEncounterStatusInstance = {
      holder: enemy,
      statusId: 'burn',
      source: { kind: 'partyCharacter', id: 'p1' },
      actionId: 'burn-action',
      appliedRound: 1,
      lastTriggeredRound: null,
      stacks: 1,
      remainingRounds: 2,
    };
    const valid = validateMapEncounterStatusInstances([instance], { map, encounter, currentRound: 2 });
    expect(valid).toEqual([instance]);
    expect(Object.isFrozen(valid)).toBe(true);
    expect(Object.isFrozen(valid?.[0]?.source)).toBe(true);

    const noLongerCandidate = {
      ...encounter,
      participants: [{ characterId: 'p1' as never, actions: [] }],
    };
    expect(validateMapEncounterStatusInstances([instance], { map, encounter: noLongerCandidate, currentRound: 2 })).toBeNull();
    expect(validateMapEncounterStatusInstances([{ ...instance, extra: true }], { map, encounter, currentRound: 2 })).toBeNull();
    expect(validateMapEncounterStatusInstances([instance, instance], { map, encounter, currentRound: 2 })).toBeNull();

    const copied = copyMapEncounterStatusInstances([instance]);
    expect(copied).toEqual([instance]);
    expect(Object.isFrozen(copied[0]?.holder)).toBe(true);
  });

  it('validates and round-end ticks damageProtection as zero-HP Status under Receipt v6', () => {
    const ward: GameplayMapStatusDef = {
      id: 'ward', name: 'Ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 2,
    };
    const action: GameplayMapActionDef = {
      id: 'ward-action', name: 'Apply Ward', eligibleCharacterIds: ['p1' as never], target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [{ op: 'statusApply', target: 'primary', statusId: 'ward', stacks: 1, durationRounds: 1 }] },
    };
    const map = { partyCharacterIds: ['p1'], statuses: [ward], actions: [action], candidatePools: [] } as unknown as GameplayMapDef;
    const encounter: GameplayEncounterDef = {
      title: 'Protection Status Test', participants: [{ characterId: 'p1' as never, actions: [{ actionId: action.id, tendencyWeight: 1 }] }],
    };
    const status: MapEncounterStatusInstance = {
      holder: party, statusId: 'ward', source: party, actionId: action.id,
      appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 1,
    };
    expect(validateMapEncounterStatusInstances([status], { map, encounter, currentRound: 2 })).toEqual([status]);

    const startHp = { 'partyCharacter:p1': { current: 4, cap: 10 } };
    const result = applyMapEncounterStatusRoundEnd({
      round: 2, definitions: [ward], statuses: [status], hp: startHp, partyOrder: ['p1'], enemyOrder: [],
    });
    expect(result.hp['partyCharacter:p1']).toEqual({ current: 4, cap: 10 });
    expect(result.statuses).toEqual([]);
    expect(result.trace).toMatchObject([{
      statusKind: 'damageProtection', statusId: 'ward', hpBefore: 4, hpAfter: 4, hpDelta: 0,
      remainingRoundsBefore: 1, remainingRoundsAfter: 0, removed: true,
    }]);
    expect(reverseMapEncounterStatusTrace(result.statuses, result.hp, result.trace, 2)).toMatchObject({
      statuses: [status], hp: startHp,
    });
    expect(validateMapEncounterStatusTrace({
      statusReceiptVersion: 6, statusTrace: result.trace, round: 2, definitions: [ward],
      plannedStatuses: result.statuses, receiptHp: result.hp, partyOrder: ['p1'], enemyOrder: [], tickSkipped: false,
    })).toEqual(result);
  });
});
