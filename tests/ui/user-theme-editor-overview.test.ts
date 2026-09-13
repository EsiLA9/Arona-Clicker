import { describe, expect, test } from 'vitest';
import { createUIContext } from '../../src/ui/context';
import { renderUserThemeEditor } from '../../src/ui/components/user-theme-editor';

const game = { world: {}, registry: {}, pics: { list: () => [] }, getView: () => ({}) } as never;

describe('用户主题编辑器：主题摘要', () => {
  test('摘要显示当前覆盖数量，并提供回到对应编辑分区的目标', () => {
    const ctx = createUIContext(game, { layers: [] });
    const html = renderUserThemeEditor(ctx, {
      id: 'theme-editor-overview-test',
      baseRevision: 0,
      readonly: false,
      draft: {
        version: 1,
        palette: ['#123456', '#abcdef'],
        tokens: { accent: '#fedcba' },
        scopes: { center: { active: '#00ff00' } },
        presentation: {
          hosts: [{ id: 'centerPanel', layers: [] }],
          components: [{ id: 'portrait', parent: 'centerPanel', anchor: 'center' }],
        },
      },
    }, true, ['base:enhancement:user-theme-editor']);

    expect(html).toContain('class="user-theme-overview"');
    expect(html).toContain('data-theme-editor-overview-filter="palette"');
    expect(html).toContain('data-theme-editor-overview-filter="semantic"');
    expect(html).toContain('data-theme-editor-overview-filter="scope"');
    expect(html).toContain('data-theme-editor-overview-filter="layers"');
    expect(html).toContain('data-theme-editor-overview-filter="placement"');
    expect(html).toContain('主题色');
    expect(html).toContain('2/6');
    expect(html).toContain('当前：#fedcba · 清除后：主题色 2（无色时回退主题色 1）');
    expect(html).toContain('当前：#00ff00 · 清除后：继承根主题节点');
    expect(html).toContain('实时预览中');
    expect((html.match(/data-theme-layer-manager-shell/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-theme-layer-editor-dialog/g) ?? [])).toHaveLength(1);
    expect(html).toContain('data-theme-layer-manager-target-host="centerPanel"');
    expect(html).not.toContain('data-user-theme-background-field');
    expect(html).not.toContain('data-user-theme-host-field');
  });
});
