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
import { parseGradient, type ParsedGradient } from '../theme-layer-value';

const SYSTEM_ID = 'system-color-background';
const KIND_LABELS: Record<BackgroundLayerDef['kind'], string> = { empty: '空层', solid: '纯色', gradient: '渐变', image: '图片' };
const STATE_LABELS: Record<PresentationHostState, string> = { default: '默认', active: '激活', inactive: '未激活', disabled: '禁用' };
const SWATCH_VALUE_PATTERN = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\([^;<>]+\)|var\(--[a-z0-9-]+(?:\s*,\s*[^;<>]+)?\))$/i;

function esc(ctx: UIContext, value: string | undefined): string { const text = value ?? ''; return typeof ctx.escapeHtml === 'function' ? ctx.escapeHtml(text) : text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)); }

function colorInputValue(value: string, fallback: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) return value.replace(/([0-9a-f])/gi, '$1$1');
  return fallback;
}

export function themeLayerTargetLabel(target: ThemeLayerTargetRef): string {
  if (target.kind === 'global') return '全局外部背景';
  const host = getPresentationTargets().find(item => item.id === target.hostId);
  return `${host?.label ?? target.hostId ?? '未知目标'} · ${STATE_LABELS[target.state ?? 'default']}`;
}

export interface ThemeLayerDescription {
  kind: string;
  summary: string;
  color?: string;
  gradient?: string;
  image?: boolean;
}

export function describeThemeLayer(layer: BackgroundLayerDef): ThemeLayerDescription {
  const kind = KIND_LABELS[layer.kind];
  const summary = layer.kind === 'empty' ? '无内容' : layer.kind === 'image' ? layer.value || '未选择图片' : layer.value || '未设置值';
  const gradient = layer.kind === 'gradient' ? parseGradient(layer.value) : undefined;
  return {
    kind,
    summary,
    color: layer.kind === 'solid' && SWATCH_VALUE_PATTERN.test(layer.value.trim()) ? layer.value.trim() : undefined,
    gradient: layer.kind === 'gradient' && SWATCH_VALUE_PATTERN.test(layer.value.trim())
      ? layer.value.trim()
      : undefined,
    image: layer.kind === 'image',
  };
}

/** 列表行的视觉标识：图片用 emoji，颜色/渐变用小方块直接展示颜色。 */
function renderSwatch(ctx: UIContext, info: ThemeLayerDescription, extraClass = ''): string {
  if (info.image) return `<span class="theme-layer-swatch is-image${extraClass}" aria-hidden="true">🖼️</span>`;
  const background = info.color ?? info.gradient;
  if (background) return `<span class="theme-layer-swatch${extraClass}" style="background:${esc(ctx, background)}" aria-hidden="true"></span>`;
  return `<span class="theme-layer-swatch is-empty${extraClass}" aria-hidden="true"></span>`;
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
    if (target.kind === 'global') entries.unshift({ system: true });
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
  const hidden = layer.enabled === false;
  const moveAttributes = target.kind === 'global' ? ` data-user-theme-background-move="${legacyIndex}"` : '';
  return `<div class="theme-layer-row${hidden ? ' is-hidden' : ''}" data-theme-layer-row="${esc(ctx, key)}" data-theme-layer-key="${esc(ctx, key)}" data-theme-layer-id="${esc(ctx, id)}"${legacyKey ? ` data-user-theme-host-layer="${esc(ctx, legacyKey)}"` : ''}>
    ${renderSwatch(ctx, info)}
    <span class="theme-layer-row-text"><strong class="theme-layer-row-name">${esc(ctx, id)}</strong><small class="theme-layer-row-desc">${esc(ctx, info.kind)} · ${esc(ctx, info.summary)}${hidden ? ' · 已隐藏' : ''}</small></span>
    <span class="theme-layer-row-actions"><button type="button" class="theme-layer-icon-button" data-theme-layer-edit="${esc(ctx, id)}" title="编辑" aria-label="编辑 ${esc(ctx, id)}">✎</button><button type="button" class="theme-layer-icon-button" data-theme-layer-toggle="${esc(ctx, id)}" data-theme-layer-next-enabled="${hidden ? '1' : '0'}" title="${hidden ? '显示' : '隐藏'}" aria-label="${hidden ? '显示' : '隐藏'} ${esc(ctx, id)}">${hidden ? '👁' : '🙈'}</button><button type="button" class="theme-layer-icon-button" data-theme-layer-move="${esc(ctx, id)}"${moveAttributes} data-direction="up" ${position <= 0 ? 'disabled' : ''} title="上移" aria-label="上移 ${esc(ctx, id)}">↑</button><button type="button" class="theme-layer-icon-button" data-theme-layer-move="${esc(ctx, id)}"${moveAttributes} data-direction="down" ${position >= count - 1 ? 'disabled' : ''} title="下移" aria-label="下移 ${esc(ctx, id)}">↓</button><button type="button" class="theme-layer-icon-button is-danger" data-theme-layer-remove="${esc(ctx, id)}" title="删除" aria-label="删除 ${esc(ctx, id)}">🗑</button></span>
  </div>`;
}

