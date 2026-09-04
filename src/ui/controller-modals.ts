// ============================================================
// ui/controller-modals.ts — UI 控制器：弹层弹窗管理
// 从 controller.ts 拆出：openGachaModal / openSpotGachaModal /
//   bindGachaButtons / openEnhancementManager
// ============================================================

import { createUIContext } from './context';
import { renderGachaBody, renderSpotGachaBody } from './components/contacts';
import { renderEnhancementManager } from './components/enhancements';
import { renderUserThemeEditor } from './components/user-theme-editor';
import type { UIController } from './controller';
import { openPackManagerModal } from './components/pack-manager-modal';
import type { PackCatalogCommands, PackCatalogReadModel } from '../arona-clicker/contracts';
import type { ComponentPlacementDef, PresentationRegion } from '../engine/types/theme';

/** 招募补给弹窗：卡池列表 + 抽取按钮（结果经 chat/toast 反馈）。 */
export function openGachaModal(ctrl: UIController): void {
  ctrl.modal.open({
    title: '招募补给 · Gacha',
    body: renderGachaBody(createUIContext(ctrl.game)),
    width: 560,
  });
  // 弹窗挂在 body 级 .app-modal，不在 #app 内——bindActions 覆盖不到，
  // 需在每次 open 后对弹窗 DOM 单独绑定抽取按钮
  bindGachaButtons(ctrl, document.querySelectorAll('.app-modal [data-gacha]'));
}

/** Spot 招募弹窗：专有卡池 / 通用卡池 经 Switch 切换。 */
export function openSpotGachaModal(ctrl: UIController, spotId: string): void {
  const spot = ctrl.game.world.spots.get(spotId);
  if (!spot) return;
  ctrl.modal.open({
    title: `招募 · ${spot.name}`,
    body: renderSpotGachaBody(createUIContext(ctrl.game), spotId),
    width: 560,
  });
  // 弹窗位于 body 级 .app-modal，单独绑定 Switch 与抽取按钮
  const modalEl = document.querySelector('.app-modal');
  modalEl?.querySelectorAll<HTMLButtonElement>('[data-gacha-scope-switch] .switch-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const scope = tab.dataset.scope!;
      modalEl.querySelectorAll('[data-gacha-scope-switch] .switch-tab').forEach(t => t.classList.toggle('active', t === tab));
      modalEl.querySelectorAll<HTMLElement>('[data-scope-panel]').forEach(panel => {
        panel.hidden = panel.dataset.scopePanel !== scope;
      });
    });
  });
  bindGachaButtons(ctrl, modalEl?.querySelectorAll<HTMLButtonElement>('[data-gacha]') ?? document.querySelectorAll('.app-modal [data-gacha]'));
}

/** 绑定抽取按钮（root 内与弹窗内共用）。 */
export function bindGachaButtons(ctrl: UIController, buttons: NodeListOf<HTMLButtonElement>): void {
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const poolId = button.dataset.gacha!;
      const count = Number(button.dataset.gachaCount) || 1;
      try {
        const summary = ctrl.commands.roll(poolId, count);
        for (const r of summary.results) {
          const v = ctrl.game.rosterSystem.getVariant(r.variantId);
          ctrl.pushChat({
            kind: 'reward',
            text: r.duplicate
              ? `招募重复 · ${v?.displayName ?? r.variantId} → 碎片 +${r.shards}`
              : `招募成功 · ${v?.displayName ?? r.variantId} 加入通讯录！`,
          });
        }
        if (summary.results.length === 0) {
          const pool = ctrl.game.gachaService.getPool(poolId);
          ctrl.toast.show(
            summary.stopped === 'insufficient-currency'
              ? `${pool?.currency === 'base:resource:pyroxene' ? '青辉石' : '资源'}不足`
              : '抽取失败',
            'error',
          );
        }
      } catch (e) {
        ctrl.toast.show(e instanceof Error ? e.message : '抽取失败', 'error');
      }
      ctrl.modal.close();
      ctrl.render();
    });
  });
}

