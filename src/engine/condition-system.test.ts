// ============================================================
// engine/condition-system.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import { ConditionSystem } from './condition-system';
import { PlayerState, Condition, ConditionGroup, cond, and, or } from './types';
import { extra } from './extra';

function defaultState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    resources: { credit: 100 },
    spotLevels: { spot_a: 5, spot_b: 0 },
    spotManagers: {},
    unlockedEnhancements: ['enh_speed'],
    activeInit: '',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: { tutorial_done: 'true' },
    unlockedInits: [],
    ...overrides,
  };
}

describe('ConditionSystem', () => {
  const cs = new ConditionSystem();

  test('should evaluate resource condition ==', () => {
    expect(cs.evaluate(cond('resource', 'credit', '==', 100), defaultState())).toBe(true);
    expect(cs.evaluate(cond('resource', 'credit', '==', 50), defaultState())).toBe(false);
  });

  test('should evaluate resource condition >=', () => {
    expect(cs.evaluate(cond('resource', 'credit', '>=', 100), defaultState())).toBe(true);
    expect(cs.evaluate(cond('resource', 'credit', '>=', 101), defaultState())).toBe(false);
  });

  test('should evaluate resource condition <', () => {
    expect(cs.evaluate(cond('resource', 'credit', '<', 200), defaultState())).toBe(true);
    expect(cs.evaluate(cond('resource', 'credit', '<', 100), defaultState())).toBe(false);
  });

  test('should evaluate spotLevel condition', () => {
    expect(cs.evaluate(cond('spotLevel', 'spot_a', '>=', 5), defaultState())).toBe(true);
    expect(cs.evaluate(cond('spotLevel', 'spot_a', '>=', 6), defaultState())).toBe(false);
    expect(cs.evaluate(cond('spotLevel', 'spot_b', '==', 0), defaultState())).toBe(true);
  });

  test('should evaluate hasEnh condition', () => {
    expect(cs.evaluate(cond('hasEnh', 'enh_speed', '==', 1), defaultState())).toBe(true);
    expect(cs.evaluate(cond('hasEnh', 'enh_unknown', '==', 1), defaultState())).toBe(false);
  });

  test('should evaluate flag condition', () => {
    expect(cs.evaluate(cond('flag', 'tutorial_done', '==', 1), defaultState())).toBe(true);
  });

  test('should evaluate AND group', () => {
    const group = and(
      cond('resource', 'credit', '>=', 50),
      cond('spotLevel', 'spot_a', '>=', 3),
    );
    expect(cs.evaluateGroup(group, defaultState())).toBe(true);
  });

  test('should evaluate AND group — false when one fails', () => {
    const group = and(
      cond('resource', 'credit', '>=', 50),
      cond('resource', 'credit', '>=', 200),
    );
    expect(cs.evaluateGroup(group, defaultState())).toBe(false);
  });

  test('should evaluate OR group', () => {
    const group = or(
      cond('resource', 'credit', '>=', 200),
      cond('resource', 'credit', '==', 100),
    );
    expect(cs.evaluateGroup(group, defaultState())).toBe(true);
  });

  test('should evaluate OR group — false when all fail', () => {
    const group = or(
      cond('resource', 'credit', '>=', 200),
      cond('resource', 'credit', '>=', 300),
    );
    expect(cs.evaluateGroup(group, defaultState())).toBe(false);
  });

  test('should support nested ConditionGroups', () => {
    const group = and(
      cond('resource', 'credit', '>=', 10),
      or(
        cond('spotLevel', 'spot_a', '>=', 10),
        cond('hasEnh', 'enh_speed', '==', 1),
      ),
    );
    expect(cs.evaluateGroup(group, defaultState())).toBe(true);
  });

  // --- evaluateExpr：Trigger 可直接监听单条原子条件，也可传入条件组 ---
  test('should evaluateExpr accept a single atomic condition', () => {
    expect(cs.evaluateExpr(cond('resource', 'credit', '>=', 100), defaultState())).toBe(true);
    expect(cs.evaluateExpr(cond('resource', 'credit', '>=', 200), defaultState())).toBe(false);
  });

  test('should evaluateExpr accept a condition group', () => {
    const group = and(
      cond('resource', 'credit', '>=', 50),
      cond('spotLevel', 'spot_a', '>=', 3),
    );
    expect(cs.evaluateExpr(group, defaultState())).toBe(true);
    expect(cs.evaluateExpr(or(cond('resource', 'credit', '>=', 999), cond('hasEnh', 'enh_speed', '==', 1)), defaultState())).toBe(true);
  });

  test('should handle unknown comparator gracefully', () => {
    const c: Condition = { target: 'resource', key: 'credit', comparator: '??' as any, value: 100 };
    expect(cs.evaluate(c, defaultState())).toBe(false);
  });

  // --- 标签条件（hasTag / countTags）---
  test('should count owned spots by hierarchical tag', () => {
    const tagCs = new ConditionSystem();
    // 模拟 registry 的层级标签索引：office 含 office/* 的 spot
    tagCs.setTagIndex(tag => {
      const key = tag.join('/');
      if (key === 'office') return ['spot_a', 'spot_b', 'spot_c'];
      if (key === 'office/layout') return ['spot_b'];
      return [];
    });
    const state = defaultState({ spotLevels: { spot_a: 1, spot_b: 1, spot_c: 0 } });

    // countTags：只统计已拥有的（spot_c 未拥有不计数）
    expect(tagCs.evaluate(cond('countTags', 'office', '==', 2), state)).toBe(true);
    expect(tagCs.evaluate(cond('countTags', 'office', '>=', 3), state)).toBe(false);

    // hasTag：value=1 存在即真，value=0 不存在即真
    expect(tagCs.evaluate(cond('hasTag', 'office', '==', 1), state)).toBe(true);
    expect(tagCs.evaluate(cond('hasTag', 'office/layout', '==', 0), state)).toBe(false);
    expect(tagCs.evaluate(cond('hasTag', 'nonexistent', '==', 0), state)).toBe(true);
  });

  // --- Extra 目标（M4）---
  test('should evaluate extra condition via injected extra reader (int/float)', () => {
    const extraCs = new ConditionSystem();
    extraCs.setExtraReader(path => {
      if (path === 'meta/kills') return extra.int(5);
      if (path === 'meta/rate') return extra.float(0.5);
      return undefined;
    });
    const state = defaultState();
    expect(extraCs.evaluate(cond('extra', 'meta/kills', '>=', 5), state)).toBe(true);
    expect(extraCs.evaluate(cond('extra', 'meta/kills', '>=', 6), state)).toBe(false);
    expect(extraCs.evaluate(cond('extra', 'meta/rate', '==', 0.5), state)).toBe(true);
  });

  test('should treat missing extra as 0 and bool as 1/0', () => {
    const extraCs = new ConditionSystem();
    extraCs.setExtraReader(path => (path === 'meta/flag' ? extra.bool(true) : undefined));
    const state = defaultState();
    expect(extraCs.evaluate(cond('extra', 'meta/missing', '==', 0), state)).toBe(true);
    expect(extraCs.evaluate(cond('extra', 'meta/flag', '==', 1), state)).toBe(true);
  });
});
