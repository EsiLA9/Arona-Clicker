/**
 * validate/extra.test.ts —— Extra 树结构与 ID 格式校验单测
 */
import { describe, expect, it } from 'vitest';
import { validateDatapack } from './index';
import { validateExtraValue, isExtraValue } from './extra';

function messages(data: Record<string, unknown>, opts?: { checkIds?: boolean }): string[] {
  return validateDatapack(data, opts).map((e) => e.message);
}

describe('Extra 树校验', () => {
  it('合法节点通过', () => {
    const data = {
      extras: {
        a: { t: 'str', v: 'hi' },
        b: { t: 'num', v: 3.14 },
        c: { t: 'bool', v: true },
        d: { t: 'null', v: null },
        e: { t: 'list', v: [{ t: 'str', v: 'x' }, { t: 'num', v: 1 }] },
        f: { t: 'dict', v: { nested: { t: 'str', v: 'y' } } },
      },
    };
    expect(messages(data)).toEqual([]);
  });

  it('非法标签 / 类型不匹配报错', () => {
    const data = {
      extras: {
        a: { t: 'str', v: 123 },
        b: { t: 'unknown', v: null },
        c: { t: 'list', v: 'not-array' },
        d: { t: 'dict', v: [1] },
      },
    };
    const msgs = messages(data);
    expect(msgs.some((m) => m.includes('应为字符串'))).toBe(true);
    expect(msgs.some((m) => m.includes('非法标签'))).toBe(true);
    expect(msgs.some((m) => m.includes('应为 ExtraValue[]'))).toBe(true);
    expect(msgs.some((m) => m.includes('应为 Record'))).toBe(true);
  });

  it('非 {t,v} 节点报错', () => {
    const data = { extras: { a: 'plain' } };
    expect(messages(data).some((m) => m.includes('应为 {t, v} 节点'))).toBe(true);
  });

  it('其他表 extra 字段同样校验', () => {
    const data = {
      spots: [
        {
          id: 'base:spot:test',
          areaId: 'base:area:test',
          name: 'T',
          description: 'd',
          baseCost: { type: 'const', value: 1 },
          baseCostResource: 'base:resource:credit',
          baseYield: { type: 'const', value: 1 },
          baseYieldResource: 'base:resource:credit',
          baseCapacity: 1,
          extra: { t: 'dict', v: { x: { t: 'num', v: 'oops' } } },
        },
      ],
    };
    const msgs = messages(data);
    expect(msgs.some((m) => m.includes('extra.v.x.v 应为数值'))).toBe(true);
  });

  it('isExtraValue 判定', () => {
    expect(isExtraValue({ t: 'str', v: 'a' })).toBe(true);
    expect(isExtraValue({ v: 'a' })).toBe(false);
    expect(isExtraValue('a')).toBe(false);
  });

  it('validateExtraValue 直接调用', () => {
    const issues: { path: string; message: string }[] = [];
    validateExtraValue({ t: 'num', v: 'bad' }, 'extras.x', issues as never, 'extras');
    expect(issues[0].message).toContain('应为数值');
  });
});

describe('ID 三段式格式', () => {
  it('合法 id 通过', () => {
    const data = {
      spots: [
        {
          id: 'base:spot:printer',
          areaId: 'base:area:test',
          name: 'T',
          description: 'd',
          baseCost: { type: 'const', value: 1 },
          baseCostResource: 'base:resource:credit',
          baseYield: { type: 'const', value: 1 },
          baseYieldResource: 'base:resource:credit',
          baseCapacity: 1,
        },
      ],
    };
    expect(messages(data)).toEqual([]);
  });

  it('非法 id 报错', () => {
    const data = { spots: [{ id: 'base:spot' }, { id: 'printer' }, { id: 'BASE:spot:printer' }] };
    const msgs = messages(data);
    expect(msgs.filter((m) => m.includes('三段式')).length).toBeGreaterThanOrEqual(2);
  });

  it('字符表（resourceDisplays）允许单段 id', () => {
    const data = { resourceDisplays: [{ resourceId: 'base:resource:credit', label: '信用点', order: 1 }] };
    expect(messages(data)).toEqual([]);
  });
});
