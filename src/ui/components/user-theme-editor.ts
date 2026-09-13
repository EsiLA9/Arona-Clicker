import type { UIContext } from '../context';
import type { UserThemeEditSession } from '../../arona-clicker/services/user-theme-service';
import type { UserThemeDraft } from '../../arona-clicker/types/user-theme';
import type { UserThemeToken } from '../../arona-clicker/types/user-theme';
import type { BackgroundLayerDef, ComponentPlacementDef, PresentationDecorationDef, PresentationHostDef, PresentationHostState, PresentationHostStateDef, PresentationRegion } from '../../engine/types/theme';
import type { ThemeNodeName } from '../../engine/types/theme';
import { getPresentationTargets, presentationTargetForLegacyRegion, type PresentationTargetLevel } from '../presentation-targets';
import { getTargetLayers, type ThemeLayerTargetRef } from '../../arona-clicker/services/user-theme-layer-service';
import { renderLayerManagerShell } from './user-theme-layer-manager';
import {
  CORNER_RADIUS_MAX,
  CORNER_RADIUS_MIN,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_PARALLELOGRAM_SKEW_X_DEG,
  DEFAULT_PANEL_OPACITY,
  SKEW_X_DEG_MAX,
  SKEW_X_DEG_MIN,
} from '../presentation-config';

const TOKENS: readonly UserThemeToken[] = ['primary', 'primaryStrong', 'bg', 'bgAlt', 'panel', 'panelAlt', 'text', 'muted', 'accent', 'danger'];
const PALETTE_SIZE = 6;
const NODE_FIELDS: readonly ThemeNodeName[] = ['active', 'highlight', 'success', 'warning', 'danger', 'playerBubble', 'npcBubble'];
const SCOPE_FIELDS = ['left', 'left.area', 'left.contacts', 'left.story', 'center', 'center.chat', 'center.log', 'center.conversation', 'right', 'right.spot', 'right.character', 'right.enh', 'right.other'] as const;
const SCOPE_LABELS: Record<string, string> = { left: '左侧栏', 'left.area': '左侧 · 区域', 'left.contacts': '左侧 · 通讯录', 'left.story': '左侧 · 故事', center: '中部栏', 'center.chat': '中部 · 聊天', 'center.log': '中部 · 日志', 'center.conversation': '中部 · 对话', right: '右侧栏', 'right.spot': '右侧 · Spot', 'right.character': '右侧 · 角色', 'right.enh': '右侧 · 强化', 'right.other': '右侧 · 其他' };
const SCOPE_NODE_FIELDS: Record<typeof SCOPE_FIELDS[number], readonly ThemeNodeName[]> = {
  left: ['active', 'highlight', 'success', 'warning', 'danger'],
  'left.area': ['active', 'highlight', 'success', 'warning', 'danger'],
  'left.contacts': ['active', 'highlight', 'success', 'warning', 'danger'],
  'left.story': ['active', 'highlight', 'success', 'warning', 'danger'],
  center: ['active', 'highlight', 'success', 'warning', 'danger'],
  'center.chat': ['active', 'highlight', 'success', 'warning', 'danger', 'playerBubble', 'npcBubble'],
  'center.log': ['active', 'highlight', 'success', 'warning', 'danger'],
  'center.conversation': ['active', 'highlight', 'success', 'warning', 'danger', 'playerBubble', 'npcBubble'],
  right: ['active', 'highlight', 'success', 'warning', 'danger'],
  'right.spot': ['active', 'highlight', 'success', 'warning', 'danger'],
  'right.character': ['active', 'highlight', 'success', 'warning', 'danger'],
  'right.enh': ['active', 'highlight', 'success', 'warning', 'danger'],
  'right.other': ['active', 'highlight', 'success', 'warning', 'danger'],
};

