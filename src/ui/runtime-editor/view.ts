import { getContentPolicy, SPOT_CONTENT_POLICY } from '../../data-services/authoring/content-policy';
import type { UIContext } from '../context';
import type { PanelState } from '../components/app-shell';
import {
  findRuntimeEditorAppliedSpot,
  getSelectedRuntimeEditorSpot,
  getSelectedRuntimeEditorDefinition,
  runtimeEditorAppliedDefinitions,
  runtimeEditorDefinitionEntryState,
  runtimeEditorDefinitionSuspensions,
  runtimeEditorDefinitions,
  runtimeEditorPendingDefinitions,
  runtimeEditorEntryState,
  runtimeEditorPendingSpots,
  type RuntimeDatapackEditorState,
  type RuntimeEditorContentKind,
  type RuntimeEditorDefinitionDraft,
  type RuntimeEditorEntryState,
  type RuntimeEditorProblem,
  type RuntimeEditorSpotDraft,
} from './state';
import {
  readRuntimeEditorFields,
  renderRuntimeEditorDiff,
  renderRuntimeEditorFields,
  renderRuntimeEditorProblems,
  runtimeEditorDiff,
  runtimeEditorFieldViews,
  runtimeEditorInitialValues,
  problemSectionId,
  type RuntimeEditorFieldView,
} from './form';
import { editorSections, type EditorSection } from './sections';
import type { AuthoringExtension } from '../../data-services/authoring/content-policy';
import {
  renderFunctionalityList,
  renderGachaPoolList,
  renderLevelUpgradeList,
  renderPaymentOptionList,
  renderRevealTriggerList,
  renderTagList,
} from './collections';
import { mergeRuntimeEditorReferenceOptions, renderRuntimeEditorReferenceOptions, runtimeEditorReferenceOptions } from './reference-options';

const POLICY = SPOT_CONTENT_POLICY;

const ENTRY_STATE_LABEL: Record<RuntimeEditorEntryState, string> = {
  created: '新建',
  modified: '已修改',
  unchanged: '已生效',
};

const CONTENT_KIND_LABEL: Record<RuntimeEditorContentKind, string> = {
  inits: 'Init',
  areas: 'Area',
  spots: 'Spot',
  enhancements: 'Enhancement',
};
const EDITABLE_CONTENT_KINDS: readonly RuntimeEditorContentKind[] = ['inits', 'areas', 'spots'];

const INIT_UNSUPPORTED_FIELDS: readonly { key: string; label: string }[] = [
  { key: 'enterEffects', label: '进入效果' },
  { key: 'triggers', label: '触发器' },
  { key: 'theme', label: '主题' },
  { key: 'extra', label: 'Extra' },
];

export { readRuntimeEditorFields };

/** 只有实际处于游戏 Init 页面时，Area 新建表单才继承当前 Init。 */
export function runtimeEditorPreferredAreaInitId(ctx: UIContext, state: PanelState): string | null {
  if (state.service !== 'game' || state.workspace) return null;
  const view = ctx.view ?? ctx.game.getView();
  const initId = view.activeInit;
  const areaId = view.currentAreaId;
  if (!initId || !areaId) return null;
  return ctx.game.registry.areas.get(areaId)?.initId === initId ? initId : null;
}

export function renderRuntimeEditorToggle(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor;
  const active = Boolean(editor?.enabled);
  const canCreateSpot = Boolean(editor?.modName && editor.displayName);
  const pending = editor
    ? runtimeEditorPendingSpots(editor).length
      + runtimeEditorPendingDefinitions(editor, 'inits').length
      + runtimeEditorPendingDefinitions(editor, 'areas').length
    : 0;
  const pendingBadge = active && pending > 0 ? `<span class="index">${pending} 项待应用</span>` : '';
  const activeActions = active
    ? `<button type="button" class="primary-button" data-runtime-editor-open>打开编辑器</button>${canCreateSpot ? '<button type="button" class="toolbar-button" data-runtime-editor-new-definition="inits">新建 Init</button><button type="button" class="toolbar-button" data-runtime-editor-new-definition="areas">新建 Area</button><button type="button" class="toolbar-button" data-runtime-editor-new-spot>新建 Spot</button>' : ''}<button type="button" class="toolbar-button" data-runtime-editor-close>关闭编辑态</button>`
    : '<button type="button" class="primary-button" data-runtime-editor-toggle>开启编辑态</button>';
  return `<section class="service-card runtime-editor-toggle"><div class="panel-heading"><h3>运行时数据包编辑</h3><span class="index">${active ? '编辑中' : '实验功能'}</span>${pendingBadge}</div><p>在草稿中编辑内容，确认差异后再应用到运行时；未应用前游戏画面保持不变。</p><div class="service-actions">${activeActions}</div></section>`;
}

/** body 级 Runtime Editor 浮动工作区：不随 #app 路由重建，作为独立编辑宿主。 */
export function renderRuntimeEditorPanel(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor;
  const status = editor?.enabled
    ? editor.displayName || 'Runtime Mod 待配置'
    : '尚未开启编辑态';
  const body = editor?.enabled
    ? `${renderRuntimeEditorForm(ctx, state)}${renderRuntimeEditorWorkspace(ctx, state)}`
    : renderRuntimeEditorToggle(ctx, state);
  return `<aside class="runtime-editor-panel" role="dialog" aria-modal="false" aria-labelledby="runtime-editor-panel-title"><header class="runtime-editor-panel-head" data-runtime-editor-panel-head><div><span class="eyebrow">RUNTIME EDITOR</span><h2 id="runtime-editor-panel-title">运行时编辑器</h2><p>${ctx.escapeHtml(status)}</p></div><button type="button" class="icon-button" data-runtime-editor-panel-close aria-label="关闭编辑器面板" title="关闭">×</button></header><div class="runtime-editor-panel-body">${body}</div></aside>`;
}

export function renderRuntimeEditorForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const esc = ctx.escapeHtml;
  const field = (label: string, key: string, value: string | number, type = 'text') => `<label class="user-theme-field"><span>${label}</span><input data-runtime-editor-mod-field="${key}" type="${type}" value="${esc(String(value))}"></label>`;
  const hasMetadata = Boolean(editor.modName && editor.displayName);
  const hint = hasMetadata ? 'Mod 信息已锁定为编辑命名空间；继续编辑内容不需要再次保存。' : '先填写并保存 Mod 信息，随后才能创建内容。';
  return `<div class="runtime-editor-form">${renderError(esc, editor)}${renderNotice(esc, editor)}<h4>Mod 元信息</h4>${field('modName', 'modName', editor.modName)}${field('显示名称', 'displayName', editor.displayName)}${field('版本', 'version', editor.version)}${field('作者', 'author', editor.author)}${field('简介', 'description', editor.description)}<div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-create>校验并保存 Mod 信息</button><span class="service-draft-status">${hasMetadata ? '已配置' : '待配置'}</span></div><p class="service-summary">${hint}</p></div>`;
}

