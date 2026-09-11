// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { renderWorkspaceFrame } from '../../src/ui/components/workspace-frame';
import { renderCharacterWorkspace } from '../../src/ui/components/character-workspace';
import type { PanelState } from '../../src/ui/components/app-shell';

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
    expect(html).toContain('data-workspace-column="left"');
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

  it('为编辑器保留工作区列的稳定业务语义', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const html = renderWorkspaceFrame(createUIContext(game), {
      id: 'character',
      left: { slot: 'left', role: 'contacts', hostId: 'leftPanel.character.contacts', content: 'L' },
      center: { slot: 'center', role: 'story', hostId: 'centerPanel.character.story', content: 'C' },
      right: { slot: 'right', role: 'progression', hostId: 'rightPanel.character.progression', content: 'R' },
    });
    expect(html).toContain('data-workspace-frame="character"');
    expect(html).toContain('data-workspace-role="contacts"');
    expect(html).toContain('data-workspace-role="story"');
    expect(html).toContain('data-workspace-role="progression"');
  });

  it('角色 Workspace 的三栏顶部复用普通面板 Tabs Host', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const html = renderCharacterWorkspace(createUIContext(game), {
      type: 'character',
      variantId: 'Hoshino',
      conversationVariantId: null,
      returnContext: {
        leftTab: 'contacts',
        centerTab: 'chat',
        rightTab: 'character',
        selectedVariantId: 'Hoshino',
        conversationVariantId: null,
      },
    }, {
      leftTab: 'contacts',
      centerTab: 'chat',
      rightTab: 'character',
      selectedVariantId: 'Hoshino',
      conversationVariantId: null,
      chatEntries: [],
      chatTexts: [],
      studentChats: {},
      studentChatTexts: {},
      storyNavPath: [],
    } as PanelState);
    expect(html).toContain('workspace-frame--character character-workspace');
    expect(html.match(/data-theme-host-id="(?:left|center|right)Panel\.tabs"/g)).toHaveLength(3);
    expect(html).toContain('panel-tabs-region');
    expect(html).not.toContain('leftPanel.character.left');
    expect(html).not.toContain('centerPanel.character.center');
    expect(html).not.toContain('rightPanel.character.right');
  });
});
