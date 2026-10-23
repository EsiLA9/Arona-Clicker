import type { UIContext } from '../../runtime/context';
import type { PackCatalogEntry, PackCatalogReadModel } from '../../../arona-clicker/contracts/index';
import type { AchievementViewItem } from '../../../arona-clicker/read-model/achievement-view';
import type { PanelState } from './app-shell';
import { packEntryColorStyle } from './pack-entry-color';
import {
  buildDatapackWorkspaceView,
  dependencyState,
  paneMoveAvailability,
  packCapabilities,
  packMoveAvailability,
  type DatapackWorkspaceSection,
  type DatapackWorkspaceView,
} from '../../../arona-clicker/services/runtime/datapack-workspace-view';
import { renderWorkspaceFrame } from './workspace-frame';

export type ServiceWorkspaceId = 'datapack' | 'saves' | 'records';

type ServiceColumn = 'navigation' | 'main' | 'inspector';

function hostId(service: ServiceWorkspaceId, column: ServiceColumn): string {
  if (service === 'datapack' && column === 'navigation') return 'leftPanel.service.datapack.workspace';
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
    ? [
        { id: 'classic', label: '经典数据包', count: view?.entries.filter(entry => !entry.sourcePath).length ?? 0 },
        { id: 'development', label: '开发目录', count: view?.entries.filter(entry => Boolean(entry.sourcePath)).length ?? 0 },
      ]
    : service === 'saves'
      ? ['当前进度', '本地存档', '自动保存', '导入 / 导出', '存档检查'].map((label, index) => ({ id: String(index), label, count: null }))
      : ['图鉴总览', '故事', '学生', '设施与物品', '统计总览', '标签', '数据包贡献'].map((label, index) => ({ id: String(index), label, count: null }));
  return items.map((item, index) => {
    const active = service === 'datapack' ? state.datapackWorkspace?.mode === item.id : index === 0;
    const action = service === 'datapack' ? `data-datapack-mode="${item.id}"` : '';
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
  const editingMode = pack.editingMode === 'editing';
  return `<article class="pack-entry ${selected ? 'is-selected' : ''} ${draftChanged ? 'is-draft-changed' : ''} ${invalid ? 'is-invalid' : ''}" data-pack-id="${escape(pack.id)}">
    <button type="button" class="pack-entry-select" data-pack-select="${escape(pack.id)}" aria-pressed="${selected ? 'true' : 'false'}">
      <span class="pack-entry-main"><strong>${escape(pack.name)}</strong><span>${escape(pack.modName)} · v${escape(pack.version)}</span></span>
    <span class="pack-entry-meta">${pack.author ? `作者：${escape(pack.author)} · ` : ''}${editingMode ? '编辑态数据包' : capabilities.required ? 'base 基础包' : pack.sourceKind === 'builtin' || pack.sourceKind === 'bundle' ? '发布包' : escape(pack.sourceKind)} · ${dependencyText}</span>
    </button>
    <div class="pack-entry-status"><span class="pack-state ${formalEnabled ? 'enabled' : 'disabled'}">${formalEnabled ? '正式启用' : '未启用'}</span>${draftChanged ? `<span class="pack-state draft">草案${draftEnabled ? '启用' : '停用'}</span>` : ''}${invalid ? '<span class="pack-state invalid">校验未通过</span>' : ''}</div>
    <div class="pack-entry-actions">
      ${editingMode ? '<span class="pack-fixed-state">编辑态可编辑</span>' : capabilities.enableable ? `<button class="toolbar-button" data-pack-draft-toggle="${escape(pack.id)}">${draftEnabled ? '移出启用集' : '加入启用集'}</button>` : capabilities.required ? '<span class="pack-fixed-state">base 槽位</span>' : '<span class="pack-fixed-state">不可更改</span>'}
      ${!editingMode ? `<button class="toolbar-button" data-pack-create-editing="${escape(pack.id)}">复制为编辑态</button>` : ''}
      <button class="toolbar-button" data-pack-draft-up="${escape(pack.id)}" title="${upTitle}" ${canMoveUp ? '' : 'disabled'}>上移</button>
      <button class="toolbar-button" data-pack-draft-down="${escape(pack.id)}" title="${downTitle}" ${canMoveDown ? '' : 'disabled'}>下移</button>
      ${removableNow ? `<button class="toolbar-button" data-pack-remove="${escape(pack.id)}" title="从包库移除">移除</button>` : ''}
    </div>
  </article>`;
}

function renderDatapackListEntry(
  pack: PackCatalogEntry,
  state: PanelState,
  view: DatapackWorkspaceView,
  allowDrag = true,
  allowBaseSwapSource = false,
): string {
  const selected = state.datapackWorkspace?.selectedPackId === pack.id;
  const draftEnabled = view.draftEnabledIds.has(pack.id);
  const editing = pack.editingMode === 'editing';
  const changed = draftEnabled !== pack.enabled;
  const source = pack.sourcePath ? `开发目录 · ${pack.sourcePath}` : pack.sourceKind === 'builtin' || pack.sourceKind === 'bundle' ? '应用发布包' : '包库记录';
  const sourceTone = pack.sourcePath ? 'development' : pack.sourceKind === 'builtin' || pack.sourceKind === 'bundle' ? 'release' : 'record';
  const baseSwapSource = allowBaseSwapSource && !draftEnabled && pack.modName === 'base';
  const draggable = allowDrag && (pack.capabilities?.reorderable !== false || baseSwapSource);
  const dragTitle = baseSwapSource && pack.capabilities?.reorderable === false
    ? '拖动到启用中的 base 记录以交换'
    : '拖动以更改状态或顺序';
  return `<article class="pack-entry pack-entry--draggable ${selected ? 'is-selected' : ''} ${changed ? 'is-draft-changed' : ''}" data-pack-id="${escape(pack.id)}" draggable="${draggable ? 'true' : 'false'}" style="${packEntryColorStyle(pack.modName, pack.color)}">
    <button type="button" class="pack-entry-select" data-pack-select="${escape(pack.id)}" aria-pressed="${selected ? 'true' : 'false'}">
      <span class="pack-entry-main"><strong>${escape(pack.name)}</strong><span>${escape(pack.modName)} · v${escape(pack.version)}</span></span>
      <span class="pack-entry-meta"><span class="pack-entry-meta__pills"><span class="pack-entry-pill pack-entry-pill--source pack-entry-pill--${sourceTone}">${escape(source)}</span><span class="pack-entry-pill pack-entry-pill--mode pack-entry-pill--${editing ? 'editing' : 'normal'}">${editing ? '编辑态' : '普通态'}</span></span>${pack.author ? `<span class="pack-entry-author">${escape(pack.author)}</span>` : ''}</span>
    </button>
    ${allowDrag ? `<span class="pack-drag-handle" aria-hidden="true" title="${dragTitle}">⠿</span>` : ''}
  </article>`;
}

function renderPackColumn(
  title: string,
  enabled: boolean,
  entries: readonly PackCatalogEntry[],
  state: PanelState,
  view: DatapackWorkspaceView,
): string {
  const rows = entries.map(entry => renderDatapackListEntry(entry, state, view, true, !enabled)).join('');
  return `<section class="pack-drag-column ${enabled ? 'is-enabled' : 'is-disabled'}" data-pack-dropzone="${enabled ? 'enabled' : 'disabled'}"><div class="pack-drag-column__heading"><strong>${title}</strong><span class="index">${entries.length}</span></div><div class="pack-drag-list" data-pack-list="${enabled ? 'enabled' : 'disabled'}" aria-label="${title}">${rows || `<div class="service-empty"><strong>${enabled ? '当前没有启用的数据包' : '未启用列表为空'}</strong></div>`}</div></section>`;
}

function renderPackPane(
  pane: NonNullable<ReturnType<NonNullable<PackCatalogReadModel['getPackCatalog']>>['panes']>[number],
  state: PanelState,
  view: DatapackWorkspaceView,
  allowReorder: boolean,
): string {
  const records = [pane.fixed, pane.editing].filter((entry): entry is NonNullable<typeof pane.fixed> => Boolean(entry));
  if (records.length === 0) return '';
  const selected = records.some(entry => state.datapackWorkspace?.selectedPackId === entry.id);
  const invalid = records.some(entry => view.invalidIds.has(entry.id));
  const move = paneMoveAvailability(pane.paneKey, view.entries, view.order, allowReorder);
  const upTitle = !allowReorder
    ? '请在「全部数据包」中调整加载顺序'
    : move.canMoveUp ? '上移整个 ModId · VersionId Pane'
      : '已经是第一个数据包或前方是核心数据包';
  const downTitle = !allowReorder
    ? '请在「全部数据包」中调整加载顺序'
    : move.canMoveDown ? '下移整个 ModId · VersionId Pane'
      : '已经是最后一个数据包或后方是核心数据包';
  const slotButton = (slot: 'fixed' | 'editing', entry: typeof pane.fixed): string => {
    if (!entry) {
      if (slot === 'editing' && pane.fixed) {
        return `<button class="toolbar-button pack-slot-select pack-slot-create" data-pack-create-editing="${escape(pane.fixed.id)}">创建编辑态</button>`;
      }
      return `<button class="toolbar-button pack-slot-select" disabled>${slot === 'fixed' ? '普通态未创建' : '编辑态未创建'}</button>`;
    }
    const selectedSlot = pane.selectedSlot === slot;
    const viewed = state.datapackWorkspace?.selectedPackId === entry.id;
    const runtime = pane.runtimePackRecordId === entry.packRecordId;
    const creationTarget = slot === 'editing'
      && state.runtimeDatapackEditor?.enabled
      && state.runtimeDatapackEditor.packRecordId === entry.packRecordId;
    const editingTarget = creationTarget && state.runtimeEditorPanelOpen;
    const pending = selectedSlot && !runtime;
    const stateText = slot === 'fixed' ? '普通态' : '编辑态';
    const visibleStateText = editingTarget
      ? '编辑中'
      : creationTarget
        ? `新建：${entry.modName}`
        : stateText;
    const stateDescription = [
      visibleStateText,
      runtime ? '当前 Runtime' : '',
      pending ? '待 Apply' : '',
      viewed ? '当前查看' : '',
      !editingTarget && creationTarget ? '新建内容目标' : '',
    ].filter(Boolean).join(' · ');
    return `<button class="toolbar-button pack-slot-select${selectedSlot ? ' is-selected' : ''}${viewed ? ' is-viewed' : ''}${creationTarget ? ' is-create-target' : ''}${editingTarget ? ' is-editing-target' : ''}" data-pack-selection-pane="${escape(pane.paneKey)}" data-pack-selection-slot="${slot}" data-pack-selection-record="${escape(entry.id)}" aria-label="${escape(stateDescription)}" title="${escape(stateDescription)}" aria-pressed="${selectedSlot ? 'true' : 'false'}">${visibleStateText}</button>`;
  };
  const fixedActions = pane.fixed
    ? packCapabilities(pane.fixed).required
      ? `<span class="pack-fixed-state">${pane.fixed.enabled ? 'base 当前已选' : 'base 回退候选'}</span>`
      : `<button class="toolbar-button" data-pack-draft-toggle="${escape(pane.fixed.id)}">${view.draftEnabledIds.has(pane.fixed.id) ? '移出启用集' : '加入启用集'}</button>`
    : '';
  return `<section class="pack-pane${selected ? ' is-selected' : ''}${invalid ? ' is-invalid' : ''}" data-pack-pane="${escape(pane.paneKey)}"><div class="pack-pane-heading"><div class="pack-pane-identity"><strong>${escape(pane.modName)} · v${escape(pane.version)}</strong></div><div class="pack-pane-reorder"><button class="toolbar-button" data-pack-draft-pane-up="${escape(pane.paneKey)}" title="${upTitle}" ${move.canMoveUp ? '' : 'disabled'}>上移</button><button class="toolbar-button" data-pack-draft-pane-down="${escape(pane.paneKey)}" title="${downTitle}" ${move.canMoveDown ? '' : 'disabled'}>下移</button></div></div><div class="pack-pane-state-row"><div class="pack-pane-selection" aria-label="选择数据包状态">${slotButton('fixed', pane.fixed)}${slotButton('editing', pane.editing)}${fixedActions}</div></div></section>`;
}

function renderDatapackInspector(ctx: UIContext, state: PanelState, view: DatapackWorkspaceView, dependencyStatus: Map<string, string>): string {
  const selected = view.selection;
  if (!selected) return `<section class="service-card service-empty"><strong>选择一条数据包记录</strong><p>从普通态记录创建编辑态副本时，需要填写不同的 Version。</p></section>`;
  const capabilities = packCapabilities(selected);
  const formalEnabled = view.draftEnabledIds.has(selected.id);
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
  const editing = selected.editingMode === 'editing';
  const stateLabel = editing ? formalEnabled ? '启用中 · 编辑态' : '编辑态' : formalEnabled ? '启用中' : '未启用';
  const sameModName = view.entries.filter(entry => entry.modName === selected.modName && entry.id !== selected.id);
  const activeConflicts = view.entries.filter(entry => entry.id !== selected.id
    && entry.modName === selected.modName && view.draftEnabledIds.has(entry.id));
  const sourceLabel = selected.sourceKind === 'bundle'
    ? '应用发布包'
    : selected.sourcePath
      ? `${selected.sourceKind} · 固定开发目录`
      : selected.sourceKind === 'builtin' ? '旧版内置来源' : `${selected.sourceKind} · 包库记录`;
  const enablementText = editing
    ? formalEnabled ? '此编辑态数据包正在 Runtime 中运行，可继续用 RuntimeEditor 修改。' : '启用后会进入 Runtime 序列，也可继续用 RuntimeEditor 修改。'
      : capabilities.required ? formalEnabled ? '当前占用必需的 base 槽位；可通过同名交换替换。' : '这是可供回退或交换的 base 候选。'
      : formalEnabled ? '此记录处于启用草案中。' : '此记录当前未启用。';
  const relatedRows = sameModName.length
    ? `<ul class="pack-related-records">${sameModName.map(entry => `<li><span>${escape(entry.name)} · v${escape(entry.version)} · ${entry.editingMode === 'editing' ? '编辑态' : '普通态'}</span><small>${view.draftEnabledIds.has(entry.id) ? '启用中' : '未启用'}${entry.id === activeConflicts[0]?.id ? ' · 冲突项' : ''}</small></li>`).join('')}</ul>`
    : '<p class="service-ok">包库中没有其他同 ModName 记录。</p>';
  const actions = [
    capabilities.enableable ? `<button class="toolbar-button" data-pack-enabled-toggle="${escape(selected.id)}">${formalEnabled ? '移出启用集' : '加入启用集'}</button>` : '',
    !editing ? `<button class="toolbar-button" data-pack-create-editing="${escape(selected.id)}">复制为新编辑态</button>` : '',
    editing ? `<button class="toolbar-button" data-pack-convert-normal="${escape(selected.id)}">复制为普通态</button>` : '',
    editing ? `<button class="toolbar-button" data-pack-open-editing="${escape(selected.id)}">打开编辑器</button>` : '',
    !capabilities.required && capabilities.removable && !formalEnabled ? `<button class="toolbar-button" data-pack-remove="${escape(selected.id)}">从包库移除</button>` : '',
  ].filter(Boolean).join('');
  const sourceNote = selected.sourcePath
    ? '<p class="pack-source-note">来源文件由开发目录管理。移除包库记录不会删除文件；下次启动会重新发现。</p>'
    : '';
  return `<section class="service-card pack-inspector-card"><div class="panel-heading"><h3>${escape(selected.name)}</h3><span class="index">${stateLabel}</span></div><dl class="pack-detail-list"><div><dt>modName</dt><dd>${escape(selected.modName)}</dd></div><div><dt>版本</dt><dd>${escape(selected.version)}</dd></div><div><dt>状态</dt><dd>${editing ? '编辑态记录' : '普通态记录'}</dd></div><div><dt>来源</dt><dd>${escape(sourceLabel)}</dd></div>${selected.sourcePath ? `<div><dt>来源路径</dt><dd>${escape(selected.sourcePath)}</dd></div>` : ''}<div><dt>导入时间</dt><dd>${ctx.formatTime(selected.importedAt)}</dd></div></dl><h4>ModName 记录</h4>${relatedRows}${activeConflicts.length ? `<p class="pack-conflict-note">ModName ${escape(selected.modName)} 已由其他启用记录占用；应用前需要解决冲突。</p>` : ''}<h4>依赖</h4>${dependencyRows.length ? `<ul class="service-dependency-list">${dependencyRows.join('')}</ul>` : '<p class="service-ok">无依赖</p>'}${issueList}<h4>启用状态</h4><p>${enablementText}</p>${sourceNote}${actions ? `<div class="service-actions pack-inspector-actions">${actions}</div>` : ''}</section>`;
}

function renderDatapackMain(ctx: UIContext, state: PanelState, catalog: ReturnType<NonNullable<PackCatalogReadModel['getPackCatalog']>> | undefined, view: DatapackWorkspaceView): string {
  const workspace = state.datapackWorkspace;
  const entries = view.entries;
  const changed = view.changed;
  const mode = workspace?.mode ?? 'classic';
  const classicEntries = view.orderedEntries;
  const developmentEntries = view.orderedEntries.filter(entry => Boolean(entry.sourcePath));
  const modeEntries = mode === 'development' ? developmentEntries : classicEntries;
  const enabledEntries = modeEntries.filter(entry => view.draftEnabledIds.has(entry.id));
  const disabledEntries = modeEntries.filter(entry => !view.draftEnabledIds.has(entry.id));
  const body = catalog
    ? mode === 'classic'
      ? `<div class="pack-dragger" data-pack-dragger>${renderPackColumn('未启用', false, disabledEntries, state, view)}${renderPackColumn('启用中', true, enabledEntries, state, view)}</div>`
      : `${renderDevelopmentSourceIssues(ctx)}<div class="pack-source-list">${modeEntries.map(entry => renderDatapackListEntry(entry, state, view, false)).join('') || '<div class="service-empty"><strong>开发目录中没有可加载的数据包</strong><p>在 datapack-dev/ 中放置 ZIP 或符合命名规则的展开目录。</p></div>'}</div>`
    : '<div class="service-empty"><strong>包库服务不可用</strong></div>';
  const result = workspace?.lastResult ? `<div class="service-result ${workspace.lastResult.ok ? 'success' : 'error'}">${escape(workspace.lastResult.message)}</div>` : '';
  const validation = workspace?.validation && !workspace.validation.ok
    ? `<ul class="service-issue-list pack-validation-errors">${workspace.validation.errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul>`
    : workspace?.validation?.warnings.length
      ? `<ul class="service-warning-list">${workspace.validation.warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul>`
      : '';
  return `
    <div class="service-heading"><h2>${mode === 'classic' ? '经典数据包' : '固定开发目录'}</h2><span class="service-status">${enabledEntries.length} 启用 · ${modeEntries.length} 条记录</span></div>
    ${result}<section class="service-card service-pack-list"><div class="panel-heading"><h3>${mode === 'classic' ? '拖动记录以调整状态或顺序' : '固定目录来源 · 可在经典列表管理状态'}</h3><span class="index">${disabledEntries.length} 未启用 · ${enabledEntries.length} 启用中</span></div>${body}</section>
    <section class="service-card pack-draft-actions">${validation}<div class="service-actions">${mode === 'classic' ? '<button class="primary-button" id="import-datapack">导入 ZIP</button>' : ''}<button class="toolbar-button" data-pack-discard ${changed ? '' : 'disabled'}>放弃草案</button><button class="primary-button" data-pack-apply ${changed ? '' : 'disabled'}>应用到 Runtime</button></div></section>`;
}

function renderDevelopmentSourceIssues(ctx: UIContext): string {
  const issues = ctx.game.getDevLogs()
    .filter(entry => entry.source === 'datapack' && entry.message.startsWith('[Development Datapack]'))
    .slice(0, 12);
  if (issues.length === 0) return '';
  return `<section class="service-card pack-source-issues"><div class="panel-heading"><h3>未能加载的数据源</h3><span class="index">${issues.length}</span></div><ul class="service-issue-list">${issues.map(issue => `<li>${escape(issue.message)}</li>`).join('')}</ul></section>`;
}

function renderSavesMain(ctx: UIContext): string {
  const view = ctx.view;
  return `
    <div class="service-heading"><div><span class="eyebrow">SAVE WORKSPACE</span><h2>${serviceTitle('saves')}</h2><p>保存和读取都在这里完成，顶部入口只负责进入服务。</p></div><span class="service-status">${ctx.saveExists ? '已有本地存档' : '尚无本地存档'}</span></div>
    <div class="service-card"><div class="panel-heading"><h3>当前进度</h3><span class="index">${view.activeInit ? escape(ctx.nameOf('init', view.activeInit)) : '未进入世界线'}</span></div><p class="service-summary">帧数 ${ctx.formatNumber(view.totalFrames)} · 当前区域 ${view.currentAreaId ? escape(ctx.nameOf('area', view.currentAreaId)) : '未进入'}</p><div class="service-actions"><button class="primary-button" id="save-game">保存当前进度</button><button class="toolbar-button" id="load-game" ${ctx.saveExists ? '' : 'disabled'}>读取并替换当前进度</button><button class="toolbar-button" id="new-game">开始新游戏</button></div></div>
    <section class="service-card"><h3>读取前检查</h3><p>读取会替换当前运行状态。实际覆盖范围与数据包环境差异将在后续存档检查面板中展开。</p></section>`;
}

function renderAchievementGroups(ctx: UIContext): string {
  const groups = new Map<string, { initId: string; areaId: string; items: AchievementViewItem[] }>();
  for (const item of ctx.game.getAchievementView()) {
    const key = JSON.stringify([item.initId, item.areaId]);
    let group = groups.get(key);
    if (!group) {
      group = { initId: item.initId, areaId: item.areaId, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  if (groups.size === 0) {
    return `<section class="service-card" data-achievement-empty-state><div class="panel-heading"><h3>区域成就</h3></div><p data-achievement-empty>目前没有已发现的区域成就。到访相关区域后，成就会出现在这里。</p></section>`;
  }

  return [...groups.values()].map(group => `
    <section class="service-card" data-achievement-group data-achievement-init="${escape(group.initId)}" data-achievement-area="${escape(group.areaId)}">
      <div class="panel-heading"><h3>${escape(ctx.nameOf('init', group.initId))} · ${escape(ctx.nameOf('area', group.areaId))}</h3><span class="index">${group.items.length} 项</span></div>
      ${group.items.map(item => {
        const progress = item.progress
          ? `<p data-achievement-progress>进度 <span data-achievement-progress-current>${escape(ctx.formatNumber(item.progress.current))}</span> / <span data-achievement-progress-comparison>${item.progress.comparator === '>=' ? '≥' : '>'}</span> <span data-achievement-progress-target>${escape(ctx.formatNumber(item.progress.target))}</span></p>`
          : '';
        return `<article data-achievement-id="${escape(item.id)}">
          <div class="panel-heading"><h4>${escape(item.title)}</h4><span class="service-status" data-achievement-status>${item.completed ? '已完成' : '未完成'}</span></div>
          <p>${escape(item.clue)}</p>
          <p>奖励说明：${escape(item.rewardDescription)}</p>
          ${progress}
        </article>`;
      }).join('')}
    </section>`).join('');
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
    ${renderAchievementGroups(ctx)}
    <section class="service-card"><h3>统计口径</h3><p>区域成就仅展示已发现目标；简单累计条件显示当前值与目标，组合条件保留线索。更完整的本世界线和全局统计将在分类页展示。</p></section>`;
}

export function renderServiceWorkspace(ctx: UIContext, service: ServiceWorkspaceId, state: PanelState): string {
  const host = ctx.game as UIContext['game'] & Partial<PackCatalogReadModel>;
  const catalog = host.getPackCatalog?.();
  const datapackView = service === 'datapack'
    ? buildDatapackWorkspaceView({
      entries: catalog?.entries ?? [],
      section: 'all',
      draftOrder: state.datapackWorkspace?.draftOrder,
      draftEnabledIds: state.datapackWorkspace?.draftEnabledIds,
      selectedPackId: state.datapackWorkspace?.selectedPackId,
      validation: state.datapackWorkspace?.validation,
    })
    : undefined;
  const main = service === 'datapack' ? renderDatapackMain(ctx, state, catalog, datapackView!) : service === 'saves' ? renderSavesMain(ctx) : renderRecordsMain(ctx);
  const navigation = `<div class="service-column-title"><strong>${serviceTitle(service)}</strong></div>${renderNavigation(service, state, datapackView)}`;
  const datapackWorkspace = service === 'datapack'
    ? `<div class="datapack-workspace__sections">${navigation}</div><div class="datapack-workspace__catalog">${main}</div>`
    : navigation;
  const dependencyStatus = new Map((catalog?.dependencies ?? []).map(hint => [`${hint.packId}:${hint.dependency}`, hint.status]));
  const inspector = service === 'datapack'
    ? `<div class="service-column-title"><strong>${state.datapackWorkspace?.selectedPackId ? '数据包详情' : '当前选择'}</strong></div>${renderDatapackInspector(ctx, state, datapackView!, dependencyStatus)}`
    : `<div class="service-column-title"><span class="eyebrow">INSPECTOR</span><strong>当前选择</strong></div><section class="service-card"><h3>${service === 'saves' ? '安全提示' : '只读记录'}</h3><p>${service === 'saves' ? '读取、新游戏和删除等操作会影响进度，确认前必须查看覆盖范围。' : '图鉴与统计展示来源、范围和状态，不直接修改 PlayerState。'}</p></section><section class="service-card"><h3>下一步</h3><p>选择左侧分类或使用中部主要操作。操作结果会保留在当前页面并通过通知反馈。</p></section>`;
  return renderWorkspaceFrame(ctx, {
    id: `service-${service}`,
    layout: { responsive: 'two-column', composition: service === 'datapack' ? 'left-center' : 'columns' },
    left: { slot: 'left', workspaceOwner: service, hostId: hostId(service, 'navigation'), themeScope: `left.${service}.navigation`, surface: 'panel', className: service === 'datapack' ? 'service-column datapack-workspace' : 'service-column service-navigation', content: datapackWorkspace, scroll: service === 'datapack' ? 'content' : 'auto' },
    center: { slot: 'center', workspaceOwner: service, hostId: hostId(service, 'main'), themeScope: `center.${service}.main`, surface: 'panel', className: 'service-column service-main', content: service === 'datapack' ? '' : main, scroll: 'content' },
    right: { slot: 'right', workspaceOwner: service, hostId: hostId(service, 'inspector'), themeScope: `right.${service}.inspector`, surface: 'panel', className: 'service-column service-inspector', content: inspector },
  });
}
