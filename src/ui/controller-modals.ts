// ============================================================
// ui/controller-modals.ts — UI 控制器：弹层弹窗管理
// 从 controller.ts 拆出：openGachaModal / openSpotGachaModal /
//   bindGachaButtons / openEnhancementManager
// ============================================================

import { createUIContext } from './context';
import { renderGachaBody, renderSpotGachaBody } from './components/contacts';
import { ShopSession } from '../arona-clicker/services/shop-service';
import type { ShopWorkspaceState } from './components/app-shell';
import { renderEnhancementManager } from './components/enhancements';
import { nodeSource, renderPresentationHostTarget, renderPresentationTargetOptions, renderUserThemeEditor, scopeNodesFor, scopeSource, setPresentationHostState, tokenSource } from './components/user-theme-editor';
import type { UIController } from './controller';
import type { BackgroundLayerDef, ComponentPlacementDef, PresentationHostState, PresentationHostStateDef, PresentationRegion, PresentationTextColorMode } from '../engine/types/theme';
import { getPresentationTargets } from './presentation-targets';
import { refreshPresentationHostElements } from './controller-theme';
import { CORNER_RADIUS_MAX, CORNER_RADIUS_MIN, SKEW_X_DEG_MAX, SKEW_X_DEG_MIN } from './presentation-config';
import {
  addTargetLayer,
  getTargetLayers,
  hasLocalTarget,
  materializeTargetLayers,
  moveTargetLayer,
  removeTargetLayer,
  setTargetLayerEnabled,
  targetRefKey,
  updateTargetLayer,
  type ThemeLayerTargetRef,
} from '../arona-clicker/services/user-theme-layer-service';
import { renderLayerEditorForm, renderLayerManagerList, themeLayerTargetLabel } from './components/user-theme-layer-manager';

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

/** Spot Shop：进入三栏 workspace；Session 与主题由 controller 状态管理。 */
export function openSpotShopModal(ctrl: UIController, spotId: string): void {
  const spot = ctrl.game.world.spots.get(spotId);
  const functionality = spot && ctrl.game.spotFunctionalitySystem.functionalitiesOf(spot, ctrl.game.state)
    .find(fn => fn.kind === 'shop' && fn.shopId);
  if (!spot || !functionality?.shopId) return;
  const shop = ctrl.game.registry.shops.get(functionality.shopId);
  if (ctrl.panelState.workspace?.type === 'shop') ctrl.disposeShopWorkspace();
  const themeId = `shop-workspace:${spotId}:${functionality.shopId}`;
  if (shop?.theme) {
    ctrl.game.colorSystem.pushEphemeralTheme({
      id: themeId,
      owner: `workspace:shop:${spotId}:${functionality.shopId}`,
      scope: 'ephemeral',
      groupId: shop.theme.colorGroupId,
      palette: shop.theme.palette,
      tokens: shop.theme.tokens,
      nodeOverrides: shop.theme.nodes,
      background: shop.theme.background,
      presentation: shop.theme.presentation,
    });
    ctrl.refreshTheme();
  }
  const workspace: ShopWorkspaceState = {
    type: 'shop', spotId, shopId: functionality.shopId!, session: new ShopSession(),
    feed: [{ kind: 'enter', text: `进入 ${shop?.name ?? '商店'}。` }],
    returnContext: { leftTab: ctrl.panelState.leftTab, centerTab: ctrl.panelState.centerTab, rightTab: ctrl.panelState.rightTab, selectedVariantId: ctrl.panelState.selectedVariantId, conversationVariantId: ctrl.panelState.conversationVariantId },
    themeId,
  };
  ctrl.panelState.workspace = workspace;
  ctrl.render();
}

export function openUserThemeEditor(ctrl: UIController): void {
  // 编辑器从主题浮窗打开时，浮窗本身仍应保持 active；全量 render 会重建顶部按钮，
  // 因此先从当前 DOM 捕捉打开状态，避免只依赖可能尚未同步的控制器标记。
  const themeFloatWasOpen = ctrl.themeFloatOpen || Boolean(ctrl.root.querySelector('[data-theme-float].open'));
  if (themeFloatWasOpen) ctrl.themeFloatOpen = true;
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
    if (themeFloatWasOpen) {
      const button = ctrl.root.querySelector<HTMLButtonElement>('#theme-palette-btn');
      button?.classList.add('is-active');
      if (button) {
        button.dataset.themeState = 'active';
        button.setAttribute('aria-expanded', 'true');
      }
      ctrl.root.querySelector<HTMLElement>('[data-theme-float]')?.classList.add('open');
      refreshPresentationHostElements(ctrl, ['header.button']);
    }
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
    ctrl.modal.close(); ctrl.render(); ctrl.toast.show('用户主题已保存并应用', 'success');
  });
}

