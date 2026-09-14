// ============================================================
// ui/controller-actions-topbar.ts — UI 控制器：顶栏 / 全局工具条事件绑定
// 从 controller.ts 的 bindActions 拆出：tick / 图鉴 / 导入 / 主题浮窗 /
//   帮助 / 彻底重置 / 日志 / Tab 切换（存读档见 controller-save）
// ============================================================

import { SaveSystem } from '../data-services/persistence/storage';
import { openCollectionModal } from './components/collection-modal';
import { filterPacks, orderPacks } from './components/service-workspace';
import { renderRuntimeEditorForm, renderRuntimeSpotForm } from './components/runtime-datapack-editor';
import type { UIController } from './controller';
import { createUIContext } from './context';
import { refreshPresentationHostElements } from './controller-theme';
import type { PackCatalogCommands, PackCatalogReadModel } from '../arona-clicker/contracts';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

function refreshHeaderPresentation(ctrl: UIController): void {
  if (ctrl.root.querySelector('.selector-shell')) {
    ctrl.selectorPage.refreshTopbarPresentation();
    return;
  }
  refreshPresentationHostElements(ctrl, ['header.button']);
}

type TopbarService = 'game' | 'settings' | 'inventory' | 'datapack' | 'saves' | 'records';

function hasUnappliedDatapackDraft(ctrl: UIController): boolean {
  const workspace = ctrl.panelState.datapackWorkspace;
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel>;
  const formal = host.getPackConfiguration?.();
  return Boolean(workspace && formal && (
    JSON.stringify(workspace.draftEnabledIds) !== JSON.stringify(formal.enabledIds)
    || JSON.stringify(workspace.draftOrder) !== JSON.stringify(formal.order)
  ));
}

function navigateFromTopbar(ctrl: UIController, service: TopbarService, rightTab?: string): void {
  const switchService = () => {
    if (ctrl.panelState.workspace) ctrl.disposeWorkspace();
    ctrl.panelState.service = service;
    if (rightTab) ctrl.panelState.rightTab = rightTab;
    ctrl.render();
  };
  // 设置是数据包编辑的安全暂存页：进入设置不应丢弃或阻断草案。
  const leavingDatapack = ctrl.panelState.service === 'datapack' && service !== 'datapack' && service !== 'settings';
  if (leavingDatapack && hasUnappliedDatapackDraft(ctrl)) {
    ctrl.modal.open({
      title: '还有未应用的数据包修改',
      body: '<p>当前数据包草案尚未应用。离开后可以继续保留草案，也可以放弃这些修改。</p>',
      footer: '<button class="modal-close">继续编辑</button><button class="toolbar-button" data-modal-action="discard-pack-draft">放弃修改并离开</button>',
      onAction: action => {
        if (action !== 'discard-pack-draft') return;
        ctrl.resetDatapackDraft();
        ctrl.modal.close();
        switchService();
      },
    });
    return;
  }
  switchService();
}

