import {
  codexEntryKey,
  type CodexEntryView,
  type CodexKindView,
  type CodexModView,
  type CodexPane,
  type CodexShellState,
  type RuntimeContentBrowserShellView,
} from './model';
import {
  escapeCodexHtml,
  groupCodexKinds,
  renderCodexBadges,
  renderCodexEmptyState,
} from './helpers';
import { codexKindGroup, codexKindLabel } from './content-labels';
import { renderContentWorkspace } from './workspace';
import {
  getCodexVisibleEntries,
  getCodexVisibleKinds,
  getSelectedCodexEntry,
  reconcileCodexShellState,
} from './state';

export { codexKindGroup, codexKindLabel } from './content-labels';

const CATEGORY_ORDER = [
  '世界与设施',
  '角色与培养',
  '物品与经济',
  '剧情与对话',
  '行动与场景',
  '外观与素材',
  '规则与配置',
  '其它内容',
] as const;

export interface CodexShellRenderOptions {
  /**
   * 注入后续 codex-inspector 的只读详情渲染器；返回值应是已完成 HTML escaping 的可信片段。
   * 不提供时，壳层只展示选中 Def 的身份和接口占位，不解析语义详情。
   */
  readonly renderDetail?: (entry: CodexEntryView) => string;
}

export function renderCodexShell(
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
  options: CodexShellRenderOptions = {},
): string {
  const safeState = reconcileCodexShellState(view, state);
  const selectedEntry = getSelectedCodexEntry(view, safeState);
  const selectedIsVisible = !selectedEntry || getCodexVisibleEntries(view, safeState)
    .some(entry => codexEntryKey(entry) === safeState.selectedEntryKey);

  return `<section class="runtime-editor-codex" data-runtime-editor-codex data-codex-mobile-pane="${safeState.mobilePane}" aria-label="超级图鉴">
    ${renderMobilePaneNav(safeState.mobilePane)}
    ${renderContentWorkspace({
      navigation: renderCodexNavigationPane(view, safeState),
      entries: renderCodexEntryPane(view, safeState),
      detail: renderCodexDetailPane(selectedEntry, view.loadedMods, options.renderDetail, safeState, selectedIsVisible),
    })}
  </section>`;
}

function renderMobilePaneNav(activePane: CodexPane): string {
  const panes: readonly { id: CodexPane; label: string }[] = [
    { id: 'mods', label: '分类与范围' },
    { id: 'entries', label: '条目' },
    { id: 'detail', label: '资料' },
  ];
  return `<nav class="runtime-editor-codex__mobile-nav" aria-label="图鉴栏位切换" role="tablist">${panes.map(pane => `<button type="button" role="tab" aria-selected="${activePane === pane.id}" aria-controls="runtime-editor-codex-${pane.id}" data-codex-mobile-pane="${pane.id}"${activePane === pane.id ? ' class="is-active"' : ''}>${escapeCodexHtml(pane.label)}</button>`).join('')}</nav>`;
}

