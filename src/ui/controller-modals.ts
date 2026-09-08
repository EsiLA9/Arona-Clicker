// ============================================================
// ui/controller-modals.ts — UI 控制器：弹层弹窗管理
// 从 controller.ts 拆出：openGachaModal / openSpotGachaModal /
//   bindGachaButtons / openEnhancementManager
// ============================================================

import { createUIContext } from './context';
import { renderGachaBody, renderSpotGachaBody } from './components/contacts';
import { renderEnhancementManager } from './components/enhancements';
import { nodeSource, renderPresentationHostTarget, renderPresentationTargetOptions, renderUserThemeEditor, scopeNodesFor, scopeSource, setPresentationHostState, tokenSource } from './components/user-theme-editor';
import type { UIController } from './controller';
import { openPackManagerModal } from './components/pack-manager-modal';
import type { PackCatalogCommands, PackCatalogReadModel } from '../arona-clicker/contracts';
import type { BackgroundLayerDef, ComponentPlacementDef, PresentationHostState, PresentationHostStateDef, PresentationLayerDef, PresentationRegion, PresentationTextColorMode } from '../engine/types/theme';
import { getPresentationTargets } from './presentation-targets';
import { refreshPresentationHostElements } from './controller-theme';
import { CORNER_RADIUS_MAX, CORNER_RADIUS_MIN, SKEW_X_DEG_MAX, SKEW_X_DEG_MIN } from './presentation-config';

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
  if (!current.draft.background && runtimeTheme.background.length > 0) {
    current.draft.background = runtimeTheme.background.filter(layer => layer.id !== 'system-color-background').map(layer => ({ ...layer }));
  }
  current.draft.background?.forEach((layer, index) => { if (!layer.id) layer.id = `user-background-${index}`; });
  if (!current.draft.backgroundLayerOrder) {
    const order = runtimeTheme.background.map(layer => layer.id).filter((id): id is string => Boolean(id));
    if (order.length > 0) current.draft.backgroundLayerOrder = order;
  }
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
  const ids = [ 'system-color-background', ...layers.map((layer, index) => layer.id ?? `${host.id}-layer-${index}`) ];
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
  const updateBackgroundField = (field: HTMLInputElement | HTMLSelectElement) => {
    if (!active || !draft.background) return;
    const index = Number(field.dataset.userThemeBackgroundIndex);
    const key = field.dataset.userThemeBackgroundField as 'kind' | 'id' | 'value' | 'color' | 'gradientStart' | 'gradientEnd' | 'gradientAngle' | 'opacity' | 'position' | 'size' | 'repeat' | 'blendMode' | 'attachment' | 'scale' | 'rotation';
    const layer = draft.background[index]; if (!layer) return;
    if (key === 'opacity') layer.opacity = Math.max(0, Math.min(1, Number(field.value) || 0));
    else if (key === 'scale') layer.scale = Math.max(0.05, Math.min(8, Number(field.value) || 1));
    else if (key === 'rotation') layer.rotation = Number(field.value) || 0;
    else if (key === 'id') layer.id = field.value || undefined;
    else if (key === 'color') layer.value = field.value;
    else if (key === 'gradientStart' || key === 'gradientEnd' || key === 'gradientAngle') {
      const current = layer.value.match(/^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg,\s*(#[0-9a-f]{3,8}),\s*(#[0-9a-f]{3,8})\)$/i);
      const angle = key === 'gradientAngle' ? Math.max(0, Math.min(360, Number(field.value) || 0)) : Number(current?.[1] ?? 135);
      const start = key === 'gradientStart' ? field.value : (current?.[2] ?? '#6b8cff');
      const end = key === 'gradientEnd' ? field.value : (current?.[3] ?? '#dbeafe');
      layer.value = `linear-gradient(${angle}deg, ${start}, ${end})`;
    }
    else if (key === 'kind') {
      const previousKind = layer.kind;
      const nextKind = field.value as typeof layer.kind;
      layer.kind = nextKind;
      if (nextKind === 'empty') layer.value = '';
      else if (previousKind === 'empty' || !layer.value) {
        layer.value = nextKind === 'solid' ? '#6b8cff' : nextKind === 'gradient' ? 'linear-gradient(135deg, #6b8cff, #dbeafe)' : (ctrl.game.pics.list?.()[0]?.id ?? '');
      }
      ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
      return;
    }
    else layer[key] = field.value as never;
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme();
  };
  modal.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-user-theme-background-field]').forEach(field => {
    field.addEventListener(field instanceof HTMLSelectElement ? 'change' : 'input', () => updateBackgroundField(field));
  });
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-background-remove]').forEach(button => button.addEventListener('click', () => {
    if (!active || !draft.background) return;
    draft.background.splice(Number(button.dataset.userThemeBackgroundRemove), 1);
    if (draft.background.length === 0) delete draft.background;
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-background-add]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const layers = draft.background ?? (draft.background = []);
    let id = `user-background-${layers.length + 1}`;
    while (layers.some(layer => layer.id === id)) id = `user-background-${Number(id.split('-').pop()) + 1}`;
    layers.push({ id, kind: 'empty', value: '', opacity: 0, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' });
    draft.backgroundLayerOrder = [...(draft.backgroundLayerOrder ?? ['system-color-background']), id];
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-region-layer-add]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const region = button.dataset.userThemeRegionLayerAdd as PresentationRegion;
    const hosts = presentation.hosts ?? (presentation.hosts = []);
    const host = hosts.find(item => item.id === region) ?? { id: region, parent: undefined, layers: [] };
    if (!hosts.includes(host)) hosts.push(host);
    const layers = host.layers ?? (host.layers = []);
    const count = layers.length + 1;
    layers.push({ id: `${region}-layer-${count}`, kind: 'empty', value: '', opacity: 0, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' });
    host.layerOrder = layers.map(layer => layer.id).filter((id): id is string => Boolean(id));
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
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
  const moveLayer = (index: number, direction: -1 | 1, layers: PresentationLayerDef[] | BackgroundLayerDef[]) => {
    const target = index + direction;
    if (!layers[index] || target < 0 || target >= layers.length) return;
    [layers[index], layers[target]] = [layers[target], layers[index]];
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
  };
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-layer-move]').forEach(button => button.addEventListener('click', () => {
    if (!active || !presentation.layers) return;
    moveLayer(Number(button.dataset.userThemeLayerMove), button.dataset.direction === 'up' ? -1 : 1, presentation.layers);
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-background-move]').forEach(button => button.addEventListener('click', () => {
    if (!active || !draft.background) return;
    const index = Number(button.dataset.userThemeBackgroundMove);
    const layerIds = draft.background.map((layer, itemIndex) => layer.id ?? `user-background-${itemIndex}`);
    const order = [...(draft.backgroundLayerOrder ?? ['system-color-background', ...layerIds])];
    for (const id of ['system-color-background', ...layerIds]) if (!order.includes(id)) order.push(id);
    const current = order.indexOf(layerIds[index]);
    const target = current + (button.dataset.direction === 'up' ? 1 : -1);
    if (current < 0 || target < 0 || target >= order.length) return;
    [order[current], order[target]] = [order[target], order[current]];
    draft.backgroundLayerOrder = order;
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
  }));
  modal.querySelectorAll<HTMLButtonElement>('[data-user-theme-system-layer-move]').forEach(button => button.addEventListener('click', () => {
    if (!active) return;
    const layerIds = (draft.background ?? []).map((layer, itemIndex) => layer.id ?? `user-background-${itemIndex}`);
    const ids = [...(draft.backgroundLayerOrder ?? ['system-color-background', ...layerIds])];
    for (const id of ['system-color-background', ...layerIds]) if (!ids.includes(id)) ids.push(id);
    const index = ids.indexOf('system-color-background');
    if (index < 0) return;
    const target = index + (button.dataset.userThemeSystemLayerMove === 'up' ? 1 : -1);
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    draft.backgroundLayerOrder = ids;
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshUserThemeEditor(ctrl, modal, session, active);
  }));
  modal.querySelectorAll<HTMLInputElement>('[data-user-theme-layer-opacity]').forEach(input => input.addEventListener('input', () => {
    if (!active || !presentation.layers) return;
    const layer = presentation.layers[Number(input.dataset.userThemeLayerOpacity)]; if (layer) { layer.opacity = Math.max(0, Math.min(1, Number(input.value) || 0)); ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.render(); }
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
  const openLayers = new Set([...modal.querySelectorAll<HTMLElement>('[data-user-theme-host-layer]')].filter(item => (item as HTMLDetailsElement).open).map(item => item.dataset.userThemeHostLayer));
  const openBackgroundLayers = new Map<string, boolean>();
  for (const item of [...modal.querySelectorAll<HTMLDetailsElement>('.user-theme-layer-collapsible:not([data-user-theme-host-layer])')]) {
    const key = userThemeBackgroundLayerKey(item, session.draft);
    if (key) openBackgroundLayers.set(key, item.open);
  }
  const focused = document.activeElement instanceof HTMLElement ? { host: focusedHostField(document.activeElement), section: document.activeElement.closest<HTMLElement>('[data-theme-editor-panel]')?.dataset.themeEditorPanel } : undefined;
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
  nextInspector?.querySelectorAll<HTMLDetailsElement>('[data-user-theme-host-layer]').forEach(item => { item.open = openLayers.has(item.dataset.userThemeHostLayer); });
  nextInspector?.querySelectorAll<HTMLDetailsElement>('.user-theme-layer-collapsible:not([data-user-theme-host-layer])').forEach(item => {
    const key = userThemeBackgroundLayerKey(item, session.draft);
    item.open = key ? (openBackgroundLayers.get(key) ?? true) : true;
  });
  if (focused?.host) {
    const field = nextInspector?.querySelector<HTMLElement>(`[data-user-theme-host-field="${focused.host.key}"][data-user-theme-host-id="${focused.host.id}"][data-user-theme-host-index="${focused.host.index}"]`);
    field?.focus();
  }
}

function userThemeBackgroundLayerKey(item: HTMLDetailsElement, draft: import('../arona-clicker/types/user-theme').UserThemeDraft): string | undefined {
  if (item.querySelector('[data-user-theme-system-color-ignore]')) return 'system-color-background';
  const field = item.querySelector<HTMLElement>('[data-user-theme-background-field]');
  const index = Number(field?.dataset.userThemeBackgroundIndex);
  if (!Number.isInteger(index) || index < 0) return undefined;
  return draft.background?.[index]?.id ?? `user-background-${index}`;
}

function focusedHostField(element: HTMLElement): { id: string; index: string; key: string } | undefined {
  const field = element.closest<HTMLElement>('[data-user-theme-host-field]');
  if (!field?.dataset.userThemeHostId || !field.dataset.userThemeHostIndex || !field.dataset.userThemeHostField) return undefined;
  return { id: field.dataset.userThemeHostId, index: field.dataset.userThemeHostIndex, key: field.dataset.userThemeHostField };
}

function refreshPresentationHostCard(ctrl: UIController, modal: Element, session: import('../arona-clicker/services/user-theme-service').UserThemeEditSession, active: boolean, hostId: string): void {
  const card = [...modal.querySelectorAll<HTMLElement>('[data-user-theme-host-card]')].find(item => item.dataset.userThemeHostCard === hostId);
  const host = session.draft.presentation?.hosts?.find(item => item.id === hostId);
  if (!card || !host) return;
  const cardOpen = (card as HTMLDetailsElement).open;
  const openLayers = new Set([...card.querySelectorAll<HTMLElement>('[data-user-theme-host-layer]')].filter(item => (item as HTMLDetailsElement).open).map(item => item.dataset.userThemeHostLayer));
  card.outerHTML = renderPresentationHostTarget(createUIContext(ctrl.game), host, active);
  const nextCard = [...modal.querySelectorAll<HTMLElement>('[data-user-theme-host-card]')].find(item => item.dataset.userThemeHostCard === hostId) as HTMLDetailsElement | undefined;
  if (!nextCard) return;
  nextCard.open = cardOpen;
  nextCard.querySelectorAll<HTMLDetailsElement>('[data-user-theme-host-layer]').forEach(item => { item.open = openLayers.has(item.dataset.userThemeHostLayer); });
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
  card.querySelectorAll<HTMLInputElement>('[data-user-theme-host-system-color-ignore]').forEach(input => input.addEventListener('change', event => {
    if (!active || !presentation.hosts) return;
    const currentHost = presentation.hosts.find(item => item.id === hostId);
    if (!currentHost) return;
    const state = hostState();
    const target = stateDef(currentHost, state, state !== 'default');
    if (!target) return;
    if (state === 'default') currentHost.systemColorLayerIgnored = !(event.currentTarget as HTMLInputElement).checked;
    else target.systemColorLayerIgnored = !(event.currentTarget as HTMLInputElement).checked;
    ctrl.game.colorSystem.setUserThemePreview(draft);
    ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
    const panel = hostId.startsWith('leftPanel') ? 'left' : hostId.startsWith('centerPanel') ? 'center' : hostId.startsWith('rightPanel') ? 'right' : undefined;
    if (panel) ctrl.refreshPanels([panel]);
  }));
  card.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-user-theme-host-field]').forEach(field => field.addEventListener(field instanceof HTMLSelectElement ? 'change' : 'input', () => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    const state = host ? hostState() : 'default';
    const target = host ? stateDef(host, state, state !== 'default') : undefined;
    const layer = target?.layers?.[Number(field.dataset.userThemeHostIndex)];
    if (!host || !layer) return;
    const key = field.dataset.userThemeHostField;
    if (key === 'opacity') layer.opacity = Math.max(0, Math.min(1, Number(field.value) || 0));
    else if (key === 'scale') layer.scale = Math.max(0.05, Math.min(8, Number(field.value) || 1));
    else if (key === 'rotation') layer.rotation = Number(field.value) || 0;
    else if (key === 'id') layer.id = field.value || undefined;
    else if (key === 'color') layer.value = field.value;
    else if (key === 'gradientStart' || key === 'gradientEnd' || key === 'gradientAngle') {
      const current = layer.value.match(/^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg,\s*(#[0-9a-f]{3,8}),\s*(#[0-9a-f]{3,8})\)$/i);
      const angle = key === 'gradientAngle' ? Math.max(0, Math.min(360, Number(field.value) || 0)) : Number(current?.[1] ?? 135);
      const start = key === 'gradientStart' ? field.value : (current?.[2] ?? '#6b8cff');
      const end = key === 'gradientEnd' ? field.value : (current?.[3] ?? '#dbeafe');
      layer.value = `linear-gradient(${angle}deg, ${start}, ${end})`;
    } else if (key === 'kind') {
      const previousKind = layer.kind;
      layer.kind = field.value as typeof layer.kind;
      if (layer.kind === 'empty') layer.value = '';
      else if (previousKind === 'empty' || !layer.value) layer.value = layer.kind === 'solid' ? '#6b8cff' : layer.kind === 'gradient' ? 'linear-gradient(135deg, #6b8cff, #dbeafe)' : (ctrl.game.pics.list?.()[0]?.id ?? '');
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshPresentationHostElements(ctrl, [hostId]); refreshPresentationHostCard(ctrl, modal, session, active, hostId); return;
    } else layer[key as 'value' | 'attachment' | 'position' | 'size' | 'repeat' | 'blendMode'] = field.value as never;
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme();
    refreshPresentationHostElements(ctrl, [hostId]);
  }));
  card.querySelectorAll<HTMLButtonElement>('[data-user-theme-host-add]').forEach(button => button.addEventListener('click', () => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    if (!host) return;
    const state = hostState();
    const target = stateDef(host, state, state !== 'default');
    if (!target) return;
    const stateLayers = target.layers ?? (target.layers = []);
    stateLayers.push({ id: `${host.id.replace(/\./g, '-')}-${state}-layer-${stateLayers.length + 1}`, kind: 'empty', value: '', opacity: 0, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' });
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshPresentationHostElements(ctrl, [hostId]); refreshPresentationHostCard(ctrl, modal, session, active, hostId);
  }));
  card.querySelectorAll<HTMLButtonElement>('[data-user-theme-host-move]').forEach(button => button.addEventListener('click', () => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    const state = host ? hostState() : 'default';
    const target = host ? stateDef(host, state, false) : undefined;
    const index = Number(button.dataset.userThemeHostIndex);
    const layerId = target?.layers?.[index]?.id ?? `${hostId}-layer-${index}`;
    if (!host || !target?.layers?.[index]) return;
    if (state === 'default') reorderHostLayerOrder(host, layerId, button.dataset.direction as 'up' | 'down');
    else {
      const stateHost = { ...host, layers: target.layers, layerOrder: target.layerOrder } as typeof host;
      reorderHostLayerOrder(stateHost, layerId, button.dataset.direction as 'up' | 'down');
      target.layerOrder = stateHost.layerOrder;
    }
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshPresentationHostElements(ctrl, [hostId]); refreshPresentationHostCard(ctrl, modal, session, active, hostId);
  }));
  card.querySelectorAll<HTMLButtonElement>('[data-user-theme-host-system-layer-move]').forEach(button => button.addEventListener('click', () => {
    if (!active || !presentation.hosts) return;
    const currentHost = presentation.hosts.find(item => item.id === hostId);
    if (!currentHost) return;
    const state = hostState();
    const target = stateDef(currentHost, state, state !== 'default');
    if (!target) return;
    if (state === 'default') reorderHostLayerOrder(currentHost, 'system-color-background', button.dataset.direction as 'up' | 'down');
    else {
      const stateHost = { ...currentHost, layers: target.layers ?? [], layerOrder: target.layerOrder } as typeof currentHost;
      reorderHostLayerOrder(stateHost, 'system-color-background', button.dataset.direction as 'up' | 'down');
      target.layerOrder = stateHost.layerOrder;
    }
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshPresentationHostElements(ctrl, [hostId]); refreshPresentationHostCard(ctrl, modal, session, active, hostId);
  }));
  card.querySelectorAll<HTMLButtonElement>('[data-user-theme-host-remove]').forEach(button => button.addEventListener('click', () => {
    if (!active || !presentation.hosts) return;
    const host = presentation.hosts.find(item => item.id === hostId);
    const index = Number(button.dataset.userThemeHostIndex);
    const state = host ? hostState() : 'default';
    const target = host ? stateDef(host, state, false) : undefined;
    if (!host || !target?.layers?.[index]) return;
    target.layers.splice(index, 1);
    target.layerOrder = target.layers.map(layer => layer.id).filter((id): id is string => Boolean(id));
    ctrl.game.colorSystem.setUserThemePreview(draft); ctrl.refreshTheme(); refreshPresentationHostElements(ctrl, [hostId]); refreshPresentationHostCard(ctrl, modal, session, active, hostId);
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

export function openPackManager(ctrl: UIController): void {
  const host = ctrl.game as typeof ctrl.game & Partial<PackCatalogReadModel & PackCatalogCommands>;
  if (!host.getPackCatalog || !host.setPackEnabled || !host.reorderPacks || !host.applyEnabledPacks) {
    ctrl.toast.show('当前运行时不支持数据包库管理', 'error');
    return;
  }
  openPackManagerModal(ctrl.modal, host as PackCatalogReadModel & PackCatalogCommands, () => ctrl.render());
}
