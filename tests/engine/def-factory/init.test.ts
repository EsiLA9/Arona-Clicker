// ============================================================
// engine/def-factory/init.test.ts — Init 链式 Builder
// .build() 必须产出标准 InitDef（纯数据），字段语义与字面量等价。
// ============================================================
import { describe, test, expect } from 'vitest';
import { init, InitBuilder, and, cond, r, extra, Resource } from '../../../src/engine/types';
import type { InitDef, TriggerDef } from '../../../src/engine/types';

const CREDIT = Resource.Credit;

describe('InitBuilder', () => {
  test('init() 返回 InitBuilder 实例', () => {
    const b = init('base:init:test');
    expect(b).toBeInstanceOf(InitBuilder);
  });

  test('build() 产出标准 InitDef', () => {
    const def = init('base:init:schale_office')
      .name('夏莱办公室')
      .desc('一切故事的起点。')
      .areas('base:area:schale_main')
      .build();
    expect(def).toEqual<InitDef>({
      id: 'base:init:schale_office',
      name: '夏莱办公室',
      description: '一切故事的起点。',
      defaultAreas: ['base:area:schale_main'],
    });
  });

  test('缺 name / description 时 build() 抛错', () => {
    expect(() => init('base:init:x').areas().build()).toThrow(/name/);
    expect(() => init('base:init:x').name('x').build()).toThrow(/description/);
  });

  test('全字段链式等价于字面量', () => {
    const trigger: TriggerDef = {
      id: 'base:trigger:t',
      on: { kind: 'tick' },
      effects: [{ op: 'setFlag', target: 't', value: '1' }],
      once: true,
    };
    const built = init('base:init:millennium')
      .name('千禧年学院')
      .desc('科技与逻辑的学府。')
      .areas('base:area:millennium_lab', 'base:area:millennium_canteen')
      .startStory('base:activestory:welcome')
      .tilt('0.985')
      .tiltAlias('观测受限')
      .cost(CREDIT, 20)
      .triggers(trigger)
      .onEnter({ op: 'setFlag', target: 'entered', value: '1' })
      .onEnterFirst({ op: 'setFlag', target: 'first', value: '1' })
      .onEnterWhen(and(cond('resource', CREDIT, '>=', 10)), { op: 'addResource', target: CREDIT, value: 5 })
      .reveal('name', cond('resource', CREDIT, '>=', 50))
      .revealCredit('utility', 300)
      .tags(['school', 'millennium'])
      .extra(extra.dict({ tier: extra.int(1) }))
      .build();

    expect(built).toEqual<InitDef>({
      id: 'base:init:millennium',
      name: '千禧年学院',
      description: '科技与逻辑的学府。',
      defaultAreas: ['base:area:millennium_lab', 'base:area:millennium_canteen'],
      startStoryId: 'base:activestory:welcome',
      worldTilt: '0.985',
      worldTiltAlias: '观测受限',
      purchaseCost: [{ resourceId: CREDIT, amount: 20 }],
      triggers: [trigger],
      enterEffects: [
        { effects: [{ op: 'setFlag', target: 'entered', value: '1' }] },
        { first: true, effects: [{ op: 'setFlag', target: 'first', value: '1' }] },
        { condition: and(cond('resource', CREDIT, '>=', 10)), effects: [{ op: 'addResource', target: CREDIT, value: 5 }] },
      ],
      revealTriggers: [
        { reveal: 'name', condition: cond('resource', CREDIT, '>=', 50) },
        { reveal: 'utility', condition: and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 300)) },
      ],
      tags: [['school', 'millennium']],
      extra: extra.dict({ tier: extra.int(1) }),
    });
  });

  test('areas() 为整体替换而非追加', () => {
    const b = init('base:init:x').name('x').desc('x').areas('base:area:a');
    expect(b.build().defaultAreas).toEqual(['base:area:a']);
    b.areas('base:area:b');
    expect(b.build().defaultAreas).toEqual(['base:area:b']);
  });

  test('triggers() / tags() 为追加', () => {
    const t1: TriggerDef = { on: { kind: 'tick' }, effects: [] };
    const t2: TriggerDef = { on: { kind: 'area' }, effects: [] };
    const b = init('base:init:x').name('x').desc('x').triggers(t1).triggers(t2).tags(['a']);
    b.tags(['b']);
    expect(b.build().triggers).toEqual([t1, t2]);
    expect(b.build().tags).toEqual([['a'], ['b']]);
  });

  test('purchaseCost() 多条整体替换', () => {
    const b = init('base:init:x').name('x').desc('x').purchaseCost(r(CREDIT, 1), r('base:resource:pyroxene', 2));
    expect(b.build().purchaseCost).toEqual([{ resourceId: CREDIT, amount: 1 }, { resourceId: 'base:resource:pyroxene', amount: 2 }]);
  });

  test('未调用可选 setter 时 build() 不输出该字段', () => {
    const def = init('base:init:min').name('最小').desc('仅必填').areas('base:area:a').build();
    expect(def).not.toHaveProperty('purchaseCost');
    expect(def).not.toHaveProperty('triggers');
    expect(def).not.toHaveProperty('revealTriggers');
    expect(def).not.toHaveProperty('enterEffects');
    expect(def).not.toHaveProperty('startStoryId');
    expect(def).not.toHaveProperty('worldTilt');
  });

  test('reveal() 不带 condition 时缺省恒真', () => {
    const def = init('base:init:x').name('x').desc('x').areas().reveal('existence').build();
    expect(def.revealTriggers).toEqual([{ reveal: 'existence' }]);
  });

  test('onEnter* 构造 EntryEffectDef 变体', () => {
    const def = init('base:init:x').name('x').desc('x').areas()
      .onEnterWhen(and(), { op: 'setFlag', target: 'f', value: '1' })
      .build();
    expect(def.enterEffects![0]).toEqual({
      condition: { type: 'AND', conditions: [] },
      effects: [{ op: 'setFlag', target: 'f', value: '1' }],
    });
  });
});