export function scopeNodesFor(scope: string): readonly ThemeNodeName[] {
  return SCOPE_NODE_FIELDS[scope as typeof SCOPE_FIELDS[number]] ?? [];
}
const NODE_LABELS: Record<ThemeNodeName, string> = { primary: '主色', primaryStrong: '强化主色', bg: '背景', bgAlt: '辅助背景', panel: '面板', panelLight: '浅色面板', text: '正文', muted: '弱文本', line: '边框', active: '激活', highlight: '高亮', success: '成功', warning: '警告', danger: '危险', accent: '点缀', playerBubble: '玩家气泡', npcBubble: 'NPC 气泡' };
const TOKEN_LABELS: Record<UserThemeToken, string> = { primary: '主色', primaryStrong: '强调主色', bg: '背景', bgAlt: '背景辅助', panel: '面板', panelAlt: '面板辅助', text: '正文', muted: '弱文本', accent: '点缀', danger: '警告' };
const REGIONS: readonly PresentationRegion[] = ['shell', 'header', 'leftPanel', 'centerPanel', 'rightPanel', 'footer', 'story', 'modal'];
const REGION_LABELS: Record<PresentationRegion, string> = { shell: '整体', header: '顶部栏', leftPanel: '左侧栏', centerPanel: '中部信息栏', rightPanel: '右侧栏', footer: '底部栏', story: '剧情区', modal: '弹窗' };
const PANEL_REGIONS = ['leftPanel', 'centerPanel', 'rightPanel'] as const;
const PANEL_LABELS: Record<typeof PANEL_REGIONS[number], string> = { leftPanel: '左侧栏', centerPanel: '中部栏', rightPanel: '右侧栏' };
const ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const;
const hostStateForRender = new Map<string, PresentationHostState>();

export function setPresentationHostState(hostId: string, state: PresentationHostState): void {
  hostStateForRender.set(hostId, state);
}

const NODE_DEFAULT_SOURCE: Partial<Record<ThemeNodeName, string>> = {
  active: '主题色 2（无色时回退主题色 1）',
  highlight: '主题色 3（不足时向前回退）',
  success: '主题色 5（不足时向前回退）',
  warning: '主题色 6（不足时向前回退）',
  danger: '主题色 6（不足时向前回退）',
  playerBubble: '主题色 1',
  npcBubble: '主题色 2（无色时回退主题色 1）',
};

export function tokenSource(token: UserThemeToken, draft: UserThemeDraft): string {
  if (draft.tokens?.[token]) return '用户覆盖';
  return tokenFallbackSource(token);
}

export function tokenFallbackSource(token: UserThemeToken): string {
  const defaults: Record<UserThemeToken, string> = {
    primary: '主题色 1', primaryStrong: '主题色 1（强化派生）', bg: '主题色 1（浅色背景派生）',
    bgAlt: '主题色 2（无色时回退主题色 1）', panel: '主题色 1（面板派生）', panelAlt: '主题色 2（无色时回退主题色 1）',
    text: '主题默认文字色', muted: '主题默认弱文字色', accent: '主题色 2（无色时回退主题色 1）', danger: '系统危险色默认值',
  };
  return defaults[token];
}

export function nodeSource(node: ThemeNodeName, draft: UserThemeDraft): string {
  return draft.nodes?.[node] ? '用户覆盖' : nodeFallbackSource(node);
}

export function nodeFallbackSource(node: ThemeNodeName): string {
  return NODE_DEFAULT_SOURCE[node] ?? '主题默认值';
}

export function scopeSource(scope: string, node: ThemeNodeName, draft: UserThemeDraft): string {
  if (draft.scopes?.[scope]?.[node]) return '用户覆盖';
  return scopeFallbackSource(scope);
}

export function scopeFallbackSource(scope: string): string {
  const parent = scope.includes('.') ? scope.slice(0, scope.lastIndexOf('.')) : '根主题';
  return `继承${parent === '根主题' ? '根主题节点' : `${SCOPE_LABELS[parent] ?? parent}节点`}`;
}

