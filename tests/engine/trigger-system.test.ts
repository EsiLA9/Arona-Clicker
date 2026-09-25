// ============================================================
// engine/trigger-system.test.ts — Trigger DSL 桥接（事件侦测 → 条件 → 执行）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { and, TriggerDef } from '../../src/engine/types';
import { TriggerSystem } from '../../src/engine/effect/trigger-system';
import type { EffectEngine } from '../../src/engine/effect/effect-engine';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';

describe('TriggerSystem (对外 DSL)', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('registers base trigger defs and fires on story completion', () => {
    // 完成欢迎剧情 → welcome_reward 触发，发放能量饮料
    // 推进循环用 advanceStory 跳过全部演出页（含 clickWork 页），选项页选第 0 项
    const advanceable = () => game.story.getSendState().mode === 'advance';
    expect(game.state.inventory['base:item:energy_drink'] ?? 0).toBe(0);
    while (advanceable()) game.story.advanceStory();
    if (game.story.getSendState().mode === 'choice') {
      game.story.advanceStory(0);
      while (advanceable()) game.story.advanceStory();
    }
    expect(game.state.inventory['base:item:energy_drink'] ?? 0).toBeGreaterThanOrEqual(1);
  });

  test('fires a stat-conditioned trigger once and records it', () => {
    // 清空 spot 隔离正常产出，只保留 trigger 的奖励
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.mutations.changeResource(CREDIT, 100);
    game.tick();

    // first_credit_milestone：累计产出 >= 100 → +25
    expect(game.state.resources[CREDIT]).toBe(125);
    expect(game.state.triggersCompleted).toContain('base:trigger:first_credit_milestone');

    // once：已记录，后续 tick 不再重复发放
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(125);
  });

  test('tag-count condition uses the registry tag index', () => {
    // office_mastered：拥有 >=2 个 office 标签设施 → 设 flag（schale 进入即满足）
    expect(game.state.flags['office_mastered']).toBe('1');
    expect(game.state.triggersCompleted).toContain('base:trigger:office_mastered');
  });

  test('repeatable trigger (once:false) fires on every matching event', () => {
    const def: TriggerDef = {
      id: 'test:trigger:repeat',
      on: { kind: 'resource', resource: CREDIT },
      effects: [{ op: 'setFlag', target: 'repeat_count', value: '1' }],
      once: false,
    };
    game.triggerSystem.load([def]);

    game.mutations.changeResource(CREDIT, 1);
    game.mutations.changeResource(CREDIT, 2);
    expect(game.state.flags['repeat_count']).toBe('1');
    expect(game.state.triggersCompleted).not.toContain('test:trigger:repeat');
  });

  test('unmet condition does not fire', () => {
    const def: TriggerDef = {
      id: 'test:trigger:gated',
      on: { kind: 'resource', resource: CREDIT },
      condition: and({ target: 'resource', key: CREDIT, comparator: '>=', value: 999 }),
      effects: [{ op: 'setFlag', target: 'gated', value: '1' }],
      once: true,
    };
    game.triggerSystem.load([def]);
    game.mutations.changeResource(CREDIT, 10);
    expect(game.state.flags['gated']).toBeUndefined();
  });

  test('save/load persists once-trigger completions', () => {
    game.mutations.changeResource(CREDIT, 100);
    game.tick();
    expect(game.state.triggersCompleted).toContain('base:trigger:first_credit_milestone');

    const save = game.save();
    const loaded = new GameInstance();
    loaded.init([baseDatapack]);
    loaded.load(save);

    // 读档后该 once trigger 不重复触发
    expect(loaded.state.triggersCompleted).toContain('base:trigger:first_credit_milestone');
    loaded.tick();
    expect(loaded.state.resources[CREDIT]).toBeLessThan(loaded.state.resources[CREDIT] + 25);
    loaded.stop();
  });

  test('mount/unmount controls whether a trigger fires', () => {
    const id = 'test:trigger:mounted';
    game.triggerSystem.mount({
      id,
      on: { kind: 'resource', resource: CREDIT },
      effects: [{ op: 'setFlag', target: 'mounted_fired', value: '1' }],
      once: false,
    });
    game.mutations.changeResource(CREDIT, 1);
    expect(game.state.flags['mounted_fired']).toBe('1');

    // 移除后不再触发
    game.triggerSystem.unmount(id);
    expect(game.triggerSystem.has(id)).toBe(false);
    delete game.state.flags['mounted_fired'];
    game.mutations.changeResource(CREDIT, 1);
    expect(game.state.flags['mounted_fired']).toBeUndefined();
  });

  test('unmountGroup removes an entire group (init-scoped triggers)', () => {
    const gid = 'init:test:academy';
    game.triggerSystem.mount({
      id: 'test:trigger:a',
      on: { kind: 'resource', resource: CREDIT },
      effects: [{ op: 'setFlag', target: 'a_fired', value: '1' }],
      once: false,
    }, gid);
    game.triggerSystem.mount({
      id: 'test:trigger:b',
      on: { kind: 'resource', resource: CREDIT },
      effects: [{ op: 'setFlag', target: 'b_fired', value: '1' }],
      once: false,
    }, gid);

    game.triggerSystem.unmountGroup(gid);
    expect(game.triggerSystem.has('test:trigger:a')).toBe(false);
    expect(game.triggerSystem.has('test:trigger:b')).toBe(false);
  });

  test('re-mounting a once trigger does not re-fire after completion', () => {
    const id = 'test:trigger:remount';
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.mutations.changeResource(CREDIT, 100);
    // 先让全局 first_credit_milestone（+25, once）消耗掉，避免干扰
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(125);

    game.triggerSystem.mount({
      id,
      on: { kind: 'tick' },
      condition: and({ target: 'stat', key: `$GlobalProducedAmount ${CREDIT}`, comparator: '>=', value: 100 }),
      effects: [{ op: 'addResource', target: CREDIT, value: 5 }],
      once: true,
    });
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(130);
    const afterFirst = game.state.resources[CREDIT];

    // 移除后重新挂载同一 id：once 已完成，不重复触发
    game.triggerSystem.unmount(id);
    game.triggerSystem.mount({
      id,
      on: { kind: 'tick' },
      condition: and({ target: 'stat', key: `$GlobalProducedAmount ${CREDIT}`, comparator: '>=', value: 100 }),
      effects: [{ op: 'addResource', target: CREDIT, value: 5 }],
      once: true,
    });
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(afterFirst);
  });

  test('init-scoped triggers mount on enter and unmount when leaving the init', () => {
    // 进入夏莱：schale_entered（on:init）触发
    expect(game.state.flags['schale_entered']).toBe('1');
    expect(game.triggerSystem.has('base:trigger:schale_entered')).toBe(true);

    // 切换到千禧年：夏莱专属 trigger 被移除
    game.inits.unlockInit('base:init:millennium');
    game.inits.enterInit('base:init:millennium');
    expect(game.triggerSystem.has('base:trigger:schale_entered')).toBe(false);
    expect(game.triggerSystem.has('base:trigger:schale_first_upgrade')).toBe(false);

    // 回到夏莱：重新挂载
    game.inits.enterInit(OFFICE);
    expect(game.triggerSystem.has('base:trigger:schale_entered')).toBe(true);
  });

  test('P0-1: tick triggers dispatch only on tick, not on resourceChanged', () => {
    game.triggerSystem.mount({
      id: 'p0:tick',
      on: { kind: 'tick' },
      effects: [{ op: 'setFlag', target: 'p0_tick_fired', value: '1' }],
      once: false,
    });
    // 一个 Tick 周期内的多次资源事件不应触发 tick 触发器（分桶派发，
    // 消除原来 O(事件×触发器) 的全扫描；tick 类不再被高频 resourceChanged 反复扫描）
    game.mutations.changeResource(CREDIT, 1);
    game.mutations.changeResource(CREDIT, 2);
    expect(game.state.flags['p0_tick_fired']).toBeUndefined();
    game.tick();
    expect(game.state.flags['p0_tick_fired']).toBe('1');
  });

  test('typed runtime actions are ignored without a handler and never enter the Effect pipeline', () => {
    const resource = 'test:runtime-action';
    game.triggerSystem.setRuntimeActionHandler(null);
    const def: TriggerDef = {
      id: 'test:trigger:runtime-action',
      on: { kind: 'resource', resource },
      effects: [{ op: 'setFlag', target: 'runtime_action_effect', value: 'unexpected' }],
      once: false,
    };
    const request = {
      key: 'test:registration:runtime-action', triggerId: def.id!, def, tags: new Set<string>(),
      action: { kind: 'reveal' as const, handle: 'opaque:test' },
    };
    game.triggerSystem.register(request);
    game.mutations.changeResource(resource, 1);
    expect(game.state.flags.runtime_action_effect).toBeUndefined();

    const seen: string[] = [];
    game.triggerSystem.setRuntimeActionHandler(action => {
      seen.push(action.handle);
      return { kind: 'not-committed' };
    });
    game.mutations.changeResource(resource, 1);
    expect(seen).toEqual(['opaque:test']);
    expect(game.state.flags.runtime_action_effect).toBeUndefined();
  });

  test('dispatches milestone runtime actions without running the Effect pipeline', () => {
    const resource = 'test:milestone-runtime-action';
    const def: TriggerDef = {
      id: 'test:trigger:milestone-runtime-action',
      on: { kind: 'resource', resource },
      effects: [{ op: 'setFlag', target: 'milestone_action_effect', value: 'unexpected' }],
      once: false,
    };
    game.triggerSystem.register({
      key: 'test:registration:milestone-runtime-action',
      triggerId: def.id!, def, tags: new Set(),
      action: { kind: 'milestone', handle: 'milestone:test:action' },
    });
    const seen: string[] = [];
    game.triggerSystem.setRuntimeActionHandler(action => {
      if (action.kind === 'milestone') seen.push(action.handle);
      return { kind: 'not-committed' };
    });

    game.mutations.changeResource(resource, 1);

    expect(seen).toEqual(['milestone:test:action']);
    expect(game.state.flags.milestone_action_effect).toBeUndefined();
  });

  test('同一规范 RegistrationRequest 重复提交幂等，冲突载荷拒绝隐式替换', () => {
    const request = {
      key: 'test:registration:idempotent',
      triggerId: 'test:trigger:shared',
      def: {
        id: 'test:trigger:shared',
        on: { kind: 'resource' as const, resource: CREDIT },
        effects: [{ op: 'setFlag' as const, target: 'idempotent', value: '1' }],
        once: false,
      },
      tags: new Set(['tag:b', 'tag:a']),
      group: 'test:group',
    };
    const firstToken = game.triggerSystem.register(request);
    const secondToken = game.triggerSystem.register({ ...request, tags: new Set(['tag:a', 'tag:b']) });
    expect(secondToken).toBe(firstToken);
    expect(game.triggerSystem.getDefinitions().filter(def => def.id === request.triggerId)).toHaveLength(1);

    expect(() => game.triggerSystem.register({
      ...request,
      def: { ...request.def, effects: [{ op: 'setFlag', target: 'different', value: '1' }] },
    })).toThrow(/registration key conflict/i);
    expect(game.triggerSystem.getDefinitions().find(def => def.id === request.triggerId)?.effects[0]).toEqual(request.def.effects[0]);
  });

  test('同一逻辑 TriggerId 的多条 Registration 共享 once 身份', () => {
    const logicalId = 'test:trigger:shared-once';
    const effect = (target: string): TriggerDef['effects'][number] => ({ op: 'setFlag', target, value: '1' });
    for (const [key, target] of [['registration:a', 'once_a'], ['registration:b', 'once_b']]) {
      game.triggerSystem.register({
        key: `test:${key}`,
        triggerId: logicalId,
        tags: new Set(),
        def: { id: logicalId, on: { kind: 'shop' }, effects: [effect(target)], once: true },
      });
    }
    expect(game.triggerSystem.unmount(logicalId)).toBe(false);
    expect(game.triggerSystem.has(logicalId)).toBe(true);
    game.eventBus.emit({
      type: 'shopPurchased', shopId: 'test:shop', spotId: 'test:spot', entryId: 'entry', quantity: 1,
      resourceCosts: {}, itemCosts: {}, resourceGrants: {}, itemGrants: {},
    });

    expect(Number(Boolean(game.state.flags.once_a)) + Number(Boolean(game.state.flags.once_b))).toBe(1);
    expect((game.state.triggersCompleted ?? []).filter(id => id === logicalId)).toHaveLength(1);
  });

  test('tag withdrawal invalidates same-dispatch candidates even after same-key re-registration', () => {
    const executionOrder: string[] = [];
    let replaced = false;
    let registrationSystem!: TriggerSystem;
    const replacement = {
      key: 'test:registration:b',
      triggerId: 'test:trigger:b',
      def: { id: 'test:trigger:b', on: { kind: 'shop' as const }, effects: [{ op: 'setFlag' as const, target: 'b', value: '1' }], once: false },
      tags: new Set(['cancel-together']),
    };
    const effectEngine = {
      applyEffects(effects: TriggerDef['effects']) {
        const target = effects[0]?.op === 'setFlag' ? effects[0].target : 'unknown';
        executionOrder.push(String(target));
        if (target === 'a' && !replaced) {
          replaced = true;
          registrationSystem.withdrawByTag('cancel-together');
          registrationSystem.register(replacement);
        }
      },
    } as unknown as EffectEngine;
    registrationSystem = new TriggerSystem(game.eventBus, game.conditionSystem, effectEngine);
    registrationSystem.setState(game.state);
    registrationSystem.register({
      key: 'test:registration:a',
      triggerId: 'test:trigger:a',
      def: { id: 'test:trigger:a', on: { kind: 'shop' }, effects: [{ op: 'setFlag', target: 'a', value: '1' }], once: false },
      tags: new Set(['cancel-together']),
    });
    registrationSystem.register(replacement);
    const emitShop = () => game.eventBus.emit({
      type: 'shopPurchased', shopId: 'test:shop', spotId: 'test:spot', entryId: 'entry', quantity: 1,
      resourceCosts: {}, itemCosts: {}, resourceGrants: {}, itemGrants: {},
    });

    emitShop();
    expect(executionOrder).toEqual(['a']);
    emitShop();
    expect(executionOrder).toEqual(['a', 'b']);
  });

  test('clear 不复用 token，且按 group/tag 撤出保持索引一致', () => {
    const request = {
      key: 'test:registration:token',
      triggerId: 'test:trigger:token',
      def: { id: 'test:trigger:token', on: { kind: 'shop' as const }, effects: [], once: false },
      group: 'test:group:token',
      tags: new Set(['test:tag:token']),
    };
    const first = game.triggerSystem.register(request);
    expect(game.triggerSystem.withdraw('test:registration:missing')).toBe(false);
    expect(game.triggerSystem.withdraw('test:registration:missing')).toBe(false);
    game.triggerSystem.clear();
    const second = game.triggerSystem.register(request);
    expect(second).toBeGreaterThan(first);
    expect(game.triggerSystem.withdrawByTag('test:tag:token')).toBe(1);
    expect(game.triggerSystem.withdrawByTag('test:tag:token')).toBe(0);
    game.triggerSystem.register(request);
    game.triggerSystem.unmountGroup('test:group:token');
    expect(game.triggerSystem.has(request.triggerId)).toBe(false);
  });

  test('runtime tag 严格相等匹配，group 只撤出所属 Registration', () => {
    const baseRequest = {
      triggerId: 'test:trigger:indexed',
      def: { id: 'test:trigger:indexed', on: { kind: 'shop' as const }, effects: [], once: false },
    };
    game.triggerSystem.register({
      ...baseRequest, key: 'test:registration:tag-parent', group: 'test:group:parent',
      tags: new Set(['scope']),
    });
    game.triggerSystem.register({
      ...baseRequest, key: 'test:registration:tag-child', group: 'test:group:child',
      tags: new Set(['scope/child']),
    });
    game.triggerSystem.register({
      ...baseRequest, key: 'test:registration:other-group', group: 'test:group:other',
      tags: new Set(['unrelated']),
    });

    expect(game.triggerSystem.withdrawByTag('scope')).toBe(1);
    expect(game.triggerSystem.has(baseRequest.triggerId)).toBe(true);
    game.triggerSystem.unmountGroup('test:group:child');
    expect(game.triggerSystem.withdrawByTag('scope/child')).toBe(0);
    expect(game.triggerSystem.has(baseRequest.triggerId)).toBe(true);
    expect(game.triggerSystem.withdrawByTag('unrelated')).toBe(1);
    expect(game.triggerSystem.has(baseRequest.triggerId)).toBe(false);
  });

  test('同一 legacy key 换事件桶时清除旧桶索引', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.triggerSystem.mount({
      id: 'test:trigger:legacy-replace', on: { kind: 'tick' },
      effects: [{ op: 'setFlag', target: 'legacy_replaced', value: 'resource' }], once: false,
    });
    game.triggerSystem.mount({
      id: 'test:trigger:legacy-replace', on: { kind: 'resource', resource: CREDIT },
      effects: [{ op: 'setFlag', target: 'legacy_replaced', value: 'resource' }], once: false,
    });
    game.tick();
    expect(game.state.flags.legacy_replaced).toBeUndefined();
    game.mutations.changeResource(CREDIT, 1);
    expect(game.state.flags.legacy_replaced).toBe('resource');
  });

  test('Registration 准入和撤出不增减 EventBus 按类型订阅者', () => {
    const handlers = (game.eventBus as unknown as { handlers: Map<string, unknown[]> }).handlers;
    const before = handlers.get('shopPurchased')?.length ?? 0;
    const keys: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const key = `test:registration:listener:${index}`;
      keys.push(key);
      game.triggerSystem.register({
        key,
        triggerId: `test:trigger:listener:${index}`,
        tags: new Set(),
        def: { id: `test:trigger:listener:${index}`, on: { kind: 'shop' }, effects: [], once: false },
      });
    }
    for (const key of keys) game.triggerSystem.withdraw(key);
    expect(handlers.get('shopPurchased')?.length ?? 0).toBe(before);
  });
});