export function renderLayerManagerList(ctx: UIContext, draft: UserThemeDraft, target: ThemeLayerTargetRef | null, active: boolean, resolvedLayers: readonly BackgroundLayerDef[] = []): string {
  if (!target) return '<p class="modal-empty">选择一个表现目标开始管理图层。</p>';
  const local = hasLocalTarget(draft, target);
  const entries = visualEntries(draft, target, resolvedLayers);
  const system = (position: number, count: number): string => {
    const ignored = Boolean(draft.systemColorLayerIgnored);
    return `<div class="theme-layer-row is-system ${ignored ? 'is-hidden' : ''}" data-theme-layer-row="global:${SYSTEM_ID}" data-theme-layer-key="global:${SYSTEM_ID}" data-theme-layer-id="${SYSTEM_ID}">
    <span class="theme-layer-swatch is-system" aria-hidden="true">🎨</span>
    <span class="theme-layer-row-text"><strong class="theme-layer-row-name">系统颜色层</strong><small class="theme-layer-row-desc">主题色系统 · 不可删除 · ${ignored ? '已忽略' : '显示中'}</small></span>
    <span class="theme-layer-row-actions"><button type="button" class="theme-layer-icon-button" data-theme-layer-system-toggle ${active ? '' : 'disabled'} title="${ignored ? '显示' : '忽略'}" aria-label="${ignored ? '显示' : '忽略'}系统颜色层">${ignored ? '👁' : '🙈'}</button><button type="button" class="theme-layer-icon-button" data-theme-layer-move="${SYSTEM_ID}" data-direction="up" ${!active || position <= 0 ? 'disabled' : ''} title="上移" aria-label="上移系统颜色层">↑</button><button type="button" class="theme-layer-icon-button" data-theme-layer-move="${SYSTEM_ID}" data-direction="down" ${!active || position >= count - 1 ? 'disabled' : ''} title="下移" aria-label="下移系统颜色层">↓</button></span>
  </div>`;
  };
  const userCount = entries.filter(entry => !entry.system).length;
  if (!userCount) {
    const systemEntry = entries.findIndex(entry => entry.system);
    return `${systemEntry >= 0 ? system(systemEntry, entries.length) : ''}<div class="theme-layer-empty"><strong>${local ? '本目标有本地图层，但当前为空' : '当前没有本地图层'}</strong><small>${local ? '运行时将回退到父级或系统表现。' : '当前回退到父级或系统表现。'}</small></div>`;
  }
  return `${!local ? '<p class="theme-layer-fallback-note">以下为当前有效回退图层；第一次修改时才建立本地覆盖。</p>' : ''}${entries.map((entry, index) => entry.system ? system(index, entries.length) : renderLayerRow(ctx, target, entry.layer, index, entries.length, entry.sourceIndex)).join('')}`;
}