export function renderCodexNavigationPane(
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
): string {
  const categoryCounts = new Map<string, number>();
  view.entries.forEach(entry => {
    const category = codexKindGroup(entry.definitionKind);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  });
  const categories = CATEGORY_ORDER.filter(category => categoryCounts.has(category));
  const categoryButtons = [
    `<button type="button" class="runtime-editor-codex__category${state.selectedCategory == null ? ' is-selected' : ''}" data-codex-category="" aria-pressed="${state.selectedCategory == null}"><span>全部分类</span><small>${view.entries.length}</small></button>`,
    ...categories.map(category => {
      const selected = state.selectedCategory === category;
      return `<button type="button" class="runtime-editor-codex__category${selected ? ' is-selected' : ''}" data-codex-category="${escapeCodexHtml(category)}" aria-pressed="${selected}"><span>${escapeCodexHtml(category)}</span><small>${categoryCounts.get(category) ?? 0}</small></button>`;
    }),
  ].join('');
  const scopeButtons = [
    `<button type="button" class="runtime-editor-codex__mod${state.selectedModId === null ? ' is-selected' : ''}" role="option" aria-selected="${state.selectedModId === null}" data-codex-mod=""><span class="runtime-editor-codex__mod-copy"><strong>全部包</strong><span>${view.entries.length} 条内容</span></span><span class="runtime-editor-codex__chevron" aria-hidden="true">›</span></button>`,
    ...view.loadedMods.map((mod, index) => renderModRow(mod, view, state, index, view.loadedMods.length)),
  ].join('');
  const emptyMods = view.loadedMods.length === 0
    ? renderCodexEmptyState('暂无来源范围', '当前没有可浏览的来源分组。', 'mods')
    : '';
  const categoryFilterActive = state.selectedCategory != null;
  const scopeFilterActive = state.selectedModId != null;
  const anyFilterActive = categoryFilterActive || scopeFilterActive;
  const categoryModeSelected = state.navigationMode === 'categories';
  const categoryFilterLabel = categoryFilterActive ? '分类，已启用筛选' : '分类';
  const scopeFilterLabel = scopeFilterActive ? '包范围，已启用筛选' : '包范围';
  return `<aside class="runtime-editor-codex__pane runtime-editor-codex__pane--mods" id="runtime-editor-codex-mods" data-codex-pane="mods" aria-labelledby="runtime-editor-codex-mods-title">
    <header class="runtime-editor-codex__pane-head"><h3 id="runtime-editor-codex-mods-title">分类与范围</h3><span class="runtime-editor-codex__count">${view.entries.length}</span></header>
    <div class="runtime-editor-codex__facet-switch${anyFilterActive ? ' has-active-filter' : ''}" role="tablist" aria-label="筛选维度">
      <button type="button" id="runtime-editor-codex-categories-tab" role="tab" class="runtime-editor-codex__facet-option${categoryModeSelected ? ' is-current' : ''}${categoryFilterActive ? ' has-filter' : ''}" aria-label="${categoryFilterLabel}" aria-selected="${categoryModeSelected}" aria-controls="runtime-editor-codex-categories" data-codex-navigation-mode="categories"><span>分类</span>${categoryFilterActive ? '<small>已筛选</small>' : ''}</button>
      <button type="button" id="runtime-editor-codex-scopes-tab" role="tab" class="runtime-editor-codex__facet-option${categoryModeSelected ? '' : ' is-current'}${scopeFilterActive ? ' has-filter' : ''}" aria-label="${scopeFilterLabel}" aria-selected="${!categoryModeSelected}" aria-controls="runtime-editor-codex-scopes" data-codex-navigation-mode="scopes"><span>包范围</span>${scopeFilterActive ? '<small>已筛选</small>' : ''}</button>
    </div>
    <div class="runtime-editor-codex__navigation-body">
      <section class="runtime-editor-codex__navigation-section" id="runtime-editor-codex-categories" role="tabpanel" aria-labelledby="runtime-editor-codex-categories-tab"${categoryModeSelected ? '' : ' hidden'}>
        <h4 id="runtime-editor-codex-categories-title">内容分类</h4><div class="runtime-editor-codex__category-list" role="group" aria-label="内容分类">${categoryButtons}</div>
      </section>
      <section class="runtime-editor-codex__navigation-section" id="runtime-editor-codex-scopes" role="tabpanel" aria-labelledby="runtime-editor-codex-scopes-tab"${categoryModeSelected ? ' hidden' : ''}>
        <h4 id="runtime-editor-codex-scopes-title">包范围</h4><div class="runtime-editor-codex__list" role="listbox" aria-label="内容范围">${scopeButtons}</div>${emptyMods}
      </section>
    </div>
  </aside>`;
}

function renderModRow(
  mod: CodexModView,
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
  index: number,
  total: number,
): string {
  const count = view.entries.filter(entry => entry.modId === mod.id).length;
  const selected = state.selectedModId === mod.id;
  const version = mod.version ? `v${mod.version}` : '';
  return `<button type="button" class="runtime-editor-codex__mod${selected ? ' is-selected' : ''}" role="option" aria-selected="${selected}" aria-posinset="${index + 1}" aria-setsize="${total}" data-codex-mod="${escapeCodexHtml(mod.id)}"><span class="runtime-editor-codex__mod-copy"><strong>${escapeCodexHtml(mod.label)}</strong>${version ? `<small>${escapeCodexHtml(version)}</small>` : ''}<span>${count} 条内容${mod.statusLabel ? ` · ${escapeCodexHtml(mod.statusLabel)}` : ''}</span>${renderCodexBadges(mod.badges)}</span><span class="runtime-editor-codex__chevron" aria-hidden="true">›</span></button>`;
}

