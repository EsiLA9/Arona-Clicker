import { describe, expect, test } from 'vitest';
import {
  INK_ON_DARK,
  INK_ON_LIGHT,
  TEXT_ON_LIGHT_THRESHOLD,
  THEME_LIGHTNESS_THRESHOLD,
  adjustHsl,
  compositeLayer,
  contrastRatio,
  formatHsl,
  hslCss,
  mixLinear,
  readableOnColor,
  relativeLuminance,
  representativeColorOf,
  rgbTriplet,
  themeSurfaceInk,
  themeSurfaceIsLight,
  toHsl,
  toRgba,
} from '../../src/engine/core/color';

describe('色彩框架：HSL 派生（色相单位固定为度）', () => {
  test('CF-01 toHsl 输出度为单位的色相，hslCss 按度应用偏移', () => {
    expect(toHsl('#3b82f6')!.h).toBeCloseTo(217.2, 1);
    // +12° 偏移必须真正生效（历史上 (h + 12) 在 0~1 归一色相上是空操作）
    expect(adjustHsl('#3b82f6', { hueShift: 12 })!.h).toBeCloseTo(229.2, 1);
    // 序列化会取整，往返后落在整度上
    expect(toHsl(hslCss('#3b82f6', { hueShift: 12 })!)!.h).toBe(229);
    // 越界/负色相归一
    expect(adjustHsl('#3b82f6', { hueShift: -230 })!.h).toBeCloseTo(347.2, 1);
    expect(adjustHsl('#3b82f6', { hueShift: 360 })!.h).toBeCloseTo(217.2, 1);
  });

  test('CF-02 adjustHsl 的倍数/绝对/夹取语义完整', () => {
    const base = toHsl('#3b82f6')!;
    const scaled = adjustHsl('#3b82f6', { saturationScale: 0.5 })!;
    expect(scaled.s).toBeCloseTo(base.s * 0.5, 6);
    expect(scaled.h).toBeCloseTo(base.h, 6);

    expect(adjustHsl('#3b82f6', { saturation: 0.1 })!.s).toBeCloseTo(0.1, 6);
    expect(adjustHsl('#3b82f6', { saturationScale: 0, minSaturation: 0.06 })!.s).toBeCloseTo(0.06, 6);
    expect(adjustHsl('#3b82f6', { saturationScale: 5, maxSaturation: 0.7 })!.s).toBeCloseTo(0.7, 6);
    expect(adjustHsl('#3b82f6', { lightness: 0.16 })!.l).toBeCloseTo(0.16, 6);
    expect(adjustHsl('#3b82f6', { lightnessScale: 2, maxLightness: 1 })!.l).toBeCloseTo(1, 6);

    // 不可解析输入 → undefined，由调用方回退，不制造假颜色
    expect(adjustHsl('color-mix(in srgb, red 50%, blue)', { lightness: 0.5 })).toBeUndefined();
    expect(hslCss('not-a-color')).toBeUndefined();
  });

  test('CF-03 formatHsl 输出形态与旧实现逐字一致', () => {
    expect(formatHsl({ h: 217.2, s: 0.912, l: 0.598 })).toBe('hsl(217 91% 60%)');
    expect(formatHsl({ h: 217, s: 1, l: 0.5 }, 0.25)).toBe('hsla(217 100% 50% / 0.25)');
    // 灰阶色相归零，不出现 NaN
    expect(hslCss('#808080', { saturationScale: 0.5 })!).toBe('hsl(0 0% 50%)');
  });
});

