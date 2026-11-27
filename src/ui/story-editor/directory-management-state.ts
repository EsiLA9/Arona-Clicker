export type StoryDirectoryTargetKind = 'story' | 'entry';

export interface StoryDirectoryResourceRef {
  /** Captured Explorer/runtime source; an empty string means the runtime source. */
  sourceKey: string;
  initId: string;
  /** Initial logical directory resource, distinct from the current navigation selection. */
  logicalDirectoryKey: string;
  ownerModName?: string;
}

/** A captured document mutation target; it is deliberately separate from directory resource identity. */
export interface StoryDirectoryArchiveTarget {
  kind: StoryDirectoryTargetKind;
  id: string;
  sourceKey: string;
  draftId?: string;
  targetPackId?: string;
  modName?: string;
  initId?: string;
  expectedDigest?: string;
}

export interface StoryDirectoryWriteBinding {
  packRecordId: string;
  modName: string;
  expectedDigest?: string;
  purpose?: 'directory' | 'content' | 'new-directory';
}

export interface StoryDirectoryNavigationState {
  selectedDirectoryKey: string;
  /** Empty string selects the path default; undefined means no explicit design choice. */
  selectedDesignId?: string;
  tab: 'design' | 'contents';
  tabScroll: Record<'design' | 'contents', number>;
  expandedPlacementKeys: Set<string>;
  rightScroll?: number;
  /** One-shot scroll restoration request consumed after the next DOM projection mounts. */
  pendingScrollTop?: number;
}

export interface StoryDirectoryWorkingState {
  create?: 'legacy' | 'path' | 'design';
  editingDesign: boolean;
  values: Map<string, string>;
  moving: boolean;
  moveQuery: string;
  moveParent?: string;
  sorting?: string[];
  removing: boolean;
  status: string;
}

/** Serializable-in-session payload. It deliberately excludes DOM, callbacks, UI context and catalog objects. */
export interface StoryDirectoryManagementState {
  resource: StoryDirectoryResourceRef;
  writeBinding?: StoryDirectoryWriteBinding;
  archiveTarget?: StoryDirectoryArchiveTarget;
  navigation: StoryDirectoryNavigationState;
  working: StoryDirectoryWorkingState;
}

export function createStoryDirectoryManagementState(input: {
  resource: StoryDirectoryResourceRef;
  writeBinding?: StoryDirectoryWriteBinding;
  archiveTarget?: StoryDirectoryArchiveTarget;
  navigation?: Partial<StoryDirectoryNavigationState>;
}): StoryDirectoryManagementState {
  const navigation = input.navigation;
  return {
    resource: { ...input.resource },
    writeBinding: input.writeBinding ? { ...input.writeBinding } : undefined,
    archiveTarget: input.archiveTarget ? { ...input.archiveTarget } : undefined,
    navigation: {
      selectedDirectoryKey: navigation?.selectedDirectoryKey ?? input.resource.logicalDirectoryKey,
      selectedDesignId: navigation?.selectedDesignId,
      tab: navigation?.tab ?? (input.resource.logicalDirectoryKey ? 'design' : 'contents'),
      tabScroll: { design: navigation?.tabScroll?.design ?? 0, contents: navigation?.tabScroll?.contents ?? 0 },
      expandedPlacementKeys: new Set(navigation?.expandedPlacementKeys ?? []),
      rightScroll: navigation?.rightScroll,
      pendingScrollTop: navigation?.pendingScrollTop,
    },
    working: {
      create: undefined,
      editingDesign: false,
      values: new Map(),
      moving: false,
      moveQuery: '',
      moveParent: undefined,
      sorting: undefined,
      removing: false,
      status: '',
    },
  };
}

export function cloneStoryDirectoryManagementState(state: StoryDirectoryManagementState): StoryDirectoryManagementState {
  return {
    resource: { ...state.resource },
    writeBinding: state.writeBinding ? { ...state.writeBinding } : undefined,
    archiveTarget: state.archiveTarget ? { ...state.archiveTarget } : undefined,
    navigation: {
      ...state.navigation,
      tabScroll: { ...state.navigation.tabScroll },
      expandedPlacementKeys: new Set(state.navigation.expandedPlacementKeys),
    },
    working: {
      ...state.working,
      values: new Map(state.working.values),
      sorting: state.working.sorting ? [...state.working.sorting] : undefined,
    },
  };
}
