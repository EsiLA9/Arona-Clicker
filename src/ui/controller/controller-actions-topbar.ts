// ============================================================
// ui/controller-actions-topbar.ts — UI 控制器：顶栏 / 全局工具条事件绑定
// 从 controller.ts 的 bindActions 拆出：tick / 图鉴 / 导入 / 主题浮窗 /
//   帮助 / 彻底重置 / 日志 / Tab 切换（存读档见 controller-save）
// ============================================================

import { SaveSystem } from '../../data-services/persistence/storage';
import { openCollectionModal } from '../components/inventory/collection-modal';
import { buildDatapackWorkspaceView } from '../../arona-clicker/services/runtime/datapack-workspace-view';
import {
  hasDatapackWorkspaceChanges,
  moveDatapackDraft,
  moveDatapackDraftToColumn,
  moveDatapackPaneDraft,
  swapDatapackDraftIntoEnabledSequence,
  setDatapackResult,
  setDatapackSection,
  setDatapackSelection,
  setDatapackValidation,
  setDatapackWorkspaceMode,
  toggleDatapackDraftEnabled,
} from '../workspace/datapack-workspace-state';
import { bindRuntimeDatapackEditorActions, openRuntimeEditingPack, syncRuntimeEditorCreateActions } from '../runtime-editor/actions';
import { runtimeEditorHasUnsavedChanges } from '../runtime-editor/state';
import type { UIController } from './controller';
import { refreshPresentationHostElements } from './controller-theme';
import type { PackCatalogCommands, PackCatalogEntry, PackCatalogReadModel } from '../../arona-clicker/contracts/index';

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
      const workspace = ctrl.panelState.workspace;
      if (panel === 'left' && tabId === 'area' && (workspace?.type === 'contacts' || workspace?.type === 'story')) {
        const onInitChat = ctrl.panelState.centerTab === 'chat' && !ctrl.panelState.conversationVariantId;
        ctrl.navigateToService('game');
        ctrl.panelState.leftTab = 'area';
        ctrl.panelState.centerTab = 'chat';
        ctrl.panelState.rightTab = workspace.returnContext.rightTab;
        ctrl.panelState.selectedVariantId = workspace.returnContext.selectedVariantId;
        ctrl.panelState.conversationVariantId = workspace.returnContext.conversationVariantId;
        if (ctrl.panelState.conversationVariantId) {
          ctrl.panelState.conversationVariantId = null;
          ctrl.panelState.selectedVariantId = null;
        }
        ctrl.panelState.storyGate = null;
        if (!onInitChat) ctrl.scroll.forceToBottom();
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
  syncRuntimeEditorCreateActions(ctrl);
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
  scope.querySelectorAll<HTMLButtonElement>('[data-datapack-mode]').forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.dataset.datapackMode;
      if (mode !== 'classic' && mode !== 'development') return;
      setDatapackWorkspaceMode(root, mode);
      const entries = host.getPackCatalog?.().entries ?? [];
      const visibleEntries = entries.filter(entry => mode === 'development' ? Boolean(entry.sourcePath) : !entry.sourcePath);
      if (!visibleEntries.some(entry => entry.id === root.selectedPackId)) {
        setDatapackSelection(root, visibleEntries.find(entry => !entry.capabilities?.required)?.id ?? visibleEntries[0]?.id ?? null);
      }
      render();
    });
  });
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
  let draggedPackId: string | null = null;
  const dragger = scope.querySelector<HTMLElement>('[data-pack-dragger]');
  const clearDragIndicators = (): void => {
    dragger?.querySelectorAll('.is-drop-target, .is-swap-conflict-target').forEach(target => {
      target.classList.remove('is-drop-target', 'is-swap-conflict-target');
    });
  };
  const findEnabledConflict = (packId: string): PackCatalogEntry | undefined => {
    const entries = host.getPackCatalog?.().entries ?? [];
    const moving = entries.find(entry => entry.id === packId);
    if (!moving || root.draftEnabledIds.includes(packId)) return undefined;
    return entries.find(entry => entry.id !== packId
      && entry.modName === moving.modName && root.draftEnabledIds.includes(entry.id));
  };
  const refreshPackWorkspace = (panels: Array<'left' | 'right'> = ['left', 'right']): void => {
    ctrl.refreshPanels(panels);
  };
  const validatePackDraftAfterDrop = (): void => {
    const report = host.validatePackConfiguration?.({
      enabledIds: [...root.draftEnabledIds],
      order: [...root.draftOrder],
    });
    if (!report) return;
    setDatapackValidation(root, report);
    setDatapackResult(root, null);
  };
  dragger?.querySelectorAll<HTMLElement>('[data-pack-id][draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', event => {
      draggedPackId = card.dataset.packId ?? null;
      if (!draggedPackId) return;
      event.dataTransfer?.setData('text/plain', draggedPackId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      card.classList.add('pack-entry--dragging');
    });
    card.addEventListener('dragend', () => {
      draggedPackId = null;
      card.classList.remove('pack-entry--dragging');
      clearDragIndicators();
    });
  });
  dragger?.addEventListener('dragover', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-pack-dropzone]') : null;
    if (!target) return;
    event.preventDefault();
    clearDragIndicators();
    target.classList.add('is-drop-target');
    if (target.dataset.packDropzone === 'enabled' && draggedPackId) {
      const conflict = findEnabledConflict(draggedPackId);
      if (conflict) [...dragger.querySelectorAll<HTMLElement>('[data-pack-id]')]
        .find(card => card.dataset.packId === conflict.id)?.classList.add('is-swap-conflict-target');
    }
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  dragger?.addEventListener('dragleave', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-pack-dropzone]') : null;
    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (target && (!related || !target.contains(related))) clearDragIndicators();
  });
  dragger?.addEventListener('drop', event => {
    const target = event.target instanceof Element ? event.target : null;
    const column = target?.closest<HTMLElement>('[data-pack-dropzone]');
    const list = column?.querySelector<HTMLElement>('[data-pack-list]');
    const packId = event.dataTransfer?.getData('text/plain') || draggedPackId;
    if (!column || !list || !packId) return;
    event.preventDefault();
    clearDragIndicators();
    const targetCard = target?.closest<HTMLElement>('[data-pack-id]');
    if (targetCard?.dataset.packId === packId) return;
    const cards = [...list.querySelectorAll<HTMLElement>(':scope > [data-pack-id]')].filter(card => card.dataset.packId !== packId);
    const targetIndex = targetCard ? Math.max(0, cards.findIndex(card => card === targetCard)) : cards.length;
    const entries = host.getPackCatalog?.().entries ?? [];
    const moving = entries.find(entry => entry.id === packId);
    const conflict = column.dataset.packDropzone === 'enabled' ? findEnabledConflict(packId) : undefined;
    if (moving && conflict) {
      const baseSwap = moving.modName === 'base' && conflict.modName === 'base';
      const protectedConflict = !baseSwap && (conflict.sourceKind === 'builtin'
        || conflict.capabilities?.required === true
        || conflict.capabilities?.reorderable === false);
      if (protectedConflict) {
        ctrl.modal.open({
          title: '此数据包不能交换',
          body: `<p><strong>${escapeHtml(conflict.name)}</strong>（${escapeHtml(conflict.modName)}）当前不能被替换。</p><p>请保持这条记录未启用。</p>`,
          footer: '<button class="modal-close">知道了</button>',
          onClose: clearDragIndicators,
        });
        return;
      }
      ctrl.modal.open({
        title: '交换同名数据包',
        body: `<p>启用序列中已有 <strong>${escapeHtml(conflict.name)}</strong>（${escapeHtml(conflict.modName)} v${escapeHtml(conflict.version)}）。</p><p>交换后，<strong>${escapeHtml(moving.name)}</strong> 会占用它当前的启用位置；原记录会返回未启用列表。</p>`,
        footer: '<button class="modal-close">取消</button><button class="primary-button" data-modal-action="swap-datapack-entry">交换并启用</button>',
        onAction: action => {
          if (action !== 'swap-datapack-entry') return;
          const result = swapDatapackDraftIntoEnabledSequence(root, entries, packId, conflict.id);
          if (result === 'swapped') validatePackDraftAfterDrop();
          else setDatapackResult(root, { ok: false, message: '交换未完成，启用序列已变化或记录不可交换。' });
          ctrl.modal.close();
          refreshPackWorkspace();
          if (result === 'swapped') {
            [...ctrl.root.querySelectorAll<HTMLButtonElement>('[data-pack-select]')]
              .find(button => button.dataset.packSelect === packId)?.focus();
          }
        },
        onClose: clearDragIndicators,
      });
      return;
    }
    const moved = moveDatapackDraftToColumn(root, entries, packId, column.dataset.packDropzone === 'enabled', targetIndex);
    if (moved === 'blocked') {
      const entry = entries.find(item => item.id === packId);
      const duplicate = entries.find(item => item.id !== packId && item.modName === entry?.modName && root.draftEnabledIds.includes(item.id));
      setDatapackResult(root, { ok: false, message: duplicate ? `启用集已有同 ModName 记录：${duplicate.name}。` : '该数据包不能更改状态。' });
      refreshPackWorkspace(['left']);
      return;
    }
    if (moved === 'moved') {
      validatePackDraftAfterDrop();
      refreshPackWorkspace();
    }
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-selection-pane]').forEach(button => {
    button.addEventListener('click', () => {
      const paneKey = button.dataset.packSelectionPane;
      const selectedSlot = button.dataset.packSelectionSlot as 'fixed' | 'editing' | undefined;
      if (!paneKey || !selectedSlot || !host.setPackSelection) return;
      const selectedRecordId = button.dataset.packSelectionRecord;
      const reenterEditing = selectedSlot === 'editing'
        && button.getAttribute('aria-pressed') === 'true'
        && Boolean(selectedRecordId);
      if (reenterEditing && selectedRecordId) {
        if (hasDatapackWorkspaceChanges(root, host.getPackConfiguration?.())) {
          setDatapackResult(root, { ok: false, message: '请先应用启用集草案，再进入编辑模式。' });
          render();
          return;
        }
        setDatapackSelection(root, selectedRecordId);
        if (!openRuntimeEditingPack(ctrl, selectedRecordId)) render();
        return;
      }
      try {
        host.setPackSelection(paneKey, selectedSlot);
        if (selectedRecordId) setDatapackSelection(root, selectedRecordId);
        setDatapackResult(root, {
          ok: true,
          message: selectedSlot === 'editing'
            ? '已选择编辑态；再次点击进入该 Mod 的编辑模式。'
            : '已选择普通态；返回数据包管理页后再统一 Apply。',
        });
      } catch (error) {
        setDatapackResult(root, { ok: false, message: error instanceof Error ? error.message : String(error) });
      }
      render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-create-editing]').forEach(button => {
    button.addEventListener('click', () => {
      const sourceId = button.dataset.packCreateEditing;
      if (!sourceId || !host.createEditingPack) return;
      const source = host.getPackCatalog?.().entries.find(entry => entry.id === sourceId);
      if (!source) return;
      const openVersionForm = (versionId = '', error = '') => ctrl.modal.open({
        title: '复制为新编辑态',
        width: 440,
        body: `<div class="pack-create-empty-form"><p>编辑态会成为独立记录。请为副本填写一个与来源不同的 Version。</p><label>新 Version<input data-pack-editing-version type="text" value="${escapeHtml(versionId)}" placeholder="例如 ${escapeHtml(source.version)}-dev" autocomplete="off" spellcheck="false"></label>${error ? `<p class="pack-form-error" role="alert">${escapeHtml(error)}</p>` : ''}</div>`,
        footer: '<button class="modal-close">取消</button><button class="primary-button" data-modal-action="create-versioned-editing-pack">创建副本</button>',
        onAction: action => {
          if (action !== 'create-versioned-editing-pack') return;
          const nextVersion = document.querySelector<HTMLInputElement>('[data-pack-editing-version]')?.value.trim() ?? '';
          if (!nextVersion || /\s/.test(nextVersion)) {
            openVersionForm(nextVersion, '新 Version 不能为空且不能包含空白字符。');
            return;
          }
          if (nextVersion === source.version) {
            openVersionForm(nextVersion, '新 Version 必须与来源不同。');
            return;
          }
          const result = host.createEditingPack!(sourceId, nextVersion);
          setDatapackResult(root, { ok: result.ok, message: result.message });
          if (result.ok && result.packRecordId) setDatapackSelection(root, result.packRecordId);
          ctrl.modal.close();
          render();
        },
      });
      openVersionForm();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-enabled-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.packEnabledToggle;
      if (!id) return;
      const entries = host.getPackCatalog?.().entries ?? [];
      const enabled = root.draftEnabledIds.includes(id);
      const targetIndex = enabled
        ? root.draftOrder.filter(packId => root.draftEnabledIds.includes(packId)).length
        : root.draftOrder.filter(packId => !root.draftEnabledIds.includes(packId)).length;
      const moved = moveDatapackDraftToColumn(root, entries, id, !enabled, targetIndex);
      if (moved === 'blocked') {
        const pack = entries.find(entry => entry.id === id);
        const conflict = entries.find(entry => entry.id !== id && entry.modName === pack?.modName && root.draftEnabledIds.includes(entry.id));
        setDatapackResult(root, { ok: false, message: conflict ? `启用集已有同 ModName 记录：${conflict.name}。` : '该数据包不能更改状态。' });
      }
      render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-convert-normal]').forEach(button => {
    button.addEventListener('click', () => {
      const sourceId = button.dataset.packConvertNormal;
      if (!sourceId || !host.convertEditingPackToNormal) return;
      const result = host.convertEditingPackToNormal(sourceId);
      setDatapackResult(root, { ok: result.ok, message: result.message });
      if (result.ok && result.packRecordId) setDatapackSelection(root, result.packRecordId);
      render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-open-editing]').forEach(button => {
    button.addEventListener('click', () => {
      const packRecordId = button.dataset.packOpenEditing;
      if (!packRecordId) return;
      if (hasDatapackWorkspaceChanges(root, host.getPackConfiguration?.())) {
        setDatapackResult(root, { ok: false, message: '请先应用启用集草案，再进入编辑模式。' });
        render();
        return;
      }
      if (!openRuntimeEditingPack(ctrl, packRecordId)) render();
    });
  });
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-draft-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.packDraftToggle;
      if (!id) return;
      const entry = host.getPackCatalog?.().entries.find(item => item.id === id);
      if (entry && entry.capabilities && !entry.capabilities.enableable) {
        setDatapackResult(root, { ok: false, message: '当前 base 必须由同名交换替换，不能直接停用。' });
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
  const movePane = (paneKey: string, delta: number) => {
    const result = moveDatapackPaneDraft(root, host.getPackCatalog?.().entries ?? [], paneKey, delta);
    if (result === 'blocked') {
      setDatapackResult(root, { ok: false, message: '核心数据包固定在最前，不可被越过。' });
      render();
      return;
    }
    if (result === 'moved') render();
  };
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-draft-pane-up]').forEach(button => button.addEventListener('click', () => movePane(button.dataset.packDraftPaneUp!, -1)));
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-draft-pane-down]').forEach(button => button.addEventListener('click', () => movePane(button.dataset.packDraftPaneDown!, 1)));
  scope.querySelectorAll<HTMLButtonElement>('[data-pack-remove]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.packRemove;
      if (!id) return;
      const entry = host.getPackCatalog?.().entries.find(item => item.id === id);
      if (!entry) return;
      ctrl.modal.open({
        title: '从包库移除数据包',
        body: `<p>确认将 <strong>${escapeHtml(entry.name)}</strong>（${escapeHtml(entry.modName)} v${escapeHtml(entry.version)}）从包库移除？</p><p class="muted">${entry.sourcePath ? '该操作不会删除开发目录中的文件；下次启动会重新发现此来源。' : '该操作只影响包库；未启用数据包不会影响当前运行内容。'}</p>`,
        footer: '<button class="modal-close">取消</button><button class="toolbar-button" data-modal-action="remove-datapack">确认移除</button>',
        onAction: action => {
          if (action !== 'remove-datapack') return;
          try {
            const editorDirty = ctrl.panelState.runtimeDatapackEditor?.packRecordId === id
              && runtimeEditorHasUnsavedChanges(ctrl.panelState.runtimeDatapackEditor);
            host.removePack?.(id, { editorDirty });
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
  scope.querySelector('[data-pack-selection-apply]')?.addEventListener('click', () => {
    if (!host.applyPackSelection) return;
    ctrl.modal.open({
      title: '确认应用数据包选择',
      body: '<p>将按每个 Pane 当前选择一次性重载 Runtime。未保存的编辑器内容不会被自动保存。</p><p class="muted">选择本身已经保存；取消不会改变当前 Runtime。</p>',
      footer: '<button class="modal-close">取消</button><button class="primary-button" data-modal-action="apply-pack-selection">确认 Apply</button>',
      onAction: action => {
        if (action !== 'apply-pack-selection') return;
        const saved = SaveSystem.save(ctrl.withHistories(ctrl.commands.save()));
        if (!saved) {
          setDatapackResult(root, { ok: false, message: 'Apply 已停止：当前进度保存失败，Runtime 未重载。' });
          ctrl.modal.close();
          render();
          return;
        }
        const result = host.applyPackSelection!();
        setDatapackResult(root, { ok: result.ok, message: result.message });
        if (result.ok) resetDraft();
        ctrl.modal.close();
        render();
      },
    });
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
