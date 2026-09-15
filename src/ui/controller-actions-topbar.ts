// ============================================================
// ui/controller-actions-topbar.ts — UI 控制器：顶栏 / 全局工具条事件绑定
// 从 controller.ts 的 bindActions 拆出：tick / 图鉴 / 导入 / 主题浮窗 /
//   帮助 / 彻底重置 / 日志 / Tab 切换（存读档见 controller-save）
// ============================================================

import { SaveSystem } from '../data-services/persistence/storage';
import { openCollectionModal } from './components/collection-modal';
import { buildDatapackWorkspaceView } from '../arona-clicker/services/datapack-workspace-view';
import { renderRuntimeEditorForm, renderRuntimeEditorWorkspace, renderRuntimeSpotForm } from './components/runtime-datapack-editor';
import { SPOT_CONTENT_POLICY, validateAuthoringInput } from '../data-services/authoring/content-policy';
import {
  hasDatapackWorkspaceChanges,
  moveDatapackDraft,
  setDatapackResult,
  setDatapackSection,
  setDatapackSelection,
  setDatapackValidation,
  toggleDatapackDraftEnabled,
} from './workspace/datapack-workspace-state';
import {
  createRuntimeDatapackEditorState,
  findRuntimeEditorAppliedSpot,
  getSelectedRuntimeEditorSpot,
  hydrateRuntimeEditor,
  markRuntimeEditorApplied,
  prepareRuntimeEditorForNewSpot,
  removeRuntimeEditorSpot,
  runtimeEditorPendingSpots,
  selectRuntimeEditorSpot,
  setRuntimeEditorError,
  setRuntimeEditorFilter,
  setRuntimeEditorProblems,
  setRuntimeEditorSpot,
  setRuntimeEditorSpotSuspended,
  toRuntimeModDraft,
  updateRuntimeEditorFields,
  type RuntimeEditorFilter,
  type RuntimeEditorProblem,
  type RuntimeEditorSpotDraft,
} from './workspace/runtime-datapack-editor-state';
import {
  readRuntimeEditorAffectorRows,
  readRuntimeEditorFields,
  renderRuntimeEditorAffectorList,
} from './workspace/runtime-editor-form';
import type { UIController } from './controller';
import { createUIContext } from './context';
import { refreshPresentationHostElements } from './controller-theme';
import type { PackCatalogCommands, PackCatalogReadModel } from '../arona-clicker/contracts';
import type { RuntimeSpotInput, RuntimeSpotMutationResult } from '../arona-clicker/contracts/runtime-content';

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
  return Boolean(workspace && hasDatapackWorkspaceChanges(workspace, formal));
}

