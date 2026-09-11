// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { ShopSession } from '../../src/arona-clicker/services/shop-service';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { UIController } from '../../src/ui/controller';
import { renderShopWorkspace } from '../../src/ui/components/shop';
import { createInventoryWorkspaceState } from '../../src/ui/inventory-view';

describe('Workspace 页面生命周期', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    controller = new UIController(game, document.querySelector('#app')!);
    controller.started = true;
  });

  afterEach(() => {
    controller.destroy();
    game.stop();
    localStorage.clear();
  });

  it('Settings 与 Inventory 的完整渲染、刷新和返回保持 Workspace 根节点', () => {
    controller.panelState.service = 'settings';
    controller.render();
    expect(document.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();

    controller.refreshPanels(['left', 'center', 'right']);
    expect(document.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();

    controller.panelState.service = 'inventory';
    controller.panelState.inventoryWorkspace = createInventoryWorkspaceState();
    controller.render();
    expect(document.querySelector('[data-workspace-frame="inventory"]')).not.toBeNull();
    expect(document.querySelector('.inventory-empty')?.textContent).toContain('背包目前为空');
    expect(document.querySelector('.inventory-inspector__empty')).not.toBeNull();

    controller.refreshPanels(['left', 'center', 'right']);
    expect(document.querySelector('[data-workspace-frame="inventory"]')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('.inventory-trace [data-service="game"]')!.click();
    expect(controller.panelState.service).toBe('game');
    expect(document.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
  });

  it('Character Workspace 的局部刷新走完整 Workspace 渲染，返回后恢复 Game', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openCharacterWorkspace('Hoshino');
    controller.render();
    expect(document.querySelector('[data-workspace-frame="character"]')).not.toBeNull();

    const before = controller.getRefreshStats().fullRenders;
    controller.refreshPanels(['left', 'center', 'right']);
    expect(controller.getRefreshStats().fullRenders).toBeGreaterThan(before);
    expect(document.querySelector('[data-workspace-frame="character"]')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('[data-character-workspace-leave]')!.click();
    expect(controller.panelState.workspace).toBeUndefined();
    expect(document.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
  });

  it('Shop 缺失数据仍生成结构化错误态并保留返回入口', () => {
    const html = renderShopWorkspace(createUIContext(game), {
      type: 'shop',
      spotId: 'base:spot:missing-shop',
      shopId: 'base:shop:missing-shop',
      session: new ShopSession(),
      feed: [],
      returnContext: { leftTab: 'area', centerTab: 'chat', rightTab: 'spot', selectedVariantId: null, conversationVariantId: null },
      themeId: 'test:missing-shop',
    });
    document.querySelector('#app')!.innerHTML = html;
    expect(document.querySelector('[data-workspace-frame="shop"]')).not.toBeNull();
    expect(document.querySelector('.shop-workspace')?.textContent).toContain('商店不存在');
    expect(document.querySelector('[data-shop-leave]')).not.toBeNull();
  });
});
