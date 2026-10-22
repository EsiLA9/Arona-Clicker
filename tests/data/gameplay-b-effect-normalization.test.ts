import { describe, expect, test } from 'vitest';
import type { GameplayMapActionDef } from '../../src/data-services/contracts/gameplay-map';
import { normalizeMapActionEffects, GameplayMapEffectNormalizationError } from '../../src/data-services/normalization/gameplay-map-effect-program';

const action = (overrides: Partial<GameplayMapActionDef> = {}): GameplayMapActionDef => ({
  id: 'test-action', name: 'Test Action', eligibleCharacterIds: [], target: { kind: 'enemy' }, ...overrides,
});

describe('gameplay-map effect normalization', () => {
  test('OLD hp/resource/card arrays become common leaves with stable paths and source-specific phase labels', () => {
    const normalized = normalizeMapActionEffects(action({
      hpEffects: [{ amount: -3 }],
      effects: [
        { scope: 'actor', resourceId: 'ammo', amount: 2 },
        { scope: 'actor', recipient: 'target', resourceId: 'ammo', amount: -1 },
        { scope: 'team', resourceId: 'supplies', amount: 1 },
      ],
      cardEffects: [{ kind: 'scostDiscount', amount: 2 }],
    }), 'nodes[0].encounter.actions[1]');

    expect(normalized).toMatchObject({ mode: 'legacy', budget: 'legacy-unmetered' });
    expect(normalized.prepare).toEqual([{
      op: 'discountSCost', amount: 2, originPath: 'nodes[0].encounter.actions[1].cardEffects[0]', mode: 'legacy',
    }]);
    expect(normalized.resolve).toEqual([
      {
        op: 'hpChange', target: 'primary', delta: -3,
        originPath: 'nodes[0].encounter.actions[1].hpEffects[0]', mode: 'legacy',
        legacyPhase: {
          partyAction: 'party-action-hp-before-resource-settlement',
          actorlessSource: 'actorless-hp-after-resource-settlement',
          enemySource: 'enemy-hp-after-own-resource',
        },
      },
      {
        op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 2,
        originPath: 'nodes[0].encounter.actions[1].effects[0]', mode: 'legacy',
        legacyPhase: {
          partyAction: 'resource-settlement-after-party-action-hp',
          actorlessSource: 'resource-settlement-before-actorless-hp',
          enemySource: 'enemy-resource-before-own-hp',
        },
      },
      {
        op: 'resourceChange', account: 'primaryActor', resourceId: 'ammo', delta: -1,
        originPath: 'nodes[0].encounter.actions[1].effects[1]', mode: 'legacy',
        legacyPhase: {
          partyAction: 'resource-settlement-after-party-action-hp',
          actorlessSource: 'resource-settlement-before-actorless-hp',
          enemySource: 'enemy-resource-before-own-hp',
        },
      },
      {
        op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1,
        originPath: 'nodes[0].encounter.actions[1].effects[2]', mode: 'legacy',
        legacyPhase: {
          partyAction: 'resource-settlement-after-party-action-hp',
          actorlessSource: 'resource-settlement-before-actorless-hp',
          enemySource: 'enemy-resource-before-own-hp',
        },
      },
    ]);
  });

  test('program retains ordered prepare, empty resolve, and when/else structure with path metadata', () => {
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

    expect(normalized.mode).toBe('program');
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
    expect(normalizeMapActionEffects(action({ effectProgram: {} })).resolve).toEqual([]);
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
    expect(statement.condition.mode).toBe('program');
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
    expect(negated.condition.conditions.every(condition => condition.mode === 'program')).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });

  test('legacy arrays with more than 64 total leaves remain unmetered and normalizable', () => {
    const normalized = normalizeMapActionEffects(action({
      hpEffects: Array.from({ length: 22 }, () => ({ amount: -1 })),
      effects: Array.from({ length: 22 }, () => ({ scope: 'team' as const, resourceId: 'supplies', amount: 1 })),
      cardEffects: Array.from({ length: 22 }, () => ({ kind: 'scostDiscount' as const, amount: 1 })),
    }));

    expect(normalized).toMatchObject({ mode: 'legacy', budget: 'legacy-unmetered' });
    expect(normalized.resolve).toHaveLength(44);
    expect(normalized.prepare).toHaveLength(22);
    expect(normalized.resolve.length + normalized.prepare.length).toBeGreaterThan(64);
  });

  test('legacy empty arrays still conflict with a program and unknown fields are rejected', () => {
    expect(() => normalizeMapActionEffects(action({ effectProgram: {}, hpEffects: [] })))
      .toThrow(GameplayMapEffectNormalizationError);
    expect(() => normalizeMapActionEffects(action({ hpEffects: [{ amount: -1, hidden: true } as { amount: number }] })))
      .toThrow(/unknown field/);
    expect(() => normalizeMapActionEffects(action({ effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: 1, hidden: true }] } as unknown as GameplayMapActionDef['effectProgram'] })))
      .toThrow(/Unknown field/);
    expect(() => normalizeMapActionEffects({ ...action(), hiddenEffect: [] } as unknown as GameplayMapActionDef))
      .toThrow(/hiddenEffect: unknown field/);
    expect(() => normalizeMapActionEffects({ ...action(), hpChange: { target: 'primary', delta: 1 } } as unknown as GameplayMapActionDef))
      .toThrow(/hpChange: unknown field/);
  });

  test('legacy Team, source Actor, and target Actor accounts retain Enemy and Actorless phase labels', () => {
    const normalized = normalizeMapActionEffects(action({
      effects: [
        { scope: 'team', resourceId: 'supplies', amount: 1 },
        { scope: 'actor', recipient: 'actor', resourceId: 'ammo', amount: -1 },
        { scope: 'actor', recipient: 'target', resourceId: 'ammo', amount: 1 },
      ],
    }));

    expect(normalized.resolve.map(effect => effect.op === 'resourceChange' ? effect.account : null)).toEqual([
      'sourceTeam', 'sourceActor', 'primaryActor',
    ]);
    expect(normalized.resolve.map(effect => effect.legacyPhase?.actorlessSource)).toEqual([
      'resource-settlement-before-actorless-hp',
      'resource-settlement-before-actorless-hp',
      'resource-settlement-before-actorless-hp',
    ]);
    expect(normalized.resolve.map(effect => effect.legacyPhase?.enemySource)).toEqual([
      'enemy-resource-before-own-hp',
      'enemy-resource-before-own-hp',
      'enemy-resource-before-own-hp',
    ]);
  });
});
