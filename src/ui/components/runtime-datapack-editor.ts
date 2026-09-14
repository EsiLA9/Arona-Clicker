import type { UIContext } from '../context';
import type { PanelState } from './app-shell';

export function renderRuntimeEditorToggle(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor;
  const active = Boolean(editor?.enabled);
  return `<section class="service-card runtime-editor-toggle"><div class="panel-heading"><h3>运行时数据包编辑</h3><span class="index">${active ? '编辑中' : '实验功能'}</span></div><p>以当前已加载的数据包为背景，创建一个独立的 Mod 草稿。</p><div class="service-actions">${active ? '<button type="button" class="primary-button" data-runtime-editor-open>打开编辑器</button><button type="button" class="toolbar-button" data-runtime-editor-close>关闭编辑态</button>' : '<button type="button" class="primary-button" data-runtime-editor-toggle>开启编辑态</button>'}</div></section>`;
}

export function renderRuntimeEditorForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const esc = ctx.escapeHtml;
  const field = (label: string, key: string, value: string | number, type = 'text') => `<label class="user-theme-field"><span>${label}</span><input data-runtime-editor-field="${key}" type="${type}" value="${esc(String(value))}"></label>`;
  return `<div class="runtime-editor-form">${editor.error ? `<p class="service-result error">${esc(editor.error)}</p>` : ''}<h4>Mod 元信息</h4>${field('modName', 'modName', editor.modName)}${field('显示名称', 'displayName', editor.displayName)}${field('版本', 'version', editor.version)}${field('作者', 'author', editor.author)}${field('简介', 'description', editor.description)}<div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-create>创建 / 更新 Mod 草稿</button></div><p class="service-summary">实体内容请在对应的游戏 Workspace 中创建，例如进入 Area 后使用右下角的 Spot 创建入口。</p></div>`;
}

export function renderRuntimeSpotForm(ctx: UIContext, state: PanelState): string {
  const editor = state.runtimeDatapackEditor!;
  const areas = [...ctx.game.registry.areas.values()];
  const areaId = editor.selectedAreaId ?? areas[0]?.id ?? '';
  const esc = ctx.escapeHtml;
  const field = (label: string, key: string, value: string | number, type = 'text') => `<label class="user-theme-field"><span>${label}</span><input data-runtime-editor-field="${key}" type="${type}" value="${esc(String(value))}"></label>`;
  const options = areas.map(area => `<option value="${esc(area.id)}" ${area.id === areaId ? 'selected' : ''}>${esc(area.name)}</option>`).join('');
  const spot = editor.spot;
  const editing = Boolean(editor.applied);
  return `<div class="runtime-editor-form">${editor.error ? `<p class="service-result error">${esc(editor.error)}</p>` : ''}<p class="service-summary">已带入当前 Area：${esc(ctx.game.registry.areas.get(areaId)?.name ?? areaId)}。请继续填写 Spot 信息。</p><h4>Spot 信息</h4><label class="user-theme-field"><span>所属 Area</span><select data-runtime-editor-field="selectedAreaId">${options}</select></label>${field('Spot ID 名', 'spotIdName', spot?.idName ?? 'new-spot')}${field('名称', 'spotName', spot?.name ?? '')}${field('描述', 'spotDescription', spot?.description ?? '')}${field('基础花费', 'baseCost', spot?.baseCost ?? 0, 'number')}${field('花费资源', 'baseCostResource', spot?.baseCostResource ?? 'base:resource:credit')}${field('基础产出', 'baseYield', spot?.baseYield ?? 0, 'number')}${field('产出资源', 'baseYieldResource', spot?.baseYieldResource ?? 'base:resource:credit')}${field('容量', 'baseCapacity', spot?.baseCapacity ?? 0, 'number')}${editing ? '<p class="service-result success">当前正在编辑已载入的临时 Spot。</p>' : ''}<div class="service-actions"><button type="button" class="primary-button" data-runtime-editor-create-spot>${editing ? '保存 Spot 修改' : '创建并载入 Spot'}</button><button type="button" class="toolbar-button" data-runtime-editor-discard-spot ${spot ? '' : 'disabled'}>清除 Spot</button>${editing ? '<button type="button" class="toolbar-button danger" data-runtime-editor-delete-spot>删除临时 Spot</button>' : ''}</div>${spot ? `<p class="service-summary">运行时 ID：${esc(editor.modName)}:spot:${esc(spot.idName)}<br>挂载 Area：${esc(areaId)}</p>` : ''}</div>`;
}
