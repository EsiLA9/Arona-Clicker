import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/registry.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import { Registry } from '../../src/data-services/registry/registry';
import { } from '../../src/engine/types';
import { extra } from '../../src/engine/extra/index';

const sampleDatapack: Datapack = {
  name: 'test',
  version: '1.0.0',
  inits: [
    { id: 'test:init:init_a', name: 'Test Init', description: '', defaultAreas: ['test:area:area_1'] },
  ],
  areas: [
    { id: 'test:area:area_1', initId: 'test:init:init_a', name: 'Test Area', description: '', defaultSpots: ['test:spot:spot_1'] },
  ],
  spots: [
    {
      id: 'test:spot:spot_1', areaId: 'test:area:area_1', name: 'Test Spot', description: '',
      baseCost: { type: 'const', value: 10 },
      baseCostResource: 'credit',
      baseYield: { type: 'const', value: 5 },
      baseYieldResource: 'credit',
      baseCapacity: 100,
      managerBonusYield: { type: 'const', value: 2 },
      levelUpgrades: [],
      tags: [],
    },
  ],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
  characterBonuses: [],
};

describe('Registry', () => {
  test('should load a valid datapack', () => {
    const reg = new Registry();
    expect(() => reg.load(sampleDatapack)).not.toThrow();
    expect(reg.inits.get('test:init:init_a')).toBeDefined();
    expect(reg.areas.get('test:area:area_1')).toBeDefined();
    expect(reg.spots.get('test:spot:spot_1')).toBeDefined();
  });

  test('should reject duplicate IDs', () => {
    const reg = new Registry();
    const dp: Datapack = {
      ...sampleDatapack,
      inits: [
        { id: 'test:init:init_a', name: 'A', description: '', defaultAreas: [] },
        { id: 'test:init:init_a', name: 'A dup', description: '', defaultAreas: [] },
      ],
    };
    expect(() => reg.load(dp)).toThrow(/Duplicate/);
  });

  test('should reject broken references (area → unknown init)', () => {
    const reg = new Registry();
    const dp: Datapack = {
      ...sampleDatapack,
      inits: [],
    };
    expect(() => reg.load(dp)).toThrow(/unknown init/);
  });

  test('should reject broken references (spot → unknown area)', () => {
    const reg = new Registry();
    const dp: Datapack = {
      ...sampleDatapack,
      areas: [],
    };
    expect(() => reg.load(dp)).toThrow(/unknown area/);
  });

  test('should build relationship indices', () => {
    const reg = new Registry();
    reg.load(sampleDatapack);
    expect(reg.areasOfInit('test:init:init_a')).toEqual(['test:area:area_1']);
    expect(reg.spotsOfArea('test:area:area_1')).toEqual(['test:spot:spot_1']);
  });

  test('should index hierarchical tags with parent containing children', () => {
    const reg = new Registry();
    reg.load({
      ...sampleDatapack,
      spots: [
        { ...sampleDatapack.spots[0], id: 'test:spot:spot_1', tags: [['office'], ['field']] },
        { ...sampleDatapack.spots[0], id: 'test:spot:spot_2', tags: [['office', 'layout']] },
        { ...sampleDatapack.spots[0], id: 'test:spot:spot_3', tags: [['office', 'layout', 'desk']] },
      ],
    });
    // 查询 office：命中 office 及其所有 child（office/layout, office/layout/desk）
    expect(reg.spotsWithTag(['office'])).toEqual(expect.arrayContaining(['test:spot:spot_1', 'test:spot:spot_2', 'test:spot:spot_3']));
    // 查询 office/layout：命中自身与其 child，不含 spot_1
    expect(reg.spotsWithTag(['office', 'layout'])).toEqual(expect.arrayContaining(['test:spot:spot_2', 'test:spot:spot_3']));
    expect(reg.spotsWithTag(['office', 'layout'])).not.toContain('test:spot:spot_1');
    // 查询叶子：仅 spot_3
    expect(reg.spotsWithTag(['office', 'layout', 'desk'])).toEqual(['test:spot:spot_3']);
  });

  test('should clear all data', () => {
    const reg = new Registry();
    reg.load(sampleDatapack);
    reg.clear();
    expect(reg.inits.size).toBe(0);
    expect(reg.areas.size).toBe(0);
    expect(reg.spots.size).toBe(0);
  });

  test('should merge multiple datapacks', () => {
    const reg = new Registry();
    reg.load(sampleDatapack);
    reg.load({
      name: 'extension',
      version: '1.0.0',
      inits: [
        { id: 'test:init:init_b', name: 'Init B', description: '', defaultAreas: [] },
      ],
      areas: [],
      spots: [],
      enhancements: [],
      activeStories: [],
      passiveStories: [],
      stories: [],
      items: [],
      funcletDefs: [],
      characters: [],
      characterBonuses: [],
    });
    expect(reg.inits.size).toBe(2);
  });

  test('should merge datapack extras into a flat-key expanded tree', () => {
    const reg = new Registry();
    reg.load({
      ...sampleDatapack,
      extras: {
        'meta/author': extra.str('tester'),
        'balance/start': extra.int(10),
        'balance/nested/tax': extra.float(0.1),
      },
    });
    expect(reg.extras).toEqual(
      extra.dict({
        meta: extra.dict({ author: extra.str('tester') }),
        balance: extra.dict({
          start: extra.int(10),
          nested: extra.dict({ tax: extra.float(0.1) }),
        }),
      }),
    );
    expect(reg.getExtra('balance/start')).toEqual(extra.int(10));
    expect(reg.getExtra('meta/nope')).toBeUndefined();
  });

  test('should deep-merge extras from multiple datapacks (later overrides leaves)', () => {
    const reg = new Registry();
    reg.load({
      ...sampleDatapack,
      extras: { 'meta/author': extra.str('tester'), 'meta/debug': extra.bool(false) },
    });
    reg.load({
      ...sampleDatapack,
      extras: { 'meta/author': extra.str('override'), 'balance/start': extra.int(99) },
    });
    expect(reg.getExtra('meta/author')).toEqual(extra.str('override'));
    expect(reg.getExtra('meta/debug')).toEqual(extra.bool(false));
    expect(reg.getExtra('balance/start')).toEqual(extra.int(99));
  });

  test('should reject flat-key conflicts in datapack extras', () => {
    const reg = new Registry();
    const dp: Datapack = {
      ...sampleDatapack,
      extras: {
        'meta': extra.int(1),
        'meta/author': extra.str('tester'),
      },
    };
    expect(() => reg.load(dp)).toThrow(/Invalid datapack extras/);
  });

  test('should reject invalid Def-level extra', () => {
    const reg = new Registry();
    const dp: Datapack = {
      ...sampleDatapack,
      spots: [
        {
          ...sampleDatapack.spots[0],
          // 外层必须是 dict（ExtraCompound 类型约束）；内层 int 非整数 → 运行时校验拒绝
          extra: { t: 'dict', v: { phase: { t: 'int', v: 1.5 } } },
        },
      ],
    };
    expect(() => reg.load(dp)).toThrow(/Invalid extra on spot/);
  });

  test('should clear extras on clear()', () => {
    const reg = new Registry();
    reg.load({ ...sampleDatapack, extras: { 'meta/author': extra.str('tester') } });
    reg.clear();
    expect(reg.extras).toEqual(extra.dict({}));
  });

  test('should load tag defs and expose them', () => {
    const reg = new Registry();
    reg.load({
      ...sampleDatapack,
      tags: [
        { id: 'office', name: '办公室', description: '行政与布局设施' },
        { id: 'office/defense', name: '防御部', description: '驻防设施' },
      ],
    });
    expect(reg.tagDefs.size).toBe(2);
    expect(reg.tagDefs.get('office')?.name).toBe('办公室');
  });

  test('should resolve tag name by exact match, else inherit from parent', () => {
    const reg = new Registry();
    reg.load({
      ...sampleDatapack,
      tags: [
        { id: 'office', name: '办公室', description: '行政与布局设施' },
        { id: 'office/defense', name: '防御部' },
      ],
    });
    // 精确命中
    expect(reg.tagName(['office'])).toBe('办公室');
    expect(reg.tagName(['office', 'defense'])).toBe('防御部');
    // 未定义子 tag：沿路径向上继承父定义
    expect(reg.tagName(['office', 'defense', 'desk'])).toBe('防御部');
    expect(reg.tagDescription(['office', 'defense', 'desk'])).toBeUndefined();
    // 无任何定义：回退路径串
    expect(reg.tagName(['millennium'])).toBe('millennium');
  });

  test('should merge tag defs across datapacks (later overrides)', () => {
    const reg = new Registry();
    reg.load({
      ...sampleDatapack,
      tags: [{ id: 'office', name: '办公室', description: 'v1' }],
    });
    reg.load({
      ...sampleDatapack,
      tags: [{ id: 'office', name: '办公区' }, { id: 'field', name: '野外' }],
    });
    expect(reg.tagName(['office'])).toBe('办公区');
    expect(reg.tagName(['field'])).toBe('野外');
  });

  test('should reject duplicate tag ids', () => {
    const reg = new Registry();
    const dp: Datapack = {
      ...sampleDatapack,
      tags: [
        { id: 'office', name: 'A' },
        { id: 'office', name: 'B' },
      ],
    };
    expect(() => reg.load(dp)).toThrow(/Duplicate/);
  });
});