/** 内容浏览器 + Draft/Runtime 差异 + Apply：编辑器骨架的常驻视图。 */
export function renderRuntimeEditorWorkspace(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor;
  if (!editor) return '';
  const contentSwitch = renderRuntimeEditorContentSwitch(editor);
  if (editor.selectedContentKind !== 'spots') return `${contentSwitch}${renderRuntimeDefinitionWorkspace(ctx, editor, editor.selectedContentKind)}`;
  const esc = ctx.escapeHtml;
  const pending = runtimeEditorPendingSpots(editor);
  const entries = filteredRuntimeSpotEntries(editor);
  const rows = entries.map(spot => renderRuntimeSpotEntry(ctx, editor, spot)).join('');
  const selected = getSelectedRuntimeEditorSpot(editor);
  const applied = selected ? findRuntimeEditorAppliedSpot(editor, selected.idName) : undefined;
  const diff = selected ? renderRuntimeEditorDiff(runtimeEditorDiff(POLICY, selected, applied)) : '';
  const filterButton = (filter: typeof editor.browserFilter, label: string) => `<button type="button" class="toolbar-button${editor.browserFilter === filter ? ' is-active' : ''}" data-runtime-editor-filter="${filter}">${label}</button>`;
  const list = editor.spots.length === 0
    ? '<p class="service-summary">草稿中还没有内容。用「新建 Spot」开始。</p>'
    : entries.length === 0
      ? '<p class="service-summary">当前筛选下没有条目。</p>'
      : `<ul class="runtime-spot-list">${rows}</ul>`;
  const canCreate = Boolean(editor.modName && editor.displayName);
  return `${contentSwitch}<div class="runtime-editor-workspace">
    <div class="panel-heading"><h4>内容浏览器 · ${esc(POLICY.label)}</h4><span class="index">${editor.spots.length} 草稿 / ${editor.appliedSpots.length} 已生效</span>${canCreate ? '<button type="button" class="toolbar-button" data-runtime-editor-new-spot>新建 Spot</button>' : ''}</div>
    <div class="runtime-editor-filters">${filterButton('all', '全部')}${filterButton('pending', `待应用 ${pending.length}`)}${filterButton('applied', '已生效')}${filterButton('removed', `已移除 ${editor.suspendedSpotIds.length}`)}</div>
    ${list}
    ${renderError(esc, editor)}
    ${renderRuntimeEditorProblems(ctx, POLICY, editor.problems)}
    <div class="runtime-editor-apply-bar">
      <button type="button" class="primary-button" data-runtime-editor-apply${pending.length === 0 ? ' disabled' : ''}>应用到运行时</button>
      <span class="service-draft-status">${pending.length === 0 ? 'Draft 与 Runtime 一致' : `${pending.length} 项待应用`}</span>
    </div>
    ${selected ? `<div class="runtime-editor-diff-panel"><span class="eyebrow">${esc(selected.name || selected.idName)} 的差异</span><p class="service-summary">运行中版本：${esc(applied ? applied.name : '尚未应用')}</p>${diff}</div>` : ''}
  </div>`;
}

function renderRuntimeEditorContentSwitch(editor: RuntimeDatapackEditorState): string {
  return `<nav class="runtime-editor-content-switch" aria-label="内容类型">${EDITABLE_CONTENT_KINDS.map(kind => `<button type="button" class="toolbar-button${editor.selectedContentKind === kind ? ' is-active' : ''}" data-runtime-editor-kind-tab="${kind}" aria-current="${editor.selectedContentKind === kind ? 'page' : 'false'}">${CONTENT_KIND_LABEL[kind]}</button>`).join('')}</nav>`;
}

