// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import { SaveSystem } from '../../src/data-services/persistence/storage';
import { createUIContext } from '../../src/ui/context';
import { renderAppShell, type PanelState } from '../../src/ui/components/app-shell';
import { UI_HOST_REGISTRY } from '../../src/ui/ui-host-registry';
import { UIController } from '../../src/ui/controller';
import '../../src/ui/service-definitions';

const baseState = (): PanelState => ({
  service: 'game',
  leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
  chatEntries: [], chatTexts: [], selectedVariantId: null,
  conversationVariantId: null, studentChats: {}, studentChatTexts: {}, storyNavPath: [],
});

describe('顶栏与设置工作区', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('顶栏只保留主题、游戏、背包、设置四个一级入口', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderAppShell(createUIContext(game), baseState());

    const topbar = wrapper.querySelector('.topbar')!;
    const nav = topbar.querySelector('.service-nav-actions')!;
    expect(topbar.querySelector('#theme-palette-btn')).not.toBeNull();
    expect(nav.querySelectorAll(':scope > button')).toHaveLength(3);
    expect(nav.querySelector('[data-service="game"]')).not.toBeNull();
    expect(nav.querySelector('[data-topbar-action="inventory"]')).not.toBeNull();
    expect(nav.querySelector('[data-service="settings"]')).not.toBeNull();
    expect(nav.querySelector('[data-service="datapack"]')).toBeNull();
    expect(nav.querySelector('[data-service="saves"]')).toBeNull();
    expect(nav.querySelector('[data-service="records"]')).toBeNull();
    expect(nav.querySelector('#help-modal')).toBeNull();
    game.stop();
  });

  it('设置页复用 WorkspaceFrame，中心只有三个服务入口并保留帮助', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderAppShell(createUIContext(game), { ...baseState(), service: 'settings' });

    expect(wrapper.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();
    expect(wrapper.querySelector('.settings-workspace')).not.toBeNull();
    expect(wrapper.querySelector('[data-theme-host-id="leftPanel.service.settings.navigation"]')).not.toBeNull();
    expect(wrapper.querySelector('[data-theme-host-id="centerPanel.service.settings.main"]')).not.toBeNull();
    expect(wrapper.querySelector('[data-theme-host-id="rightPanel.service.settings.inspector"]')).not.toBeNull();

    const center = wrapper.querySelector('[data-workspace-column="center"]')!;
    expect(center.querySelectorAll('button[data-service]')).toHaveLength(3);
    expect(center.querySelector('[data-service="saves"]')).not.toBeNull();
    expect(center.querySelector('[data-service="datapack"]')).not.toBeNull();
    expect(center.querySelector('[data-service="records"]')).not.toBeNull();
    expect(center.querySelector('#help-modal')).toBeNull();
    expect(wrapper.querySelector('[data-workspace-column="right"] #help-modal')).not.toBeNull();
    game.stop();
  });

  it('settings Host 已进入 UI Host Registry', () => {
    expect(UI_HOST_REGISTRY.get('leftPanel.service.settings.navigation')?.serviceId).toBe('settings');
    expect(UI_HOST_REGISTRY.get('centerPanel.service.settings.main')?.serviceId).toBe('settings');
    expect(UI_HOST_REGISTRY.get('rightPanel.service.settings.inspector')?.serviceId).toBe('settings');
  });

  it('背包入口回到游戏 Workspace 并定位右栏 other Tab', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-topbar-action="inventory"]')!.click();

    expect(controller.panelState.service).toBe('game');
    expect(controller.panelState.rightTab).toBe('other');
    expect(root.querySelector('[data-workspace-frame="game"]')).not.toBeNull();
    expect(root.querySelector('.right-panel .inventory-list')).not.toBeNull();
    controller.destroy();
    game.stop();
  });

  it('从数据包进入设置保留草案，真正离开数据包时仍提示', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    const draft = controller.panelState.datapackWorkspace!;
    draft.draftEnabledIds = [];
    root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();

    expect(controller.panelState.service).toBe('settings');
    expect(root.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();
    expect(document.querySelector('.app-modal')).toBeNull();
    expect(controller.panelState.datapackWorkspace).toBe(draft);
    expect(draft.draftEnabledIds).toEqual([]);

    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
    root.querySelector<HTMLButtonElement>('.topbar [data-service="game"]')!.click();
    expect(document.querySelector('.app-modal')).not.toBeNull();

    controller.modal.close();
    controller.destroy();
    game.stop();
  });
});