export function renderUserThemeEditor(ctx: UIContext, session: UserThemeEditSession, active: boolean, sources: readonly string[]): string {
  const draft = session.draft;
  const presentation = draft.presentation ?? { layers: [], components: [], hosts: [] };
  const components = presentation.components ?? [];
  const sourceValue = (value: string | undefined, source: string, fallback: string): string => `<code>当前：${ctx.escapeHtml(value ?? source)} · 清除后：${ctx.escapeHtml(fallback)}</code>`;
  return `<div class="user-theme-editor ${active ? '' : 'is-readonly'}" data-user-theme-session="${ctx.escapeHtml(session.id)}" data-theme-editor-current-section="colors" data-theme-editor-current-filter="all">
    <div class="user-theme-editor-status ${active ? 'is-active' : 'is-locked'}"><span class="status-dot"></span><span>${active ? '编辑权限：已开放' : '编辑器只读'}</span><small>${active ? `能力来源 ${sources.length} 个 · 实时预览中` : '需要 Active Affector 提供 user-theme.editor'}</small><div class="user-theme-mode-switch" role="tablist" aria-label="编辑内容类型"><button class="user-theme-mode-item is-active" type="button" role="tab" aria-selected="true" data-theme-editor-section="colors">颜色</button><button class="user-theme-mode-item" type="button" role="tab" aria-selected="false" data-theme-editor-section="layers">控件背景图层</button><button class="user-theme-mode-item" type="button" role="tab" aria-selected="false" data-theme-editor-section="components">其他内容</button></div></div>
    ${renderThemeOverview(ctx, draft, presentation, active)}
    <div class="user-theme-workspace">
      <aside class="user-theme-nav" aria-label="语义筛选器"><div class="user-theme-filter-head">当前内容</div><div data-theme-editor-filter-group="colors"><button class="user-theme-nav-item is-active" type="button" data-theme-editor-filter="all">全部颜色</button><button class="user-theme-nav-item" type="button" data-theme-editor-filter="palette">主题色</button><button class="user-theme-nav-item" type="button" data-theme-editor-filter="semantic">基础与状态语义</button><button class="user-theme-nav-item" type="button" data-theme-editor-filter="scope">作用范围</button></div><div data-theme-editor-filter-group="layers" hidden><button class="user-theme-nav-item is-active" type="button" data-theme-editor-filter="all">全部表现目标</button><button class="user-theme-nav-item" type="button" data-theme-editor-filter="background">外部背景</button><button class="user-theme-nav-item" type="button" data-theme-editor-filter="cluster">簇与区域</button><button class="user-theme-nav-item" type="button" data-theme-editor-filter="control">控件</button></div><div data-theme-editor-filter-group="components" hidden><button class="user-theme-nav-item is-active" type="button" data-theme-editor-filter="all">全部其他内容</button><button class="user-theme-nav-item" type="button" data-theme-editor-filter="placement">组件定位</button></div></aside>
      <aside class="user-theme-inspector"><section data-theme-editor-panel="colors"><div class="user-theme-section-head"><strong>颜色系统</strong><small>第 1 色默认启用；空色槽不参与 UI</small></div><div class="user-theme-palette-grid">${Array.from({ length: PALETTE_SIZE }, (_, index) => { const color = draft.palette?.[index]; const hasColor = Boolean(color); const uiEnabled = draft.paletteUiEnabled?.[index] !== false; return `<label class="user-theme-token"><span>主题色 ${index + 1}</span><input type="color" data-user-theme-palette="${index}" value="${colorValue(color)}" ${active && hasColor ? '' : 'disabled'}><button type="button" class="user-theme-token-clear" data-user-theme-palette-clear="${index}" ${active && hasColor ? '' : 'disabled'}>清空</button><button type="button" class="user-theme-palette-enable" data-user-theme-palette-enable="${index}" ${active ? '' : 'disabled'}>${hasColor ? (uiEnabled ? '参与 UI' : '仅头像') : '添加颜色'}</button><code>${ctx.escapeHtml(color ?? '无色')}</code></label>`; }).join('')}</div><div class="user-theme-token-grid">${TOKENS.map(token => `<label class="user-theme-token"><span>${TOKEN_LABELS[token]}</span><input type="color" data-user-theme-token="${token}" value="${colorValue(draft.tokens?.[token])}" ${active ? '' : 'disabled'}><button type="button" class="user-theme-token-clear" data-user-theme-token-clear="${token}" ${active ? '' : 'disabled'}>清空</button>${sourceValue(draft.tokens?.[token], tokenSource(token, draft), tokenFallbackSource(token))}</label>`).join('')}</div><div class="user-theme-section-head"><strong>语义节点覆盖</strong><small>清空后使用对应的主题色优先级</small></div><div class="user-theme-token-grid">${NODE_FIELDS.map(node => `<label class="user-theme-token"><span>${NODE_LABELS[node]}</span><input type="color" data-user-theme-node="${node}" value="${colorValue(draft.nodes?.[node])}" ${active ? '' : 'disabled'}><button type="button" class="user-theme-token-clear" data-user-theme-node-clear="${node}" ${active ? '' : 'disabled'}>清空</button>${sourceValue(draft.nodes?.[node], nodeSource(node, draft), nodeFallbackSource(node))}</label>`).join('')}</div><div class="user-theme-section-head"><strong>界面簇覆盖</strong><small>子簇未设置时继承父簇；透明度已归入簇宿主</small></div><div class="user-theme-token-grid user-theme-panel-opacity-grid">${PANEL_REGIONS.map(region => { const opacity = presentation.hosts?.find(host => host.id === region)?.opacity ?? DEFAULT_PANEL_OPACITY; return `<label class="user-theme-field"><span>${PANEL_LABELS[region]}背景透明度</span><input type="number" min="0" max="1" step="0.05" data-user-theme-panel-opacity="${region}" value="${opacity}" ${active ? '' : 'disabled'}><small>默认 ${DEFAULT_PANEL_OPACITY}；写入对应簇宿主</small></label>`; }).join('')}</div>${SCOPE_FIELDS.map(scope => `<fieldset class="user-theme-scope"><legend>${SCOPE_LABELS[scope]}</legend><div class="user-theme-token-grid">${NODE_FIELDS.map(node => `<label class="user-theme-token"><span>${NODE_LABELS[node]}</span><input type="color" data-user-theme-scope-node="${scope}" data-user-theme-scope-node-name="${node}" value="${colorValue(draft.scopes?.[scope]?.[node])}" ${active ? '' : 'disabled'}><button type="button" class="user-theme-token-clear" data-user-theme-scope-clear="${scope}" data-user-theme-scope-node-name="${node}" ${active ? '' : 'disabled'}>清空</button>${sourceValue(draft.scopes?.[scope]?.[node], scopeSource(scope, node, draft), scopeFallbackSource(scope))}</label>`).join('')}</div></fieldset>`).join('')}</section><section data-theme-editor-panel="layers" hidden><div class="user-theme-section-head"><strong>表现目标</strong><small>所有背景与控件目标平级管理；当前先显示已配置目标</small></div><div class="user-theme-target-summary">${renderTargetSummary(ctx, draft, presentation)}</div><details class="user-theme-target-card user-theme-global-card" open><summary><span>全局背景</span><span class="user-theme-target-card-actions"><small>外部背景</small></span></summary><div class="user-theme-target-meta">系统颜色层与用户背景图层，仅作用于最外部背景</div>${renderBackgroundLayers(ctx, draft.background ?? [], active)}</details><button type="button" class="user-theme-token-clear user-theme-target-add" data-user-theme-target-add ${active ? '' : 'disabled'}>加入个性化表现目标</button><div class="user-theme-target-picker" data-user-theme-target-picker hidden><div class="user-theme-target-picker-head"><strong>选择表现目标</strong><button type="button" class="user-theme-token-clear" data-user-theme-target-picker-close>关闭</button></div><div class="user-theme-target-levels">${(['cluster', 'region', 'control'] as const).map(level => `<button type="button" class="user-theme-token-clear ${level === 'region' ? 'is-active' : ''}" data-user-theme-target-level="${level}">${level === 'cluster' ? '簇' : level === 'region' ? '区域' : '控件'}</button>`).join('')}</div><div class="user-theme-target-options" data-user-theme-target-options></div></div></section><section data-theme-editor-panel="components" hidden><div class="user-theme-section-head"><strong>组件位置</strong><small>相对父区域定位</small></div>${renderComponents(ctx, components, active)}</section></aside>
    </div><div class="user-theme-editor-error" data-user-theme-error hidden></div>
  </div>`;
}