function renderRuntimeDefinitionWorkspace(ctx: UIContext, editor: RuntimeDatapackEditorState, kind: RuntimeEditorContentKind): string {
  const policy = getContentPolicy(kind);
  if (!policy) return '<p class="service-result error">当前内容类型尚未接入编辑策略。</p>';
  const esc = ctx.escapeHtml;
  const definitions = runtimeEditorDefinitions(editor, kind);
  const appliedDefinitions = runtimeEditorAppliedDefinitions(editor, kind);
  const suspended = runtimeEditorDefinitionSuspensions(editor, kind);
  const pending = runtimeEditorPendingDefinitions(editor, kind);
  const visibleDefinitions = [...definitions, ...appliedDefinitions.filter(definition => !definitions.some(item => item.idName === definition.idName))];
  const filtered = visibleDefinitions.filter(definition => {
    const state = runtimeEditorDefinitionEntryState(editor, kind, definition);
    if (editor.browserFilter === 'pending') return state !== 'unchanged';
    if (editor.browserFilter === 'applied') return !suspended.includes(definition.idName) && state === 'unchanged';
    if (editor.browserFilter === 'removed') return suspended.includes(definition.idName);
    return true;
  });
  const rows = filtered.map(definition => {
    const state = runtimeEditorDefinitionEntryState(editor, kind, definition);
    const removed = suspended.includes(definition.idName) || !definitions.some(item => item.idName === definition.idName);
    const issues = kind === 'inits' ? runtimeEditorInitProblems(ctx, editor, definition) : [];
    const tone = removed ? 'removed' : issues.length > 0 ? 'error' : state;
    const label = removed ? '已移除' : issues.length > 0 ? `有 ${issues.length} 个问题` : ENTRY_STATE_LABEL[state];
    const name = definition.name;
    return `<li class="runtime-spot-item" data-runtime-editor-entry="${esc(definition.idName)}" data-entry-state="${tone}">
      <button type="button" class="runtime-spot-item-main" data-runtime-editor-definition-edit data-runtime-editor-kind="${kind}" data-runtime-editor-definition-id="${esc(definition.idName)}"><span class="runtime-spot-item-name">${esc(name || definition.idName)}</span><em>${esc(definition.idName)}${kind === 'inits' ? ' · Runtime Mod' : ''}</em></button>
      <span class="runtime-editor-entry-state" data-entry-state="${tone}">${label}</span>
      ${removed ? `<button type="button" class="mini-action" data-runtime-editor-definition-restore data-runtime-editor-kind="${kind}" data-runtime-editor-definition-id="${esc(definition.idName)}">撤销删除</button>` : `<button type="button" class="mini-action" data-runtime-editor-definition-remove data-runtime-editor-kind="${kind}" data-runtime-editor-definition-id="${esc(definition.idName)}">删除</button>`}
    </li>`;
  }).join('');
  const filterButton = (filter: typeof editor.browserFilter, label: string) => `<button type="button" class="toolbar-button${editor.browserFilter === filter ? ' is-active' : ''}" data-runtime-editor-filter="${filter}">${label}</button>`;
  const list = visibleDefinitions.length === 0
    ? `<p class="service-summary">${policy.label} 草稿为空。点击“新建 ${policy.label}”开始。</p>`
    : filtered.length === 0 ? '<p class="service-summary">当前筛选下没有条目。</p>' : `<ul class="runtime-spot-list">${rows}</ul>`;
  const canCreate = Boolean(editor.modName && editor.displayName);
  const sourceNote = kind === 'inits'
    ? '<p class="runtime-editor-source-note"><strong>来源：</strong>当前 Runtime Mod 自有内容可编辑；基础包和其他 Mod 的 Init 只读，不能被同 ID 覆盖。</p>'
    : '';
  const selected = getSelectedRuntimeEditorDefinition(editor);
  const applied = selected ? appliedDefinitions.find(definition => definition.idName === selected.idName) : undefined;
  const diff = selected ? renderRuntimeEditorDiff(runtimeEditorDiff(policy, selected, applied)) : '';
  return `<div class="runtime-editor-workspace" data-runtime-editor-definition-workspace="${kind}">
    <div class="panel-heading"><h4>内容浏览器 · ${esc(policy.label)}</h4><span class="index">${definitions.length} 草稿 / ${appliedDefinitions.length} 已生效</span>${canCreate ? `<button type="button" class="toolbar-button" data-runtime-editor-new-definition="${kind}">新建 ${esc(policy.label)}</button>` : ''}</div>
    ${sourceNote}
    <div class="runtime-editor-filters">${filterButton('all', '全部')}${filterButton('pending', `待应用 ${pending.length}`)}${filterButton('applied', '已生效')}${filterButton('removed', `已移除 ${suspended.length}`)}</div>
    ${list}
    ${renderError(esc, editor)}
    ${renderRuntimeEditorProblems(ctx, policy, editor.problems)}
    <div class="runtime-editor-apply-bar"><button type="button" class="primary-button" data-runtime-editor-apply${pending.length === 0 ? ' disabled' : ''}>应用到运行时</button><span class="service-draft-status">${pending.length === 0 ? 'Draft 与 Runtime 一致' : `${pending.length} 项待应用`}</span></div>
    ${selected ? `<div class="runtime-editor-diff-panel"><span class="eyebrow">${esc(selected.name || selected.idName)} 的差异</span><p class="service-summary">运行中版本：${esc(applied ? applied.name : '尚未应用')}</p>${diff}</div>` : ''}
  </div>`;
}

/**
 * Spot 编辑外壳：顶部条（标题 / 提示 / 操作）+ 左侧 Switch + 右侧页内容。
 * 所有页始终在 DOM 中，切换只改 hidden —— 换页不会丢失未保存输入。
 */
export function renderRuntimeSpotForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const esc = ctx.escapeHtml;
  const spot = getSelectedRuntimeEditorSpot(editor);
  // 表单暂存优先：切页时把当前页的值并入 formDraft，保证页隔离下不丢输入。
  const values: Record<string, unknown> = editor.formDraft ?? {
    ...runtimeEditorInitialValues(ctx, POLICY, { preferredRefValue: editor.selectedAreaId }),
    ...(spot ?? {}),
  };
  const applied = spot ? findRuntimeEditorAppliedSpot(editor, spot.idName) : undefined;
  const views = runtimeEditorFieldViews(ctx, POLICY, values, {
    lockedFields: applied ? ['idName'] : [],
  });
  const diff = spot && applied ? renderRuntimeEditorDiff(runtimeEditorDiff(POLICY, values, applied)) : '';
  const areas = [...ctx.game.registry.areas.values()];
  const areaNotice = areas.length === 0
    ? '<p class="service-result error">当前 Registry 没有 Area，无法创建 Spot。</p>'
    : '';
  const sections = editorSections(POLICY);
  const active = sections.some(section => section.id === editor.activeSection)
    ? editor.activeSection!
    : sections[0]?.id ?? 'default';
  const tabs = sections.map(section => {
    const count = editor.problems.filter(problem => problemSectionId(POLICY, problem) === section.id).length;
    return `<button type="button" class="runtime-editor-tab${section.id === active ? ' is-active' : ''}${count > 0 ? ' has-runtime-editor-problem' : ''}" data-runtime-editor-section-tab="${section.id}" aria-current="${section.id === active ? 'page' : 'false'}"><span class="nav-marker"></span>${esc(section.label)}${count > 0 ? `<em class="runtime-editor-tab-error">${count}</em>` : ''}</button>`;
  }).join('');
  // 页互相隔离：只渲染当前页；跨页的值由 editor.formDraft 汇总（切页前暂存）。
  const current = sections.find(section => section.id === active) ?? sections[0];
  const pages = current ? renderSpotSection(ctx, editor, current, active, views, values, diff) : '';
  return `<div class="runtime-editor-form runtime-editor-shell" data-runtime-editor-spot-form>
    <header class="runtime-editor-topbar">
      <div class="runtime-editor-topbar-title"><h4>${spot ? '编辑 Spot' : '新建 Spot'}</h4><p class="service-summary">${spot ? '保存只写入草稿；差异确认后再应用到运行时。' : '保存后加入草稿，不会立刻改变游戏。'}</p></div>
      <div class="service-actions">
        <button type="button" class="primary-button" data-runtime-editor-create-spot>${spot ? '保存 Spot 修改' : '加入草稿'}</button>
        <button type="button" class="primary-button" data-runtime-editor-apply>应用到运行时</button>
        ${spot ? '<button type="button" class="toolbar-button danger" data-runtime-editor-delete-spot>删除 Spot</button>' : ''}
      </div>
    </header>
    ${areaNotice}${renderError(esc, editor)}${renderNotice(esc, editor)}
    <div class="runtime-editor-body">
      <nav class="runtime-editor-switch" data-runtime-editor-switch>${tabs}</nav>
      <div class="runtime-editor-panes">${pages}</div>
    </div>
  </div>`;
}

