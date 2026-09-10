import { describe, test, expect } from 'vitest';
import { resolveTheme, deriveThemeTokens, ColorSystem } from '../../src/arona-clicker/services/color-system';
import { contrastRatio, toHsl } from '../../src/engine/core/color';
import type { ColorGroupDef } from '../../src/data-services/contracts/color';

/** 从派生出的 hsl(...) 字符串中提取明度值（0~1）。 */
function hslLightness(css: string): number {
  const m = /hsl\(\s*\d+\s+\d+%\s+(\d+)%/i.exec(css);
  if (!m) throw new Error(`无法解析 hsl: ${css}`);
  return Number(m[1]) / 100;
}

/** 构造最小 ColorGroupDef（solid 单主色位；theme 可带部分覆盖）。 */
function group(hex: string, theme?: Record<string, string>): ColorGroupDef {
  return {
    id: 'g',
    name: 'g',
    compositionType: 'solid',
    slots: [{ role: 'primary', color: hex }],
    ...(theme ? { theme } : {}),
  };
}

const KEYS = ['primary', 'bg', 'bgAlt', 'text', 'textDim', 'border', 'accent'];

describe('主题派生：不同数量/色相下自动构造完整 token', () => {
  const hues = ['#ff5d8f', '#10b981', '#8b5cf6', '#f59e0b', '#e11d48', '#14b8a6', '#6366f1', '#38bdf8', '#a3e635', '#1e3a5f'];
  for (const primary of hues) {
    test(`派生 ${primary} 产出全部 7 个 token`, () => {
      const t = resolveTheme(group(primary));
      for (const k of KEYS) expect(t[k]).toBeTruthy();
      // primary 缺省取主色位色值并原样透传
      expect(t['primary']).toBe(primary);
      // accent 缺省等于 primary
      expect(t['accent']).toBe(primary);
    });
  }

  test('浅底分支：高明度 primary → text 偏深', () => {
    const t = deriveThemeTokens('#a3e635'); // l>0.6
    const textL = contrastRatio(t['text'], t['bg']);
    expect(textL).toBeGreaterThanOrEqual(4.5);
  });

  test('深底分支：低明度 primary → text 偏浅', () => {
    const t = deriveThemeTokens('#1e3a5f'); // l<0.6
    expect(contrastRatio(t['text'], t['bg'])).toBeGreaterThanOrEqual(4.5);
  });

  test('显式 theme 全量覆盖派生值', () => {
    const t = resolveTheme(group('#ff7a59', { primary: '#ff7a59', bg: '#fff3ee', text: '#3a1f17' }));
    expect(t['bg']).toBe('#fff3ee');
    expect(t['text']).toBe('#3a1f17');
    expect(t['primary']).toBe('#ff7a59');
  });

  test('背景 bg→bgAlt 取主色到邻近色的轻微渐变（bgAlt 色相偏移）', () => {
    const t = deriveThemeTokens('#3b82f6');
    // bg / bgAlt 各自有效，且 bgAlt 派生值存在
    expect(t['bg']).toBeTruthy();
    expect(t['bgAlt']).toBeTruthy();
  });

  test('bgAlt 相对主色真实偏移 +12°（回归：色相单位混用导致偏移为空操作）', () => {
    for (const primary of ['#3b82f6', '#10b981', '#ff5d8f', '#1e3a5f']) {
      const t = deriveThemeTokens(primary);
      const bg = toHsl(t['bg'])!;
      const bgAlt = toHsl(t['bgAlt'])!;
      const delta = Math.round((bgAlt.h - bg.h + 360) % 360);
      expect(delta).toBe(12);
      // 且色相始终落在合法区间内（历史实现会输出 hsl(4481 …) 这类越界值）
      expect(bgAlt.h).toBeGreaterThanOrEqual(0);
      expect(bgAlt.h).toBeLessThan(360);
    }
  });

  test('明亮主色不再被误判为深底：夏莱蓝/晴空/泳装/青柠 派生浅底而非近黑', () => {
    // 回归：旧阈值 0.6 把这几个明度落在 0.5~0.6 之间的明亮主色误判为深底，
    // 背景派生为 12% 近黑。统一阈值下调后应为浅底（明度 > 0.7）。
    for (const primary of ['#3b82f6', '#38bdf8', '#3ec6e0', '#a3e635']) {
      const t = deriveThemeTokens(primary);
      const bgL = hslLightness(t['bg']);
      expect(bgL).toBeGreaterThan(0.7); // 浅底
      expect(hslLightness(t['text'])).toBeLessThan(0.3); // 深字
    }
  });

  test('中明度主色（翡翠/青碧/绯红/黄沙）也判定为明色', () => {
    // 回归：这些主色明度约 0.39~0.50，旧阈值会误判为深底糊上近黑。
    for (const primary of ['#10b981', '#14b8a6', '#e11d48', '#eab308']) {
      const t = deriveThemeTokens(primary);
      const bgL = hslLightness(t['bg']);
      expect(bgL).toBeGreaterThan(0.7); // 浅底
      expect(hslLightness(t['text'])).toBeLessThan(0.3); // 深字
    }
  });

  test('真深色主色（墨蓝）仍判定为深底', () => {
    const t = deriveThemeTokens('#1e3a5f');
    expect(hslLightness(t['bg'])).toBeLessThan(0.3); // 深底
    expect(hslLightness(t['text'])).toBeGreaterThan(0.7); // 白字
  });

  test('气泡左右底色不同，且各自文字色随底明度派生（亮底深字/暗底白字）', () => {
    // 亮主色（青柠）：player 气泡亮底 → 文字应为深字（非白）
    const light = deriveThemeTokens('#a3e635');
    expect(light['playerBubbleText']).not.toBe('#ffffff');
    expect(light['npcBubbleText']).toBe('#ffffff');
    // 暗主色（墨蓝）：player 气泡暗底 → 文字应为白
    const dark = deriveThemeTokens('#1e3a5f');
    expect(dark['playerBubbleText']).toBe('#ffffff');
    expect(dark['npcBubbleText']).toBe('#ffffff');
    // 左右气泡底色不同
    expect(light['playerBubble']).not.toBe(light['npcBubble']);
  });

  test('CT-04 对比度防呆：text/bg 对不足阈值时自动翻转', () => {
    // 极端仅给 primary，断言任何 primary 下最终 text/bg 对比度达标
    for (const primary of ['#ffffff', '#000000', '#808080', '#ff00ff', '#00ff00']) {
      const t = resolveTheme(group(primary));
      expect(contrastRatio(t['text'], t['bg'])).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('describeGroup：定义值 / 自动衍生值拆解（图鉴用）', () => {
  // 仅用纯函数式子集：ColorSystem.describeGroup 依赖 registry/mutations，
  // 这里直接构造轻量桩验证 source 判定与 autoConstructed 语义。
  function makeSystem() {
    const defs = new Map<string, any>();
    const reg = { colorGroups: defs } as any;
    const sys = new ColorSystem(reg, {} as any, () => ({}) as any, () => true);
    return { sys, defs };
  }

  test('仅给 primary（theme 缺省）→ 自动构造，且 primary 为主色位定义值', () => {
    const { sys, defs } = makeSystem();
    defs.set('g1', { id: 'g1', name: '自动蓝', compositionType: 'solid', slots: [{ role: 'primary', color: '#3b82f6' }] });
    const r = sys.describeGroup(defs.get('g1')!);
    expect(r.autoConstructed).toBe(true);
    const primary = r.tokens.find(t => t.key === 'primary')!;
    expect(primary.source).toBe('defined');
    expect(primary.value).toBe('#3b82f6');
    const bg = r.tokens.find(t => t.key === 'bg')!;
    expect(bg.source).toBe('derived');
    expect(bg.value).toBeTruthy();
  });

  test('显式补充非 primary token → 已被定义', () => {
    const { sys, defs } = makeSystem();
    defs.set('g2', { id: 'g2', name: '定制青', compositionType: 'solid', slots: [{ role: 'primary', color: '#10b981' }], theme: { primary: '#10b981', bg: '#eafff5', text: '#0c3a2b' } });
    const r = sys.describeGroup(defs.get('g2')!);
    expect(r.autoConstructed).toBe(false);
    expect(r.tokens.find(t => t.key === 'bg')!.source).toBe('defined');
    expect(r.tokens.find(t => t.key === 'bg')!.value).toBe('#eafff5');
    // 未显式给的 token 仍标记为衍生
    expect(r.tokens.find(t => t.key === 'border')!.source).toBe('derived');
  });

  test('primary 原样透传（取自 theme.primary）', () => {
    const { sys, defs } = makeSystem();
    defs.set('g3', { id: 'g3', name: 'x', compositionType: 'solid', slots: [{ role: 'primary', color: '#ff5d8f' }], theme: { primary: '#ff5d8f' } });
    const primary = sys.describeGroup(defs.get('g3')!).tokens.find(t => t.key === 'primary')!;
    expect(primary.source).toBe('defined');
    expect(primary.value).toBe('#ff5d8f');
  });
});