function renderThemeOverview(ctx: UIContext, draft: UserThemeDraft, presentation: NonNullable<UserThemeDraft['presentation']>, active: boolean): string {
  const paletteCount = (draft.palette ?? []).filter(Boolean).length;
  const overrideCount = Object.keys(draft.tokens ?? {}).length + Object.keys(draft.nodes ?? {}).length;
  const scopeCount = Object.keys(draft.scopes ?? {}).length;
  const hostCount = (presentation.hosts ?? []).length;
  const componentCount = (presentation.components ?? []).length;
  const status = active ? '预览层已启用，修改只作用于当前编辑会话' : '只读预览，当前编辑能力未开放';
  const item = (label: string, value: string, detail: string, filter: string): string => `<button type="button" class="user-theme-overview-card" data-theme-editor-overview-filter="${filter}"><span>${ctx.escapeHtml(label)}</span><strong>${ctx.escapeHtml(value)}</strong><small>${ctx.escapeHtml(detail)}</small></button>`;
  return `<section class="user-theme-overview" aria-label="主题摘要"><div class="user-theme-overview-heading"><strong>主题摘要</strong><small>${ctx.escapeHtml(status)}</small></div><div class="user-theme-overview-grid">${item('主题色', `${paletteCount}/6`, paletteCount ? '已配置色槽' : '使用运行时默认', 'palette')}${item('颜色覆盖', String(overrideCount), overrideCount ? 'Token/语义节点' : '暂无局部覆盖', 'semantic')}${item('作用范围', String(scopeCount), scopeCount ? '已配置作用域' : '跟随根主题', 'scope')}${item('表现目标', String(hostCount), hostCount ? 'Host/簇/区域' : '暂无目标覆盖', 'layers')}${item('组件定位', String(componentCount), componentCount ? '已配置组件' : '暂无组件定位', 'placement')}</div></section>`;
}