export function renderCodexEntryPane(
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
): string {
  const visibleKinds = getCodexVisibleKinds(view, state);
  const visibleEntries = getCodexVisibleEntries(view, state);
  const groups = groupCodexKinds(visibleKinds);
  const kindTabs = visibleKinds.length === 0
    ? renderCodexEmptyState(
      state.query ? '没有匹配类型' : '没有可用类型',
      state.query ? '换一个名称、ID、标签或字段摘要试试。' : '当前范围内没有可浏览的类型。',
      'kinds',
    )
    : [...groups.entries()].map(([group, kinds]) => `<section class="runtime-editor-codex__kind-group"><h4>${escapeCodexHtml(group)}</h4><div class="runtime-editor-codex__kind-tabs" role="tablist" aria-label="${escapeCodexHtml(group)}">${kinds.map(kind => renderKindTab(kind, state, view)).join('')}</div></section>`).join('');
  const list = visibleEntries.length === 0
    ? renderCodexEmptyState(
      state.query ? '没有匹配条目' : '没有可显示的内容',
      state.query ? '搜索只作用于当前生效内容。' : '当前筛选范围内没有可浏览内容。',
      'entries',
    )
    : `<div class="runtime-editor-codex__entry-list" role="listbox" aria-label="Def 条目">${visibleEntries.map((entry, index) => renderEntryRow(entry, view, state, index, visibleEntries.length)).join('')}</div>`;
  const selectedKindLabel = state.selectedKind
    ? visibleKinds.find(kind => kind.definitionKind === state.selectedKind)?.label ?? state.selectedKind
    : '全部类型';
  const filterSummary = `${selectedKindLabel} · ${visibleKinds.length} 种可用类型`;
  const kindButtonSummary = state.selectedKind ? selectedKindLabel : '全部类型';
  return `<section class="runtime-editor-codex__pane runtime-editor-codex__pane--entries" id="runtime-editor-codex-entries" data-codex-pane="entries" aria-labelledby="runtime-editor-codex-entries-title">
    <header class="runtime-editor-codex__pane-head"><h3 id="runtime-editor-codex-entries-title">搜索与条目</h3><span class="runtime-editor-codex__count">${visibleEntries.length}</span></header>
    <div class="runtime-editor-codex__search">
      <label for="runtime-editor-codex-query">搜索</label>
      <div class="runtime-editor-codex__search-controls">
        <input id="runtime-editor-codex-query" type="search" value="${escapeCodexHtml(state.query)}" placeholder="名称、完整 ID、字段…" autocomplete="off" data-codex-query aria-controls="runtime-editor-codex-entry-list">
        <details class="runtime-editor-codex__kind-filter${state.selectedKind ? ' has-filter' : ''}" data-codex-kind-filter${state.kindFilterOpen ? ' open' : ''}>
          <summary class="runtime-editor-codex__kind-filter-summary" aria-label="类型筛选：${escapeCodexHtml(filterSummary)}" aria-expanded="${state.kindFilterOpen}" aria-controls="runtime-editor-codex-kind-filter-options"><span>类型筛选</span><small title="${escapeCodexHtml(kindButtonSummary)}">${escapeCodexHtml(kindButtonSummary)}</small><span class="runtime-editor-codex__kind-filter-caret" aria-hidden="true">⌄</span></summary>
          <div class="runtime-editor-codex__kind-filter-panel" id="runtime-editor-codex-kind-filter-options" role="region" aria-label="类型筛选选项">
            <div class="runtime-editor-codex__kind-filter-body"><button type="button" class="runtime-editor-codex__kind-tab${state.selectedKind === null ? ' is-selected' : ''}" role="tab" aria-selected="${state.selectedKind === null}" aria-controls="runtime-editor-codex-entry-list" data-codex-kind="">全部类型</button>${kindTabs}</div>
          </div>
        </details>
      </div>
      <span class="runtime-editor-codex__search-hint">${state.selectedModId ? `当前包：${escapeCodexHtml(view.loadedMods.find(mod => mod.id === state.selectedModId)?.label ?? state.selectedModId)}` : '范围：全部包'}</span>
    </div>
    <div class="runtime-editor-codex__entries-wrap" id="runtime-editor-codex-entry-list">${list}</div>
  </section>`;
}

function renderKindTab(kind: CodexKindView, state: CodexShellState, view: RuntimeContentBrowserShellView): string {
  const count = view.entries.filter(entry => entry.definitionKind === kind.definitionKind && (!state.selectedModId || entry.modId === state.selectedModId)).length;
  const selected = state.selectedKind === kind.definitionKind;
  return `<button type="button" class="runtime-editor-codex__kind-tab${selected ? ' is-selected' : ''}" role="tab" aria-selected="${selected}" aria-controls="runtime-editor-codex-entry-list" data-codex-kind="${escapeCodexHtml(kind.definitionKind)}"><span>${escapeCodexHtml(kind.label)}</span><small>${count}</small></button>`;
}