describe('色彩框架：两套判定契约', () => {
  test('CF-04 主题面契约用 HSL 明度（0.38），产出可按色相微染的深字', () => {
    expect(THEME_LIGHTNESS_THRESHOLD).toBe(0.38);
    expect(themeSurfaceIsLight('#a3e635')).toBe(true);
    // 蓝色 HSL 明度 0.59 → 主题面判为浅底；这正是背景文字契约存在的理由
    expect(themeSurfaceIsLight('#3d83f2')).toBe(true);
    expect(themeSurfaceIsLight('#1e3a5f')).toBe(false);
    // 亮底 → 深字（带色相，非纯黑）；暗底 → 白字
    expect(themeSurfaceInk('#a3e635')).not.toBe(INK_ON_DARK);
    expect(toHsl(themeSurfaceInk('#a3e635'))!.l).toBeCloseTo(0.16, 2);
    expect(themeSurfaceInk('#1e3a5f')).toBe(INK_ON_DARK);
  });

  test('CF-05 背景文字契约用 WCAG 感知亮度（0.75），彩色底优先白字', () => {
    expect(TEXT_ON_LIGHT_THRESHOLD).toBe(0.75);
    expect(relativeLuminance(toRgba('#3d83f2')!)).toBeCloseTo(0.236, 2);
    expect(readableOnColor('#3d83f2')).toBe(INK_ON_DARK);
    expect(readableOnColor('#3b82f6')).toBe(INK_ON_DARK);
    expect(readableOnColor('#f5f9ff')).toBe(INK_ON_LIGHT);
    // 不可解析 → 按亮底处理（浅底深字比深底黑字安全）
    expect(readableOnColor('color-mix(in srgb, red 40%, transparent)')).toBe(INK_ON_LIGHT);
  });

  test('CF-06 契约差异被固化：主题面判浅底的颜色，背景契约仍可能给白字', () => {
    // 亮绿 / 中等蓝在「主题面」都是浅底（HSL 明度 > 0.38），但「背景文字」契约
    // 保守地把它们判为深底用白字——气泡文字因此走主题面契约，两者不可互相替换。
    expect(themeSurfaceIsLight('#a3e635')).toBe(true);
    expect(themeSurfaceIsLight('#3d83f2')).toBe(true);
    expect(readableOnColor('#a3e635')).toBe(INK_ON_DARK);
    expect(readableOnColor('#3d83f2')).toBe(INK_ON_DARK);
  });

  test('CF-07 WCAG 对比度为真实模型（不再对色相不敏感）', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    // 同明度不同色相必须给出不同结果：旧模型两者完全相等
    const yellow = contrastRatio('#808000', '#ffffff');
    const blue = contrastRatio('#000080', '#ffffff');
    expect(yellow).not.toBeCloseTo(blue, 1);
    // 不可解析 → 0（视作最差，调用方的防呆分支不会被误判为达标）
    expect(contrastRatio('#ffffff', 'color-mix(in srgb, red 50%, blue)')).toBe(0);
  });
});

describe('色彩框架：序列化与合成', () => {
  test('CF-08 rgbTriplet 输出与旧 hexToRgbTriplet 同形', () => {
    expect(rgbTriplet('#3b9eff')).toBe('59, 158, 255');
    expect(rgbTriplet('hsl(217 100% 50%)')).toBe(
      `${Math.round(toRgba('hsl(217 100% 50%)')!.r * 255)}, ${Math.round(toRgba('hsl(217 100% 50%)')!.g * 255)}, ${Math.round(toRgba('hsl(217 100% 50%)')!.b * 255)}`,
    );
    // 不可解析回退默认主色三元组
    expect(rgbTriplet('bogus')).toBe('59, 158, 255');
  });

  test('CF-09 代表色：纯色取自身、渐变取光空间均值、url/无表 var 跳过', () => {
    expect(representativeColorOf('#101828')).toEqual({ r: 16 / 255, g: 24 / 255, b: 40 / 255, a: 1 });
    expect(representativeColorOf('url("bg.png")')).toBeUndefined();
    expect(representativeColorOf('var(--bg)')).toBeUndefined();
    expect(representativeColorOf('var(--bg)', { '--bg': '#101828' })).toEqual({ r: 16 / 255, g: 24 / 255, b: 40 / 255, a: 1 });
    // 黑白渐变在线性光空间求均值 → sRGB ≈ #bcbcbc（sRGB 直接平均会得到 #808080）
    const gradient = representativeColorOf('linear-gradient(90deg, #000 0%, #fff 100%)')!;
    expect(relativeLuminance(gradient)).toBeCloseTo(0.5, 2);
  });

  test('CF-10 mixLinear 与 compositeLayer 的 alpha/混合语义', () => {
    const white = mixLinear([{ r: 0, g: 0, b: 0, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }]);
    expect(white.r).toBeCloseTo(0.7354, 3);
    expect(white.a).toBe(1);

    const over = compositeLayer({ r: 0, g: 0, b: 0, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }, 0.5);
    expect(over.r).toBeCloseTo(0.5, 6);
    expect(over.a).toBe(1);
    // 混合模式：multiply / screen 均为可分离模式
    expect(compositeLayer({ r: 1, g: 1, b: 1, a: 1 }, { r: 0.5, g: 0.5, b: 0.5, a: 1 }, 1, 'multiply').r).toBeCloseTo(0.5, 6);
    expect(compositeLayer({ r: 0, g: 0, b: 0, a: 1 }, { r: 0.5, g: 0.5, b: 0.5, a: 1 }, 1, 'screen').r).toBeCloseTo(0.5, 6);
    // 未知混合模式回退 normal
    expect(compositeLayer({ r: 0, g: 0, b: 0, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }, 1, 'bogus').r).toBeCloseTo(1, 6);
  });
});
