import type { UIContext } from '../context';
import type { UserThemeDraft } from '../../arona-clicker/types/user-theme';
import type { BackgroundLayerDef, PresentationHostState } from '../../engine/types/theme';
import {
  getTargetLayerOrder,
  getTargetLayers,
  hasLocalTarget,
  targetRefKey,
  type ThemeLayerTargetRef,
} from '../../arona-clicker/services/user-theme-layer-service';
import { getPresentationTargets } from '../presentation-targets';

const SYSTEM_ID = 'system-color-background';
const KIND_LABELS: Record<BackgroundLayerDef['kind'], string> = { empty: '空层', solid: '纯色', gradient: '渐变', image: '图片' };
const STATE_LABELS: Record<PresentationHostState, string> = { default: '默认', active: '激活', inactive: '未激活', disabled: '禁用' };

function esc(ctx: UIContext, value: string | undefined): string { const text = value ?? ''; return typeof ctx.escapeHtml === 'function' ? ctx.escapeHtml(text) : text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)); }

export function themeLayerTargetLabel(target: ThemeLayerTargetRef): string {
  if (target.kind === 'global') return '全局外部背景';
  const host = getPresentationTargets().find(item => item.id === target.hostId);
  return `${host?.label ?? target.hostId ?? '未知目标'} · ${STATE_LABELS[target.state ?? 'default']}`;
}

export function describeThemeLayer(layer: BackgroundLayerDef): { kind: string; summary: string; color?: string } {
  const kind = KIND_LABELS[layer.kind];
  const summary = layer.kind === 'empty' ? '无内容' : layer.kind === 'image' ? layer.value || '未选择图片' : layer.value || '未设置值';
  const color = layer.kind === 'solid' && /^#[0-9a-f]{3,8}$/i.test(layer.value) ? layer.value : undefined;
  return { kind, summary, color };
}

type LayerManagerEntry =
  | { system: true }
  | { system: false; layer: BackgroundLayerDef; sourceIndex: number };

function visualEntries(draft: UserThemeDraft, target: ThemeLayerTargetRef, resolvedLayers: readonly BackgroundLayerDef[]): LayerManagerEntry[] {
  const local = hasLocalTarget(draft, target);
  const layers = (local ? [...getTargetLayers(draft, target)] : [...resolvedLayers])
    .filter(layer => target.kind !== 'global' || layer.id !== SYSTEM_ID);
  if (!local) {
    const entries: LayerManagerEntry[] = layers.map((layer, sourceIndex) => ({ system: false, layer, sourceIndex }));
    if (target.kind === 'global') entries.push({ system: true });
    return entries.reverse();
  }
  const byId = new Map(layers.map((layer, sourceIndex) => [layer.id, { system: false as const, layer, sourceIndex }]));
  const ids = [...getTargetLayerOrder(draft, target)];
  for (const layer of layers) if (layer.id && !ids.includes(layer.id)) ids.push(layer.id);
  const entries: LayerManagerEntry[] = [];
  for (const id of ids.reverse()) {
    if (id === SYSTEM_ID) entries.push({ system: true });
    else if (byId.has(id)) entries.push(byId.get(id)!);
  }
  return entries;
}

export function renderLayerRow(ctx: UIContext, target: ThemeLayerTargetRef, layer: BackgroundLayerDef, position: number, count: number, legacyIndex = position): string {
  const info = describeThemeLayer(layer);
  const id = layer.id ?? `layer-${position + 1}`;
  const key = `${targetRefKey(target)}:${id}`;
  const legacyKey = target.kind === 'host' ? `${target.hostId}:${legacyIndex}` : undefined;
  const swatch = info.color ? `<span class="theme-layer-swatch" style="background:${esc(ctx, info.color)}" aria-hidden="true"></span>` : '<span class="theme-layer-swatch is-empty" aria-hidden="true"></span>';
  return `<details class="theme-layer-row${layer.enabled === false ? ' is-hidden' : ''}" data-theme-layer-row="${esc(ctx, key)}" data-theme-layer-key="${esc(ctx, key)}" data-theme-layer-id="${esc(ctx, id)}"${legacyKey ? ` data-user-theme-host-layer="${esc(ctx, legacyKey)}"` : ''}>
    <summary>${esc(ctx, id)}</summary>
    <div class="theme-layer-row-preview">${swatch}<span>${esc(ctx, info.kind)} · ${esc(ctx, info.summary)}</span><span>${layer.enabled === false ? '已隐藏' : '显示中'}</span></div><div class="theme-layer-row-actions"><button type="button" data-theme-layer-edit="${esc(ctx, id)}">编辑</button><button type="button" data-theme-layer-toggle="${esc(ctx, id)}">${layer.enabled === false ? '显示' : '隐藏'}</button><button type="button" data-theme-layer-move="${esc(ctx, id)}"${target.kind === 'global' ? ` data-user-theme-background-move="${legacyIndex}"` : ''} data-direction="up" ${position <= 0 ? 'disabled' : ''}>上移</button><button type="button" data-theme-layer-move="${esc(ctx, id)}"${target.kind === 'global' ? ` data-user-theme-background-move="${legacyIndex}"` : ''} data-direction="down" ${position >= count - 1 ? 'disabled' : ''}>下移</button><button type="button" data-theme-layer-remove="${esc(ctx, id)}">删除</button></div>
  </details>`;
}

