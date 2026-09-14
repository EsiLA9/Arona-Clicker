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
import { parseGradient, type GradientFunction, type GradientStop } from '../theme-layer-value';
import { LAYER_ATTACHMENT_VALUES, LAYER_BLEND_VALUES, LAYER_REPEAT_VALUES } from '../layer-css-safety';

const SYSTEM_ID = 'system-color-background';
const KIND_LABELS: Record<BackgroundLayerDef['kind'], string> = { empty: '空层', solid: '纯色', gradient: '渐变', image: '图片' };
const STATE_LABELS: Record<PresentationHostState, string> = { default: '默认', active: '激活', inactive: '未激活', disabled: '禁用' };
const SWATCH_VALUE_PATTERN = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\([^;<>]+\)|var\(--[a-z0-9-]+(?:\s*,\s*[^;<>]+)?\))$/i;

function esc(ctx: UIContext, value: string | undefined): string { const text = value ?? ''; return typeof ctx.escapeHtml === 'function' ? ctx.escapeHtml(text) : text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)); }

export function colorInputValue(value: string, fallback: string): string {
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

const GRADIENT_TYPE_LABELS: Record<GradientFunction, string> = {
  linear: '线性渐变',
  radial: '径向渐变',
  'repeating-linear': '重复线性渐变',
  'repeating-radial': '重复径向渐变',
};

const VALUE_SECTION_TITLES: Record<BackgroundLayerDef['kind'], string> = { empty: '空层', solid: '纯色', gradient: '渐变', image: '图片' };

const VALUE_SECTION_HINTS: Record<BackgroundLayerDef['kind'], string> = {
  empty: '不渲染任何内容',
  solid: '一个 CSS 颜色',
  gradient: '方向 / 中心与色标',
  image: '从资源库选择图片',
};

const POSITION_PRESETS: ReadonlyArray<readonly [string, string]> = [
  ['center', '居中'], ['top', '顶部'], ['bottom', '底部'], ['left', '左侧'], ['right', '右侧'],
  ['top left', '左上'], ['top right', '右上'], ['bottom left', '左下'], ['bottom right', '右下'], ['78% 18%', '百分比组合'],
];

const SIZE_PRESETS: ReadonlyArray<readonly [string, string]> = [
  ['cover', '铺满 cover'], ['contain', '完整显示 contain'], ['auto', '原始大小 auto'],
  ['100% 100%', '拉伸铺满'], ['auto 92%', '高度 92%'],
];

const DIRECTION_PRESETS: ReadonlyArray<readonly [string, string]> = [
  ['to top', '向上'], ['to top right', '右上'], ['to right', '向右'], ['to bottom right', '右下'],
  ['to bottom', '向下'], ['to bottom left', '左下'], ['to left', '向左'], ['to top left', '左上'],
  ['0deg', '0°'], ['45deg', '45°'], ['90deg', '90°'], ['135deg', '135°'], ['180deg', '180°'], ['225deg', '225°'], ['270deg', '270°'], ['315deg', '315°'],
];

const CENTER_PRESETS: ReadonlyArray<readonly [string, string]> = [
  ['0%', '0%'], ['18%', '18%'], ['25%', '25%'], ['50%', '50%'], ['75%', '75%'], ['78%', '78%'], ['100%', '100%'],
];

const RADIAL_SHAPE_PRESETS: ReadonlyArray<readonly [string, string]> = [['circle', '圆形 circle'], ['ellipse', '椭圆 ellipse']];

const RADIAL_SIZE_VALUES: readonly string[] = ['', 'closest-side', 'farthest-side', 'closest-corner', 'farthest-corner'];
const RADIAL_SIZE_LABELS: Record<string, string> = {
  '': '默认 farthest-corner',
  'closest-side': 'closest-side',
  'farthest-side': 'farthest-side',
  'closest-corner': 'closest-corner',
  'farthest-corner': 'farthest-corner',
};

const REPEAT_LABELS: Record<string, string> = {
  repeat: '平铺 repeat',
  'repeat-x': '横向 repeat-x',
  'repeat-y': '纵向 repeat-y',
  'no-repeat': '不平铺 no-repeat',
  space: '等距留白 space',
  round: '缩放平铺 round',
};

const BLEND_LABELS: Record<string, string> = {
  normal: '正常 normal',
  multiply: '正片叠底 multiply',
  screen: '滤色 screen',
  overlay: '叠加 overlay',
  'soft-light': '柔光 soft-light',
  'hard-light': '强光 hard-light',
  'color-dodge': '颜色减淡 color-dodge',
  'color-burn': '颜色加深 color-burn',
  darken: '变暗 darken',
  lighten: '变亮 lighten',
};

const ATTACHMENT_LABELS: Record<string, string> = {
  fixed: '固定视口 fixed',
  scroll: '随容器滚动 scroll',
  local: '随内容滚动 local',
};

/** 下拉选项：当前值不在白名单时保留它并在标签里说明，避免面板显示与实际存储不一致。 */
function optionEntries(values: readonly string[], labels: Record<string, string>, current: string | undefined, note: string): Array<[string, string]> {
  const entries: Array<[string, string]> = values.map(value => [value, labels[value] ?? value]);
  if (current && !values.includes(current)) entries.unshift([current, `${current}（${note}）`]);
  return entries;
}

/** 单个色标行：颜色拾取器为主，文本值与位置作为补充入口。 */
function renderGradientStopRow(ctx: UIContext, stop: GradientStop, index: number, count: number, disabled: string): string {
  const colorKey = index === 0 ? 'gradientStart' : index === count - 1 ? 'gradientEnd' : 'gradientStopColor';
  const label = index === 0 ? '起始色' : index === count - 1 ? '结束色' : `色标 ${index + 1}`;
  return `<div class="theme-layer-gradient-stop" data-theme-layer-gradient-stop data-theme-layer-gradient-index="${index}">
    <span class="theme-layer-gradient-stop-label">${label}</span>
    <input type="color" data-theme-layer-stop-pick data-theme-layer-dialog-field="gradientStopPick" data-theme-layer-gradient-index="${index}" value="${colorInputValue(stop.color, '#6b8cff')}" title="选择颜色" aria-label="选择${label}颜色" ${disabled}>
    <input type="text" data-theme-layer-stop-color data-theme-layer-dialog-field="${colorKey}" data-theme-layer-gradient-index="${index}" value="${esc(ctx, stop.color)}" placeholder="#6b8cff / transparent" ${disabled}>
    <input type="text" data-theme-layer-dialog-field="gradientStopPosition" data-theme-layer-gradient-index="${index}" value="${esc(ctx, stop.position ?? '')}" placeholder="留空=自动" title="可填 0%-100%、px、em、rem；留空表示由浏览器自动分布" ${disabled}>
    <button type="button" class="theme-layer-icon-button is-danger" data-theme-layer-stop-remove="${index}" title="删除色标" aria-label="删除${label}" ${count <= 2 || disabled ? 'disabled' : ''}>🗑</button>
  </div>`;
}

export function renderLayerEditorDialogShell(active: boolean): string {
  return `<section class="theme-layer-editor-dialog" data-theme-layer-editor-dialog hidden role="dialog" aria-modal="true" aria-label="图层编辑"><header class="theme-layer-editor-dialog-head" data-theme-layer-dialog-handle><strong data-theme-layer-dialog-title>编辑图层</strong><button type="button" class="theme-layer-icon-button" data-theme-layer-dialog-close aria-label="关闭图层编辑" title="关闭">×</button></header><div class="theme-layer-editor-form" data-theme-layer-editor-form></div><footer class="theme-layer-editor-dialog-foot"><button type="button" data-theme-layer-dialog-cancel>取消</button><button type="button" class="primary-button" data-theme-layer-dialog-save ${active ? '' : 'disabled'}>保存</button></footer></section>`;
}

export function renderLayerEditorForm(ctx: UIContext, layer: BackgroundLayerDef, active: boolean): string {
  const disabled = active ? '' : 'disabled';
  const kind = layer.kind;
  const parsed = kind === 'gradient' ? parseGradient(layer.value) : undefined;
  const gradientType = parsed?.type ?? 'linear';
  const radial = gradientType === 'radial' || gradientType === 'repeating-radial';
  const stops = parsed?.stops ?? [];

  const field = (label: string, control: string): string => `<label class="user-theme-field"><span>${label}</span>${control}</label>`;
  const section = (id: string, title: string, hint: string, body: string): string => `<div class="theme-layer-form-section" data-theme-layer-form-section="${id}"><header class="theme-layer-form-section-head"><strong>${title}</strong><small>${esc(ctx, hint)}</small></header>${body}</div>`;
  const select = (key: string, value: string, options: ReadonlyArray<readonly [string, string]>): string => `<select data-theme-layer-dialog-field="${key}" ${disabled}>${options.map(([optionValue, label]) => `<option value="${esc(ctx, optionValue)}"${optionValue === value ? ' selected' : ''}>${esc(ctx, label)}</option>`).join('')}</select>`;
  const preset = (key: string, value: string, id: string, options: ReadonlyArray<readonly [string, string]>, placeholder: string): string => `<input type="text" list="${id}" data-theme-layer-dialog-field="${key}" value="${esc(ctx, value)}" placeholder="${esc(ctx, placeholder)}" ${disabled}><datalist id="${id}">${options.map(([optionValue, label]) => `<option value="${esc(ctx, optionValue)}" label="${esc(ctx, label)}"></option>`).join('')}</datalist>`;
  const advanced = (control: string, hint: string): string => `<details class="theme-layer-advanced"><summary>高级：原始 CSS 值</summary>${field('CSS 值', control)}<small class="theme-layer-form-note">${esc(ctx, hint)}</small></details>`;
  const imageEntries = (current: string): Array<[string, string]> => {
    const pics = ctx.game.pics.list?.() ?? [];
    const entries: Array<[string, string]> = [['', '选择图片资源'], ...pics.map(pic => [pic.id, pic.label ?? pic.id] as [string, string])];
    if (current && !pics.some(pic => pic.id === current)) entries.push([current, `${current}（资源不存在）`]);
    return entries;
  };

  const basic = section('basic', '基本信息', KIND_LABELS[kind], `${field('名称 / ID', `<input type="text" data-theme-layer-dialog-field="id" value="${esc(ctx, layer.id ?? '')}" placeholder="留空则自动生成" ${disabled}>`)}${field('表现类型', select('kind', kind, Object.entries(KIND_LABELS)))}`);
  const plainColor = /^#[0-9a-f]{3,8}$/i.test(layer.value.trim());
  const valueBody = kind === 'solid'
    ? `<input type="color" class="theme-layer-color-picker" data-theme-layer-dialog-field="color" value="${colorInputValue(layer.value, '#6b8cff')}" ${disabled}>${plainColor ? '' : '<small class="theme-layer-form-note">当前是变量或高级颜色值，使用拾取器会替换为所选颜色。</small>'}${advanced(`<input type="text" data-theme-layer-dialog-field="value" value="${esc(ctx, layer.value)}" placeholder="#6b8cff" ${disabled}>`, '支持 #RGB / #RRGGBBAA / rgb() / hsl() / var(--token)；渐变请改用渐变类型。')}`
    : kind === 'gradient'
      ? parsed
        ? [
          field('渐变类型', select('gradientType', gradientType, Object.entries(GRADIENT_TYPE_LABELS))),
          field(radial ? '形状' : '方向', radial
            ? select('gradientShape', parsed.shape ?? 'circle', RADIAL_SHAPE_PRESETS)
            : preset('gradientAngle', parsed.direction ?? '135deg', 'theme-layer-dialog-direction', DIRECTION_PRESETS, '如 135deg / to bottom')),
          radial ? field('径向尺寸', select('gradientSize', parsed.size ?? '', optionEntries(RADIAL_SIZE_VALUES, RADIAL_SIZE_LABELS, parsed.size, '当前值'))) : '',
          radial ? `<div class="user-theme-number-row"><label>中心 X ${preset('gradientCenterX', parsed.centerX ?? '50%', 'theme-layer-dialog-center-x', CENTER_PRESETS, '如 78%')}</label><label>中心 Y ${preset('gradientCenterY', parsed.centerY ?? '50%', 'theme-layer-dialog-center-y', CENTER_PRESETS, '如 18%')}</label></div>` : '',
          `<div class="theme-layer-gradient-stop-list">${stops.map((stop, index) => renderGradientStopRow(ctx, stop, index, stops.length, disabled)).join('')}</div>`,
          `<div class="theme-layer-gradient-tools"><button type="button" class="theme-layer-stop-add" data-theme-layer-stop-add ${disabled}>＋ 添加色标</button><span class="theme-layer-gradient-preview" style="background:${esc(ctx, layer.value)}" aria-hidden="true"></span></div>`,
          advanced(`<input type="text" data-theme-layer-dialog-field="value" value="${esc(ctx, layer.value)}" placeholder="linear-gradient(135deg, #6b8cff, #dbeafe)" ${disabled}>`, '仅在面板无法表达时使用，保存时按原样写回。'),
        ].filter(Boolean).join('')
        : `<small class="theme-layer-form-note">该渐变无法结构化解析，请通过高级原始值修改。</small>${advanced(`<input type="text" data-theme-layer-dialog-field="value" value="${esc(ctx, layer.value)}" ${disabled}>`, '面板不会改写无法解析的值。')}`
      : kind === 'image'
        ? field('图片资源', select('value', layer.value, imageEntries(layer.value)))
        : '<small class="theme-layer-form-note">空层不产生视觉输出；切换表现类型后可设置颜色、渐变或图片。</small>';

  const geometry = section('geometry', '尺寸与位置', '图层通用参数', `<div class="user-theme-number-row"><label>透明度 <input type="number" min="0" max="1" step="0.05" data-theme-layer-dialog-field="opacity" value="${layer.opacity ?? 1}" title="0 - 1；越界值保存时会被夹紧" ${disabled}></label><label>缩放 <input type="number" min="0.05" max="8" step="0.05" data-theme-layer-dialog-field="scale" value="${layer.scale ?? 1}" title="0.05 - 8；越界值保存时会被夹紧" ${disabled}></label></div>${field('定位', preset('position', layer.position ?? 'center', 'theme-layer-dialog-position', POSITION_PRESETS, '如 center / 78% 18%'))}${field('尺寸', preset('size', layer.size ?? 'cover', 'theme-layer-dialog-size', SIZE_PRESETS, '如 cover / auto 92%'))}`);
  const compositing = section('render', '混合与附着', '与其它背景层的合成方式', `<div class="user-theme-number-row"><label>重复 ${select('repeat', layer.repeat ?? 'no-repeat', optionEntries(LAYER_REPEAT_VALUES, REPEAT_LABELS, layer.repeat, '当前值不可用'))}</label><label>混合 ${select('blendMode', layer.blendMode ?? 'normal', optionEntries(LAYER_BLEND_VALUES, BLEND_LABELS, layer.blendMode, '当前值不可用'))}</label></div><div class="user-theme-number-row"><label>附着 ${select('attachment', layer.attachment ?? 'fixed', optionEntries(LAYER_ATTACHMENT_VALUES, ATTACHMENT_LABELS, layer.attachment, '当前值不可用'))}</label><label>旋转 <input type="number" min="-360" max="360" step="1" data-theme-layer-dialog-field="rotation" value="${layer.rotation ?? 0}" title="-360 - 360 度；越界值保存时会被夹紧" ${disabled}></label></div><label class="user-theme-enabled"><input type="checkbox" data-theme-layer-dialog-field="enabled" ${layer.enabled !== false ? 'checked' : ''} ${disabled}>参与渲染</label>`);

  return `${basic}${section('value', VALUE_SECTION_TITLES[kind], VALUE_SECTION_HINTS[kind], valueBody)}${geometry}${compositing}`;
}
