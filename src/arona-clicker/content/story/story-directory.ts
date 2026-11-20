import { characterStoryDirectoryId, parseCharacterStoryDirectoryId, type StoryDirectoryDef } from '../../../data-services/contracts/story-directory';
import type { StoryDef } from '../../../data-services/contracts/story';
import type { StoryEntryDef } from '../../../data-services/contracts/story-entry';
import type { RegisteredStoryDirectory } from '../../../data-services/registry/story-directory-validation';
import type { StoryEntryReadProgress } from '../../types/story-state';
import { withAuthoredStoryCatalog } from './authored-story-catalog';
import { baseStoryHierarchy, type StoryContentItem } from './story-hierarchy';

export type StoryDirectoryDocument = Pick<StoryDef, 'id' | 'initId' | 'name' | 'directoryId'>;

export interface StoryDirectoryCatalog {
  readonly storyDirectories: ReadonlyMap<string, RegisteredStoryDirectory>;
  readonly characters: ReadonlyMap<string, { displayName: string }>;
  readonly stories: ReadonlyMap<string, StoryDirectoryDocument>;
  readonly storyEntries: ReadonlyMap<string, StoryEntryDef>;
  storyDirectoryCharacterOwner(id: string): string | undefined;
  storyDirectoryContentOwner(id: string, kind?: 'story' | 'entry'): string | undefined;
}

export interface StoryDirectoryEntry {
  readonly id: string;
  readonly order?: number;
  readonly title?: string;
  readonly legacy?: StoryContentItem;
  readonly historical?: true;
  readonly progress?: StoryEntryReadProgress;
  readonly canReplay?: boolean;
}

export interface StoryDirectoryNode {
  readonly id: string;
  readonly parentId?: string;
  readonly title: string;
  readonly source: 'Manual' | 'AutoCreated' | 'History' | 'Unfiled';
  readonly modName?: string;
  readonly definition?: StoryDirectoryDef;
  readonly order?: number;
  readonly children: StoryDirectoryNode[];
  readonly stories: StoryDirectoryDocument[];
  readonly entries: StoryDirectoryEntry[];
  read?: number;
  completed?: number;
}

export function buildStoryDirectory(catalog: StoryDirectoryCatalog, initId: string) {
  const nodes = new Map<string, StoryDirectoryNode>();
  const entryFolders = new Map<string, StoryDirectoryNode>();
  const roots: StoryDirectoryNode[] = [];
  const entries = initId
    ? [...catalog.storyEntries.values()].filter(entry => !entry.availableInits.length || entry.availableInits.includes(initId))
    : [];
  const stories = [...catalog.stories.values()].filter(story => (story.initId ?? '') === initId);
  const add = (node: Omit<StoryDirectoryNode, 'children' | 'stories' | 'entries'>): StoryDirectoryNode => {
    const full: StoryDirectoryNode = { ...node, children: [], stories: [], entries: [] };
    nodes.set(node.id, full);
    return full;
  };
  const characterFolder = (characterId: string): StoryDirectoryNode | undefined => {
    const character = catalog.characters.get(characterId);
    const modName = catalog.storyDirectoryCharacterOwner(characterId);
    if (!character || !modName) return;
    const id = characterStoryDirectoryId(initId, characterId);
    const definition = catalog.storyDirectories.get(id)?.definition;
    const parentId = '@characters';
    if (!nodes.has(parentId)) add({ id: parentId, title: '角色故事', source: 'AutoCreated' });
    return nodes.get(id) ?? add({ id, parentId, title: definition?.title ?? character.displayName, modName, definition,
      source: 'AutoCreated', order: definition?.order });
  };
  for (const { definition, modName } of catalog.storyDirectories.values()) {
    if (definition.initId !== initId) continue;
    if (definition.characterId) characterFolder(definition.characterId);
    else add({ id: definition.id, parentId: definition.parentId, title: definition.title ?? definition.id, source: 'Manual', modName,
      order: definition.order, definition });
  }
  const resolve = (id?: string): StoryDirectoryNode | undefined => {
    if (!id) return;
    const character = parseCharacterStoryDirectoryId(id);
    return nodes.get(id) ?? (character?.initId === initId ? characterFolder(character.characterId) : undefined);
  };
  for (const node of nodes.values()) if (node.parentId) resolve(node.parentId);
  const legacy = new Map<string, { ids: string[]; titles: string[]; orders: number[]; item: StoryContentItem; order: number }>();
  const oldTree = withAuthoredStoryCatalog(baseStoryHierarchy, entries, id => catalog.storyDirectoryContentOwner(id));
  for (const [categoryOrder, category] of oldTree.categories.entries()) for (const [partOrder, part] of category.parts.entries()) {
    const record = (items: StoryContentItem[], ids: string[], titles: string[], orders: number[]) => {
      for (const [order, item] of items.entries()) {
        if (!legacy.has(item.entryId)) legacy.set(item.entryId, { ids, titles, orders, item, order });
      }
    };
    const ids = [category.id, part.id];
    const titles = [category.name, part.name];
    const orders = [categoryOrder, partOrder];
    record(part.items ?? [], ids, titles, orders);
    for (const [order, chapter] of (part.chapters ?? []).entries()) {
      record(chapter.items, [...ids, chapter.id], [...titles, chapter.name], [...orders, order]);
    }
  }
  const unfiled = () => nodes.get('@unfiled') ?? add({ id: '@unfiled', title: '未归档', source: 'Unfiled' });
  for (const story of stories) (resolve(story.directoryId) ?? unfiled()).stories.push(story);
  for (const entry of entries) {
    const explicit = entry.directoryPlacements?.find(placement => placement.initId === initId);
    const owner = catalog.storyDirectoryContentOwner(entry.id);
    let folder = resolve(explicit?.directoryId);
    if (folder && folder.modName !== owner && !folder.definition?.acceptExternalEntries) folder = undefined;
    const old = legacy.get(entry.id);
    let order = folder ? explicit?.order : undefined;
    // Preserve existing authored and built-in paths until an explicit Init placement supersedes them.
    if (!folder && old) {
      order = old.order;
      for (const [depth, segment] of old.ids.entries()) {
        const id = `@legacy/${old.ids.slice(0, depth).concat(segment).map(encodeURIComponent).join('/')}`;
        const parentId = depth ? `@legacy/${old.ids.slice(0, depth).map(encodeURIComponent).join('/')}` : undefined;
        folder = nodes.get(id) ?? add({ id, parentId, title: old.titles[depth], source: 'Unfiled', order: old.orders[depth] });
      }
    }
    const automatic = entry.owner ? characterFolder(entry.owner) : undefined;
    if (!folder && owner && automatic?.modName === owner) folder = automatic;
    folder ??= unfiled();
    folder.entries.push({ id: entry.id, order, legacy: old?.item });
    entryFolders.set(entry.id, folder);
  }
  for (const node of nodes.values()) (nodes.get(node.parentId ?? '')?.children ?? roots).push(node);
  sortStoryDirectory(roots);
  return { nodes, roots, entryFolders };
}

export function sortStoryDirectory(roots: StoryDirectoryNode[]): void {
  const compare = (left: { id: string; order?: number }, right: { id: string; order?: number }) =>
    (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id);
  roots.sort(compare);
  for (const node of roots) {
    node.entries.sort(compare);
    node.stories.sort(compare);
    sortStoryDirectory(node.children);
  }
}
