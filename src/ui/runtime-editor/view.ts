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

export { readRuntimeEditorFields };

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
    const tone = removed ? 'removed' : state;
    const label = removed ? '已移除' : ENTRY_STATE_LABEL[state];
    const name = definition.name;
    return `<li class="runtime-spot-item" data-runtime-editor-entry="${esc(definition.idName)}" data-entry-state="${tone}">
      <button type="button" class="runtime-spot-item-main" data-runtime-editor-definition-edit data-runtime-editor-kind="${kind}" data-runtime-editor-definition-id="${esc(definition.idName)}"><span class="runtime-spot-item-name">${esc(name || definition.idName)}</span><em>${esc(definition.idName)}</em></button>
      <span class="runtime-editor-entry-state" data-entry-state="${tone}">${label}</span>
      ${removed ? `<button type="button" class="mini-action" data-runtime-editor-definition-restore data-runtime-editor-kind="${kind}" data-runtime-editor-definition-id="${esc(definition.idName)}">撤销删除</button>` : `<button type="button" class="mini-action" data-runtime-editor-definition-remove data-runtime-editor-kind="${kind}" data-runtime-editor-definition-id="${esc(definition.idName)}">删除</button>`}
    </li>`;
  }).join('');
  const filterButton = (filter: typeof editor.browserFilter, label: string) => `<button type="button" class="toolbar-button${editor.browserFilter === filter ? ' is-active' : ''}" data-runtime-editor-filter="${filter}">${label}</button>`;
  const list = visibleDefinitions.length === 0
    ? `<p class="service-summary">${policy.label} 草稿为空。点击“新建 ${policy.label}”开始。</p>`
    : filtered.length === 0 ? '<p class="service-summary">当前筛选下没有条目。</p>' : `<ul class="runtime-spot-list">${rows}</ul>`;
  const canCreate = Boolean(editor.modName && editor.displayName);
  const selected = getSelectedRuntimeEditorDefinition(editor);
  const applied = selected ? appliedDefinitions.find(definition => definition.idName === selected.idName) : undefined;
  const diff = selected ? renderRuntimeEditorDiff(runtimeEditorDiff(policy, selected, applied)) : '';
  return `<div class="runtime-editor-workspace" data-runtime-editor-definition-workspace="${kind}">
    <div class="panel-heading"><h4>内容浏览器 · ${esc(policy.label)}</h4><span class="index">${definitions.length} 草稿 / ${appliedDefinitions.length} 已生效</span>${canCreate ? `<button type="button" class="toolbar-button" data-runtime-editor-new-definition="${kind}">新建 ${esc(policy.label)}</button>` : ''}</div>
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
  const values: Record<string, unknown> = editor.formDraft ?? {
    ...runtimeEditorInitialValues(ctx, policy),
    ...(definition ?? {}),
  };
  const applied = definition
    ? runtimeEditorAppliedDefinitions(editor, kind).find(item => item.idName === definition.idName)
    : undefined;
  const views = runtimeEditorFieldViews(ctx, policy, values, { lockedFields: applied ? ['idName'] : [] });
  const sections = editorSections(policy);
  const active = sections.some(section => section.id === editor.activeSection) ? editor.activeSection! : sections[0]?.id ?? 'default';
  const tabs = sections.map(section => {
    const count = editor.problems.filter(problem => problemSectionId(policy, problem) === section.id).length;
    return `<button type="button" class="runtime-editor-tab${section.id === active ? ' is-active' : ''}${count > 0 ? ' has-runtime-editor-problem' : ''}" data-runtime-editor-section-tab="${section.id}" aria-current="${section.id === active ? 'page' : 'false'}"><span class="nav-marker"></span>${esc(section.label)}${count > 0 ? `<em class="runtime-editor-tab-error">${count}</em>` : ''}</button>`;
  }).join('');
  const current = sections.find(section => section.id === active) ?? sections[0];
  const diff = definition && applied ? renderRuntimeEditorDiff(runtimeEditorDiff(policy, values, applied)) : '';
  const pages = current ? renderDefinitionSection(ctx, editor, policy, current, active, views, values, diff) : '';
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
): string {
  const pageViews = views.filter(view => section.fields.some(field => field.key === view.key));
  const blocks: string[] = [];
  if (section.id === 'overview') blocks.push(renderDefinitionOverview(ctx, policy.label, values));
  if (pageViews.length > 0) blocks.push(renderRuntimeEditorFields(ctx, pageViews, editor.problems, policy));
  for (const extension of section.extensions) {
    const block = renderDefinitionExtension(ctx, extension, values, editor);
    if (block) blocks.push(block);
  }
  if (section.id === 'diagnostics') {
    blocks.push(renderRuntimeEditorProblems(ctx, policy, editor.problems));
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
  if (values.attachment !== undefined) rows.push(['归属', String((values.attachment as { kind?: string } | undefined)?.kind ?? '未设置')]);
  return `<dl class="runtime-editor-overview">${rows.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}

function renderDefinitionExtension(ctx: UIContext, extension: AuthoringExtension, values: Record<string, unknown>, editor: RuntimeDatapackEditorState): string {
  const esc = ctx.escapeHtml;
  const value = values[extension.inputKey];
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
  if (extension.editor === 'reveal-trigger') return renderRevealTriggerList(ctx, (value ?? []) as never[], editor.problems);
  if (extension.editor === 'tag-list') return renderTagList(ctx, (value ?? []) as string[], editor.problems);
  return '';
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