/** Init / Area / Enhancement 与 Spot 共用同一顶部条、左侧 Switch、诊断与 Apply 外壳。 */
export function renderRuntimeDefinitionForm(ctx: UIContext, state: PanelState, kind: RuntimeEditorContentKind): string {
  const editor = state.runtimeDatapackEditor!;
  const policy = getContentPolicy(kind);
  if (!policy) return '<p class="service-result error">当前内容类型尚未接入编辑策略。</p>';
  const esc = ctx.escapeHtml;
  const definition = getSelectedRuntimeEditorDefinition(editor);
  const preferredRefValue = kind === 'areas' ? runtimeEditorPreferredAreaInitId(ctx, state) : null;
  const values: Record<string, unknown> = editor.formDraft ?? {
    ...runtimeEditorInitialValues(ctx, policy, {
      preferredRefValue,
      preferredRefOnly: kind === 'areas',
    }),
    ...(definition ?? {}),
  };
  const applied = definition
    ? runtimeEditorAppliedDefinitions(editor, kind).find(item => item.idName === definition.idName)
    : undefined;
  const views = runtimeEditorFieldViews(ctx, policy, values, { lockedFields: applied ? ['idName'] : [] });
  const problems = kind === 'inits' ? runtimeEditorInitViewProblems(ctx, editor, values) : editor.problems;
  const sections = editorSections(policy);
  const active = sections.some(section => section.id === editor.activeSection) ? editor.activeSection! : sections[0]?.id ?? 'default';
  const tabs = sections.map(section => {
    const count = problems.filter(problem => problemSectionId(policy, problem) === section.id).length;
    return `<button type="button" class="runtime-editor-tab${section.id === active ? ' is-active' : ''}${count > 0 ? ' has-runtime-editor-problem' : ''}" data-runtime-editor-section-tab="${section.id}" aria-current="${section.id === active ? 'page' : 'false'}"><span class="nav-marker"></span>${esc(section.label)}${count > 0 ? `<em class="runtime-editor-tab-error">${count}</em>` : ''}</button>`;
  }).join('');
  const current = sections.find(section => section.id === active) ?? sections[0];
  const diff = definition && applied ? renderRuntimeEditorDiff(runtimeEditorDiff(policy, values, applied)) : '';
  const pages = current ? renderDefinitionSection(ctx, editor, policy, current, active, views, values, diff, problems) : '';
  const label = CONTENT_KIND_LABEL[kind];
  return `<div class="runtime-editor-form runtime-editor-shell" data-runtime-editor-definition-form data-runtime-editor-content-kind="${kind}">
    <header class="runtime-editor-topbar"><div class="runtime-editor-topbar-title"><h4>${definition ? `编辑 ${label}` : `新建 ${label}`}</h4><p class="service-summary">${definition ? '保存只写入草稿；确认差异后再应用到运行时。' : '保存后加入临时 Mod 草稿，不会立刻改变游戏。'}</p></div><div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-save-definition="${kind}">${definition ? `保存 ${label} 修改` : `加入 ${label} 草稿`}</button><button type="button" class="primary-button" data-runtime-editor-apply>应用到运行时</button>${definition ? `<button type="button" class="toolbar-button danger" data-runtime-editor-delete-definition="${kind}" data-runtime-editor-definition-id="${esc(definition.idName)}">删除 ${label}</button>` : ''}</div></header>
    ${renderError(esc, editor)}${renderNotice(esc, editor)}
    <div class="runtime-editor-body"><nav class="runtime-editor-switch" data-runtime-editor-switch>${tabs}</nav><div class="runtime-editor-panes">${pages}</div></div>
  </div>`;
}

function renderDefinitionSection(
  ctx: UIContext,
  editor: RuntimeDatapackEditorState,
  policy: NonNullable<ReturnType<typeof getContentPolicy>>,
  section: EditorSection,
  active: string,
  views: readonly RuntimeEditorFieldView[],
  values: Record<string, unknown>,
  diff: string,
  problems: readonly RuntimeEditorProblem[],
): string {
  const pageViews = views.filter(view => section.fields.some(field => field.key === view.key));
  const blocks: string[] = [];
  if (section.id === 'overview') blocks.push(policy.key === 'inits' ? renderInitOverview(ctx, editor, values) : renderDefinitionOverview(ctx, policy.label, values));
  if (pageViews.length > 0) blocks.push(renderRuntimeEditorFields(ctx, pageViews, problems, policy));
  for (const extension of section.extensions) {
    const block = policy.key === 'inits' && extension.inputKey === 'defaultAreas'
      ? renderInitDefaultAreasEditor(ctx, editor, values, problems)
      : renderDefinitionExtension(ctx, extension, values, editor, problems);
    if (block) blocks.push(block);
  }
  if (section.id === 'diagnostics') {
    blocks.push(policy.key === 'inits' ? renderInitDiagnosticSummary(ctx, editor, values) : '');
    blocks.push(renderRuntimeEditorProblems(ctx, policy, problems));
    blocks.push(diff ? `<div class="runtime-editor-diff-panel"><span class="eyebrow">与运行中版本的差异</span>${diff}</div>` : '<p class="runtime-editor-hint">Draft 与 Runtime 一致。</p>');
  }
  return `<section class="runtime-editor-page" data-runtime-editor-section="${section.id}"${section.id === active ? '' : ' hidden'}>${blocks.filter(Boolean).join('') || '<p class="runtime-editor-hint">本页暂无可编辑内容。</p>'}</section>`;
}

