// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { renderAppShell, type PanelState } from '../../src/ui/components/app-shell';
import { UIController } from '../../src/ui/controller';
import { UI_HOST_REGISTRY } from '../../src/ui/ui-host-registry';
import { createInventoryWorkspaceState } from '../../src/ui/inventory-view';
import '../../src/ui/service-definitions';

const ENERGY = 'base:item:energy_drink';
const NOTE = 'base:item:field_note';

const baseState = (): PanelState => ({
  service: 'game',
  leftTab: 'area', centerTab: 'chat', rightTab: 'other',
  chatEntries: [], chatTexts: [], selectedVariantId: null,
  conversationVariantId: null, studentChats: {}, studentChatTexts: {}, storyNavPath: [],
});

describe('inventory workspace', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('渲染三栏 Workspace、齐平顶部 Tab 与稳定 Host', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.mutations.addItem(ENERGY, 2);
    const html = renderAppShell(createUIContext(game), {
      ...baseState(),
      service: 'inventory',
      inventoryWorkspace: createInventoryWorkspaceState(),
    });

    expect(html).toContain('data-workspace-frame="inventory"');
    expect(html).toContain('data-layout="default"');
    expect(html).toContain('data-responsive="two-column"');
    expect(html.match(/inventory-workspace__tab/g)).toHaveLength(3);
    expect(html).toContain('data-theme-host-id="leftPanel.service.inventory.navigation"');
    expect(html).toContain('data-theme-host-id="centerPanel.service.inventory.main"');
    expect(html).toContain('data-theme-host-id="rightPanel.service.inventory.inspector"');
    expect(html).toContain('data-theme-host-id="leftPanel.tabs"');
    expect(html).toContain('data-inventory-type="consumable"');
    expect(html).toContain('战术能量饮料');
    game.stop();
  });

  it('inventory Host 已注册，紧凑背包可进入完整 Workspace', () => {
    expect(UI_HOST_REGISTRY.get('leftPanel.service.inventory.navigation')?.serviceId).toBe('inventory');
    expect(UI_HOST_REGISTRY.get('centerPanel.service.inventory.main')?.serviceId).toBe('inventory');
    expect(UI_HOST_REGISTRY.get('rightPanel.service.inventory.inspector')?.serviceId).toBe('inventory');

    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.panelState.rightTab = 'other';
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-open-inventory]')!.click();
    expect(controller.panelState.service).toBe('inventory');
    expect(root.querySelector('[data-workspace-frame="inventory"]')).not.toBeNull();
    controller.destroy();
    game.stop();
  });

  it('筛选与自定义排序只改 UI 状态，使用物品仍更新领域数量', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    game.mutations.addItem(ENERGY, 2);
    game.mutations.addItem(NOTE, 1);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.panelState.service = 'inventory';
    controller.panelState.inventoryWorkspace = {
      ...createInventoryWorkspaceState(),
      customOrder: [NOTE, ENERGY],
    };
    controller.render();

    const before = { ...game.state.inventory };
    root.querySelector<HTMLButtonElement>('[data-inventory-type="consumable"]')!.click();
    expect(controller.panelState.inventoryWorkspace?.typeFilter).toBe('consumable');
    expect(game.state.inventory).toEqual(before);

    root.querySelector<HTMLSelectElement>('[data-inventory-sort]')!.value = 'custom';
    root.querySelector<HTMLSelectElement>('[data-inventory-sort]')!.dispatchEvent(new Event('change', { bubbles: true }));
    root.querySelector<HTMLButtonElement>(`[data-inventory-move="up"]`)!.click();
    expect(controller.panelState.inventoryWorkspace?.sortMode).toBe('custom');

    root.querySelector<HTMLButtonElement>(`[data-inventory-use="${ENERGY}"]`)!.click();
    expect(game.getView().inventory[ENERGY]).toBe(1);
    controller.destroy();
    game.stop();
  });
});
