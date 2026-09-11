// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { renderAppShell, type PanelState } from '../../src/ui/components/app-shell';

const baseState = (): PanelState => ({
  service: 'game',
  leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
  chatEntries: [], chatTexts: [], selectedVariantId: null,
  conversationVariantId: null, studentChats: {}, studentChatTexts: {}, storyNavPath: [],
});

describe('服务工作区', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  it.each([
    ['datapack', '数据包管理', '导入数据包'],
    ['saves', '存读档', '保存当前进度'],
    ['records', '图鉴与统计', '打开完整图鉴'],
  ] as const)('渲染 %s 工作区并保留三栏结构', (service, title, action) => {
    const html = renderAppShell(createUIContext(game), {
      ...baseState(),
      service,
      datapackWorkspace: service === 'datapack' ? {
        section: 'all', selectedPackId: null, draftEnabledIds: [], draftOrder: [], validation: null, lastResult: null,
      } : undefined,
    });
    expect(html).toContain('data-workspace-frame="service-');
    expect(html).toContain(`>${title}<`);
    expect(html).toContain(action);
    expect(html).toContain('service-navigation');
    expect(html).toContain('service-inspector');
    expect(html).toContain(`data-theme-host-id="leftPanel.service.${service}.navigation"`);
    expect(html).toContain(`data-theme-host-id="centerPanel.service.${service}.main"`);
    expect(html).toContain(`data-theme-host-id="rightPanel.service.${service}.inspector"`);
    expect(html).toContain(`data-theme-scope="center.${service}.main"`);
  });

  it('数据包工作区显示分类语义、正式状态与草案操作', () => {
    const runtime = new AronaClickerRuntime();
    runtime.init([baseDatapack]);
    const html = renderAppShell(createUIContext(runtime), {
      ...baseState(),
      service: 'datapack',
      datapackWorkspace: {
        section: 'all',
        selectedPackId: null,
        draftEnabledIds: [],
        draftOrder: [],
        validation: null,
        lastResult: null,
      },
    });
    expect(html).toContain('data-datapack-section="enabled"');
    expect(html).toContain('正式启用');
    expect(html).toContain('data-pack-select=');
    expect(html).toContain('data-pack-validate');
    expect(html).toContain('data-pack-apply');
  });

  it('正常游戏模式仍渲染原有三栏', () => {
    const html = renderAppShell(createUIContext(game), baseState());
    expect(html).toContain('data-workspace-frame="game"');
    expect(html).not.toContain('data-workspace-frame="service-');
  });

  it('角色工作区接管通讯录、故事和成长三栏，并暴露稳定 Host', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    const html = renderAppShell(createUIContext(game), {
      ...baseState(),
      workspace: {
        type: 'character',
        variantId: 'Hoshino',
        conversationVariantId: 'Hoshino',
        returnContext: { leftTab: 'contacts', centerTab: 'chat', rightTab: 'character', selectedVariantId: null, conversationVariantId: null },
      },
      selectedVariantId: 'Hoshino',
      conversationVariantId: 'Hoshino',
    });
    expect(html).toContain('data-workspace-frame="character"');
    expect(html).toContain('data-theme-host-id="leftPanel.character.contacts"');
    expect(html).toContain('data-theme-host-id="centerPanel.character.story"');
    expect(html).toContain('data-theme-host-id="rightPanel.character.progression"');
    expect(html).toContain('data-workspace-role="progression"');
    expect(html).toContain('角色成长');
  });
});
