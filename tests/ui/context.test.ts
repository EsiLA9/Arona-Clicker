import { describe, expect, test } from 'vitest';
import { createUIContext } from '../../src/ui/runtime/context';
import { buildPresentationView, renderPresentationHostBackground } from '../../src/ui/presentation/presentation-service';
import { renderPanelTabsRegion } from '../../src/ui/components/shared/tabs';

const game = { world: {}, registry: {}, getView: () => ({}) } as never;
const pics = {
  urlOf: () => undefined,
  defOf: () => undefined,
};

describe('UIContext：簇与当前区域宿主', () => {
  test('文字颜色模式按状态 > default > auto 解析，default 状态可显式覆盖', () => {
    const presentation = buildPresentationView({ hosts: [{
      id: 'header.button',
      textColorMode: 'dark',
      states: {
        default: { textColorMode: 'light' },
        active: { textColorMode: 'dark' },
        inactive: {},
      },
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    expect(ctx.textColorModeForHost?.('header.button', 'default')).toBe('light');
    expect(ctx.textColorModeForHost?.('header.button', 'active')).toBe('dark');
    expect(ctx.textColorModeForHost?.('header.button', 'inactive')).toBe('light');
    expect(ctx.hoverTextColorModeForHost('header.button')).toBe('dark');
    expect(ctx.textColorModeForHost?.('missing', 'default')).toBe('auto');
    expect(ctx.presentationHostState('header.button', 'default')).toMatchObject({ textColorMode: 'light', source: 'default' });
    expect(ctx.presentationHostState('header.button', 'default').background.layers.map(layer => layer.value))
      .toEqual(['var(--theme-node-panel, #ffffff)']);
  });

  test('状态明确设置 auto 时不继承宿主默认模式，改按自身背景合成判定', () => {
    const presentation = buildPresentationView({ hosts: [{
      id: 'header.button',
      textColorMode: 'light',
      states: { inactive: { textColorMode: 'auto' } },
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    // auto 不继承宿主默认的 light，而是按自身背景合成判定；
    // 该 ctx 未带作用域变量表 → 不判定 var() 图层，保持 auto（保守回退）
    expect(ctx.textColorModeForHost?.('header.button', 'inactive')).toBe('auto');

    // 自动生成的语义基底仍沿用语义文字色；变量表不改变 auto 的语义。
    const scoped = createUIContext(game, {
      layers: [],
      themeVars: { '--theme-node-panel-light': '#e4e8ee' },
    }, presentation);
    expect(scoped.textColorModeForHost?.('header.button', 'inactive')).toBe('auto');
    expect(scoped.presentationHostState('header.button', 'inactive').ink).toBeNull();
    expect(scoped.presentationHostState('header.button', 'inactive').background.layers.map(layer => layer.value))
      .toEqual(['var(--theme-node-panel-light, var(--theme-node-panel, #ffffff))']);
  });

  test('auto 按宿主多图层背景的合成色判定文字模式', () => {
    const presentation = buildPresentationView({ hosts: [
      {
        id: 'header.button',
        layers: [{ id: 'storm', kind: 'gradient', value: 'linear-gradient(135deg, #0b1020 0%, #101828 100%)', opacity: 0.9 }],
      },
    ] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    const state = ctx.presentationHostState('header.button');
    expect(state.ink?.light).toBe(false);
    expect(state.textColorMode).toBe('light');
    expect(ctx.textColorModeForHost?.('header.button')).toBe('light');
  });

  test('无自有背景的宿主维持 auto，避免用页面底色误判语义色节点', () => {
    const background = { layers: [{
      kind: 'solid' as const, value: '#0b1020', opacity: 1, position: 'center', size: 'cover',
      repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed',
    }] };
    const presentation = buildPresentationView({ hosts: [{ id: 'centerPanel.tab' }] }, pics);
    const ctx = createUIContext(game, background, presentation);

    expect(ctx.textColorModeForHost('centerPanel.tab')).toBe('auto');
    expect(ctx.presentationHostState('centerPanel.tab').ink).toBeNull();
  });

  test('auto 对自动生成的语义基底保持 auto，不用作用域变量表推断语义文字色', () => {
    const presentation = buildPresentationView({ hosts: [{ id: 'header.button' }] }, pics);
    // 顶栏按钮无自有图层，使用自动生成的语义面板底色；文字继续由语义 CSS 决定。
    const selector = createUIContext(game, {
      layers: [],
      themeVars: { '--theme-node-panel-light': 'hsl(161 14% 17%)' },
    }, presentation);
    expect(selector.textColorModeForHost('header.button', 'inactive')).toBe('auto');
    expect(selector.presentationHostState('header.button', 'inactive').ink).toBeNull();

    const gamePage = createUIContext(game, {
      layers: [],
      themeVars: { '--theme-node-panel-light': '#e4e8ee' },
    }, presentation);
    expect(gamePage.textColorModeForHost('header.button', 'inactive')).toBe('auto');
  });

  test('inactive 显式模式优先于默认态的 auto、light 或 dark', () => {
    for (const defaultMode of ['auto', 'light', 'dark'] as const) {
      const presentation = buildPresentationView({ hosts: [{
        id: 'header.button',
        textColorMode: defaultMode,
        states: { inactive: { textColorMode: 'light' } },
      }] }, pics);
      const ctx = createUIContext(game, { layers: [] }, presentation);
      expect(ctx.textColorModeForHost('header.button', 'inactive')).toBe('light');
    }
  });

  test('Tab 渲染同时写入语义状态与解析后的文字模式', () => {
    const presentation = buildPresentationView({ hosts: [
      { id: 'leftPanel.tabs', layers: [{ kind: 'solid', value: '#abc' }] },
      {
        id: 'leftPanel.tab',
        textColorMode: 'dark',
        states: { active: { textColorMode: 'light' } },
      },
    ] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);
    const html = renderPanelTabsRegion(ctx, 'left', [{ id: 'area', label: '区域' }, { id: 'contacts', label: '通讯录' }], 'area');

    expect(html).toContain('data-theme-state="active"');
    expect(html).toContain('data-theme-state="inactive"');
    expect(html).toContain('data-theme-text-mode="light"');
    expect(html).toContain('data-theme-text-mode="dark"');
    expect(html).toContain('data-theme-host-id="leftPanel.tabs"');
    expect(html).toContain('panel-tabs-region presentation-host-target');
    expect(html).toContain('class="presentation-host-background"');
    expect(html).not.toContain('switch-tabs presentation-host-target');
    expect(html).toContain('class="switch-tabs-content" role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    const inactiveButton = html.match(/<button\b(?=[^>]*data-theme-state="inactive")[^>]*>/)?.[0];
    expect(inactiveButton).toContain('data-theme-hover-text-mode="light"');
  });

  test('区域宿主使用自己的图层；未配置时生成语义底色而不继承簇或全局图层', () => {
    const background = { layers: [{ kind: 'solid' as const, value: '#global', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] };
    const presentation = buildPresentationView({ hosts: [
      { id: 'leftPanel', layers: [{ id: 'cluster', kind: 'solid', value: '#abc' }] },
      { id: 'leftPanel.area', layers: [{ id: 'area', kind: 'solid', value: '#ace' }] },
    ] }, pics);
    const ctx = createUIContext(game, background, presentation);

    expect(ctx.backgroundForHost('leftPanel.area').layers.map(layer => layer.value)).toEqual(['#ace']);
    expect(ctx.backgroundForHost('leftPanel.contacts').layers.map(layer => layer.value)).toEqual(['var(--theme-node-panel, #ffffff)']);
  });

  test('active 未覆盖时继承宿主默认态，有覆盖时优先使用 active 图层', () => {
    const background = { layers: [{ kind: 'solid' as const, value: '#global', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] };
    const presentation = buildPresentationView({ hosts: [{
      id: 'leftPanel.tab',
      layers: [{ id: 'default', kind: 'solid', value: '#abc' }],
      states: { active: { layers: [{ id: 'active', kind: 'solid', value: '#ace' }] } },
    }] }, pics);
    const ctx = createUIContext(game, background, presentation);

    expect(ctx.backgroundForHost('leftPanel.tab', true, 'default').layers.map(layer => layer.value)).toContain('#abc');
    expect(ctx.backgroundForHost('leftPanel.tab', true, 'active').layers.map(layer => layer.value)).toContain('#ace');
    expect(ctx.backgroundForHost('leftPanel.tab', true, 'disabled').layers.map(layer => layer.value)).toContain('#abc');
  });

  test('active、inactive、disabled 有专属图层时优先使用；active 缺失时使用本宿主默认层', () => {
    const presentation = buildPresentationView({ hosts: [{
      id: 'header.button',
      layers: [{ id: 'default', kind: 'solid', value: '#abc' }],
      states: {
        active: { layers: [{ id: 'active', kind: 'solid', value: '#f00' }] },
        inactive: { layers: [{ id: 'inactive', kind: 'solid', value: '#0f0' }] },
        disabled: { layers: [{ id: 'disabled', kind: 'solid', value: '#888' }] },
      },
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);
    expect(ctx.backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toContain('#f00');
    expect(ctx.backgroundForHost('header.button', false, 'inactive').layers.map(layer => layer.value)).toContain('#0f0');
    expect(ctx.backgroundForHost('header.button', false, 'disabled').layers.map(layer => layer.value)).toContain('#888');
    const fallback = buildPresentationView({ hosts: [{ id: 'header.button', layers: [{ kind: 'solid', value: '#abc' }] }] }, pics);
    expect(createUIContext(game, { layers: [] }, fallback).backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toEqual(['#abc']);
  });

  test('active 新增图层保留默认宿主图层，并按同 ID 覆盖', () => {
    const presentation = buildPresentationView({ hosts: [{
      id: 'header.button',
      layers: [{ id: 'base', kind: 'solid', value: '#abc' }, { id: 'replace', kind: 'solid', value: '#def' }],
      states: { active: { layers: [{ id: 'replace', kind: 'solid', value: '#fed' }, { id: 'extra', kind: 'solid', value: '#123' }] } },
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    expect(ctx.backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toContain('#abc');
    expect(ctx.backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toContain('#fed');
    expect(ctx.backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toContain('#123');
    expect(ctx.backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).not.toContain('#def');
  });

  test('子宿主缺少状态覆盖时使用自身默认图层，不复用父宿主图层或装饰', () => {
    const presentation = buildPresentationView({ hosts: [
      { id: 'leftPanel', layers: [{ id: 'base', kind: 'solid', value: '#abc' }], decoration: { color: '#f0f', width: 2 }, states: { active: { layers: [{ id: 'parent-active', kind: 'solid', value: '#ace' }], decoration: { color: '#f0f', width: 3 } } } },
      { id: 'leftPanel.area', layers: [{ id: 'area-base', kind: 'solid', value: 'var(--theme-node-panel)' }] },
    ] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    const active = ctx.backgroundForHost('leftPanel.area', false, 'active');
    expect(active.layers.map(layer => layer.value)).toEqual(['var(--theme-node-panel)']);
    expect(active.decoration).toBeUndefined();
    expect(ctx.backgroundForHost('leftPanel.area', false, 'default').layers.map(layer => layer.value)).toEqual(['var(--theme-node-panel)']);
  });

  test('子宿主没有自有默认层和状态层时沿用主题色 active 默认表现', () => {
    const presentation = buildPresentationView({ hosts: [
      { id: 'leftPanel', layers: [{ id: 'base', kind: 'solid', value: '#abc' }], states: { active: { layers: [{ id: 'parent-active', kind: 'solid', value: '#ace' }] } } },
      { id: 'leftPanel.area', layers: [] },
    ] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    expect(ctx.backgroundForHost('leftPanel.area', false, 'active').layers.map(layer => layer.value)).toEqual([
      'var(--theme-palette-2, var(--theme-palette-1, var(--theme-node-primary)))',
    ]);
  });

  test('没有控件宿主时，active 使用主题色 2，非 active 使用主题基本背景色', () => {
    const ctx = createUIContext(game, { layers: [] }, buildPresentationView({}, pics));
    expect(ctx.backgroundForHost('header.button', false, 'default').layers.map(layer => layer.value)).toEqual([
      'var(--theme-node-panel, #ffffff)',
    ]);
    expect(ctx.backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toEqual([
      'var(--theme-palette-2, var(--theme-palette-1, var(--theme-node-primary)))',
    ]);
    expect(ctx.backgroundForHost('header.button', false, 'inactive').layers.map(layer => layer.value)).toEqual([
      'var(--theme-node-panel-light, var(--theme-node-panel, #ffffff))',
    ]);
    const activeHtml = renderPresentationHostBackground(ctx, 'header.button', 'presentation-host-background', 'active');
    expect(activeHtml).toContain('theme-palette-2');
    expect(activeHtml).not.toContain('presentation-host-hover-layer');
    const inactiveHtml = renderPresentationHostBackground(ctx, 'header.button', 'presentation-host-background', 'inactive');
    expect(inactiveHtml).toContain('data-presentation-layer-kind="base"');
    expect(inactiveHtml).toContain('data-presentation-layer-kind="hover"');
    expect(inactiveHtml).toContain('theme-palette-2');
  });

  test('空表现宿主与未创建宿主保持默认与 active 回退一致', () => {
    const noHost = createUIContext(game, { layers: [] }, buildPresentationView({}, pics));
    const emptyHost = createUIContext(game, { layers: [] }, buildPresentationView({ hosts: [{ id: 'header.button', layers: [] }] }, pics));

    for (const state of ['default', 'inactive', 'active'] as const) {
      expect(emptyHost.backgroundForHost('header.button', false, state)).toEqual(noHost.backgroundForHost('header.button', false, state));
    }
  });

  test('宿主形状进入只读视图并随背景渲染标记', () => {
    const presentation = buildPresentationView({ hosts: [{ id: 'card', shape: 'rounded-parallelogram', cornerRadius: 14, skewXDeg: -8, layers: [{ kind: 'solid', value: '#abc' }] }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    expect(ctx.backgroundForHost('card', false).shape).toBe('rounded-parallelogram');
    expect(ctx.backgroundForHost('card', false)).toMatchObject({ cornerRadius: 14, skewXDeg: -8 });
    expect(renderPresentationHostBackground(ctx, 'card')).toContain('data-presentation-shape=\"rounded-parallelogram\"');
    expect(renderPresentationHostBackground(ctx, 'card')).toContain('data-presentation-geometry=\"custom\"');
    expect(renderPresentationHostBackground(ctx, 'card')).toContain('--presentation-corner-radius:14px');
    expect(renderPresentationHostBackground(ctx, 'card')).toContain('--presentation-skew-x:-8deg');
  });

  test('装饰线按 default 与状态字段合并，并渲染在背景节点内部', () => {
    const presentation = buildPresentationView({ hosts: [{
      id: 'header.button',
      decoration: { color: '#abc', width: 2, inset: 4, opacity: .8, style: 'solid' },
      layers: [{ id: 'base', kind: 'solid', value: '#fff' }],
      states: { active: { decoration: { color: '#def', width: 3 } } },
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    expect(ctx.backgroundForHost('header.button', false, 'default').decoration).toMatchObject({ color: '#abc', width: 2, inset: 4, opacity: .8 });
    expect(ctx.backgroundForHost('header.button', false, 'active').decoration).toMatchObject({ color: '#def', width: 3, inset: 4, opacity: .8 });
    const html = renderPresentationHostBackground(ctx, 'header.button', 'presentation-host-background', 'active');
    expect(html).toContain('presentation-host-decoration');
    expect(html).toContain('--presentation-decoration-color:#def');
    expect(html).toContain('--presentation-decoration-inset:4px');
  });

  test('装饰线未声明边缘间距时贴合宿主形状边缘', () => {
    const presentation = buildPresentationView({ hosts: [{
      id: 'header.button',
      shape: 'rounded-parallelogram',
      decoration: { color: '#abc', width: 2 },
      layers: [{ kind: 'solid', value: '#fff' }],
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    const html = renderPresentationHostBackground(ctx, 'header.button');
    expect(html).toContain('data-presentation-shape="rounded-parallelogram"');
    expect(html).toContain('--presentation-decoration-inset:0px');
  });

  test('没有装饰线配置时不输出装饰节点', () => {
    const ctx = createUIContext(game, { layers: [] }, buildPresentationView({ hosts: [{ id: 'card', layers: [{ kind: 'solid', value: '#fff' }] }] }, pics));
    expect(renderPresentationHostBackground(ctx, 'card')).not.toContain('presentation-host-decoration');
  });
});