export function renderLayerManagerShell(ctx: UIContext, draft: UserThemeDraft, active: boolean, initialTarget: ThemeLayerTargetRef | null = null, resolvedLayers: readonly BackgroundLayerDef[] = []): string {
  return `<section class="theme-layer-manager" data-theme-layer-manager-shell hidden aria-label="图层管理器">
    <header class="theme-layer-manager-header" data-theme-layer-manager-header><span class="theme-layer-manager-heading"><strong data-theme-layer-manager-title>${initialTarget ? esc(ctx, themeLayerTargetLabel(initialTarget)) : '选择表现目标'}</strong><small data-theme-layer-manager-source>${initialTarget && hasLocalTarget(draft, initialTarget) ? '当前目标的本地覆盖' : '只读解析；实际修改才建立本地覆盖'}</small></span><button type="button" class="theme-layer-icon-button" data-theme-layer-manager-close title="关闭图层管理器" aria-label="关闭图层管理器">×</button></header>
    <div class="theme-layer-manager-toolbar"><button type="button" data-theme-layer-add ${active ? '' : 'disabled'} title="新增图层">＋ 新增</button><button type="button" data-theme-layer-revert ${active ? '' : 'disabled'} title="清除当前目标的本地覆盖">↺ 清除覆盖</button></div>
    <div class="theme-layer-manager-list" data-theme-layer-manager-list>${renderLayerManagerList(ctx, draft, initialTarget, active, resolvedLayers)}</div>
  </section>`;
}

export function renderLayerEditorDialogShell(active: boolean): string {
  return `<section class="theme-layer-editor-dialog" data-theme-layer-editor-dialog hidden role="dialog" aria-modal="true" aria-label="图层编辑"><header class="theme-layer-editor-dialog-head" data-theme-layer-dialog-handle><strong data-theme-layer-dialog-title>编辑图层</strong><button type="button" class="theme-layer-icon-button" data-theme-layer-dialog-close aria-label="关闭图层编辑" title="关闭">×</button></header><div class="theme-layer-editor-form" data-theme-layer-editor-form></div><footer class="theme-layer-editor-dialog-foot"><button type="button" data-theme-layer-dialog-cancel>取消</button><button type="button" class="primary-button" data-theme-layer-dialog-save ${active ? '' : 'disabled'}>保存</button></footer></section>`;
}

