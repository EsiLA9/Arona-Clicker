// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('Character Workspace 的多面板刷新保留 Workspace 根节点，返回后恢复 Game', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openCharacterWorkspace('Hoshino');
    controller.render();
    expect(document.querySelector('[data-workspace-frame="character"]')).not.toBeNull();

    const before = controller.getRefreshStats().fullRenders;
    const frame = document.querySelector('[data-workspace-frame="character"]');
    controller.refreshPanels(['left', 'center', 'right']);
    expect(controller.getRefreshStats().fullRenders).toBe(before);
    expect(document.querySelector('[data-workspace-frame="character"]')).toBe(frame);
    expect(document.querySelector('[data-workspace-frame="character"]')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('[data-character-workspace-leave]')!.click();
    expect(controller.panelState.workspace).toBeUndefined();
    expect(document.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
  });

  it('Operation route 保存聊天位置、同 Run 保持 token，换 Run 后重建身份', () => {
    controller.panelState.leftTab = 'story';
    controller.panelState.centerTab = 'log';
    controller.panelState.rightTab = 'character';
    controller.panelState.selectedVariantId = 'Hoshino';
    controller.panelState.conversationVariantId = 'Serika';
    const original = controller.workspaceLocation();

    controller.openOperationWorkspace('operation-run-17');
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'operation', runId: 'operation-run-17' });
    expect(controller.panelState.workspaceNavigation?.returnTo).toEqual(original);
    expect(controller.panelState.workspace).toMatchObject({ type: 'operation', runId: 'operation-run-17', returnContext: original });
    const token = controller.getCurrentSurfaceToken();

    controller.openOperationWorkspace('operation-run-17');
    expect(controller.getCurrentSurfaceToken()).toEqual(token);
    controller.openOperationWorkspace('operation-run-18');
    expect(controller.getCurrentSurfaceToken()).toMatchObject({ key: 'operation:operation-run-18', generation: token.generation + 1 });
    controller.disposeWorkspace();

    expect(controller.panelState.workspace).toBeUndefined();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(controller.panelState.leftTab).toBe('story');
    expect(controller.panelState.centerTab).toBe('log');
    expect(controller.panelState.rightTab).toBe('character');
    expect(controller.panelState.selectedVariantId).toBe('Hoshino');
    expect(controller.panelState.conversationVariantId).toBe('Serika');
  });

  it('Character 右侧成长面板刷新不重建 Workspace 根节点，并保留焦点与滚动', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.openCharacterWorkspace('Hoshino');
    controller.render();

    const frame = document.querySelector('[data-workspace-frame="character"]');
    const right = document.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.character.progression"]')!;
    const focused = right.querySelector<HTMLButtonElement>('button');
    expect(focused).not.toBeNull();
    focused!.focus();
    const scrollOwner = right.querySelector<HTMLElement>('[data-scroll-owner="content-region"]')!;
    scrollOwner.scrollTop = 83;
    const before = controller.getRefreshStats();

    controller.refreshPanels(['right']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(document.querySelector('[data-workspace-frame="character"]')).toBe(frame);
    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(document.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.character.progression"] [data-scroll-owner="content-region"]')?.scrollTop).toBe(83);
  });

  it('Workspace 全量 fallback 保留各列内容滚动位置', () => {
    controller.panelState.service = 'settings';
    controller.render();
    const center = document.querySelector<HTMLElement>('[data-workspace-column="center"] .workspace-column__body')!;
    center.scrollTop = 137;

    controller.refreshPanels(['left', 'center', 'right']);

    expect(document.querySelector<HTMLElement>('[data-workspace-column="center"] .workspace-column__body')?.scrollTop).toBe(137);
  });

  it('Inventory 右侧检查面板刷新不重建 Workspace 根节点，并保留焦点与滚动', () => {
    controller.panelState.service = 'inventory';
    controller.panelState.inventoryWorkspace = createInventoryWorkspaceState();
    controller.render();

    const frame = document.querySelector('[data-workspace-frame="inventory"]');
    const right = document.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.service.inventory.inspector"]')!;
    const focused = right.querySelector<HTMLButtonElement>('[data-service="game"]')!;
    focused.focus();
    const scrollOwner = right.querySelector<HTMLElement>('[data-scroll-owner="content-region"]')!;
    scrollOwner.scrollTop = 91;
    const before = controller.getRefreshStats();

    controller.refreshPanels(['right']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(document.querySelector('[data-workspace-frame="inventory"]')).toBe(frame);
    expect(document.activeElement?.textContent).toContain('返回游戏');
    expect(document.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.service.inventory.inspector"] [data-scroll-owner="content-region"]')?.scrollTop).toBe(91);
  });

  it('Settings 右侧说明面板刷新不重建 Workspace 根节点，并保留焦点', () => {
    controller.panelState.service = 'settings';
    controller.render();

    const frame = document.querySelector('[data-workspace-frame="settings"]');
    const right = document.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.service.settings.inspector"]')!;
    const focused = right.querySelector<HTMLButtonElement>('#help-modal')!;
    focused.focus();
    const before = controller.getRefreshStats();

    controller.refreshPanels(['right']);

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(before.regionRefreshes);
    expect(document.querySelector('[data-workspace-frame="settings"]')).toBe(frame);
    expect(document.activeElement?.id).toBe('help-modal');
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

  it('Panel 局部替换恢复被替换节点内的焦点', () => {
    controller.render();
    const left = document.querySelector<HTMLElement>('.left-panel')!;
    const focused = left.querySelector<HTMLButtonElement>('button');
    expect(focused).not.toBeNull();
    focused!.focus();
    expect(document.activeElement).toBe(focused);

    controller.refreshPanels(['left']);

    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(document.activeElement?.textContent).toBe(focused!.textContent);
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
    const areaHero = document.querySelector<HTMLElement>('.area-hero__open');
    expect(areaHero).not.toBeNull();
    expect(document.querySelector('[data-ui-area-nav-kind="current"]')).toBeNull();
    expect([...document.querySelectorAll('.nav-sub')].map(node => node.textContent)).not.toContain('当前位置');
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
    expect(document.querySelector<HTMLElement>('.area-hero__open')).toBe(areaHero);
  });

  it('AreaHero 交付接取后立即返回一般界面，并在 Entry owner 聊天流播放', () => {
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const advance = game.story.advanceStory();
      if (!advance.success && 'error' in advance && advance.error === 'ChoiceRequired') game.story.advanceStory(0);
    }
    const invite = game.story.startStory('base:passivestory:hoshino_conv_2', 'passive', 'Hoshino');
    expect(invite.success).toBe(true);
    let inviteGuard = 0;
    while (game.getStoryView('Hoshino') && inviteGuard++ < 30) game.story.advanceStory(undefined, 'Hoshino');
    game.mutations.acquireCharacter('Hoshino', 'story');

    const entryId = 'base:activestory:hoshino_rooftop_meet';
    const entry = game.registry.activeStories.get(entryId)!;
    const ownerEntry = { ...entry, owner: 'Hoshino' };
    (game.registry.activeStories as unknown as Map<string, typeof ownerEntry>).set(entryId, ownerEntry);
    (game.registry.storyEntries as unknown as Map<string, typeof ownerEntry>).set(entryId, ownerEntry);
    const areaId = game.getView().currentAreaId!;
    game.mutations.createAreaStoryDelivery({ entryId, areaId, sourceId: 'test:area-hero' });

    controller.panelState.leftTab = 'area';
    controller.render();
    document.querySelector<HTMLButtonElement>('[data-area-workspace-open]')!.click();

    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'area', areaId });
    expect(document.querySelector('[data-area-story-entry="base:activestory:hoshino_rooftop_meet"] strong')?.textContent)
      .toBe('天台的相遇');

    const acceptButton = document.querySelector<HTMLButtonElement>('[data-area-story-accept="base:activestory:hoshino_rooftop_meet"]')!;
    expect(game.story.startStory('base:passivestory:schale_sunset', 'passive', 'Hoshino').success).toBe(true);
    acceptButton.click();
    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'area', areaId });
    expect(game.state.areaStoryDeliveries?.find(delivery => delivery.entryId === entryId)?.status).toBe('pending');
    game.story.clearCurrentStory('Hoshino');
    acceptButton.click();

    expect(controller.panelState.workspaceNavigation?.current).toEqual({ kind: 'game' });
    expect(controller.panelState.workspace).toBeUndefined();
    expect(controller.panelState.centerTab).toBe('chat');
    expect(controller.panelState.conversationVariantId).toBe('Hoshino');
    expect(controller.panelState.storyGate).toBeNull();
    expect(game.getStoryView('Hoshino')?.storyId).toBe(entryId);
    expect(document.querySelector('[data-conversation="Hoshino"]')).not.toBeNull();
    expect(document.querySelector<HTMLButtonElement>('[data-area-workspace-open]')?.disabled).toBe(true);
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

  it('Runtime Spot 批量 Apply 只刷新当前 Game 的 Spot 视图，不重建 App', () => {
    controller.render();
    const render = vi.spyOn(controller, 'render');
    const spotCards = vi.spyOn(controller, 'refreshCurrentSpotCards').mockReturnValue(true);

    controller.refreshRuntimeSpotContent();

    expect(spotCards).toHaveBeenCalledWith('runtime-editor-spot-apply');
    expect(render).not.toHaveBeenCalled();
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
