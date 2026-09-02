import { describe, expect, it } from 'vitest';
import { renderPackCatalog } from '../../src/ui/components/pack-manager-modal';

describe('包库 UI 只读视图', () => {
  it('按运行时快照渲染包、启用状态与依赖提示', () => {
    const html = renderPackCatalog({
      getPackCatalog: () => ({
        entries: [{
          id: 'demo@1.0.0', modName: 'demo', name: 'Demo', version: '1.0.0',
          dependencies: ['base'], sourceKind: 'zip', importedAt: 0, enabled: true,
        }],
        dependencies: [{ packId: 'demo@1.0.0', dependency: 'base', status: 'missing' }],
      }),
    });
    expect(html).toContain('Demo');
    expect(html).toContain('停用');
    expect(html).toContain('base · 缺失');
    expect(html).toContain('data-pack-up');
  });

  it('没有包时显示空状态', () => {
    expect(renderPackCatalog({ getPackCatalog: () => ({ entries: [], dependencies: [] }) }))
      .toContain('尚未导入数据包');
  });
});