function reorderHostLayerOrder(host: import('../engine/types/theme').PresentationHostDef, id: string, direction: 'up' | 'down'): void {
  const layers = host.layers ?? [];
  const ids = layers.map((layer, index) => layer.id ?? `${host.id}-layer-${index}`);
  const current = host.layerOrder?.filter(layerId => ids.includes(layerId)) ?? [];
  for (const layerId of ids) if (!current.includes(layerId)) current.push(layerId);
  const index = current.indexOf(id);
  const target = index + (direction === 'up' ? 1 : -1);
  if (index < 0 || target < 0 || target >= current.length) return;
  [current[index], current[target]] = [current[target], current[index]];
  host.layerOrder = current;
}

function bindUserThemeEditor(ctrl: UIController, modal: Element, session: import('../arona-clicker/services/user-theme-service').UserThemeEditSession, active: boolean): void {
  const draft = session.draft;
  const presentation = draft.presentation ?? (draft.presentation = { layers: [], components: [], hosts: [] });
  const components = () => presentation.components ?? (presentation.components = []);
  const editor = modal.querySelector<HTMLElement>('.user-theme-editor');
  const applyFilter = (section: string, filter: string): void => {
    const groups = modal.querySelectorAll<HTMLElement>('[data-theme-editor-filter-group]');
    groups.forEach(group => { group.hidden = group.dataset.themeEditorFilterGroup !== section; });
    modal.querySelectorAll<HTMLElement>('[data-theme-editor-filter]').forEach(item => item.classList.toggle('is-active', item.dataset.themeEditorFilter === filter));
    modal.querySelectorAll<HTMLElement>('[data-theme-editor-content-group]').forEach(item => {
      const group = item.dataset.themeEditorContentGroup;
      const visible = filter === 'all' || group === filter || (filter === 'semantic' && group === 'semantic') || (filter === 'cluster' && (group === 'cluster' || group === 'region'));
      item.hidden = !visible;
    });
    modal.querySelectorAll<HTMLElement>('[data-theme-editor-target-level]').forEach(item => {
      const level = item.dataset.themeEditorTargetLevel;
      const matchesFilter = filter === 'all'
        || level === filter
        || (filter === 'cluster' && level === 'region');
      item.hidden = section !== 'layers' || !matchesFilter;
    });
  };
  const paletteGrid = modal.querySelector<HTMLElement>('.user-theme-palette-grid');
  paletteGrid?.setAttribute('data-theme-editor-content-group', 'palette');
  const semanticGrids = modal.querySelectorAll<HTMLElement>('.user-theme-token-grid:not(.user-theme-panel-opacity-grid)');
  semanticGrids.forEach(grid => grid.setAttribute('data-theme-editor-content-group', 'semantic'));
  modal.querySelectorAll<HTMLElement>('.user-theme-panel-opacity-grid, .user-theme-scope').forEach(item => item.setAttribute('data-theme-editor-content-group', 'scope'));
  modal.querySelectorAll<HTMLElement>('.user-theme-scope').forEach(scopeElement => {
    const scope = scopeElement.querySelector<HTMLInputElement>('[data-user-theme-scope-node]')?.dataset.userThemeScopeNode ?? '';
    const allowed = new Set(scopeNodesFor(scope));
    scopeElement.querySelectorAll<HTMLInputElement>('[data-user-theme-scope-node]').forEach(input => {
      const node = input.dataset.userThemeScopeNodeName;
      if (!node || allowed.has(node as import('../engine/types/theme').ThemeNodeName)) return;
      input.closest('.user-theme-token')?.remove();
    });
    if (!scopeElement.querySelector('[data-user-theme-scope-node]')) scopeElement.remove();
  });
  modal.querySelector<HTMLElement>('.user-theme-global-card')?.setAttribute('data-theme-editor-target-level', 'background');
  modal.querySelectorAll<HTMLElement>('[data-user-theme-host-card]').forEach(card => {
    const target = getPresentationTargets().find(item => item.id === card.dataset.userThemeHostCard);
    card.setAttribute('data-theme-editor-target-level', target?.level ?? 'control');
  });
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-system-color-ignore]').forEach(input => input.addEventListener('change', event => {
    if (!active) return;
    draft.systemColorLayerIgnored = !(event.currentTarget as HTMLInputElement).checked;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-theme-editor-section]').forEach(button => button.addEventListener('click', () => {
    const section = button.dataset.themeEditorSection;
    modal.querySelector<HTMLElement>('.user-theme-editor')?.setAttribute('data-theme-editor-current-section', section ?? 'colors');
    modal.querySelector<HTMLElement>('.user-theme-editor')?.setAttribute('data-theme-editor-current-filter', 'all');
    modal.querySelectorAll<HTMLElement>('[data-theme-editor-panel]').forEach(panel => { panel.hidden = panel.dataset.themeEditorPanel !== section; });
    modal.querySelectorAll<HTMLElement>('[data-theme-editor-section]').forEach(item => { item.classList.toggle('is-active', item.dataset.themeEditorSection === section); item.setAttribute('aria-selected', String(item.dataset.themeEditorSection === section)); });
    applyFilter(section ?? 'colors', 'all');
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-theme-editor-filter]').forEach(button => button.addEventListener('click', () => {
    const section = editor?.dataset.themeEditorCurrentSection ?? 'colors';
    editor?.setAttribute('data-theme-editor-current-filter', button.dataset.themeEditorFilter ?? 'all');
    modal.querySelectorAll<HTMLElement>('[data-theme-editor-filter]').forEach(item => item.classList.toggle('is-active', item === button));
    applyFilter(section, button.dataset.themeEditorFilter ?? 'all');
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-theme-editor-overview-filter]').forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.themeEditorOverviewFilter ?? 'all';
    const section = filter === 'layers' ? 'layers' : filter === 'placement' ? 'components' : 'colors';
    modal.querySelector<HTMLButtonElement>(`[data-theme-editor-section="${section}"]`)?.click();
    if (filter !== 'layers') modal.querySelector<HTMLButtonElement>(`[data-theme-editor-filter="${filter}"]`)?.click();
  }));
  applyFilter(editor?.dataset.themeEditorCurrentSection ?? 'colors', editor?.dataset.themeEditorCurrentFilter ?? 'all');
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
    if (code) code.textContent = tokenSource(token, draft);
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
    const code = button.parentElement?.querySelector('code'); if (code) code.textContent = nodeSource(node, draft);
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
    const code = button.parentElement?.querySelector('code'); if (code) code.textContent = scopeSource(scope, node, draft);
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme();
  }));
  const targetPicker = modal.querySelector<HTMLElement>('[data-user-theme-target-picker]');
  const targetOptions = modal.querySelector<HTMLElement>('[data-user-theme-target-options]');
  const renderTargetOptions = (level: import('./presentation-targets').PresentationTargetLevel) => {
    if (targetOptions) targetOptions.innerHTML = renderPresentationTargetOptions(createUIContext(ctrl.game), draft, level);
  };
  targetOptions?.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-user-theme-target-option]');
    if (!button || !active) return;
    const target = getPresentationTargets().find(item => item.id === button.dataset.userThemeTargetOption);
    if (!target) return;
    const hosts = presentation.hosts ?? (presentation.hosts = []);
    hosts.push({ id: target.id, parent: target.parent, layers: [] });
    if (targetPicker) targetPicker.hidden = true;
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active, target.id);
  });
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-target-add]').forEach(button => button.addEventListener('click', () => {
    if (!active || !targetPicker) return;
    targetPicker.hidden = false;
    renderTargetOptions('region');
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-target-picker-close]').forEach(button => button.addEventListener('click', () => {
    if (targetPicker) targetPicker.hidden = true;
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-target-level]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    modal.querySelectorAll('[data-user-theme-target-level]').forEach(item => item.classList.toggle('is-active', item === button));
    renderTargetOptions(button.dataset.userThemeTargetLevel as import('./presentation-targets').PresentationTargetLevel);
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-panel-opacity]').forEach(input => input.addEventListener('input', () => {
    if (!active) return;
    const region = input.dataset.userThemePanelOpacity as PresentationRegion;
    const hosts = presentation.hosts ?? (presentation.hosts = []);
    const host = hosts.find(item => item.id === region) ?? { id: region, parent: undefined, layers: [] };
    if (!hosts.includes(host)) hosts.push(host);
    host.opacity = Math.max(0, Math.min(1, Number(input.value) || 0));
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
  modal.querySelectorAll<HTMLElement>('[data-user-theme-host-card]').forEach(card => bindPresentationHostCard(ctrl, modal, session, active, card));
  bindUserThemeLayerManager(ctrl, modal, session, active);
}

