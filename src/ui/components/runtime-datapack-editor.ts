import type { UIContext } from '../context';
import type { PanelState } from './app-shell';
import { getSelectedRuntimeEditorSpot } from '../workspace/runtime-datapack-editor-state';

export function renderRuntimeEditorToggle(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor;
  const active = Boolean(editor?.enabled);
  const canCreateSpot = Boolean(editor?.modName && editor.displayName);
  const activeActions = active
    ? `<button type="button" class="primary-button" data-runtime-editor-open>编辑 Mod 信息</button>${canCreateSpot ? '<button type="button" class="toolbar-button" data-runtime-editor-new-spot>新建 Spot</button>' : ''}<button type="button" class="toolbar-button" data-runtime-editor-close>关闭编辑态</button>`
    : '<button type="button" class="primary-button" data-runtime-editor-toggle>开启编辑态</button>';
  return `<section class="service-card runtime-editor-toggle"><div class="panel-heading"><h3>运行时数据包编辑</h3><span class="index">${active ? '编辑中' : '实验功能'}</span></div><p>每次只处理一个 Spot：新建或修改后立即显示在游戏栏，删除时先选择 PlayerData 处理方式。</p><div class="service-actions">${activeActions}</div></section>`;
}

export function renderRuntimeEditorForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const esc = ctx.escapeHtml;
  const field = (label: string, key: string, value: string | number, type = 'text') => `<label class="user-theme-field"><span>${label}</span><input data-runtime-editor-field="${key}" type="${type}" value="${esc(String(value))}"></label>`;
  const hasMetadata = Boolean(editor.modName && editor.displayName);
  const hint = hasMetadata ? '保存 Mod 信息后，可以从游戏栏或此处逐个新建、编辑 Spot。' : '首次开启编辑态时先填写一次 Mod 信息，随后会直接进入新建 Spot。';
  return `<div class="runtime-editor-form">${editor.error ? `<p class="service-result error">${esc(editor.error)}</p>` : ''}<h4>Mod 元信息</h4>${field('modName', 'modName', editor.modName)}${field('显示名称', 'displayName', editor.displayName)}${field('版本', 'version', editor.version)}${field('作者', 'author', editor.author)}${field('简介', 'description', editor.description)}<div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-create>校验并保存 Mod 信息</button><span class="service-draft-status">${hasMetadata ? '已配置' : '待配置'}</span></div><p class="service-summary">${hint}</p>${hasMetadata ? '<div class="service-actions"><button type="button" class="toolbar-button" data-runtime-editor-new-spot>新建 Spot</button></div>' : ''}</div>`;
}

export function renderRuntimeSpotForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const areas = [...ctx.game.registry.areas.values()];
  const spot = getSelectedRuntimeEditorSpot(editor);
  const areaId = spot?.areaId ?? editor.selectedAreaId ?? areas[0]?.id ?? '';
  const esc = ctx.escapeHtml;
  const field = (label: string, key: string, value: string | number, type = 'text') => `<label class="user-theme-field"><span>${label}</span><input data-runtime-editor-field="${key}" type="${type}" value="${esc(String(value))}"></label>`;
  const options = areas.map(area => `<option value="${esc(area.id)}" ${area.id === areaId ? 'selected' : ''}>${esc(area.name)}</option>`).join('');
  const editing = Boolean(spot);
  const stateText = editing ? '保存后立即更新游戏栏中的这个 Spot。' : '保存后立即把这个 Spot 加入游戏栏。';
  return `<div class="runtime-editor-form">${editor.error ? `<p class="service-result error">${esc(editor.error)}</p>` : ''}<h4>${editing ? '编辑 Spot' : '新建 Spot'}</h4><p class="service-summary">${esc(stateText)}</p><label class="user-theme-field"><span>所属 Area</span><select data-runtime-editor-field="selectedAreaId">${options}</select></label>${field('Spot ID 名', 'spotIdName', spot?.idName ?? 'new-spot')}${field('名称', 'spotName', spot?.name ?? '')}${field('描述', 'spotDescription', spot?.description ?? '')}${field('基础花费', 'baseCost', spot?.baseCost ?? 0, 'number')}${field('花费资源', 'baseCostResource', spot?.baseCostResource ?? 'base:resource:credit')}${field('基础产出', 'baseYield', spot?.baseYield ?? 0, 'number')}${field('产出资源', 'baseYieldResource', spot?.baseYieldResource ?? 'base:resource:credit')}${field('容量', 'baseCapacity', spot?.baseCapacity ?? 0, 'number')}<div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-create-spot>${editing ? '保存 Spot 修改' : '创建 Spot'}</button>${editing ? '<button type="button" class="toolbar-button danger" data-runtime-editor-delete-spot>删除 Spot</button>' : ''}</div>${spot ? `<p class="service-summary">运行时 ID：${esc(editor.modName)}:spot:${esc(spot.idName)}<br>挂载 Area：${esc(areaId)}</p>` : ''}</div>`;
}
