// ============================================================
// engine/anonymous-affector-trigger.test.ts — 匿名构建模式
//
// 覆盖：
//  1. AffectorPackRef 内联挂载（带 id / 无 id 派生身份）
//  2. AffectorEngine.load 合并语义（多 Datapack 叠加 + 后加载覆盖 + clear）
//  3. Enhancement.affectorPackIds 内联 → 获得挂载 / 移除卸载（含 zoneModifiers）
//  4. 匿名 Trigger（缺省 id）派生确定性身份 + once 去重
//  5. 匿名 Trigger 存档存读复现（once 完成状态对得上，不重复触发）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { AffectorEngine } from '../../src/engine/effect/affector-engine';
import { ConditionSystem } from '../../src/engine/expression/condition-system';
import { EventBus } from '../../src/engine/core/event-bus';
import { Registry } from '../../src/engine/registry/registry';
import { StateMutationService } from '../../src/engine/system/state-mutation-service';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { PlayerState, TriggerDef, EnhancementDef, AffectorPackDef, Datapack } from '../../src/engine/types';
import { deriveAnonymousId } from '../../src/engine/core/anonymous-id';

const CREDIT = 'base:resource:credit';

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

function makeEngine(): AffectorEngine {
  return new AffectorEngine(
    new Registry(),
    new ConditionSystem(),
    new StateMutationService(new EventBus()),
  );
}

/** 向运行中的 GameInstance 追加加载一个仅含目标 enhancement 的附加 Datapack（多包交互场景）。 */
function loadExtraEnhancementDp(game: GameInstance, enhancement: EnhancementDef): void {
  game.registry.load({
    name: 'test:dp:inline',
    version: '1',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [enhancement],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: [],
  } as unknown as Datapack);
}

describe('AffectorEngine：内联 AffectorPackRef 挂载', () => {
  test('mount 内联 pack（带 id）注册并可查询', () => {
    const engine = makeEngine();
    engine.setState(emptyState());
    const inline: AffectorPackDef = {
      id: 'inline:pack:energy',
      entries: [{ id: 'e', effects: [{ op: 'addResource', target: CREDIT, value: 1 }] }],
    };
    const instance = engine.mount(inline, 'spot_test')!;
    expect(instance.packId).toBe('inline:pack:energy');
    expect(instance.instanceId).toBe('inline:pack:energy@spot_test');
    expect(engine.getPack(inline)).toBe(inline); // 内联引用 getPack 直返
    expect(engine.getPack('inline:pack:energy')?.entries.length).toBe(1);
  });

  test('mount 内联 pack（无 id）派生稳定身份且可复现', () => {
    const engine = makeEngine();
    engine.setState(emptyState());
    // AffectorPackDef.id 声明语义必填；mount 对运行时缺省 id 的内联包做防御性派生
    const inline = { entries: [{ id: 'e', effects: [{ op: 'addResource', target: CREDIT, value: 1 }] }] } as AffectorPackDef;
    const instance = engine.mount(inline, 'spot_test')!;
    const expected = deriveAnonymousId('anon:pack', inline);
    expect(instance.packId).toBe(expected);
    expect(instance.packId.startsWith('anon:pack:')).toBe(true);
    // 同结构再次挂载 → 同一派生 id（once/source 稳定性）
    const again = engine.mount(
      { entries: [{ id: 'e', effects: [{ op: 'addResource', target: CREDIT, value: 1 }] }] } as AffectorPackDef,
      'spot_test2',
    )!;
    expect(again.packId).toBe(expected);
  });

  test('内联 pack 可卸载，unmount 后不再 active', () => {
    const engine = makeEngine();
    engine.setState(emptyState());
    const instance = engine.mount({
      id: 'inline:pack:temp',
      entries: [{ id: 'e', effects: [] }],
    }, 'spot_test')!;
    expect(instance.state).toBe('Active');
    expect(engine.unmount(instance.instanceId)).toBe(true);
    expect(engine.getInstance(instance.instanceId)?.state).toBe('Removed');
  });
});

describe('AffectorEngine：多 Datapack 合并（后加载优先）', () => {
  test('load 多次叠加保留全部包，后加载同名 id 覆盖', () => {
    const engine = makeEngine();
    engine.load([{ id: 'pack:a', entries: [{ id: 'a1', effects: [] }] }]);
    engine.load([{ id: 'pack:b', entries: [{ id: 'b1', effects: [] }] }]);
    expect(engine.getPack('pack:a')).toBeDefined();
    expect(engine.getPack('pack:b')).toBeDefined();
    // 后加载覆盖同名 id（以新加载的 Datapack 为第一判断依据）
    engine.load([{ id: 'pack:a', entries: [{ id: 'a2', effects: [] }] }]);
    expect(engine.getPack('pack:a')?.entries[0].id).toBe('a2');
  });

  test('clear 清空全部注册（整体替换数据包语义）', () => {
    const engine = makeEngine();
    engine.load([{ id: 'pack:a', entries: [{ id: 'a1', effects: [] }] }]);
    engine.clear();
    expect(engine.getPack('pack:a')).toBeUndefined();
  });
});