function renderDefinitionOverview(ctx: UIContext, label: string, values: Record<string, unknown>): string {
  const esc = ctx.escapeHtml;
  const rows: Array<[string, string]> = [
    ['类型', label],
    ['ID 名', String(values.idName ?? '（未填写）')],
    ['名称', String(values.name ?? '（未填写）')],
  ];
  if (values.initId !== undefined) rows.push(['所属 Init', String(values.initId || '未设置')]);
  if (label === 'Area') {
    const initId = typeof values.initId === 'string' ? values.initId : '';
    const initName = initId ? ctx.game.registry.inits.get(initId)?.name : undefined;
    if (initName) rows[rows.length - 1] = ['所属 Init', `${initName} (${initId})`];
    const defaultSpots = Array.isArray(values.defaultSpots) ? values.defaultSpots.length : 0;
    const adjacentAreas = Array.isArray(values.adjacentAreaIds) ? values.adjacentAreaIds.length : 0;
    rows.push(['默认设施', `${defaultSpots} 个`], ['相邻区域', `${adjacentAreas} 个`]);
  }
  if (values.attachment !== undefined) rows.push(['归属', String((values.attachment as { kind?: string } | undefined)?.kind ?? '未设置')]);
  return `<dl class="runtime-editor-overview">${rows.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}

function initEntityId(editor: RuntimeDatapackEditorState, idName: string): string {
  return `${editor.modName}:init:${idName}`;
}

function initAreaEntityId(editor: RuntimeDatapackEditorState, idName: string): string {
  return `${editor.modName}:area:${idName}`;
}

function initAreaCandidate(ctx: UIContext, editor: RuntimeDatapackEditorState, areaId: string): {
  readonly name: string;
  readonly initId: string;
  readonly source: 'Registry' | '当前 Draft';
} | undefined {
  const draft = editor.areas.find(area => initAreaEntityId(editor, area.idName) === areaId);
  const registry = ctx.game.registry.areas.get(areaId);
  if (!draft && !registry) return undefined;
  return {
    name: draft?.name ?? registry?.name ?? areaId,
    initId: draft?.initId ?? registry?.initId ?? '',
    source: draft ? '当前 Draft' : 'Registry',
  };
}

function initAreaCandidates(ctx: UIContext, editor: RuntimeDatapackEditorState, currentId: string): Array<{ id: string; name: string; initId: string; source: 'Registry' | '当前 Draft' }> {
  const ids = new Set<string>();
  for (const id of ctx.game.registry.areas.keys()) ids.add(id);
  for (const area of editor.areas) ids.add(initAreaEntityId(editor, area.idName));
  return [...ids]
    .filter(id => id !== currentId)
    .map(id => ({ id, ...(initAreaCandidate(ctx, editor, id) ?? { name: id, initId: '', source: 'Registry' as const }) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

export function runtimeEditorInitUnsupportedFields(ctx: UIContext, editor: RuntimeDatapackEditorState, values: object): string[] {
  const record = values as Record<string, unknown>;
  const idName = typeof record.idName === 'string' ? record.idName : '';
  if (!idName || !editor.modName) return [];
  const source = ctx.game.registry.inits.get(initEntityId(editor, idName)) as unknown as Record<string, unknown> | undefined;
  if (!source) return [];
  return INIT_UNSUPPORTED_FIELDS
    .filter(field => field.key in source && source[field.key] !== undefined)
    .map(field => field.label);
}

export function runtimeEditorInitProblems(ctx: UIContext, editor: RuntimeDatapackEditorState, values: object): RuntimeEditorProblem[] {
  const record = values as Record<string, unknown>;
  const areas = Array.isArray(record.defaultAreas) ? record.defaultAreas.map(item => String(item)) : [];
  const currentInitId = initEntityId(editor, typeof record.idName === 'string' ? record.idName : '');
  const problems: RuntimeEditorProblem[] = [];
  const seen = new Set<string>();
  areas.forEach((areaId, index) => {
    if (seen.has(areaId)) {
      problems.push({ code: 'duplicate-reference', path: `init.defaultAreas[${index}]`, sectionId: 'areas', message: `默认区域重复：${areaId}` });
      return;
    }
    seen.add(areaId);
    const candidate = initAreaCandidate(ctx, editor, areaId);
    if (!candidate) {
      problems.push({ code: 'missing-reference', path: `init.defaultAreas[${index}]`, sectionId: 'areas', message: `默认区域不存在：${areaId}` });
    } else if (candidate.initId !== currentInitId) {
      problems.push({ code: 'wrong-owner', path: `init.defaultAreas[${index}]`, sectionId: 'areas', message: `默认区域归属不一致：${areaId} 属于 ${candidate.initId || '未知 Init'}` });
    }
  });
  const startStoryId = typeof record.startStoryId === 'string' ? record.startStoryId : '';
  const startStoryEntry = startStoryId ? ctx.game.registry.activeStories?.get(startStoryId) : undefined;
  if (startStoryId && !ctx.game.registry.stories.get(startStoryId) && !startStoryEntry?.storyId) {
    problems.push({ code: 'missing-reference', path: 'init.startStoryId', sectionId: 'basics', message: `起始剧情不存在：${startStoryId}` });
  }
  const unsupported = runtimeEditorInitUnsupportedFields(ctx, editor, record);
  if (unsupported.length > 0) {
    problems.push({ code: 'unsupported-field', path: 'init.unsupported', sectionId: 'diagnostics', message: `当前 Init 含未开放字段：${unsupported.join('、')}。为避免丢失内容，暂不能替换。` });
  }
  return problems;
}

function runtimeEditorInitViewProblems(ctx: UIContext, editor: RuntimeDatapackEditorState, values: object): RuntimeEditorProblem[] {
  const derived = runtimeEditorInitProblems(ctx, editor, values);
  const known = new Set(editor.problems.map(problem => `${problem.code}|${problem.path}|${problem.message}`));
  return [...editor.problems, ...derived.filter(problem => !known.has(`${problem.code}|${problem.path}|${problem.message}`))];
}

function renderInitOverview(ctx: UIContext, editor: RuntimeDatapackEditorState, values: Record<string, unknown>): string {
  const esc = ctx.escapeHtml;
  const state = runtimeEditorDefinitionEntryState(editor, 'inits', values as unknown as RuntimeEditorDefinitionDraft);
  const areaIds = Array.isArray(values.defaultAreas) ? values.defaultAreas.map(item => String(item)) : [];
  const view = ctx.game.getView();
  const active = view.activeInit === initEntityId(editor, String(values.idName ?? ''));
  const currentArea = active && view.currentAreaId ? ctx.game.registry.areas.get(view.currentAreaId)?.name ?? view.currentAreaId : '未在此世界线中';
  const unsupported = runtimeEditorInitUnsupportedFields(ctx, editor, values);
  const rows: Array<[string, string]> = [
    ['世界线 ID', String(values.idName || '（未填写）')],
    ['来源', '当前 Runtime Mod · 可编辑'],
    ['编辑状态', ENTRY_STATE_LABEL[state]],
    ['默认区域', areaIds.length > 0 ? `${areaIds.length} 个，顺序可调整` : '0 个 · 没有默认区域'],
    ['起始剧情', String(values.startStoryId || '未设置')],
    ['当前玩家位置', currentArea],
  ];
  if (unsupported.length > 0) rows.push(['未开放字段', `${unsupported.length} 项 · Apply 将阻断`]);
  const warning = areaIds.length === 0
    ? '<p class="runtime-editor-warning" role="status">没有默认区域：该 Init 无有效进入位置，运行时会回到 Init 选择界面。</p>'
    : '';
  return `<div class="runtime-init-overview"><dl class="runtime-editor-overview">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${warning}</div>`;
}

function renderInitDefaultAreasEditor(ctx: UIContext, editor: RuntimeDatapackEditorState, values: Record<string, unknown>, problems: readonly RuntimeEditorProblem[]): string {
  const esc = ctx.escapeHtml;
  const currentId = initEntityId(editor, typeof values.idName === 'string' ? values.idName : '');
  const selected = Array.isArray(values.defaultAreas) ? values.defaultAreas.map(item => String(item)) : [];
  const candidates = initAreaCandidates(ctx, editor, currentId);
  const issueByIndex = new Map<number, RuntimeEditorProblem>();
  problems.forEach(problem => {
    const match = problem.path?.match(/defaultAreas\[(\d+)\]/);
    if (match) issueByIndex.set(Number(match[1]), problem);
  });
  const rows = selected.map((areaId, index) => {
    const candidate = initAreaCandidate(ctx, editor, areaId);
    const issue = issueByIndex.get(index);
    const state = candidate?.source === '当前 Draft' ? '待提交' : candidate ? 'Registry' : '缺失';
    const name = candidate?.name ?? areaId;
    return `<li class="runtime-init-area-row${issue ? ' has-runtime-editor-problem' : ''}" data-runtime-init-area-row data-runtime-init-area-index="${index}" data-area-id="${esc(areaId)}"><span class="runtime-init-area-order">${index + 1}</span><span class="runtime-init-area-main"><strong>${esc(name)}</strong><em>${esc(areaId)}</em><small>${esc(candidate ? `${candidate.initId || '未知归属'} · ${state}` : '目标不存在 · Apply 会阻断')}</small>${issue ? `<b class="runtime-editor-field-error">${esc(issue.message)}</b>` : ''}</span><span class="runtime-init-area-actions"><button type="button" class="mini-action" data-runtime-init-area-up="${index}" aria-label="上移 ${esc(name)}"${index === 0 ? ' disabled' : ''}>↑</button><button type="button" class="mini-action" data-runtime-init-area-down="${index}" aria-label="下移 ${esc(name)}"${index === selected.length - 1 ? ' disabled' : ''}>↓</button><button type="button" class="mini-action danger" data-runtime-init-area-remove="${index}" aria-label="移除 ${esc(name)}">移除</button></span></li>`;
  }).join('');
  const options = candidates.map(candidate => `<button type="button" role="option" class="runtime-init-area-option" data-runtime-init-area-option data-area-id="${esc(candidate.id)}" data-area-label="${esc(candidate.name)}" data-area-init-id="${esc(candidate.initId)}"${selected.includes(candidate.id) ? ' aria-disabled="true"' : ''}><strong>${esc(candidate.name)}</strong><em>${esc(candidate.id)}</em><small>${esc(candidate.initId || '未知归属')} · ${esc(candidate.source)}${selected.includes(candidate.id) ? ' · 已加入' : ''}</small></button>`).join('');
  const noAreas = selected.length === 0 ? '<p class="runtime-editor-warning" role="status">当前为空是合法输入，但它不会提供有效进入位置。</p>' : '';
  return `<div class="runtime-init-areas" data-runtime-init-areas><div class="runtime-editor-collection-heading"><div><h5>默认区域顺序</h5><p class="runtime-editor-hint">这是世界线的声明式入口顺序，不等同于玩家当前所在区域。可加入 Registry 或当前 Draft 的 Area；归属不一致的项会立即标红。</p></div><span class="runtime-editor-collection-count">${selected.length} 个</span></div><div class="runtime-init-area-picker" data-runtime-init-area-picker><input type="search" role="combobox" aria-controls="runtime-init-area-options" aria-expanded="false" data-runtime-init-area-query placeholder="搜索 Area 名称或完整 ID" autocomplete="off"><div id="runtime-init-area-options" class="runtime-init-area-options" role="listbox" data-runtime-init-area-options hidden>${options || '<span class="runtime-init-area-empty">没有可用 Area</span>'}</div></div><button type="button" class="toolbar-button" data-runtime-init-area-add>加入默认区域</button>${noAreas}${rows ? `<ol class="runtime-init-area-list">${rows}</ol>` : '<p class="runtime-editor-hint">还没有默认区域。使用上方搜索添加第一个入口。</p>'}</div>`;
}

function renderInitDiagnosticSummary(ctx: UIContext, editor: RuntimeDatapackEditorState, values: Record<string, unknown>): string {
  const esc = ctx.escapeHtml;
  const problems = runtimeEditorInitViewProblems(ctx, editor, values);
  const unsupported = runtimeEditorInitUnsupportedFields(ctx, editor, values);
  const areaCount = Array.isArray(values.defaultAreas) ? values.defaultAreas.length : 0;
  const lines = [
    `<li><span>字段问题</span><strong>${problems.filter(problem => problem.path?.startsWith('init.') && !problem.path.includes('defaultAreas') && problem.code !== 'unsupported-field').length}</strong></li>`,
    `<li><span>关系问题</span><strong>${problems.filter(problem => problem.path?.includes('defaultAreas') || problem.path === 'init.startStoryId').length}</strong></li>`,
    `<li><span>能力问题</span><strong>${unsupported.length}</strong></li>`,
    `<li><span>运行时影响</span><strong>${areaCount === 0 || editor.suspendedInitIds.includes(String(values.idName ?? '')) ? '需要注意' : '可预览'}</strong></li>`,
  ];
  const hint = unsupported.length > 0 ? `<p class="runtime-editor-warning" role="alert">${esc(`未开放字段：${unsupported.join('、')}。当前 Init 的替换会被阻断，避免静默丢失内容。`)}</p>` : '';
  return `<div class="runtime-init-diagnostic-summary"><span class="eyebrow">准出摘要</span><ul>${lines.join('')}</ul>${hint}</div>`;
}

function renderDefinitionExtension(ctx: UIContext, extension: AuthoringExtension, values: Record<string, unknown>, editor: RuntimeDatapackEditorState, problems: readonly RuntimeEditorProblem[] = editor.problems): string {
  const esc = ctx.escapeHtml;
  const value = values[extension.inputKey];
  if (extension.editor === 'area-topology') return renderAreaTopologyEditor(ctx, values, editor);
  if (extension.editor === 'reference-list') {
    const lines = Array.isArray(value) ? value.map(item => String(item)).join('\n') : '';
    return `<label class="user-theme-field runtime-editor-field"><span>${esc(extension.inputKey === 'defaultAreas' ? '默认区域' : extension.inputKey === 'defaultSpots' ? '默认设施' : extension.inputKey === 'adjacentAreaIds' ? '相邻区域' : extension.inputKey)}${extension.required ? '' : '（可选）'}</span><textarea data-runtime-editor-extension="${extension.inputKey}" name="${extension.inputKey}" aria-label="${esc(extension.inputKey)}" rows="4" placeholder="每行一个完整实体 ID">${esc(lines)}</textarea><em class="runtime-editor-hint">每行填写一个完整 ID，例如 base:area:plaza；空白行会忽略。</em></label>`;
  }
  if (extension.editor === 'resource-amount-list') {
    const lines = Array.isArray(value) ? value.map(item => {
      const row = item as { resourceId?: unknown; amount?: unknown };
      return `${String(row.resourceId ?? '')} = ${String(row.amount ?? '')}`;
    }).join('\n') : '';
    return `<label class="user-theme-field runtime-editor-field"><span>${esc(extension.inputKey === 'purchaseCost' ? '购买费用' : '价格')}（可选）</span><textarea data-runtime-editor-extension="${extension.inputKey}" name="${extension.inputKey}" aria-label="${esc(extension.inputKey)}" rows="4" placeholder="base:resource:credit = 100">${esc(lines)}</textarea><em class="runtime-editor-hint">每行一个资源费用，格式为“完整资源 ID = 数量”。</em></label>`;
  }
  if (extension.editor === 'attachment') {
    const attachment = (value ?? { kind: 'global' }) as { kind?: string; initId?: string; areaId?: string };
    const options = [['global', '全局'], ['init', '指定 Init'], ['area', '指定 Area']].map(([kind, label]) => `<option value="${kind}"${attachment.kind === kind ? ' selected' : ''}>${label}</option>`).join('');
    const reference = attachment.kind === 'init' ? attachment.initId ?? '' : attachment.kind === 'area' ? attachment.areaId ?? '' : '';
    return `<div class="runtime-editor-field"><label class="user-theme-field"><span>归属范围</span><select data-runtime-editor-attachment-kind name="attachmentKind" aria-label="归属范围">${options}</select></label><label class="user-theme-field"><span>归属 ID（global 不填）</span><input data-runtime-editor-attachment-id name="attachmentId" aria-label="归属 ID" autocomplete="off" value="${esc(reference)}" placeholder="选择指定范围时填写完整 ID"></label><em class="runtime-editor-hint">强化效果先以归属声明编辑；复杂 effects 仍需在 Datapack 中维护。</em></div>`;
  }
  if (extension.editor === 'reveal-trigger') return renderRevealTriggerList(ctx, (value ?? []) as never[], problems);
  if (extension.editor === 'tag-list') return renderTagList(ctx, (value ?? []) as string[], problems);
  return '';
}

function renderAreaTopologyEditor(ctx: UIContext, values: Record<string, unknown>, editor: RuntimeDatapackEditorState): string {
  const esc = ctx.escapeHtml;
  const currentId = typeof values.idName === 'string' ? `${editor.modName}:area:${values.idName}` : '';
  // 搜索源展示完整 Registry，不因表单 initId 暂时为空或尚未同步而静默隐藏
  // 其它数据包的 Area；是否允许连接由加入动作按 Init 归属明确校验。
  const registryCandidates = runtimeEditorReferenceOptions(ctx, 'area');
  const draftCandidates = editor.areas.filter(area => {
    const areaId = `${editor.modName}:area:${area.idName}`;
    return areaId !== currentId;
  }).map(area => ({ value: `${editor.modName}:area:${area.idName}`, label: area.name }));
  const candidates = mergeRuntimeEditorReferenceOptions(registryCandidates, draftCandidates);
  const candidateLabels = new Map(candidates.map(option => [option.value, option.label]));
  const topology = Array.isArray(values.topology) ? values.topology as Array<{ areaId?: unknown; type?: unknown }> : [];
  const rows = topology.map((item, index) => {
    const areaId = typeof item.areaId === 'string' ? item.areaId : '';
    const name = candidateLabels.get(areaId) ?? ctx.game.registry.areas.get(areaId)?.name ?? areaId;
    const type = item.type === 'twoWay' ? 'twoWay' : 'oneWay';
    const typeLabel = type === 'twoWay' ? '双向' : '单向';
    return `<li class="runtime-area-topology-row" data-runtime-area-topology-row data-area-id="${esc(areaId)}" data-topology-type="${type}"><span><strong>${esc(name || areaId)}</strong><em>${esc(areaId)}</em></span><span class="runtime-editor-entry-state">${typeLabel}</span><button type="button" class="mini-action" data-runtime-area-topology-remove="${index}">移除</button></li>`;
  }).join('');
  const options = candidates.map(option => `<button type="button" role="option" class="runtime-area-topology-option" data-runtime-area-topology-option data-area-id="${esc(option.value)}" data-area-label="${esc(option.label)}"><strong>${esc(option.label)}</strong><em>${esc(option.value)}</em></button>`).join('');
  return `<div class="runtime-area-topology-editor" data-runtime-area-topology-editor><div class="runtime-editor-collection-heading"><div><h5>拓扑连接</h5><p class="runtime-editor-hint">查找全部 Registry / 草稿中的 Area，并选择单向或双向连接。连接最终必须属于同一 Init；双向连接会在提交时补齐反向边。</p></div></div><div class="runtime-area-topology-add"><div class="runtime-area-topology-picker" data-runtime-area-topology-picker><input type="search" data-runtime-area-topology-area role="combobox" aria-controls="runtime-area-topology-options" aria-expanded="false" placeholder="搜索 Area 名称或完整 ID" autocomplete="off"><div id="runtime-area-topology-options" data-runtime-area-topology-options class="runtime-area-topology-options" role="listbox" hidden>${options}<span class="runtime-area-topology-empty" data-runtime-area-topology-empty${options ? ' hidden' : ''}>${options ? '没有匹配的 Area' : '没有可用 Area'}</span></div></div><select data-runtime-area-topology-type aria-label="拓扑类型"><option value="oneWay">单向</option><option value="twoWay">双向</option></select><button type="button" class="toolbar-button" data-runtime-area-topology-add>加入拓扑</button></div>${rows ? `<ul class="runtime-area-topology-list">${rows}</ul>` : '<p class="runtime-editor-hint">还没有拓扑连接。</p>'}</div>`;
}

function renderSpotSection(
  ctx: UIContext,
  editor: RuntimeDatapackEditorState,
  section: EditorSection,
  active: string,
  views: readonly RuntimeEditorFieldView[],
  values: Record<string, unknown>,
  diff: string,
): string {
  const pageViews = views.filter(view => section.fields.some(field => field.key === view.key));
  const blocks: string[] = [];
  if (section.id === 'overview') blocks.push(renderSpotOverview(ctx, values));
  if (pageViews.length > 0) blocks.push(renderRuntimeEditorFields(ctx, pageViews, editor.problems, POLICY));
  for (const extension of section.extensions) {
    const block = renderExtensionBlock(ctx, extension, values, editor);
    if (block) blocks.push(block);
  }
  if (section.id === 'diagnostics') {
    blocks.push(renderRuntimeEditorProblems(ctx, POLICY, editor.problems));
    blocks.push(diff
      ? `<div class="runtime-editor-diff-panel"><span class="eyebrow">与运行中版本的差异</span>${diff}</div>`
      : '<p class="runtime-editor-hint">Draft 与 Runtime 一致。</p>');
  }
  const body = blocks.filter(Boolean).join('') || '<p class="runtime-editor-hint">本页暂无可编辑内容。</p>';
  return `<section class="runtime-editor-page" data-runtime-editor-section="${section.id}"${section.id === active ? '' : ' hidden'}>${body}</section>`;
}

/** 概览页：只读摘要，回答「这个 Spot 是什么」而不是先给一列输入框。 */
function renderSpotOverview(ctx: UIContext, values: Record<string, unknown>): string {
  const esc = ctx.escapeHtml;
  const areaId = String(values.areaId ?? '');
  const rows: Array<[string, string]> = [
    ['ID 名', String(values.idName ?? '（未填写）')],
    ['所属区域', ctx.game.registry.areas.get(areaId)?.name ?? (areaId || '未设置')],
    ['等级上限', values.maxLevel === undefined || values.maxLevel === '' ? '不限' : String(values.maxLevel)],
    ['功能', `${Array.isArray(values.functionalities) ? values.functionalities.length : 0} 项`],
    ['标签', `${Array.isArray(values.tags) ? values.tags.length : 0} 个`],
    ['跨世界线共享', values.global === true ? '是' : '否'],
  ];
  return `<dl class="runtime-editor-overview">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}

