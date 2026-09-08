import { describe, expect, test } from 'vitest';
import { createUIContext } from '../../src/ui/context';
import { renderUserThemeEditor, setPresentationHostState } from '../../src/ui/components/user-theme-editor';

const game = { world: {}, registry: {}, pics: { list: () => [] }, getView: () => ({}) } as never;

const layer = (id: string, value: string) => ({
  id,
  kind: 'solid' as const,
  value,
  opacity: 1,
  position: 'center' as const,
  size: 'cover' as const,
  repeat: 'no-repeat' as const,
  blendMode: 'normal' as const,
  attachment: 'fixed' as const,
});

describe('用户主题编辑器：图层排序', () => {
  test('按实际视觉层级从上到下显示，而不是把底层显示在顶部', () => {
    const ctx = createUIContext(game, { layers: [] });
    const session = {
      id: 'theme-editor-layer-order-test',
      baseRevision: 0,
      readonly: false,
      draft: {
        version: 1 as const,
        background: [layer('bottom', '#111111'), layer('top', '#222222')],
        backgroundLayerOrder: ['system-color-background', 'bottom', 'top'],
        presentation: {
          hosts: [{
            id: 'header.button',
            layers: [layer('bottom', '#111111'), layer('top', '#222222')],
            layerOrder: ['system-color-background', 'bottom', 'top'],
          }],
        },
      },
    };

    setPresentationHostState('header.button', 'default');
    const html = renderUserThemeEditor(ctx, session, true, []);

    expect(html.indexOf('<summary>top</summary>')).toBeLessThan(html.indexOf('<summary>bottom</summary>'));
    expect(html.indexOf('data-user-theme-host-layer="header.button:1"')).toBeLessThan(html.indexOf('data-user-theme-host-layer="header.button:0"'));
  });

  test('系统层位于用户层之间时，移动按钮仍按完整堆栈启用', () => {
    const ctx = createUIContext(game, { layers: [] });
    const session = {
      id: 'theme-editor-layer-order-between-test',
      baseRevision: 0,
      readonly: false,
      draft: {
        version: 1 as const,
        background: [layer('bottom', '#111111'), layer('top', '#222222')],
        backgroundLayerOrder: ['bottom', 'top', 'system-color-background'],
        presentation: { hosts: [] },
      },
    };

    const html = renderUserThemeEditor(ctx, session, true, []);

    expect(html).toMatch(/data-user-theme-background-move="1" data-direction="down"\s*>/);
  });
});
