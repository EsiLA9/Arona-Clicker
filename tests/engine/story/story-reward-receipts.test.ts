import { describe, expect, test, vi } from 'vitest';
import { applyCompletionReward, type StoryRewardsContext } from '../../../src/arona-clicker/services/story/story-rewards';
import { Registry } from '../../../src/data-services/registry/registry';
import type { ActiveStoryEntry } from '../../../src/data-services/contracts/story-entry';
import { EventBus } from '../../../src/engine/core/event-bus';
import { EffectEngine } from '../../../src/engine/effect/effect-engine';
import { StateMutationService } from '../../../src/arona-clicker/state/state-mutation-service';
import { ConditionSystem } from '../../../src/engine/expression/condition-system';
import { createDefaultState } from '../../../src/arona-clicker/state/state-factory';

const entry: ActiveStoryEntry = { id: 'entry:test', storyId: 'story:test', availableInits: [],
  triggerCondition: { type: 'AND', conditions: [] }, completionReward: { first: [
    { op: 'addResource', target: 'credit', value: 5 }, { op: 'addItem', target: 'ticket', value: 2 },
  ] }, activation: { kind: 'active' as const } };

function setup() {
  const state = createDefaultState();
  const bus = new EventBus();
  const engine = new EffectEngine(new StateMutationService(bus));
  engine.setState(state);
  const context: StoryRewardsContext = { registry: new Registry(), effectEngine: engine, conditionSystem: new ConditionSystem(),
    getState: () => state, hasCompletedStory: () => false, mutations: { setPassiveCooldowns: () => {}, setStudentBlock: () => {} } };
  return { state, bus, engine, context };
}

describe('completion reward committed receipts', () => {
  test('returns actual results for finishing notifications', () => {
    const h = setup();
    expect(applyCompletionReward(h.context, entry, entry.storyId)).toMatchObject({ source: 'first', receipts: [
      { op: 'addResource', target: 'credit', status: 'changed', delta: 5 },
      { op: 'addItem', target: 'ticket', status: 'changed', delta: 2 },
    ] });
  });

  test('mixed default and matched conditional rewards report conditional source', () => {
    const h = setup();
    const conditionalEntry: ActiveStoryEntry = { ...entry, completionStrategy: 'conditional', conditionalRewards: [
      { condition: { type: 'AND', conditions: [] }, effects: [{ op: 'addItem', target: 'bonus-ticket', value: 1 }] },
    ] };
    expect(applyCompletionReward(h.context, conditionalEntry, entry.storyId)).toMatchObject({
      source: 'conditional',
      effects: [...entry.completionReward!.first!, ...conditionalEntry.conditionalRewards![0].effects],
    });
  });

  test('carries a committed reward prefix on notification failure and never retries the legacy API', () => {
    const h = setup();
    const legacy = vi.spyOn(h.engine, 'applyEffects');
    h.bus.on('resourceChanged', () => { throw new Error('reward observer failed'); });
    let failure: unknown;
    try { applyCompletionReward(h.context, entry, entry.storyId); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ message: 'reward observer failed', rewardSettlement: { source: 'first', receipts: [
      { op: 'addResource', target: 'credit', delta: 5 },
    ] } });
    expect(legacy).not.toHaveBeenCalled();
    expect(h.state.resources.credit).toBe(5);
    expect(h.state.inventory.ticket).toBeUndefined();
  });

  test('legacy reward ports retain their original single application and return empty receipts', () => {
    const h = setup();
    const applyEffects = vi.fn();
    expect(applyCompletionReward({ ...h.context, effectEngine: { applyEffects } }, entry, entry.storyId)).toEqual({
      source: 'first', effects: entry.completionReward!.first, receipts: [],
    });
    expect(applyEffects).toHaveBeenCalledTimes(1);
  });
});
