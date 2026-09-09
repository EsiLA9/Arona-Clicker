import { describe, expect, test } from 'vitest';
import { AffectorEngine } from '../../src/engine/effect/affector-engine';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { EventBus } from '../../src/engine/core/event-bus';
import { Registry } from '../../src/data-services/registry/registry';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';
import type { PlayerState } from '../../src/arona-clicker/types/state';

function emptyState(): PlayerState {
  return {
    resources: {},
    spotLevels: {},
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: '',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: {},
    unlockedInits: [],
  };
}

describe('AffectorEngine', () => {
  test('runtime change coalesces entry and state events for one recheck', () => {
    const bus = new EventBus();
    const state = emptyState();
    const engine = new AffectorEngine(new Registry(), new ConditionSystem(), new StateMutationService(bus), bus);
    engine.load([{ id: 'pack', entries: [{ id: 'entry', effects: [] }] }]);
    engine.setState(state);
    const runtimeChanges: string[] = [];
    bus.on('affectorRuntimeChanged', event => runtimeChanges.push(...event.instanceIds));
    const instance = engine.mount('pack', 'spot');
    expect(runtimeChanges).toEqual([instance!.instanceId]);
    engine.unmount(instance!.instanceId);
    expect(runtimeChanges).toEqual([instance!.instanceId, instance!.instanceId]);
  });

  test('transitions from latent to active when condition is met', () => {
    const state = emptyState();
    const engine = new AffectorEngine(
      new Registry(),
      new ConditionSystem(),
      new StateMutationService(new EventBus()),
    );
    engine.load([{
      id: 'pack_test',
      entries: [{
        id: 'entry_credit',
        condition: { type: 'AND', conditions: [{ target: 'resource', key: 'credit', comparator: '>=', value: 10 }] },
        effects: [{ op: 'addResource', target: 'credit', value: 1 }],
      }],
    }]);
    engine.setState(state);

    const instance = engine.mount('pack_test', 'spot_test')!;
    expect(instance.state).toBe('Latent');

    state.resources.credit = 10;
    engine.recheck(instance.instanceId);
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Active');
  });

  test('addResource grants once on Latent→Active edge, not while staying active', () => {
    const state = emptyState();
    const engine = new AffectorEngine(
      new Registry(),
      new ConditionSystem(),
      new StateMutationService(new EventBus()),
    );
    engine.load([{
      id: 'pack_test',
      entries: [{
        id: 'entry_credit',
        condition: { type: 'AND', conditions: [{ target: 'resource', key: 'credit', comparator: '>=', value: 10 }] },
        effects: [{ op: 'addResource', target: 'credit', value: 1 }],
      }],
    }]);
    engine.setState(state);
    const instance = engine.mount('pack_test', 'spot_test')!;
    expect(instance.state).toBe('Latent');
    expect(state.resources.credit).toBeUndefined();

    // 条件满足 → Active → 立即一次性发放
    state.resources.credit = 10;
    engine.recheck(instance.instanceId);
    expect(state.resources.credit).toBe(11);

    // 保持 Active：重复 recheck 不重复发放
    engine.recheck(instance.instanceId);
    engine.applyActiveEffects();
    expect(state.resources.credit).toBe(11);

    // Latent 期间不发放；再次翻转回 Active 再次发放（edge-triggered）
    state.resources.credit = 0;
    engine.recheck(instance.instanceId);
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Latent');
    expect(state.resources.credit).toBe(0);
    state.resources.credit = 10;
    engine.recheck(instance.instanceId);
    expect(state.resources.credit).toBe(11);
  });

  test('mount 即满足条件时立即发放；挂载后才有 state 才生效', () => {
    const state = emptyState();
    state.resources.credit = 100;
    const engine = new AffectorEngine(
      new Registry(),
      new ConditionSystem(),
      new StateMutationService(new EventBus()),
    );
    engine.load([{
      id: 'pack_test',
      entries: [{
        id: 'entry_credit',
        condition: { type: 'AND', conditions: [{ target: 'resource', key: 'credit', comparator: '>=', value: 10 }] },
        effects: [{ op: 'addResource', target: 'credit', value: 1 }],
      }],
    }]);
    engine.setState(state);
    const instance = engine.mount('pack_test', 'spot_test')!;
    expect(instance.state).toBe('Active');
    expect(state.resources.credit).toBe(101);
  });

  test('removed instances never reactivate', () => {
    const engine = new AffectorEngine(
      new Registry(),
      new ConditionSystem(),
      new StateMutationService(new EventBus()),
    );
    engine.load([{ id: 'pack_test', entries: [{ id: 'always', effects: [] }] }]);
    engine.setState(emptyState());
    const instance = engine.mount('pack_test', 'item_test')!;

    expect(engine.unmount(instance.instanceId)).toBe(true);
    engine.recheck(instance.instanceId);
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Removed');
  });
});
