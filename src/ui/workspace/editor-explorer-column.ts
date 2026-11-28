import type { EditorResourceOpenRequest } from './editor-resource-request';
import type { UIContext } from '../runtime/context';
import { patchEditorDOM } from './editor-dom';
import type { EditorExplorerType } from './editor-workbench';
import type { EditorExplorerService, EditorExplorerStateSnapshot } from './editor-explorer-service';
import { bindEditorDirectoryScrollbars, refreshEditorDirectoryScrollbars, renderEditorDirectoryScroll } from './editor-directory-scroll';
import { projectEditorExplorerTree, renderEditorDirectoryTools, renderEditorExplorerSearch, renderEditorExplorerTree } from './editor-directory';
import { createEditorWorkspaceColumn } from './editor-workspace-frame';

export interface EditorExplorerTreeDescription {
  positions: Parameters<typeof projectEditorExplorerTree>[0];
  options: Omit<Parameters<typeof projectEditorExplorerTree>[1], 'query' | 'filtering'>;
  emptyMessage: string;
  noMatchMessage: string;
}

interface ExplorerOption {
  value: string;
  label: string;
}

interface ExplorerSelect {
  label: string;
  key: string;
  value: string;
  groups: readonly { label?: string; options: readonly ExplorerOption[] }[];
  attribute?: `data-${string}`;
}

interface ExplorerFacet {
  key: string;
  label: string;
  options: readonly ExplorerOption[];
  presentation?: 'choices' | 'select';
  attribute?: `data-${string}`;
  actionPrefix?: string;
}

const explorerKindLabels = { story: 'Story', entry: 'Entry', init: 'Init', area: 'Area', spot: 'Spot' };
export function editorExplorerKindFilter(kinds: readonly (keyof typeof explorerKindLabels)[]): ExplorerFacet {
  return { key: 'kind', label: '内容类型', options: [{ value: '', label: '全部' },
    ...kinds.map(value => ({ value, label: explorerKindLabels[value] }))] };
}

interface ExplorerPane {
  key: string;
  title: string;
  scrollKey: string;
  listKey: string;
  listClass?: string;
  className?: string;
  hidden?: boolean;
  search?: Omit<Parameters<typeof renderEditorExplorerSearch>[1], 'query'>;
  filters?: { id: string; defaultOpen?: boolean; facets: readonly ExplorerFacet[]; clearQueryChannels?: readonly string[] };
  controls?: string;
  tools?: string;
  tree?: EditorExplorerTreeDescription;
  list?: string;
  navigationAttribute?: 'data-world-tree';
}

export interface EditorExplorerDescription {
  title: string;
  views?: { id: string; value: string; options: readonly ExplorerOption[]; actionPrefix?: string };
  source?: ExplorerSelect;
  sourceWarning?: string;
  leaveAction?: Parameters<typeof createEditorWorkspaceColumn>[1]['leaveAction'];
  className?: string;
  contentClass?: string;
  panes: readonly ExplorerPane[];
}

export interface EditorExplorerProvider {
  describe: () => EditorExplorerDescription;
  openResource?: (request: EditorResourceOpenRequest) => boolean;
  beforeRemove?: (root: HTMLElement) => void;
  bindActions?: (root: HTMLElement) => (() => void) | undefined;
  changeControl?: (control: string, value: string) => boolean;
}