describe('GameInstance：enhancement 内联 affectorPackIds 生命周期', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  afterEach(() => {
    game.stop();
  });

  test('获得携带内联 pack 的 enhancement → 挂载；移除 → 卸载', () => {
    const enhId = 'test:enh:inline_pack';
    loadExtraEnhancementDp(game, {
      id: enhId,
      name: '',
      description: '',
      effects: [],
      autoApply: false,
      affectorPackIds: [{
        id: 'test:pack:inline',
        entries: [{ id: 'e', effects: [{ op: 'addResource', target: CREDIT, value: 5 }] }],
      }],
    } as EnhancementDef);

    game.mutations.addEnhancement(enhId);
    expect(game.affectorEngine.getPack('test:pack:inline')).toBeDefined();
    expect(game.affectorEngine.getActiveInstances().some(
      i => i.packId === 'test:pack:inline' && i.mountEntityId === enhId,
    )).toBe(true);

    game.mutations.removeEnhancement(enhId);
    expect(game.affectorEngine.getActiveInstances().some(
      i => i.packId === 'test:pack:inline',
    )).toBe(false);
  });

  test('内联 pack 的 zoneModifiers 经桥接写入区效果，移除后按 source 撤销', () => {
    const enhId = 'test:enh:inline_zone';
    loadExtraEnhancementDp(game, {
      id: enhId,
      name: '',
      description: '',
      effects: [],
      autoApply: false,
      affectorPackIds: [{
        id: 'test:pack:inline_zone',
        entries: [{
          id: 'z',
          effects: [],
          zoneModifiers: [{
            target: { kind: 'entity', ref: { kind: 'spot', id: '*' } },
            category: 'mul',
            value: 1.5,
            life: 'init',
          }],
        }],
      }],
    } as EnhancementDef);

    const source = `affector:test:pack:inline_zone@${enhId}`;
    game.mutations.addEnhancement(enhId);
    expect(Object.values(game.state.entityEffects ?? {}).flat().some(
      r => r.source === source,
    )).toBe(true);

    game.mutations.removeEnhancement(enhId);
    expect(Object.values(game.state.entityEffects ?? {}).flat().some(
      r => r.source === source,
    )).toBe(false);
  });
});

describe('GameInstance：匿名 Trigger（缺省 id）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  afterEach(() => {
    game.stop();
  });

  const anonResourceDef = (): TriggerDef => ({
    on: { kind: 'tick' },
    effects: [{ op: 'addResource', target: 'test:resource:anon', value: 10 }],
    once: true,
  });

  test('匿名 Trigger 触发后 once 完成记录为派生 id，重复挂载不再触发', () => {
    game.triggerSystem.mount(anonResourceDef());
    const derived = deriveAnonymousId('anon:trigger:global', anonResourceDef());
    expect(derived.startsWith('anon:trigger:global:')).toBe(true);

    game.tick();
    expect(game.state.resources['test:resource:anon']).toBe(10);
    expect(game.state.triggersCompleted).toContain(derived);

    // 移除后重挂同一结构：once 已完成，不重复触发
    game.triggerSystem.unmount(derived);
    game.triggerSystem.mount(anonResourceDef());
    game.tick();
    expect(game.state.resources['test:resource:anon']).toBe(10);
  });

  test('匿名 Trigger 存档存读后 once 状态复现（不重复触发）', () => {
    game.triggerSystem.mount(anonResourceDef());
    const derived = deriveAnonymousId('anon:trigger:global', anonResourceDef());
    game.tick();
    expect(game.state.resources['test:resource:anon']).toBe(10);

    const save = game.save();
    const loaded = new GameInstance();
    loaded.init([baseDatapack]);
    loaded.load(save);
    loaded.triggerSystem.mount(anonResourceDef());
    loaded.tick();
    // 匿名结构不存存档本体，但派生身份一致 → 读档后 once 不重复执行 effects（资源保持存档值 10）
    expect(loaded.state.resources['test:resource:anon']).toBe(10);
    expect(loaded.state.triggersCompleted).toContain(derived);
    loaded.stop();
  });
});
