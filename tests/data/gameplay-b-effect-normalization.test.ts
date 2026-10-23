import { describe, expect, test } from 'vitest';
import type { GameplayMapActionDef } from '../../src/data-services/contracts/gameplay-map';
import { normalizeMapActionEffects, GameplayMapEffectNormalizationError } from '../../src/data-services/normalization/gameplay-map-effect-program';

const action = (overrides: Partial<GameplayMapActionDef> = {}): GameplayMapActionDef => ({
  id: 'test-action', name: 'Test Action', eligibleCharacterIds: [], target: { kind: 'enemy' }, ...overrides,
});

describe('gameplay-map effect normalization', () => {
  test('an Action without effectProgram normalizes to an empty Program', () => {
    expect(normalizeMapActionEffects(action())).toEqual({
      budget: 'program-4096', prepare: [], resolve: [],
    });
    expect(normalizeMapActionEffects(action({ effectProgram: {} }))).toEqual({
      budget: 'program-4096', prepare: [], resolve: [],
    });
  });

  test('normalizes ordered healApplied triggers with stable Program origin metadata', () => {
    const normalized = normalizeMapActionEffects(action({ effectProgram: {
      resolve: [{ op: 'heal', target: 'primary', amount: 2 }],
      triggers: [
        { id: 'heal-reward', event: 'healApplied', minimumActualAmount: 2, effect: {
          op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1,
        } },
        { id: 'damage-reward', event: 'damageApplied', effect: {
          op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1,
        } },
      ],
    } }), 'actions.healer');
    expect(normalized.triggers).toEqual([
      {
        id: 'heal-reward', event: 'healApplied', minimumActualAmount: 2,
        originPath: 'actions.healer.effectProgram.triggers[0]', mode: 'program',
        effect: {
          op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1,
          originPath: 'actions.healer.effectProgram.triggers[0].effect', mode: 'program',
        },
      },
      {
        id: 'damage-reward', event: 'damageApplied',
        originPath: 'actions.healer.effectProgram.triggers[1]', mode: 'program',
        effect: {
          op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1,
          originPath: 'actions.healer.effectProgram.triggers[1].effect', mode: 'program',
        },
      },
    ]);
  });

  test('accepts additionalTarget on an Action and leaves its Program normalization unchanged', () => {
    const withAdditionalTarget = action({
      agility: { base: 1, max: 8 },
      additionalTarget: 'partyCharacter',
      effectProgram: { resolve: [{ op: 'flagSet', flagId: 'ready', value: true }] },
    });
    const withoutAdditionalTarget = action({
      effectProgram: { resolve: [{ op: 'flagSet', flagId: 'ready', value: true }] },
    });
    expect(normalizeMapActionEffects(withAdditionalTarget)).toEqual(normalizeMapActionEffects(withoutAdditionalTarget));
  });

  test('Program retains ordered prepare, empty resolve, and when/else structure with path metadata', () => {
    const normalized = normalizeMapActionEffects(action({
      effectProgram: {
        prepare: [{ op: 'discountSCost', amount: 1 }],
        resolve: [{
          op: 'when', condition: { kind: 'flag', flagId: 'ready', value: true },
          then: [{ op: 'counterAdd', counterId: 'uses', delta: 1 }],
          else: [{ op: 'flagSet', flagId: 'ready', value: false }],
        }],
      },
    }), 'actions.test-action');

    expect(normalized.budget).toBe('program-4096');
    expect(normalized.prepare[0]).toMatchObject({
      op: 'discountSCost', originPath: 'actions.test-action.effectProgram.prepare[0]', mode: 'program',
    });
    expect(normalized.resolve).toEqual([{
      op: 'when',
      originPath: 'actions.test-action.effectProgram.resolve[0]',
      mode: 'program',
      condition: {
        kind: 'flag', flagId: 'ready', value: true,
        originPath: 'actions.test-action.effectProgram.resolve[0].condition', mode: 'program',
      },
      then: [{
        op: 'counterAdd', counterId: 'uses', delta: 1,
        originPath: 'actions.test-action.effectProgram.resolve[0].then[0]', mode: 'program',
      }],
      else: [{
        op: 'flagSet', flagId: 'ready', value: false,
        originPath: 'actions.test-action.effectProgram.resolve[0].else[0]', mode: 'program',
      }],
    }]);
  });

  test('nested all/not conditions keep typed path metadata and normalization leaves input untouched', () => {
    const input = action({
      effectProgram: {
        resolve: [{
          op: 'when',
          condition: {
            kind: 'all',
            conditions: [{
              kind: 'not',
              condition: {
                kind: 'all',
                conditions: [
                  { kind: 'flag', flagId: 'ready', value: true },
                  { kind: 'counter', counterId: 'uses', comparison: 'gte', value: 1 },
                ],
              },
            }],
          },
          then: [{ op: 'flagSet', flagId: 'ready', value: true }],
        }],
      },
    });
    const before = JSON.stringify(input);
    const normalized = normalizeMapActionEffects(input, 'actions.nested');
    const statement = normalized.resolve[0];

    expect(statement?.op).toBe('when');
    if (!statement || statement.op !== 'when') throw new Error('Expected when statement');
    expect(statement.condition.originPath).toBe('actions.nested.effectProgram.resolve[0].condition');
    if (statement.condition.kind !== 'all') throw new Error('Expected root all condition');
    const negated = statement.condition.conditions[0];
    if (!negated || negated.kind !== 'not') throw new Error('Expected nested not condition');
    expect(negated.originPath).toBe('actions.nested.effectProgram.resolve[0].condition.conditions[0]');
    expect(negated.condition.originPath).toBe('actions.nested.effectProgram.resolve[0].condition.conditions[0].condition');
    if (negated.condition.kind !== 'all') throw new Error('Expected nested all condition');
    expect(negated.condition.conditions.map(condition => condition.originPath)).toEqual([
      'actions.nested.effectProgram.resolve[0].condition.conditions[0].condition.conditions[0]',
      'actions.nested.effectProgram.resolve[0].condition.conditions[0].condition.conditions[1]',
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });

  test('Program statements retain order through the 64-node syntax limit', () => {
    const normalized = normalizeMapActionEffects(action({
      effectProgram: { resolve: Array.from({ length: 64 }, () => ({ op: 'hpChange' as const, target: 'primary' as const, delta: -1 })) },
    }));
    expect(normalized.resolve).toHaveLength(64);
    expect(normalized.resolve.every(instruction => instruction.mode === 'program')).toBe(true);
    expect(() => normalizeMapActionEffects(action({
      effectProgram: { resolve: Array.from({ length: 65 }, () => ({ op: 'hpChange' as const, target: 'primary' as const, delta: -1 })) },
    }))).toThrow(/limit/i);
  });

  test('E2 selector, Value tree, and bounded repeat remain detached under a stable instruction path', () => {
    const input = action({ effectProgram: { resolve: [{
      op: 'damage',
      target: { set: { side: 'enemy', filter: 'living', order: 'hpRatioAscending', limit: 3 } },
      amount: { kind: 'max', left: { kind: 'literal', value: 1 }, right: { kind: 'missingHp', unit: 'target' } },
      repeat: { kind: 'min', left: { kind: 'counter', counterId: 'power' }, right: { kind: 'literal', value: 8 } },
    }] } });
    const before = JSON.stringify(input);
    const normalized = normalizeMapActionEffects(input, 'actions.area');
    expect(normalized.resolve[0]).toMatchObject({
      op: 'damage', originPath: 'actions.area.effectProgram.resolve[0]',
      target: { set: { side: 'enemy', order: 'hpRatioAscending', limit: 3 } },
      amount: { kind: 'max', right: { kind: 'missingHp', unit: 'target' } },
      repeat: { kind: 'min', left: { kind: 'counter', counterId: 'power' } },
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  test('preserves additional and loopTarget resource writer accounts with nested path metadata', () => {
    const input = action({ effectProgram: { resolve: [
      { op: 'resourceChange', account: 'additionalActor', resourceId: 'focus', delta: 1 },
      { op: 'forTargets', targetSet: { side: 'party' }, body: [
        { op: 'resourceChange', account: 'loopTargetActor', resourceId: 'focus', delta: -1 },
      ] },
    ] } });
    const before = JSON.stringify(input);
    const normalized = normalizeMapActionEffects(input, 'actions.writers');
    expect(normalized.resolve[0]).toMatchObject({
      op: 'resourceChange', account: 'additionalActor', originPath: 'actions.writers.effectProgram.resolve[0]',
    });
    expect(normalized.resolve[1]).toMatchObject({
      op: 'forTargets', body: [{
        op: 'resourceChange', account: 'loopTargetActor', originPath: 'actions.writers.effectProgram.resolve[1].body[0]',
      }],
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  test('statusApply retains its static definition reference and source path', () => {
    expect(normalizeMapActionEffects(action({ effectProgram: { resolve: [{
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 3,
    }] } }), 'actions.apply-burn').resolve).toEqual([{
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 3,
      originPath: 'actions.apply-burn.effectProgram.resolve[0]', mode: 'program',
    }]);
  });

  test('statusRemove retains its Map-local reference and source path', () => {
    expect(normalizeMapActionEffects(action({ effectProgram: { resolve: [{
      op: 'statusRemove', target: 'primary', statusId: 'burn',
    }] } }), 'actions.remove-burn').resolve).toEqual([{
      op: 'statusRemove', target: 'primary', statusId: 'burn',
      originPath: 'actions.remove-burn.effectProgram.resolve[0]', mode: 'program',
    }]);
  });

  test('cardEffectModifier retains its closed fields and statement order', () => {
    const normalized = normalizeMapActionEffects(action({ effectProgram: { resolve: [
      { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: -2 },
      { op: 'hpChange', target: 'primary', delta: 1 },
      { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 3 },
    ] } }), 'actions.card-modifier');
    expect(normalized.resolve).toEqual([
      { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: -2,
        originPath: 'actions.card-modifier.effectProgram.resolve[0]', mode: 'program' },
      { op: 'hpChange', target: 'primary', delta: 1,
        originPath: 'actions.card-modifier.effectProgram.resolve[1]', mode: 'program' },
      { op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 3,
        originPath: 'actions.card-modifier.effectProgram.resolve[2]', mode: 'program' },
    ]);
  });

  test('normalizes nested forTargets bodies and MapRun Fact leaves with complete source paths', () => {
    const input = action({ effectProgram: { resolve: [
      {
        op: 'forTargets', targetSet: { side: 'enemy', order: 'random', limit: 2 }, body: [
          { op: 'when', condition: { kind: 'all', conditions: [
            { kind: 'hpAtLeast', target: 'loopTarget', value: 1 },
            { kind: 'mapRunFlag', flagId: 'open', value: false },
          ] }, then: [
            { op: 'mapRunFlagSet', flagId: 'open', value: true },
          ], else: [
            { op: 'hpChange', target: 'loopTarget', delta: -1 },
          ] },
          { op: 'forTargets', targetSet: { side: 'party', order: 'definition' }, body: [
            { op: 'mapRunCounterAdd', counterId: 'steps', delta: 1 },
          ] },
        ],
      },
      { op: 'mapRunCounterAdd', counterId: 'steps', delta: 1 },
      { op: 'mapRunFlagSet', flagId: 'open', value: true },
    ] } });
    const before = JSON.stringify(input);
    const normalized = normalizeMapActionEffects(input, 'actions.loop');

    const outer = normalized.resolve[0];
    expect(outer).toMatchObject({
      op: 'forTargets',
      originPath: 'actions.loop.effectProgram.resolve[0]', mode: 'program',
      targetSet: { side: 'enemy', order: 'random', limit: 2 },
    });
    if (!outer || outer.op !== 'forTargets') throw new Error('Expected outer forTargets');
    const outerWhen = outer.body[0];
    expect(outerWhen).toMatchObject({
      op: 'when', originPath: 'actions.loop.effectProgram.resolve[0].body[0]', mode: 'program',
      condition: { kind: 'all', originPath: 'actions.loop.effectProgram.resolve[0].body[0].condition', mode: 'program' },
    });
    if (!outerWhen || outerWhen.op !== 'when') throw new Error('Expected outer when');
    expect(outerWhen.condition).toMatchObject({
      conditions: [
        { kind: 'hpAtLeast', target: 'loopTarget', originPath: 'actions.loop.effectProgram.resolve[0].body[0].condition.conditions[0]', mode: 'program' },
        { kind: 'mapRunFlag', flagId: 'open', originPath: 'actions.loop.effectProgram.resolve[0].body[0].condition.conditions[1]', mode: 'program' },
      ],
    });
    expect(outerWhen.then[0]).toMatchObject({
      op: 'mapRunFlagSet', originPath: 'actions.loop.effectProgram.resolve[0].body[0].then[0]', mode: 'program',
    });
    expect(outerWhen.else?.[0]).toMatchObject({
      op: 'hpChange', target: 'loopTarget', originPath: 'actions.loop.effectProgram.resolve[0].body[0].else[0]', mode: 'program',
    });
    const inner = outer.body[1];
    expect(inner).toMatchObject({
      op: 'forTargets', originPath: 'actions.loop.effectProgram.resolve[0].body[1]', mode: 'program',
    });
    if (!inner || inner.op !== 'forTargets') throw new Error('Expected nested forTargets');
    expect(inner.body[0]).toMatchObject({
      op: 'mapRunCounterAdd', originPath: 'actions.loop.effectProgram.resolve[0].body[1].body[0]', mode: 'program',
    });
    expect(normalized.resolve[1]).toMatchObject({
      op: 'mapRunCounterAdd', originPath: 'actions.loop.effectProgram.resolve[1]', mode: 'program',
    });
    expect(normalized.resolve[2]).toMatchObject({
      op: 'mapRunFlagSet', originPath: 'actions.loop.effectProgram.resolve[2]', mode: 'program',
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  test('old Action arrays are rejected as unknown fields', () => {
    for (const field of ['effects', 'hpEffects', 'cardEffects']) {
      expect(() => normalizeMapActionEffects({ ...action(), [field]: [] } as unknown as GameplayMapActionDef))
        .toThrow(new RegExp(`${field}: unknown field`));
    }
    expect(() => normalizeMapActionEffects(action({
      effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: 1, hidden: true }] as never },
    }))).toThrow(/Unknown field/);
    expect(() => normalizeMapActionEffects({ ...action(), hiddenEffect: [] } as unknown as GameplayMapActionDef))
      .toThrow(/hiddenEffect: unknown field/);
    expect(() => normalizeMapActionEffects({ ...action(), hpChange: { target: 'primary', delta: 1 } } as unknown as GameplayMapActionDef))
      .toThrow(/hpChange: unknown field/);
  });
});