/** 打开"当前游戏 · 强化管理"弹窗：查看 + 移除已购买的 Enhancement。 */
export function openEnhancementManager(ctrl: UIController): void {
  const render = () => {
    ctrl.modal.open({
      title: '当前游戏 · 强化管理',
      body: renderEnhancementManager(createUIContext(ctrl.game)),
      footer: `<button class="primary-button modal-close">关闭</button>`,
      onClose: () => ctrl.render(),
    });
    // 弹窗位于 body（不在 #app 内），此处动态绑定移除按钮
    document.querySelectorAll<HTMLButtonElement>('[data-remove-enh]').forEach(btn => {
      btn.addEventListener('click', () => {
        const enhId = btn.dataset.removeEnh!;
        const removed = ctrl.commands.removeEnhancement(enhId);
        if (removed) {
          const enh = ctrl.game.registry.enhancements.get(enhId);
          ctrl.toast.show(`已移除强化 <b>${enh?.name ?? enhId}</b>`, 'info');
        }
        render(); // 刷新弹窗内容
      });
    });
  };
  render();
}

export function openUserThemeEditor(ctrl: UIController): void {
  const runtimeTheme = ctrl.game.colorSystem.runtimeTheme();
  const initialPalette = runtimeTheme.palette.length > 0
    ? runtimeTheme.palette
    : [runtimeTheme.tokens.primary ?? '#6b8cff'];
  const session = ctrl.game.userThemeService.beginEdit(initialPalette);
  if ('ok' in session && !session.ok) {
    ctrl.modal.open({ title: '用户自定主题', body: `<p class="modal-empty">${ctrl.game.userThemeService.capability().active ? '编辑服务暂不可用' : '需要 Active Affector 开放主题编辑能力。'}</p>` });
    return;
  }
  const capability = ctrl.game.userThemeService.capability();
  const current = session as import('../arona-clicker/services/user-theme-service').UserThemeEditSession;
  if (capability.active) {
    ctrl.game.colorSystem.setUserThemePreview(current.draft);
    ctrl.render();
  }
  ctrl.modal.open({ title: '用户自定主题', body: renderUserThemeEditor(createUIContext(ctrl.game), current, capability.active, capability.sources), width: 420, panelClass: 'user-theme-modal', footer: `<button class="modal-close">取消</button><button class="primary-button" data-user-theme-save ${capability.active ? '' : 'disabled'}>保存并应用</button>`, onClose: () => {
    ctrl.game.colorSystem.setUserThemePreview(null);
    ctrl.game.userThemeService.discard(current.id);
    ctrl.render();
  } });
  const modal = document.querySelector('.app-modal');
  if (!modal) return;
  bindUserThemeDrag(modal);
  bindUserThemeEditor(ctrl, modal, current, capability.active);
  const save = modal?.querySelector<HTMLButtonElement>('[data-user-theme-save]');
  save?.addEventListener('click', () => {
    const result = ctrl.game.userThemeService.apply(current.id, { ...current.draft, version: 1, tokens: current.draft.tokens });
    if (!result.ok) { showUserThemeError(modal, result.issues?.join('；') ?? result.message); return; }
    const enabled = modal.querySelector<HTMLInputElement>('[data-user-theme-enabled]')?.checked ?? true;
    if (enabled !== result.state.enabled) ctrl.game.userThemeService.setEnabled(enabled);
    ctrl.modal.close(); ctrl.render(); ctrl.toast.show('用户主题已保存并应用', 'success');
  });
}

