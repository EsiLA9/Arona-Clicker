import { SPOT_CONTENT_POLICY } from '../../data-services/authoring/content-policy';
import type { UIContext } from '../context';
import type { PanelState } from './app-shell';
import {
  findRuntimeEditorAppliedSpot,
  getSelectedRuntimeEditorSpot,
  runtimeEditorEntryState,
  runtimeEditorPendingSpots,
  type RuntimeDatapackEditorState,
  type RuntimeEditorEntryState,
  type RuntimeEditorSpotDraft,
} from '../workspace/runtime-datapack-editor-state';
import {
  readRuntimeEditorFields,
  renderRuntimeEditorDiff,
  renderRuntimeEditorAffectorList,
  renderRuntimeEditorFields,
  renderRuntimeEditorProblems,
  runtimeEditorDiff,
  runtimeEditorFieldViews,
  runtimeEditorInitialValues,
} from '../workspace/runtime-editor-form';

const POLICY = SPOT_CONTENT_POLICY;

const ENTRY_STATE_LABEL: Record<RuntimeEditorEntryState, string> = {
  created: '新建',
  modified: '已修改',
  unchanged: '已生效',
};

export { readRuntimeEditorFields };

export function renderRuntimeEditorToggle(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor;
  const active = Boolean(editor?.enabled);
  const canCreateSpot = Boolean(editor?.modName && editor.displayName);
  const pending = editor ? runtimeEditorPendingSpots(editor).length : 0;
  const pendingBadge = active && pending > 0 ? `<span class="index">${pending} 项待应用</span>` : '';
  const activeActions = active
    ? `<button type="button" class="primary-button" data-runtime-editor-open>打开编辑器</button>${canCreateSpot ? '<button type="button" class="toolbar-button" data-runtime-editor-new-spot>新建 Spot</button>' : ''}<button type="button" class="toolbar-button" data-runtime-editor-close>关闭编辑态</button>`
    : '<button type="button" class="primary-button" data-runtime-editor-toggle>开启编辑态</button>';
  return `<section class="service-card runtime-editor-toggle"><div class="panel-heading"><h3>运行时数据包编辑</h3><span class="index">${active ? '编辑中' : '实验功能'}</span>${pendingBadge}</div><p>在草稿中编辑内容，确认差异后再应用到运行时；未应用前游戏画面保持不变。</p><div class="service-actions">${activeActions}</div></section>`;
}

export function renderRuntimeEditorForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const esc = ctx.escapeHtml;
  const field = (label: string, key: string, value: string | number, type = 'text') => `<label class="user-theme-field"><span>${label}</span><input data-runtime-editor-mod-field="${key}" type="${type}" value="${esc(String(value))}"></label>`;
  const hasMetadata = Boolean(editor.modName && editor.displayName);
  const hint = hasMetadata ? 'Mod 信息已锁定为编辑命名空间；继续编辑内容不需要再次保存。' : '先填写并保存 Mod 信息，随后才能创建内容。';
  return `<div class="runtime-editor-form">${renderError(esc, editor)}<h4>Mod 元信息</h4>${field('modName', 'modName', editor.modName)}${field('显示名称', 'displayName', editor.displayName)}${field('版本', 'version', editor.version)}${field('作者', 'author', editor.author)}${field('简介', 'description', editor.description)}<div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-create>校验并保存 Mod 信息</button><span class="service-draft-status">${hasMetadata ? '已配置' : '待配置'}</span></div><p class="service-summary">${hint}</p></div>`;
}

/** 内容浏览器 + Draft/Runtime 差异 + Apply：编辑器骨架的常驻视图。 */
export function renderRuntimeEditorWorkspace(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor;
  if (!editor) return '';
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
  return `<div class="runtime-editor-workspace">
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

export function renderRuntimeSpotForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const esc = ctx.escapeHtml;
  const spot = getSelectedRuntimeEditorSpot(editor);
  const values: Record<string, unknown> = {
    ...runtimeEditorInitialValues(ctx, POLICY, { preferredRefValue: editor.selectedAreaId }),
    ...(spot ?? {}),
  };
  const applied = spot ? findRuntimeEditorAppliedSpot(editor, spot.idName) : undefined;
  const views = runtimeEditorFieldViews(ctx, POLICY, values, {
    lockedFields: applied ? ['idName'] : [],
  });
  const diff = spot && applied ? renderRuntimeEditorDiff(runtimeEditorDiff(POLICY, values, applied)) : '';
  const areas = [...ctx.game.registry.areas.values()];
  const notice = areas.length === 0
    ? '<p class="service-result error">当前 Registry 没有 Area，无法创建 Spot。</p>'
    : '';
  return `<div class="runtime-editor-form">${notice}${renderError(esc, editor)}<h4>${spot ? '编辑 Spot' : '新建 Spot'}</h4><p class="service-summary">${spot ? '保存只写入草稿；差异确认后再应用到运行时。' : '保存后加入草稿，不会立刻改变游戏。'}</p>${renderRuntimeEditorFields(ctx, views, editor.problems, POLICY)}${renderRuntimeEditorAffectorList(ctx, values.affectors ?? [], editor.problems)}${renderRuntimeEditorProblems(ctx, POLICY, editor.problems)}${diff ? `<div class="runtime-editor-diff-panel"><span class="eyebrow">与运行中版本的差异</span>${diff}</div>` : ''}<div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-create-spot>${spot ? '保存 Spot 修改' : '加入草稿'}</button><button type="button" class="primary-button" data-runtime-editor-apply>应用到运行时</button>${spot ? '<button type="button" class="toolbar-button danger" data-runtime-editor-delete-spot>删除 Spot</button>' : ''}</div></div>`;
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
  return editor.error ? `<p class="service-result error">${esc(editor.error)}</p>` : '';
}