function resolvedLayersForTarget(ctrl: UIController, target: ThemeLayerTargetRef): readonly BackgroundLayerDef[] {
  const runtime = ctrl.game.colorSystem.runtimeTheme();
  if (target.kind === 'global') return runtime.background;
  const host = runtime.presentation?.hosts?.find(item => item.id === target.hostId);
  if (!host) return [];
  return target.state === 'default' || !target.state ? host.layers ?? [] : host.states?.[target.state]?.layers ?? host.layers ?? [];
}

function readTargetFromElement(element: HTMLElement): ThemeLayerTargetRef | null {
  const kind = element.dataset.themeLayerManagerTargetKind;
  if (kind === 'global') return { kind: 'global' };
  if (kind === 'host' && element.dataset.themeLayerManagerTargetHost) {
    const state = element.dataset.themeLayerManagerTargetState;
    return { kind: 'host', hostId: element.dataset.themeLayerManagerTargetHost, state: state === 'active' || state === 'inactive' || state === 'disabled' ? state : 'default' };
  }
  return null;
}

function bindUserThemeLayerManager(ctrl: UIController, modal: Element, session: import('../arona-clicker/services/user-theme-service').UserThemeEditSession, active: boolean): void {
  const shell = modal.querySelector<HTMLElement>('[data-theme-layer-manager-shell]');
  if (!shell || shell.dataset.layerManagerBound === 'true') return;
  shell.dataset.layerManagerBound = 'true';
  const ui: { target: ThemeLayerTargetRef | null; dialogTarget: ThemeLayerTargetRef | null; dialogLayerId: string | null; dialogDraft: BackgroundLayerDef | null; dirty: boolean } = { target: null, dialogTarget: null, dialogLayerId: null, dialogDraft: null, dirty: false };
  const list = shell.querySelector<HTMLElement>('[data-theme-layer-manager-list]');
  const dialog = shell.querySelector<HTMLElement>('[data-theme-layer-editor-dialog]');
  const form = shell.querySelector<HTMLElement>('[data-theme-layer-editor-form]');
  const title = shell.querySelector<HTMLElement>('[data-theme-layer-manager-title]');
  const source = shell.querySelector<HTMLElement>('[data-theme-layer-manager-source]');
  const reconcileList = (html: string): void => {
    if (!list) return;
    const template = document.createElement('div');
    template.innerHTML = html;
    const nextNodes = [...template.children] as HTMLElement[];
    const existing = new Map<string, HTMLElement>();
    list.querySelectorAll<HTMLElement>('[data-theme-layer-row][data-theme-layer-key]').forEach(row => existing.set(row.dataset.themeLayerKey!, row));
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const focusedRow = focused?.closest<HTMLElement>('[data-theme-layer-row]');
    const focusedKey = focusedRow?.dataset.themeLayerKey;
    const focusedAction = focused?.dataset.themeLayerEdit ? 'edit' : focused?.dataset.themeLayerToggle ? 'toggle' : focused?.dataset.themeLayerMove ? 'move' : focused?.dataset.themeLayerRemove ? 'remove' : undefined;
    nextNodes.forEach((next, index) => {
      const key = next.dataset.themeLayerKey;
      const node = key ? existing.get(key) ?? next : next;
      const current = list.children[index];
      if (current !== node) list.insertBefore(node, current ?? null);
      if (node !== next && node.innerHTML !== next.innerHTML) node.innerHTML = next.innerHTML;
    });
    while (list.children.length > nextNodes.length) list.lastElementChild?.remove();
    if (focusedKey && focusedAction) {
      const focusedRow = [...list.querySelectorAll<HTMLElement>('[data-theme-layer-row]')].find(row => row.dataset.themeLayerKey === focusedKey);
      focusedRow?.querySelector<HTMLElement>(`[data-theme-layer-${focusedAction}]`)?.focus();
    }
  };
  const refreshList = (): void => {
    if (!list) return;
    reconcileList(renderLayerManagerList(createUIContext(ctrl.game), session.draft, ui.target, active, ui.target ? resolvedLayersForTarget(ctrl, ui.target) : []));
  };
  const openManager = (target: ThemeLayerTargetRef): void => {
    if (ui.dialogDraft && ui.dirty) {
      if (!window.confirm('当前图层有未保存修改，放弃并切换吗？')) return;
      closeDialog();
    }
    ui.target = target;
    shell.hidden = false;
    if (title) title.textContent = themeLayerTargetLabel(target);
    if (source) source.textContent = hasLocalTarget(session.draft, target) ? '当前目标的本地覆盖' : '当前有效回退；实际修改才建立本地覆盖';
    refreshList();
  };
  const closeDialog = (): void => {
    if (ui.dialogDraft && ui.dirty && !window.confirm('放弃当前图层修改吗？')) return;
    ui.dialogTarget = null; ui.dialogLayerId = null; ui.dialogDraft = null; ui.dirty = false;
    if (dialog) dialog.hidden = true;
    if (form) form.innerHTML = '';
    shell.querySelector<HTMLButtonElement>('[data-theme-layer-manager-close]')?.focus();
  };
  const openDialog = (target: ThemeLayerTargetRef, layerId: string | null, mode: 'create' | 'edit'): void => {
    const sourceLayers = hasLocalTarget(session.draft, target) ? getTargetLayers(session.draft, target) : resolvedLayersForTarget(ctrl, target);
    const existing = layerId ? sourceLayers.find(layer => layer.id === layerId) : undefined;
    const draft = existing ? structuredClone(existing) : { kind: 'solid' as const, value: '#6b8cff', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' as const };
    ui.dialogTarget = target; ui.dialogLayerId = layerId; ui.dialogDraft = draft; ui.dirty = false;
    if (dialog) dialog.hidden = false;
    shell.querySelector<HTMLElement>('[data-theme-layer-dialog-title]')?.replaceChildren(document.createTextNode(mode === 'create' ? '新增图层' : '编辑图层'));
    if (form) form.innerHTML = renderLayerEditorForm(createUIContext(ctrl.game), draft, active);
    form?.querySelector<HTMLElement>('[data-theme-layer-dialog-field="id"]')?.focus();
  };
  const preview = (): void => { ctrl.game.colorSystem.setUserThemePreview(session.draft); ctrl.refreshTheme(); if (ui.target?.kind === 'host' && ui.target.hostId) refreshPresentationHostElements(ctrl, [ui.target.hostId]); else refreshPresentationHostElements(ctrl); };
  modal.querySelectorAll<HTMLElement>('[data-theme-layer-manager-target-kind]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    const target = readTargetFromElement(button);
    if (target) openManager(target);
  }));
  shell.querySelector<HTMLButtonElement>('[data-theme-layer-manager-close]')?.addEventListener('click', () => { if (!ui.dialogDraft || !ui.dirty) shell.hidden = true; else if (window.confirm('放弃当前图层修改并关闭管理器吗？')) { closeDialog(); shell.hidden = true; } });
  shell.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !ui.target || !active) return;
    const id = button.dataset.themeLayerEdit ?? button.dataset.themeLayerToggle ?? button.dataset.themeLayerMove ?? button.dataset.themeLayerRemove;
    if (button.dataset.themeLayerSystemToggle) { session.draft.systemColorLayerIgnored = !session.draft.systemColorLayerIgnored; preview(); refreshList(); return; }
    if (!id) return;
    if (ui.dialogDraft && ui.dirty) return;
    const layers = hasLocalTarget(session.draft, ui.target) ? getTargetLayers(session.draft, ui.target) : resolvedLayersForTarget(ctrl, ui.target);
    if (button.dataset.themeLayerEdit) { openDialog(ui.target, id, 'edit'); return; }
    if (!hasLocalTarget(session.draft, ui.target)) materializeTargetLayers(session.draft, ui.target, layers);
    if (button.dataset.themeLayerToggle) setTargetLayerEnabled(session.draft, ui.target, id, button.textContent?.trim() === '显示');
    else if (button.dataset.themeLayerMove) moveTargetLayer(session.draft, ui.target, id, button.dataset.direction === 'up' ? 'up' : 'down');
    else if (button.dataset.themeLayerRemove) { if (!window.confirm('删除这个图层吗？')) return; removeTargetLayer(session.draft, ui.target, id); }
    preview(); refreshList();
  });
  shell.querySelector<HTMLButtonElement>('[data-theme-layer-add]')?.addEventListener('click', () => { if (ui.target && active && !ui.dialogDraft) openDialog(ui.target, null, 'create'); });
  shell.querySelector<HTMLButtonElement>('[data-theme-layer-revert]')?.addEventListener('click', () => {
    if (!ui.target || !active || !hasLocalTarget(session.draft, ui.target) || !window.confirm('清除当前目标的本地覆盖并回退吗？')) return;
    if (ui.target.kind === 'global') { delete session.draft.background; delete session.draft.backgroundLayerOrder; }
    else {
      const host = session.draft.presentation?.hosts?.find(item => item.id === ui.target?.hostId);
      if (!host) return;
      if ((ui.target.state ?? 'default') === 'default') { delete host.layers; delete host.layerOrder; }
      else if (host.states) { delete host.states[ui.target.state!]; }
    }
    preview(); refreshList();
  });
  shell.querySelector<HTMLButtonElement>('[data-theme-layer-dialog-close]')?.addEventListener('click', closeDialog);
  shell.querySelector<HTMLButtonElement>('[data-theme-layer-dialog-cancel]')?.addEventListener('click', closeDialog);
  form?.addEventListener('input', event => {
    const field = (event.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>('[data-theme-layer-dialog-field]');
    if (!field || !ui.dialogDraft) return;
    ui.dirty = true;
    const key = field.dataset.themeLayerDialogField;
    if (key === 'id') ui.dialogDraft.id = field.value || undefined;
    else if (key === 'kind') {
      const kind = field.value as BackgroundLayerDef['kind']; ui.dialogDraft.kind = kind;
      if (kind === 'empty') ui.dialogDraft.value = '';
      else if (!ui.dialogDraft.value) ui.dialogDraft.value = kind === 'solid' ? '#6b8cff' : kind === 'gradient' ? 'linear-gradient(135deg, #6b8cff, #dbeafe)' : (ctrl.game.pics.list?.()[0]?.id ?? '');
      if (form) form.innerHTML = renderLayerEditorForm(createUIContext(ctrl.game), ui.dialogDraft, active);
    } else if (key === 'enabled') ui.dialogDraft.enabled = (field as HTMLInputElement).checked ? undefined : false;
    else if (key === 'opacity') ui.dialogDraft.opacity = Math.max(0, Math.min(1, Number(field.value) || 0));
    else if (key === 'scale') ui.dialogDraft.scale = Math.max(0.05, Math.min(8, Number(field.value) || 1));
    else if (key === 'color') ui.dialogDraft.value = field.value;
    else if (key === 'value') ui.dialogDraft.value = field.value;
    else if (key === 'gradientStart' || key === 'gradientEnd' || key === 'gradientAngle') {
      const match = /linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg,\s*(#[0-9a-f]{3,8}),\s*(#[0-9a-f]{3,8})\)/i.exec(ui.dialogDraft.value);
      const angle = key === 'gradientAngle' ? field.value : match?.[1] ?? '135'; const start = key === 'gradientStart' ? field.value : match?.[2] ?? '#6b8cff'; const end = key === 'gradientEnd' ? field.value : match?.[3] ?? '#dbeafe'; ui.dialogDraft.value = `linear-gradient(${angle}deg, ${start}, ${end})`;
    } else if (key === 'position' || key === 'size' || key === 'repeat' || key === 'blendMode') ui.dialogDraft[key] = field.value as never;
  });
  shell.querySelector<HTMLButtonElement>('[data-theme-layer-dialog-save]')?.addEventListener('click', () => {
    if (!ui.dialogTarget || !ui.dialogDraft || !active) return;
    if (ui.dialogLayerId) {
      if (!hasLocalTarget(session.draft, ui.dialogTarget)) materializeTargetLayers(session.draft, ui.dialogTarget, resolvedLayersForTarget(ctrl, ui.dialogTarget));
      updateTargetLayer(session.draft, ui.dialogTarget, ui.dialogLayerId, ui.dialogDraft);
    } else addTargetLayer(session.draft, ui.dialogTarget, ui.dialogDraft);
    preview(); closeDialog(); refreshList();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && ui.dialogDraft) { event.stopPropagation(); closeDialog(); } }, true);
}

