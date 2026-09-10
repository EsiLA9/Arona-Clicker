import { describe, expect, test } from 'vitest';
import {
  BackgroundInkService,
  compositeBackgroundInk,
  themeVarLookup,
} from '../../src/ui/background-color';
import {
  INK_ON_DARK,
  INK_ON_LIGHT,
  TEXT_ON_LIGHT_THRESHOLD,
  parseColor,
  readableOnColor,
  relativeLuminance,
} from '../../src/engine/core/color';
import { buildBackgroundView } from '../../src/ui/background-service';
import { buildThemeVars } from '../../src/ui/theme-tree';

const noPics = { urlOf: () => undefined, defOf: () => undefined };

describe('BackgroundColor 单层代表色', () => {
  test('BC-01 solid 层代表色即自身，深底写白字、浅底写深字', () => {
    const dark = compositeBackgroundInk([{ value: '#101828' }])!;
    expect(dark.color).toBe('#101828');
    expect(dark.light).toBe(false);
    expect(dark.text).toBe(INK_ON_DARK);
    expect(dark.textColorMode).toBe('light');
    expect(dark.layers).toBe(1);

    const light = compositeBackgroundInk([{ value: '#f5f9ff' }])!;
    expect(light.light).toBe(true);
    expect(light.text).toBe(INK_ON_LIGHT);
    expect(light.textColorMode).toBe('dark');
  });

  test('BC-02 支持 hex 简写/rgb/hsl/transparent，非法值不解析', () => {
    expect(parseColor('#abc')).toEqual({ r: 170 / 255, g: 187 / 255, b: 204 / 255, a: 1 });
    expect(parseColor('rgb(255 0 0 / 50%)')).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(parseColor('rgba(0, 0, 0, .25)')).toEqual({ r: 0, g: 0, b: 0, a: 0.25 });
    expect(parseColor('hsl(220 18% 12%)')).toBeDefined();
    expect(relativeLuminance(parseColor('hsl(220 18% 12%)')!)).toBeCloseTo(0.012, 3);
    expect(parseColor('transparent')!.a).toBe(0);
    expect(parseColor('color-mix(in srgb, red 50%, transparent)')).toBeUndefined();
    expect(parseColor('url("x.png")')).toBeUndefined();
  });
});

describe('BackgroundColor 多图层合成', () => {
  test('BC-03 半透明层按 source-over 与下层加权（白 50% 覆盖黑 = 中灰）', () => {
    const ink = compositeBackgroundInk([
      { value: '#000000' },
      { value: '#ffffff', opacity: 0.5 },
    ])!;
    expect(ink.color).toBe('#808080');
    expect(ink.alpha).toBe(1);
    expect(ink.light).toBe(false);
  });

  test('BC-04 blendMode 参与合成（multiply / screen 均为可分离模式）', () => {
    const multiply = compositeBackgroundInk([
      { value: '#ffffff' },
      { value: '#808080', blendMode: 'multiply' },
    ])!;
    expect(multiply.color).toBe('#808080');

    const screen = compositeBackgroundInk([
      { value: '#000000' },
      { value: '#808080', blendMode: 'screen' },
    ])!;
    expect(screen.color).toBe('#808080');
  });

  test('BC-05 渐变按色标在线性光空间取均值（非 sRGB 直接平均）', () => {
    const ink = compositeBackgroundInk([{ value: 'linear-gradient(90deg, #000000 0%, #ffffff 100%)' }])!;
    // 线性空间均值 0.5 → sRGB ≈ 0.735 → #bcbcbc，WCAG 亮度恰为 0.5
    expect(ink.color).toBe('#bcbcbc');
    expect(ink.luminance).toBeCloseTo(0.5, 2);
    // sRGB 直接平均会得到 #808080（亮度 0.216），两者可区分
    expect(ink.color).not.toBe('#808080');
  });

  test('BC-06 渐变的角度/位置参数被忽略，只取色标', () => {
    const ink = compositeBackgroundInk([{ value: 'radial-gradient(circle at center, #101828 10%, #101828 90%)' }])!;
    expect(ink.color).toBe('#101828');
  });

  test('BC-07 图片层与不可静态解析的值被跳过；全部跳过则为 null', () => {
    const skipped = compositeBackgroundInk([
      { value: 'url("https://example.com/bg.png")' },
      { value: 'linear-gradient(90deg, color-mix(in srgb, red 40%, transparent), color-mix(in srgb, blue 40%, transparent))' },
    ]);
    expect(skipped).toBeNull();

    const mixed = compositeBackgroundInk([
      { value: 'url("https://example.com/bg.png")' },
      { value: '#f5f9ff' },
    ])!;
    expect(mixed.layers).toBe(1);
    expect(mixed.color).toBe('#f5f9ff');
  });

  test('BC-08 var() 按主题变量解析，缺失变量回退 fallback，链式兜底可递归', () => {
    const lookup = themeVarLookup({ bg: '#0d1220', bgAlt: '#101828', panel: '#ffffff', primary: '#3b82f6' });
    expect(compositeBackgroundInk([{ value: 'var(--bg)' }], { lookup })!.color).toBe('#0d1220');
    expect(compositeBackgroundInk([{ value: 'var(--missing, #f5f9ff)' }], { lookup })!.color).toBe('#f5f9ff');
    expect(compositeBackgroundInk([{ value: 'var(--missing, var(--bg))' }], { lookup })!.color).toBe('#0d1220');
    expect(compositeBackgroundInk([{ value: 'var(--missing)' }], { lookup })).toBeNull();
  });

  test('BC-09 ignoreLayerIds 等价于 systemColorLayerIgnored 的渲染过滤', () => {
    const layers = [
      { id: 'system-color-background', value: '#0d1220' },
      { id: 'user', value: '#ffffff', opacity: 0.5 },
    ];
    const withSystem = compositeBackgroundInk(layers)!;
    const withoutSystem = compositeBackgroundInk(layers, { ignoreLayerIds: ['system-color-background'] })!;
    expect(withoutSystem.color).toBe('#ffffff');
    expect(withoutSystem.alpha).toBe(0.5);
    expect(withSystem.alpha).toBe(1);
    expect(withSystem.color).not.toBe('#ffffff');
  });

  test('BC-10 base 表达「宿主背景叠在全局背景之上」', () => {
    const hostOnly = compositeBackgroundInk([{ value: '#ffffff', opacity: 0.5 }])!;
    const overGlobal = compositeBackgroundInk([{ value: '#ffffff', opacity: 0.5 }], { base: '#000000' })!;
    expect(hostOnly.color).toBe('#ffffff');
    expect(hostOnly.alpha).toBe(0.5);
    expect(overGlobal.color).toBe('#808080');
    expect(overGlobal.alpha).toBe(1);
  });
});

