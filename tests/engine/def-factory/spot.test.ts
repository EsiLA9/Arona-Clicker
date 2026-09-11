// ============================================================
// engine/def-factory/spot.test.ts — Spot 链式 Builder
// .build() 必须产出标准 SpotDef（纯数据），字段语义与字面量等价。
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  Expr,
  and,
  cond,
  extra,
} from '../../../src/engine/types';
import { spot, SpotBuilder } from '../../../src/arona-clicker/content/def-factory/spot';
import { Resource } from '../../../src/arona-clicker/types/ids';
import type { SpotDef } from '../../../src/data-services/contracts/world';

const CREDIT = Resource.Credit;

describe('SpotBuilder', () => {
  test('spot() 返回 SpotBuilder 实例', () => {
    const b = spot('base:spot:x', 'base:area:a');
    expect(b).toBeInstanceOf(SpotBuilder);
  });

  test('build() 产出带默认值的最小 SpotDef', () => {
    const def = spot('base:spot:x', 'base:area:a').name('测试').desc('最小设施').build();
    expect(def).toEqual<SpotDef>({
      id: 'base:spot:x',
      areaId: 'base:area:a',
      name: '测试',
      description: '最小设施',
      baseCost: Expr.const(0),
      baseCostResource: CREDIT,
      baseYield: Expr.const(0),
      baseYieldResource: CREDIT,
      baseCapacity: 0,
      tags: [],
    });
  });

  test('缺 name / description 时 build() 抛错', () => {
    expect(() => spot('base:spot:x', 'base:area:a').build()).toThrow(/name/);
    expect(() => spot('base:spot:x', 'base:area:a').name('x').build()).toThrow(/description/);
  });

  test('复杂 Spot 全字段链式等价于字面量（field_work 参照）', () => {
    const built = spot('base:spot:field_work', 'base:area:schale_main')
      .name('野外调查站')
      .desc('阿比多斯风格的小型户外作业点，适合野外探索型学生。')
      .cost(20)
      .yield(8)
      .capacity(300)
      .tags(['field'], ['combat'])
      .revealResource('name', CREDIT, 10)
      .revealResource('utility', CREDIT, 40)
      .linearYieldWhen(
        'base:funclet:field_work_conditioned',
        CREDIT,
        1,
        and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>', 100)),
      )
      .levelUpTo(3)
      .genericUpgrade(80, 1.8, 1)
      .build();

    expect(built).toEqual<SpotDef>({
      id: 'base:spot:field_work',
      areaId: 'base:area:schale_main',
      name: '野外调查站',
      description: '阿比多斯风格的小型户外作业点，适合野外探索型学生。',
      baseCost: Expr.const(20),
      baseCostResource: CREDIT,
      baseYield: Expr.const(8),
      baseYieldResource: CREDIT,
      baseCapacity: 300,
      tags: [['field'], ['combat']],
      revealTriggers: [
        { reveal: 'name', condition: and(cond('resource', CREDIT, '>=', 10)) },
        { reveal: 'utility', condition: and(cond('resource', CREDIT, '>=', 40)) },
      ],
      functionalities: [
        {
          id: 'base:funclet:field_work_conditioned',
          kind: 'linearYield',
          resource: CREDIT,
          amountPerLevel: 1,
          condition: and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>', 100)),
        },
      ],
      levelUpgrades: [
        { level: 2, effects: [{ op: 'setSpotLevel', target: 'base:spot:field_work', value: '2' }] },
        { level: 3, effects: [{ op: 'setSpotLevel', target: 'base:spot:field_work', value: '3' }] },
      ],
      upgradeCostBase: 80,
      upgradeCostGrowth: 1.8,
      yieldPerLevel: 1,
    });
  });

  test('levelUpTo(maxLevel) 生成 2..maxLevel 的自我引用样板块', () => {
    const def = spot('base:spot:archive', 'base:area:schale_library')
      .name('卷宗整理台')
      .desc('分类整理联邦委托卷宗的工作台。')
      .cost(25).yield(6).capacity(280)
      .tags(['archive'], ['office'])
      .levelUpTo(3)
      .genericUpgrade(100, 1.8, 1)
      .build();
    expect(def.levelUpgrades).toEqual([
      { level: 2, effects: [{ op: 'setSpotLevel', target: 'base:spot:archive', value: '2' }] },
      { level: 3, effects: [{ op: 'setSpotLevel', target: 'base:spot:archive', value: '3' }] },
    ]);
  });

  test('功能糖方法构造 SpotFunctionalityDef 变体', () => {
    const def = spot('base:spot:x', 'base:area:a')
      .name('x').desc('x')
      .linearYield('f1', CREDIT, 2)
      .restartInit('f2')
      .hardResetInit('f3')
      .gacha('f4')
      .build();
    expect(def.functionalities).toEqual([
      { id: 'f1', kind: 'linearYield', resource: CREDIT, amountPerLevel: 2 },
      { id: 'f2', kind: 'restartInit' },
      { id: 'f3', kind: 'hardResetInit' },
      { id: 'f4', kind: 'gacha' },
    ]);
  });

  test('cost/yield 支持表达式与显式资源覆盖', () => {
    const expr = Expr.add(Expr.const(1), Expr.const(2));
    const def = spot('base:spot:x', 'base:area:a')
      .name('x').desc('x')
      .cost(expr, 'base:resource:pyroxene')
      .yield(5, 'base:resource:pyroxene')
      .build();
    expect(def.baseCost).toBe(expr);
    expect(def.baseCostResource).toBe('base:resource:pyroxene');
    expect(def.baseYield).toEqual(Expr.const(5));
    expect(def.baseYieldResource).toBe('base:resource:pyroxene');
  });

  test('gachaPools() 追加', () => {
    const def = spot('base:spot:x', 'base:area:a')
      .name('x').desc('x')
      .gacha('f')
      .gachaPools('base:gachapool:a', 'base:gachapool:b')
      .build();
    expect(def.gachaPools).toEqual(['base:gachapool:a', 'base:gachapool:b']);
  });

  test('maxLevel / global / extra / conditionText 输出', () => {
    const def = spot('base:spot:x', 'base:area:a')
      .name('x').desc('x')
      .maxLevel(10)
      .global()
      .conditionText('需要揭示')
      .extra(extra.dict({ tier: extra.int(2) }))
      .build();
    expect(def.maxLevel).toBe(10);
    expect(def.global).toBe(true);
    expect(def.conditionText).toBe('需要揭示');
    expect(def.extra).toEqual(extra.dict({ tier: extra.int(2) }));
  });

  test('未调用可选 setter 时不输出该字段', () => {
    const def = spot('base:spot:x', 'base:area:a').name('x').desc('x').build();
    expect(def).not.toHaveProperty('functionalities');
    expect(def).not.toHaveProperty('levelUpgrades');
    expect(def).not.toHaveProperty('revealTriggers');
    expect(def).not.toHaveProperty('upgradeCostBase');
    expect(def).not.toHaveProperty('gachaPools');
    expect(def).not.toHaveProperty('global');
    expect(def).not.toHaveProperty('maxLevel');
  });
});