function refreshUserThemeEditor(ctrl: UIController, modal: Element, session: import('../arona-clicker/services/user-theme-service').UserThemeEditSession, active: boolean, openHostId?: string): void {
  const inspector = modal.querySelector<HTMLElement>('.user-theme-inspector');
  const editor = modal.querySelector<HTMLElement>('.user-theme-editor');
  const section = editor?.dataset.themeEditorCurrentSection
    ?? modal.querySelector<HTMLElement>('[data-theme-editor-section].is-active')?.dataset.themeEditorSection
    ?? modal.querySelector<HTMLElement>('[data-theme-editor-panel]:not([hidden])')?.dataset.themeEditorPanel
    ?? 'colors';
  const scrollTop = inspector?.scrollTop ?? 0;
  const openTargets = new Set([...modal.querySelectorAll<HTMLElement>('[data-user-theme-host-card]')].filter(item => (item as HTMLDetailsElement).open).map(item => item.dataset.userThemeHostCard));
  const body = modal.querySelector<HTMLElement>('.modal-body');
  if (!body) return;
  const capability = ctrl.game.userThemeService.capability();
  body.innerHTML = renderUserThemeEditor(createUIContext(ctrl.game), session, active, capability.sources);
  body.querySelector<HTMLElement>('.user-theme-editor')?.setAttribute('data-theme-editor-current-section', section);
  body.querySelector<HTMLElement>('.user-theme-editor')?.setAttribute('data-theme-editor-current-filter', editor?.dataset.themeEditorCurrentFilter ?? 'all');
  body.querySelector<HTMLElement>(`[data-theme-editor-panel="${section}"]`)?.removeAttribute('hidden');
  body.querySelectorAll<HTMLElement>('[data-theme-editor-panel]').forEach(panel => { if (panel.dataset.themeEditorPanel !== section) panel.hidden = true; });
  body.querySelectorAll<HTMLElement>('[data-theme-editor-section]').forEach(item => item.classList.toggle('is-active', item.dataset.themeEditorSection === section));
  bindUserThemeEditor(ctrl, modal, session, active);
  const nextInspector = modal.querySelector<HTMLElement>('.user-theme-inspector');
  if (nextInspector) nextInspector.scrollTop = scrollTop;
  nextInspector?.querySelectorAll<HTMLDetailsElement>('[data-user-theme-host-card]').forEach(item => {
    item.open = item.dataset.userThemeHostCard === openHostId || openTargets.has(item.dataset.userThemeHostCard);
  });
}

