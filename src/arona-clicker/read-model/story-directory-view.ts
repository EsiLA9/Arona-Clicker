import type { PlayerState } from '../types/state';
import type { StoryEntryReadProgress, StoryDirectoryPath } from '../types/story-state';
import type { StoryReplayStatus } from '../contracts/story/story-query';
import { buildStoryDirectory, sortStoryDirectory, type StoryDirectoryCatalog, type StoryDirectoryEntry, type StoryDirectoryNode } from '../content/story/story-directory';

export function storyDirectoryPath(
  catalog: StoryDirectoryCatalog, initId: string, entryId: string,
) {
  const { nodes, entryFolders } = buildStoryDirectory(catalog, initId);
  return folderPath(nodes, entryFolders.get(entryId));
}

function folderPath(nodes: ReadonlyMap<string, StoryDirectoryNode>, leaf?: StoryDirectoryNode) {
  const folders: { id: string; title: string }[] = [];
  let node = leaf;
  while (node) {
    folders.push({ id: node.id, title: node.title });
    node = node.parentId ? nodes.get(node.parentId) : undefined;
  }
  return folders.reverse();
}

type DirectoryProgressSource = Pick<PlayerState, 'storyEntryReads' | 'storyDirectoryPaths' | 'areaStoryDeliveries'>;

function directoryProgress(state: DirectoryProgressSource, retained?: { reads: Record<string, StoryEntryReadProgress>; paths: Record<string, StoryDirectoryPath> }) {
  const reads = new Map(Object.entries(retained?.reads ?? {}));
  for (const [id, progress] of Object.entries(state.storyEntryReads ?? {})) {
    if (reads.get(id) !== 'completed' && (progress === 'read' || progress === 'completed')) reads.set(id, progress);
  }
  for (const delivery of state.areaStoryDeliveries ?? []) {
    if (delivery.status === 'completed') reads.set(delivery.entryId, 'completed');
  }
  return { reads, paths: { ...retained?.paths, ...state.storyDirectoryPaths } };
}

export function retainStoryDirectoryProgress(catalog: StoryDirectoryCatalog, state: Readonly<PlayerState>): PlayerState['retainedStoryDirectoryProgress'] {
  const retained = { ...state.retainedStoryDirectoryProgress };
  const worldlines = new Map<string, DirectoryProgressSource>(Object.entries(state.initSnapshots ?? {}));
  if (state.activeInit) worldlines.set(state.activeInit, state);
  for (const [init, progress] of worldlines) {
    const { reads, paths } = directoryProgress(progress, retained[init]);
    if (!reads.size) continue;
    if ([...reads.keys()].some(id => !paths[id])) {
      const { nodes, entryFolders } = buildStoryDirectory(catalog, init);
      for (const id of reads.keys()) {
        if (paths[id]) continue;
        const folders = folderPath(nodes, entryFolders.get(id));
        if (folders.length) paths[id] = { folders };
      }
    }
    retained[init] = { reads: Object.fromEntries(reads), paths };
  }
  return Object.keys(retained).length ? retained : undefined;
}

function safeHistoricalPath(value?: StoryDirectoryPath): readonly { id: string; title: string }[] {
  if (!Array.isArray(value?.folders)) return [];
  return value.folders.filter(folder => folder && typeof folder.id === 'string' && typeof folder.title === 'string');
}

export function buildPlayerStoryDirectory(
  catalog: StoryDirectoryCatalog, state: Readonly<PlayerState>, replayStatus: (entryId: string) => StoryReplayStatus | undefined,
): StoryDirectoryNode[] {
  const { nodes, roots, entryFolders } = buildStoryDirectory(catalog, state.activeInit);
  const completedStories = new Set(state.storyLog.map(record => record.storyId));
  const entries = catalog.storyEntries;
  const { reads: recorded, paths } = directoryProgress(state, state.retainedStoryDirectoryProgress?.[state.activeInit]);
  const displayed = new Set<string>();
  for (const node of nodes.values()) {
    const visible: StoryDirectoryEntry[] = [];
    for (const row of node.entries) {
      const entry = entries.get(row.id);
      if (!entry || !catalog.stories.has(entry.storyId)) continue;
      const progress = recorded.get(row.id);
      // The old navigation granted active Entry visibility from a Story-level receipt.
      if (!progress && !(entry.activation.kind === 'active' && row.legacy && completedStories.has(entry.storyId))) continue;
      const explicit = entry.directoryPlacements?.find(placement => placement.initId === state.activeInit);
      if (progress && (!explicit || explicit.directoryId !== node.id)
        && safeHistoricalPath(paths[row.id]).some(folder => !nodes.has(folder.id))) continue;
      const knownTitle = paths[row.id]?.title;
      visible.push({ ...row, progress, title: typeof knownTitle === 'string' ? knownTitle : undefined,
        canReplay: row.legacy?.replayable !== false && replayStatus(row.id)?.allowed });
      displayed.add(row.id);
    }
    node.entries.splice(0, node.entries.length, ...visible);
    node.stories.length = 0;
  }
  for (const [id, progress] of recorded) {
    if ((progress !== 'read' && progress !== 'completed') || displayed.has(id)) continue;
    const snapshot = paths[id];
    const folders = safeHistoricalPath(snapshot);
    const entry = entries.get(id);
    const loaded = entry && entryFolders.has(id) && catalog.stories.has(entry.storyId);
    let parent: StoryDirectoryNode | undefined;
    for (const folder of folders.length ? folders : [{ id: '@history-unfiled', title: '历史未归档' }]) {
      let node = nodes.get(folder.id);
      if (!node) {
        node = { id: folder.id, title: folder.title, parentId: parent?.id, source: 'History', children: [], stories: [], entries: [] };
        nodes.set(node.id, node);
        (parent?.children ?? roots).push(node);
      }
      parent = node;
    }
    parent?.entries.push({ id, title: typeof snapshot?.title === 'string' ? snapshot.title : undefined, progress, historical: loaded ? undefined : true,
      canReplay: Boolean(loaded && replayStatus(id)?.allowed) });
  }
  const visibleNodes = (siblings: StoryDirectoryNode[]): StoryDirectoryNode[] => siblings.flatMap(node => {
    const children = visibleNodes(node.children);
    const read = node.entries.filter(entry => entry.progress).length + children.reduce((count, child) => count + (child.read ?? 0), 0);
    const completed = node.entries.filter(entry => entry.progress === 'completed').length + children.reduce((count, child) => count + (child.completed ?? 0), 0);
    return node.entries.length || children.length || node.definition?.public ? [{ ...node, children, read, completed }] : [];
  });
  const view = visibleNodes(roots);
  sortStoryDirectory(view);
  return view;
}
