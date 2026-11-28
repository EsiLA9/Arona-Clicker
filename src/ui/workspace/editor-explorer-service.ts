import type { EditorResourceOpenRequest } from './editor-resource-request';
import type { EditorExplorerType } from './editor-workbench';
import { editorDirectoryClick, setEditorDirectoryExpanded } from './editor-directory';

export type EditorExplorerExpansionLayer = 'normal' | 'search';

export interface EditorExplorerStateSnapshot {
  readonly queries: Readonly<Record<string, string>>;
  readonly filters: Readonly<Record<string, string>>;
  readonly filterPanels: Readonly<Record<string, boolean>>;
  readonly expandedPlacementKeys: readonly string[];
  readonly searchExpandedPlacementKeys: readonly string[];
  readonly expandedOverrides: Readonly<Record<string, boolean>>;
  readonly searchExpandedOverrides: Readonly<Record<string, boolean>>;
  readonly selectedPlacementKey?: string;
  readonly scrollTopByHost: Readonly<Record<string, number>>;
  readonly focusRequest?: string;
  readonly reveal?: { readonly resourceKey: string; readonly placementKey?: string; readonly sourceKey?: string };
}

interface MutableExplorerState {
  queries: Map<string, string>;
  filters: Map<string, string>;
  filterPanels: Map<string, boolean>;
  expanded: Map<string, boolean>;
  searchExpanded: Map<string, boolean>;
  selectedPlacementKey?: string;
  scrollTopByHost: Map<string, number>;
  focusRequest?: string;
  reveal?: EditorExplorerStateSnapshot['reveal'];
}

function findPlacementControl(root: HTMLElement, placementKey: string): HTMLElement | undefined {
  for (const control of root.querySelectorAll<HTMLElement>('[data-editor-placement-select][data-editor-placement-key]')) {
    if (control.dataset.editorPlacementKey === placementKey) return control;
  }
  return undefined;
}

function createState(): MutableExplorerState {
  return { queries: new Map(), filters: new Map(), filterPanels: new Map(), expanded: new Map(), searchExpanded: new Map(), scrollTopByHost: new Map() };
}

/** Owns common navigation and search state. Providers describe entities and available filters. */
export class EditorExplorerService {
  private readonly states = new Map<EditorExplorerType, MutableExplorerState>();

  private state(type: EditorExplorerType): MutableExplorerState {
    let state = this.states.get(type);
    if (!state) { state = createState(); this.states.set(type, state); }
    return state;
  }

  snapshot(type: EditorExplorerType): EditorExplorerStateSnapshot {
    const state = this.state(type);
    return {
      queries: Object.fromEntries(state.queries),
      filters: Object.fromEntries(state.filters),
      filterPanels: Object.fromEntries(state.filterPanels),
      expandedPlacementKeys: [...state.expanded].filter(([, open]) => open).map(([key]) => key),
      searchExpandedPlacementKeys: [...state.searchExpanded].filter(([, open]) => open).map(([key]) => key),
      expandedOverrides: Object.fromEntries(state.expanded),
      searchExpandedOverrides: Object.fromEntries(state.searchExpanded),
      selectedPlacementKey: state.selectedPlacementKey,
      scrollTopByHost: Object.fromEntries(state.scrollTopByHost),
      focusRequest: state.focusRequest,
      reveal: state.reveal ? { ...state.reveal } : undefined,
    };
  }

  query(type: EditorExplorerType, channel: string): string { return this.state(type).queries.get(channel) ?? ''; }
  setQuery(type: EditorExplorerType, channel: string, value: string): void { this.state(type).queries.set(channel, value); }
  filter(type: EditorExplorerType, key: string): string { return this.state(type).filters.get(key) ?? ''; }
  setFilter(type: EditorExplorerType, key: string, value: string): void {
    const filters = this.state(type).filters;
    if (value) filters.set(key, value);
    else filters.delete(key);
    this.clearSearchExpansions(type);
    this.clearReveal(type);
  }
  setFilterPanel(type: EditorExplorerType, pane: string, open: boolean): void { this.state(type).filterPanels.set(pane, open); }
  clearFilters(type: EditorExplorerType, keys: readonly string[], channels: readonly string[]): void {
    const state = this.state(type);
    keys.forEach(key => state.filters.delete(key));
    channels.forEach(channel => state.queries.delete(channel));
    this.clearSearchExpansions(type);
    this.clearReveal(type);
  }

