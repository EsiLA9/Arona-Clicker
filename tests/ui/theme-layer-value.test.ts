import { describe, expect, it } from 'vitest';
import { addGradientStop, convertGradientType, isGradientStopPosition, parseGradient, removeGradientStop, serializeGradient, updateGradient } from '../../src/ui/theme-layer-value';

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

  it('增删色标只改写色标集合，不改变方向与其余色标', () => {
    const value = 'linear-gradient(135deg, #6b8cff 0%, #dbeafe 100%)';
    const three = addGradientStop(value);
    expect(three).toBe('linear-gradient(135deg, #6b8cff 0%, #dbeafe 100%, #dbeafe)');
    expect(removeGradientStop(three, 0)).toBe('linear-gradient(135deg, #dbeafe 100%, #dbeafe)');
  });

  it('色标不足两个时不删除，无法解析的值原样返回', () => {
    const two = 'radial-gradient(circle at 50% 50%, #fff, transparent)';
    expect(removeGradientStop(two, 0)).toBe(two);
    expect(addGradientStop('conic-gradient(#fff, #000)')).toBe('conic-gradient(#fff, #000)');
    expect(removeGradientStop('conic-gradient(#fff, #000)', 0)).toBe('conic-gradient(#fff, #000)');
  });

  it('线性与径向互转保留色标并补齐方向或中心', () => {
    expect(convertGradientType('linear-gradient(135deg, #fff 0%, transparent 46%)', 'radial'))
      .toBe('radial-gradient(circle at 50% 50%, #fff 0%, transparent 46%)');
    expect(convertGradientType('radial-gradient(circle at 78% 18%, #ffffff 0%, transparent 46%)', 'linear'))
      .toBe('linear-gradient(135deg, #ffffff 0%, transparent 46%)');
    expect(convertGradientType('conic-gradient(#fff, #000)', 'radial')).toBe('conic-gradient(#fff, #000)');
  });

  it('空或未识别的色标颜色被拒绝，不会构建出失效 CSS', () => {
    const value = 'linear-gradient(135deg, #6b8cff, #93c5fd, #1d4ed8)';
    expect(updateGradient(value, { stopIndex: 1, stopColor: '' })).toBe(value);
    expect(updateGradient(value, { stopIndex: 1, stopColor: '   ' })).toBe(value);
    expect(updateGradient(value, { stopIndex: 1, stopColor: 'not-a-color' })).toBe(value);
    expect(updateGradient(value, { startColor: '' })).toBe(value);
    expect(updateGradient(value, { endColor: 'not-a-color' })).toBe(value);

    expect(updateGradient(value, { stopIndex: 1, stopColor: '#22d3ee' })).toBe('linear-gradient(135deg, #6b8cff, #22d3ee, #1d4ed8)');
    expect(updateGradient(value, { stopIndex: 1, stopColor: 'transparent' })).toBe('linear-gradient(135deg, #6b8cff, transparent, #1d4ed8)');
    expect(updateGradient(value, { endColor: 'var(--theme-node-primary)' })).toBe('linear-gradient(135deg, #6b8cff, #93c5fd, var(--theme-node-primary))');
  });

  it('色标位置的兜底：普通值更新、非法值保留原值、留空回到自动分布', () => {
    const value = 'linear-gradient(135deg, #aaa 0%, #bbb 50%, #ccc 100%)';

    // 普通值 → 更新对应色标
    expect(updateGradient(value, { stopIndex: 1, stopPosition: '42%' })).toBe('linear-gradient(135deg, #aaa 0%, #bbb 42%, #ccc 100%)');
    // 越界值：CSS 允许（表示色带被截断），按合法值写入
    expect(updateGradient(value, { stopIndex: 1, stopPosition: '150%' })).toBe('linear-gradient(135deg, #aaa 0%, #bbb 150%, #ccc 100%)');
    expect(updateGradient(value, { stopIndex: 1, stopPosition: '-20%' })).toBe('linear-gradient(135deg, #aaa 0%, #bbb -20%, #ccc 100%)');
    // 省略写法：.5% 与 +5px 也是合法 CSS
    expect(updateGradient(value, { stopIndex: 1, stopPosition: '.5%' })).toBe('linear-gradient(135deg, #aaa 0%, #bbb .5%, #ccc 100%)');
    expect(updateGradient(value, { stopIndex: 1, stopPosition: '+5px' })).toBe('linear-gradient(135deg, #aaa 0%, #bbb +5px, #ccc 100%)');
    expect(updateGradient(value, { stopIndex: 1, stopPosition: '0' })).toBe('linear-gradient(135deg, #aaa 0%, #bbb 0, #ccc 100%)');

    // 非法值 → 保留上一合法值
    for (const bad of ['abc', '50', '50 %', '10vw', '50% 60%', 'calc(1px)', '0,']) {
      expect(isGradientStopPosition(bad)).toBe(false);
      expect(updateGradient(value, { stopIndex: 1, stopPosition: bad })).toBe(value);
    }

    // 留空 → 回到自动分布，颜色与色标数量不变
    const cleared = updateGradient(value, { stopIndex: 1, stopPosition: '' });
    expect(cleared).toBe('linear-gradient(135deg, #aaa 0%, #bbb, #ccc 100%)');
    expect(parseGradient(cleared)?.stops).toEqual([
      { color: '#aaa', position: '0%' },
      { color: '#bbb' },
      { color: '#ccc', position: '100%' },
    ]);
  });

  it('方向、形状、径向尺寸与中心只接受合法取值', () => {
    const linear = 'linear-gradient(135deg, #aaa, #bbb)';
    expect(updateGradient(linear, { direction: 'to bottom' })).toBe('linear-gradient(to bottom, #aaa, #bbb)');
    expect(updateGradient(linear, { direction: '270deg' })).toBe('linear-gradient(270deg, #aaa, #bbb)');
    expect(updateGradient(linear, { direction: '45 度' })).toBe(linear);
    expect(updateGradient(linear, { direction: '' })).toBe('linear-gradient(#aaa, #bbb)');

    const radial = 'radial-gradient(circle at 78% 18%, #fff 0%, transparent 46%)';
    expect(updateGradient(radial, { shape: 'ellipse' })).toBe('radial-gradient(ellipse at 78% 18%, #fff 0%, transparent 46%)');
    expect(updateGradient(radial, { shape: 'triangle' })).toBe(radial);
    expect(updateGradient(radial, { size: 'farthest-side' })).toBe('radial-gradient(circle farthest-side at 78% 18%, #fff 0%, transparent 46%)');
    expect(updateGradient(radial, { size: 'break, it' })).toBe(radial);
    expect(updateGradient(radial, { centerX: '30%' })).toBe('radial-gradient(circle at 30% 18%, #fff 0%, transparent 46%)');
    expect(updateGradient(radial, { centerY: 'nope()' })).toBe(radial);
  });

  it('序列化永不产出空色标，避免整条声明失效', () => {
    expect(serializeGradient({ type: 'linear', direction: '135deg', stops: [{ color: '#a' }, { color: '' }, { color: '#c' }] }))
      .toBe('linear-gradient(135deg, #a, #c)');
    expect(serializeGradient({ type: 'linear', stops: [{ color: '  ' }] })).toBe('linear-gradient()');
  });
});