function renderEntryRow(
  entry: CodexEntryView,
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
  index: number,
  total: number,
): string {
  const selected = state.selectedEntryKey === codexEntryKey(entry);
  const kind = view.kinds.find(candidate => candidate.definitionKind === entry.definitionKind);
  const mod = view.loadedMods.find(candidate => candidate.id === entry.modId);
  return `<button type="button" class="runtime-editor-codex__entry${selected ? ' is-selected' : ''}" role="option" aria-selected="${selected}" aria-posinset="${index + 1}" aria-setsize="${total}" data-codex-entry="${escapeCodexHtml(codexEntryKey(entry))}"><span class="runtime-editor-codex__entry-signal" aria-hidden="true"></span><span class="runtime-editor-codex__entry-copy"><strong>${escapeCodexHtml(entry.label || entry.fullId)}</strong><code>${escapeCodexHtml(entry.fullId)}</code><small>${escapeCodexHtml(kind?.label ?? entry.definitionKind)} · ${escapeCodexHtml(mod?.label ?? entry.modId)}</small>${entry.summary ? `<span>${escapeCodexHtml(entry.summary)}</span>` : ''}${renderCodexBadges(entry.badges)}</span><span class="runtime-editor-codex__chevron" aria-hidden="true">›</span></button>`;
}

export function renderCodexDetailPane(
  entry: CodexEntryView | null,
  mods: readonly CodexModView[],
  renderDetail: CodexShellRenderOptions['renderDetail'],
  state?: Partial<CodexShellState>,
  inCurrentRange = true,
): string {
  if (!entry) {
    return `<aside class="runtime-editor-codex__pane runtime-editor-codex__pane--detail" id="runtime-editor-codex-detail" data-codex-pane="detail" aria-labelledby="runtime-editor-codex-detail-title"><header class="runtime-editor-codex__detail-head" data-codex-detail-header><div class="runtime-editor-codex__detail-toolbar"><span class="runtime-editor-codex__detail-context">详细资料</span></div><h3 id="runtime-editor-codex-detail-title">详情</h3></header><div class="runtime-editor-codex__detail-body" data-codex-detail-slot>${renderCodexEmptyState('选择一个条目', '从列表选择内容后，这里会显示资料与引用。', 'detail')}</div></aside>`;
  }
  const customDetail = renderDetail?.(entry) ?? '<p class="runtime-editor-codex__detail-placeholder">当前条目的资料与引用会显示在这里。</p>';
  const modLabel = mods.find(mod => mod.id === entry.modId)?.label ?? entry.modId;
  const backDisabled = !state?.backStack?.length;
  const forwardDisabled = !state?.forwardStack?.length;
  const location = state?.locationHint
    ? `<code class="runtime-editor-codex__detail-location" data-codex-location-hint>引用位置：${escapeCodexHtml(state.locationHint)}</code>`
    : '';
  const outOfRange = inCurrentRange
    ? ''
    : `<div class="runtime-editor-codex__detail-range" data-codex-out-of-range><span>当前条目在筛选范围外</span><button type="button" data-codex-locate>在列表中定位</button></div>`;
  return `<aside class="runtime-editor-codex__pane runtime-editor-codex__pane--detail" id="runtime-editor-codex-detail" data-codex-pane="detail" aria-labelledby="runtime-editor-codex-detail-title"><header class="runtime-editor-codex__detail-head" data-codex-detail-header><div class="runtime-editor-codex__detail-toolbar"><div class="runtime-editor-codex__detail-nav" aria-label="资料导航"><button type="button" data-codex-navigation="back" aria-label="返回上一条" title="返回上一条"${backDisabled ? ' disabled' : ''}>‹</button><button type="button" data-codex-navigation="forward" aria-label="前往下一条" title="前往下一条"${forwardDisabled ? ' disabled' : ''}>›</button></div><span class="runtime-editor-codex__detail-context">详细资料</span></div><h3 id="runtime-editor-codex-detail-title">${escapeCodexHtml(entry.label || entry.fullId)}</h3><div class="runtime-editor-codex__detail-identity"><code>${escapeCodexHtml(codexKindLabel(entry.definitionKind))} · ${escapeCodexHtml(entry.fullId)}</code><button type="button" data-codex-copy-id="${escapeCodexHtml(entry.fullId)}">复制ID</button></div><span class="runtime-editor-codex__detail-source">来源：${escapeCodexHtml(modLabel)}</span>${location}${outOfRange}${entry.statusLabel ? `<span class="runtime-editor-codex__detail-status">${escapeCodexHtml(entry.statusLabel)}</span>` : ''}${renderCodexBadges(entry.badges)}</header><div class="runtime-editor-codex__detail-body" data-codex-detail-slot>${customDetail}</div></aside>`;
}
