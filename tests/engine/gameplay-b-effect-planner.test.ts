import { describe, expect, it } from 'vitest';
import type { GameplayMapActionDef } from '../../src/data-services/contracts/gameplay-map';
import type { GameplayMapEffectPrepareDef, GameplayMapEffectStatementDef } from '../../src/data-services/contracts/gameplay-map-effects';
import { normalizeMapActionEffects } from '../../src/data-services/normalization/gameplay-map-effect-program';
import { MapEffectPlanError, planMapEffectSource } from '../../src/arona-clicker/services/map-effect-planner';
import type { MapEffectPlannerOptions, MapEffectSourceInput, MapEffectVisit } from '../../src/arona-clicker/contracts/map-effects';

const party = { kind: 'partyCharacter' as const, id: 'p1' };
const enemy = { kind: 'enemy' as const, id: 'e1' };
const baseInput = (): MapEffectSourceInput => ({
  sourceKey: 'run/map/node/round/source/action',
  actionId: 'action',
  source: party,
  primary: enemy,
  sourceTeam: { kind: 'team' as const, side: 'party' as const },
  hp: { 'partyCharacter:p1': { current: 4, cap: 10 }, 'enemy:e1': { current: 5, cap: 10 } },
  locals: { counters: { trust: { value: 2, min: 0, max: 3 } }, flags: { ready: false } },
});

function program(resolve: readonly GameplayMapEffectStatementDef[], prepare?: readonly GameplayMapEffectPrepareDef[]) {
  const action = {
    id: 'action', name: 'Test', eligibleCharacterIds: [], target: { kind: 'none' },
    effectProgram: { ...(prepare === undefined ? {} : { prepare }), resolve },
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

describe('single-source pure effect planning', () => {
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

  it('reuses the same leaf planner for legacy HP/resource phase slices without replay or metering', () => {
    const oldAction = {
      id: 'action', name: 'Legacy', eligibleCharacterIds: [], target: { kind: 'none' },
      hpEffects: [{ amount: -2 }], effects: [{ scope: 'team', resourceId: 'ammo', amount: 1 }],
      cardEffects: [{ kind: 'scostDiscount', amount: 2 }],
    } as unknown as GameplayMapActionDef;
    const effects = normalizeMapActionEffects(oldAction);
    const visit = () => { throw new Error('legacy effects are unmetered'); };
    const hpSlice = effects.resolve.filter(instruction => instruction.op === 'hpChange');
    const resourceSlice = effects.resolve.filter(instruction => instruction.op === 'resourceChange');
    const hpPlan = planMapEffectSource({ input: baseInput(), effects, instructions: hpSlice, visit });
    expect(hpPlan.hp['enemy:e1']?.current).toBe(3);
    expect(hpPlan.resourceLedger).toEqual([]);
    expect(hpPlan.prepareDiscounts).toMatchObject([{ op: 'discountSCost', amount: 2 }]);

    const resourcePlan = planMapEffectSource({
      input: { ...baseInput(), hp: hpPlan.hp, locals: hpPlan.locals }, effects, instructions: resourceSlice, visit,
    });
    expect(resourcePlan.hp['enemy:e1']?.current).toBe(3);
    expect(resourcePlan.resourceLedger).toMatchObject([{ resourceId: 'ammo', delta: 1, identity: { kind: 'team', side: 'party' } }]);
    expect(resourcePlan.trace.every(entry => entry.op === 'resourceChange')).toBe(true);
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
});