export function renderEditorExplorerColumn(ctx: UIContext, type: EditorExplorerType, spec: EditorExplorerDescription, state: EditorExplorerStateSnapshot) {
  const e = ctx.escapeHtml;
  const select = (control: ExplorerSelect, name: string) => {
    const options = control.groups.flatMap(group => group.options);
    return `<label class="${name === 'source' ? 'editor-explorer-source' : ''}">${e(control.label)}
      <select ${control.attribute ?? ''} data-editor-explorer-control="${e(name)}" data-editor-key="${e(control.key)}" title="${e(options.find(option => option.value === control.value)?.label ?? '')}">
        ${control.groups.map(group => {
          const choices = group.options.map(option => `<option value="${e(option.value)}"${option.value === control.value ? ' selected' : ''}>${e(option.label)}</option>`).join('');
          return group.label && choices ? `<optgroup label="${e(group.label)}">${choices}</optgroup>` : choices;
        }).join('')}
      </select></label>`;
  };
  const choice = (control: string, option: ExplorerOption, group: { value: string; actionPrefix?: string }) =>
    `<button type="button" class="mini-action" data-editor-explorer-control="${e(control)}" value="${e(option.value)}"${group.actionPrefix ? ` data-column-action="${e(group.actionPrefix + (option.value || 'all'))}"` : ''} aria-pressed="${option.value === group.value}">${e(option.label)}</button>`;
  const views = spec.views;
  const selectedView = views?.options.find(option => option.value === views.value);
  const nextView = views?.options[(views.options.findIndex(option => option === selectedView) + 1) % views.options.length];
  const titleActions = views && selectedView && nextView ? `<div class="editor-explorer-view" role="group" aria-label="左栏视图">
    <button type="button" class="mini-action" data-sidebar-mode-cycle data-editor-explorer-control="view" value="${e(nextView.value)}" title="切换到${e(nextView.label)}" aria-label="${e(selectedView.label)}，切换到${e(nextView.label)}">${e(selectedView.label)}</button>
    <button type="button" class="mini-action" popovertarget="${e(views.id)}" aria-label="选择左栏视图" title="选择左栏视图"><span aria-hidden="true">▾</span></button>
    <div id="${e(views.id)}" class="editor-explorer-views" popover="auto" role="group" aria-label="选择左栏视图">${views.options.map(option => choice('view', option, views)).join('')}</div>
  </div>` : undefined;
  const panes = spec.panes.map(pane => {
    const query = pane.search ? state.queries[pane.search.channel] ?? '' : '';
    const facets = (pane.filters?.facets ?? []).map(facet => ({ ...facet,
      selected: facet.options.find(option => option.value === state.filters[facet.key]) }));
    const activeFacets = facets.flatMap(({ key, selected }) => selected?.value ? [{ key, ...selected }] : []);
    const summary = [query.trim(), ...activeFacets.map(facet => facet.label)].filter(Boolean).join(' · ');
    const filtering = activeFacets.length > 0;
    const filtersOpen = state.filterPanels[pane.key] ?? pane.filters?.defaultOpen ?? false;
    const search = pane.search ? renderEditorExplorerSearch(ctx, { ...pane.search, query }) : '';
    const treeSpec = pane.tree;
    const tree = treeSpec && projectEditorExplorerTree(treeSpec.positions, { ...treeSpec.options, query, filtering,
      domainVisible: node => (treeSpec.options.domainVisible?.(node) ?? true) && activeFacets.every(facet => {
        const values = node.filterValues?.[facet.key] ?? (facet.key === 'kind' ? node.resource?.kind : undefined);
        return typeof values === 'string' ? values === facet.value : values?.includes(facet.value);
      }),
    });
    const content = tree && pane.tree
      ? renderEditorExplorerTree(ctx, tree, tree.emptyReason === 'no-items' ? pane.tree.emptyMessage : pane.tree.noMatchMessage)
      : pane.list ?? '';
    return `<section class="editor-explorer-pane ${pane.className ?? ''}" data-editor-explorer-pane="${e(pane.key)}" data-editor-key="${e(pane.key)}" aria-label="${e(pane.title)}"${pane.hidden ? ' hidden' : ''}${filtering ? ' data-editor-filter-active' : ''}>
    ${pane.tools || pane.filters ? renderEditorDirectoryTools('目录工具', (pane.filters
      ? `<button type="button" class="mini-action" data-sidebar-action="filters" data-editor-explorer-control="filters" aria-expanded="${filtersOpen}" aria-controls="${e(pane.filters.id)}">搜索与筛选 <span aria-hidden="true">${filtersOpen ? '▾' : '▸'}</span></button>` : '') + (pane.tools ?? ''), `${pane.key}-tools`) : ''}
    ${pane.filters && summary ? `<div class="editor-explorer-summary" data-editor-key="sidebar-summary"><span title="${e(summary)}">${e(summary)}</span><button type="button" class="mini-action" data-sidebar-action="clear" data-editor-explorer-control="clear">清除筛选</button></div>` : ''}
    ${pane.filters ? `<div class="editor-explorer-filters" id="${e(pane.filters.id)}" data-editor-key="sidebar-filters"${filtersOpen ? '' : ' hidden'}>
      ${search}${facets.map(facet => {
        const control = `filter:${facet.key}`;
        const value = facet.selected?.value ?? '';
        return facet.presentation === 'select' ? select({ ...facet, value, groups: [{ options: facet.options }] }, control)
          : `<div class="editor-explorer-choices" role="group" aria-label="${e(facet.label)}">${facet.options.map(option => choice(control, option, { ...facet, value })).join('')}</div>`;
      }).join('')}</div>` : search}
    ${pane.controls ?? ''}
    ${renderEditorDirectoryScroll(ctx, pane.scrollKey, pane.listKey, pane.listClass ?? '', pane.navigationAttribute
      ? `<nav ${pane.navigationAttribute} aria-label="${e(pane.title)}">${content}</nav>` : content)}
  </section>`;
  }).join('');
  return createEditorWorkspaceColumn(ctx, { key: 'editor-explorer', slot: 'left', title: spec.title, titleActions,
    leaveAction: spec.leaveAction, className: spec.className, bindingKey: `${type}-explorer`, workspaceOwner: 'editor-workbench',
    hostId: 'editor-explorer', themeScope: 'left.editor', scroll: 'content',
    content: `<div class="editor-explorer-content ${spec.contentClass ?? ''}">${spec.source ? select(spec.source, 'source') : ''}
      ${spec.sourceWarning ? `<p class="story-editor-hint" role="status">${e(spec.sourceWarning)}</p>` : ''}${panes}</div>` });
}