  isExpanded(type: EditorExplorerType, placementKey: string, layer: EditorExplorerExpansionLayer = 'normal'): boolean {
    const state = this.state(type);
    return (layer === 'search' ? state.searchExpanded : state.expanded).get(placementKey) ?? false;
  }
  setExpanded(type: EditorExplorerType, placementKey: string, open: boolean, layer: EditorExplorerExpansionLayer = 'normal'): void {
    const values = layer === 'search' ? this.state(type).searchExpanded : this.state(type).expanded;
    values.set(placementKey, open);
  }
  toggleExpanded(type: EditorExplorerType, placementKey: string, layer: EditorExplorerExpansionLayer = 'normal'): boolean {
    const open = !this.isExpanded(type, placementKey, layer);
    this.setExpanded(type, placementKey, open, layer);
    return open;
  }
  clearSearchExpansions(type: EditorExplorerType): void { this.state(type).searchExpanded.clear(); }
  replaceExpansions(type: EditorExplorerType, placementKeys: Iterable<string>, layer: EditorExplorerExpansionLayer = 'normal'): void {
    const values = layer === 'search' ? this.state(type).searchExpanded : this.state(type).expanded;
    values.clear();
    for (const key of placementKeys) values.set(key, true);
  }
  replaceExpansionOverrides(type: EditorExplorerType, overrides: Readonly<Record<string, boolean>>,
    layer: EditorExplorerExpansionLayer = 'normal'): void {
    const values = layer === 'search' ? this.state(type).searchExpanded : this.state(type).expanded;
    values.clear();
    for (const [key, expanded] of Object.entries(overrides)) values.set(key, expanded);
  }

  selectPlacement(type: EditorExplorerType, placementKey?: string): void { this.state(type).selectedPlacementKey = placementKey; }
  selectPlacementInColumn(root: HTMLElement, type: EditorExplorerType, placementKey?: string, control?: HTMLElement | null): void {
    this.selectPlacement(type, placementKey);
    const previous = root.querySelector<HTMLElement>('[data-editor-placement-select][aria-pressed="true"]');
    if (previous?.dataset.editorPlacementKey === placementKey) return;
    previous?.setAttribute('aria-pressed', 'false');
    if (placementKey !== undefined) {
      (control ?? findPlacementControl(root, placementKey))?.setAttribute('aria-pressed', 'true');
    }
  }
  revealPlacement(root: HTMLElement, type: EditorExplorerType, placementKey: string,
    layer: EditorExplorerExpansionLayer = 'normal'): boolean {
    const row = findPlacementControl(root, placementKey);
    if (!row || row.closest('[data-editor-explorer-pane][hidden]')) return false;
    const expansionLayer = this.state(type).reveal ? 'search' : layer;
    this.selectPlacementInColumn(root, type, placementKey, row);
    let list = row.closest<HTMLUListElement>('ul');
    while (list && root.contains(list)) {
      const parent = list.parentElement?.closest<HTMLElement>('li');
      if (!parent) break;
      if (list.hidden) {
        const toggle = parent.querySelector<HTMLElement>(':scope > .editor-directory-heading > [data-editor-expand]');
        if (toggle) {
          const key = toggle.dataset.editorPlacementKey;
          if (key) this.setExpanded(type, key, true, expansionLayer);
          setEditorDirectoryExpanded(toggle, true);
        } else list.hidden = false;
      }
      list = parent.parentElement?.closest<HTMLUListElement>('ul') ?? null;
    }
    const host = row.closest<HTMLElement>('[data-scroll-key]');
    if (host) {
      const hostRect = host.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      if (rowRect.top < hostRect.top) host.scrollTop -= hostRect.top - rowRect.top;
      else if (rowRect.bottom > hostRect.bottom) host.scrollTop += rowRect.bottom - hostRect.bottom;
    }
    row.focus({ preventScroll: true });
    return true;
  }
  scrollTop(type: EditorExplorerType, hostKey: string): number { return this.state(type).scrollTopByHost.get(hostKey) ?? 0; }
  setScrollTop(type: EditorExplorerType, hostKey: string, value: number): void {
    if (Number.isFinite(value) && value >= 0) this.state(type).scrollTopByHost.set(hostKey, value);
  }
  requestFocus(type: EditorExplorerType, request: string): void { this.state(type).focusRequest = request; }
  takeFocusRequest(type: EditorExplorerType): string | undefined {
    const state = this.state(type);
    const request = state.focusRequest;
    state.focusRequest = undefined;
    return request;
  }
  reveal(type: EditorExplorerType, resourceKey: string, placementKey?: string, sourceKey?: string): void {
    this.state(type).reveal = { resourceKey, placementKey, ...(sourceKey !== undefined ? { sourceKey } : {}) };
  }
  restore(type: EditorExplorerType, snapshot: EditorExplorerStateSnapshot): void {
    this.states.set(type, { queries: new Map(Object.entries(snapshot.queries)),
      filters: new Map(Object.entries(snapshot.filters)), filterPanels: new Map(Object.entries(snapshot.filterPanels)),
      expanded: new Map(Object.entries(snapshot.expandedOverrides)), searchExpanded: new Map(Object.entries(snapshot.searchExpandedOverrides)),
      selectedPlacementKey: snapshot.selectedPlacementKey, scrollTopByHost: new Map(Object.entries(snapshot.scrollTopByHost)),
      focusRequest: snapshot.focusRequest, reveal: snapshot.reveal });
  }
  clearReveal(type: EditorExplorerType): void { this.state(type).reveal = undefined; }
  clearTransientState(type?: EditorExplorerType): void {
    const targets = type ? [this.state(type)] : [...this.states.values()];
    for (const state of targets) {
      state.searchExpanded.clear();
      state.focusRequest = undefined;
      state.reveal = undefined;
    }
  }