/** 绑定顶栏 / 全局工具条与 Tab 切换（render 后调用）。 */
export function bindTopBarActions(ctrl: UIController, scope: ParentNode = ctrl.root): void {
  bindDatapackActions(ctrl, scope);
  bindRuntimeDatapackEditorActions(ctrl, scope);
  scope.querySelectorAll<HTMLButtonElement>('[data-service]').forEach(button => {
    button.addEventListener('click', () => {
      const service = button.dataset.service as TopbarService | undefined;
      if (!service) return;
      navigateFromTopbar(ctrl, service);
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-topbar-action="inventory"]').forEach(button => {
    button.addEventListener('click', () => navigateFromTopbar(ctrl, 'inventory'));
  });
  scope.querySelector('#tick-now')?.addEventListener('click', () => {
    ctrl.commands.tick();
    ctrl.refreshLight();
  });
  scope.querySelector('#collection-modal')?.addEventListener('click', () => {
    openCollectionModal(ctrl.modal, ctrl.game);
  });
  scope.querySelector('#import-datapack')?.addEventListener('click', () => {
    ctrl.io.importDatapack();
  });
  scope.querySelector('#theme-palette-btn')?.addEventListener('click', (e) => {
    const float = (e.currentTarget as HTMLElement)
      .closest('.theme-palette')
      ?.querySelector<HTMLElement>('[data-theme-float]');
    if (!float) return;
    ctrl.themeFloatOpen = !ctrl.themeFloatOpen;
    float.classList.toggle('open', ctrl.themeFloatOpen);
    const button = e.currentTarget as HTMLButtonElement;
    button.classList.toggle('is-active', ctrl.themeFloatOpen);
    button.dataset.themeState = ctrl.themeFloatOpen ? 'active' : 'inactive';
    button.setAttribute('aria-expanded', String(ctrl.themeFloatOpen));
    refreshHeaderPresentation(ctrl);
  });
  scope.querySelector('[data-theme-float-close]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    ctrl.themeFloatOpen = false;
    (e.currentTarget as HTMLElement).closest('[data-theme-float]')?.classList.remove('open');
    const button = scope.querySelector<HTMLButtonElement>('#theme-palette-btn');
    button?.classList.remove('is-active');
    if (button) button.dataset.themeState = 'inactive';
    button?.setAttribute('aria-expanded', 'false');
    refreshHeaderPresentation(ctrl);
  });
  // 主题浮窗：拖动标题栏移动（position: fixed，绕开顶栏拥挤）
  const themeFloat = scope.querySelector<HTMLElement>('[data-theme-float]');
  const themeFloatHead = scope.querySelector<HTMLElement>('[data-theme-float-head]');
  if (themeFloat && themeFloatHead) {
    themeFloatHead.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('[data-theme-float-close]')) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = themeFloat.getBoundingClientRect();
      const baseX = rect.left;
      const baseY = rect.top;
      themeFloatHead.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const nx = baseX + (ev.clientX - startX);
        const ny = baseY + (ev.clientY - startY);
        const x = Math.max(0, Math.min(window.innerWidth - 80, nx));
        const y = Math.max(0, Math.min(window.innerHeight - 40, ny));
        themeFloat.style.left = `${x}px`;
        themeFloat.style.top = `${y}px`;
        themeFloat.style.right = 'auto';
        ctrl.themeFloatPos = { x, y };
      };
      const onUp = () => {
        themeFloatHead.releasePointerCapture(e.pointerId);
        themeFloatHead.removeEventListener('pointermove', onMove);
        themeFloatHead.removeEventListener('pointerup', onUp);
      };
      themeFloatHead.addEventListener('pointermove', onMove);
      themeFloatHead.addEventListener('pointerup', onUp);
    });
  }
  scope.querySelector('#help-modal')?.addEventListener('click', () => {
    ctrl.modal.open({
      title: '关于 AronaClicker',
      body: `
        <p>什亭之匣内的联邦搜查部模拟器。经营设施、调度学生、推进剧情。</p>
        <p>操作：<br>· 左侧面板切换 Area / 世界线<br>· 中间为聊天演出<br>· 右侧为设施与强化<br>· 悬停资源条 / 设施可查看详情</p>
        <p>本弹窗为通用弹窗母版的示例用法：<code>modal.open({ title, body, footer, onClose })</code>。</p>`,
      footer: `<button class="primary-button modal-close">知道了</button>`,
    });
  });
  scope.querySelector('#new-game')?.addEventListener('click', () => {
    // 彻底重启：清空全部运行时状态（含 Global 资源 / 已解锁世界线 / 统计），
    // 并删除本地存档，回到首次启动的全新世界线选择。
    if (ctrl.panelState.workspace) ctrl.disposeWorkspace();
    ctrl.commands.reset();
    SaveSystem.delete();
    ctrl.started = false;
    ctrl.panelState.service = 'game';
    ctrl.pendingRestart = false;
    ctrl.toast.show('已彻底重置，回到世界线选择', 'info');
    ctrl.themeFloatOpen = false;
    ctrl.renderInitSelect();
  });
  scope.querySelector('#clear-log')?.addEventListener('click', () => {
    ctrl.commands.clearDevLogs();
    ctrl.scheduleRender();
  });
  scope.querySelector('#export-log')?.addEventListener('click', () => {
    ctrl.io.exportLog();
  });
  scope.querySelector('#dump-enh-debug')?.addEventListener('click', () => {
    ctrl.game.enhancements.dumpEnhancementDebug();
    ctrl.toast.show('Enhancement 条件诊断已写入日志', 'info');
    ctrl.scheduleRender();
  });

  // Tab 切换
  scope.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const [panel, tabId] = (button.dataset.tab ?? ':').split(':');
      if (panel === 'left' && tabId === 'contacts') {
        ctrl.openContactsWorkspace();
        ctrl.render();
        return;
      }
      if (panel === 'left' && tabId === 'story') {
        ctrl.openStoryWorkspace();
        ctrl.render();
        return;
      }
      if (panel === 'left') {
        ctrl.panelState.leftTab = tabId;
        // 左侧只在 Game Workspace 内保留区域内容；通讯录 / 故事已在上方转为正式 Workspace。
        if (tabId === 'area') {
          // 对话空间优先级高于 centerTab：不退出就会停留在学生聊天流上（与对话空间返回键同款退出）
          const onInitChat = ctrl.panelState.centerTab === 'chat' && !ctrl.panelState.conversationVariantId;
          if (ctrl.panelState.conversationVariantId) {
            ctrl.panelState.conversationVariantId = null;
            ctrl.panelState.selectedVariantId = null;
          }
          ctrl.panelState.centerTab = 'chat';
          if (!onInitChat) ctrl.scroll.forceToBottom();
        }
      } else if (panel === 'center') {
        const wasChat = ctrl.panelState.centerTab === 'chat';
        ctrl.panelState.centerTab = tabId;
        if (!wasChat && tabId === 'chat') {
          // 从日志切回聊天：标记强制滚到底
          ctrl.scroll.forceToBottom();
        }
      } else if (panel === 'right') ctrl.panelState.rightTab = tabId;
      const panels = panel === 'left' ? ['left', 'center'] : [panel];
      ctrl.refreshPanels(panels as Array<'left' | 'center' | 'right'>);
    });
  });
  syncRuntimeSpotCreateAction(ctrl);
}

