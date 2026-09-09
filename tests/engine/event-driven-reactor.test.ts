// ============================================================
// engine/event-driven-reactor.test.ts — EventDrivenReactor 共享基底
// 覆盖：Affector 条件定向 recheck（事件驱动翻转）、stat 实例轮询降级、
// ConditionDepIndex 的 extra 前缀 / tag / 宽依赖命中语义。
// ============================================================
import { describe, test, expect } from 'vitest';
import { AffectorEngine } from '../../src/engine/effect/affector-engine';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { EventBus } from '../../src/engine/core/event-bus';
import { Registry } from '../../src/data-services/registry/registry';
import { StateMutationService } from '../../src/arona-clicker/state/state-mutation-service';
import { ConditionDepIndex, collectConditionLeaves } from '../../src/engine/expression/condition-deps';
import { GameEvent } from '../../src/engine/types';
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

function makeEngine(bus: EventBus, state: PlayerState) {
  const mutations = new StateMutationService(bus);
  mutations.setState(state);
  const engine = new AffectorEngine(new Registry(), new ConditionSystem(), mutations, bus);
  engine.setState(state);
  return { engine, mutations };
}

describe('Affector 条件定向 recheck（事件驱动）', () => {
  test('flag 条件经 flagChanged 事件自动翻转，无需手动 recheck 或 tick', () => {
    const bus = new EventBus();
    const state = emptyState();
    const { engine, mutations } = makeEngine(bus, state);
    engine.load([{
      id: 'pack_flag',
      entries: [{
        id: 'entry_flag',
        condition: { type: 'AND', conditions: [{ target: 'flag', key: 'gate_open', comparator: '==', value: 1 }] },
        effects: [{ op: 'addResource', target: 'credit', value: 1 }],
      }],
    }]);

    const instance = engine.mount('pack_flag', 'entity_a')!;
    expect(instance.state).toBe('Latent');

    // 经写入口置 flag → flagChanged 事件 → 定向 recheck
    mutations.setFlag('gate_open', '1');
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Active');

    mutations.setFlag('gate_open', '');
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Latent');
  });

  test('跨实体 spotLevel 条件由事件命中（旧实现仅 recheck 同实体实例）', () => {
    const bus = new EventBus();
    const state = emptyState();
    const { engine, mutations } = makeEngine(bus, state);
    engine.load([{
      id: 'pack_cross',
      entries: [{
        id: 'entry_other_spot',
        condition: { type: 'AND', conditions: [{ target: 'spotLevel', key: 'spot_b', comparator: '>=', value: 2 }] },
        effects: [],
      }],
    }]);

    const instance = engine.mount('pack_cross', 'entity_a')!;
    expect(instance.state).toBe('Latent');

    mutations.setSpotLevel('spot_b', 2);
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Active');
  });

  test('stat 条件实例不响应无关事件，仅随 applyActiveEffects 每 Tick 重估（轮询降级）', () => {
    const bus = new EventBus();
    const state = emptyState();
    const mutations = new StateMutationService(bus);
    mutations.setState(state);
    let statValue = 0;
    const conditionSystem = new ConditionSystem();
    conditionSystem.setStatReader(() => statValue);
    const engine = new AffectorEngine(new Registry(), conditionSystem, mutations, bus);
    engine.setState(state);
    engine.load([{
      id: 'pack_stat',
      entries: [{
        id: 'entry_stat',
        condition: { type: 'AND', conditions: [{ target: 'stat', key: 'produced.credit >= 100', comparator: '==', value: 1 }] },
        effects: [],
      }],
    }]);

    const instance = engine.mount('pack_stat', 'entity_a')!;
    expect(instance.state).toBe('Latent');

    // 无关事件不翻转（stat 无专属事件，实例进入轮询集合）
    mutations.setFlag('unrelated', 'x');
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Latent');

    // applyActiveEffects 的轮询阶段重估 stat 实例
    statValue = 1;
    engine.applyActiveEffects();
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Active');
  });
});

describe('ConditionDepIndex 命中语义', () => {
  test('extra 依赖按路径前缀双向命中', () => {
    const idx = new ConditionDepIndex<string>();
    idx.register('child', { target: 'extra', key: ['a', 'b'], comparator: '>=', value: 1 } as never);
    idx.register('parent', { target: 'extra', key: ['a'], comparator: '>=', value: 1 } as never);

    const ev = (path: string[]) => ({ type: 'extraChanged', path }) as unknown as GameEvent;
    // 前缀双向：父路径变化也会命中子路径依赖（与可见性索引既有语义一致）
    expect(idx.affected(ev(['a', 'b', 'c']))).toEqual(new Set(['child', 'parent']));
    expect(idx.affected(ev(['a']))).toEqual(new Set(['child', 'parent']));
    expect(idx.affected(ev(['x']))).toEqual(new Set());
  });

  test('hasTag 依赖由 spotLevelChanged 与同 tag spotTagChanged 命中', () => {
    const idx = new ConditionDepIndex<string>();
    idx.register('tagged', { target: 'hasTag', key: 'office', comparator: '==', value: 1 } as never);

    expect(idx.affected({ type: 'spotLevelChanged', spotId: 'test:spot:s1', newLevel: 1 })).toEqual(new Set(['tagged']));
    expect(idx.affected({ type: 'spotLevelChanged', spotId: 'test:spot:s1', oldLevel: 5, newLevel: 6 })).toEqual(new Set());
    expect(idx.affected({ type: 'spotLevelChanged', spotId: 'test:spot:s1', oldLevel: 1, newLevel: 0 })).toEqual(new Set(['tagged']));
    expect(idx.affected({ type: 'spotTagChanged', spotId: 'test:spot:s1', tag: 'office', added: true })).toEqual(new Set(['tagged']));
    expect(idx.affected({ type: 'spotTagChanged', spotId: 'test:spot:s1', tag: 'field', added: true })).toEqual(new Set());
  });

  test('unregister 摘除全部依赖；collectConditionLeaves 展开嵌套条件组', () => {
    const idx = new ConditionDepIndex<string>();
    idx.register('k', {
      type: 'OR',
      conditions: [
        { target: 'resource', key: 'credit', comparator: '>=', value: 1 },
        { type: 'AND', conditions: [{ target: 'flag', key: 'f', comparator: '==', value: 1 }] },
      ],
    } as never);
    expect(idx.affected({ type: 'resourceChanged', resource: 'credit', delta: 1, newValue: 2 })).toEqual(new Set(['k']));
    idx.unregister('k');
    expect(idx.affected({ type: 'resourceChanged', resource: 'credit', delta: 1, newValue: 2 })).toEqual(new Set());

    const leaves = collectConditionLeaves({
      type: 'AND',
      conditions: [
        { target: 'flag', key: 'a', comparator: '==', value: 1 },
        { type: 'OR', conditions: [{ target: 'flag', key: 'b', comparator: '==', value: 1 }] },
      ],
    } as never);
    expect(leaves.map(l => l.key)).toEqual(['a', 'b']);
  });
});
