// ============================================================
// engine/def-factory/enhancement.test.ts — Enhancement 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  enhancement,
  EnhancementBuilder,
  extra,
  r,
  Resource,
} from '../../../src/engine/types';
import type { EnhancementDef } from '../../../src/engine/types';

const CREDIT = Resource.Credit;

describe('EnhancementBuilder', () => {
  test('enhancement() 返回 EnhancementBuilder 实例', () => {
    expect(enhancement('base:enh:x')).toBeInstanceOf(EnhancementBuilder);
  });

  test('build() 产出最小 EnhancementDef（autoApply 缺省 false / effects 空）', () => {
    const def = enhancement('base:enh:x').name('测试').desc('测试').build();
    expect(def).toEqual<EnhancementDef>({
      id: 'base:enh:x',
      name: '测试',
      description: '测试',
      effects: [],
      autoApply: false,
    });
  });

  test('缺 name / description 时 build() 抛错', () => {
    expect(() => enhancement('base:enh:x').build()).toThrow(/name/);
    expect(() => enhancement('base:enh:x').name('x').build()).toThrow(/description/);
  });

  test('全字段链式等价于字面量（field_logistics 参照）', () => {
    const def = enhancement('base:enh:field_logistics')
      .name('野外后勤协议')
      .desc('field / combat / tactical 标签 Spot 产出 ×1.35；并为其注入「重启进程」外源功能。')
      .tags(['field'], ['field', 'logistics'])
      .affectorPack('base:pack:field_logistics_mult')
      .cost(CREDIT, 200)
      .addsFunctionality({ id: 'restart', kind: 'restartInit' })
      .build();
    expect(def).toEqual<EnhancementDef>({
      id: 'base:enh:field_logistics',
      name: '野外后勤协议',
      description: 'field / combat / tactical 标签 Spot 产出 ×1.35；并为其注入「重启进程」外源功能。',
      tags: [['field'], ['field', 'logistics']],
      affectorPackIds: ['base:pack:field_logistics_mult'],
      price: [{ resourceId: CREDIT, amount: 200 }],
      autoApply: false,
      effects: [],
      addsFunctionalities: [{ id: 'restart', kind: 'restartInit' }],
    });
  });

  test('affectorPackIds 追加语义', () => {
    const def = enhancement('base:enh:pyroxene_rush')
      .name('燧石速采').desc('全局燧石产出 ×1.8；并额外 +1 燧石/分钟。')
      .tags(['field'])
      .affectorPacks('base:pack:pyroxene_flow', 'base:pack:pyroxene_rush_mult')
      .price(r('base:resource:pyroxene', 20))
      .build();
    expect(def.affectorPackIds).toEqual(['base:pack:pyroxene_flow', 'base:pack:pyroxene_rush_mult']);
    expect(def.price).toEqual([{ resourceId: 'base:resource:pyroxene', amount: 20 }]);
  });

  test('autoApply / maxStacks / attachment / reveal / extra 输出', () => {
    const def = enhancement('base:enh:x')
      .name('x').desc('x')
      .autoApply()
      .maxStacks(3)
      .attachArea('base:area:a')
      .reveal('name')
      .extra(extra.dict({ tier: extra.int(1) }))
      .build();
    expect(def.autoApply).toBe(true);
    expect(def.maxStacks).toBe(3);
    expect(def.attachment).toEqual({ kind: 'area', areaId: 'base:area:a' });
    expect(def.revealTriggers).toEqual([{ reveal: 'name' }]);
    expect(def.extra).toEqual(extra.dict({ tier: extra.int(1) }));
  });

  test('未调用可选 setter 时不输出该字段', () => {
    const def = enhancement('base:enh:x').name('x').desc('x').build();
    expect(def).not.toHaveProperty('price');
    expect(def).not.toHaveProperty('tags');
    expect(def).not.toHaveProperty('affectorPackIds');
    expect(def).not.toHaveProperty('attachment');
    expect(def).not.toHaveProperty('maxStacks');
  });
});
