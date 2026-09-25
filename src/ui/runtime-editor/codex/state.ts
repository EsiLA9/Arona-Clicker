import {
  codexEntryKey,
  type CodexEntryView,
  type CodexPane,
  type CodexShellState,
  type RuntimeContentBrowserShellView,
} from './model';

export type CodexShellAction =
  | { readonly type: 'set-query'; readonly query: string }
  | { readonly type: 'select-mod'; readonly modId: string | null }
  | { readonly type: 'select-kind'; readonly definitionKind: string | null }
  | { readonly type: 'select-entry'; readonly entryKey: string | null }
  | { readonly type: 'open-entry'; readonly entryKey: string }
  | { readonly type: 'go-back' }
  | { readonly type: 'go-forward' }
  | { readonly type: 'select-pane'; readonly pane: CodexPane }
  | { readonly type: 'reset' };

export function createCodexShellState(): CodexShellState {
  return {
    query: '',
    selectedModId: null,
    selectedKind: null,
    selectedEntryKey: null,
    mobilePane: 'mods',
    kindFilterOpen: false,
    backStack: [],
    forwardStack: [],
  };
}

export function reduceCodexShellState(
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
  action: CodexShellAction,
): CodexShellState {
  let next: CodexShellState;
  switch (action.type) {
    case 'set-query':
      next = { ...state, query: action.query, selectedEntryKey: null };
      break;
    case 'select-mod':
      next = { ...state, selectedModId: action.modId, selectedKind: null, selectedEntryKey: null, mobilePane: 'entries' };
      break;
    case 'select-kind':
      next = { ...state, selectedKind: action.definitionKind, selectedEntryKey: null, mobilePane: 'entries' };
      break;
    case 'select-entry':
      next = { ...state, selectedEntryKey: action.entryKey, mobilePane: 'detail' };
      break;
    case 'open-entry': {
      const current = state.selectedEntryKey;
      const backStack = current && current !== action.entryKey
        ? [...state.backStack, current]
        : state.backStack;
      next = {
        ...state,
        selectedEntryKey: action.entryKey,
        mobilePane: 'detail',
        backStack,
        forwardStack: [],
      };
      break;
    }
    case 'go-back': {
      const target = state.backStack.at(-1);
      if (!target) return reconcileCodexShellState(view, state);
      const current = state.selectedEntryKey;
      next = {
        ...state,
        selectedEntryKey: target,
        mobilePane: 'detail',
        backStack: state.backStack.slice(0, -1),
        forwardStack: current ? [...state.forwardStack, current] : state.forwardStack,
      };
      break;
    }
    case 'go-forward': {
      const target = state.forwardStack.at(-1);
      if (!target) return reconcileCodexShellState(view, state);
      const current = state.selectedEntryKey;
      next = {
        ...state,
        selectedEntryKey: target,
        mobilePane: 'detail',
        forwardStack: state.forwardStack.slice(0, -1),
        backStack: current ? [...state.backStack, current] : state.backStack,
      };
      break;
    }
    case 'select-pane':
      next = { ...state, mobilePane: action.pane };
      break;
    case 'reset':
      return createCodexShellState();
  }
  return reconcileCodexShellState(view, next);
}

export function reconcileCodexShellState(
  view: RuntimeContentBrowserShellView,
  state: CodexShellState,
): CodexShellState {
  const modIds = new Set(view.loadedMods.map(mod => mod.id));
  const selectedModId = state.selectedModId && modIds.has(state.selectedModId) ? state.selectedModId : null;
  const visibleKinds = getCodexVisibleKinds(view, { ...state, selectedModId, selectedKind: null });
  const selectedKind = state.selectedKind && visibleKinds.some(kind => kind.definitionKind === state.selectedKind)
    ? state.selectedKind
    : null;
  const allEntryKeys = new Set(view.entries.map(entry => codexEntryKey(entry)));
  const selectedEntryKey = state.selectedEntryKey && allEntryKeys.has(state.selectedEntryKey)
    ? state.selectedEntryKey
    : null;
  const backStack = state.backStack.filter(entryKey => allEntryKeys.has(entryKey));
  const forwardStack = state.forwardStack.filter(entryKey => allEntryKeys.has(entryKey));
  return { ...state, selectedModId, selectedKind, selectedEntryKey, backStack, forwardStack };
}

export function getCodexVisibleEntries(
  view: RuntimeContentBrowserShellView,
  state: Pick<CodexShellState, 'query' | 'selectedModId' | 'selectedKind'>,
): readonly CodexEntryView[] {
  const query = state.query.trim().toLocaleLowerCase();
  const mods = new Map(view.loadedMods.map(mod => [mod.id, mod]));
  const kinds = new Map(view.kinds.map(kind => [kind.definitionKind, kind]));
  return view.entries.filter(entry => {
    if (!mods.has(entry.modId)) return false;
    if (state.selectedModId && entry.modId !== state.selectedModId) return false;
    if (state.selectedKind && entry.definitionKind !== state.selectedKind) return false;
    if (!query) return true;
    const mod = mods.get(entry.modId);
    const kind = kinds.get(entry.definitionKind);
    const haystack = [
      entry.label,
      entry.fullId,
      entry.summary,
      entry.searchText,
      ...(entry.tags ?? []),
      mod?.label,
      kind?.label,
      kind?.groupLabel,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  });
}

export function getCodexVisibleKinds(
  view: RuntimeContentBrowserShellView,
  state: Pick<CodexShellState, 'query' | 'selectedModId' | 'selectedKind'>,
): readonly RuntimeContentBrowserShellView['kinds'][number][] {
  const entries = getCodexVisibleEntries(view, { ...state, selectedKind: null });
  const entryKinds = new Set(entries.map(entry => entry.definitionKind));
  return view.kinds.filter(kind => entryKinds.has(kind.definitionKind));
}

export function getSelectedCodexEntry(
  view: RuntimeContentBrowserShellView,
  state: Pick<CodexShellState, 'selectedEntryKey'>,
): CodexEntryView | null {
  if (!state.selectedEntryKey) return null;
  return view.entries.find(entry => codexEntryKey(entry) === state.selectedEntryKey) ?? null;
}
