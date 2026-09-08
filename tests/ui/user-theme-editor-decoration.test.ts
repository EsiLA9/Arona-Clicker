import { describe, expect, test } from 'vitest';
import { createUIContext } from '../../src/ui/context';
import { renderUserThemeEditor, setPresentationHostState } from '../../src/ui/components/user-theme-editor';

const game = { world: {}, registry: {}, pics: { list: () => [] }, getView: () => ({}) } as never;

describe('用户主题编辑器：内嵌装饰线', () => {
  test('显示装饰线字段，并按当前状态区分覆盖与继承', () => {
    const ctx = createUIContext(game, { layers: [] });
    const session = {
      id: 'theme-editor-test',
      baseRevision: 0,
      readonly: false,
      draft: {
        version: 1 as const,
        presentation: {
          hosts: [{
            id: 'header.button',
            shape: 'rounded-parallelogram' as const,
            cornerRadius: 14,
            skewXDeg: -8,
            decoration: { color: '#123456', width: 2, inset: 4, opacity: .8, style: 'dashed' as const },
          }],
        },
      },
    };

    setPresentationHostState('header.button', 'default');
    const defaultHtml = renderUserThemeEditor(ctx, session, true, []);
    expect(defaultHtml).toContain('内嵌装饰线');
    expect(defaultHtml).toContain('data-user-theme-host-decoration-toggle="header.button" checked');
    expect(defaultHtml).toContain('边缘间距');
    expect(defaultHtml).toContain('data-user-theme-host-decoration-field="width"');
    expect(defaultHtml).toContain('value="2"');
    expect(defaultHtml).toContain('data-user-theme-host-corner-radius="header.button"');
    expect(defaultHtml).toContain('value="14"');
    expect(defaultHtml).toContain('data-user-theme-host-skew-x-deg="header.button"');
    expect(defaultHtml).toContain('value="-8"');

    setPresentationHostState('header.button', 'active');
    const activeHtml = renderUserThemeEditor(ctx, session, true, []);
    expect(activeHtml).toContain('继承默认态');
    expect(activeHtml).toContain('data-user-theme-host-decoration-toggle="header.button"');
  });
});
