import { loadEditorWorkspacePreferences, type EditorWorkspaceView } from '../workspace/editor-workspace';
import type { StoryEditorState, StoryEditorTarget, StoryEditorVisit } from './model';

export const storyWorkType = 'story';
export const editorPanels = ['left', 'center', 'right'] as const;
export type EditorPanel = (typeof editorPanels)[number];
export type EditorScroll = Partial<Record<EditorPanel, number>>;

const viewFields = [
  'sourceSelection', 'targetPackId', 'target', 'visits', 'visitIndex', 'selectedNodeId',
  'insertionBeforeNodeId', 'inspectorView', 'nodeDesignerTab', 'storyInspectorTab', 'entryEditorTab',
  'sidebarMode', 'sidebarDirectoryMode', 'sidebarFiltersOpen', 'sidebarFolders', 'sidebarSearchFolders',
  'search', 'entrySearch', 'senderSearch', 'storyInitFilter', 'notice', 'error',
] as const;
type StoryInstanceState = Pick<StoryEditorState, (typeof viewFields)[number]>;

export function captureStoryInstanceState(state: StoryEditorState): StoryInstanceState {
  function field<K extends keyof StoryInstanceState>(key: K): [K, StoryInstanceState[K]] { return [key, state[key]]; }
  return Object.fromEntries(viewFields.map(field)) as StoryInstanceState;
}

export interface StoryBrowseInstance {
  id: number;
  view: EditorWorkspaceView;
  snapshot?: StoryInstanceState;
  scroll: EditorScroll;
  document?: { target: StoryEditorTarget; packId?: string; draftId?: string; name: string };
  unavailable?: boolean;
  inspectorScroll: Map<string, number>;
  inspectorTabs: Map<string, StoryEditorState['storyInspectorTab']>;
  sourceVisits: Map<string, { visits: StoryEditorVisit[]; index: number }>;
  entryTabScroll: Map<string, Partial<Record<'basic' | 'rewards' | 'gates', number>>>;
  entryTabs: Map<string, 'basic' | 'rewards' | 'gates'>;
  sidebarModeScroll: Map<string, number>;
}

export function createStoryBrowseInstance(id: number, view: EditorWorkspaceView = 'three'): StoryBrowseInstance {
  return { id, view, scroll: {}, inspectorScroll: new Map(), inspectorTabs: new Map(), sourceVisits: new Map(),
    entryTabScroll: new Map(), entryTabs: new Map(), sidebarModeScroll: new Map() };
}

export interface StoryWorkspaceSession {
  preferences: ReturnType<typeof loadEditorWorkspacePreferences>;
  instances: StoryBrowseInstance[];
  active: StoryBrowseInstance;
  nextId: number;
}

export function createStoryWorkspaceSession(): StoryWorkspaceSession {
  const active = createStoryBrowseInstance(1);
  return { preferences: loadEditorWorkspacePreferences(storyWorkType), instances: [active], active, nextId: 2 };
}