function bindUserThemeEditor(ctrl: UIController, modal: Element, session: import('../arona-clicker/services/user-theme-service').UserThemeEditSession, active: boolean): void {
  const draft = session.draft;
  const presentation = draft.presentation ?? (draft.presentation = { layers: [], components: [] });
  const components = () => presentation.components ?? (presentation.components = []);
  modal.querySelectorAll<HTMLButtonElement>('[data-theme-editor-section]').forEach(button => button.addEventListener('click', () => {
    const section = button.dataset.themeEditorSection;
    modal.querySelectorAll<HTMLElement>('[data-theme-editor-panel]').forEach(panel => { panel.hidden = panel.dataset.themeEditorPanel !== section; });
    modal.querySelectorAll('[data-theme-editor-section]').forEach(item => item.classList.toggle('is-active', item === button));
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-token]').forEach(input => input.addEventListener('input', () => {
    if (!active) return;
    draft.tokens = { ...(draft.tokens ?? {}), [input.dataset.userThemeToken!]: input.value };
    if (input.dataset.userThemeToken) {
      ctrl.game.colorSystem.setUserThemePreview(draft);
      ctrl.refreshTheme();
    }
    const code = input.parentElement?.querySelector('code'); if (code) code.textContent = input.value;
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-palette]').forEach(input => input.addEventListener('input', () => {
    if (!active) return;
    const index = Number(input.dataset.userThemePalette);
    const palette = [...(draft.palette ?? [])];
    palette[index] = input.value;
    draft.palette = palette;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    const code = input.parentElement?.querySelector('code'); if (code) code.textContent = input.value;
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-palette-clear]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const index = Number(button.dataset.userThemePaletteClear);
    const palette = [...(draft.palette ?? [])];
    palette.splice(index, 1);
    while (palette.length > 0 && !palette[palette.length - 1]) palette.pop();
    const enabled = [...(draft.paletteUiEnabled ?? [])];
    enabled.splice(index, 1);
    while (enabled.length > 0 && enabled[enabled.length - 1] === undefined) enabled.pop();
    draft.palette = palette.length > 0 ? palette : undefined;
    draft.paletteUiEnabled = palette.length > 0 ? enabled : undefined;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    const input = button.parentElement?.querySelector<HTMLInputElement>('input'); if (input) { input.value = '#6b8cff'; input.disabled = true; }
    button.disabled = true;
    const enable = button.parentElement?.querySelector<HTMLButtonElement>('[data-user-theme-palette-enable]'); if (enable) enable.textContent = '添加颜色';
    const code = button.parentElement?.querySelector('code'); if (code) code.textContent = '未设置';
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-token-clear]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const token = button.dataset.userThemeTokenClear as import('../arona-clicker/types/user-theme').UserThemeToken;
    if (draft.tokens) {
      delete draft.tokens[token];
      if (Object.keys(draft.tokens).length === 0) delete draft.tokens;
    }
    const input = modal.querySelector<HTMLInputElement>(`[data-user-theme-token="${token}"]`);
    if (input) input.value = '#6b8cff';
    const code = button.parentElement?.querySelector('code');
    if (code) code.textContent = '跟随上一层';
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-palette-enable]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const index = Number(button.dataset.userThemePaletteEnable);
    const palette = [...(draft.palette ?? [])];
    if (index > palette.length) return;
    if (index === palette.length) palette.push('#6b8cff');
    const enabled = [...(draft.paletteUiEnabled ?? [])];
    enabled[index] = enabled[index] === false;
    draft.palette = palette;
    draft.paletteUiEnabled = enabled;
    const container = button.parentElement;
    const input = container?.querySelector<HTMLInputElement>('[data-user-theme-palette]');
    const clear = container?.querySelector<HTMLButtonElement>('[data-user-theme-palette-clear]');
    const code = container?.querySelector('code');
    const hasColor = Boolean(palette[index]);
    if (input) { input.disabled = !hasColor; input.value = palette[index] ?? '#6b8cff'; }
    if (clear) clear.disabled = !hasColor;
    if (code) code.textContent = palette[index] ?? '无色';
    button.textContent = hasColor ? (enabled[index] === false ? '仅头像' : '参与 UI') : '添加颜色';
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme();
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-node]').forEach(input => input.addEventListener('input', () => {
    if (!active) return;
    const node = input.dataset.userThemeNode as import('../engine/types/theme').ThemeNodeName;
    draft.nodes = { ...(draft.nodes ?? {}), [node]: input.value };
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    const code = input.parentElement?.querySelector('code'); if (code) code.textContent = input.value;
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-node-clear]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const node = button.dataset.userThemeNodeClear as import('../engine/types/theme').ThemeNodeName;
    if (draft.nodes) {
      delete draft.nodes[node];
      if (Object.keys(draft.nodes).length === 0) delete draft.nodes;
    }
    const input = modal.querySelector<HTMLInputElement>(`[data-user-theme-node="${node}"]`);
    if (input) input.value = '#6b8cff';
    const code = button.parentElement?.querySelector('code'); if (code) code.textContent = '自动分配';
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-scope-node]').forEach(input => input.addEventListener('input', () => {
    if (!active) return;
    const scope = input.dataset.userThemeScopeNode!;
    const node = input.dataset.userThemeScopeNodeName as import('../engine/types/theme').ThemeNodeName;
    draft.scopes = { ...(draft.scopes ?? {}), [scope]: { ...(draft.scopes?.[scope] ?? {}), [node]: input.value } };
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme();
    const code = input.parentElement?.querySelector('code'); if (code) code.textContent = input.value;
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-scope-clear]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const scope = button.dataset.userThemeScopeClear!;
    const node = button.dataset.userThemeScopeNodeName as import('../engine/types/theme').ThemeNodeName;
    if (draft.scopes?.[scope]) { delete draft.scopes[scope][node]; if (Object.keys(draft.scopes[scope]).length === 0) delete draft.scopes[scope]; }
    if (draft.scopes && Object.keys(draft.scopes).length === 0) delete draft.scopes;
    const input = button.parentElement?.querySelector('input'); if (input) input.value = '#6b8cff';
    const code = button.parentElement?.querySelector('code'); if (code) code.textContent = '继承';
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme();
  }));
  modal.querySelectorAll<HTMLSelectElement>('[data-user-theme-layer-region]').forEach(select => select.addEventListener('change', () => {
    if (!active || !presentation.layers) return;
    const layer = presentation.layers[Number(select.dataset.userThemeLayerRegion)]; if (layer) { layer.region = select.value as PresentationRegion; ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.render(); }
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-layer-opacity]').forEach(input => input.addEventListener('input', () => {
    if (!active || !presentation.layers) return;
    const layer = presentation.layers[Number(input.dataset.userThemeLayerOpacity)]; if (layer) { layer.opacity = Math.max(0, Math.min(1, Number(input.value) || 0)); ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.render(); }
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-panel-opacity]').forEach(input => input.addEventListener('input', () => {
    if (!active) return;
    const region = input.dataset.userThemePanelOpacity as PresentationRegion;
    const panels = presentation.panels ?? (presentation.panels = []);
    const panel = panels.find(item => item.region === region) ?? { region };
    if (!panels.includes(panel)) panels.push(panel);
    panel.opacity = Math.max(0, Math.min(1, Number(input.value) || 0));
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
  }));
  modal.querySelectorAll<HTMLSelectElement>('[data-user-theme-component-parent]').forEach(select => select.addEventListener('change', () => {
    if (!active) return;
    const component = components().find(item => item.id === select.dataset.userThemeComponentParent); if (component) { component.parent = select.value; ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.render(); }
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-component-anchor]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const component = components().find(item => item.id === button.dataset.userThemeComponentAnchor); if (!component) return;
    component.anchor = button.dataset.anchor as ComponentPlacementDef['anchor'];
    button.parentElement?.querySelectorAll('[data-user-theme-component-anchor]').forEach(item => item.classList.toggle('active', item === button));
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.render();
  }));
  for (const axis of ['x', 'y'] as const) modal.querySelectorAll<HTMLInputElement>(`[data-user-theme-component-${axis}]`).forEach(input => input.addEventListener('input', () => {
    if (!active) return;
    const component = components().find(item => item.id === input.dataset[`userThemeComponent${axis.toUpperCase()}`]); if (!component) return;
    component.offset = { x: component.offset?.x ?? 0, y: component.offset?.y ?? 0, unit: component.offset?.unit ?? 'percent', [axis]: Number(input.value) || 0 };
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.render();
  }));
}

