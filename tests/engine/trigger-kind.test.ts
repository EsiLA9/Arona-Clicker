// ============================================================
// tests/engine/trigger-kind.test.ts — T4 扩展：character / cultivated
// kind 与 ON_KIND_TO_EVENT 穷尽（映射双向锁合的行为面验证）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { ON_KIND_TO_EVENT } from '../../src/engine/effect/trigger-system';
import { EVENT_CATALOG } from '../../src/engine/types/events';
import type { TriggerEventKind } from '../../src/engine/types';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';

describe('Trigger 映射扩展（T4：character / cultivated）', () => {
  // 编译期穷尽：手列 kind 全集必须覆盖 TriggerEventKind（缺项/多项即编译错误）
  const kindList: Record<TriggerEventKind, true> = {
    tick: true, resource: true, spotLevel: true, item: true, story: true,
    init: true, area: true, character: true, cultivated: true,
  };

  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('ON_KIND_TO_EVENT 覆盖全部 kind，映射值都是已登记事件', () => {
    for (const kind of Object.keys(kindList) as TriggerEventKind[]) {
      const eventType = ON_KIND_TO_EVENT[kind];
      expect(eventType).toBeDefined();
      expect(EVENT_CATALOG[eventType]).toBeDefined();
    }
    // 无多余键
    expect(Object.keys(ON_KIND_TO_EVENT).length).toBe(Object.keys(kindList).length);
  });

  test("kind 'character'：variantId 过滤 + 真实获得链触发", () => {
    game.triggerSystem.mount({
      id: 'test:trigger:char',
      on: { kind: 'character', variantId: 'Hoshino' },
      effects: [{ op: 'addResource', target: CREDIT, value: 10 }],
      once: false,
    });
    // 其他差分不触发
    game.mutations.acquireCharacter('Yuuka', 'story');
    expect(game.state.resources[CREDIT] ?? 0).toBe(0);
    // 真实获得星野触发
    game.mutations.acquireCharacter('Hoshino', 'story');
    expect(game.state.resources[CREDIT] ?? 0).toBe(10);
  });

  test("kind 'character'：缺省 variantId 任意差分触发", () => {
    game.triggerSystem.mount({
      id: 'test:trigger:char-any',
      on: { kind: 'character' },
      effects: [{ op: 'setFlag', target: 'char_any_fired', value: '1' }],
      once: false,
    });
    game.eventBus.emit({ type: 'characterAcquired', variantId: 'SomeOne', via: 'event', duplicate: false, shards: 0, bonusResources: {} });
    expect(game.state.flags['char_any_fired']).toBe('1');
  });

  test("kind 'cultivated'：cultivation 过滤（star 不吃 exp 事件）", () => {
    game.triggerSystem.mount({
      id: 'test:trigger:cult-star',
      on: { kind: 'cultivated', cultivation: 'star' },
      effects: [{ op: 'addResource', target: CREDIT, value: 7 }],
      once: false,
    });
    game.eventBus.emit({ type: 'cultivated', variantId: 'Hoshino', kind: 'exp', newLevel: 2 });
    expect(game.state.resources[CREDIT] ?? 0).toBe(0);
    game.eventBus.emit({ type: 'cultivated', variantId: 'Hoshino', kind: 'star', newStars: 1 });
    expect(game.state.resources[CREDIT] ?? 0).toBe(7);
  });

  test("kind 'cultivated'：真实培养链（获得→加经验→升级）触发 exp", () => {
    game.triggerSystem.mount({
      id: 'test:trigger:cult-exp',
      on: { kind: 'cultivated', cultivation: 'exp' },
      effects: [{ op: 'addResource', target: CREDIT, value: 5 }],
      once: false,
    });
    game.mutations.acquireCharacter('Hoshino', 'story');
    const before = game.state.resources[CREDIT] ?? 0;
    game.mutations.addExp('Hoshino', 10000);
    expect(game.state.resources[CREDIT] ?? 0).toBe(before + 5);
  });
});
