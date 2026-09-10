// ============================================================
// ui/controller-actions-topbar.ts — UI 控制器：顶栏 / 全局工具条事件绑定
// 从 controller.ts 的 bindActions 拆出：tick / 图鉴 / 导入 / 主题浮窗 /
//   帮助 / 彻底重置 / 日志 / Tab 切换（存读档见 controller-save）
// ============================================================

import { SaveSystem } from '../data-services/persistence/storage';
import { openCollectionModal } from './components/collection-modal';
import { filterPacks, orderPacks } from './components/service-workspace';
import type { UIController } from './controller';
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

/** 绑定顶栏 / 全局工具条与 Tab 切换（render 后调用）。 */
export function bindTopBarActions(ctrl: UIController, scope: ParentNode = ctrl.root): void {
  bindDatapackActions(ctrl, scope);
  scope.querySelectorAll<HTMLButtonElement>('[data-service]').forEach(button => {
    button.addEventListener('click', () => {
      const service = button.dataset.service as 'game' | 'datapack' | 'saves' | 'records' | undefined;
      if (!service) return;
      const workspace = ctrl.panelState.datapackWorkspace;
      const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel>;
      const formal = host.getPackConfiguration?.();
      const hasDraft = Boolean(workspace && formal && (
        JSON.stringify(workspace.draftEnabledIds) !== JSON.stringify(formal.enabledIds)
        || JSON.stringify(workspace.draftOrder) !== JSON.stringify(formal.order)
      ));
      const switchService = () => {
        if (ctrl.panelState.workspace?.type === 'shop') ctrl.disposeShopWorkspace();
        ctrl.panelState.service = service;
        ctrl.render();
      };
      if (ctrl.panelState.service === 'datapack' && service !== 'datapack' && hasDraft) {
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
    });
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
    if (ctrl.panelState.workspace?.type === 'shop') ctrl.disposeShopWorkspace();
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
      if (panel === 'left') {
        ctrl.panelState.leftTab = tabId;
        // 左 Tab 联动中栏：点击"区域"→ Init 的一般聊天流，点击"通讯录"→ 临时页
        if (tabId === 'area') {
          // 对话空间优先级高于 centerTab：不退出就会停留在学生聊天流上（与对话空间返回键同款退出）
          const onInitChat = ctrl.panelState.centerTab === 'chat' && !ctrl.panelState.conversationVariantId;
          if (ctrl.panelState.conversationVariantId) {
            ctrl.panelState.conversationVariantId = null;
            ctrl.panelState.selectedVariantId = null;
          }
          ctrl.panelState.centerTab = 'chat';
          if (!onInitChat) ctrl.scroll.forceToBottom();
        } else if (tabId === 'contacts') ctrl.panelState.centerTab = 'contacts-draft';
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