describe('BackgroundColor 惰性记忆服务', () => {
  test('BC-11 同内容签名命中缓存，内容变化产生新条目并受容量上限约束', () => {
    const service = new BackgroundInkService(2);
    const layers = [{ value: '#101828' }];
    const first = service.ink(layers);
    expect(service.ink(layers)).toBe(first);
    expect(service.size).toBe(1);

    service.ink([{ value: '#f5f9ff' }]);
    expect(service.size).toBe(2);
    service.ink([{ value: '#3b82f6' }]);
    expect(service.size).toBe(2);

    // 内容变化（透明度不同）不会命中旧条目
    expect(service.ink([{ value: '#101828', opacity: 0.5 }])).not.toBe(first);
  });

  test('BC-12 无法解析的栈按 null 负缓存', () => {
    const service = new BackgroundInkService();
    const layers = [{ value: 'url("x.png")' }];
    expect(service.ink(layers)).toBeNull();
    expect(service.ink(layers)).toBeNull();
    expect(service.size).toBe(1);
  });
});

describe('BackgroundColor 与 theme-tree 判定契约一致', () => {
  test('BC-13 节点判色与合成判色共用同一阈值与同一组文字色', () => {
    expect(TEXT_ON_LIGHT_THRESHOLD).toBe(0.75);
    expect(readableOnColor('#101828')).toBe(INK_ON_DARK);
    expect(readableOnColor('#f5f9ff')).toBe(INK_ON_LIGHT);
    // 中等饱和彩色（#3d83f2）按既有契约判为深底 → 白字
    expect(readableOnColor('#3d83f2')).toBe(INK_ON_DARK);
    // 节点路径（theme-tree --ink-on-*）与合成路径（图层栈）给出同一答案
    const vars = buildThemeVars('#3b9eff', {}, { bg: '#f5f9ff' });
    expect(vars['ink-on-canvas']).toBe(INK_ON_LIGHT);
    expect(compositeBackgroundInk([{ value: '#f5f9ff' }])!.text).toBe(INK_ON_LIGHT);
    expect(compositeBackgroundInk([{ value: '#3d83f2' }])!.text).toBe(INK_ON_DARK);
  });

  test('BC-14 系统底色渐变层按主题 token 明暗正确翻字色', () => {
    const value = 'linear-gradient(135deg, var(--bg) 0%, var(--bg-alt) 100%)';
    const light = compositeBackgroundInk(
      [{ id: 'system-color-background', value, opacity: 1 }],
      { lookup: themeVarLookup({ bg: '#f2f6ff', bgAlt: '#e6eefc' }) },
    )!;
    expect(light.light).toBe(true);
    expect(light.text).toBe(INK_ON_LIGHT);

    const dark = compositeBackgroundInk(
      [{ id: 'system-color-background', value, opacity: 1 }],
      { lookup: themeVarLookup({ bg: '#0d1220', bgAlt: '#101828' }) },
    )!;
    expect(dark.light).toBe(false);
    expect(dark.text).toBe(INK_ON_DARK);
  });
});