const mountedExplorer = new WeakMap<HTMLElement, {
  refresh: (captureScroll?: boolean) => void;
  capture: () => void;
  restore: () => void;
}>();

export function refreshEditorExplorerColumn(root: HTMLElement | undefined, captureScroll = true): boolean {
  const refresh = root && mountedExplorer.get(root)?.refresh;
  if (!refresh || !root?.isConnected) return false;
  refresh(captureScroll);
  return true;
}

/** Updates mounted activity markers without rebuilding a view's data or touching its selection. */
export function markMountedExplorerResource(root: HTMLElement | undefined, identity?: { resourceKey: string; sourceKey?: string }): boolean {
  if (!root?.isConnected || !mountedExplorer.has(root)) return false;
  for (const row of root.querySelectorAll<HTMLElement>('li[data-active-resource]')) row.removeAttribute('data-active-resource');
  if (identity) for (const row of root.querySelectorAll<HTMLElement>('li[data-editor-highlight-resource]')) {
    if (row.dataset.editorHighlightResource === identity.resourceKey
      && (identity.sourceKey === undefined || row.dataset.editorHighlightSource === identity.sourceKey)) {
      row.setAttribute('data-active-resource', 'true');
    }
  }
  return true;
}

export function editorExplorerScroll(root: HTMLElement | undefined, action: 'capture' | 'restore'): void {
  if (root) mountedExplorer.get(root)?.[action]();
}

