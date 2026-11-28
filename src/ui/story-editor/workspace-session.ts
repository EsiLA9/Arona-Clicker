import type { BrowseInstance, BrowseInstancePresentation, BrowseInstanceSeed } from '../workspace/browse-instance-manager';
import { renderEditorEntityIcon, type EditorEntryIconType } from '../components/shared/editor-entity-icon';
import { createStoryBrowseViewState, type StoryBrowseViewState, type StoryEditorState, type StoryEditorTarget, type StoryEditorVisit } from './model';
import { editorWorkspaceEdges } from '../workspace/editor-workspace';

export const storyWorkType = 'story';
export const editorPanels = ['left', 'center', 'right'] as const;
export const storyEditorEdges = editorWorkspaceEdges(editorPanels);
export type EditorPanel = (typeof editorPanels)[number];
export type EditorScroll = Partial<Record<EditorPanel, number>>;
export type StoryInstanceScroll = Pick<EditorScroll, 'center' | 'right'>;

export function captureStoryInstanceState(state: StoryBrowseViewState): StoryBrowseViewState {
  const snapshot = createStoryBrowseViewState();
  function copy<K extends keyof StoryBrowseViewState>(key: K): void { snapshot[key] = state[key]; }
  (Object.keys(snapshot) as (keyof StoryBrowseViewState)[]).forEach(copy);
  snapshot.target = state.target ? { ...state.target } : null;
  snapshot.visits = state.visits.map(visit => ({ ...visit, target: { ...visit.target } }));
  return snapshot;
}

export function restoreStoryInstanceState(state: StoryEditorState, saved: StoryBrowseViewState): void {
  Object.assign(state, captureStoryInstanceState(saved));
  state.prototypeDocument = undefined;
}

export interface StoryBrowseInstanceState {
  snapshot: StoryBrowseViewState;
  scroll: StoryInstanceScroll;
  document?: { target: StoryEditorTarget; draftId?: string; packId?: string; name: string };
  unavailable?: boolean;
  inspectorScroll: Map<string, number>;
  inspectorTabs: Map<string, StoryEditorState['storyInspectorTab']>;
  sourceVisits: Map<string, { visits: StoryEditorVisit[]; index: number }>;
  entryTabScroll: Map<string, Partial<Record<'basic' | 'rewards' | 'gates', number>>>;
  entryTabs: Map<string, 'basic' | 'rewards' | 'gates'>;
}

export function captureStoryBrowseInstanceState(state: StoryBrowseInstanceState): StoryBrowseInstanceState {
  return {
    snapshot: captureStoryInstanceState(state.snapshot),
    scroll: { ...state.scroll },
    document: state.document ? { ...state.document, target: { ...state.document.target } } : undefined,
    unavailable: state.unavailable,
    inspectorScroll: new Map(state.inspectorScroll),
    inspectorTabs: new Map(state.inspectorTabs),
    sourceVisits: new Map([...state.sourceVisits].map(([key, value]) => [key, {
      visits: value.visits.map(visit => ({ ...visit, target: { ...visit.target } })), index: value.index,
    }])),
    entryTabScroll: new Map([...state.entryTabScroll].map(([key, value]) => [key, { ...value }])),
    entryTabs: new Map(state.entryTabs),
  };
}

export function restoreStoryBrowseInstanceState(state: StoryBrowseInstanceState, saved: StoryBrowseInstanceState): void {
  Object.assign(state, captureStoryBrowseInstanceState(saved));
}

export type StoryBrowseInstance = BrowseInstance<StoryBrowseInstanceState>;

export function storyBrowseInstancePresentation(title: string, target?: StoryEditorTarget, entryType?: EditorEntryIconType): BrowseInstancePresentation {
  const typeLabel = target?.kind === 'entry' ? 'Entry' : 'Story';
  return { title, typeLabel, ...(target ? { kind: target.kind, icon: renderEditorEntityIcon(target.kind, entryType) } : {}) };
}

function storySeed(state: StoryBrowseInstanceState, resourceKey?: string, reuseKey?: string): BrowseInstanceSeed<StoryBrowseInstanceState> {
  return { providerKey: storyWorkType, resourceKey, reuseKey, state,
    presentation: storyBrowseInstancePresentation(state.document?.name ?? '查阅故事', state.document?.target) };
}

export function createStoryBrowseInstance(): StoryBrowseInstanceState {
  return { snapshot: createStoryBrowseViewState(), scroll: {}, inspectorScroll: new Map(), inspectorTabs: new Map(), sourceVisits: new Map(),
    entryTabScroll: new Map(), entryTabs: new Map() };
}

export function createStoryBrowseInstanceSeed(): BrowseInstanceSeed<StoryBrowseInstanceState> {
  return storySeed(createStoryBrowseInstance());
}

export function createEmptyStoryBrowseInstance(current: StoryBrowseViewState, source: string): BrowseInstanceSeed<StoryBrowseInstanceState> {
  const state = createStoryBrowseInstance();
  state.snapshot.sourceSelection = source || undefined;
  state.snapshot.targetPackId = source === (current.sourceSelection ?? '') ? current.targetPackId
    : source.startsWith('pack:') ? source.slice(5) : undefined;
  state.scroll = { center: 0, right: 0 };
  return storySeed(state);
}

export function storyBrowseIdentity(target: StoryEditorTarget, source: string, runningPackId?: string): { resourceKey: string; reuseKey: string } {
  const scope = source || `registry:${runningPackId ?? 'unscoped'}`;
  const key = JSON.stringify([target.kind, target.id, scope]);
  return { resourceKey: key, reuseKey: key };
}

export function createStoryTargetBrowseSeed(
  current: StoryBrowseViewState,
  source: string,
  target: StoryEditorTarget,
  identity: { resourceKey: string; reuseKey: string },
  metadata: { name: string; packId?: string; draftId?: string; entryType?: EditorEntryIconType },
): BrowseInstanceSeed<StoryBrowseInstanceState> {
  const seed = createEmptyStoryBrowseInstance(current, source);
  const state = seed.state;
  const copiedTarget = { ...target };
  state.snapshot.target = copiedTarget;
  state.snapshot.visits = [{ target: { ...copiedTarget }, selectedNodeId: null, insertionBeforeNodeId: null, centerScroll: 0, rightScroll: 0 }];
  state.snapshot.visitIndex = 0;
  state.document = { target: copiedTarget, name: metadata.name, packId: metadata.packId, draftId: metadata.draftId };
  return { ...seed, ...identity, presentation: storyBrowseInstancePresentation(metadata.name, target, metadata.entryType) };
}