function renderBackgroundLayers(ctx: UIContext, layers: readonly BackgroundLayerDef[], active: boolean): string {
  return `<button type="button" class="user-theme-token-clear user-theme-layer-manager-open" data-theme-layer-manager-target-kind="global" ${active ? '' : 'disabled'}>管理图层 <span>${layers.length} 层</span></button>`;
}

function renderTargetSummary(ctx: UIContext, draft: UserThemeDraft, presentation: NonNullable<UserThemeDraft['presentation']>): string {
  const configured = (presentation.hosts ?? []).filter(host => host.id !== 'global');
  const cards = configured.length ? renderHostTargets(ctx, presentation, true) : '<p class="modal-empty">暂无已配置的个性化表现目标。可从下方加入目标。</p>';
  const firstHost = configured[0];
  const initialTarget: ThemeLayerTargetRef = firstHost
    ? { kind: 'host', hostId: firstHost.id, state: hostStateForRender.get(firstHost.id) ?? 'default' }
    : { kind: 'global' };
  return cards + renderLayerManagerShell(ctx, draft, true, initialTarget);
}

export function renderPresentationTargetOptions(ctx: UIContext, draft: UserThemeDraft, level: PresentationTargetLevel): string {
  const configured = new Set<string>(['global']);
  for (const layer of draft.presentation?.layers ?? []) {
    const target = presentationTargetForLegacyRegion(layer.region);
    if (target) configured.add(target.id);
  }
  for (const host of draft.presentation?.hosts ?? []) configured.add(host.id);
  return getPresentationTargets().filter(target => target.id !== 'global' && target.level === level && target.editable !== false && !configured.has(target.id))
    .map(target => `<button type="button" class="user-theme-target-option" data-user-theme-target-option="${ctx.escapeHtml(target.id)}"><strong>${ctx.escapeHtml(target.label)}</strong><small>${target.parent ? `父级：${ctx.escapeHtml(target.parent)}` : '无父级'}</small></button>`).join('') || '<p class="modal-empty">该级别暂无可加入的表现目标。</p>';
}

function renderHostTargets(ctx: UIContext, presentation: NonNullable<UserThemeDraft['presentation']>, active: boolean): string {
  return (presentation.hosts ?? []).map(host => renderHostSummary(ctx, host, active)).join('');
}

function renderDecorationEditor(ctx: UIContext, host: PresentationHostDef, state: PresentationHostState, stateDef: PresentationHostStateDef | undefined, active: boolean): string {
  const current = state === 'default' ? host.decoration : stateDef?.decoration;
  const inherited = state === 'default' ? undefined : host.decoration;
  const display = state === 'default' ? current : (current || inherited ? { ...inherited, ...current } : undefined);
  const hasOverride = current !== undefined;
  const field = (key: keyof PresentationDecorationDef) => `data-user-theme-host-decoration-field="${key}" data-user-theme-host-decoration-id="${ctx.escapeHtml(host.id)}"`;
  const disabled = !active || !hasOverride;
  const source = state === 'default'
    ? hasOverride ? '当前默认态配置' : '未配置'
    : hasOverride ? '当前状态覆盖' : inherited ? '继承默认态' : '未配置';
  return `<fieldset class="user-theme-component user-theme-decoration-editor"><legend>内嵌装饰线</legend><label class="user-theme-enabled"><input type="checkbox" data-user-theme-host-decoration-toggle="${ctx.escapeHtml(host.id)}" ${hasOverride ? 'checked' : ''} ${active ? '' : 'disabled'}>启用当前状态装饰线</label><div class="user-theme-number-row"><label>颜色 <input type="color" ${field('color')} value="${colorValue(display?.color)}" ${disabled ? 'disabled' : ''}></label><label>粗细 <input type="number" min="0" max="12" step="0.5" ${field('width')} value="${display?.width ?? 1}" ${disabled ? 'disabled' : ''}></label></div><div class="user-theme-number-row"><label>边缘间距 <input type="number" min="0" max="24" step="1" ${field('inset')} value="${display?.inset ?? 0}" ${disabled ? 'disabled' : ''}></label><label>透明度 <input type="number" min="0" max="1" step="0.05" ${field('opacity')} value="${display?.opacity ?? 1}" ${disabled ? 'disabled' : ''}></label></div><label class="user-theme-field"><span>线型</span><select ${field('style')} ${disabled ? 'disabled' : ''}><option value="solid" ${display?.style !== 'dashed' && display?.style !== 'dotted' ? 'selected' : ''}>实线</option><option value="dashed" ${display?.style === 'dashed' ? 'selected' : ''}>虚线</option><option value="dotted" ${display?.style === 'dotted' ? 'selected' : ''}>点线</option></select></label><small>来源：${source}。默认 0px 时贴合宿主形状边缘；增加边缘间距后向内缩。</small></fieldset>`;
}

