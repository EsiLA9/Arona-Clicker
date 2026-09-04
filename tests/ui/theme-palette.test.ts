import { describe, expect, test } from 'vitest';
import {
  normalizeThemePalette,
  paletteColor,
  resolveThemeNode,
  resolveThemeNodes,
  buildThemeNodeVars,
  resolveScopedThemeNodes,
  buildScopedThemeCompatibilityVars,
  deriveSurfaceColor,
  deriveBackgroundGradient,
} from '../../src/ui/theme-palette';

describe('theme-palette：主题色列表与语义节点解析', () => {
  test('颜色列表最多保留六个，并过滤空值', () => {
    expect(normalizeThemePalette(['#1', '', '#2', '  ', '#3', '#4', '#5', '#6', '#7'])).toEqual([
      '#1', '#2', '#3', '#4', '#5', '#6',
    ]);
  });

  test('颜色不足时向前回退，只有一个颜色时全部复用', () => {
    expect(paletteColor(['one'], 0)).toBe('one');
    expect(paletteColor(['one'], 5)).toBe('one');
    expect(paletteColor(['one', 'two', 'three'], 5)).toBe('three');
  });

  test('节点优先使用显式覆盖，其次使用现有 token，最后使用主题色列表', () => {
    const palette = { colors: ['p', 'a', 'h'] };
    const overrides = new Map([['active', 'manual'] as const]);
    expect(resolveThemeNode('active', palette, { primary: 'token-primary' }, overrides)).toBe('manual');
    expect(resolveThemeNode('primary', palette, { primary: 'token-primary' })).toBe('token-primary');
    expect(resolveThemeNode('highlight', palette)).toBe('h');
  });

  test('单色主题为背景与面板节点生成浅色层级', () => {
    const nodes = resolveThemeNodes({ colors: ['only'] });
    expect(nodes.bg).not.toBe('only');
    expect(nodes.bgAlt).not.toBe('only');
    expect(nodes.panel).not.toBe('only');
    expect(nodes.panelLight).not.toBe('only');
    expect(nodes.text).toBe('#172033');
  });

  test('UI 失能色由调用层过滤，原始色板仍保持完整', () => {
    const colors = ['#111111', '#222222', '#333333'];
    const uiColors = colors.filter((_, index) => [true, false, true][index]);
    expect(resolveThemeNode('highlight', { colors: uiColors })).toBe('#333333');
    expect(colors).toEqual(['#111111', '#222222', '#333333']);
  });

  test('语义节点落为稳定的 CSS 变量名', () => {
    expect(buildThemeNodeVars({ colors: ['#123456'] }, { primary: '#123456' })).toMatchObject({
      '--theme-node-primary': '#123456',
      '--theme-node-player-bubble': expect.any(String),
    });
  });

  test('作用域节点未覆盖时继承父节点，显式值只覆盖当前节点', () => {
    const parent = resolveThemeNodes({ colors: ['one', 'two', 'three'] });
    const child = resolveScopedThemeNodes(parent, new Map([['active', 'child-active'] as const]));
    expect(child.primary).toBe(parent.primary);
    expect(child.active).toBe('child-active');
    expect(child.highlight).toBe(parent.highlight);
  });

  test('浅色模式把高饱和主题色压向浅表面，并生成双端渐变', () => {
    const surface = deriveSurfaceColor('#1456c0', 'light');
    expect(surface).toMatch(/^hsl\(/);
    expect(deriveSurfaceColor('#1456c0', 'dark')).toBe('#1456c0');
    const fallbackGradient = deriveBackgroundGradient(['#1456c0'], 'light');
    expect(fallbackGradient).toContain('linear-gradient');
    expect(fallbackGradient.match(/hsl\(/g)).toHaveLength(2);
    const endpointLightness = (fallbackGradient.match(/hsl\((?:\d+) (?:\d+)% (\d+)%\)/g) ?? [])
      .map(endpoint => Number(endpoint.match(/ (\d+)%\)/)?.[1]));
    expect(endpointLightness.every(lightness => lightness >= 98 && lightness <= 99)).toBe(true);
    const twoColorGradient = deriveBackgroundGradient(['#1456c0', '#ff4d8d'], 'light');
    const twoColorLightness = (twoColorGradient.match(/hsl\((?:\d+) (?:\d+)% (\d+)%\)/g) ?? [])
      .map(endpoint => Number(endpoint.match(/ (\d+)%\)/)?.[1]));
    expect(twoColorLightness.every(lightness => lightness >= 98 && lightness <= 99)).toBe(true);
  });

  test('单主题色的第二背景端点进一步变浅并扩大色相偏移', () => {
    const gradient = deriveBackgroundGradient(['#1456c0'], 'light');
    const endpoints = gradient.match(/hsl\((\d+) (\d+)% (\d+)%\)/g) ?? [];
    expect(endpoints).toHaveLength(2);
    const [, secondHue, secondSaturation, secondLightness] = endpoints[1].match(/hsl\((\d+) (\d+)% (\d+)%\)/) ?? [];
    expect(Number(secondHue)).toBeGreaterThan(220);
    expect(Number(secondSaturation)).toBeLessThan(40);
    expect(Number(secondLightness)).toBeGreaterThanOrEqual(97);
  });

  test('主题色系统的文字判别也使用 0.75 明度阈值', () => {
    const base = resolveThemeNodes({ colors: ['#4a7dff'] });
    const below = buildScopedThemeCompatibilityVars({ ...base, panel: '#bfbfbf' });
    const above = buildScopedThemeCompatibilityVars({ ...base, panel: '#c0c0c0' });
    expect(below['--ink-on-panel']).toBe('#ffffff');
    expect(above['--ink-on-panel']).toBe('#172033');
  });
});
