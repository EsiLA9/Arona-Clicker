import { describe, expect, test } from 'vitest';
import { EffectEngine } from '../../src/engine/effect/effect-engine';
import { EventBus } from '../../src/engine/core/event-bus';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import { ValueSystem } from '../../src/engine/expression/value-system';
import { Expr, value } from '../../src/engine/types';
import type { EffectReceipt } from '../../src/engine/contracts/effect-receipt';
import type { CharacterVariantDef } from '../../src/data-services/contracts/character-variant';
import { Character } from '../../src/arona-clicker/types/ids';

describe('committed Effect receipts', () => {
  test('keeps batch-wide expression evaluation and records each target before observers run', () => {
    const bus = new EventBus();
    const mutations = new StateMutationService(bus);
    const engine = new EffectEngine(mutations, new ValueSystem());
    const state = createDefaultState();
    state.resources.credit = 10;
    engine.setState(state);
    const collected: EffectReceipt[] = [];
    bus.on('resourceChanged', () => {
      expect(collected[0]).toMatchObject({ before: 10, after: 15, delta: 5 });
      // Synchronous observers cannot contaminate the already detached receipt.
      state.resources.credit = 999;
    });
    const receipts = engine.applyEffectsWithReceipts([
      { op: 'addResource', target: 'credit', value: 5 },
      { op: 'addItem', target: 'ticket', value: Expr.val(value('res', { resource: 'credit' })) },
    ], receipt => collected.push(receipt));
    expect(receipts).toEqual([
      { effectIndex: 0, op: 'addResource', target: 'credit', status: 'changed', before: 10, after: 15, delta: 5 },
      { effectIndex: 1, op: 'addItem', target: 'ticket', status: 'changed', before: 0, after: 10, delta: 10 },
    ]);
    expect(state.inventory.ticket).toBe(10);
  });

  test('preserves the committed prefix when a synchronous notification throws', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = createDefaultState();
    engine.setState(state);
    bus.on('resourceChanged', () => { throw new Error('observer failed'); });
    let failure: unknown;
    try {
      engine.applyEffectsWithReceipts([
        { op: 'addResource', target: 'credit', value: -3 },
        { op: 'addItem', target: 'ticket', value: 5 },
      ]);
    } catch (error) { failure = error; }
    expect(failure).toMatchObject({ message: 'observer failed', receipts: [
      { effectIndex: 0, op: 'addResource', target: 'credit', status: 'changed', before: 0, after: -3, delta: -3 },
    ] });
    expect(state.resources.credit).toBe(-3);
    expect(state.inventory.ticket).toBeUndefined();
  });

  test('records duplicate unlocks and denied spot writes as noops without phantom gains', () => {
    const mutations = new StateMutationService(new EventBus());
    const engine = new EffectEngine(mutations);
    const state = createDefaultState();
    state.unlockedEnhancements = ['enh:test'];
    engine.setState(state);
    mutations.setInitScopedTargetGuard(() => false);
    expect(engine.applyEffectsWithReceipts([
      { op: 'addEnhancement', target: '', value: 'enh:test' },
      { op: 'addSpotLevel', target: 'spot:test', value: 5 },
    ])).toEqual([
      { effectIndex: 0, op: 'addEnhancement', target: 'enh:test', status: 'noop', before: true, after: true },
      { effectIndex: 1, op: 'addSpotLevel', target: 'spot:test', status: 'noop', before: 0, after: 0, delta: 0 },
    ]);
  });

  test('fixes duplicate character and shard results before the acquired notification can throw', () => {
    const bus = new EventBus();
    const mutations = new StateMutationService(bus);
    const engine = new EffectEngine(mutations);
    const state = createDefaultState();
    const variant = { id: 'variant:test', proto: Character.Shiroko } as CharacterVariantDef;
    mutations.setCharacterCatalog({ getVariant: id => id === variant.id ? variant : undefined,
      getCurve: () => undefined, getColorGroup: () => undefined, getColorEquipment: () => undefined,
      getAffectionConfig: () => undefined, getGear: () => undefined, getGearConfig: () => undefined });
    engine.setState(state);
    engine.applyEffectsWithReceipts([{ op: 'grantCharacter', target: variant.id, value: 0 }]);
    const collected: EffectReceipt[] = [];
    bus.on('characterAcquired', () => {
      expect(collected[0]).toMatchObject({ after: { acquiredCount: 2, fragments: 1 }, details: { duplicate: true, shards: 1 } });
      throw new Error('acquired observer failed');
    });
    expect(() => engine.applyEffectsWithReceipts([{ op: 'grantCharacter', target: variant.id, value: 0 }], receipt => collected.push(receipt))).toThrow('acquired observer failed');
    expect(collected).toEqual([{ effectIndex: 0, op: 'grantCharacter', target: variant.id, status: 'changed',
      before: { owned: true, acquiredCount: 1, fragments: 0 }, after: { owned: true, acquiredCount: 2, fragments: 1 }, details: { duplicate: true, shards: 1 } }]);
    expect(state.fragments?.[variant.id]).toBe(1);
  });
});
