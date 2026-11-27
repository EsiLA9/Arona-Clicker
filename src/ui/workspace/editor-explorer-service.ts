import type { EditorExplorerType } from './editor-workbench';
import { setEditorDirectoryExpanded } from './editor-directory';

export type EditorExplorerExpansionLayer = 'normal' | 'search';

export interface EditorExplorerStateSnapshot {
  readonly queries: Readonly<Record<string, string>>;
  readonly expandedPlacementKeys: readonly string[];
  readonly searchExpandedPlacementKeys: readonly string[];
  readonly expandedOverrides: Readonly<Record<string, boolean>>;
  readonly searchExpandedOverrides: Readonly<Record<string, boolean>>;
  readonly selectedPlacementKey?: string;
  readonly scrollTopByHost: Readonly<Record<string, number>>;
  readonly focusRequest?: string;
  readonly reveal?: { readonly resourceKey: string; readonly placementKey?: string };
}

interface MutableExplorerState {
  queries: Map<string, string>;
  expanded: Map<string, boolean>;
  searchExpanded: Map<string, boolean>;
  selectedPlacementKey?: string;
  scrollTopByHost: Map<string, number>;
  focusRequest?: string;
  reveal?: { resourceKey: string; placementKey?: string };
}

function createState(): MutableExplorerState {
  return { queries: new Map(), expanded: new Map(), searchExpanded: new Map(), scrollTopByHost: new Map() };
}

/** Owns only generic navigation state; Provider identities and filtering rules stay outside. */
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
  selectPlacementInColumn(root: HTMLElement, type: EditorExplorerType, placementKey?: string): void {
    this.selectPlacement(type, placementKey);
    root.querySelectorAll<HTMLElement>('[data-editor-placement-select][data-editor-placement-key]').forEach(row => {
      row.setAttribute('aria-pressed', String(row.dataset.editorPlacementKey === placementKey));
    });
  }
  revealPlacement(root: HTMLElement, type: EditorExplorerType, placementKey: string,
    layer: EditorExplorerExpansionLayer = 'normal'): boolean {
    const row = [...root.querySelectorAll<HTMLElement>('[data-editor-placement-select][data-editor-placement-key]')]
      .find(candidate => candidate.dataset.editorPlacementKey === placementKey);
    if (!row) return false;
    const expansionLayer = this.state(type).reveal ? 'search' : layer;
    this.selectPlacementInColumn(root, type, placementKey);
    let list = row.closest<HTMLUListElement>('ul');
    while (list && root.contains(list)) {
      const parent = list.parentElement?.closest<HTMLElement>('li');
      if (!parent) break;
      if (list.hidden) {
        const toggle = parent.querySelector<HTMLElement>(':scope > .editor-directory-heading > [data-editor-expand], :scope > [data-editor-expand]');
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
  reveal(type: EditorExplorerType, resourceKey: string, placementKey?: string): void {
    this.state(type).reveal = { resourceKey, placementKey };
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
    onExpand?: (toggle: HTMLElement, open: boolean) => void;
    onQuery?: (channel: string, value: string, field: HTMLInputElement) => void;
  } = {}): () => void {
    const abort = new AbortController();
    root.addEventListener('click', event => {
      const element = event.target instanceof Element ? event.target : null;
      const toggle = element?.closest<HTMLElement>('[data-editor-expand][data-editor-placement-key]');
      if (toggle && root.contains(toggle)) {
        const placementKey = toggle.dataset.editorPlacementKey!;
        const queryChannel = root.querySelector<HTMLInputElement>('[data-editor-explorer-query]')?.dataset.editorExplorerQuery;
        const layer = queryChannel && this.query(type, queryChannel).trim() || this.state(type).reveal ? 'search' : 'normal';
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        this.setExpanded(type, placementKey, open, layer);
        this.selectPlacementInColumn(root, type, placementKey);
        setEditorDirectoryExpanded(toggle, open);
        options.onExpand?.(toggle, open);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const row = element?.closest<HTMLElement>('[data-editor-placement-select][data-editor-placement-key]');
      if (!row || !root.contains(row)) return;
      this.selectPlacementInColumn(root, type, row.dataset.editorPlacementKey);
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