function navigateFromTopbar(ctrl: UIController, service: TopbarService, rightTab?: string): void {
  const switchService = () => {
    if (ctrl.panelState.workspace) ctrl.disposeWorkspace();
    ctrl.navigateToService(service);
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
    ctrl.navigateToService('game');
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
  if (!editor?.enabled || !editor.modName || !editor.displayName || !areaId || !area) {
    ctrl.toast.removeAction(key);
    return;
  }
  ctrl.toast.showAction(key, `当前 Area：${escapeHtml(area.name)}`, '创建 Spot', () => {
    prepareRuntimeEditorForNewSpot(editor, areaId);
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

function readRuntimeEditorModFields(ctrl: UIController, scope: ParentNode): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  const value = (key: string): string | undefined => scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-mod-field="${key}"]`)?.value;
  const modName = value('modName');
  const displayName = value('displayName');
  const version = value('version');
  const author = value('author');
  const description = value('description');
  const selectedAreaId = value('selectedAreaId');
  updateRuntimeEditorFields(editor, {
    modName,
    displayName,
    version,
    author,
    description,
    selectedAreaId: selectedAreaId ?? undefined,
  });
}

function openRuntimeDatapackEditor(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor?.enabled) return;
  const ctx = createUIContext(ctrl.game);
  ctrl.modal.open({
    title: `运行时数据包编辑 · ${editor.displayName || '新建 Mod'}`,
    body: `${renderRuntimeEditorForm(ctx, ctrl.panelState)}${renderRuntimeEditorWorkspace(ctx, ctrl.panelState)}`,
    footer: '<button type="button" class="modal-close toolbar-button">关闭编辑器</button>',
    width: 640,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function openRuntimeSpotEditor(ctrl: UIController): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const spot = editor ? getSelectedRuntimeEditorSpot(editor) : null;
  const areaId = spot?.areaId ?? editor?.selectedAreaId;
  const area = areaId ? ctrl.game.registry.areas.get(areaId) : undefined;
  if (!editor?.enabled || !area) return;
  ctrl.modal.open({
    title: `${spot ? '编辑' : '创建'} Spot · ${area.name}`,
    body: renderRuntimeSpotForm(createUIContext(ctrl.game), ctrl.panelState),
    footer: '<button type="button" class="modal-close toolbar-button">关闭编辑器</button>',
    width: 560,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function openLoadedRuntimeSpotEditor(ctrl: UIController, runtimeSpotId?: string): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const runtimeMod = host.getRuntimeMod?.();
  if (!runtimeMod || !ctrl.panelState.runtimeDatapackEditor?.enabled) return;
  const editor = ctrl.panelState.runtimeDatapackEditor;
  hydrateRuntimeEditor(editor, runtimeMod);
  const idName = runtimeSpotId?.split(':').pop();
  if (idName) selectRuntimeEditorSpot(editor, idName);
  openRuntimeSpotEditor(ctrl);
}

function openRuntimeSpotDeleteConfirm(ctrl: UIController, runtimeSpotId?: string): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const runtimeMod = host.getRuntimeMod?.();
  const editor = ctrl.panelState.runtimeDatapackEditor;
  const idName = runtimeSpotId?.split(':').pop() ?? editor?.selectedSpotId ?? undefined;
  if (idName && editor && !editor.spots.some(spot => spot.idName === idName) && runtimeMod) hydrateRuntimeEditor(editor, runtimeMod);
  if (idName && editor) selectRuntimeEditorSpot(editor, idName);
  const spot = idName ? editor?.spots.find(item => item.idName === idName) : undefined;
  if (!spot) return;
  const runtimeLoaded = Boolean(runtimeMod?.spots.some(item => item.idName === spot.idName));
  ctrl.modal.open({
    title: '删除临时 Spot',
    body: `<div class="runtime-editor-form"><p>即将删除「${escapeHtml(spot.name || spot.idName)}」。${runtimeLoaded ? '该 Spot 已经应用到 Runtime。' : '该 Spot 尚未应用到 Runtime。'}</p><p class="service-summary">保留：以后重新创建同 ID Spot 时恢复原状态。清理：同时移除当前状态与各 Init 快照中的对应记录。</p></div>`,
    footer: '<button type="button" class="modal-close toolbar-button">取消</button><button type="button" class="toolbar-button" data-runtime-delete-clean>删除并清理 PlayerData</button><button type="button" class="primary-button" data-runtime-delete-preserve>删除但保留 PlayerData</button>',
    width: 560,
    panelClass: 'runtime-datapack-modal',
    dismissable: false,
  });
  const modal = document.querySelector<HTMLElement>('.app-modal');
  if (modal) bindRuntimeDatapackEditorActions(ctrl, modal);
}

function removeRuntimeSpot(ctrl: UIController, preservePlayerData: boolean): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogCommands & PackCatalogReadModel>;
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor || !editor.selectedSpotId) return;
  const spot = getSelectedRuntimeEditorSpot(editor);
  if (!spot) return;
  const spotId = `${editor.modName}:spot:${spot.idName}`;
  const runtimeState = host.getRuntimeContentState?.();
  const editorCommands = ctrl.commands.runtimeDefinitionEditor;
  const wasApplied = runtimeState?.spots.has(spotId) ?? Boolean(editor.applied);
  let result: { ok: boolean; message: string } = { ok: true, message: `Spot 草稿已删除：${spot.idName}。` };
  if (wasApplied) {
    if (editorCommands && runtimeState) {
      const hotResult = editorCommands.deleteSpot(spot.idName, preservePlayerData ? 'retain' : 'purge');
      if (!hotResult.ok) {
        ctrl.modal.close();
        ctrl.toast.show(hotResult.message, 'error');
        openRuntimeSpotEditor(ctrl);
        return;
      }
      removeRuntimeEditorSpot(editor, spot.idName);
      markRuntimeEditorApplied(editor, true);
      result = { ok: true, message: preservePlayerData ? `临时 Spot 已删除，PlayerData 已保留：${spot.idName}。` : `临时 Spot 与对应 PlayerData 已删除：${spot.idName}。` };
    } else {
      ctrl.modal.close();
      ctrl.toast.show('当前运行时不支持 Runtime Editor Command Facade。', 'error');
      return;
    }
  } else {
    if (!removeRuntimeEditorSpot(editor, spot.idName)) return;
  }
  ctrl.modal.close();
  ctrl.toast.show(result.message, 'success');
  if (wasApplied) {
    ctrl.navigateToService('game');
    ctrl.render();
  } else {
    openRuntimeDatapackEditor(ctrl);
  }
}

function applyRuntimeEditorDraft(ctrl: UIController, idNames?: readonly string[]): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  const targets = idNames
    ? editor.spots.filter(spot => idNames.includes(spot.idName))
    : runtimeEditorPendingSpots(editor);
  if (!editor.modName || !editor.displayName) {
    setRuntimeEditorError(editor, '请先完成 Mod 元信息。');
    openRuntimeDatapackEditor(ctrl);
    return;
  }
  if (targets.length === 0) {
    setRuntimeEditorError(editor, '没有需要应用的草稿改动。');
    openRuntimeDatapackEditor(ctrl);
    return;
  }

  const editorCommands = ctrl.commands.runtimeDefinitionEditor;
  const setMetadata = ctrl.commands.setRuntimeModMetadata;
  if (!editorCommands || !setMetadata) {
    setRuntimeEditorError(editor, '当前运行时不支持 Runtime Editor Command Facade。');
    openRuntimeDatapackEditor(ctrl);
    return;
  }
  const metadata = setMetadata({
    modName: editor.modName,
    displayName: editor.displayName,
    version: editor.version,
    author: editor.author,
    description: editor.description,
  });
  if (!metadata.ok) {
    setRuntimeEditorError(editor, metadata.message);
    openRuntimeDatapackEditor(ctrl);
    return;
  }

  const fail = (message: string, diagnostics: readonly RuntimeEditorProblem[]): void => {
    setRuntimeEditorError(editor, message);
    setRuntimeEditorProblems(editor, diagnostics);
    openRuntimeDatapackEditor(ctrl);
  };
  let appliedCount = 0;
  for (const spot of targets) {
    const applied = findRuntimeEditorAppliedSpot(editor, spot.idName);
    const suspended = editor.suspendedSpotIds.includes(spot.idName);
    if (suspended) {
      if (!applied) continue;
      const suspendedResult = editorCommands.suspendSpot(spot.idName);
      if (!suspendedResult.ok) {
        fail(suspendedResult.message, suspendedResult.diagnostics);
        return;
      }
      appliedCount += 1;
      continue;
    }
    if (spot.unsupportedFunctionalityIds?.length) {
      fail(`Spot 含 Demo 编辑器无法 round-trip 的资源功能：${spot.unsupportedFunctionalityIds.join('、')}`, [{
        code: 'invalid-field',
        path: 'spot.affectors',
        message: '请先在 Datapack 中处理该资源功能，Runtime Editor 不会静默覆盖它。',
      }]);
      return;
    }
    // 字段集由策略表保证；此处只是 DOM 值到命令输入的静态类型边界。
    const { unsupportedFunctionalityIds: _unsupported, ...input } = spot;
    const result: RuntimeSpotMutationResult = applied
      ? editorCommands.replaceSpot(spot.idName, input)
      : editorCommands.createSpot(input);
    if (!result.ok) {
      fail(result.message, result.diagnostics);
      return;
    }
    appliedCount += 1;
  }

  markRuntimeEditorApplied(editor, true);
  setRuntimeEditorError(editor, null);
  setRuntimeEditorProblems(editor, []);
  openRuntimeDatapackEditor(ctrl);
  ctrl.toast.showAction('runtime-editor-applied', `${appliedCount} 项已应用到运行时`, '查看游戏', () => {
    ctrl.modal.close();
    ctrl.navigateToService('game');
    ctrl.render();
  });
  ctrl.render();
  syncRuntimeSpotCreateAction(ctrl);
}

/** 保存当前表单到草稿：只产生 Draft revision，不触碰运行时。 */
function saveRuntimeSpotDraft(ctrl: UIController, scope: ParentNode): void {
  const editor = ctrl.panelState.runtimeDatapackEditor;
  if (!editor) return;
  const values = readRuntimeEditorFields(SPOT_CONTENT_POLICY, scope);
  values.affectors = readRuntimeEditorAffectorRows(scope);
  const problem = validateAuthoringInput(SPOT_CONTENT_POLICY, values, {
    resourceIds: new Set(ctrl.game.registry.resourceDisplays.keys()),
  });
  const previousId = editor.selectedSpotId;
  if (problem) {
    setRuntimeEditorProblems(editor, [problem]);
    setRuntimeEditorError(editor, problem.message);
    openRuntimeSpotEditor(ctrl);
    return;
  }
  const idName = String(values.idName);
  const previous = previousId ? editor.spots.find(spot => spot.idName === previousId) : undefined;
  const applied = findRuntimeEditorAppliedSpot(editor, idName);
  const duplicate = editor.spots.some(spot => spot.idName === idName && spot.idName !== previousId);
  if (applied && idName !== previousId) {
    setRuntimeEditorProblems(editor, []);
    setRuntimeEditorError(editor, '已应用 Spot 的 ID 不能修改；如需更换 ID，请删除后新建。');
    openRuntimeSpotEditor(ctrl);
    return;
  }
  if (duplicate) {
    setRuntimeEditorProblems(editor, []);
    setRuntimeEditorError(editor, `当前 Draft 已存在 Spot ID：${idName}`);
    openRuntimeSpotEditor(ctrl);
    return;
  }
  setRuntimeEditorSpot(editor, {
    ...values,
    ...(previous?.unsupportedFunctionalityIds ? { unsupportedFunctionalityIds: previous.unsupportedFunctionalityIds } : {}),
  } as unknown as RuntimeEditorSpotDraft);
  setRuntimeEditorProblems(editor, []);
  setRuntimeEditorError(editor, null);
  openRuntimeDatapackEditor(ctrl);
  syncRuntimeSpotCreateAction(ctrl);
}

function bindRuntimeDatapackEditorActions(ctrl: UIController, scope: ParentNode): void {
  scope.querySelector('[data-runtime-editor-toggle]')?.addEventListener('click', () => {
    ctrl.panelState.runtimeDatapackEditor = createRuntimeDatapackEditorState([...ctrl.game.registry.areas.keys()][0] ?? null);
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
    readRuntimeEditorModFields(ctrl, scope);
    const loaded = ctrl.game.registry.loadedModNames;
    const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel>;
    const currentRuntimeMod = host.getRuntimeMod?.();
    const hadSpots = Boolean(currentRuntimeMod?.spots.length || editor.spots.length);
    if (!/^[a-z0-9-]+$/.test(editor.modName)) setRuntimeEditorError(editor, 'modName 只能包含小写字母、数字和连字符。');
    else if (loaded.has(editor.modName) && currentRuntimeMod?.modName !== editor.modName) setRuntimeEditorError(editor, `modName 已被已加载数据包占用：${editor.modName}`);
    else if (!editor.displayName) setRuntimeEditorError(editor, '请填写 Mod 显示名称。');
    else if (ctrl.commands.setRuntimeModMetadata) {
      const result = ctrl.commands.setRuntimeModMetadata({
        modName: editor.modName,
        displayName: editor.displayName,
        version: editor.version,
        author: editor.author,
        description: editor.description,
      });
      setRuntimeEditorError(editor, result.ok ? null : result.message);
      if (!result.ok) {
        openRuntimeDatapackEditor(ctrl);
        syncRuntimeSpotCreateAction(ctrl);
        return;
      }
    } else setRuntimeEditorError(editor, null);
    ctrl.modal.close();
    if (!hadSpots) {
      const areaId = editor.selectedAreaId ?? ctrl.game.getView().currentAreaId ?? [...ctrl.game.registry.areas.keys()][0];
      if (areaId) {
        prepareRuntimeEditorForNewSpot(editor, areaId);
        ctrl.toast.show('Mod 信息已保存，现在创建第一个 Spot。', 'success');
        openRuntimeSpotEditor(ctrl);
      } else {
        ctrl.toast.show('Mod 信息已保存。', 'success');
        ctrl.render();
      }
    } else {
      ctrl.toast.show('Mod 信息已保存。', 'success');
      ctrl.navigateToService('game');
      ctrl.render();
    }
    syncRuntimeSpotCreateAction(ctrl);
  });
  scope.querySelector('[data-runtime-editor-create-spot]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    if (!editor.modName || !editor.displayName) {
      setRuntimeEditorError(editor, '请先完成 Mod 元信息。');
      openRuntimeDatapackEditor(ctrl);
      syncRuntimeSpotCreateAction(ctrl);
      return;
    }
    saveRuntimeSpotDraft(ctrl, scope);
  });
  bindRuntimeAffectorActions(ctrl, scope);
  scope.querySelector('[data-runtime-editor-apply]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    if (scope.querySelector('[data-runtime-editor-field="idName"]')) {
      saveRuntimeSpotDraft(ctrl, scope);
      if (editor.error) return;
    }
    applyRuntimeEditorDraft(ctrl, editor.selectedSpotId ? [editor.selectedSpotId] : undefined);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!editor) return;
      setRuntimeEditorFilter(editor, (button.dataset.runtimeEditorFilter ?? 'all') as RuntimeEditorFilter);
      openRuntimeDatapackEditor(ctrl);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-entry-edit]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      if (!editor) return;
      const idName = button.dataset.runtimeEditorEntryEdit;
      if (!idName || !selectRuntimeEditorSpot(editor, idName)) return;
      openRuntimeSpotEditor(ctrl);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-entry-remove]').forEach(button => {
    button.addEventListener('click', () => {
      const editor = ctrl.panelState.runtimeDatapackEditor;
      const idName = button.dataset.runtimeEditorEntryRemove;
      if (!editor || !idName) return;
      selectRuntimeEditorSpot(editor, idName);
      openRuntimeSpotDeleteConfirm(ctrl, `${editor.modName}:spot:${idName}`);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-diagnostic]').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.runtimeEditorDiagnostic;
      if (!key) return;
      scope.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-runtime-editor-field="${key}"]`)?.focus();
    });
  });
  scope.querySelector('[data-runtime-editor-delete-spot]')?.addEventListener('click', () => {
    openRuntimeSpotDeleteConfirm(ctrl);
  });
  scope.querySelector('[data-runtime-editor-new-spot]')?.addEventListener('click', () => {
    const editor = ctrl.panelState.runtimeDatapackEditor;
    if (!editor) return;
    const areaId = editor.selectedAreaId ?? ctrl.game.getView().currentAreaId ?? [...ctrl.game.registry.areas.keys()][0];
    if (!areaId) return;
    prepareRuntimeEditorForNewSpot(editor, areaId);
    openRuntimeSpotEditor(ctrl);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-spot-edit]').forEach(button => {
    button.addEventListener('click', () => openLoadedRuntimeSpotEditor(ctrl, button.dataset.runtimeSpotEdit));
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-spot-delete]').forEach(button => {
    button.addEventListener('click', () => openRuntimeSpotDeleteConfirm(ctrl, button.dataset.runtimeSpotDelete));
  });
  scope.querySelector('[data-runtime-delete-preserve]')?.addEventListener('click', () => removeRuntimeSpot(ctrl, true));
  scope.querySelector('[data-runtime-delete-clean]')?.addEventListener('click', () => removeRuntimeSpot(ctrl, false));
}

