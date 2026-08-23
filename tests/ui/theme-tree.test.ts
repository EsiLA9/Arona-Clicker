import { describe, test, expect } from 'vitest';
import { buildThemeVars, deriveNode, heroGradient, readableOn, THEME_NODES, type ThemeVarName } from '../../src/ui/theme-tree';
import { LIGHTNESS_THRESHOLD } from '../../src/engine/color-system';

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

  test('TREE-02 常量节点（语义色）直接透传，不衍生', () => {
    const vars = buildThemeVars(primary);
    expect(vars['lime']).toBe('#2ec494');
    expect(vars['orange']).toBe('#ffa94d');
    expect(vars['panel']).toBe('#ffffff');
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
    expect(light['ink-on-player-bubble']).toBe('hsl(220 18% 12%)');
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
