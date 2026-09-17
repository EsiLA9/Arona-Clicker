import type { UIContext } from '../context';
import type { PackCatalogReadModel } from '../../arona-clicker/contracts';
import type { PanelState } from './app-shell';
import {
  buildDatapackWorkspaceView,
  dependencyState,
  packCapabilities,
  packMoveAvailability,
  type DatapackWorkspaceSection,
  type DatapackWorkspaceView,
} from '../../arona-clicker/services/datapack-workspace-view';
import { renderWorkspaceFrame } from './workspace-frame';
import { renderRuntimeEditorToggle } from '../runtime-editor/view';

export type ServiceWorkspaceId = 'datapack' | 'saves' | 'records';

type ServiceColumn = 'navigation' | 'main' | 'inspector';

function hostId(service: ServiceWorkspaceId, column: ServiceColumn): string {
  const root = column === 'navigation' ? 'leftPanel' : column === 'main' ? 'centerPanel' : 'rightPanel';
  return `${root}.service.${service}.${column}`;
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

function serviceTitle(service: ServiceWorkspaceId): string {
  return service === 'datapack' ? '数据包管理' : service === 'saves' ? '存读档' : '图鉴与统计';
}

const SECTION_LABELS: Record<DatapackWorkspaceSection, string> = {
  all: '全部数据包', enabled: '已启用', disabled: '未启用', issues: '有问题', import: '导入',
};

function renderNavigation(service: ServiceWorkspaceId, state: PanelState, view?: DatapackWorkspaceView): string {
  const items = service === 'datapack'
    ? (view?.sections ?? []).map(section => ({ id: section.id, label: SECTION_LABELS[section.id], count: section.count }))
    : service === 'saves'
      ? ['当前进度', '本地存档', '自动保存', '导入 / 导出', '存档检查'].map((label, index) => ({ id: String(index), label, count: null }))
      : ['图鉴总览', '故事', '学生', '设施与物品', '统计总览', '标签', '数据包贡献'].map((label, index) => ({ id: String(index), label, count: null }));
  return items.map((item, index) => {
    const active = service === 'datapack' ? state.datapackWorkspace?.section === item.id : index === 0;
    const action = service === 'datapack' ? `data-datapack-section="${item.id}"` : '';
    const count = item.count === null ? '' : `<small class="service-nav-count">${item.count}</small>`;
    return `<button class="nav-item service-nav-item ${active ? 'active' : ''}" type="button" ${action} aria-current="${active ? 'page' : 'false'}"><span class="nav-marker"></span><span>${escape(item.label)}</span>${count}<small>${active ? '当前' : '查看'}</small></button>`;
  }).join('');
}

function sectionTitle(section: DatapackWorkspaceSection): string {
  return SECTION_LABELS[section];
}

function dependencyLabel(status: ReturnType<typeof dependencyState>): string {
  return status === 'enabled-in-sequence' ? '已在当前序列' : status === 'available-not-enabled' ? '包库已有，未加入序列' : '包库中缺失';
}

function renderPackEntry(pack: NonNullable<DatapackWorkspaceView['selection']>, state: PanelState, view: DatapackWorkspaceView, allowReorder: boolean): string {
  const selected = state.datapackWorkspace?.selectedPackId === pack.id;
  const draftEnabled = view.draftEnabledIds.has(pack.id);
  const capabilities = packCapabilities(pack);
  const formalEnabled = pack.enabled;
  const draftChanged = draftEnabled !== formalEnabled;
  const invalid = view.invalidIds.has(pack.id);
  const dependencyText = pack.dependencies.length === 0
    ? '<span class="pack-dependency ok">无依赖</span>'
    : pack.dependencies.map(dependency => {
      const status = dependencyState(dependency, view.entries, view.draftEnabledIds);
      return `<span class="pack-dependency ${status}">${escape(dependency)} · ${dependencyLabel(status)}</span>`;
    }).join('');
  const move = packMoveAvailability(pack.id, view.entries, view.order, allowReorder);
  const orderIndex = view.order.indexOf(pack.id);
  const canMoveUp = move.canMoveUp;
  const canMoveDown = move.canMoveDown;
  const upTitle = !allowReorder
    ? '请在「全部数据包」中调整加载顺序'
    : canMoveUp ? '上移（越靠前越先加载）'
      : orderIndex <= 0 ? '已经是第一个数据包' : '前方是核心数据包，不可越过';
  const downTitle = !allowReorder
    ? '请在「全部数据包」中调整加载顺序'
    : canMoveDown ? '下移'
      : orderIndex < 0 || orderIndex >= view.order.length - 1 ? '已经是最后一个数据包' : '后方是核心数据包，不可越过';
  const removableNow = capabilities.removable && !formalEnabled && !draftEnabled;
  return `<article class="pack-entry ${selected ? 'is-selected' : ''} ${draftChanged ? 'is-draft-changed' : ''} ${invalid ? 'is-invalid' : ''}" data-pack-id="${escape(pack.id)}">
    <button type="button" class="pack-entry-select" data-pack-select="${escape(pack.id)}" aria-pressed="${selected ? 'true' : 'false'}">
      <span class="pack-entry-main"><strong>${escape(pack.name)}</strong><span>${escape(pack.modName)} · v${escape(pack.version)}</span></span>
    <span class="pack-entry-meta">${pack.author ? `作者：${escape(pack.author)} · ` : ''}${capabilities.required ? '核心包 · 始终启用' : pack.sourceKind === 'builtin' ? '内置数据包' : escape(pack.sourceKind)} · ${dependencyText}</span>
    </button>
    <div class="pack-entry-status"><span class="pack-state ${formalEnabled ? 'enabled' : 'disabled'}">${formalEnabled ? '正式启用' : '未启用'}</span>${draftChanged ? `<span class="pack-state draft">草案${draftEnabled ? '启用' : '停用'}</span>` : ''}${invalid ? '<span class="pack-state invalid">校验未通过</span>' : ''}</div>
    <div class="pack-entry-actions">
      ${capabilities.enableable ? `<button class="toolbar-button" data-pack-draft-toggle="${escape(pack.id)}">${draftEnabled ? '移出启用集' : '加入启用集'}</button>` : '<span class="pack-fixed-state">始终启用</span>'}
      <button class="toolbar-button" data-pack-draft-up="${escape(pack.id)}" title="${upTitle}" ${canMoveUp ? '' : 'disabled'}>上移</button>
      <button class="toolbar-button" data-pack-draft-down="${escape(pack.id)}" title="${downTitle}" ${canMoveDown ? '' : 'disabled'}>下移</button>
      ${removableNow ? `<button class="toolbar-button" data-pack-remove="${escape(pack.id)}" title="从包库移除">移除</button>` : ''}
    </div>
  </article>`;
}

function renderDatapackInspector(ctx: UIContext, state: PanelState, view: DatapackWorkspaceView, dependencyStatus: Map<string, string>): string {
  const selected = view.selection;
  if (!selected) return '<section class="service-card service-empty"><strong>选择数据包查看详情</strong></section>';
  const capabilities = packCapabilities(selected);
  const formalEnabled = selected.enabled;
  const dependencyRows = selected.dependencies.map(dependency => {
    const formal = dependencyStatus.get(`${selected.id}:${dependency}`);
    const formalText = !formalEnabled
      ? '未启用（不校验）'
      : formal === 'enabled' ? '已在序列'
        : formal === 'available' ? '包库已有，未启用'
          : '缺失';
    const draft = dependencyState(dependency, view.entries, view.draftEnabledIds);
    return `<li><strong>${escape(dependency)}</strong><span>正式：${formalText}</span><span>草案：${dependencyLabel(draft)}</span></li>`;
  });
  const issues = view.issues.get(selected.id) ?? [];
  const issueList = issues.length
    ? `<ul class="service-issue-list pack-validation-errors">${issues.map(issue => `<li>${escape(issue.detail)}</li>`).join('')}</ul>`
    : '';
  return `<section class="service-card"><div class="panel-heading"><h3>${escape(selected.name)}</h3><span class="index">${formalEnabled ? '正式启用' : '未启用'}</span></div><dl class="pack-detail-list"><div><dt>modName</dt><dd>${escape(selected.modName)}</dd></div><div><dt>版本</dt><dd>${escape(selected.version)}</dd></div><div><dt>来源</dt><dd>${capabilities.required ? '核心内置数据包' : selected.sourceKind === 'builtin' ? '内置数据包' : escape(selected.sourceKind)}</dd></div><div><dt>导入时间</dt><dd>${ctx.formatTime(selected.importedAt)}</dd></div></dl><h4>依赖</h4>${dependencyRows.length ? `<ul class="service-dependency-list">${dependencyRows.join('')}</ul>` : '<p class="service-ok">无依赖</p>'}${issueList}<h4>启用集</h4><p>${capabilities.required ? '核心包，始终启用' : view.draftEnabledIds.has(selected.id) ? '草案：启用' : '草案：未启用'}</p></section>`;
}

function renderDatapackMain(ctx: UIContext, state: PanelState, catalog: ReturnType<NonNullable<PackCatalogReadModel['getPackCatalog']>> | undefined, view: DatapackWorkspaceView): string {
  const workspace = state.datapackWorkspace;
  const section = view.section;
  const entries = view.entries;
  const filtered = view.filteredEntries;
  const changed = view.changed;
  if (section === 'import') return `<div class="service-heading"><h2>导入数据包</h2></div><section class="service-card import-guide"><button class="primary-button" id="import-datapack">选择 ZIP 文件</button></section>`;
  const body = catalog ? (filtered.length ? `<div class="pack-catalog">${filtered.map(pack => renderPackEntry(pack, state, view, section === 'all')).join('')}</div>` : '<div class="service-empty"><strong>没有匹配的数据包</strong></div>') : '<div class="service-empty"><strong>包库服务不可用</strong></div>';
  const result = workspace?.lastResult ? `<div class="service-result ${workspace.lastResult.ok ? 'success' : 'error'}">${escape(workspace.lastResult.message)}</div>` : '';
  const validation = workspace?.validation && !workspace.validation.ok
    ? `<ul class="service-issue-list pack-validation-errors">${workspace.validation.errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul>`
    : workspace?.validation?.warnings.length
      ? `<ul class="service-warning-list">${workspace.validation.warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul>`
      : '';
  const reorderHint = section === 'all' ? '' : '<span class="service-draft-status">加载顺序只能在「全部数据包」中调整</span>';
  return `
    <div class="service-heading"><h2>${sectionTitle(section)}</h2><span class="service-status">${view.draftEnabledIds.size} 启用 · ${entries.length} 已导入</span></div>
    <div class="service-actions"><button class="primary-button" id="import-datapack">导入数据包</button>${changed ? '<span class="service-draft-status">有未应用变更</span>' : '<span class="service-draft-status">当前配置已应用</span>'}${reorderHint}</div>
    ${result}<section class="service-card service-pack-list"><div class="panel-heading"><h3>${section === 'all' ? '全部数据包' : sectionTitle(section)}</h3><span class="index">${filtered.length} 个</span></div>${body}</section>${section === 'all' ? renderRuntimeEditorToggle(ctx, state) : ''}
    <section class="service-card pack-draft-actions"><div class="panel-heading"><h3>启用集草案</h3><span class="index">${changed ? '待校验' : '已应用'}</span></div>${validation}<div class="service-actions"><button class="toolbar-button" data-pack-discard ${changed ? '' : 'disabled'}>放弃</button><button class="toolbar-button" data-pack-validate ${changed ? '' : 'disabled'}>校验</button><button class="primary-button" data-pack-apply ${changed ? '' : 'disabled'}>保存并应用</button></div></section>`;
}

function renderSavesMain(ctx: UIContext): string {
  const view = ctx.view;
  return `
    <div class="service-heading"><div><span class="eyebrow">SAVE WORKSPACE</span><h2>${serviceTitle('saves')}</h2><p>保存和读取都在这里完成，顶部入口只负责进入服务。</p></div><span class="service-status">${ctx.saveExists ? '已有本地存档' : '尚无本地存档'}</span></div>
    <div class="service-card"><div class="panel-heading"><h3>当前进度</h3><span class="index">${view.activeInit ? escape(ctx.nameOf('init', view.activeInit)) : '未进入世界线'}</span></div><p class="service-summary">帧数 ${ctx.formatNumber(view.totalFrames)} · 当前区域 ${view.currentAreaId ? escape(ctx.nameOf('area', view.currentAreaId)) : '未进入'}</p><div class="service-actions"><button class="primary-button" id="save-game">保存当前进度</button><button class="toolbar-button" id="load-game" ${ctx.saveExists ? '' : 'disabled'}>读取并替换当前进度</button><button class="toolbar-button" id="new-game">开始新游戏</button></div></div>
    <section class="service-card"><h3>读取前检查</h3><p>读取会替换当前运行状态。实际覆盖范围与数据包环境差异将在后续存档检查面板中展开。</p></section>`;
}

function renderRecordsMain(ctx: UIContext): string {
  const registry = ctx.game.registry;
  const counts = [
    ['学生', registry.characters.size], ['故事', registry.stories.size], ['设施', registry.spots.size], ['物品', registry.items.size], ['标签来源', registry.characters.size],
  ];
  return `
    <div class="service-heading"><div><span class="eyebrow">RECORDS WORKSPACE</span><h2>${serviceTitle('records')}</h2><p>统一查看已发现内容与统计口径；条目本身保持只读。</p></div><span class="service-status">当前世界线</span></div>
    <div class="service-actions"><button class="primary-button" id="collection-modal">打开完整图鉴</button></div>
    <section class="service-card"><div class="panel-heading"><h3>内容总览</h3><span class="index">当前 Registry</span></div><div class="service-stat-grid">${counts.map(([label, count]) => `<div><strong>${count}</strong><span>${label}</span></div>`).join('')}</div></section>
    <section class="service-card"><h3>统计口径</h3><p>当前页显示当前 Registry 的内容规模；玩家发现、累计值、本世界线和全局值将在统计分类页分别展示。</p></section>`;
}

export function renderServiceWorkspace(ctx: UIContext, service: ServiceWorkspaceId, state: PanelState): string {
  const host = ctx.game as UIContext['game'] & Partial<PackCatalogReadModel>;
  const catalog = host.getPackCatalog?.();
  const datapackView = service === 'datapack'
    ? buildDatapackWorkspaceView({
      entries: catalog?.entries ?? [],
      section: state.datapackWorkspace?.section ?? 'all',
      draftOrder: state.datapackWorkspace?.draftOrder,
      draftEnabledIds: state.datapackWorkspace?.draftEnabledIds,
      selectedPackId: state.datapackWorkspace?.selectedPackId,
      validation: state.datapackWorkspace?.validation,
    })
    : undefined;
  const main = service === 'datapack' ? renderDatapackMain(ctx, state, catalog, datapackView!) : service === 'saves' ? renderSavesMain(ctx) : renderRecordsMain(ctx);
  const navigation = `<div class="service-column-title"><strong>${serviceTitle(service)}</strong></div>${renderNavigation(service, state, datapackView)}`;
  const dependencyStatus = new Map((catalog?.dependencies ?? []).map(hint => [`${hint.packId}:${hint.dependency}`, hint.status]));
  const inspector = service === 'datapack'
    ? `<div class="service-column-title"><strong>${state.datapackWorkspace?.selectedPackId ? '数据包详情' : '当前选择'}</strong></div>${renderDatapackInspector(ctx, state, datapackView!, dependencyStatus)}`
    : `<div class="service-column-title"><span class="eyebrow">INSPECTOR</span><strong>当前选择</strong></div><section class="service-card"><h3>${service === 'saves' ? '安全提示' : '只读记录'}</h3><p>${service === 'saves' ? '读取、新游戏和删除等操作会影响进度，确认前必须查看覆盖范围。' : '图鉴与统计展示来源、范围和状态，不直接修改 PlayerState。'}</p></section><section class="service-card"><h3>下一步</h3><p>选择左侧分类或使用中部主要操作。操作结果会保留在当前页面并通过通知反馈。</p></section>`;
  return renderWorkspaceFrame(ctx, {
    id: `service-${service}`,
    layout: { responsive: 'two-column' },
    left: { slot: 'left', workspaceOwner: service, hostId: hostId(service, 'navigation'), themeScope: `left.${service}.navigation`, surface: 'panel', className: 'service-column service-navigation', content: navigation },
    center: { slot: 'center', workspaceOwner: service, hostId: hostId(service, 'main'), themeScope: `center.${service}.main`, surface: 'panel', className: 'service-column service-main', content: main, scroll: 'content' },
    right: { slot: 'right', workspaceOwner: service, hostId: hostId(service, 'inspector'), themeScope: `right.${service}.inspector`, surface: 'panel', className: 'service-column service-inspector', content: inspector },
  });
}
