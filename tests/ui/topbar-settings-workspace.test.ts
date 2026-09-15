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

  it('顶栏背包入口直接打开完整 inventory Workspace', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-topbar-action="inventory"]')!.click();

    expect(controller.panelState.service).toBe('inventory');
    expect(root.querySelector('[data-workspace-frame="inventory"]')).not.toBeNull();
    expect(root.querySelector('[data-theme-host-id="leftPanel.service.inventory.navigation"]')).not.toBeNull();
    expect(root.querySelector('[data-theme-host-id="centerPanel.service.inventory.main"]')).not.toBeNull();
    expect(root.querySelector('[data-theme-host-id="rightPanel.service.inventory.inspector"]')).not.toBeNull();
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
    expect(document.querySelector('.app-modal.is-open')).toBeNull();
    expect(controller.panelState.datapackWorkspace).toBe(draft);
    expect(draft.draftEnabledIds).toEqual([]);

    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
    root.querySelector<HTMLButtonElement>('.topbar [data-service="game"]')!.click();
    expect(document.querySelector('.app-modal')).not.toBeNull();

    controller.modal.close();
    controller.destroy();
    game.stop();
  });

  it('单 Mod 多 Spot 逐个即时新建、编辑与删除', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-runtime-editor-toggle]')!.click();
    expect(root.querySelector('.runtime-editor-form')).toBeNull();
    expect(document.querySelector('.app-modal .runtime-editor-form')).not.toBeNull();
    expect(root.querySelector('.pack-draft-actions')).not.toBeNull();

    const setMod = (key: string, value: string) => {
      document.querySelector<HTMLInputElement>(`.app-modal [data-runtime-editor-mod-field="${key}"]`)!.value = value;
    };
    const setField = (key: string, value: string) => {
      document.querySelector<HTMLInputElement>(`.app-modal [data-runtime-editor-field="${key}"]`)!.value = value;
    };
    const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();
    const editor = () => controller.panelState.runtimeDatapackEditor!;
    const entryState = (idName: string) =>
      document.querySelector(`[data-runtime-editor-entry="${idName}"]`)?.getAttribute('data-entry-state');

    setMod('modName', 'draft-mod');
    setMod('displayName', 'Draft Mod');
    click('.app-modal [data-runtime-editor-create]');
    expect(editor().error).toBeNull();

    expect(document.querySelector('[data-runtime-editor-create-spot]')).not.toBeNull();
    expect(document.querySelector('.runtime-datapack-modal .modal-head .eyebrow')?.textContent).toContain('创建 Spot');
    setField('idName', 'empty-spot');
    setField('name', '空 Spot');
    click('.app-modal [data-runtime-editor-affector-add]');
    click('.app-modal [data-runtime-editor-affector-add]');
    const affectorRows = () => [...document.querySelectorAll<HTMLElement>('.app-modal [data-runtime-editor-affector-row]')];
    const setAffectorField = (row: HTMLElement, key: string, value: string) => {
      const field = row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-affector-field="${key}"]`)!;
      field.value = value;
    };
    setAffectorField(affectorRows()[0], 'resource', 'base:resource:credit');
    setAffectorField(affectorRows()[0], 'amount', '2');
    setAffectorField(affectorRows()[1], 'mode', 'per-level');
    setAffectorField(affectorRows()[1], 'resource', 'base:resource:pyroxene');
    setAffectorField(affectorRows()[1], 'amount', '3');
    click('.app-modal [data-runtime-editor-create-spot]');

    // 保存只写草稿：运行时未改变，浏览器能看到新建条目
    expect(editor().spots[0]).toMatchObject({
      idName: 'empty-spot',
      name: '空 Spot',
      affectors: [
        { type: 'resource-flow', mode: 'fixed', resource: 'base:resource:credit', amount: 2 },
        { type: 'resource-flow', mode: 'per-level', resource: 'base:resource:pyroxene', amount: 3 },
      ],
    });
    expect(game.registry.spots.has('draft-mod:spot:empty-spot')).toBe(false);
    expect(document.querySelector('.runtime-spot-list')).not.toBeNull();
    expect(entryState('empty-spot')).toBe('created');

    // 显式 Apply 才进入运行时
    click('.app-modal [data-runtime-editor-apply]');
    expect(game.registry.spots.has('draft-mod:spot:empty-spot')).toBe(true);
    expect(game.registry.spots.get('draft-mod:spot:empty-spot')?.functionalities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'flow', resource: 'base:resource:credit', amount: 2 }),
      expect.objectContaining({ kind: 'linearYield', resource: 'base:resource:pyroxene', amountPerLevel: 3 }),
    ]));
    expect(entryState('empty-spot')).toBe('unchanged');
    expect(document.querySelector('#toast-layer .toast-action')).not.toBeNull();

    // 第二个 Spot 仍从浏览器入口创建，并在浏览器里逐个应用
    click('.app-modal [data-runtime-editor-new-spot]');
    setField('idName', 'second-spot');
    setField('name', '第二个 Spot');
    click('.app-modal [data-runtime-editor-create-spot]');
    expect(editor().spots).toHaveLength(2);
    expect(game.registry.spots.has('draft-mod:spot:second-spot')).toBe(false);
    click('.app-modal [data-runtime-editor-apply]');

    const areaId = editor().selectedAreaId!;
    expect(editor().error).toBeNull();
    expect(game.registry.spots.has('draft-mod:spot:second-spot')).toBe(true);
    expect(game.world.spotsOfArea(areaId)).toContain('draft-mod:spot:empty-spot');
    expect(game.state.activeInit).toBe('base:init:schale_office');
    expect(game.state.currentAreaId).toBe(areaId);

    const viewGame = [...document.querySelectorAll<HTMLButtonElement>('#toast-layer .toast-action button')]
      .find(button => button.textContent?.includes('查看游戏'));
    expect(viewGame).toBeDefined();
    viewGame!.click();
    expect(document.querySelector('.app-modal.is-open')).toBeNull();
    expect(controller.panelState.service).toBe('game');
    expect(root.querySelector('[data-runtime-spot-edit="draft-mod:spot:empty-spot"]')).not.toBeNull();
    expect(root.querySelector('[data-runtime-spot-delete="draft-mod:spot:empty-spot"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-runtime-spot-edit="draft-mod:spot:second-spot"]')!.click();
    expect(document.querySelector<HTMLInputElement>('.app-modal [data-runtime-editor-field="idName"]')?.value).toBe('second-spot');
    controller.modal.close();

    root.querySelector<HTMLButtonElement>('[data-runtime-spot-edit="draft-mod:spot:empty-spot"]')!.click();
    expect(document.querySelector('.app-modal [data-runtime-editor-create-spot]')?.textContent).toContain('保存 Spot 修改');
    // 已应用的条目 ID 锁定在表单层，不允许改名
    expect(document.querySelector<HTMLInputElement>('.app-modal [data-runtime-editor-field="idName"]')?.disabled).toBe(true);
    expect(document.querySelector('.runtime-datapack-modal .modal-head .eyebrow')?.textContent).toContain('编辑 Spot');
    setField('name', '修改后的 Spot');
    click('.app-modal [data-runtime-editor-create-spot]');

    // 草稿已改、运行时未变，差异面板可见
    expect(game.registry.spots.get('draft-mod:spot:empty-spot')?.name).toBe('空 Spot');
    expect(entryState('empty-spot')).toBe('modified');
    expect(document.querySelector('.runtime-editor-diff')?.textContent).toContain('修改后的 Spot');

    click('.app-modal [data-runtime-editor-apply]');
    expect(game.registry.spots.get('draft-mod:spot:empty-spot')?.name).toBe('修改后的 Spot');
    expect(entryState('empty-spot')).toBe('unchanged');

    game.state.spotLevels['draft-mod:spot:empty-spot'] = 2;
    click('.app-modal [data-runtime-editor-entry-remove="empty-spot"]');
    expect(document.querySelector('[data-runtime-delete-preserve]')).not.toBeNull();
    expect(document.querySelector('[data-runtime-delete-clean]')).not.toBeNull();
    click('.app-modal [data-runtime-delete-clean]');
    expect(game.registry.spots.has('draft-mod:spot:empty-spot')).toBe(false);
    expect(game.registry.spots.has('draft-mod:spot:second-spot')).toBe(true);
    expect(game.state.spotLevels['draft-mod:spot:empty-spot']).toBeUndefined();

    controller.destroy();
    game.stop();
  });
});
