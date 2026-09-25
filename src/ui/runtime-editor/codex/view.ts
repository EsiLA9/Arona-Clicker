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
  codexModEntryCount,
  escapeCodexHtml,
  groupCodexKinds,
  renderCodexBadges,
  renderCodexEmptyState,
} from './helpers';
import {
  getCodexVisibleEntries,
  getCodexVisibleKinds,
  getSelectedCodexEntry,
  reconcileCodexShellState,
} from './state';

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

  return `<section class="runtime-editor-codex" data-runtime-editor-codex data-codex-mobile-pane="${safeState.mobilePane}" aria-label="超级图鉴">
    ${renderMobilePaneNav(safeState.mobilePane)}
    <div class="runtime-editor-codex__grid">
      ${renderModPane(view.loadedMods, view, safeState)}
      ${renderCodexEntryPane(view, safeState)}
      ${renderCodexDetailPane(getSelectedCodexEntry(view, safeState), view.loadedMods, options.renderDetail, safeState)}
    </div>
  </section>`;
}

function renderMobilePaneNav(activePane: CodexPane): string {
  const panes: readonly { id: CodexPane; label: string }[] = [
    { id: 'mods', label: 'Mod' },
    { id: 'entries', label: '类型 / 条目' },
    { id: 'detail', label: '详情' },
  ];
  return `<nav class="runtime-editor-codex__mobile-nav" aria-label="图鉴栏位切换" role="tablist">${panes.map(pane => `<button type="button" role="tab" aria-selected="${activePane === pane.id}" aria-controls="runtime-editor-codex-${pane.id}" data-codex-mobile-pane="${pane.id}"${activePane === pane.id ? ' class="is-active"' : ''}>${escapeCodexHtml(pane.label)}</button>`).join('')}</nav>`;
}

function renderModPane(
  mods: readonly CodexModView[],
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
): string {
  const body = mods.length === 0
    ? renderCodexEmptyState('Runtime 暂无内容', '当前引擎没有暴露可浏览的已加载 Mod。', 'mods')
    : `<div class="runtime-editor-codex__list" role="listbox" aria-label="已加载 Mod">${mods.map((mod, index) => renderModRow(mod, view, state, index, mods.length)).join('')}</div>`;
  return `<aside class="runtime-editor-codex__pane runtime-editor-codex__pane--mods" id="runtime-editor-codex-mods" data-codex-pane="mods" aria-labelledby="runtime-editor-codex-mods-title"><header class="runtime-editor-codex__pane-head"><div><span class="runtime-editor-codex__eyebrow">SOURCE RAIL</span><h3 id="runtime-editor-codex-mods-title">已加载 Mod</h3></div><span class="runtime-editor-codex__count">${mods.length}</span></header>${body}</aside>`;
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
  const version = mod.version ? `v${mod.version}` : '当前 Runtime';
  return `<button type="button" class="runtime-editor-codex__mod${selected ? ' is-selected' : ''}" role="option" aria-selected="${selected}" aria-posinset="${index + 1}" aria-setsize="${total}" data-codex-mod="${escapeCodexHtml(mod.id)}"><span class="runtime-editor-codex__mod-mark" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="runtime-editor-codex__mod-copy"><strong>${escapeCodexHtml(mod.label)}</strong><small>${escapeCodexHtml(mod.id)} · ${escapeCodexHtml(version)}</small><span>${codexModEntryCount(mod, count)} 条 Def${mod.statusLabel ? ` · ${escapeCodexHtml(mod.statusLabel)}` : ''}</span>${renderCodexBadges(mod.badges)}</span><span class="runtime-editor-codex__chevron" aria-hidden="true">›</span></button>`;
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
      state.query ? '换一个名称、ID、标签或字段摘要试试。' : '所选 Mod 尚未暴露可浏览的 Def。',
      'kinds',
    )
    : [...groups.entries()].map(([group, kinds]) => `<section class="runtime-editor-codex__kind-group"><h4>${escapeCodexHtml(group)}</h4><div class="runtime-editor-codex__kind-tabs" role="tablist" aria-label="${escapeCodexHtml(group)}">${kinds.map(kind => renderKindTab(kind, state, view)).join('')}</div></section>`).join('');
  const list = visibleEntries.length === 0
    ? renderCodexEmptyState(
      state.query ? '没有匹配条目' : '没有可显示的 Def',
      state.query ? '搜索只作用于当前 Runtime 的有效内容。' : '当前筛选范围内没有可浏览条目。',
      'entries',
    )
    : `<div class="runtime-editor-codex__entry-list" role="listbox" aria-label="Def 条目">${visibleEntries.map((entry, index) => renderEntryRow(entry, view, state, index, visibleEntries.length)).join('')}</div>`;
  const selectedKindLabel = state.selectedKind
    ? visibleKinds.find(kind => kind.definitionKind === state.selectedKind)?.label ?? state.selectedKind
    : '全部类型';
  const filterSummary = `${selectedKindLabel} · ${visibleKinds.length} 种可用类型`;
  return `<section class="runtime-editor-codex__pane runtime-editor-codex__pane--entries" id="runtime-editor-codex-entries" data-codex-pane="entries" aria-labelledby="runtime-editor-codex-entries-title"><header class="runtime-editor-codex__pane-head"><div><span class="runtime-editor-codex__eyebrow">QUERY DECK</span><h3 id="runtime-editor-codex-entries-title">类型 / 条目</h3></div><span class="runtime-editor-codex__count">${visibleEntries.length}</span></header><div class="runtime-editor-codex__search"><label for="runtime-editor-codex-query"><span class="runtime-editor-codex__eyebrow">SEARCH</span><span class="sr-only">搜索名称、ID、标签或字段摘要</span></label><input id="runtime-editor-codex-query" type="search" value="${escapeCodexHtml(state.query)}" placeholder="名称、完整 ID、字段…" autocomplete="off" data-codex-query aria-controls="runtime-editor-codex-entry-list"><span class="runtime-editor-codex__search-hint">${state.selectedModId ? `当前 Mod：${escapeCodexHtml(view.loadedMods.find(mod => mod.id === state.selectedModId)?.label ?? state.selectedModId)}` : '范围：全部已加载 Mod'}</span></div><details class="runtime-editor-codex__kind-filter" data-codex-kind-filter${state.kindFilterOpen ? ' open' : ''}><summary class="runtime-editor-codex__kind-filter-summary"><span>类型筛选</span><small>${escapeCodexHtml(filterSummary)}</small></summary><div class="runtime-editor-codex__kind-filter-body"><button type="button" class="runtime-editor-codex__kind-tab${state.selectedKind === null ? ' is-selected' : ''}" role="tab" aria-selected="${state.selectedKind === null}" aria-controls="runtime-editor-codex-entry-list" data-codex-kind="">全部类型</button>${kindTabs}</div></details><div class="runtime-editor-codex__entries-wrap" id="runtime-editor-codex-entry-list">${list}</div></section>`;
}

