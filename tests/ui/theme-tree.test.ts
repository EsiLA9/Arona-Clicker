import { describe, test, expect } from 'vitest';
import {
  buildThemeVars,
  deriveNode,
  heroGradient,
  readableOn,
  THEME_NODES,
  buildThemeTree,
  themeTreeToInlineStyle,
  applyThemeTree,
  clearThemeTree,
  themeTreeFromGroup,
  themeTreeFromThemeDef,
  type ThemeVarName,
  type ThemeTree,
} from '../../src/ui/theme-tree';
import { LIGHTNESS_THRESHOLD } from '../../src/arona-clicker/services/color-system';
import type { ColorGroupId } from '../../src/engine/types';
import type { ColorGroupDef } from '../../src/data-services/contracts/color';

describe('theme-tree：色彩树设定工具', () => {
  const primary = '#3b9eff';

  test('TREE-01 含 acRef 的节点生成「引擎强制优先、否则自动衍生」的 var 链', () => {
    const vars = buildThemeVars(primary);
    // ink 对齐 --ac-text：引擎给了用、否则用衍生值
    expect(vars['ink']).toMatch(/^var\(--ac-text, /);
    expect(vars['cyan']).toBe('var(--ac-primary, #3b9eff)');
    // primary-rgb 对齐 --ac-primary-rgb
    expect(vars['primary-rgb']).toMatch(/^var\(--ac-primary-rgb, \d+, \d+, \d+\)$/);
  });

  test('TREE-02 常量节点（语义色）直接透传，不衍生；panel 已改为可被 token 覆盖的 var 链', () => {
    const vars = buildThemeVars(primary);
    expect(vars['lime']).toBe('#2ec494');
    expect(vars['orange']).toBe('#ffa94d');
    // panel 原有 constant 现作为 fallback：var(--ac-panel, #ffffff)
    expect(vars['panel']).toBe('var(--ac-panel, #ffffff)');
  });

  test('TREE-03 任意节点可强制设色（overrides 优先级最高）', () => {
    const vars = buildThemeVars(primary, { ink: '#ff0000', muted: '#123456' });
    expect(vars['ink']).toBe('#ff0000');      // 强制，不走 var 链
    expect(vars['muted']).toBe('#123456');    // 强制
    // 未覆盖节点仍正常衍生 / 对齐 acRef
    expect(vars['cyan']).toMatch(/^var\(--ac-primary, /);
  });

  test('TREE-04 overrides 只影响指定节点，不污染其他节点', () => {
    const base = buildThemeVars(primary);
    const forced = buildThemeVars(primary, { 'ink-strong': '#000' });
    for (const name of Object.keys(THEME_NODES) as ThemeVarName[]) {
      if (name === 'ink-strong') continue;
      expect(forced[name]).toBe(base[name]);
    }
  });

  test('TREE-05 deriveNode 返回纯自动衍生值（忽略 acRef 强制层）', () => {
    // ink 的衍生值是 hsl 形式，不应含 var(--ac-text
    expect(deriveNode('ink', primary)).not.toMatch(/var\(/);
    expect(deriveNode('lime', primary)).toBe('#2ec494');
    // npc-bubble 衍生基于 primary 的 HSL，随 primary 变化
    const a = deriveNode('npc-bubble', '#3b9eff');
    const b = deriveNode('npc-bubble', '#ff5d8f');
    expect(a).not.toBe(b);
  });

  test('TREE-06 ink-strong 依赖 ink，形成派生树边', () => {
    const vars = buildThemeVars(primary);
    expect(vars['ink-strong']).toMatch(/var\(--ink, /);
  });

  test('TREE-07 背景节点按实际背景判定生成确定性 --ink-on-<name> 与 --muted-on-<name>', () => {
    const vars = buildThemeVars(primary);
    // panel 恒白 → 黑字；panel-light/canvas 默认亮底 → 黑字
    expect(vars['ink-on-panel']).toBe('hsl(220 18% 12%)');
    expect(vars['ink-on-panel-light']).toBe('hsl(220 18% 12%)');
    expect(vars['ink-on-canvas']).toBe('hsl(220 18% 12%)');
    // 弱化字色基于 ink-on 派生（color-mix 已被广泛支持，无跨浏览器风险）
    expect(vars['muted-on-panel']).toBe('color-mix(in srgb, hsl(220 18% 12%) 58%, transparent)');
    expect(vars['muted-on-canvas']).toBe('color-mix(in srgb, hsl(220 18% 12%) 58%, transparent)');
  });

  test('TREE-08 背景明暗决定文字黑/白：暗底→白字', () => {
    // overrides 覆盖背景本身 → 背景变暗 → 文字变白（确定性，非浏览器运行时）
    const vars = buildThemeVars(primary, { panel: '#101828' });
    expect(vars['panel']).toBe('#101828');
    expect(vars['ink-on-panel']).toBe('#ffffff');
    expect(vars['muted-on-panel']).toBe('color-mix(in srgb, #ffffff 58%, transparent)');
    expect(readableOn('#101828')).toBe('#ffffff');
  });

  test('TREE-09 引擎真实 token 优先判定背景明暗（深色背景→白字）', () => {
    // 引擎显式给出深色 bg → canvas 翻为白字
    const tokens = { primary: '#3b9eff', bg: '#0d1220' };
    const vars = buildThemeVars(primary, {}, tokens);
    expect(vars['ink-on-canvas']).toBe('#ffffff');
    expect(readableOn('#0d1220')).toBe('#ffffff');
  });

  test('TREE-10 readableOn 直接按背景色返回白/黑', () => {
    expect(readableOn('#0d1220')).toBe('#ffffff');
    expect(readableOn('#f5f9ff')).toBe('hsl(220 18% 12%)');
  });

  test('TREE-10b 引擎 HSL 阈值保持原值（token 派生用），UI 感知亮度另设', () => {
    // 引擎层 LIGHTNESS_THRESHOLD（HSL 明度模型）用于 primary→token 派生，保持原值
    expect(LIGHTNESS_THRESHOLD).toBe(0.38);
  });

  test('TREE-10c 感知亮度判定：中等蓝色判为暗底 → 白字（#3d83f2）', () => {
    // #3d83f2 的 HSL 明度≈0.59（旧模型判亮底黑字），但感知亮度 Y≈0.24 偏低
    // → 应判为暗底，其上文本用白色（send-bubble/chat-bubble 需求）
    expect(readableOn('#3d83f2')).toBe('#ffffff');
    // 夏莱蓝 #3b82f6 感知亮度与 #3d83f2 几乎相同 → 同为白字（一致性）
    expect(readableOn('#3b82f6')).toBe('#ffffff');
    // 深底 → 白字；近白底 → 黑字
    expect(readableOn('#101828')).toBe('#ffffff');
    expect(readableOn('#f5f9ff')).toBe('hsl(220 18% 12%)');
  });

  test('TREE-10d 感知亮度达到 0.75 后才切换为深色文字', () => {
    expect(readableOn('#e0e0e0')).toBe('#ffffff');
    expect(readableOn('#e1e1e1')).toBe('hsl(220 18% 12%)');
  });

  test('TREE-11 resource-bar 使用的 panel-light 背景感知文字：暗化时翻白字', () => {
    // resource-bar 以 panel-light 为背景，其 data-resource 文本消费 --ink-on-panel-light
    const light = buildThemeVars(primary);
    expect(light['ink-on-panel-light']).toBe('hsl(220 18% 12%)');
    const dark = buildThemeVars(primary, { 'panel-light': '#101828' });
    expect(dark['ink-on-panel-light']).toBe('#ffffff');
    expect(dark['muted-on-panel-light']).toBe('color-mix(in srgb, #ffffff 58%, transparent)');
  });

  test('TREE-11b player-bubble 背景节点生成 --ink-on-player-bubble，随背景明暗翻字色', () => {
    const light = buildThemeVars(primary);
    expect(light['ink-on-player-bubble']).toBe('#ffffff');
    const dark = buildThemeVars(primary, { 'player-bubble': '#101828' });
    expect(dark['ink-on-player-bubble']).toBe('#ffffff');
  });

  test('TREE-11d send-bubble/chat-bubble 背景 #3d83f2 时，其内文本变白', () => {
    // 通过引擎 token 注入 playerBubble = #3d83f2（send-bubble/chat-bubble 背景）
    const vars = buildThemeVars(primary, {}, { playerBubble: '#3d83f2' });
    expect(vars['ink-on-player-bubble']).toBe('#ffffff');
    // 弱化字色同样基于白字派生，保证可读
    expect(vars['muted-on-player-bubble']).toBe('color-mix(in srgb, #ffffff 58%, transparent)');
    // 局部 token 覆盖同路径：area/theme 里自定义 playerBubble 也能正确翻转
    const vars2 = buildThemeVars(primary, { 'player-bubble': '#3d83f2' });
    expect(vars2['ink-on-player-bubble']).toBe('#ffffff');
  });

  test('TREE-11c 墨蓝深色主题：canvas/panel-light 深底翻白字、panel 白底黑字', () => {
    // 复刻墨蓝 #1e3a5f 的引擎 tokens（深色背景 + 浅色文字 token）
    const tokens = { primary: '#1e3a5f', bg: 'hsl(214 6% 12%)', bgAlt: 'hsl(226 8% 17%)' };
    const vars = buildThemeVars('#1e3a5f', {}, tokens);
    // 深色 canvas / panel-light → 白字
    expect(vars['ink-on-canvas']).toBe('#ffffff');
    expect(vars['ink-on-panel-light']).toBe('#ffffff');
    // panel 恒白 → 黑字
    expect(vars['ink-on-panel']).toBe('hsl(220 18% 12%)');
  });

  test('TREE-11d panel token 覆盖 → 引擎 token 可设深色面板、ink-on 随之翻转为白字', () => {
    // 无 panel token：fallback 白底 → 黑字
    const no = buildThemeVars(primary);
    expect(no['panel']).toBe('var(--ac-panel, #ffffff)');
    expect(no['ink-on-panel']).toBe('hsl(220 18% 12%)');
    // 引擎 token 注入深色 panel → 白字（ink-on 按实际色判定，而非 fallback）
    const withToken = buildThemeVars(primary, {}, { panel: '#101828' });
    expect(withToken['panel']).toBe('var(--ac-panel, #ffffff)');
    expect(withToken['ink-on-panel']).toBe('#ffffff');
    // overrides 仍最高优先级
    const overridden = buildThemeVars(primary, { panel: '#222' });
    expect(overridden['panel']).toBe('#222');
    expect(overridden['ink-on-panel']).toBe('#ffffff');
  });

  test('TREE-12 heroGradient 以主题 primary 为光晕、基底随 canvas/panel-light', () => {
    const g = heroGradient(primary);
    expect(g).toContain('linear-gradient(125deg');
    expect(g).toContain('var(--canvas)');
    expect(g).toContain('var(--panel-light)');
    // 引擎显式主色应进光晕
    const g2 = heroGradient('#abcdef', { primary: '#123456' });
    expect(g2).toContain('color-mix(in srgb, #123456 22%, transparent)');
  });
});

// ============================================================================
// ThemeTree：实体自有的"参考树"快照 / 快速映射 / 作用域绕过
// ============================================================================

/** 轻量假元素（node 环境无 jsdom；仅验证 setProperty/removeProperty 落值）。 */
function fakeEl() {
  const store: Record<string, string> = {};
  return {
    style: {
      setProperty: (k: string, v: string) => { store[k] = v; },
      removeProperty: (k: string) => { delete store[k]; },
    },
    _store: store,
  };
}

describe('theme-tree：ThemeTree 快照与快速映射', () => {
  const tokens = { primary: '#3b82f6', bg: '#eef2ff', text: '#0c1230' };

  test('TREE-13 buildThemeTree 透传 --ac-* 引擎 token + 展开语义节点 + hero', () => {
    const tree = buildThemeTree(tokens);
    expect(tree['--ac-primary']).toBe('#3b82f6');
    expect(tree['--ac-bg']).toBe('#eef2ff');
    // 语义节点由 buildThemeVars 展开
    expect(tree['ink']).toBeTruthy();
    expect(tree['panel']).toBeTruthy();
    expect(tree['--hero-gradient']).toContain('linear-gradient');
  });

  test('TREE-14 buildThemeTree 以 tokens.primary 为默认 primary 节点', () => {
    const tree = buildThemeTree({ primary: '#abcdef' });
    expect(tree['cyan']).toBe('var(--ac-primary, #abcdef)');
    expect(tree['--ac-primary']).toBe('#abcdef');
  });

  test('TREE-15 themeTreeToInlineStyle 序列化为 CSS 变量串（绕过参考树直接 fill styles）', () => {
    const tree = buildThemeTree(tokens);
    const css = themeTreeToInlineStyle(tree);
    expect(css).toContain('--ac-primary:#3b82f6');
    expect(css).toContain('--ink:');
    expect(css).toContain('--canvas:');
    expect(css).toContain(';');
    expect(css.endsWith(';')).toBe(false); // 末位无多余分号
  });

  test('TREE-16 applyThemeTree 在容器上落变量、clearThemeTree 清除', () => {
    const el = fakeEl();
    const tree: ThemeTree = { '--ac-primary': '#3b82f6', '--ink': '#000' };
    applyThemeTree(el as any, tree);
    expect((el as any)._store['--ac-primary']).toBe('#3b82f6');
    expect((el as any)._store['--ink']).toBe('#000');
    clearThemeTree(el as any, tree);
    expect((el as any)._store['--ac-primary']).toBeUndefined();
    expect((el as any)._store['--ink']).toBeUndefined();
  });

  const blue: ColorGroupDef = { id: 'test:colorgroup:g-blue', name: '蓝', compositionType: 'solid', slots: [{ role: 'primary', color: '#3b82f6' }] };
  const pink: ColorGroupDef = { id: 'g-pink', name: '粉', compositionType: 'solid', slots: [{ role: 'primary', color: '#ff5d8f' }] };
  const getGroup = (id: ColorGroupId): ColorGroupDef | undefined =>
    ({ 'test:colorgroup:g-blue': blue, 'g-pink': pink } as Record<string, ColorGroupDef>)[id];

  test('TREE-17 themeTreeFromGroup：直接用主色位色值解析整包 token', () => {
    const group: ColorGroupDef = {
      id: 'g', name: 'g', compositionType: 'gradient',
      slots: [
        { role: 'secondary', color: '#ff5d8f' },
        { role: 'primary', color: '#3b82f6' },
      ],
    };
    const tree = themeTreeFromGroup(group);
    expect(tree['--ac-primary']).toBe('#3b82f6');
    // 整包 token 也展开
    expect(tree['--ac-bg']).toBeTruthy();
  });

  test('TREE-18 themeTreeFromThemeDef：colorGroupId 打底 + tokens 覆盖', () => {
    const tree = themeTreeFromThemeDef({ colorGroupId: 'test:colorgroup:g-blue', tokens: { bg: '#101828' } }, getGroup);
    expect(tree['--ac-primary']).toBe('#3b82f6');
    expect(tree['--ac-bg']).toBe('#101828');
  });

  test('TREE-19 themeTreeFromThemeDef：undefined → 仅默认派生（primary 缺省）', () => {
    const tree = themeTreeFromThemeDef(undefined, getGroup);
    // tokens 为空 → 无 --ac-* 透传，但语义节点仍以默认 primary 派生
    expect(tree['--ac-primary']).toBeUndefined();
    expect(tree['cyan']).toBe('var(--ac-primary, #3b9eff)'); // 默认主色兜底
    expect(tree['ink']).toBeTruthy();
  });
});
