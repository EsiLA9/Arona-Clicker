// ============================================================
// engine/avatar-renderer.test.ts — 学生头像 SVG 渲染（纯函数）
// 验证各 compositionType 输出 SVG 且颜色数量匹配。
// ============================================================
import { describe, test, expect } from 'vitest';
import { renderAvatarSvg, resolveAvatarColors, avatarColorCount } from '../../src/ui/avatar-renderer';

describe('resolveAvatarColors', () => {
  test('solid 取 1 色，不足补 #888', () => {
    expect(resolveAvatarColors('solid', ['#ff0000'])).toEqual(['#ff0000']);
    expect(resolveAvatarColors('solid', [])).toEqual(['#888888']);
  });

  test('gradient/duotone/radial 取 2 色，不足补 #888', () => {
    for (const t of ['gradient' as const, 'duotone' as const, 'radial' as const]) {
      expect(resolveAvatarColors(t, ['#a', '#b'])).toEqual(['#a', '#b']);
      expect(resolveAvatarColors(t, ['#a'])).toEqual(['#a', '#888888']);
      expect(resolveAvatarColors(t, [])).toEqual(['#888888', '#888888']);
    }
  });

  test('pie 按传入数量，下限 1 色', () => {
    expect(resolveAvatarColors('pie', ['#a', '#b', '#c', '#d'])).toEqual(['#a', '#b', '#c', '#d']);
    expect(resolveAvatarColors('pie', [])).toEqual(['#888888']);
  });
});

describe('avatarColorCount', () => {
  test('solid=1, gradient=2, duotone=2, radial=2, pie=可变', () => {
    expect(avatarColorCount('solid')).toBe(1);
    expect(avatarColorCount('gradient')).toBe(2);
    expect(avatarColorCount('duotone')).toBe(2);
    expect(avatarColorCount('radial')).toBe(2);
    expect(avatarColorCount('pie', 0)).toBe(1);
    expect(avatarColorCount('pie', 4)).toBe(4);
  });
});

describe('renderAvatarSvg', () => {
  test('solid: 单色圆', () => {
    const svg = renderAvatarSvg('solid', ['#ff0000'], 64);
    expect(svg).toContain('<svg');
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('width="64"');
    expect(svg).toContain('viewBox="0 0 64 64"');
  });

  test('gradient: 线性渐变', () => {
    const svg = renderAvatarSvg('gradient', ['#ff0000', '#0000ff']);
    expect(svg).toContain('<svg');
    expect(svg).toContain('linearGradient');
    expect(svg).toContain('stop-color="#ff0000"');
    expect(svg).toContain('stop-color="#0000ff"');
  });

  test('duotone: 主色圆 + 阴影椭圆', () => {
    const svg = renderAvatarSvg('duotone', ['#eab308', '#1e3a5f']);
    expect(svg).toContain('<svg');
    expect(svg).toContain('fill="#eab308"');
    expect(svg).toContain('ellipse');
    expect(svg).toContain('fill="#1e3a5f"');
  });

  test('pie: 饼图分区', () => {
    const svg = renderAvatarSvg('pie', ['#ff0000', '#00ff00', '#0000ff']);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path d=');
    // 3 色 = 3 个 sector path
    const matches = svg.match(/<path d=/g);
    expect(matches).toHaveLength(3);
  });

  test('radial: 径向渐变', () => {
    const svg = renderAvatarSvg('radial', ['#ff7a59', '#ff5d8f']);
    expect(svg).toContain('<svg');
    expect(svg).toContain('radialGradient');
    expect(svg).toContain('stop-color="#ff7a59"');
    expect(svg).toContain('stop-color="#ff5d8f"');
  });

  test('size 参数控制输出尺寸', () => {
    const small = renderAvatarSvg('solid', ['#000'], 32);
    expect(small).toContain('width="32"');
    const large = renderAvatarSvg('solid', ['#000'], 128);
    expect(large).toContain('width="128"');
  });

  test('空 colors 数组用占位灰', () => {
    const svg = renderAvatarSvg('solid', []);
    expect(svg).toContain('fill="#888888"');
  });
});
