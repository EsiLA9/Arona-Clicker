// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { renderWorkspaceFrame } from '../../src/ui/components/workspace-frame';

describe('WorkspaceFrame', () => {
  it('按 left → center → right 顺序渲染三列，并接入 Host 元数据', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const html = renderWorkspaceFrame(createUIContext(game), {
      id: 'test',
      left: { slot: 'left', hostId: 'leftPanel', content: 'L', header: '导航' },
      center: { slot: 'center', hostId: 'centerPanel', content: 'C', scroll: 'content' },
      right: { slot: 'right', hostId: 'rightPanel', content: 'R', visible: false },
    });
    expect(html).toContain('data-workspace-frame="test"');
    expect(html).toContain('data-layout="default"');
    expect(html.indexOf('workspace-column--left')).toBeLessThan(html.indexOf('workspace-column--center'));
    expect(html.indexOf('workspace-column--center')).toBeLessThan(html.indexOf('workspace-column--right'));
    expect(html).toContain('data-scroll="content"');
    expect(html).toContain('workspace-column--right is-collapsed');
    expect(html).toContain('data-theme-host-id="leftPanel"');
  });

  it('只通过布局 preset 表达宽列几何，不携带业务类型', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const html = renderWorkspaceFrame(createUIContext(game), {
      id: 'shop', layout: { preset: 'center-heavy' },
      left: { slot: 'left', hostId: 'leftPanel', content: 'L' },
      center: { slot: 'center', hostId: 'centerPanel', content: 'C' },
      right: { slot: 'right', hostId: 'rightPanel', content: 'R' },
    });
    expect(html).toContain('data-layout="center-heavy"');
    expect(html).not.toContain('data-role=');
  });
});
