import { describe, expect, it } from 'vitest';
import { parseGradient, serializeGradient, updateGradient } from '../../src/ui/theme-layer-value';

describe('theme layer CSS value parser', () => {
  it('保留线性渐变方向、多个色标与位置', () => {
    const parsed = parseGradient('linear-gradient(135deg, #eff6ff 0%, #93c5fd 48%, #1d4ed8 100%)');
    expect(parsed).toEqual({
      type: 'linear',
      direction: '135deg',
      stops: [
        { color: '#eff6ff', position: '0%' },
        { color: '#93c5fd', position: '48%' },
        { color: '#1d4ed8', position: '100%' },
      ],
    });
    expect(serializeGradient(parsed!)).toBe('linear-gradient(135deg, #eff6ff 0%, #93c5fd 48%, #1d4ed8 100%)');
    expect(updateGradient(parsed ? serializeGradient(parsed) : '', { stopIndex: 1, stopColor: '#22d3ee', stopPosition: '52%' })).toBe('linear-gradient(135deg, #eff6ff 0%, #22d3ee 52%, #1d4ed8 100%)');
  });

  it('解析 theme-showcase-glow 的径向参数和透明结束色', () => {
    const value = 'radial-gradient(circle at 78% 18%, #ffffff 0%, transparent 46%)';
    expect(parseGradient(value)).toEqual({
      type: 'radial',
      shape: 'circle',
      centerX: '78%',
      centerY: '18%',
      stops: [{ color: '#ffffff', position: '0%' }, { color: 'transparent', position: '46%' }],
    });
    expect(updateGradient(value, { centerX: '60%', startColor: '#fef08a' })).toBe('radial-gradient(circle at 60% 18%, #fef08a 0%, transparent 46%)');
  });

  it('重复径向渐变不会降级成普通渐变', () => {
    const parsed = parseGradient('repeating-radial-gradient(ellipse at 50% 50%, #fff 0%, transparent 20%)');
    expect(parsed?.type).toBe('repeating-radial');
    expect(serializeGradient(parsed!)).toBe('repeating-radial-gradient(ellipse at 50% 50%, #fff 0%, transparent 20%)');
  });

  it('省略方向的渐变修改后仍不注入伪造方向', () => {
    const raw = 'linear-gradient(#fff, #def)';
    const parsed = parseGradient(raw)!;
    expect(parsed.direction).toBeUndefined();
    expect(updateGradient(raw, { startColor: '#000' })).toBe('linear-gradient(#000, #def)');
  });

  it('不支持的 CSS 渐变不会被解析器静默改写', () => {
    const raw = 'conic-gradient(from 90deg, #fff, #000)';
    expect(parseGradient(raw)).toBeUndefined();
    expect(updateGradient(raw, { startColor: '#f00' })).toBe(raw);
  });
});
