import { describe, expect, test } from 'vitest';
import { AffectorEngine } from './affector-engine';
import { ConditionSystem } from './condition-system';
import { EventBus } from './event-bus';
import { Registry } from './registry';
import { StateMutationService } from './state-mutation-service';
import { PlayerState } from './types';

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