export function renderLayerManagerList(ctx: UIContext, draft: UserThemeDraft, target: ThemeLayerTargetRef | null, active: boolean, resolvedLayers: readonly BackgroundLayerDef[] = []): string {
  if (!target) return '<p class="modal-empty">选择一个表现目标开始管理图层。</p>';
  const local = hasLocalTarget(draft, target);
  const entries = visualEntries(draft, target, resolvedLayers);
  const system = (position: number, count: number): string => `<details class="theme-layer-row theme-layer-system-row" data-theme-layer-row="global:${SYSTEM_ID}" data-theme-layer-key="global:${SYSTEM_ID}" data-theme-layer-id="${SYSTEM_ID}"><summary><span class="theme-layer-row-main"><span class="theme-layer-swatch is-system" aria-hidden="true"></span><span><strong>系统颜色层</strong><small>主题色系统 · 不可删除</small></span></span><span class="theme-layer-row-state">${draft.systemColorLayerIgnored ? '已忽略' : '显示中'}</span></summary><div class="theme-layer-row-actions"><button type="button" data-theme-layer-system-toggle ${active ? '' : 'disabled'}>${draft.systemColorLayerIgnored ? '显示' : '隐藏'}</button><button type="button" data-theme-layer-move="${SYSTEM_ID}" data-direction="up" ${!active || position <= 0 ? 'disabled' : ''}>上移</button><button type="button" data-theme-layer-move="${SYSTEM_ID}" data-direction="down" ${!active || position >= count - 1 ? 'disabled' : ''}>下移</button></div></details>`;
  const userCount = entries.filter(entry => !entry.system).length;
  if (!userCount) {
    const systemEntry = entries.findIndex(entry => entry.system);
    return `${systemEntry >= 0 ? system(systemEntry, entries.length) : ''}<div class="theme-layer-empty"><strong>${local ? '本目标有本地图层，但当前为空' : '当前没有本地图层'}</strong><small>${local ? '运行时将回退到父级或系统表现。' : '当前回退到父级或系统表现。'}</small></div>`;
  }
  return `${!local ? '<p class="theme-layer-fallback-note">以下为当前有效回退图层；第一次修改时才建立本地覆盖。</p>' : ''}${entries.map((entry, index) => entry.system ? system(index, entries.length) : renderLayerRow(ctx, target, entry.layer, index, entries.length, entry.sourceIndex)).join('')}`;
}

export function renderLayerManagerShell(ctx: UIContext, draft: UserThemeDraft, active: boolean, initialTarget: ThemeLayerTargetRef | null = null): string {
  return `<section class="theme-layer-manager" data-theme-layer-manager-shell hidden aria-label="图层管理器">
    <header class="theme-layer-manager-header" data-theme-layer-manager-header><div><span class="eyebrow">LAYER MANAGER</span><strong data-theme-layer-manager-title>${initialTarget ? esc(ctx, themeLayerTargetLabel(initialTarget)) : '选择表现目标'}</strong><small data-theme-layer-manager-source>${initialTarget && hasLocalTarget(draft, initialTarget) ? '当前目标的本地覆盖' : '只读解析；实际修改才建立本地覆盖'}</small></div><button type="button" class="user-theme-token-clear" data-theme-layer-manager-close>关闭</button></header>
    <div class="theme-layer-manager-toolbar"><button type="button" data-theme-layer-add ${active ? '' : 'disabled'}>新增图层</button><button type="button" data-theme-layer-revert ${active ? '' : 'disabled'}>清除本地覆盖</button></div>
    <div class="theme-layer-manager-list" data-theme-layer-manager-list>${renderLayerManagerList(ctx, draft, initialTarget, active, initialTarget ? [] : [])}</div>
    <div class="theme-layer-editor-dialog" data-theme-layer-editor-dialog hidden role="dialog" aria-modal="false" aria-label="图层编辑"><div class="theme-layer-editor-dialog-head"><strong data-theme-layer-dialog-title>编辑图层</strong><button type="button" data-theme-layer-dialog-close aria-label="关闭图层编辑">×</button></div><div class="theme-layer-editor-form" data-theme-layer-editor-form></div><div class="theme-layer-editor-dialog-foot"><button type="button" data-theme-layer-dialog-cancel>取消</button><button type="button" class="primary-button" data-theme-layer-dialog-save ${active ? '' : 'disabled'}>保存图层</button></div></div>
  </section>`;
}

