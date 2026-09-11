// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller';

const SPOT = 'base:spot:abydos_cafe';

describe('Spot Shop workspace', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    localStorage.clear();
    game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    controller = new UIController(game, document.querySelector('#app')!);
    controller.mount();
  });

  afterEach(() => { game.stop(); localStorage.clear(); });

  test('购物车是临时状态，Shop 主题在离开 workspace 后恢复', () => {
    const primaryBefore = game.colorSystem.runtimeThemeTokens().primary;
    controller.openSpotShopModal(SPOT);
    expect(document.querySelector('.shop-workspace')).not.toBeNull();
    expect(document.querySelector('.shop-workspace')?.getAttribute('data-responsive')).toBe('single-column');
    expect(document.querySelectorAll('.shop-workspace > .workspace-column.panel')).toHaveLength(3);
    expect(document.querySelector('.shop-workspace__section')?.textContent).toContain('日常补给');
    expect(document.querySelector('.shop-workspace .panel-tabs-region')).not.toBeNull();
    expect(document.querySelectorAll('.shop-workspace .panel-tabs-region')).toHaveLength(3);
    expect(document.querySelector('.shop-workspace .ui-cluster--center-tabs-region .shop-workspace__title')?.textContent).toContain('阿比多斯咖啡角');
    expect(document.querySelector('.shop-product-card')).not.toBeNull();
    expect(game.colorSystem.runtimeThemeTokens().primary).toBe('#d97706');

    const shellBefore = document.querySelector('.console-shell');
    const centerHostBefore = document.querySelector('[data-theme-host-id="centerPanel.shop.catalog"]');
    const fullBefore = controller.getRefreshStats().fullRenders;
    document.querySelector<HTMLButtonElement>('[data-shop-select="energy-drink"]')!.click();
    document.querySelector<HTMLInputElement>('#shop-quantity')!.value = '1';
    document.querySelector<HTMLButtonElement>('[data-modal-action="shop-add"]')!.click();
    expect(document.querySelector('.shop-workspace__settlement')?.textContent).toContain('战术能量饮料');
    expect(document.querySelector('.console-shell')).toBe(shellBefore);
    expect(document.querySelector('[data-theme-host-id="centerPanel.shop.catalog"]')).not.toBe(centerHostBefore);
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect(controller.getRefreshStats().regionRefreshes).toBeGreaterThan(0);
    expect(controller.getRefreshObservations().some(observation =>
      observation.scope === 'region'
      && observation.reason === 'shop.add'
      && observation.surfaceKey.startsWith('shop:'),
    )).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-shop-leave]')!.click();

    expect(document.querySelector('.shop-workspace')).toBeNull();
    expect(game.colorSystem.runtimeThemeTokens().primary).toBe(primaryBefore);
  });

  test('退出再进入会丢弃购物车，但保留成功购买记录', () => {
    game.mutations.changeResource('base:resource:credit', 100);
    controller.openSpotShopModal(SPOT);
    document.querySelector<HTMLButtonElement>('[data-shop-select="energy-drink"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-modal-action="shop-add"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-shop-checkout]')!.click();
    expect(Object.keys(game.state.shopPurchaseRecords ?? {})).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('[data-shop-leave]')!.click();

    controller.openSpotShopModal(SPOT);
    expect(document.querySelector('.shop-workspace__settlement')?.textContent).toContain('购物车为空');
    expect(Object.keys(game.state.shopPurchaseRecords ?? {})).toHaveLength(1);
  });

  test('外部 tick 触发面板刷新时仍保持 Shop workspace', () => {
    controller.openSpotShopModal(SPOT);
    expect(document.querySelector('.shop-workspace')).not.toBeNull();

    // 外部 tick 的事件链可能要求揭示/左右面板刷新；不能回退到普通三栏。
    controller.refreshPanels(['left', 'center', 'right']);

    expect(document.querySelector('.shop-workspace')).not.toBeNull();
    expect(document.querySelector('.shop-workspace__feed')).not.toBeNull();
    expect(document.querySelector('.shop-workspace__catalog')).not.toBeNull();
    expect(document.querySelector('.shop-workspace__settlement')).not.toBeNull();
  });

  test('Shop 中的资源轻量刷新只改行为节点，不重建 workspace', () => {
    controller.openSpotShopModal(SPOT);
    const fullBefore = controller.getRefreshStats().fullRenders;
    const holding = document.querySelector<HTMLElement>('.shop-holding [data-resource="base:resource:credit"]');
    expect(holding).not.toBeNull();

    game.mutations.changeResource('base:resource:credit', 123);
    controller.refreshLight();

    expect(holding?.textContent).toBe('123');
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect(controller.getRefreshStats().behaviorPatches).toBeGreaterThan(0);
  });

  test('结算失败保留购物车，并只更新 Feed / settlement 区域', () => {
    controller.openSpotShopModal(SPOT);
    const fullBefore = controller.getRefreshStats().fullRenders;
    document.querySelector<HTMLButtonElement>('[data-shop-select="energy-drink"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-modal-action="shop-add"]')!.click();

    document.querySelector<HTMLButtonElement>('[data-shop-checkout]')!.click();

    expect(document.querySelector('.shop-workspace__feed')?.textContent).toContain('结算失败');
    expect(document.querySelector('.shop-workspace__settlement')?.textContent).toContain('战术能量饮料 × 1');
    expect(controller.getRefreshStats().fullRenders).toBe(fullBefore);
    expect(controller.getRefreshObservations().some(observation =>
      observation.reason === 'shop.checkout-failed' && observation.scope === 'region',
    )).toBe(true);
  });
});
