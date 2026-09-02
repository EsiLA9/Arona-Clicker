// ============================================================
// engine/effect-engine.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import { EventBus } from '../../src/engine/core/event-bus';
import { EffectEngine } from '../../src/engine/effect/effect-engine';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';
import { ValueSystem } from '../../src/engine/expression/value-system';
import { Effect, Expr, value } from '../../src/engine/types';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';
import { extra } from '../../src/engine/extra/index';

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

describe('EffectEngine', () => {
  test('should add resource', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'addResource', target: 'credit', value: 100 }]);
    expect(state.resources.credit).toBe(100);
  });

  test('should set resource', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    state.resources.credit = 50;
    engine.setState(state);

    engine.applyEffects([{ op: 'setResource', target: 'credit', value: 200 }]);
    expect(state.resources.credit).toBe(200);
  });

  test('should set spot level', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'setSpotLevel', target: 'spot_x', value: 3 }]);
    expect(state.spotLevels.spot_x).toBe(3);
  });

  test('should add spot level', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    state.spotLevels.spot_x = 1;
    engine.setState(state);

    engine.applyEffects([{ op: 'addSpotLevel', target: 'spot_x', value: 2 }]);
    expect(state.spotLevels.spot_x).toBe(3);
  });

  test('should set manager', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'setManager', target: 'spot_x', value: Character.Shiroko }]);
    expect(state.spotManagers.spot_x).toBe(Character.Shiroko);
  });

  test('should add enhancement (no dup)', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'addEnhancement', target: '', value: 'enh_a' }]);
    engine.applyEffects([{ op: 'addEnhancement', target: '', value: 'enh_a' }]);
    expect(state.unlockedEnhancements).toEqual(['enh_a']);
  });

  test('should add item to inventory', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'addItem', target: 'item_x', value: 5 }]);
    expect(state.inventory.item_x).toBe(5);
  });

  test('should unlock init', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'unlockInit', target: '', value: 'init_b' }]);
    expect(state.unlockedInits).toContain('init_b');
  });

  test('should set flag', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'setFlag', target: 'tutorial', value: 'done' }]);
    expect(state.flags.tutorial).toBe('done');
  });

  test('should delegate runtime effects to the injected host handler', () => {
    const bus = new EventBus();
    const seen: Effect[] = [];
    const engine = new EffectEngine(
      new StateMutationService(bus),
      undefined,
      effect => {
        seen.push(effect);
        return effect.op === 'setTheme';
      },
    );
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'setTheme', target: '', value: 'ephemeral-theme' }]);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.op).toBe('setTheme');
  });

  test('should apply multiple effects in order', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([
      { op: 'addResource', target: 'credit', value: 50 },
      { op: 'addResource', target: 'credit', value: 30 },
      { op: 'setSpotLevel', target: 'spot_x', value: 1 },
    ]);
    expect(state.resources.credit).toBe(80);
    expect(state.spotLevels.spot_x).toBe(1);
  });

  test('should set extra with ExtraValue (not resolved as ValueExpression)', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'setExtra', target: 'story/choice/3', value: extra.int(1) }]);
    expect(state.extras).toEqual(
      extra.dict({ story: extra.dict({ choice: extra.dict({ '3': extra.int(1) }) }) }),
    );
  });

  test('should set extra with primitive literal (auto-converted)', () => {
    const bus = new EventBus();
    const engine = new EffectEngine(new StateMutationService(bus));
    const state = emptyState();
    engine.setState(state);

    engine.applyEffects([{ op: 'setExtra', target: 'meta/title', value: 'hello' }]);
    expect(state.extras).toEqual(extra.dict({ meta: extra.dict({ title: extra.str('hello') }) }));
  });

  test('should add extra from missing base as 0 and resolve ValueExpression delta', () => {
    const bus = new EventBus();
    // 带 valueSystem 的 EffectEngine：addExtra 增量按表达式求值
    const vs = new ValueSystem();
    const engine = new EffectEngine(new StateMutationService(bus), vs);
    const state = emptyState();
    state.resources.credit = 10;
    engine.setState(state);

    engine.applyEffects([
      { op: 'addExtra', target: 'meta/kills', value: Expr.val(value('res', { resource: 'credit' })) },
    ]);
    expect(state.extras).toEqual(extra.dict({ meta: extra.dict({ kills: extra.int(10) }) }));
  });
});

describe('StateMutationService extras', () => {
  test('addExtra should use injected merged reader as base and keep float type', () => {
    const bus = new EventBus();
    const mutations = new StateMutationService(bus);
    const state = emptyState();
    mutations.setState(state);
    mutations.setExtraReader(() => extra.float(0.5));

    mutations.addExtra('meta/rate', 0.5);
    expect(state.extras).toEqual(extra.dict({ meta: extra.dict({ rate: extra.float(1) }) }));
  });

  test('removeExtra should delete node and silently ignore missing paths', () => {
    const bus = new EventBus();
    const mutations = new StateMutationService(bus);
    const state = emptyState();
    mutations.setState(state);
    mutations.setExtra('meta/kills', extra.int(3));
    mutations.removeExtra('meta/kills');
    expect(state.extras).toEqual(extra.dict({ meta: extra.dict({}) }));
    expect(() => mutations.removeExtra('meta/nope')).not.toThrow();
  });

  test('removeExtra with no extras layer is a no-op', () => {
    const bus = new EventBus();
    const mutations = new StateMutationService(bus);
    mutations.setState(emptyState());
    expect(() => mutations.removeExtra('meta/kills')).not.toThrow();
  });
});