export function renderLayerEditorForm(ctx: UIContext, layer: BackgroundLayerDef, active: boolean): string {
  const disabled = active ? '' : 'disabled';
  const gradient = /^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg,\s*(#[0-9a-f]{3,8}),\s*(#[0-9a-f]{3,8})\)$/i.exec(layer.value);
  const value = layer.kind === 'solid' ? `<input type="color" data-theme-layer-dialog-field="color" value="${/^#[0-9a-f]{6}$/i.test(layer.value) ? layer.value : '#6b8cff'}" ${disabled}>` : layer.kind === 'gradient' ? `<div class="user-theme-gradient-colors"><label>起始色 <input type="color" data-theme-layer-dialog-field="gradientStart" value="${gradient?.[2] ?? '#6b8cff'}" ${disabled}></label><label>结束色 <input type="color" data-theme-layer-dialog-field="gradientEnd" value="${gradient?.[3] ?? '#dbeafe'}" ${disabled}></label><label>角度 <input type="number" data-theme-layer-dialog-field="gradientAngle" min="0" max="360" value="${gradient?.[1] ?? 135}" ${disabled}></label></div>` : layer.kind === 'image' ? `<select data-theme-layer-dialog-field="value" ${disabled}><option value="">选择图片资源</option>${(ctx.game.pics.list?.() ?? []).map(pic => `<option value="${esc(ctx, pic.id)}" ${pic.id === layer.value ? 'selected' : ''}>${esc(ctx, pic.label ?? pic.id)}</option>`).join('')}</select>` : '<small>切换类型后设置视觉值。</small>';
  return `<label class="user-theme-field"><span>名称 / ID</span><input type="text" data-theme-layer-dialog-field="id" value="${esc(ctx, layer.id ?? '')}" ${disabled}></label><label class="user-theme-field"><span>表现类型</span><select data-theme-layer-dialog-field="kind" ${disabled}>${Object.entries(KIND_LABELS).map(([kind, label]) => `<option value="${kind}" ${layer.kind === kind ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="user-theme-field"><span>视觉值</span>${value}</label><div class="user-theme-number-row"><label>透明度 <input type="number" min="0" max="1" step="0.05" data-theme-layer-dialog-field="opacity" value="${layer.opacity ?? 1}" ${disabled}></label><label>缩放 <input type="number" min="0.05" max="8" step="0.05" data-theme-layer-dialog-field="scale" value="${layer.scale ?? 1}" ${disabled}></label></div><div class="user-theme-number-row"><label>定位 <input type="text" data-theme-layer-dialog-field="position" value="${esc(ctx, layer.position ?? 'center')}" ${disabled}></label><label>尺寸 <input type="text" data-theme-layer-dialog-field="size" value="${esc(ctx, layer.size ?? 'cover')}" ${disabled}></label></div><div class="user-theme-number-row"><label>重复 <select data-theme-layer-dialog-field="repeat" ${disabled}>${['repeat','repeat-x','repeat-y','no-repeat','space','round'].map(value => `<option value="${value}" ${layer.repeat === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>混合 <select data-theme-layer-dialog-field="blendMode" ${disabled}>${['normal','multiply','screen','overlay','soft-light','hard-light','darken','lighten'].map(value => `<option value="${value}" ${(layer.blendMode ?? 'normal') === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><label class="user-theme-enabled"><input type="checkbox" data-theme-layer-dialog-field="enabled" ${layer.enabled !== false ? 'checked' : ''} ${disabled}>参与渲染</label>`;
}