function renderKindTab(kind: CodexKindView, state: CodexShellState, view: RuntimeContentBrowserShellView): string {
  const count = view.entries.filter(entry => entry.definitionKind === kind.definitionKind && (!state.selectedModId || entry.modId === state.selectedModId)).length;
  const selected = state.selectedKind === kind.definitionKind;
  const displayedCount = state.selectedModId ? count : kind.entryCount ?? count;
  return `<button type="button" class="runtime-editor-codex__kind-tab${selected ? ' is-selected' : ''}" role="tab" aria-selected="${selected}" aria-controls="runtime-editor-codex-entry-list" data-codex-kind="${escapeCodexHtml(kind.definitionKind)}"><span>${escapeCodexHtml(kind.label)}</span><small>${displayedCount}</small></button>`;
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
  state?: Pick<CodexShellState, 'backStack' | 'forwardStack'>,
): string {
  if (!entry) {
    return `<aside class="runtime-editor-codex__pane runtime-editor-codex__pane--detail" id="runtime-editor-codex-detail" data-codex-pane="detail" aria-labelledby="runtime-editor-codex-detail-title"><header class="runtime-editor-codex__pane-head"><div><span class="runtime-editor-codex__eyebrow">DEF INSPECTOR</span><h3 id="runtime-editor-codex-detail-title">详情检查器</h3></div></header>${renderCodexEmptyState('选择一个 Def', '从中栏选择条目后，这里会承载只读详情。', 'detail')}</aside>`;
  }
  const customDetail = renderDetail?.(entry) ?? '<p class="runtime-editor-codex__detail-placeholder">详情检查器接口已预留。当前壳层只负责选择和定位，不解析 Def 语义。</p>';
  const modLabel = mods.find(mod => mod.id === entry.modId)?.label ?? entry.modId;
  const backDisabled = !state?.backStack.length;
  const forwardDisabled = !state?.forwardStack.length;
  return `<aside class="runtime-editor-codex__pane runtime-editor-codex__pane--detail" id="runtime-editor-codex-detail" data-codex-pane="detail" aria-labelledby="runtime-editor-codex-detail-title"><header class="runtime-editor-codex__detail-head"><div class="runtime-editor-codex__detail-toolbar"><div class="runtime-editor-codex__detail-nav" aria-label="详情导航"><button type="button" data-codex-navigation="back" aria-label="返回上一个 Def" title="返回上一个 Def"${backDisabled ? ' disabled' : ''}>‹</button><button type="button" data-codex-navigation="forward" aria-label="前往下一个 Def" title="前往下一个 Def"${forwardDisabled ? ' disabled' : ''}>›</button></div><span class="runtime-editor-codex__eyebrow">DEF INSPECTOR</span></div><h3 id="runtime-editor-codex-detail-title">${escapeCodexHtml(entry.label || entry.fullId)}</h3><code>${escapeCodexHtml(entry.definitionKind)} · ${escapeCodexHtml(entry.fullId)}</code><span class="runtime-editor-codex__detail-source">来源：${escapeCodexHtml(modLabel)}</span>${entry.statusLabel ? `<span class="runtime-editor-codex__detail-status">${escapeCodexHtml(entry.statusLabel)}</span>` : ''}${renderCodexBadges(entry.badges)}</header><div class="runtime-editor-codex__detail-body" data-codex-detail-slot>${customDetail}</div></aside>`;
}
