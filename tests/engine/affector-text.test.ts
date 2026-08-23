// ============================================================
// engine/affector-text.test.ts — Affector 通用展示文本
// 覆盖：全部 EffectOp 分支、ValueExpression / ExtraValue 渲染、
// entry 条件前缀、pack 多行、穷尽性（新增 op 编译失败）。
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  describeEffect,
  describeAffectorEntry,
  describeAffectorPack,
  describeValueExpression,
  describeExtraValue,
} from '../../src/engine/affector-text';
import type { Effect, EffectOp } from '../../src/engine/types';

const nameOf = (type: string, id: string): string => {
  const table: Record<string, string> = {
    'resource:base:resource:credit': '信用点',
    'spot:base:spot:credit_printer': '信用点制造机',
    'character:arona': '阿罗娜',
    'enh:base:enh:x': '神秘强化',
    'item:base:item:x': '能量饮料',
    'init:base:init:abydos': '阿比多斯',
    'story:base:story:x': '深夜的夏莱',
    'area:base:area:x': '教室',
  };
  return table[`${type}:${id}`] ?? id;
};

const eff = (op: EffectOp, target = '', value: Effect['value'] = 1): Effect =>
  ({ op, target, value } as Effect);

describe('describeEffect 全 op 覆盖', () => {
  test('资源类', () => {
    expect(describeEffect(eff('addResource', 'base:resource:credit', 3), nameOf)).toBe('每 Tick 信用点 +3');
    expect(describeEffect(eff('setResource', 'base:resource:credit', 10), nameOf)).toBe('信用点 设为 10');
  });

  test('设施与经理', () => {
    expect(describeEffect(eff('addSpotLevel', 'base:spot:credit_printer', 2), nameOf)).toBe('信用点制造机 等级 +2');
    expect(describeEffect(eff('setSpotLevel', 'base:spot:credit_printer'), nameOf)).toBe('信用点制造机 等级设为 1');
    expect(describeEffect(eff('setManager', 'base:spot:credit_printer', 'arona'), nameOf)).toBe('指派 阿罗娜 至 信用点制造机');
    expect(describeEffect(eff('setSpotMaxLevel', 'base:spot:credit_printer', 5), nameOf)).toBe('信用点制造机 等级上限 → 5');
    expect(describeEffect(eff('removeSpotMaxLevel', 'base:spot:credit_printer'), nameOf)).toBe('解除 信用点制造机 等级上限');
  });

  test('获取/解锁/剧情/标记/掉落/移动', () => {
    expect(describeEffect(eff('addEnhancement', '', 'base:enh:x'), nameOf)).toBe('获得强化「神秘强化」');
    expect(describeEffect(eff('addItem', 'base:item:x', 3), nameOf)).toBe('获得物品 能量饮料 ×3');
    expect(describeEffect(eff('unlockInit', '', 'base:init:abydos'), nameOf)).toBe('解锁世界线 阿比多斯');
    expect(describeEffect(eff('triggerStory', '', 'base:story:x'), nameOf)).toBe('触发剧情 深夜的夏莱');
    expect(describeEffect(eff('setFlag', 'night_mode', '1'), nameOf)).toBe('标记 night_mode = 1');
    expect(describeEffect(eff('loot', 'base:droptable:x'), nameOf)).toBe('触发掉落表 base:droptable:x');
    expect(describeEffect(eff('travelToArea', 'base:area:x'), nameOf)).toBe('移动至区域 教室');
  });

  test('Extra 类（字面量与结构化值）', () => {
    expect(describeEffect(eff('setExtra', 'meta/rank', { t: 'int', v: 7 }), nameOf)).toBe('设置数据 meta/rank = 7');
    expect(describeEffect(eff('addExtra', 'meta/score', 5), nameOf)).toBe('数据 meta/score +5');
    expect(describeEffect(eff('removeExtra', 'meta/tmp'), nameOf)).toBe('移除数据 meta/tmp');
    expect(
      describeEffect(eff('setExtra', 'meta/cfg', { t: 'dict', v: { a: { t: 'str', v: 'x' }, b: { t: 'list', v: [{ t: 'bool', v: true }] } } }), nameOf),
    ).toBe('设置数据 meta/cfg = {a: x, b: [true]}');
  });
});

describe('describeValueExpression / describeExtraValue', () => {
  test('const 与 mul 组合', () => {
    expect(describeValueExpression({ type: 'const', value: 5 }, nameOf)).toBe('5');
    expect(describeValueExpression({
      type: 'mul',
      left: { type: 'value', value: { type: 'value', source: 'res', params: { resource: 'base:resource:credit' } } },
      right: { type: 'const', value: 2 },
    }, nameOf)).toBe('信用点×2');
  });

  test('各 Value source 的可读名', () => {
    const val = (source: never, params: Record<string, string | number>): Parameters<typeof describeValueExpression>[0] =>
      ({ type: 'value', value: { type: 'value', source, params } } as never);
    expect(describeValueExpression(val('spotLevel' as never, { spot: 'base:spot:credit_printer' }), nameOf))
      .toBe('信用点制造机等级');
    expect(describeValueExpression(val('spotCount' as never, { area: 'base:area:x' }), nameOf))
      .toBe('教室设施数');
    expect(describeValueExpression(val('managerCount' as never, { init: 'base:init:abydos' }), nameOf))
      .toBe('阿比多斯经理数');
    expect(describeValueExpression(val('data' as never, { path: 'meta/rank' }), nameOf))
      .toBe('数据 meta/rank');
    expect(describeValueExpression(val('funclet' as never, { funclet: 'f1' }), nameOf))
      .toBe('函数 f1(...)');

    expect(describeExtraValue({ t: 'float', v: 1.5 })).toBe('1.5');
    expect(describeExtraValue({ t: 'str', v: 'hi' })).toBe('hi');
    expect(describeExtraValue({ t: 'bool', v: false })).toBe('false');
  });
});

describe('describeAffectorEntry / describeAffectorPack', () => {
  test('条件前缀与多效果拼接；无条件无前缀', () => {
    const withCond = describeAffectorEntry(
      {
        condition: { type: 'AND', conditions: [{ target: 'flag', key: 'night_mode', comparator: '==', value: 1 }] },
        effects: [eff('addItem', 'base:item:x', 1), eff('addResource', 'base:resource:credit', 2)],
      },
      nameOf,
      { describeCondition: cond => `flag ${JSON.stringify(cond.conditions[0])}` },
    );
    expect(withCond).toContain('【flag');
    expect(withCond).toContain('】获得物品 能量饮料 ×1；每 Tick 信用点 +2');

    const noCond = describeAffectorEntry(
      { effects: [eff('addResource', 'base:resource:credit', 1)] },
      nameOf,
    );
    expect(noCond).toBe('每 Tick 信用点 +1');
    expect(noCond).not.toContain('【');
  });

  test('空效果 entry 显示占位；pack 输出逐行', () => {
    expect(describeAffectorEntry({ effects: [] }, nameOf)).toBe('(无效果)');
    const lines = describeAffectorPack(
      {
        entries: [
          { id: 'a', effects: [eff('addItem', 'base:item:x')] },
          { id: 'b', condition: { type: 'AND', conditions: [{ target: 'flag', key: 'f', comparator: '==', value: 1 }] }, effects: [] },
        ],
      },
      nameOf,
      { describeCondition: () => '需要 flag f' },
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('获得物品 能量饮料 ×1');
    expect(lines[1]).toBe('【需要 flag f】(无效果)');
  });
});
