// ============================================================
// engine/def-factory/trigger.test.ts — Trigger 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  trigger,
  TriggerBuilder,
  and,
  cond,
} from '../../../src/engine/types';
import { Resource } from '../../../src/arona-clicker/types/ids';
import type { TriggerDef } from '../../../src/engine/types';

const CREDIT = Resource.Credit;

describe('TriggerBuilder', () => {
  test('trigger() 返回 TriggerBuilder 实例', () => {
    expect(trigger('base:trigger:x')).toBeInstanceOf(TriggerBuilder);
  });

  test('build() 产出最小 TriggerDef（once 缺省 true 显式输出）', () => {
    const def = trigger('base:trigger:x').onTick().build();
    expect(def).toEqual<TriggerDef>({
      id: 'base:trigger:x',
      on: { kind: 'tick' },
      effects: [],
      once: true,
    });
  });

  test('缺 on 时 build() 抛错', () => {
    expect(() => trigger('base:trigger:x').build()).toThrow(/on/);
  });

  test('里程碑 Trigger 全字段链式等价于字面量', () => {
    const def = trigger('base:trigger:first_credit_milestone')
      .onTick()
      .when(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 100))
      .effects({ op: 'addResource', target: CREDIT, value: 25 })
      .build();
    expect(def).toEqual<TriggerDef>({
      id: 'base:trigger:first_credit_milestone',
      on: { kind: 'tick' },
      condition: cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 100),
      effects: [{ op: 'addResource', target: CREDIT, value: 25 }],
      once: true,
    });
  });

  test('once() 显式控制 true/false 均输出', () => {
    expect(trigger('test:trigger:t').onTick().once(false).build()).toHaveProperty('once', false);
    expect(trigger('test:trigger:t').onTick().build()).toHaveProperty('once', true);
    expect(trigger('test:trigger:t').onTick().once().build()).toHaveProperty('once', true);
  });

  test('事件侦测糖方法构造 TriggerEventDef 变体', () => {
    const t = (b: ReturnType<typeof trigger>) => b.build().on;
    expect(t(trigger('test:trigger:t').onTick(5))).toEqual({ kind: 'tick', every: 5 });
    expect(t(trigger('test:trigger:t').onResource(CREDIT))).toEqual({ kind: 'resource', resource: CREDIT });
    expect(t(trigger('test:trigger:t').onSpotLevel('test:spot:s'))).toEqual({ kind: 'spotLevel', spotId: 'test:spot:s' });
    expect(t(trigger('test:trigger:t').onSpotLevel())).toEqual({ kind: 'spotLevel' });
    expect(t(trigger('test:trigger:t').onItem('test:item:i'))).toEqual({ kind: 'item', itemId: 'test:item:i' });
    expect(t(trigger('test:trigger:t').onStory('test:story:st'))).toEqual({ kind: 'story', storyId: 'test:story:st' });
    expect(t(trigger('test:trigger:t').onInit('test:init:in'))).toEqual({ kind: 'init', initId: 'test:init:in' });
    expect(t(trigger('test:trigger:t').onArea('test:area:a'))).toEqual({ kind: 'area', areaId: 'test:area:a' });
  });

  test('匿名 Trigger（无 id）不输出 id 字段', () => {
    const def = trigger().onTick().effects({ op: 'setFlag', target: 'f', value: '1' }).build();
    expect(def).not.toHaveProperty('id');
    expect(def.on).toEqual({ kind: 'tick' });
  });

  test('effects 追加与 and() 组合条件', () => {
    const def = trigger('test:trigger:t')
      .onTick()
      .when(and(cond('resource', CREDIT, '>=', 10), cond('flag', 'f', '==', 1)))
      .effects({ op: 'addResource', target: CREDIT, value: 5 })
      .effects({ op: 'addItem', target: 'base:item:i', value: 1 })
      .build();
    expect(def.condition).toEqual({
      type: 'AND',
      conditions: [
        cond('resource', CREDIT, '>=', 10),
        cond('flag', 'f', '==', 1),
      ],
    });
    expect(def.effects).toHaveLength(2);
  });
});