export function createEditorExplorerColumn(ctx: UIContext, type: EditorExplorerType, service: EditorExplorerService,
  provider: EditorExplorerProvider) {
  let description = provider.describe();
  const render = () => renderEditorExplorerColumn(ctx, type, description, service.snapshot(type));
  return { ...render(), bind: (root: HTMLElement) => {
    const hosts = () => [...root.querySelectorAll<HTMLElement>('[data-scroll-key]')];
    const visible = (host: HTMLElement) => !host.closest('[hidden]') &&
      root.closest<HTMLElement>('[data-editor-workspace]')?.dataset.editorWorkspaceView !== 'focus';
    const capture = () => {
      if (!root.isConnected) return;
      for (const host of hosts()) if (visible(host)) service.setScrollTop(type, host.dataset.scrollKey!, host.scrollTop);
    };
    const restore = () => {
      for (const host of hosts()) if (visible(host)) host.scrollTop = service.scrollTop(type, host.dataset.scrollKey!);
      refreshEditorDirectoryScrollbars(root);
    };
    const refresh = (captureScroll = true) => {
      if (captureScroll) capture();
      description = provider.describe();
      const next = render();
      for (const [selector, markup] of [['.workspace-column__body', next.content], ['.workspace-column__header', next.header]] as const) {
        const current = root.querySelector<HTMLElement>(selector);
        if (!current) continue;
        const template = current.cloneNode(false) as HTMLElement;
        template.innerHTML = markup ?? '';
        if (current.innerHTML === template.innerHTML && selector === '.workspace-column__header') continue;
        patchEditorDOM(current, template, provider.beforeRemove ?? (() => {}));
      }
      restore();
    };
    mountedExplorer.set(root, { refresh, capture, restore });
    const unbind = service.bindColumn(root, type, {
      resolve: row => {
        const paneKey = row.closest<HTMLElement>('[data-editor-explorer-pane]')?.dataset.editorExplorerPane;
        return provider.describe().panes.find(pane => pane.key === paneKey)?.tree?.positions
          .find(node => node.placementKey === row.dataset.editorPlacementKey);
      },
      open: request => provider.openResource?.(request) ?? false,
      onQuery: () => refresh(),
      onTreeChange: refresh,
    });
    const unbindScrollbars = bindEditorDirectoryScrollbars(root);
    const controls = new AbortController();
    const changeControl = (target: HTMLButtonElement | HTMLSelectElement, event: Event) => {
      const control = target.dataset.editorExplorerControl;
      if (!control) return;
      const paneKey = target.closest<HTMLElement>('[data-editor-explorer-pane]')?.dataset.editorExplorerPane;
      const pane = description.panes.find(candidate => candidate.key === paneKey);
      if (pane?.filters && control === 'filters') service.setFilterPanel(type, pane.key, target.getAttribute('aria-expanded') !== 'true');
      else if (pane?.filters && control === 'clear') service.clearFilters(type, pane.filters.facets.map(facet => facet.key),
        pane.filters.clearQueryChannels ?? (pane.search ? [pane.search.channel] : []));
      else if (pane?.filters && control.startsWith('filter:')) {
        const facet = pane.filters.facets.find(item => `filter:${item.key}` === control);
        if (!facet?.options.some(option => option.value === target.value)) return;
        service.setFilter(type, facet.key, target.value);
      } else if (!provider.changeControl?.(control, target.value)) return;
      event.stopImmediatePropagation();
      if (control === 'view') {
        const menu = target.closest<HTMLElement>('[popover]');
        menu?.hidePopover?.();
        if (menu) root.querySelector<HTMLElement>('[popovertarget]')?.focus({ preventScroll: true });
      }
      refresh();
      if (control === 'filters' && target.getAttribute('aria-expanded') === 'true') {
        target.closest('[data-editor-explorer-pane]')?.querySelector<HTMLElement>('[data-editor-explorer-query]')?.focus({ preventScroll: true });
      }
    };
    root.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-editor-explorer-control]') : null;
      if (button && root.contains(button)) changeControl(button, event);
    }, { signal: controls.signal });
    root.addEventListener('change', event => {
      if (event.target instanceof HTMLSelectElement) changeControl(event.target, event);
    }, { signal: controls.signal });
    const unbindActions = provider.bindActions?.(root);
    restore();
    return () => { capture(); mountedExplorer.delete(root); unbind(); controls.abort(); unbindScrollbars(); unbindActions?.(); };
  } };
}
