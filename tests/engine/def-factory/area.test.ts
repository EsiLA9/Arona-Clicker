// ============================================================
// engine/def-factory/area.test.ts — Area 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import { area, AreaBuilder, Resource, cond, and } from '../../../src/engine/types';
import type { AreaDef } from '../../../src/engine/types';

const CREDIT = Resource.Credit;

describe('AreaBuilder', () => {
  test('area() 返回 AreaBuilder 实例', () => {
    expect(area('base:area:a', 'base:init:i')).toBeInstanceOf(AreaBuilder);
  });

  test('build() 产出最小 AreaDef（defaultSpots 缺省空）', () => {
    const def = area('base:area:a', 'base:init:i').name('区域').desc('描述').build();
    expect(def).toEqual<AreaDef>({
      id: 'base:area:a',
      initId: 'base:init:i',
      name: '区域',
      description: '描述',
      defaultSpots: [],
    });
  });

  test('缺 name / description 时 build() 抛错', () => {
    expect(() => area('a', 'i').build()).toThrow(/name/);
    expect(() => area('a', 'i').name('x').build()).toThrow(/description/);
  });

  test('全字段链式等价于字面量（abydos_pool 参照）', () => {
    const def = area('base:area:abydos_pool', 'base:init:abydos')
      .name('废弃泳池')
      .desc('早已干涸的露天泳池。如今堆满器材，偶尔被学生们当作训练场。')
      .spots('base:spot:pool_train')
      .adjacent('base:area:abydos_campus')
      .theme('base:group:abydos-sand', { playerBubble: '#3ec6e0' })
      .build();
    expect(def).toEqual<AreaDef>({
      id: 'base:area:abydos_pool',
      initId: 'base:init:abydos',
      name: '废弃泳池',
      description: '早已干涸的露天泳池。如今堆满器材，偶尔被学生们当作训练场。',
      defaultSpots: ['base:spot:pool_train'],
      adjacentAreaIds: ['base:area:abydos_campus'],
      theme: { colorGroupId: 'base:group:abydos-sand', tokens: { playerBubble: '#3ec6e0' } },
    });
  });

  test('revealResource / revealCredit / reveal 糖', () => {
    const def = area('base:area:h', 'base:init:o')
      .name('x').desc('x')
      .revealCredit('name', 80)
      .revealResource('utility', CREDIT, 40)
      .reveal('existence')
      .build();
    expect(def.revealTriggers).toEqual([
      { reveal: 'name', condition: and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 80)) },
      { reveal: 'utility', condition: and(cond('resource', CREDIT, '>=', 40)) },
      { reveal: 'existence' },
    ]);
  });

  test('onEnter* 构造 EntryEffectDef 变体', () => {
    const def = area('a', 'i').name('x').desc('x')
      .onEnter({ op: 'setFlag', target: 'f', value: '1' })
      .onEnterFirst({ op: 'addResource', target: CREDIT, value: 1 })
      .build();
    expect(def.enterEffects).toEqual([
      { effects: [{ op: 'setFlag', target: 'f', value: '1' }] },
      { first: true, effects: [{ op: 'addResource', target: CREDIT, value: 1 }] },
    ]);
  });

  test('未调用可选 setter 时不输出该字段', () => {
    const def = area('a', 'i').name('x').desc('x').build();
    expect(def).not.toHaveProperty('adjacentAreaIds');
    expect(def).not.toHaveProperty('theme');
    expect(def).not.toHaveProperty('revealTriggers');
    expect(def).not.toHaveProperty('enterEffects');
  });
});
