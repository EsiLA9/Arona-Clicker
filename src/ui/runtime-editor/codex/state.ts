import {
  codexEntryKey,
  type CodexEntryView,
  type CodexPane,
  type CodexHistoryEntry,
  type CodexNavigationMode,
  type CodexShellState,
  type RuntimeContentBrowserShellView,
} from './model';
import { codexKindGroup } from './content-labels';

export type CodexShellAction =
  | { readonly type: 'set-query'; readonly query: string }
  | { readonly type: 'select-category'; readonly category: string | null }
  | { readonly type: 'select-navigation-mode'; readonly mode: CodexNavigationMode }
  | { readonly type: 'locate-entry' }
  | { readonly type: 'select-mod'; readonly modId: string | null }
  | { readonly type: 'select-kind'; readonly definitionKind: string | null }
  | { readonly type: 'select-entry'; readonly entryKey: string | null }
  | { readonly type: 'open-entry'; readonly entryKey: string; readonly locationHint?: string }
  | { readonly type: 'go-back' }
  | { readonly type: 'go-forward' }
  | { readonly type: 'select-pane'; readonly pane: CodexPane }
  | { readonly type: 'reset' };

export function createCodexShellState(): CodexShellState {
  return {
    selectedCategory: null,
    query: '',
    selectedModId: null,
    selectedKind: null,
    selectedEntryKey: null,
    mobilePane: 'mods',
    navigationMode: 'categories',
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
  state = reconcileCodexShellState(view, state);
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
    case 'select-category':
      next = { ...state, selectedCategory: action.category, selectedKind: null, selectedEntryKey: null, mobilePane: 'entries' };
      break;
    case 'select-navigation-mode':
      next = { ...state, navigationMode: action.mode };
      break;
    case 'select-entry':
    case 'open-entry': {
      const target = action.entryKey;
      const remember = action.type === 'open-entry' && state.selectedEntryKey && state.selectedEntryKey !== target;
      next = {
        ...state, selectedEntryKey: target, mobilePane: 'detail',
        locationHint: action.type === 'open-entry' ? action.locationHint : undefined,
        backStack: remember ? [...state.backStack, state.selectedEntryKey!].slice(-50) : state.backStack,
        backReadings: remember ? [...(state.backReadings ?? []), historyEntry(state)!].slice(-50) : state.backReadings,
        forwardStack: [], forwardReadings: [], reading: undefined,
      };
      break;
    }
    case 'locate-entry': {
      if (!state.selectedEntryKey) return state;
      next = {
        ...state, query: '', selectedModId: null, selectedKind: null, selectedCategory: null,
        backStack: [...state.backStack, state.selectedEntryKey].slice(-50),
        backReadings: [...(state.backReadings ?? []), historyEntry(state)!].slice(-50),
        forwardStack: [], forwardReadings: [], mobilePane: 'entries',
      };
      break;
    }
    case 'go-back':
    case 'go-forward': {
      const back = action.type === 'go-back';
      const stack = back ? state.backStack : state.forwardStack;
      const readings = back ? state.backReadings : state.forwardReadings;
      const target = stack.at(-1);
      if (!target) return reconcileCodexShellState(view, state);
      const saved = readings?.at(-1);
      const current = historyEntry(state);
      next = {
        ...state,
        ...(saved?.entryKey === target ? saved : { reading: undefined }),
        selectedEntryKey: target, mobilePane: 'detail',
        backStack: back ? state.backStack.slice(0, -1) : current ? [...state.backStack, current.entryKey].slice(-50) : state.backStack,
        forwardStack: back && current ? [...state.forwardStack, current.entryKey].slice(-50) : back ? state.forwardStack : state.forwardStack.slice(0, -1),
        backReadings: back ? (state.backReadings ?? []).slice(0, -1) : current ? [...(state.backReadings ?? []), current].slice(-50) : state.backReadings,
        forwardReadings: back && current ? [...(state.forwardReadings ?? []), current].slice(-50) : back ? state.forwardReadings : (state.forwardReadings ?? []).slice(0, -1),
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
  const backStack = state.backStack.filter(entryKey => allEntryKeys.has(entryKey)).slice(-50);
  const forwardStack = state.forwardStack.filter(entryKey => allEntryKeys.has(entryKey)).slice(-50);
  return { ...state, selectedModId, selectedKind, selectedEntryKey, backStack, forwardStack,
    backReadings: state.backReadings?.filter(item => allEntryKeys.has(item.entryKey)).slice(-50),
    forwardReadings: state.forwardReadings?.filter(item => allEntryKeys.has(item.entryKey)).slice(-50),
  };
}

export function getCodexVisibleEntries(
  view: RuntimeContentBrowserShellView,
  state: Pick<CodexShellState, 'query' | 'selectedModId' | 'selectedKind' | 'selectedCategory'>,
): readonly CodexEntryView[] {
  const query = state.query.trim().toLocaleLowerCase();
  const mods = new Map(view.loadedMods.map(mod => [mod.id, mod]));
  const kinds = new Map(view.kinds.map(kind => [kind.definitionKind, kind]));
  return view.entries.filter(entry => {
    if (!mods.has(entry.modId)) return false;
    if (state.selectedModId && entry.modId !== state.selectedModId) return false;
    if (state.selectedKind && entry.definitionKind !== state.selectedKind) return false;
    if (state.selectedCategory && codexKindGroup(entry.definitionKind) !== state.selectedCategory) return false;
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
  state: Pick<CodexShellState, 'query' | 'selectedModId' | 'selectedKind' | 'selectedCategory'>,
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

function historyEntry(state: CodexShellState): CodexHistoryEntry | null {
  return state.selectedEntryKey ? {
    entryKey: state.selectedEntryKey, query: state.query,
    selectedModId: state.selectedModId, selectedKind: state.selectedKind,
    selectedCategory: state.selectedCategory, locationHint: state.locationHint, reading: state.reading,
  } : null;
}