function bindRuntimeAffectorActions(ctrl: UIController, scope: ParentNode): void {
  scope.querySelector('[data-runtime-editor-affector-add]')?.addEventListener('click', () => {
    const panel = scope.querySelector<HTMLElement>('[data-runtime-editor-affectors]');
    if (!panel) return;
    const rows = readRuntimeEditorAffectorRows(panel);
    const ids = new Set(rows.map(row => row.id));
    let index = 1;
    while (ids.has(`affector-${index}`)) index += 1;
    rows.push({
      id: `affector-${index}`,
      type: 'resource-flow',
      mode: 'fixed',
      resource: [...ctrl.game.registry.resourceDisplays.keys()][0] ?? '',
      amount: 1,
    });
    panel.outerHTML = renderRuntimeEditorAffectorList(createUIContext(ctrl.game), rows, ctrl.panelState.runtimeDatapackEditor?.problems ?? []);
    bindRuntimeAffectorActions(ctrl, scope);
  });
  scope.querySelectorAll<HTMLElement>('[data-runtime-editor-affector-delete]').forEach(button => {
    button.addEventListener('click', () => {
      const panel = scope.querySelector<HTMLElement>('[data-runtime-editor-affectors]');
      const row = button.closest<HTMLElement>('[data-runtime-editor-affector-row]');
      if (!panel || !row) return;
      const id = row.dataset.runtimeEditorAffectorId;
      const rows = readRuntimeEditorAffectorRows(panel).filter(item => item.id !== id);
      panel.outerHTML = renderRuntimeEditorAffectorList(createUIContext(ctrl.game), rows, ctrl.panelState.runtimeDatapackEditor?.problems ?? []);
      bindRuntimeAffectorActions(ctrl, scope);
    });
  });
  scope.querySelectorAll<HTMLSelectElement>('[data-runtime-editor-affector-field="mode"]').forEach(select => {
    select.addEventListener('change', () => {
      const label = select.closest<HTMLElement>('[data-runtime-editor-affector-row]')?.querySelector<HTMLElement>('[data-runtime-editor-affector-amount-label]');
      if (label) label.textContent = select.value === 'per-level' ? '每级产出' : '持续产出';
    });
  });
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
  scope.querySelectorAll<HTMLButtonElement>('[data-datapack-section]').forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.datapackSection as typeof root.section;
      setDatapackSection(root, section);
      ctrl.replaceWorkspaceRoute({ kind: 'service', page: 'datapack' });
      const entries = host.getPackCatalog?.().entries ?? [];
      const view = buildDatapackWorkspaceView({
        entries,
        section,
        draftOrder: root.draftOrder,
        draftEnabledIds: root.draftEnabledIds,
        selectedPackId: root.selectedPackId,
        validation: root.validation,
      });
      if (root.selectedPackId && !view.filteredEntries.some(entry => entry.id === root.selectedPackId)) setDatapackSelection(root, null);
      render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-select]').forEach(button => {
    button.addEventListener('click', () => {
      setDatapackSelection(root, button.dataset.packSelect ?? null);
      render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-draft-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.packDraftToggle;
      if (!id) return;
      const entry = host.getPackCatalog?.().entries.find(item => item.id === id);
      if (entry && entry.capabilities && !entry.capabilities.enableable) {
        setDatapackResult(root, { ok: false, message: '核心数据包必须始终保留在启用集内。' });
        render();
        return;
      }
      toggleDatapackDraftEnabled(root, id);
      render();
    });
  });
  const move = (id: string, delta: number) => {
    const result = moveDatapackDraft(root, host.getPackCatalog?.().entries ?? [], id, delta);
    if (result === 'blocked') {
      setDatapackResult(root, { ok: false, message: '核心数据包固定在最前，不可被越过。' });
      render();
      return;
    }
    if (result !== 'moved') return;
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
            setDatapackResult(root, { ok: true, message: `已从包库移除：${entry.name}` });
          } catch (error) {
            setDatapackResult(root, { ok: false, message: error instanceof Error ? error.message : String(error) });
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
        setDatapackResult(root, { ok: true, message: '已放弃草案，恢复正式配置。' });
        ctrl.modal.close();
        render();
      },
    });
  });
  scope.querySelector('[data-pack-validate]')?.addEventListener('click', () => {
    if (!host.validatePackConfiguration) return;
    const report = host.validatePackConfiguration({ enabledIds: root.draftEnabledIds, order: root.draftOrder });
    setDatapackValidation(root, report);
    setDatapackResult(root, { ok: report.ok, message: report.ok ? '启用集校验通过，可以应用。' : report.errors[0] ?? '启用集校验失败。' });
    render();
  });
  scope.querySelector('[data-pack-apply]')?.addEventListener('click', () => {
    if (!host.applyPackConfiguration) return;
    const draft = { enabledIds: [...root.draftEnabledIds], order: [...root.draftOrder] };
    const report = host.validatePackConfiguration?.(draft);
    if (report && !report.ok) {
      setDatapackValidation(root, { ok: false, errors: report.errors, warnings: report.warnings });
      setDatapackResult(root, { ok: false, message: report.errors[0] ?? '启用集校验失败。' });
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
          setDatapackResult(root, { ok: false, message: '应用已停止：当前进度保存失败，数据包序列未重载。' });
          ctrl.modal.close();
          render();
          return;
        }
        const result = host.applyPackConfiguration!(draft);
        if (result.ok) {
          resetDraft();
          setDatapackResult(root, { ok: true, message: result.message });
          setDatapackValidation(root, result.validation);
        } else {
          setDatapackValidation(root, result.validation);
          setDatapackResult(root, { ok: false, message: result.message });
        }
        ctrl.modal.close();
        render();
      },
    });
  });
}
