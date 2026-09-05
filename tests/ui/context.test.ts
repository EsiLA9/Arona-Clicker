import { describe, expect, test } from 'vitest';
import { createUIContext } from '../../src/ui/context';
import { buildPresentationView, renderPresentationHostBackground } from '../../src/ui/presentation-service';
import { renderTabs } from '../../src/ui/components/tabs';

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
    expect(ctx.textColorModeForHost?.('missing', 'default')).toBe('auto');
    expect(ctx.presentationHostState('header.button', 'default')).toMatchObject({ textColorMode: 'light', source: 'default' });
    expect(ctx.presentationHostState('header.button', 'default').background.layers).toHaveLength(0);
  });

  test('状态明确设置 auto 时不继承宿主默认模式', () => {
    const presentation = buildPresentationView({ hosts: [{
      id: 'header.button',
      textColorMode: 'light',
      states: { inactive: { textColorMode: 'auto' } },
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);

    expect(ctx.textColorModeForHost?.('header.button', 'inactive')).toBe('auto');
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
    const presentation = buildPresentationView({ hosts: [{
      id: 'leftPanel.tab',
      textColorMode: 'dark',
      states: { active: { textColorMode: 'light' } },
    }] }, pics);
    const ctx = createUIContext(game, { layers: [] }, presentation);
    const html = renderTabs(ctx, 'left', [{ id: 'area', label: '区域' }, { id: 'contacts', label: '通讯录' }], 'area');

    expect(html).toContain('data-theme-state="active"');
    expect(html).toContain('data-theme-state="inactive"');
    expect(html).toContain('data-theme-text-mode="light"');
    expect(html).toContain('data-theme-text-mode="dark"');
  });

  test('区域宿主有图层时覆盖簇，未配置区域时回退簇', () => {
    const background = { layers: [{ kind: 'solid' as const, value: '#global', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] };
    const presentation = buildPresentationView({ hosts: [
      { id: 'leftPanel', layers: [{ id: 'cluster', kind: 'solid', value: '#abc' }] },
      { id: 'leftPanel.area', layers: [{ id: 'area', kind: 'solid', value: '#ace' }] },
    ] }, pics);
    const ctx = createUIContext(game, background, presentation);

    expect(ctx.backgroundForHost('leftPanel.area').layers.map(layer => layer.value)).toEqual(['linear-gradient(135deg, var(--bg) 0%, var(--bgAlt) 100%)', '#ace']);
    expect(ctx.backgroundForHost('leftPanel.contacts').layers.map(layer => layer.value)).toEqual(['linear-gradient(135deg, var(--bg) 0%, var(--bgAlt) 100%)', '#abc']);
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

  test('active、inactive、disabled 有专属图层时优先使用；active 缺失时回退主题色 2', () => {
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
    expect(createUIContext(game, { layers: [] }, fallback).backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toContain('var(--theme-palette-2, var(--theme-palette-1, var(--theme-node-primary)))');
  });

  test('没有控件宿主时，active 使用主题色 2 并回退主题色 1', () => {
    const ctx = createUIContext(game, { layers: [] }, buildPresentationView({}, pics));
    expect(ctx.backgroundForHost('header.button', false, 'active').layers.map(layer => layer.value)).toEqual([
      'var(--theme-palette-2, var(--theme-palette-1, var(--theme-node-primary)))',
    ]);
    expect(ctx.backgroundForHost('header.button', false, 'inactive').layers).toEqual([]);
    expect(renderPresentationHostBackground(ctx, 'header.button', 'presentation-host-background', 'active')).toContain('theme-palette-2');
  });
});