/** 扩展 → 集合区块：按策略表声明的子编辑器 id 分派，未知类型不渲染。 */
function renderExtensionBlock(
  ctx: UIContext,
  extension: AuthoringExtension,
  values: Record<string, unknown>,
  editor: RuntimeDatapackEditorState,
): string {
  switch (extension.editor) {
    case 'functionality':
      return renderFunctionalityList(ctx, (values.functionalities ?? []) as never[], editor.problems);
    case 'level-upgrade':
      return renderLevelUpgradeList(ctx, (values.levelUpgrades ?? []) as never[], editor.problems);
    case 'payment-options':
      return renderPaymentOptionList(ctx, (values.purchaseOptions ?? []) as never[], editor.problems);
    case 'reveal-trigger':
      return renderRevealTriggerList(ctx, (values.revealTriggers ?? []) as never[], editor.problems);
    case 'tag-list':
      return renderTagList(ctx, (values.tags ?? []) as string[], editor.problems);
    case 'gacha-pool-list':
      return renderGachaPoolList(ctx, (values.gachaPools ?? []) as string[], editor.problems);
    default:
      return '';
  }
}

function renderRuntimeSpotEntry(ctx: UIContext, editor: RuntimeDatapackEditorState, spot: RuntimeEditorSpotDraft): string {
  const esc = ctx.escapeHtml;
  const state = runtimeEditorEntryState(editor, spot);
  const removed = editor.suspendedSpotIds.includes(spot.idName);
  const areaName = ctx.game.registry.areas.get(spot.areaId)?.name ?? spot.areaId;
  const label = removed ? '已移除' : ENTRY_STATE_LABEL[state];
  const tone = removed ? 'removed' : state;
  return `<li class="runtime-spot-item" data-runtime-editor-entry="${esc(spot.idName)}" data-entry-state="${tone}"${editor.selectedSpotId === spot.idName ? ' data-selected="1"' : ''}>
    <button type="button" class="runtime-spot-item-main" data-runtime-editor-entry-edit="${esc(spot.idName)}"><span class="runtime-spot-item-name">${esc(spot.name || spot.idName)}</span><em>${esc(spot.idName)} · ${esc(areaName)}</em></button>
    <span class="runtime-editor-entry-state" data-entry-state="${tone}">${label}</span>
    <button type="button" class="mini-action" data-runtime-editor-entry-remove="${esc(spot.idName)}">删除</button>
  </li>`;
}

function filteredRuntimeSpotEntries(editor: RuntimeDatapackEditorState) {
  switch (editor.browserFilter) {
    case 'pending':
      return runtimeEditorPendingSpots(editor);
    case 'applied':
      return editor.spots.filter(spot => !editor.suspendedSpotIds.includes(spot.idName) && runtimeEditorEntryState(editor, spot) === 'unchanged');
    case 'removed':
      return editor.spots.filter(spot => editor.suspendedSpotIds.includes(spot.idName));
    default:
      return editor.spots;
  }
}

function renderError(esc: (value: string) => string, editor: RuntimeDatapackEditorState): string {
  return editor.error ? `<p class="service-result error" role="alert" aria-live="assertive">${esc(editor.error)}</p>` : '';
}

/** 温和提示（如 ID 读入大写被自动转小写）：在最终表单内提醒，不阻断提交。 */
function renderNotice(esc: (value: string) => string, editor: RuntimeDatapackEditorState): string {
  return editor.notice ? `<p class="runtime-editor-notice">${esc(editor.notice)}</p>` : '';
}
