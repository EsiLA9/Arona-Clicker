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

  test('legacy empty arrays still conflict with a program and unknown fields are rejected', () => {
    expect(() => normalizeMapActionEffects(action({ effectProgram: {}, hpEffects: [] })))
      .toThrow(GameplayMapEffectNormalizationError);
    expect(() => normalizeMapActionEffects(action({ hpEffects: [{ amount: -1, hidden: true } as { amount: number }] })))
      .toThrow(/unknown field/);
    expect(() => normalizeMapActionEffects(action({ effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: 1, hidden: true }] } as GameplayMapActionDef['effectProgram'] })))
      .toThrow(/Unknown field/);
  });
});
