import { describe, expect, test } from 'vitest';
import { EventBus } from '../../src/engine/core/event-bus';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import type { RevealedInformationTarget } from '../../src/arona-clicker/types/state';

describe('Information Reveal Progress', () => {
  test('starts empty and survives PlayerState JSON serialization', () => {
    const state = createDefaultState();

    expect(state.informationRevealProgress).toEqual({ revealed: [] });
    expect(JSON.parse(JSON.stringify(state)).informationRevealProgress).toEqual({ revealed: [] });
  });

  test('commits only declared targets and treats an existing key as a no-op', () => {
    const state = createDefaultState();
    const mutations = new StateMutationService(new EventBus());
    const key: RevealedInformationTarget = {
      entityKind: 'activeStoryEntry',
      entityId: 'base:activestory:welcome',
      target: 'condition',
    };
    mutations.setState(state);

    expect(mutations.revealInformationTarget(key)).toBe(false);
    mutations.setInformationRevealTargetValidator((_state, candidate) =>
      candidate.entityKind === key.entityKind
      && candidate.entityId === key.entityId
      && candidate.target === key.target);

    expect(mutations.revealInformationTarget(key)).toBe(true);
    expect(mutations.revealInformationTarget(key)).toBe(false);
    expect(state.informationRevealProgress?.revealed).toEqual([key]);
    expect(JSON.parse(JSON.stringify(state)).informationRevealProgress.revealed).toEqual([key]);
  });

  test('rejects malformed domain keys and undeclared targets without changing progress', () => {
    const state = createDefaultState();
    const mutations = new StateMutationService(new EventBus());
    mutations.setState(state);
    mutations.setInformationRevealTargetValidator(() => true);

    expect(mutations.revealInformationTarget({
      entityKind: 'not-an-entity', entityId: 'x', target: 'name',
    } as unknown as RevealedInformationTarget)).toBe(false);
    expect(mutations.revealInformationTarget({
      entityKind: 'spot', entityId: '  ', target: 'name',
    })).toBe(false);
    expect(state.informationRevealProgress?.revealed).toEqual([]);
  });

  test('accepts future information targets only when the declaration validator recognizes them', () => {
    const state = createDefaultState();
    const mutations = new StateMutationService(new EventBus());
    const futureTarget: RevealedInformationTarget = {
      entityKind: 'spot', entityId: 'base:spot:printer', target: 'lore',
    };
    mutations.setState(state);

    expect(mutations.revealInformationTarget(futureTarget)).toBe(false);
    mutations.setInformationRevealTargetValidator((_state, key) => key.target === 'lore');
    expect(mutations.revealInformationTarget(futureTarget)).toBe(true);
    expect(state.informationRevealProgress?.revealed).toEqual([futureTarget]);
  });

  test('always rejects existence and unlock even when the declaration validator accepts them', () => {
    const state = createDefaultState();
    const mutations = new StateMutationService(new EventBus());
    mutations.setState(state);
    mutations.setInformationRevealTargetValidator(() => true);

    expect(mutations.revealInformationTarget({
      entityKind: 'spot', entityId: 'base:spot:printer', target: 'existence',
    })).toBe(false);
    expect(mutations.revealInformationTarget({
      entityKind: 'spot', entityId: 'base:spot:printer', target: 'unlock',
    })).toBe(false);
    expect(state.informationRevealProgress?.revealed).toEqual([]);
  });

  test('keeps entity kind, full id, and information target as separate identities', () => {
    const state = createDefaultState();
    const mutations = new StateMutationService(new EventBus());
    mutations.setState(state);
    mutations.setInformationRevealTargetValidator(() => true);

    expect(mutations.revealInformationTarget({ entityKind: 'spot', entityId: 'same:id', target: 'name' })).toBe(true);
    expect(mutations.revealInformationTarget({ entityKind: 'area', entityId: 'same:id', target: 'name' })).toBe(true);
    expect(mutations.revealInformationTarget({ entityKind: 'spot', entityId: 'same:id', target: 'condition' })).toBe(true);
    expect(state.informationRevealProgress?.revealed).toHaveLength(3);
  });
});
