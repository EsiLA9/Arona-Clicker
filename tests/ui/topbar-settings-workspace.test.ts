// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime/runtime';
import { baseDatapack } from '../../src/data/test-datapack';
import { SaveSystem } from '../../src/data-services/persistence/storage';
import { createUIContext } from '../../src/ui/runtime/context';
import { renderAppShell, type PanelState } from '../../src/ui/components/shared/app-shell';
import { UI_HOST_REGISTRY } from '../../src/ui/runtime/ui-host-registry';
import { UIController } from '../../src/ui/controller/controller';
import { IS_DEBUG_EDITING } from '../../src/ui/runtime-editor/config';
import '../../src/ui/runtime/service-definitions';

const baseState = (): PanelState => ({
  service: 'game',
  leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
  chatEntries: [], chatTexts: [], selectedVariantId: null,
  conversationVariantId: null, studentChats: {}, studentChatTexts: {}, storyNavPath: [],
});

const createEditingCopy = (game: AronaClickerRuntime): string => {
  const source = game.getPackCatalog().entries.find(entry => entry.editingMode === 'normal');
  if (!source) throw new Error('测试需要一个普通态数据包作为编辑态副本来源。');
  const result = game.createEditingPack(source.packRecordId ?? source.id);
  if (!result.ok || !result.packRecordId) throw new Error(result.message);
  return result.packRecordId;
};