export function renderLayerEditorForm(ctx: UIContext, layer: BackgroundLayerDef, active: boolean): string {
  const disabled = active ? '' : 'disabled';
  const parsed = layer.kind === 'gradient' ? parseGradient(layer.value) : undefined;
  const gradient = parsed ?? { type: 'linear', direction: '135deg', stops: [{ color: '#6b8cff' }, { color: '#dbeafe' }] } as ParsedGradient;
  const radial = gradient.type === 'radial' || gradient.type === 'repeating-radial';
  const headerFields = radial
    ? `<label>形状 <select data-theme-layer-dialog-field="gradientShape" ${disabled}><option value="circle" ${gradient.shape === 'circle' ? 'selected' : ''}>circle</option><option value="ellipse" ${gradient.shape === 'ellipse' ? 'selected' : ''}>ellipse</option></select></label><label>中心 X <input type="text" data-theme-layer-dialog-field="gradientCenterX" value="${esc(ctx, gradient.centerX ?? '50%')}" ${disabled}></label><label>中心 Y <input type="text" data-theme-layer-dialog-field="gradientCenterY" value="${esc(ctx, gradient.centerY ?? '50%')}" ${disabled}></label>`
    : `<label>方向 <input type="text" data-theme-layer-dialog-field="gradientAngle" value="${esc(ctx, gradient.direction ?? '135deg')}" ${disabled}></label>`;
  const stopFields = gradient.stops.map((stop, index) => `<div class="user-theme-gradient-stop"><label>色标 ${index + 1} <input type="text" data-theme-layer-dialog-field="${index === 0 ? 'gradientStart' : index === gradient.stops.length - 1 ? 'gradientEnd' : 'gradientStopColor'}" data-theme-layer-gradient-index="${index}" value="${esc(ctx, stop.color)}" ${disabled}></label><label>位置 <input type="text" data-theme-layer-dialog-field="gradientStopPosition" data-theme-layer-gradient-index="${index}" value="${esc(ctx, stop.position ?? '')}" placeholder="自动" ${disabled}></label></div>`).join('');
  const gradientFields = parsed ? `${headerFields}${stopFields}` : '<small>无法结构化解析；仅保留原始 CSS 值。</small>';
  const value = layer.kind === 'solid' ? `<div class="user-theme-solid-color"><label>CSS 颜色 <input type="text" data-theme-layer-dialog-field="value" value="${esc(ctx, layer.value)}" ${disabled}></label><input type="color" data-theme-layer-dialog-field="color" value="${colorInputValue(layer.value, '#6b8cff')}" ${disabled}></div>` : layer.kind === 'gradient' ? `<div class="user-theme-gradient-colors"><label>CSS 渐变值 <input type="text" data-theme-layer-dialog-field="value" value="${esc(ctx, layer.value)}" ${disabled}></label>${gradientFields}</div>` : layer.kind === 'image' ? `<select data-theme-layer-dialog-field="value" ${disabled}><option value="">选择图片资源</option>${(ctx.game.pics.list?.() ?? []).map(pic => `<option value="${esc(ctx, pic.id)}" ${pic.id === layer.value ? 'selected' : ''}>${esc(ctx, pic.label ?? pic.id)}</option>`).join('')}</select>` : '<small>切换类型后设置视觉值。</small>';
  return `<label class="user-theme-field"><span>名称 / ID</span><input type="text" data-theme-layer-dialog-field="id" value="${esc(ctx, layer.id ?? '')}" ${disabled}></label><label class="user-theme-field"><span>表现类型</span><select data-theme-layer-dialog-field="kind" ${disabled}>${Object.entries(KIND_LABELS).map(([kind, label]) => `<option value="${kind}" ${layer.kind === kind ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="user-theme-field"><span>视觉值</span>${value}</label><div class="user-theme-number-row"><label>透明度 <input type="number" min="0" max="1" step="0.05" data-theme-layer-dialog-field="opacity" value="${layer.opacity ?? 1}" ${disabled}></label><label>缩放 <input type="number" min="0.05" max="8" step="0.05" data-theme-layer-dialog-field="scale" value="${layer.scale ?? 1}" ${disabled}></label></div><div class="user-theme-number-row"><label>定位 <input type="text" data-theme-layer-dialog-field="position" value="${esc(ctx, layer.position ?? 'center')}" ${disabled}></label><label>尺寸 <input type="text" data-theme-layer-dialog-field="size" value="${esc(ctx, layer.size ?? 'cover')}" ${disabled}></label></div><div class="user-theme-number-row"><label>重复 <select data-theme-layer-dialog-field="repeat" ${disabled}>${['repeat','repeat-x','repeat-y','no-repeat','space','round'].map(value => `<option value="${value}" ${layer.repeat === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>混合 <select data-theme-layer-dialog-field="blendMode" ${disabled}>${['normal','multiply','screen','overlay','soft-light','hard-light','color-dodge','color-burn','darken','lighten'].map(value => `<option value="${value}" ${(layer.blendMode ?? 'normal') === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="user-theme-number-row"><label>附着 <select data-theme-layer-dialog-field="attachment" ${disabled}>${['scroll','fixed','local'].map(value => `<option value="${value}" ${(layer.attachment ?? 'fixed') === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>旋转 <input type="number" min="-360" max="360" step="1" data-theme-layer-dialog-field="rotation" value="${layer.rotation ?? 0}" ${disabled}></label></div><label class="user-theme-enabled"><input type="checkbox" data-theme-layer-dialog-field="enabled" ${layer.enabled !== false ? 'checked' : ''} ${disabled}>参与渲染</label>`;
}
