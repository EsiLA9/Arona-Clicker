import { describe, expect, test } from 'vitest';
import { EventBus } from './event-bus';
import { StateMutationService } from './state-mutation-service';
import { Character, PlayerState } from './types';

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

describe('StateMutationService', () => {
  test('mutates state and emits one resource event', () => {
    const bus = new EventBus();
    const service = new StateMutationService(bus);
    const state = emptyState();
    const events: unknown[] = [];
    bus.on('resourceChanged', event => events.push(event));
    service.setState(state);

    service.changeResource('credit', 25);

    expect(state.resources.credit).toBe(25);
    expect(events).toHaveLength(1);
  });

  test('rejects removing more items than owned', () => {
    const service = new StateMutationService(new EventBus());
    const state = emptyState();
    state.inventory.ticket = 1;
    service.setState(state);

    expect(service.removeItem('ticket', 2)).toBe(false);
    expect(state.inventory.ticket).toBe(1);
  });

  test('applies effect lists through the same mutation entry point', () => {
    const service = new StateMutationService(new EventBus());
    const state = emptyState();
    service.setState(state);

    service.applyEffects([
      { op: 'addResource', target: 'credit', value: 10 },
      { op: 'setManager', target: 'spot_a', value: Character.Arona },
    ]);

    expect(state.resources.credit).toBe(10);
    expect(state.spotManagers.spot_a).toBe(Character.Arona);
  });
});
