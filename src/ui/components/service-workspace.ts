import type { UIContext } from '../context';
import type { PackCatalogReadModel, PackCatalogEntry } from '../../arona-clicker/contracts';
import type { PanelState, DatapackWorkspaceSection } from './app-shell';
import { renderUIHost } from '../presentation-service';

export type ServiceWorkspaceId = 'datapack' | 'saves' | 'records';

type ServiceColumn = 'navigation' | 'main' | 'inspector';

function hostId(service: ServiceWorkspaceId, column: ServiceColumn): string {
  return `centerPanel.${service}.${column}`;
}

function renderServiceColumn(ctx: UIContext, service: ServiceWorkspaceId, column: ServiceColumn, className: string, content: string): string {
  return renderUIHost(ctx, {
    hostId: hostId(service, column),
    className: `service-column ${className}`,
    themeScope: `center.${service}.${column}`,
    content,
  });
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

function renderNavigation(ctx: UIContext, service: ServiceWorkspaceId, state: PanelState): string {
  const items = service === 'datapack'
    ? (Object.keys(SECTION_LABELS) as DatapackWorkspaceSection[]).map(section => {
      const catalog = (ctx.game as UIContext['game'] & Partial<PackCatalogReadModel>).getPackCatalog?.();
      const dependencyStatus = new Map((catalog?.dependencies ?? []).map(hint => [`${hint.packId}:${hint.dependency}`, hint.status]));
      const count = section === 'all' ? catalog?.entries.length ?? 0 : section === 'enabled' ? catalog?.entries.filter(entry => entry.enabled).length ?? 0 : section === 'disabled' ? catalog?.entries.filter(entry => !entry.enabled).length ?? 0 : section === 'issues' ? catalog?.entries.filter(entry => hasPackIssue(entry, dependencyStatus)).length ?? 0 : null;
      return { id: section, label: SECTION_LABELS[section], count };
    })
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

function hasPackIssue(pack: PackCatalogEntry, dependencyStatus: Map<string, string>): boolean {
  return pack.dependencies.some(dependency => dependencyStatus.get(`${pack.id}:${dependency}`) === 'missing');
}

function dependencyState(dependency: string, entries: readonly PackCatalogEntry[], enabledIds: ReadonlySet<string>): 'enabled-in-sequence' | 'available-not-enabled' | 'missing' {
  const matches = entries.filter(entry => entry.modName === dependency);
  if (matches.some(entry => enabledIds.has(entry.id))) return 'enabled-in-sequence';
  return matches.length ? 'available-not-enabled' : 'missing';
}

function dependencyLabel(status: ReturnType<typeof dependencyState>): string {
  return status === 'enabled-in-sequence' ? '已在当前序列' : status === 'available-not-enabled' ? '包库已有，未加入序列' : '包库中缺失';
}

function packCapabilities(pack: PackCatalogEntry): NonNullable<PackCatalogEntry['capabilities']> {
  return pack.capabilities ?? {
    required: pack.sourceKind === 'builtin',
    removable: pack.sourceKind !== 'builtin',
    reorderable: pack.sourceKind !== 'builtin',
    enableable: pack.sourceKind !== 'builtin',
  };
}

function renderPackEntry(pack: PackCatalogEntry, ctx: UIContext, state: PanelState, entries: readonly PackCatalogEntry[], order: readonly string[], enabledIds: ReadonlySet<string>): string {
  const selected = state.datapackWorkspace?.selectedPackId === pack.id;
  const draftEnabled = enabledIds.has(pack.id);
  const capabilities = packCapabilities(pack);
  const formalEnabled = pack.enabled;
  const orderIndex = order.indexOf(pack.id);
  const draftChanged = draftEnabled !== formalEnabled;
  const dependencyText = pack.dependencies.length === 0
    ? '<span class="pack-dependency ok">无依赖</span>'
    : pack.dependencies.map(dependency => {
       const status = dependencyState(dependency, entries, enabledIds);
       return `<span class="pack-dependency ${status}">${escape(dependency)} · ${dependencyLabel(status)}</span>`;
     }).join('');
  return `<article class="pack-entry ${selected ? 'is-selected' : ''} ${draftChanged ? 'is-draft-changed' : ''}" data-pack-id="${escape(pack.id)}">
    <button type="button" class="pack-entry-select" data-pack-select="${escape(pack.id)}" aria-selected="${selected ? 'true' : 'false'}">
      <span class="pack-entry-main"><strong>${escape(pack.name)}</strong><span>${escape(pack.modName)} · v${escape(pack.version)}</span></span>
    <span class="pack-entry-meta">${pack.author ? `作者：${escape(pack.author)} · ` : ''}${capabilities.required ? '核心包 · 始终启用' : pack.sourceKind === 'builtin' ? '内置数据包' : escape(pack.sourceKind)} · ${dependencyText}</span>
    </button>
    <div class="pack-entry-status"><span class="pack-state ${formalEnabled ? 'enabled' : 'disabled'}">${formalEnabled ? '正式启用' : '未启用'}</span>${draftChanged ? `<span class="pack-state draft">草案${draftEnabled ? '启用' : '停用'}</span>` : ''}</div>
    <div class="pack-entry-actions">
      ${capabilities.enableable ? `<button class="toolbar-button" data-pack-draft-toggle="${escape(pack.id)}">${draftEnabled ? '移出启用集' : '加入启用集'}</button>` : '<span class="pack-fixed-state">始终启用</span>'}
      <button class="toolbar-button" data-pack-draft-up="${escape(pack.id)}" title="${orderIndex <= 0 ? '已经是第一个数据包' : '上移'}" ${!capabilities.reorderable || orderIndex <= 0 ? 'disabled' : ''}>上移</button>
      <button class="toolbar-button" data-pack-draft-down="${escape(pack.id)}" title="${orderIndex < 0 || orderIndex >= order.length - 1 ? '已经是最后一个数据包' : '下移'}" ${!capabilities.reorderable || orderIndex < 0 || orderIndex >= order.length - 1 ? 'disabled' : ''}>下移</button>
    </div>
  </article>`;
}

function renderDatapackInspector(ctx: UIContext, state: PanelState, entries: readonly PackCatalogEntry[], dependencyStatus: Map<string, string>): string {
  const selected = entries.find(entry => entry.id === state.datapackWorkspace?.selectedPackId);
  if (!selected) return '<section class="service-card service-empty"><strong>请选择一个数据包</strong><p>选择后将在这里显示版本、来源、依赖和应用影响。</p></section>';
  const draftEnabledIds = new Set(state.datapackWorkspace?.draftEnabledIds ?? entries.filter(entry => entry.enabled).map(entry => entry.id));
  const dependencyRows = selected.dependencies.map(dependency => {
    const formal = dependencyStatus.get(`${selected.id}:${dependency}`) ?? 'missing';
    const draft = dependencyState(dependency, entries, draftEnabledIds);
    return `<li><strong>${escape(dependency)}</strong><span>正式：${formal === 'enabled' ? '已在序列' : formal === 'available' ? '未启用' : '缺失'}</span><span>草案：${dependencyLabel(draft)}</span></li>`;
  });
  const issues = dependencyRows.length && dependencyRows.some(row => row.includes('缺失'));
  const capabilities = packCapabilities(selected);
  return `<section class="service-card"><div class="panel-heading"><h3>${escape(selected.name)}</h3><span class="index">${selected.enabled ? '正式启用' : '未启用'}</span></div><dl class="pack-detail-list"><div><dt>modName</dt><dd>${escape(selected.modName)}</dd></div><div><dt>版本</dt><dd>${escape(selected.version)}</dd></div><div><dt>来源</dt><dd>${capabilities.required ? '核心内置数据包' : selected.sourceKind === 'builtin' ? '内置数据包' : escape(selected.sourceKind)}</dd></div><div><dt>导入时间</dt><dd>${ctx.formatTime(selected.importedAt)}</dd></div></dl></section><section class="service-card"><h3>依赖与序列状态</h3>${dependencyRows.length ? `<ul class="service-dependency-list">${dependencyRows.join('')}</ul>` : '<p class="service-ok">此包没有声明依赖。</p>'}${issues ? '<p class="service-warning">当前草案无法满足全部依赖。</p>' : ''}</section><section class="service-card"><h3>当前选择</h3><p>${capabilities.required ? '核心包始终保留在启用集内。' : state.datapackWorkspace?.draftEnabledIds.includes(selected.id) ? '草案将保留此包在启用集内。' : '草案未将此包加入启用集。'}</p></section>`;
}

function renderDatapackMain(ctx: UIContext, state: PanelState): string {
  const host = ctx.game as UIContext['game'] & Partial<PackCatalogReadModel>;
  const catalog = host.getPackCatalog?.();
  const entries = catalog?.entries ?? [];
  const workspace = state.datapackWorkspace;
  const section = workspace?.section ?? 'all';
  const dependencyStatus = new Map((catalog?.dependencies ?? []).map(hint => [`${hint.packId}:${hint.dependency}`, hint.status]));
  const order = workspace?.draftOrder ?? entries.map(entry => entry.id);
  const enabledIds = new Set(workspace?.draftEnabledIds ?? entries.filter(entry => entry.enabled).map(entry => entry.id));
  const filtered = section === 'enabled'
    ? entries.filter(entry => enabledIds.has(entry.id))
    : section === 'disabled'
      ? entries.filter(entry => !enabledIds.has(entry.id))
      : section === 'issues'
        ? entries.filter(entry => hasPackIssue(entry, dependencyStatus))
        : entries;
  const changed = entries.some(entry => entry.enabled !== enabledIds.has(entry.id)) || order.some((id, index) => entries[index]?.id !== id);
  if (section === 'import') return `<div class="service-heading"><div><span class="eyebrow">DATAPACK IMPORT</span><h2>导入数据包</h2><p>先解析和查看报告，再决定是否加入包库或启用。</p></div></div><section class="service-card import-guide"><h3>导入流程</h3><p>选择 ZIP 文件后，页面会显示 manifest、JSON 数量、图片数量、忽略文件和解析问题。导入本身不会改变当前运行内容。</p><button class="primary-button" id="import-datapack">选择 ZIP 文件</button></section>`;
  const body = catalog ? (filtered.length ? `<div class="pack-catalog">${filtered.map(pack => renderPackEntry(pack, ctx, state, entries, order, enabledIds)).join('')}</div>` : '<div class="service-empty"><strong>这个分类还没有数据包</strong><p>可以切换其他分类，或从“导入”开始加入包库。</p></div>') : '<div class="service-empty"><strong>包库服务不可用</strong><p>当前运行时尚未提供数据包目录。</p></div>';
  const result = workspace?.lastResult ? `<div class="service-result ${workspace.lastResult.ok ? 'success' : 'error'}">${escape(workspace.lastResult.message)}</div>` : '';
  const validation = workspace?.validation && !workspace.validation.ok
    ? `<ul class="service-issue-list pack-validation-errors">${workspace.validation.errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul>`
    : workspace?.validation?.warnings.length
      ? `<ul class="service-warning-list">${workspace.validation.warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul>`
      : '';
  return `
    <div class="service-heading"><div><span class="eyebrow">DATAPACK WORKSPACE</span><h2>${sectionTitle(section)}</h2><p>浏览不会改变运行时；启用集修改会先保存为草案，校验通过后再应用。</p></div><span class="service-status">${enabledIds.size} 个启用 · ${entries.length} 个已导入</span></div>
    <div class="service-actions"><button class="primary-button" id="import-datapack">导入数据包</button>${changed ? '<span class="service-draft-status">有未应用变更</span>' : '<span class="service-draft-status">当前配置已应用</span>'}</div>
    ${result}<section class="service-card service-pack-list"><div class="panel-heading"><h3>${section === 'all' ? '全部数据包' : sectionTitle(section)}</h3><span class="index">${filtered.length} 个结果</span></div>${body}</section>
    <section class="service-card pack-draft-actions"><div class="panel-heading"><h3>启用集草案</h3><span class="index">${changed ? '待校验' : '无变更'}</span></div><p>${changed ? '当前修改尚未影响运行时。先校验，保存当前进度并确认后才会重载数据包序列。' : '当前草案与正式配置一致。'}</p>${validation}<div class="service-actions"><button class="toolbar-button" data-pack-discard ${changed ? '' : 'disabled'}>放弃修改</button><button class="toolbar-button" data-pack-validate ${changed ? '' : 'disabled'}>校验启用集</button><button class="primary-button" data-pack-apply ${changed ? '' : 'disabled'}>保存并确认应用</button></div></section>`;
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
  const main = service === 'datapack' ? renderDatapackMain(ctx, state) : service === 'saves' ? renderSavesMain(ctx) : renderRecordsMain(ctx);
  const navigation = `<div class="service-column-title"><span class="eyebrow">SERVICE</span><strong>${serviceTitle(service)}</strong></div>${renderNavigation(ctx, service, state)}`;
  const host = ctx.game as UIContext['game'] & Partial<PackCatalogReadModel>;
  const catalog = host.getPackCatalog?.();
  const dependencyStatus = new Map((catalog?.dependencies ?? []).map(hint => [`${hint.packId}:${hint.dependency}`, hint.status]));
  const inspector = service === 'datapack'
    ? `<div class="service-column-title"><span class="eyebrow">INSPECTOR</span><strong>${state.datapackWorkspace?.selectedPackId ? '数据包详情' : '当前选择'}</strong></div>${renderDatapackInspector(ctx, state, catalog?.entries ?? [], dependencyStatus)}`
    : `<div class="service-column-title"><span class="eyebrow">INSPECTOR</span><strong>当前选择</strong></div><section class="service-card"><h3>${service === 'saves' ? '安全提示' : '只读记录'}</h3><p>${service === 'saves' ? '读取、新游戏和删除等操作会影响进度，确认前必须查看覆盖范围。' : '图鉴与统计展示来源、范围和状态，不直接修改 PlayerState。'}</p></section><section class="service-card"><h3>下一步</h3><p>选择左侧分类或使用中部主要操作。操作结果会保留在当前页面并通过通知反馈。</p></section>`;
  return `<section class="service-workspace" data-service-workspace="${service}">${renderServiceColumn(ctx, service, 'navigation', 'service-navigation', navigation)}${renderServiceColumn(ctx, service, 'main', 'service-main', main)}${renderServiceColumn(ctx, service, 'inspector', 'service-inspector', inspector)}</section>`;
}