function refreshPresentationHostCard(ctrl: UIController, modal: Element, session: import('../arona-clicker/services/user-theme-service').UserThemeEditSession, active: boolean, hostId: string): void {
  const card = [...modal.querySelectorAll<HTMLElement>('[data-user-theme-host-card]')].find(item => item.dataset.userThemeHostCard === hostId);
  const host = session.draft.presentation?.hosts?.find(item => item.id === hostId);
  if (!card || !host) return;
  const cardOpen = (card as HTMLDetailsElement).open;
  card.outerHTML = renderPresentationHostTarget(createUIContext(ctrl.game), host, active);
  const nextCard = [...modal.querySelectorAll<HTMLElement>('[data-user-theme-host-card]')].find(item => item.dataset.userThemeHostCard === hostId) as HTMLDetailsElement | undefined;
  if (!nextCard) return;
  nextCard.open = cardOpen;
  bindPresentationHostCard(ctrl, modal, session, active, nextCard);
}

function bindPresentationHostCard(ctrl: UIController, modal: Element, session: import('../arona-clicker/services/user-theme-service').UserThemeEditSession, active: boolean, card: HTMLElement): void {
  const draft = session.draft;
  const presentation = draft.presentation ?? (draft.presentation = { layers: [], components: [] });
  const hostId = card.dataset.userThemeHostCard;
  if (!hostId || card.dataset.hostEventsBound === 'true') return;
  card.dataset.hostEventsBound = 'true';
  const hostState = (): PresentationHostState => {
    const state = (card.querySelector<HTMLElement>('[data-user-theme-host-state].is-active')?.dataset.userThemeStateValue ?? 'default') as PresentationHostState;
    return state === 'active' || state === 'inactive' || state === 'disabled' ? state : 'default';
  };
  const stateDef = (host: NonNullable<typeof presentation.hosts>[number], state: PresentationHostState, create = false): PresentationHostStateDef | undefined => {
    if (state === 'default') return host;
    if (!host.states && create) host.states = {};
    if (create && !host.states![state]) host.states![state] = { layers: [] };
    return host.states?.[state];
  };
  card.querySelectorAll<HTMLButtonElement>('[data-user-theme-host-state]').forEach(button => button.addEventListener('click', () => {
    if (!active || !hostId) return;
    const state = (button.dataset.userThemeStateValue ?? 'default') as PresentationHostState;
    setPresentationHostState(hostId, state);
    card.querySelectorAll('[data-user-theme-host-state]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', String(selected));
    });
    refreshPresentationHostCard(ctrl, modal, session, active, hostId);
  }));
  card.querySelectorAll<HTMLSelectElement>('[data-user-theme-host-text-color]').forEach(select => select.addEventListener('change', event => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    if (!host) return;
    const state = hostState();
    const target = stateDef(host, state, state !== 'default');
    if (!target) return;
    const mode = (event.currentTarget as HTMLSelectElement).value as PresentationTextColorMode;
    if (state === 'default') host.textColorMode = mode;
    else target.textColorMode = mode;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
    refreshPresentationHostCard(ctrl, modal, session, active, hostId);
  }));
  card.querySelectorAll<HTMLSelectElement>('[data-user-theme-host-shape]').forEach(select => select.addEventListener('change', event => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    if (!host) return;
    const value = (event.currentTarget as HTMLSelectElement).value;
    host.shape = value === 'rounded-parallelogram' ? 'rounded-parallelogram' : undefined;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
     refreshPresentationHostCard(ctrl, modal, session, active, hostId);
   }));
  card.querySelectorAll<HTMLInputElement>('[data-user-theme-host-corner-radius], [data-user-theme-host-skew-x-deg]').forEach(input => input.addEventListener('input', event => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    if (!host) return;
    const key = (event.currentTarget as HTMLElement).dataset.userThemeHostCornerRadius !== undefined ? 'cornerRadius' : 'skewXDeg';
    const rawValue = (event.currentTarget as HTMLInputElement).value.trim();
    if (!rawValue) {
      delete host[key];
    } else {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return;
      const bounded = key === 'cornerRadius'
        ? Math.max(CORNER_RADIUS_MIN, Math.min(CORNER_RADIUS_MAX, value))
        : Math.max(SKEW_X_DEG_MIN, Math.min(SKEW_X_DEG_MAX, value));
      host[key] = bounded;
      (event.currentTarget as HTMLInputElement).value = String(bounded);
    }
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
  }));
  card.querySelectorAll<HTMLButtonElement>('[data-user-theme-host-geometry-reset]').forEach(button => button.addEventListener('click', () => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    if (!host) return;
    delete host.cornerRadius;
    delete host.skewXDeg;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
    refreshPresentationHostCard(ctrl, modal, session, active, hostId);
  }));
  card.querySelectorAll<HTMLInputElement>('[data-user-theme-host-decoration-toggle]').forEach(input => input.addEventListener('change', event => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    if (!host) return;
    const state = hostState();
    const target = stateDef(host, state, state !== 'default');
    if (!target) return;
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    if (!enabled) {
      if (state === 'default') delete host.decoration;
      else if (target !== host) delete target.decoration;
    } else {
      const inherited = state === 'default' ? undefined : host.decoration;
      const current = state === 'default' ? host.decoration : target.decoration;
      const decoration = { color: 'var(--theme-node-line)', width: 1, inset: 0, opacity: 1, style: 'solid' as const, ...inherited, ...current };
      if (state === 'default') host.decoration = decoration;
      else target.decoration = decoration;
    }
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
    refreshPresentationHostCard(ctrl, modal, session, active, hostId);
  }));
  card.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-user-theme-host-decoration-field]').forEach(field => field.addEventListener(field instanceof HTMLSelectElement ? 'change' : 'input', event => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    if (!host) return;
    const state = hostState();
    const target = stateDef(host, state, state !== 'default');
    if (!target) return;
    const decoration = state === 'default' ? host.decoration : target.decoration;
    if (!decoration) return;
    const key = (event.currentTarget as HTMLElement).dataset.userThemeHostDecorationField;
    const value = (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;
    if (key === 'color') decoration.color = value;
    else if (key === 'width') decoration.width = Math.max(0, Math.min(12, Number(value) || 0));
    else if (key === 'inset') decoration.inset = Math.max(0, Math.min(24, Number(value) || 0));
    else if (key === 'opacity') decoration.opacity = Math.max(0, Math.min(1, Number(value) || 0));
    else if (key === 'style' && (value === 'solid' || value === 'dashed' || value === 'dotted')) decoration.style = value;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
  }));
  card.querySelectorAll<HTMLButtonElement>('[data-user-theme-host-delete]').forEach(button => button.addEventListener('click', () => {
    if (!active || !presentation.hosts) return;
    const index = presentation.hosts.findIndex(item => item.id === hostId);
    if (index < 0) return;
    presentation.hosts.splice(index, 1);
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
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