function bindUserThemeDrag(modal: Element): void {
  const panel = modal.querySelector<HTMLElement>('.user-theme-modal');
  const handle = modal.querySelector<HTMLElement>('[data-user-theme-drag]');
  if (!panel || !handle) return;
  let drag: { offsetX: number; offsetY: number } | null = null;
  handle.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = panel.getBoundingClientRect();
    drag = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    handle.setPointerCapture?.(event.pointerId);
    panel.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', event => {
    if (!drag) return;
    const maxX = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
    const left = Math.min(maxX, Math.max(8, event.clientX - drag.offsetX));
    const top = Math.min(maxY, Math.max(8, event.clientY - drag.offsetY));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });
  const end = () => { drag = null; panel.classList.remove('is-dragging'); };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function showUserThemeError(modal: Element, message: string): void {
  const error = modal.querySelector<HTMLElement>('[data-user-theme-error]');
  if (error) { error.textContent = message; error.hidden = false; }
}

export function openPackManager(ctrl: UIController): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel & PackCatalogCommands>;
  if (!host.getPackCatalog || !host.setPackEnabled || !host.reorderPacks || !host.applyEnabledPacks) {
    ctrl.toast.show('当前运行时不支持数据包库管理', 'error');
    return;
  }
  openPackManagerModal(ctrl.modal, host as PackCatalogReadModel & PackCatalogCommands, () => ctrl.render());
}
