import { describe, it, expect } from 'vitest';
import { normalizeWorldTilt, compareWorldTilt, WORLD_TILT_TAIL_DIGITS } from '../../src/engine/world-tilt';

describe('normalizeWorldTilt', () => {
  it('尾数不足 15 位补 0', () => {
    expect(normalizeWorldTilt('0.98')).toBe('0.980000000000000');
    expect(normalizeWorldTilt('0.9')).toBe(`0.${'9'.padEnd(WORLD_TILT_TAIL_DIGITS, '0')}`);
  });

  it('无小数点时尾数为全 0', () => {
    expect(normalizeWorldTilt('1')).toBe('1.000000000000000');
    expect(normalizeWorldTilt('0')).toBe('0.000000000000000');
  });

  it('缺省 = 官方世界 1.0', () => {
    expect(normalizeWorldTilt(undefined)).toBe('1.000000000000000');
  });

  it('接受 number 书写', () => {
    expect(normalizeWorldTilt(0.95)).toBe('0.950000000000000');
    expect(normalizeWorldTilt(1)).toBe('1.000000000000000');
  });

  it('接受科学计数法', () => {
    expect(normalizeWorldTilt('1e-3')).toBe('0.001000000000000');
    expect(normalizeWorldTilt('1.5e-2')).toBe('0.015000000000000');
  });

  it('首位只能是 0 或 1', () => {
    expect(() => normalizeWorldTilt('2.5')).toThrow();
    expect(() => normalizeWorldTilt('.5')).toThrow();
    expect(() => normalizeWorldTilt('abc')).toThrow();
  });

  it('尾数超 15 位报错', () => {
    expect(() => normalizeWorldTilt('0.1234567890123456')).toThrow(/15 位/);
  });

  it('尾数非数字报错', () => {
    expect(() => normalizeWorldTilt('0.9a')).toThrow(/格式/);
  });
});

describe('compareWorldTilt', () => {
  it('定宽规范化串字典序 = 数值序', () => {
    expect(compareWorldTilt('1.000000000000000', '0.999000000000000')).toBe(1);
    expect(compareWorldTilt('0.980000000000000', '0.985000000000000')).toBe(-1);
    expect(compareWorldTilt('0.961300000000000', '0.961300000000000')).toBe(0);
  });

  it('15 位精度内可分辨', () => {
    expect(compareWorldTilt('0.999999999999999', '0.999999999999998')).toBe(1);
  });
});