export function renderPresentationHostTarget(ctx: UIContext, host: PresentationHostDef, active: boolean): string {
  return renderHostSummary(ctx, host, active);
}

function renderHostSummary(ctx: UIContext, host: PresentationHostDef, active: boolean): string {
  const target = getPresentationTargets().find(item => item.id === host.id);
  const state = hostStateForRender.get(host.id) ?? 'default';
  const stateDef = state === 'default' ? undefined : host.states?.[state];
  const ref: ThemeLayerTargetRef = { kind: 'host', hostId: host.id, state };
  const stateButtons = `<div class="switch-tabs user-theme-host-state-switch" role="tablist" aria-label="${ctx.escapeHtml(target?.label ?? host.id)}状态">${(target?.states ?? ['default', 'active', 'inactive', 'disabled']).map(item => `<button type="button" role="tab" aria-selected="${state === item}" class="switch-tab ${state === item ? 'active is-active' : ''}" data-user-theme-host-state="${ctx.escapeHtml(host.id)}" data-user-theme-state-value="${item}" ${active ? '' : 'disabled'}>${item === 'default' ? '默认' : item === 'active' ? '激活' : item === 'inactive' ? '未激活' : '禁用'}</button>`).join('')}</div>`;
  const textColorMode = stateDef?.textColorMode ?? host.textColorMode ?? 'auto';
  const textColorEditor = `<label class="user-theme-field user-theme-text-color-field"><span>文字颜色</span><select data-user-theme-host-text-color="${ctx.escapeHtml(host.id)}" ${active ? '' : 'disabled'}><option value="auto" ${textColorMode === 'auto' ? 'selected' : ''}>自动判别</option><option value="light" ${textColorMode === 'light' ? 'selected' : ''}>指定白色</option><option value="dark" ${textColorMode === 'dark' ? 'selected' : ''}>指定黑色</option></select><small>${state === 'default' ? '经典亮度判别；状态可单独覆盖。' : '未单独设置时继承默认态。'}</small></label>`;
  const shape = host.shape === 'rounded-parallelogram' ? 'rounded-parallelogram' : 'rounded-rectangle';
  const cornerRadius = clampShapeValue(host.cornerRadius, DEFAULT_CORNER_RADIUS, CORNER_RADIUS_MIN, CORNER_RADIUS_MAX);
  const skewXDeg = clampShapeValue(host.skewXDeg, shape === 'rounded-parallelogram' ? DEFAULT_PARALLELOGRAM_SKEW_X_DEG : 0, SKEW_X_DEG_MIN, SKEW_X_DEG_MAX);
  const shapeEditor = `<fieldset class="user-theme-component user-theme-shape-editor"><legend>宿主形状</legend><label class="user-theme-field"><span>形状</span><select data-user-theme-host-shape="${ctx.escapeHtml(host.id)}" ${active ? '' : 'disabled'}><option value="rounded-rectangle" ${shape === 'rounded-rectangle' ? 'selected' : ''}>圆角矩形</option><option value="rounded-parallelogram" ${shape === 'rounded-parallelogram' ? 'selected' : ''}>圆角平行四边形</option></select></label><div class="user-theme-number-row"><label>圆角半径（px） <input type="number" min="${CORNER_RADIUS_MIN}" max="${CORNER_RADIUS_MAX}" step="1" data-user-theme-host-corner-radius="${ctx.escapeHtml(host.id)}" value="${cornerRadius}" ${active ? '' : 'disabled'}></label><label>X 轴倾斜（deg） <input type="number" min="${SKEW_X_DEG_MIN}" max="${SKEW_X_DEG_MAX}" step="0.5" data-user-theme-host-skew-x-deg="${ctx.escapeHtml(host.id)}" value="${skewXDeg}" ${active ? '' : 'disabled'}></label></div><button type="button" class="user-theme-token-clear" data-user-theme-host-geometry-reset="${ctx.escapeHtml(host.id)}" ${active ? '' : 'disabled'}>恢复默认几何参数</button><small>参数作用于整个表现目标。</small></fieldset>`;
  const count = getTargetLayers({ version: 1, presentation: { hosts: [host] } }, ref).length;
  const source = host.layers?.length || stateDef?.layers?.length ? '用户覆盖' : '当前回退到父级或系统表现';
  return `<details class="user-theme-target-host user-theme-target-card" data-user-theme-host-card="${ctx.escapeHtml(host.id)}" open><summary><span>${ctx.escapeHtml(target?.label ?? host.id)}</span><span class="user-theme-target-card-actions"><small>${target?.level ?? '控件'}</small><button type="button" class="user-theme-token-clear" data-theme-layer-manager-target-kind="host" data-theme-layer-manager-target-host="${ctx.escapeHtml(host.id)}" data-theme-layer-manager-target-state="${state}" ${active ? '' : 'disabled'}>管理图层</button></span></summary><div class="user-theme-target-meta">${ctx.escapeHtml(source)} · 当前有效图层 ${count} 层</div>${stateButtons}${shapeEditor}${renderDecorationEditor(ctx, host, state, stateDef, active)}${textColorEditor}</details>`;
}