  bindColumn(root: HTMLElement, type: EditorExplorerType, options: {
    resolve: Parameters<typeof editorDirectoryClick>[2];
    open: (request: EditorResourceOpenRequest) => boolean;
    onTreeChange?: () => void;
    onQuery?: (channel: string, value: string, field: HTMLInputElement) => void;
  }): () => void {
    const abort = new AbortController();
    root.addEventListener('click', event => {
      let refresh = false;
      editorDirectoryClick(root, event, options.resolve, {
        expand: (placementKey, toggle, open) => {
          const pane = toggle.closest('[data-editor-explorer-pane]') ?? root;
          const channel = pane.querySelector<HTMLInputElement>('[data-editor-explorer-query]')?.dataset.editorExplorerQuery;
          const searching = pane.hasAttribute('data-editor-filter-active') || Boolean(channel && this.query(type, channel).trim());
          this.setExpanded(type, placementKey, open, searching ? 'search' : 'normal');
          if (!searching && this.state(type).reveal) this.setExpanded(type, placementKey, open, 'search');
          setEditorDirectoryExpanded(toggle, open);
          refresh ||= toggle.hasAttribute('data-editor-expand-deferred');
        },
        select: (placementKey, control) => this.selectPlacementInColumn(root, type, placementKey, control),
        open: (request, control) => {
          if (!control) return options.open(request);
          const previous = this.state(type).selectedPlacementKey;
          this.selectPlacementInColumn(root, type, request.placementKey, control);
          if (options.open(request)) return true;
          this.selectPlacementInColumn(root, type, previous);
          return false;
        },
      });
      if (refresh) options.onTreeChange?.();
    }, { signal: abort.signal });
    root.addEventListener('input', event => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement) || !root.contains(field)) return;
      const channel = field.dataset.editorExplorerQuery;
      if (!channel) return;
      this.setQuery(type, channel, field.value);
      this.clearSearchExpansions(type);
      this.clearReveal(type);
      options.onQuery?.(channel, field.value, field);
      event.stopImmediatePropagation();
    }, { signal: abort.signal });
    root.addEventListener('scroll', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !root.contains(target)) return;
      const hostKey = target.dataset.scrollKey;
      if (hostKey) this.setScrollTop(type, hostKey, target.scrollTop);
    }, { capture: true, passive: true, signal: abort.signal });
    return () => abort.abort();
  }
}
