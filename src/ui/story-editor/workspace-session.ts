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
}

export interface StoryBrowseInstance {
  id: number;
  snapshot: StoryBrowseViewState;
  scroll: StoryInstanceScroll;
  document?: { target: StoryEditorTarget; packId?: string; draftId?: string; name: string };
  unavailable?: boolean;
  inspectorScroll: Map<string, number>;
  inspectorTabs: Map<string, StoryEditorState['storyInspectorTab']>;
  sourceVisits: Map<string, { visits: StoryEditorVisit[]; index: number }>;
  entryTabScroll: Map<string, Partial<Record<'basic' | 'rewards' | 'gates', number>>>;
  entryTabs: Map<string, 'basic' | 'rewards' | 'gates'>;
}

export function createStoryBrowseInstance(id: number): StoryBrowseInstance {
  return { id, snapshot: createStoryBrowseViewState(), scroll: {}, inspectorScroll: new Map(), inspectorTabs: new Map(), sourceVisits: new Map(),
    entryTabScroll: new Map(), entryTabs: new Map() };
}

export interface StoryWorkspaceSession {
  instances: StoryBrowseInstance[];
  active: StoryBrowseInstance;
  sidebarScroll: Map<string, number>;
  nextId: number;
}

export function createStoryWorkspaceSession(): StoryWorkspaceSession {
  const active = createStoryBrowseInstance(1);
  return { instances: [active], active, sidebarScroll: new Map(), nextId: 2 };
}

export function createEmptyStoryBrowseInstance(workspace: StoryWorkspaceSession, current: StoryBrowseViewState, source: string): StoryBrowseInstance {
  const instance = createStoryBrowseInstance(workspace.nextId++);
  instance.snapshot.sourceSelection = source || undefined;
  instance.snapshot.targetPackId = source === (current.sourceSelection ?? '') ? current.targetPackId
    : source.startsWith('pack:') ? source.slice(5) : undefined;
  instance.scroll = { center: 0, right: 0 };
  return instance;
}

export function findStoryBrowseInstance(workspace: StoryWorkspaceSession, target: StoryEditorTarget, source: string, runningPackId?: string): StoryBrowseInstance | undefined {
  return workspace.instances.find(instance => instance !== workspace.active
    && instance.document?.target.kind === target.kind && instance.document.target.id === target.id
    && (instance.snapshot.sourceSelection ?? '') === source && (Boolean(source) || instance.document.packId === runningPackId));
}
