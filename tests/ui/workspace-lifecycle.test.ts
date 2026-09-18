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

  it('顶层服务导航清除临时 Workspace，避免保留非法组合', () => {
    controller.openContactsWorkspace('Hoshino');
    controller.navigateToService('settings');
    controller.render();

    expect(controller.panelState.workspace).toBeUndefined();
    expect(controller.panelState.workspaceNavigation).toEqual({ current: { kind: 'service', page: 'settings' } });
    expect(document.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();
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

  it('Panel 局部刷新只关闭被替换范围内的 tooltip', () => {
    controller.render();
    const tooltip = document.querySelector<HTMLElement>('#floating-tooltip')!;
    const center = document.querySelector<HTMLElement>('.center-panel')!;
    const centerAnchor = document.createElement('span');
    centerAnchor.className = 'hover-wrap';
    center.append(centerAnchor);
    tooltip.classList.add('is-open');
    (controller.popovers as unknown as { lastWrap: HTMLElement }).lastWrap = centerAnchor;

    controller.refreshPanels(['left', 'right']);

    expect(tooltip.classList.contains('is-open')).toBe(true);

    const left = document.querySelector<HTMLElement>('.left-panel')!;
    const leftAnchor = document.createElement('span');
    leftAnchor.className = 'hover-wrap';
    left.append(leftAnchor);
    tooltip.classList.add('is-open');
    (controller.popovers as unknown as { lastWrap: HTMLElement }).lastWrap = leftAnchor;

    controller.refreshPanels(['left']);

    expect(tooltip.classList.contains('is-open')).toBe(false);
  });

  it('Chat pane 局部替换只关闭聊天范围内的 tooltip', () => {
    controller.render();
    const chatPane = document.querySelector<HTMLElement>('.chat-pane')!;
    const anchor = document.createElement('span');
    anchor.className = 'hover-wrap';
    chatPane.append(anchor);
    const tooltip = document.querySelector<HTMLElement>('#floating-tooltip')!;
    tooltip.classList.add('is-open');
    (controller.popovers as unknown as { lastWrap: HTMLElement }).lastWrap = anchor;

    controller.refreshChatPanel();

    expect(tooltip.classList.contains('is-open')).toBe(false);
  });

  it('Log pane 局部替换只关闭日志范围内的 tooltip', () => {
    controller.panelState.centerTab = 'log';
    controller.render();
    const log = document.querySelector<HTMLElement>('.log-panel')!;
    const anchor = document.createElement('span');
    anchor.className = 'hover-wrap';
    log.append(anchor);
    const tooltip = document.querySelector<HTMLElement>('#floating-tooltip')!;
    tooltip.classList.add('is-open');
    (controller.popovers as unknown as { lastWrap: HTMLElement }).lastWrap = anchor;

    controller.refreshLogPanel();

    expect(tooltip.classList.contains('is-open')).toBe(false);
  });

  it('揭示变化可按 Spot 卡片元素刷新，不增加 Panel / full render 计数', () => {
    controller.render();
    const before = controller.getRefreshStats();
    const beforeCards = new Map(
      [...document.querySelectorAll<HTMLElement>('[data-ui-spot-card]')]
        .map(card => [card.dataset.uiSpotCard!, card] as const),
    );

    expect(controller.refreshCurrentSpotCards('test.element-refresh')).toBe(true);

    const after = controller.getRefreshStats();
    expect(after.elementRefreshes).toBeGreaterThan(0);
    expect(after.panelRefreshes).toBe(before.panelRefreshes);
    expect(after.fullRenders).toBe(before.fullRenders);
    for (const [spotId, card] of beforeCards) {
      expect(document.querySelector<HTMLElement>(`[data-ui-spot-card="${spotId}"]`)).toBe(card);
    }
  });

  it('区域导航揭示状态可按按钮元素刷新，并保留无关中心 tooltip', () => {
    controller.render();
    const before = controller.getRefreshStats();
    const currentNav = document.querySelector<HTMLElement>('[data-ui-area-nav-kind="current"]');
    expect(currentNav).not.toBeNull();
    const center = document.querySelector<HTMLElement>('.center-panel')!;
    const centerAnchor = document.createElement('span');
    centerAnchor.className = 'hover-wrap';
    center.append(centerAnchor);
    const tooltip = document.querySelector<HTMLElement>('#floating-tooltip')!;
    tooltip.classList.add('is-open');
    (controller.popovers as unknown as { lastWrap: HTMLElement }).lastWrap = centerAnchor;

    expect(controller.refreshCurrentAreaNav('test.area-nav-element')).toBe(true);

    const after = controller.getRefreshStats();
    expect(after.elementRefreshes).toBeGreaterThan(before.elementRefreshes);
    expect(after.panelRefreshes).toBe(before.panelRefreshes);
    expect(after.fullRenders).toBe(before.fullRenders);
    expect(tooltip.classList.contains('is-open')).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-ui-area-nav-kind="current"]')).toBe(currentNav);
  });

  it('强化卡片揭示状态可按元素刷新，不增加右侧 Panel 刷新计数', () => {
    controller.panelState.rightTab = 'enh';
    controller.render();
    const cards = document.querySelectorAll('[data-ui-enhancement-card]');
    expect(cards.length).toBeGreaterThan(0);
    const before = controller.getRefreshStats();

    expect(controller.refreshCurrentEnhancementCards('test.enhancement-element')).toBe(true);

    const after = controller.getRefreshStats();
    expect(after.elementRefreshes).toBeGreaterThan(before.elementRefreshes);
    expect(after.panelRefreshes).toBe(before.panelRefreshes);
    expect(after.fullRenders).toBe(before.fullRenders);
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
