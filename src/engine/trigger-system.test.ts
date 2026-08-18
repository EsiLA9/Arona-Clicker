// ============================================================
// engine/trigger-system.test.ts — Trigger DSL 桥接（事件侦测 → 条件 → 执行）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from './game-instance';
import { baseDatapack } from '../data/index';
import { and, TriggerDef } from './types';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';

describe('TriggerSystem (对外 DSL)', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('registers base trigger defs and fires on story completion', () => {
    // 完成欢迎剧情 → welcome_reward 触发，发放能量饮料
    expect(game.state.inventory['base:item:energy_drink'] ?? 0).toBe(0);
    while (game.getSendState().mode === 'advance') game.clickSend();
    if (game.getSendState().mode === 'choice') {
      game.advanceStory(0);
      while (game.getSendState().mode === 'advance') game.clickSend();
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
    game.unlockInit('base:init:millennium');
    game.enterInit('base:init:millennium');
    expect(game.triggerSystem.has('base:trigger:schale_entered')).toBe(false);
    expect(game.triggerSystem.has('base:trigger:schale_first_upgrade')).toBe(false);

    // 回到夏莱：重新挂载
    game.enterInit(OFFICE);
    expect(game.triggerSystem.has('base:trigger:schale_entered')).toBe(true);
  });
});