describe('BackgroundColor 变量作用域（选择页顶栏回归）', () => {
  // 复现：选择页顶栏按钮底色 = var(--ui-button-bg → --theme-node-panel-light)，
  // 在「聚焦 Init 投影出的深色作用域」里是深底；若拿游戏页运行时 token 判色就会判成亮底 → 深底深字。
  const fallbackChain = { value: 'var(--ui-button-bg, var(--theme-node-panel-light, var(--theme-node-panel, #ffffff)))' };
  const selectorScope = themeVarLookup(undefined, [], { '--theme-node-panel-light': 'hsl(161 14% 17%)' });
  const gamePageScope = themeVarLookup(undefined, [], { '--theme-node-panel-light': '#e4e8ee' });

  test('BC-17 同一 var() 图层按不同作用域变量表得出相反判定', () => {
    const inSelector = compositeBackgroundInk([fallbackChain], { lookup: selectorScope })!;
    expect(inSelector.light).toBe(false);
    expect(inSelector.text).toBe(INK_ON_DARK);
    expect(inSelector.textColorMode).toBe('light');

    const inGamePage = compositeBackgroundInk([fallbackChain], { lookup: gamePageScope })!;
    expect(inGamePage.light).toBe(true);
    expect(inGamePage.text).toBe(INK_ON_LIGHT);
  });

  test('BC-18 缺少作用域变量表时 var() 图层整体跳过，不退到兜底字面量', () => {
    expect(compositeBackgroundInk([fallbackChain])).toBeNull();
    expect(compositeBackgroundInk([{ value: 'linear-gradient(90deg, var(--bg), #fff)' }])).toBeNull();
    // 同栈中的具体颜色照常参与合成
    expect(compositeBackgroundInk([fallbackChain, { value: '#0b1020' }])!.color).toBe('#0b1020');
  });

  test('BC-19 作用域变量表优先于 token 近似值', () => {
    const lookup = themeVarLookup({ bgAlt: '#e6eefc' }, [], { '--theme-node-panel-light': 'hsl(161 14% 17%)' });
    expect(lookup['--theme-node-panel-light']).toBe('hsl(161 14% 17%)');
    // --ui-button-bg 在 DOM 中即 var(--theme-node-panel-light)，按使用它的元素作用域取值
    expect(lookup['--ui-button-bg']).toBe('hsl(161 14% 17%)');
  });
});

describe('BackgroundView 惰性 ink', () => {
  test('BC-15 视图按图层栈给出合成色，关闭系统层后不再计入', () => {
    const tokens = { bg: '#f2f6ff', bgAlt: '#e6eefc' };
    const vars = { '--bg': '#f2f6ff', '--bg-alt': '#e6eefc' };
    const view = buildBackgroundView([
      { id: 'system-color-background', kind: 'gradient', value: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-alt) 100%)' },
      { id: 'storm', kind: 'solid', value: '#0b1020', opacity: 0.85 },
    ], noPics, tokens, false, [], vars);

    const ink = view.ink!;
    expect(ink.light).toBe(false);
    expect(ink.text).toBe(INK_ON_DARK);
    // 未提供作用域变量表 → var() 图层不参与判定
    expect(view.themeVars).toBeDefined();
    expect(buildBackgroundView([{ kind: 'gradient', value: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-alt) 100%)' }], noPics, tokens).ink).toBeNull();

    const ignored = buildBackgroundView([
      { id: 'system-color-background', kind: 'gradient', value: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-alt) 100%)' },
    ], noPics, tokens, true, [], vars);
    expect(ignored.ink).toBeNull();
  });

  test('BC-16 同一图层栈跨视图重建仍命中缓存（内容签名而非对象身份）', () => {
    const layers = [{ kind: 'solid' as const, value: '#0d1220' }];
    const tokens = { bg: '#0d1220', bgAlt: '#101828' };
    const a = buildBackgroundView(layers, noPics, tokens).ink;
    const b = buildBackgroundView(layers, noPics, { ...tokens }).ink;
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });
});