function syncRuntimeSpotCreateAction(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const areaId = ctrl.game.getView().currentAreaId;
  const area = areaId ? ctrl.game.registry.areas.get(areaId) : undefined;
  const key = 'runtime-spot-create';
  if (!editor?.enabled || !editor.modName || !areaId || !area) {
    ctrl.toast.removeAction(key);
    return;
  }
  ctrl.toast.showAction(key, `当前 Area：${escapeHtml(area.name)}`, '创建 Spot', () => {
    editor.selectedAreaId = areaId;
    editor.spot = null;
    editor.applied = false;
    editor.error = null;
    ctrl.modal.open({
      title: `创建 Spot · ${area.name}`,
      body: renderRuntimeSpotForm(createUIContext(ctrl.game), ctrl.panelState),
      footer: '<button type="button" class="modal-close toolbar-button">取消</button>',
      width: 560,
      panelClass: 'runtime-datapack-modal',
      dismissable: false,
    });
    const modal = document.querySelector<HTMLElement>('.app-modal');
    if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
    syncRuntimeSpotCreateAction(ctrl);
  });
}

function readRuntimeEditorFields(ctrl: UIController, scope: ParentNode): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  const value = (key: string): string | undefined => scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-field="${key}"]`)?.value;
  const modName = value('modName');
  const displayName = value('displayName');
  const version = value('version');
  const author = value('author');
  const description = value('description');
  const selectedAreaId = value('selectedAreaId');
  if (modName !== undefined) editor.modName = modName.trim();
  if (displayName !== undefined) editor.displayName = displayName.trim();
  if (version !== undefined) editor.version = version.trim();
  if (author !== undefined) editor.author = author.trim();
  if (description !== undefined) editor.description = description.trim();
  if (selectedAreaId !== undefined) editor.selectedAreaId = selectedAreaId || null;
}

function openRuntimeDatapackEditor(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor?.enabled) return;
  ctrl.modal.open({
    title: `运行时数据包编辑 · ${editor.displayName || '新建 Mod'}`,
    body: renderRuntimeEditorForm(createUIContext(ctrl.game), ctrl.panelState),
    footer: '<button type="button" class="modal-close toolbar-button">关闭编辑器</button>',
    width: 560,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function openRuntimeSpotEditor(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const area = editor?.selectedAreaId ? ctrl.game.registry.areas.get(editor.selectedAreaId) : undefined;
  if (!editor?.enabled || !area) return;
  ctrl.modal.open({
    title: `创建 Spot · ${area.name}`,
    body: renderRuntimeSpotForm(createUIContext(ctrl.game), ctrl.panelState),
    footer: '<button type="button" class="modal-close toolbar-button">关闭编辑器</button>',
    width: 560,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function openLoadedRuntimeSpotEditor(ctrl: UIController): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const runtimeMod = host.getRuntimeMod?.();
  if (!runtimeMod || !ctrl.panelState.runtimeDatapackEditor?.enabled) return;
  const editor = ctrl.panelState.runtimeDatapackEditor;
  editor.modName = runtimeMod.modName;
  editor.displayName = runtimeMod.displayName;
  editor.version = runtimeMod.version;
  editor.author = runtimeMod.author;
  editor.description = runtimeMod.description;
  editor.selectedAreaId = runtimeMod.spot.areaId;
  editor.spot = { ...runtimeMod.spot };
  editor.applied = true;
  editor.error = null;
  openRuntimeSpotEditor(ctrl);
}

function openRuntimeSpotDeleteConfirm(ctrl: UIController): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel>;
  const runtimeMod = host.getRuntimeMod?.();
  if (!runtimeMod) return;
  ctrl.modal.open({
    title: '删除临时 Spot',
    body: `<div class="runtime-editor-form"><p>即将删除「${escapeHtml(runtimeMod.spot.name)}」。请选择是否保留该 Spot 的 PlayerData（等级、管理人等）。</p><p class="service-summary">保留：以后重新创建同 ID Spot 时恢复原状态。清理：同时移除当前状态与各 Init 快照中的对应记录。</p></div>`,
    footer: '<button type="button" class="modal-close toolbar-button">取消</button><button type="button" class="toolbar-button" data-runtime-delete-clean>删除并清理 PlayerData</button><button type="button" class="primary-button" data-runtime-delete-preserve>删除但保留 PlayerData</button>',
    width: 560,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function removeRuntimeSpot(ctrl: UIController, preservePlayerData: boolean): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands>;
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!host.removeRuntimeMod) return;
  const result = host.removeRuntimeMod(preservePlayerData);
  if (!result.ok) {
    ctrl.modal.close();
    ctrl.toast.show(result.message, 'error');
    return;
  }
  if (editor) { editor.spot = null; editor.applied = false; editor.error = null; }
  ctrl.modal.close();
  ctrl.toast.show(result.message, 'success');
  ctrl.panelState.service = 'game';
  ctrl.render();
}

function bindRuntimeDatapackEditorActions(ctrl: UIController, scope: ParentNode): void {
  scope.querySelector('[data-runtime-editor-toggle]')?.addEventListener('click', () => {
    ctrl.panelState.runtimeDatapackEditor = {
      enabled: true, modName: '', displayName: '', version: '1.0.0', author: '', description: '',
      selectedAreaId: [...ctrl.game.registry.areas.keys()][0] ?? null, spot: null, error: null,
    };
    ctrl.toast.show('已开启运行时编辑态', 'info');
    ctrl.render();
    openRuntimeDatapackEditor(ctrl);
  });
  scope.querySelector('[data-runtime-editor-open]')?.addEventListener('click', () => openRuntimeDatapackEditor(ctrl));
  scope.querySelector('[data-runtime-editor-close]')?.addEventListener('click', () => {
    ctrl.modal.close();
    ctrl.panelState.runtimeDatapackEditor = undefined;
    ctrl.toast.show('已关闭运行时编辑态，草稿已放弃', 'info');
    ctrl.render();
  });
  scope.querySelector('[data-runtime-editor-create]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    readRuntimeEditorFields(ctrl, scope);
    const loaded = ctrl.game.registry.loadedModNames;
    if (!/^[a-z0-9-]+$/.test(editor.modName)) editor.error = 'modName 只能包含小写字母、数字和连字符。';
    else if (loaded.has(editor.modName)) editor.error = `modName 已被已加载数据包占用：${editor.modName}`;
    else if (!editor.displayName) editor.error = '请填写 Mod 显示名称。';
    else editor.error = null;
    openRuntimeDatapackEditor(ctrl);
    syncRuntimeSpotCreateAction(ctrl);
  });
  scope.querySelector('[data-runtime-editor-create-spot]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    readRuntimeEditorFields(ctrl, scope);
    const value = (key: string): string => scope.querySelector<HTMLInputElement>(`[data-runtime-editor-field="${key}"]`)?.value ?? '';
    if (editor.error || !editor.modName) { editor.error = editor.error ?? '请先创建合法的 Mod 草稿。'; openRuntimeSpotEditor(ctrl); syncRuntimeSpotCreateAction(ctrl); return; }
    if (!editor.selectedAreaId || !ctrl.game.registry.areas.has(editor.selectedAreaId)) { editor.error = '请选择已有 Area。'; openRuntimeSpotEditor(ctrl); syncRuntimeSpotCreateAction(ctrl); return; }
    const idName = value('spotIdName').trim();
    const name = value('spotName').trim();
    if (!/^[a-z0-9_-]+$/.test(idName)) editor.error = 'Spot ID 名只能包含小写字母、数字、下划线和连字符。';
    else if (!name) editor.error = '请填写 Spot 名称。';
    else {
      editor.spot = { idName, name, description: value('spotDescription').trim(), baseCost: Number(value('baseCost')) || 0, baseCostResource: value('baseCostResource').trim(), baseYield: Number(value('baseYield')) || 0, baseYieldResource: value('baseYieldResource').trim(), baseCapacity: Number(value('baseCapacity')) || 0 };
      editor.error = null;
    }
    const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands>;
    if (!editor.error && editor.spot && host.applyRuntimeMod) {
      const result = host.applyRuntimeMod({
        modName: editor.modName,
        displayName: editor.displayName,
        version: editor.version,
        author: editor.author,
        description: editor.description,
        spot: { ...editor.spot, areaId: editor.selectedAreaId ?? '' },
      });
      if (!result.ok) {
        editor.error = result.message;
        openRuntimeSpotEditor(ctrl);
        syncRuntimeSpotCreateAction(ctrl);
        return;
      }
      editor.applied = true;
      editor.error = null;
      ctrl.modal.close();
      ctrl.toast.show(result.message, 'success');
      ctrl.panelState.service = 'game';
      ctrl.render();
      syncRuntimeSpotCreateAction(ctrl);
      return;
    }
    openRuntimeSpotEditor(ctrl);
    syncRuntimeSpotCreateAction(ctrl);
  });
  scope.querySelector('[data-runtime-editor-apply]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    const spot = editor?.spot;
    const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands>;
    if (!editor || !spot || !host.applyRuntimeMod) return;
    readRuntimeEditorFields(ctrl, scope);
    const result = host.applyRuntimeMod({
      modName: editor.modName,
      displayName: editor.displayName,
      version: editor.version,
      author: editor.author,
      description: editor.description,
      spot: { ...spot, areaId: editor.selectedAreaId ?? '' },
    });
    if (!result.ok) {
      editor.error = result.message;
      openRuntimeSpotEditor(ctrl);
      syncRuntimeSpotCreateAction(ctrl);
      return;
    }
    editor.applied = true;
    editor.error = null;
    ctrl.modal.close();
    ctrl.toast.show(result.message, 'success');
    ctrl.panelState.service = 'game';
    ctrl.render();
  });
  scope.querySelector('[data-runtime-editor-delete-spot]')?.addEventListener('click', () => {
    openRuntimeSpotDeleteConfirm(ctrl);
  });
  scope.querySelector('[data-runtime-editor-discard-spot]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    editor.spot = null;
    editor.error = null;
    openRuntimeSpotEditor(ctrl);
    syncRuntimeSpotCreateAction(ctrl);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-spot-edit]').forEach(button => {
    button.addEventListener('click', () => openLoadedRuntimeSpotEditor(ctrl));
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-spot-delete]').forEach(button => {
    button.addEventListener('click', () => openRuntimeSpotDeleteConfirm(ctrl));
  });
  scope.querySelector('[data-runtime-delete-preserve]')?.addEventListener('click', () => removeRuntimeSpot(ctrl, true));
  scope.querySelector('[data-runtime-delete-clean]')?.addEventListener('click', () => removeRuntimeSpot(ctrl, false));
}

function bindDatapackActions(ctrl: UIController, scope: ParentNode): void {
  const initialRoot = ctrl.panelState.datapackWorkspace;
  if (!initialRoot) return;
  let root = initialRoot;
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel & PackCatalogCommands>;
  const render = () => ctrl.render();
  // resetDatapackDraft 会替换 panelState 上的工作区对象，必须重新取引用，
  // 否则随后的 lastResult / validation 会写到已被丢弃的旧对象上（反馈丢失）。
  const resetDraft = (): void => {
    ctrl.resetDatapackDraft();
    root = ctrl.panelState.datapackWorkspace ?? root;
  };
  const reorderable = (id: string): boolean => {
    const entry = host.getPackCatalog?.().entries.find(item => item.id === id);
    return entry ? (entry.capabilities?.reorderable ?? entry.sourceKind !== 'builtin') : false;
  };
  scope.querySelectorAll<HTMLButtonElement>('[data-datapack-section]').forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.datapackSection as typeof root.section;
      root.section = section;
      ctrl.panelState.service = 'datapack';
      const entries = host.getPackCatalog?.().entries ?? [];
      const enabledIds = new Set(root.draftEnabledIds);
      const visible = filterPacks(section, orderPacks(entries, root.draftOrder), entries, root.draftOrder, enabledIds);
      if (root.selectedPackId && !visible.some(entry => entry.id === root.selectedPackId)) root.selectedPackId = null;
      render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-select]').forEach(button => {
    button.addEventListener('click', () => {
      root.selectedPackId = button.dataset.packSelect ?? null;
      render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-draft-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.packDraftToggle;
      if (!id) return;
      const entry = host.getPackCatalog?.().entries.find(item => item.id === id);
      if (entry && entry.capabilities && !entry.capabilities.enableable) {
        root.lastResult = { ok: false, message: '核心数据包必须始终保留在启用集内。' };
        render();
        return;
      }
      root.draftEnabledIds = root.draftEnabledIds.includes(id)
        ? root.draftEnabledIds.filter(item => item !== id)
        : [...root.draftEnabledIds, id];
      root.validation = null;
      root.lastResult = null;
      render();
    });
  });
  const move = (id: string, delta: number) => {
    if (!reorderable(id)) return;
    const index = root.draftOrder.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= root.draftOrder.length) return;
    if (!reorderable(root.draftOrder[target])) {
      root.lastResult = { ok: false, message: '核心数据包固定在最前，不可被越过。' };
      render();
      return;
    }
    const next = [...root.draftOrder];
    [next[index], next[target]] = [next[target], next[index]];
    root.draftOrder = next;
    root.validation = null;
    root.lastResult = null;
    render();
  };
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-draft-up]').forEach(button => button.addEventListener('click', () => move(button.dataset.packDraftUp!, -1)));
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-draft-down]').forEach(button => button.addEventListener('click', () => move(button.dataset.packDraftDown!, 1)));
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-remove]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.packRemove;
      if (!id) return;
      const entry = host.getPackCatalog?.().entries.find(item => item.id === id);
      if (!entry) return;
      ctrl.modal.open({
        title: '从包库移除数据包',
        body: `<p>确认将 <strong>${escapeHtml(entry.name)}</strong>（${escapeHtml(entry.modName)} v${escapeHtml(entry.version)}）从包库移除？</p><p class="muted">该操作只影响包库，未启用数据包不影响当前运行内容。</p>`,
        footer: '<button class="modal-close">取消</button><button class="toolbar-button" data-modal-action="remove-datapack">确认移除</button>',
        onAction: action => {
          if (action !== 'remove-datapack') return;
          try {
            host.removePack?.(id);
            root.lastResult = { ok: true, message: `已从包库移除：${entry.name}` };
          } catch (error) {
            root.lastResult = { ok: false, message: error instanceof Error ? error.message : String(error) };
          }
          ctrl.modal.close();
          render();
        },
      });
    });
  });
  scope.querySelector('[data-pack-discard]')?.addEventListener('click', () => {
    ctrl.modal.open({
      title: '放弃数据包草案',
      body: '<p>将丢弃当前未应用的数据包启用集与加载顺序修改，恢复为已应用的正式配置。</p>',
      footer: '<button class="modal-close">继续编辑</button><button class="toolbar-button" data-modal-action="discard-datapack-draft">放弃修改</button>',
      onAction: action => {
        if (action !== 'discard-datapack-draft') return;
        resetDraft();
        root.lastResult = { ok: true, message: '已放弃草案，恢复正式配置。' };
        ctrl.modal.close();
        render();
      },
    });
  });
  scope.querySelector('[data-pack-validate]')?.addEventListener('click', () => {
    if (!host.validatePackConfiguration) return;
    const report = host.validatePackConfiguration({ enabledIds: root.draftEnabledIds, order: root.draftOrder });
    root.validation = { ok: report.ok, errors: [...report.errors], warnings: [...report.warnings] };
    root.lastResult = { ok: report.ok, message: report.ok ? '启用集校验通过，可以应用。' : report.errors[0] ?? '启用集校验失败。' };
    render();
  });
  scope.querySelector('[data-pack-apply]')?.addEventListener('click', () => {
    if (!host.applyPackConfiguration) return;
    const draft = { enabledIds: [...root.draftEnabledIds], order: [...root.draftOrder] };
    const report = host.validatePackConfiguration?.(draft);
    if (report && !report.ok) {
      root.validation = { ok: false, errors: [...report.errors], warnings: [...report.warnings] };
      root.lastResult = { ok: false, message: report.errors[0] ?? '启用集校验失败。' };
      render();
      return;
    }
    ctrl.modal.open({
      title: '确认应用启用集',
      body: '<p>确认前会先保存当前进度；保存成功后才会重新加载数据包序列，并重建 Registry、图片索引和主题资源。</p><p class="muted">保存失败或取消时不会改变正式数据包序列。</p>',
      footer: '<button class="modal-close">取消</button><button class="primary-button" data-modal-action="apply-datapack">保存并应用</button>',
      onAction: action => {
        if (action !== 'apply-datapack') return;
        const saved = SaveSystem.save(ctrl.withHistories(ctrl.commands.save()));
        if (!saved) {
          root.lastResult = { ok: false, message: '应用已停止：当前进度保存失败，数据包序列未重载。' };
          ctrl.modal.close();
          render();
          return;
        }
        const result = host.applyPackConfiguration!(draft);
        if (result.ok) {
          resetDraft();
          root.lastResult = { ok: true, message: result.message };
          root.validation = { ok: result.validation.ok, errors: [...result.validation.errors], warnings: [...result.validation.warnings] };
        } else {
          root.validation = { ok: result.validation.ok, errors: [...result.validation.errors], warnings: [...result.validation.warnings] };
          root.lastResult = { ok: false, message: result.message };
        }
        ctrl.modal.close();
        render();
      },
    });
  });
}
