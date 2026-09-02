// ============================================================
// engine/value-system.test.ts
// ============================================================
import { describe, test, expect } from 'vitest';
import { ValueSystem } from '../../src/engine/expression/value-system';
import { ValueExpression, Expr, value, } from '../../src/engine/types';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';
import { extra } from '../../src/engine/extra/index';

function defaultState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    resources: { credit: 100 },
    spotLevels: { spot_a: 3, spot_b: 0 },
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: '',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: {},
    unlockedInits: [],
    ...overrides,
  };
}

describe('ValueSystem', () => {
  const vs = new ValueSystem();

  test('should evaluate const expression', () => {
    expect(vs.evaluate(Expr.const(42), defaultState())).toBe(42);
  });

  test('should evaluate resource value', () => {
    const expr: ValueExpression = Expr.val(value('res', { resource: 'credit' }));
    expect(vs.evaluate(expr, defaultState())).toBe(100);
  });

  test('should return 0 for missing resource', () => {
    const expr: ValueExpression = Expr.val(value('res', { resource: 'pyroxene' }));
    expect(vs.evaluate(expr, defaultState())).toBe(0);
  });

  test('should evaluate spotLevel value', () => {
    const expr: ValueExpression = Expr.val(value('spotLevel', { spot: 'spot_a' }));
    expect(vs.evaluate(expr, defaultState())).toBe(3);
  });

  test('should return 0 for unleveled spot', () => {
    const expr: ValueExpression = Expr.val(value('spotLevel', { spot: 'spot_b' }));
    expect(vs.evaluate(expr, defaultState())).toBe(0);
  });

  test('should evaluate data value via injected extra reader', () => {
    const vs2 = new ValueSystem();
    vs2.setExtraReader(path => (path === 'meta/softCap' ? extra.int(50) : undefined));
    const expr: ValueExpression = Expr.val(value('data', { path: 'meta/softCap' }));
    expect(vs2.evaluate(expr, defaultState())).toBe(50);
  });

  test('should coerce data value like toNumber (bool→1, str→0, float→float)', () => {
    const vs2 = new ValueSystem();
    vs2.setExtraReader(path => {
      switch (path) {
        case 'meta/flag':
          return extra.bool(true);
        case 'meta/title':
          return extra.str('x');
        case 'meta/rate':
          return extra.float(0.5);
        default:
          return undefined;
      }
    });
    const state = defaultState();
    expect(vs2.evaluate(Expr.val(value('data', { path: 'meta/flag' })), state)).toBe(1);
    expect(vs2.evaluate(Expr.val(value('data', { path: 'meta/title' })), state)).toBe(0);
    expect(vs2.evaluate(Expr.val(value('data', { path: 'meta/rate' })), state)).toBe(0.5);
    expect(vs2.evaluate(Expr.val(value('data', { path: 'meta/missing' })), state)).toBe(0);
  });

  test('should default data reader to 0 when not injected', () => {
    const expr: ValueExpression = Expr.val(value('data', { path: 'meta/softCap' }));
    expect(vs.evaluate(expr, defaultState())).toBe(0);
  });
});
