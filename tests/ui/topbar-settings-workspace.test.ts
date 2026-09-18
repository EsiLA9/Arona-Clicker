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
import { DEBUG_EDITING_DEFAULTS, IS_DEBUG_EDITING } from '../../src/ui/runtime-editor/config';
import { createRuntimeDatapackEditorState, updateRuntimeEditorFields } from '../../src/ui/runtime-editor/state';
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

  it('Init 选择大厅可直接打开 Runtime Editor 迷你入口，不依赖设置页', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.render();

    expect(root.querySelector('.selector-shell')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();

    expect(controller.panelState.service).toBe('game');
    expect(document.querySelector('.runtime-editor-launcher')).not.toBeNull();
    expect(document.querySelectorAll('.runtime-editor-launcher-entry')).toHaveLength(4);
    expect(document.querySelector('.runtime-editor-panel')).toBeNull();
    expect(document.querySelector('.runtime-editor-launcher [data-runtime-editor-default-area-id-name]')).toBeNull();
    expect(document.querySelector('#toast-layer .toast-action')).toBeNull();
    controller.destroy();
    game.stop();
  });

  it('新建 Init 会在同一份 Draft 中协同创建可自定义 ID 的 defaultArea', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    const editor = createRuntimeDatapackEditorState(null);
    updateRuntimeEditorFields(editor, { modName: 'mini-mod', displayName: 'Mini Mod' });
    controller.panelState.runtimeDatapackEditor = editor;
    controller.render();

    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="create-init"]')!.click();
    expect(document.querySelector('.runtime-editor-panel')).not.toBeNull();
    expect(document.querySelector('.app-modal')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('.app-modal [data-runtime-editor-section-tab="basics"]')!.click();
    document.querySelector<HTMLInputElement>('.app-modal [data-runtime-editor-field="idName"]')!.value = 'academy';
    document.querySelector<HTMLInputElement>('.app-modal [data-runtime-editor-field="name"]')!.value = '学院世界线';
    const defaultArea = document.querySelector<HTMLInputElement>('.app-modal [data-runtime-editor-default-area-id-name]')!;
    defaultArea.value = 'academy-lobby';
    defaultArea.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.app-modal [data-runtime-editor-save-definition="inits"]')!.click();

    expect(editor.inits).toHaveLength(1);
    expect(editor.areas).toHaveLength(1);
    expect(editor.inits[0]).toMatchObject({ idName: 'academy', defaultAreas: ['mini-mod:area:academy-lobby'] });
    expect(editor.areas[0]).toMatchObject({ idName: 'academy-lobby', initId: 'mini-mod:init:academy' });
    controller.modal.close();
    controller.destroy();
    game.stop();
  });

  it('顶栏保留主题、编辑器、游戏、背包、设置一级入口', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderAppShell(createUIContext(game), baseState());

    const topbar = wrapper.querySelector('.topbar')!;
    const nav = topbar.querySelector('.service-nav-actions')!;
    expect(topbar.querySelector('#theme-palette-btn')).not.toBeNull();
    expect(nav.querySelectorAll(':scope > button')).toHaveLength(4);
    expect(nav.querySelector('#runtime-editor-launch')).not.toBeNull();
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

  it('IS_DEBUG_EDITING=1 时进入数据包管理页自动开启编辑态并预填默认数据', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();

    const editor = controller.panelState.runtimeDatapackEditor;
    if (IS_DEBUG_EDITING !== 1) {
      expect(editor).toBeUndefined();
      return;
    }
    expect(editor?.enabled).toBe(true);
    expect(editor?.modName).toBe(DEBUG_EDITING_DEFAULTS.modName);
    expect(editor?.displayName).toBe(DEBUG_EDITING_DEFAULTS.displayName);
    expect(root.querySelector('[data-runtime-editor-open]')).not.toBeNull();
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
    // IS_DEBUG_EDITING=1 时编辑态已在进入数据包页时自动开启，此时直接打开编辑器。
    const editorToggle = root.querySelector<HTMLButtonElement>('[data-runtime-editor-toggle]');
    if (editorToggle) editorToggle.click();
    else root.querySelector<HTMLButtonElement>('[data-runtime-editor-open]')!.click();
    expect(root.querySelector('.runtime-editor-form')).toBeNull();
    expect(document.querySelector('.runtime-editor-panel .runtime-editor-form')).not.toBeNull();
    expect(root.querySelector('.pack-draft-actions')).not.toBeNull();

    const setMod = (key: string, value: string) => {
      document.querySelector<HTMLInputElement>(`.runtime-editor-panel [data-runtime-editor-mod-field="${key}"]`)!.value = value;
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
    click('.runtime-editor-panel [data-runtime-editor-create]');
    expect(editor().error).toBeNull();

    // 保存 Mod 设定后仍停留在 Mod 设定页；进入 Spot 页必须由用户主动选择。
    expect(document.querySelector('[data-runtime-editor-create-spot]')).toBeNull();
    expect(document.querySelector('[data-runtime-editor-mod-field="displayName"]')).not.toBeNull();
    click('.runtime-editor-panel [data-runtime-editor-new-spot]');
    expect(document.querySelector('[data-runtime-editor-create-spot]')).not.toBeNull();
    expect(document.querySelector('.runtime-datapack-modal .modal-head .eyebrow')?.textContent).toContain('创建 Spot');
    // 页互相隔离：字段只在所属页，切页前会自动暂存已填内容。
    click('.app-modal [data-runtime-editor-section-tab="basics"]');
    setField('idName', 'empty-spot');
    setField('name', '空 Spot');
    click('.app-modal [data-runtime-editor-section-tab="functionalities"]');
    const collectionRows = () => [...document.querySelectorAll<HTMLElement>('.app-modal [data-runtime-collection-row]')];
    // 新建只产出最小原型行，字段在条目子弹窗里补全。
    click('.app-modal [data-runtime-collection-add]');
    click('.app-modal [data-runtime-collection-add]');
    expect(collectionRows()).toHaveLength(2);
    const setItemField = (key: string, value: string) => {
      document.querySelector<HTMLInputElement | HTMLSelectElement>(`.runtime-subdialog [data-runtime-item-field="${key}"]`)!.value = value;
    };
    collectionRows()[0].querySelector<HTMLElement>('[data-runtime-collection-edit]')!.click();
    setItemField('amount', '2');
    click('.runtime-subdialog [data-runtime-item-condition]');
    click('.runtime-subdialog [data-runtime-condition-add="condition"]');
    expect(document.querySelector('.runtime-subdialog [data-runtime-atomic-condition-editor]')).toBeNull();
    expect(document.querySelector('.runtime-subdialog [data-runtime-condition-summary-text]')?.textContent).toBe('True');
    click('.runtime-subdialog [data-runtime-condition-edit]');
    expect(document.querySelector('.runtime-subdialog [data-runtime-atomic-condition-editor]')).not.toBeNull();
    const targetSelect = document.querySelector<HTMLSelectElement>('.runtime-subdialog [data-runtime-condition-editor-field="target"]')!;
    targetSelect.value = 'resource';
    targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLInputElement>('.runtime-subdialog [data-runtime-condition-editor-field="key"]')!.value = 'credit-ready';
    document.querySelector<HTMLSelectElement>('.runtime-subdialog [data-runtime-condition-editor-field="comparator"]')!.value = '>=';
    document.querySelector<HTMLInputElement>('.runtime-subdialog [data-runtime-condition-editor-field="value"]')!.value = '10';
    click('.runtime-subdialog [data-subdialog-save]');
    expect(document.querySelector('.runtime-subdialog [data-runtime-condition-edit]')).not.toBeNull();
    click('.runtime-subdialog [data-runtime-item-condition]');
    click('.runtime-subdialog [data-runtime-item-condition]');
    expect(document.querySelector('.runtime-subdialog [data-runtime-item-condition-host]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelectorAll('.runtime-subdialog [data-runtime-condition]').length).toBe(2);
    expect(document.querySelector('.runtime-subdialog [data-runtime-condition-outer-relation]')?.textContent).toBe('OR');
    click('.runtime-subdialog [data-runtime-condition-toggle]');
    expect(document.querySelector<HTMLElement>('.runtime-subdialog [data-runtime-condition-toggle]')?.dataset.runtimeConditionType).toBe('OR');
    click('.runtime-subdialog [data-subdialog-save]');
    collectionRows()[1].querySelector<HTMLElement>('[data-runtime-collection-edit]')!.click();
    const secondKind = document.querySelector<HTMLSelectElement>('.runtime-subdialog [data-runtime-item-field="kind"]')!;
    secondKind.value = 'linearYield';
    secondKind.dispatchEvent(new Event('change', { bubbles: true }));
    setItemField('resource', 'base:resource:pyroxene');
    setItemField('amountPerLevel', '3');
    click('.runtime-subdialog [data-subdialog-save]');
    click('.app-modal [data-runtime-editor-create-spot]');

    // 保存只写草稿：运行时未改变，且仍停留在 Spot 编辑页
    expect(editor().spots[0]).toMatchObject({
      idName: 'empty-spot',
      name: '空 Spot',
      functionalities: [
        { kind: 'flow', resource: 'base:resource:credit', amount: 2, condition: { type: 'OR', conditions: [{ target: 'resource', key: 'credit-ready', comparator: '>=', value: 10 }] } },
        { kind: 'linearYield', resource: 'base:resource:pyroxene', amountPerLevel: 3 },
      ],
    });
    expect(game.registry.spots.has('draft-mod:spot:empty-spot')).toBe(false);
    expect(document.querySelector('[data-runtime-editor-spot-form]')).not.toBeNull();

    // 显式 Apply 才进入运行时
    click('.app-modal [data-runtime-editor-apply]');
    expect(game.registry.spots.has('draft-mod:spot:empty-spot')).toBe(true);
    expect(game.registry.spots.get('draft-mod:spot:empty-spot')?.functionalities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'flow', resource: 'base:resource:credit', amount: 2 }),
      expect.objectContaining({ kind: 'linearYield', resource: 'base:resource:pyroxene', amountPerLevel: 3 }),
    ]));
    expect(document.querySelector('#toast-layer .toast-action')).toBeNull();

    const openBrowser = () => {
      controller.modal.close();
      controller.render();
      root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-runtime-editor-open]')!.click();
    };
    openBrowser();
    expect(document.querySelector('.runtime-spot-list')).not.toBeNull();
    expect(entryState('empty-spot')).toBe('unchanged');

    // 第二个 Spot 仍从浏览器入口创建，并在浏览器里逐个应用
    click('.runtime-editor-panel [data-runtime-editor-new-spot]');
    click('.app-modal [data-runtime-editor-section-tab="basics"]');
    setField('idName', 'second-spot');
    setField('name', '第二个 Spot');
    click('.app-modal [data-runtime-editor-section-tab="functionalities"]');
    // Spot 编辑页允许直接应用：Apply 会先读取当前表单，再提交到 Runtime。
    click('.app-modal [data-runtime-editor-apply]');
    expect(editor().spots).toHaveLength(2);
    expect(game.registry.spots.has('draft-mod:spot:second-spot')).toBe(true);

    const areaId = editor().selectedAreaId!;
    expect(editor().error).toBeNull();
    expect(game.registry.spots.has('draft-mod:spot:second-spot')).toBe(true);
    expect(game.world.spotsOfArea(areaId)).toContain('draft-mod:spot:empty-spot');
    expect(game.state.activeInit).toBe('base:init:schale_office');
    expect(game.state.currentAreaId).toBe(areaId);

    controller.modal.close();
    root.querySelector<HTMLButtonElement>('.topbar [data-service="game"]')!.click();
    expect(document.querySelector('.app-modal.is-open')).toBeNull();
    expect(controller.panelState.service).toBe('game');
    expect(root.querySelector('[data-runtime-spot-edit="draft-mod:spot:empty-spot"]')).not.toBeNull();
    expect(root.querySelector('[data-runtime-spot-delete="draft-mod:spot:empty-spot"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-runtime-spot-edit="draft-mod:spot:second-spot"]')!.click();
    click('.app-modal [data-runtime-editor-section-tab="basics"]');
    expect(document.querySelector<HTMLInputElement>('.app-modal [data-runtime-editor-field="idName"]')?.value).toBe('second-spot');
    controller.modal.close();

    root.querySelector<HTMLButtonElement>('[data-runtime-spot-edit="draft-mod:spot:empty-spot"]')!.click();
    expect(document.querySelector('.app-modal [data-runtime-editor-create-spot]')?.textContent).toContain('保存 Spot 修改');
    // 已应用的条目 ID 锁定在表单层，不允许改名
    expect(document.querySelector<HTMLInputElement>('.app-modal [data-runtime-editor-field="idName"]')?.disabled).toBe(true);
    expect(document.querySelector('.runtime-datapack-modal .modal-head .eyebrow')?.textContent).toContain('编辑 Spot');
    setField('name', '修改后的 Spot');
    click('.app-modal [data-runtime-editor-create-spot]');

    // 保存仍留在 Spot 编辑页；主动返回浏览器后可见差异面板
    expect(document.querySelector('[data-runtime-editor-spot-form]')).not.toBeNull();
    openBrowser();
    expect(game.registry.spots.get('draft-mod:spot:empty-spot')?.name).toBe('空 Spot');
    expect(entryState('empty-spot')).toBe('modified');
    expect(document.querySelector('.runtime-editor-diff')?.textContent).toContain('修改后的 Spot');

    click('.runtime-editor-panel [data-runtime-editor-apply]');
    expect(game.registry.spots.get('draft-mod:spot:empty-spot')?.name).toBe('修改后的 Spot');
    openBrowser();
    expect(entryState('empty-spot')).toBe('unchanged');

    game.state.spotLevels['draft-mod:spot:empty-spot'] = 2;
    click('.runtime-editor-panel [data-runtime-editor-entry-remove="empty-spot"]');
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