function renderComponents(ctx: UIContext, components: readonly ComponentPlacementDef[], active: boolean): string { if (!components.length) return '<p class="modal-empty">暂无自定义组件。当前版本先支持已声明组件的安全定位编辑。</p>'; return components.map(component => `<fieldset class="user-theme-component"><legend>${ctx.escapeHtml(component.id)}</legend><label class="user-theme-field"><span>父级</span><select data-user-theme-component-parent="${ctx.escapeHtml(component.id)}" ${active ? '' : 'disabled'}>${REGIONS.map(region => `<option value="${region}" ${component.parent === region ? 'selected' : ''}>${REGION_LABELS[region]}</option>`).join('')}${components.filter(parent => parent.id !== component.id).map(parent => `<option value="${ctx.escapeHtml(parent.id)}" ${component.parent === parent.id ? 'selected' : ''}>组件 · ${ctx.escapeHtml(parent.id)}</option>`).join('')}</select></label><div class="user-theme-anchor-grid" aria-label="${ctx.escapeHtml(component.id)} 锚点">${ANCHORS.map(anchor => `<button type="button" class="${component.anchor === anchor ? 'active' : ''}" title="${anchor}" data-user-theme-component-anchor="${ctx.escapeHtml(component.id)}" data-anchor="${anchor}" ${active ? '' : 'disabled'}>${anchor === 'top-left' ? '↖' : anchor === 'top-right' ? '↗' : anchor === 'bottom-left' ? '↙' : anchor === 'bottom-right' ? '↘' : '·'}</button>`).join('')}</div><div class="user-theme-number-row"><label>X <input type="number" data-user-theme-component-x="${ctx.escapeHtml(component.id)}" value="${component.offset?.x ?? 0}" ${active ? '' : 'disabled'}></label><label>Y <input type="number" data-user-theme-component-y="${ctx.escapeHtml(component.id)}" value="${component.offset?.y ?? 0}" ${active ? '' : 'disabled'}></label></div><small>位置相对于父级，单位：${component.offset?.unit ?? 'percent'}</small></fieldset>`).join(''); }
function colorValue(value: string | undefined): string { return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value! : '#6b8cff'; }
function clampShapeValue(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
function gradientDetails(value: string): [number, string, string] {
  const match = value.match(/^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg,\s*(#[0-9a-f]{3,8}),\s*(#[0-9a-f]{3,8})\)$/i);
  return [match ? Math.max(0, Math.min(360, Number(match[1]))) : 135, colorValue(match?.[2]), colorValue(match?.[3] ?? '#dbeafe')];
}