describe('顶栏与设置工作区', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
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
    expect(document.querySelectorAll('.runtime-editor-launcher-entry')).toHaveLength(6);
    expect(document.querySelector('.runtime-editor-launcher [data-runtime-editor-launcher-entry="runtime-codex"]')).not.toBeNull();
    expect(document.querySelector('.runtime-editor-panel')).toBeNull();
    expect(document.querySelector('.runtime-editor-launcher [data-runtime-editor-default-area-id-name]')).toBeNull();
    expect(document.querySelector('#toast-layer .toast-action')).toBeNull();
    controller.destroy();
    game.stop();
  });

  it('新建 Init 会在同一份 Draft 中协同创建可自定义 ID 的 defaultArea', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    createEditingCopy(game);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.render();

    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="create-init"]')!.click();
    expect(document.querySelector('.runtime-editor-panel')).not.toBeNull();
    expect(document.querySelector('.runtime-editor-panel[data-runtime-editor-surface-current="browser"]')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('.runtime-editor-panel [data-runtime-editor-section-tab="basics"]')!.click();
    document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-field="idName"]')!.value = 'academy';
    document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-field="name"]')!.value = '学院世界线';
    const defaultArea = document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-default-area-id-name]')!;
    defaultArea.value = 'academy-lobby';
    defaultArea.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.runtime-editor-panel [data-runtime-editor-save-definition="inits"]')!.click();

    const editor = controller.panelState.runtimeDatapackEditor!;
    expect(editor.inits.find(init => init.idName === 'academy')).toMatchObject({ idName: 'academy', defaultAreas: ['base:area:academy-lobby'] });
    expect(editor.areas.find(area => area.idName === 'academy-lobby')).toMatchObject({ idName: 'academy-lobby', initId: 'base:init:academy' });
    controller.modal.close();
    controller.destroy();
    game.stop();
  });

  it('World Apply 后保留 Editor 上下文，关闭后选择页节点仍可交互', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    createEditingCopy(game);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.render();

    /** 图上节点是 SVG <g>：用冒泡 click 走与真实指针一致的选择路径。 */
    const clickNode = (selector: string): SVGElement => {
      const node = root.querySelector<SVGElement>(selector)!;
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return node;
    };
    const oldNode = clickNode('[data-init-select]');
    const oldInitId = oldNode.dataset.initSelect!;
    expect(controller.selectorPage.selectedInitId).toBe(oldInitId);

    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="create-init"]')!.click();
    document.querySelector<HTMLButtonElement>('.runtime-editor-panel [data-runtime-editor-section-tab="basics"]')!.click();
    document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-field="idName"]')!.value = 'academy';
    document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-field="name"]')!.value = '学院世界线';
    const defaultArea = document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-default-area-id-name]')!;
    defaultArea.value = 'academy-lobby';
    defaultArea.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.runtime-editor-panel [data-runtime-editor-save-definition="inits"]')!.click();
    document.querySelector<HTMLButtonElement>('.runtime-editor-panel [data-runtime-editor-apply]')!.click();
    const newInitId = 'base:init:academy';
    const newAreaId = 'base:area:academy-lobby';
    if (!game.registry.inits.has(newInitId)) throw new Error(`World Apply 未提交：${controller.panelState.runtimeDatapackEditor?.error ?? '无编辑器错误'} / ${controller.panelState.runtimeDatapackEditor?.notice ?? '无通知'} / ${game.getRuntimeMod()?.inits?.map(init => init.idName).join(',') ?? '无 Runtime Init'}`);
    expect(game.registry.inits.has(newInitId)).toBe(true);
    expect(game.registry.areas.get(newAreaId)?.initId).toBe(newInitId);
    expect(root.querySelector(`[data-init-select="${newInitId}"]`)).not.toBeNull();
    expect(controller.runtimeEditorPanelOpen).toBe(true);
    expect(document.querySelector('.runtime-editor-panel')).not.toBeNull();
    expect(controller.selectorPage.selectedInitId).toBe(oldInitId);

    document.querySelector<HTMLButtonElement>('[data-runtime-editor-panel-close]')!.click();
    expect(controller.runtimeEditorPanelOpen).toBe(false);
    clickNode(`[data-init-select="${newInitId}"]`);
    expect(controller.selectorPage.selectedInitId).toBe(newInitId);

    const enhNode = clickNode('[data-global-enh-select]');
    const enhId = enhNode.dataset.globalEnhSelect!;
    expect(controller.selectorPage.selectedEnhId).toBe(enhId);
    expect(controller.selectorPage.selectedInitId).toBe(newInitId);
    expect(root.querySelector('[data-selector-graph]')?.getAttribute('data-selector-selected-kind')).toBe('global-enh');

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
    const editingId = createEditingCopy(game);
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
    expect(editor?.packRecordId).toBe(editingId);
    expect(editor?.modName).toBe('base');
    expect(editor?.displayName).toBe('AronaClicker');
    expect(root.querySelector('#runtime-editor-launch')).not.toBeNull();
    expect(root.querySelector('.runtime-editor-toggle')).toBeNull();
  });

  it('从右侧记录详情进入编辑器；启用集草案未 Apply 时阻止进入', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const editingId = createEditingCopy(game);
    game.registerParsedPack({
      manifest: { modName: 'optional', name: 'Optional', version: '1.0.0', dependencies: [] },
      datapack: { ...baseDatapack, modName: 'optional', name: 'Optional', version: '1.0.0', spots: [] },
      images: [], jsonFileCount: 1, ignoredCount: 0,
    }, 'optional-a');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.runtimeEditorExplicitlyClosed = true;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-pack-select="optional-a"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-pack-enabled-toggle="optional-a"]')!.click();
    const selectEditingRecord = (): HTMLButtonElement => {
      const button = root.querySelector<HTMLButtonElement>(`[data-pack-select="${editingId}"]`);
      if (!button) throw new Error('未找到编辑态包库记录。');
      button.click();
      const openEditor = root.querySelector<HTMLButtonElement>(`[data-pack-open-editing="${editingId}"]`);
      if (!openEditor) throw new Error('右侧详情中未找到编辑器入口。');
      return openEditor;
    };

    selectEditingRecord().click();
    expect(controller.runtimeEditorPanelOpen).toBe(false);
    expect(root.textContent).toContain('请先应用启用集草案，再进入编辑模式。');

    controller.resetDatapackDraft();
    controller.render();
    selectEditingRecord().click();
    expect(controller.runtimeEditorPanelOpen).toBe(true);
    expect(controller.panelState.runtimeDatapackEditor?.packRecordId).toBe(editingId);

    document.querySelector<HTMLButtonElement>('[data-runtime-editor-panel-close]')!.click();
    expect(controller.runtimeEditorPanelOpen).toBe(false);
    expect(root.querySelector(`[data-pack-open-editing="${editingId}"]`)).not.toBeNull();

    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="close-editing"]')!.click();
    expect(root.querySelector(`[data-pack-open-editing="${editingId}"]`)).not.toBeNull();

    controller.destroy();
    game.stop();
  });

  it('数据包管理页不再提供创建空编辑态入口', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
    expect(root.querySelector('[data-pack-create-empty-editing]')).toBeNull();
    expect(document.querySelector('.app-modal')).toBeNull();

    controller.destroy();
    game.stop();
  });

  it('拖入启用列表时高亮同名项，并且只在确认后按原位置交换', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const parsed = (modName: string, version: string) => ({
      manifest: { modName, name: modName, version, dependencies: [] },
      datapack: {
        modName, name: modName, version, inits: [], areas: [], spots: [], enhancements: [],
        activeStories: [], passiveStories: [], stories: [], items: [], characters: [], funcletDefs: [],
      },
      images: [], jsonFileCount: 1, ignoredCount: 0,
    });
    game.registerParsedPack(parsed('shared', '1.0.0'), 'shared-active');
    game.registerParsedPack(parsed('later', '1.0.0'), 'later-active');
    game.setPackEnabled('shared-active', true);
    game.setPackEnabled('later-active', true);
    const editing = game.createEditingPack('shared-active', '2.0.0');
    if (!editing.ok || !editing.packRecordId) throw new Error(editing.message);
    const editingId = editing.packRecordId;
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();
    root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();

    const moving = root.querySelector<HTMLElement>(`[data-pack-id="${editingId}"]`)!;
    const active = root.querySelector<HTMLElement>('[data-pack-id="shared-active"]')!;
    const transfer = {
      data: '', effectAllowed: 'move', dropEffect: 'none',
      setData(_type: string, value: string) { this.data = value; },
      getData(_type: string) { return this.data; },
    };
    const dragEvent = (type: string): Event => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: transfer });
      return event;
    };
    const dragToConflict = (): void => {
      moving.dispatchEvent(dragEvent('dragstart'));
      active.dispatchEvent(dragEvent('dragover'));
      expect(active.closest('[data-pack-dropzone="enabled"]')?.classList.contains('is-drop-target'), active.outerHTML).toBe(true);
      expect(active.classList.contains('is-swap-conflict-target')).toBe(true);
      active.dispatchEvent(dragEvent('drop'));
    };
    const workspace = () => controller.panelState.datapackWorkspace!;
    const originalOrder = [...workspace().draftOrder];
    const originalEnabled = [...workspace().draftEnabledIds];

    dragToConflict();
    expect(document.querySelector('.app-modal')?.textContent).toContain('交换同名数据包');
    document.querySelector<HTMLButtonElement>('.app-modal .modal-close')!.click();
    expect(workspace().draftOrder).toEqual(originalOrder);
    expect(workspace().draftEnabledIds).toEqual(originalEnabled);
    moving.dispatchEvent(dragEvent('dragend'));

    const fullRendersBeforeSwap = Number(root.dataset.uiRefreshFull);
    const regionRefreshesBeforeSwap = Number(root.dataset.uiRefreshRegion);
    dragToConflict();
    document.querySelector<HTMLButtonElement>('[data-modal-action="swap-datapack-entry"]')!.click();
    expect(workspace().draftEnabledIds).toEqual(['base@1.0.2', 'gameplay-b@1.0.0', editingId, 'later-active']);
    expect(workspace().draftOrder).toEqual(['base@1.0.2', 'gameplay-b@1.0.0', editingId, 'later-active', 'shared-active']);
    expect(root.querySelector(`[data-pack-select="${editingId}"]`)).not.toBeNull();
    expect(Number(root.dataset.uiRefreshFull), `regions ${regionRefreshesBeforeSwap} -> ${root.dataset.uiRefreshRegion}`).toBe(fullRendersBeforeSwap);
    expect(Number(root.dataset.uiRefreshRegion)).toBeGreaterThan(regionRefreshesBeforeSwap);
    controller.destroy();
    game.stop();
  });

  it('IS_DEBUG_EDITING=1 时优先 hydrate 已存在的编辑态 Runtime Mod，隐藏编辑器不会清除编辑态', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const editingId = createEditingCopy(game);
    if (IS_DEBUG_EDITING !== 1) {
      game.stop();
      return;
    }
    const opened = game.openEditingPack(editingId);
    if (!opened.ok) throw new Error(`打开编辑态失败：${opened.message}`);
    const editingEntry = game.getPackCatalog().entries.find(entry => (entry.packRecordId ?? entry.id) === editingId);
    if (!editingEntry) throw new Error('未找到刚创建的编辑态数据包记录。');
    expect(game.setRuntimeModMetadata({
      targetPackRecordId: editingId,
      modName: editingEntry.modName,
      displayName: '预加载 Mod',
      version: editingEntry.version,
      author: 'tester',
      description: '预加载内容',
    }).ok).toBe(true);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    expect((controller.panelState.runtimeDatapackEditor as { packRecordId?: string } | undefined)?.packRecordId).toBe(editingId);
    expect(controller.panelState.runtimeDatapackEditor?.modName).toBe('base');
    expect(controller.debugEditingHydrated).toBe(true);
    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="mod-info"]')!.click();
    document.querySelector<HTMLButtonElement>('.runtime-editor-panel [data-runtime-editor-panel-close]')!.click();
    expect(controller.panelState.runtimeDatapackEditor?.displayName).toBe('预加载 Mod');
    expect(controller.runtimeEditorPanelOpen).toBe(false);
    controller.destroy();
    game.stop();
  });

  it('IS_DEBUG_EDITING=1 时直接从迷你入口打开也会先打开已有编辑态', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const editingId = createEditingCopy(game);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    if (IS_DEBUG_EDITING !== 1) {
      controller.destroy();
      game.stop();
      return;
    }

    // 模拟编辑态尚未由页面 render 建立，直接走浮动入口。
    controller.panelState.runtimeDatapackEditor = undefined;
    root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
    document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="mod-info"]')!.click();

    const modName = document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-mod-field="modName"]');
    const displayName = document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-mod-field="displayName"]');
    expect((controller.panelState.runtimeDatapackEditor as { packRecordId?: string } | undefined)?.packRecordId).toBe(editingId);
    expect(modName?.value).toBe('base');
    expect(displayName?.value).toBe('AronaClicker');

    controller.destroy();
    game.stop();
  });

  it('IS_DEBUG_EDITING=1 时迷你入口创建内容直接进入目标编辑器，不先渲染编辑中 Mod', () => {
    if (IS_DEBUG_EDITING !== 1) return;
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const editingId = createEditingCopy(game);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    const openFromLauncher = (entry: string, surface: UIController['runtimeEditorSurface']): void => {
      root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
      const records: MutationRecord[] = [];
      const observer = new MutationObserver(next => records.push(...next));
      observer.observe(document.body, { childList: true, subtree: true });
      document.querySelector<HTMLButtonElement>(`[data-runtime-editor-launcher-entry="${entry}"]`)!.click();
      const panelHost = document.querySelector('[data-runtime-editor-panel-host]');
      const panelMutations = [...records, ...observer.takeRecords()].filter(record => record.target === panelHost);
      observer.disconnect();
      expect(controller.runtimeEditorSurface).toBe(surface);
      expect(panelMutations).toHaveLength(1);
      expect(document.querySelector('.runtime-editor-panel [data-runtime-editor-mod-field]')).toBeNull();
      document.querySelector<HTMLButtonElement>('[data-runtime-editor-panel-close]')!.click();
    };

    openFromLauncher('create-init', 'browser');
    openFromLauncher('create-area', 'browser');
    openFromLauncher('create-spot', 'browser');

    controller.destroy();
    game.stop();
  });

  it('单 Mod 多 Spot 逐个即时新建、编辑与删除', () => {
    const game = new AronaClickerRuntime();
    game.init([baseDatapack]);
    const editingId = createEditingCopy(game);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const controller = new UIController(game, root);
    controller.started = true;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
    const enterSelectedEditingPack = (): void => {
      const record = root.querySelector<HTMLButtonElement>(`[data-pack-select="${editingId}"]`);
      if (!record) throw new Error('未找到编辑态包库记录。');
      record.click();
      const openEditor = root.querySelector<HTMLButtonElement>(`[data-pack-open-editing="${editingId}"]`);
      if (!openEditor) throw new Error('右侧详情中未找到编辑器入口。');
      openEditor.click();
    };
    enterSelectedEditingPack();
    expect(root.querySelector('.runtime-editor-form')).toBeNull();
    expect(document.querySelector('.runtime-editor-panel .runtime-editor-form')).not.toBeNull();
    expect(root.querySelector('.pack-draft-actions')).not.toBeNull();

    const setMod = (key: string, value: string) => {
      document.querySelector<HTMLInputElement>(`.runtime-editor-panel [data-runtime-editor-mod-field="${key}"]`)!.value = value;
    };
    const setField = (key: string, value: string) => {
      document.querySelector<HTMLInputElement>(`.runtime-editor-panel [data-runtime-editor-field="${key}"]`)!.value = value;
    };
    const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();
    const editor = () => controller.panelState.runtimeDatapackEditor!;
    const entryState = (idName: string) =>
      document.querySelector(`[data-runtime-editor-entry="${idName}"]`)?.getAttribute('data-entry-state');

    setMod('modName', 'base');
    setMod('displayName', 'Draft Mod');
    click('.runtime-editor-panel [data-runtime-editor-create]');
    expect(editor().error).toBeNull();

    // 保存 Mod 设定后仍停留在 Mod 设定页；进入内容浏览器必须由用户主动选择。
    expect(document.querySelector('[data-runtime-editor-create-spot]')).toBeNull();
    expect(document.querySelector('[data-runtime-editor-mod-field="displayName"]')).not.toBeNull();
    click('.runtime-editor-panel [data-runtime-editor-surface="browser"]');
    click('.runtime-editor-panel [data-runtime-editor-kind-tab="spots"]');
    click('.runtime-editor-panel [data-runtime-editor-new-spot]');
    expect(document.querySelector('[data-runtime-editor-create-spot]')).not.toBeNull();
    expect(document.querySelector('.runtime-editor-panel[data-runtime-editor-surface-current="browser"]')).not.toBeNull();
    // 页互相隔离：字段只在所属页，切页前会自动暂存已填内容。
    click('.runtime-editor-panel [data-runtime-editor-section-tab="basics"]');
    setField('idName', 'empty-spot');
    setField('name', '空 Spot');
    click('.runtime-editor-panel [data-runtime-editor-section-tab="functionalities"]');
    const collectionRows = () => [...document.querySelectorAll<HTMLElement>('.runtime-editor-panel [data-runtime-collection-row]')];
    // 新建只产出最小原型行，字段在条目子弹窗里补全。
    click('.runtime-editor-panel [data-runtime-collection-add]');
    click('.runtime-editor-panel [data-runtime-collection-add]');
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
    click('.runtime-editor-panel [data-runtime-editor-create-spot]');

    // 保存只写草稿：运行时未改变，且仍停留在 Spot 编辑页
    expect(editor().spots.find(spot => spot.idName === 'empty-spot')).toMatchObject({
      idName: 'empty-spot',
      name: '空 Spot',
      functionalities: [
        { kind: 'flow', resource: 'base:resource:credit', amount: 2, condition: { type: 'OR', conditions: [{ target: 'resource', key: 'credit-ready', comparator: '>=', value: 10 }] } },
        { kind: 'linearYield', resource: 'base:resource:pyroxene', amountPerLevel: 3 },
      ],
    });
    expect(game.registry.spots.has('base:spot:empty-spot')).toBe(false);
    expect(document.querySelector('[data-runtime-editor-spot-form]')).not.toBeNull();

    // 显式 Apply 才进入运行时
    click('.runtime-editor-panel [data-runtime-editor-apply]');
    expect(game.registry.spots.has('base:spot:empty-spot')).toBe(true);
    expect(game.registry.spots.get('base:spot:empty-spot')?.functionalities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'flow', resource: 'base:resource:credit', amount: 2 }),
      expect.objectContaining({ kind: 'linearYield', resource: 'base:resource:pyroxene', amountPerLevel: 3 }),
    ]));
    expect(document.querySelector('#toast-layer .toast-action')).toBeNull();

    const openBrowser = () => {
      controller.runtimeEditorPanelOpen = false;
      controller.render();
      root.querySelector<HTMLButtonElement>('[data-service="settings"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-service="datapack"]')!.click();
      root.querySelector<HTMLButtonElement>('#runtime-editor-launch')!.click();
      document.querySelector<HTMLButtonElement>('[data-runtime-editor-launcher-entry="content-browser"]')!.click();
    };
    openBrowser();
    expect(document.querySelector('.runtime-spot-list')).not.toBeNull();
    expect(entryState('empty-spot')).toBe('unchanged');

    // 第二个 Spot 仍从浏览器入口创建，并在浏览器里逐个应用
    click('.runtime-editor-panel [data-runtime-editor-new-spot]');
    click('.runtime-editor-panel [data-runtime-editor-section-tab="basics"]');
    setField('idName', 'second-spot');
    setField('name', '第二个 Spot');
    click('.runtime-editor-panel [data-runtime-editor-section-tab="functionalities"]');
    // 新条目先保存进 Draft，再显式 Apply 到 Runtime。
    click('.runtime-editor-panel [data-runtime-editor-create-spot]');
    expect(editor().spots).toEqual(expect.arrayContaining([
      expect.objectContaining({ idName: 'empty-spot' }),
      expect.objectContaining({ idName: 'second-spot' }),
    ]));
    expect(game.registry.spots.has('base:spot:second-spot')).toBe(false);
    click('.runtime-editor-panel [data-runtime-editor-apply]');
    expect(editor().error).toBeNull();
    expect(editor().selectedSpotId).toBe('second-spot');
    expect(editor().spots).toEqual(expect.arrayContaining([
      expect.objectContaining({ idName: 'empty-spot' }),
      expect.objectContaining({ idName: 'second-spot' }),
    ]));
    expect(game.registry.spots.has('base:spot:second-spot')).toBe(true);

    const areaId = editor().selectedAreaId!;
    expect(game.registry.spots.has('base:spot:second-spot')).toBe(true);
    expect(game.world.spotsOfArea(areaId)).toContain('base:spot:empty-spot');
    expect(game.state.activeInit).toBe('base:init:schale_office');
    expect(game.state.currentAreaId).toBe(areaId);

    controller.runtimeEditorPanelOpen = false;
    controller.render();
    root.querySelector<HTMLButtonElement>('.topbar [data-service="game"]')!.click();
    expect(document.querySelector('.app-modal.is-open')).toBeNull();
    expect(controller.panelState.service).toBe('game');
    expect(root.querySelector('[data-runtime-spot-edit="base:spot:empty-spot"]')).not.toBeNull();
    expect(root.querySelector('[data-runtime-spot-delete="base:spot:empty-spot"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-runtime-spot-edit="base:spot:second-spot"]')!.click();
    click('.runtime-editor-panel [data-runtime-editor-section-tab="basics"]');
    expect(document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-field="idName"]')?.value).toBe('second-spot');
    controller.runtimeEditorPanelOpen = false;
    controller.render();

    root.querySelector<HTMLButtonElement>('[data-runtime-spot-edit="base:spot:empty-spot"]')!.click();
    expect(document.querySelector('.runtime-editor-panel [data-runtime-editor-create-spot]')?.textContent).toContain('保存 Spot 修改');
    // 已应用的条目 ID 锁定在表单层，不允许改名
    expect(document.querySelector<HTMLInputElement>('.runtime-editor-panel [data-runtime-editor-field="idName"]')?.disabled).toBe(true);
    expect(document.querySelector('.runtime-editor-panel[data-runtime-editor-surface-current="browser"]')).not.toBeNull();
    setField('name', '修改后的 Spot');
    click('.runtime-editor-panel [data-runtime-editor-create-spot]');

    // 保存仍留在 Spot 编辑页；主动返回浏览器后可见差异面板
    expect(document.querySelector('[data-runtime-editor-spot-form]')).not.toBeNull();
    openBrowser();
    expect(game.registry.spots.get('base:spot:empty-spot')?.name).toBe('空 Spot');
    expect(entryState('empty-spot')).toBe('modified');
    click('.runtime-editor-panel [data-runtime-editor-section-tab="diagnostics"]');
    expect(document.querySelector('.runtime-editor-diff')?.textContent).toContain('修改后的 Spot');

    click('.runtime-editor-panel [data-runtime-editor-apply]');
    expect(game.registry.spots.get('base:spot:empty-spot')?.name).toBe('修改后的 Spot');
    openBrowser();
    expect(entryState('empty-spot')).toBe('unchanged');

    game.state.spotLevels['base:spot:empty-spot'] = 2;
    click('.runtime-editor-panel [data-runtime-editor-entry-remove="empty-spot"]');
    expect(document.querySelector('[data-runtime-delete-preserve]')).not.toBeNull();
    expect(document.querySelector('[data-runtime-delete-clean]')).not.toBeNull();
    click('.app-modal [data-runtime-delete-clean]');
    expect(game.registry.spots.has('base:spot:empty-spot')).toBe(false);
    expect(game.registry.spots.has('base:spot:second-spot')).toBe(true);
    expect(game.state.spotLevels['base:spot:empty-spot']).toBeUndefined();

    controller.destroy();
    game.stop();
  });
});
