import { renderEditorExplorerTree } from '../workspace/editor-directory';
import { buildStoryDirectory, legacyStoryHierarchy, type StoryDirectoryCatalog, type StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { UIContext } from '../runtime/context';
import { editorLayout } from '../workspace/editor-workspace';
import { storyEntries, storyList, type StoryEditorTarget } from './model';
import { storyExplorerSourceValue, type StoryExplorerProjection, type StoryExplorerState } from './pack-source';
import { directoryStatus, hierarchyDesignCounts, hierarchyDesignKey, mergeDirectoryDesigns } from './directory-status';
import { storyBrowseIdentity } from './workspace-session';
import type { EditorExplorerStateSnapshot } from '../workspace/editor-explorer-service';
import { storyDirectoryBrowseProviderKey, storyDirectoryResourceKey, storyDirectoryResourceRefId } from './directory-instance';
import { editorExplorerChildState, type EditorExplorerNode, type EditorExplorerNodeAction } from '../workspace/editor-explorer-nodes';
import type { EditorResourceRef } from '../workspace/editor-resource-request';
import { projectEditorExplorerTree } from '../workspace/editor-directory';
import type { ProjectedEditorExplorerNode } from '../workspace/editor-directory';

const other = '';

export function storyExplorerResourceIdentity(target: StoryEditorTarget, source: string, runningPackId?: string): string {
  return storyBrowseIdentity(target, source, runningPackId).resourceKey;
}

export function storyExplorerPlacementIdentity(parentPlacement: string, target: StoryEditorTarget): string {
  return JSON.stringify([parentPlacement, target.kind, target.id]);
}

export function directoryManagementAttrs(e: UIContext['escapeHtml'], initId: string, node: Pick<StoryDirectoryNode, 'id' | 'modName'>,
  sourceKey = ''): string {
  const resource = { sourceKey, initId, logicalDirectoryKey: node.id };
  const ref = storyDirectoryResourceRefId(resource);
  return `data-editor-directory="folder" data-directory-init-id="${e(initId)}" data-directory-folder-id="${e(node.id)}"${node.modName ? ` data-directory-owner="${e(node.modName)}" data-editor-resource-owner="${e(node.modName)}"` : ''}`
    + ` data-editor-resource-provider="${storyDirectoryBrowseProviderKey}" data-editor-resource-kind="${ref.kind}" data-editor-resource-id="${e(ref.id)}"`
    + ` data-editor-resource-key="${e(storyDirectoryResourceKey(resource))}" data-editor-resource-source="${e(sourceKey)}"`;
}

export function editorDirectoryContentOwner(ctx: UIContext, projection: StoryExplorerProjection): StoryDirectoryCatalog['storyDirectoryContentOwner'] {
  return (id, kind) => ctx.game.registry.storyDirectoryContentOwner(id, kind)
    ?? projection.drafts.find(draft => kind === 'story' ? !draft.entryOnly && draft.document.id === id
      : draft.authoring?.activeStories.some(entry => entry.id === id) || draft.authoring?.passiveStories.some(entry => entry.id === id))?.packSource?.modName;
}

export function buildEditorStoryDirectories(catalog: StoryDirectoryCatalog, initIds: readonly string[], activeInit: string) {
  const trees = new Map([...initIds, other].map(id => [id, buildStoryDirectory(catalog, id, { includeEmptyCharacters: true })]));
  const preferred = new Map<string, string>();
  const general: StoryDirectoryNode = { id: '@general-entries', initId: other, hierarchyString: legacyStoryHierarchy('@general-entries'),
    title: '通用入口', source: 'Unfiled', children: [], stories: [], entries: [] };
  for (const entry of catalog.storyEntries.values()) {
    if (entry.availableInits.length || entry.directoryPlacements?.length) continue;
    const canonical = [catalog.stories.get(entry.storyId)?.initId, activeInit, ...initIds].find(initId => {
      const folder = initId ? trees.get(initId)?.entryFolders.get(entry.id) : undefined;
      return folder && folder.id !== '@unfiled';
    });
    preferred.set(entry.id, canonical ?? other);
    if (!canonical) general.entries.push({ id: entry.id });
  }
  if (general.entries.length) {
    const tree = trees.get(other)!;
    tree.roots.push(general);
    tree.nodes.set(general.id, general);
    for (const entry of general.entries) tree.entryFolders.set(entry.id, general);
  }
  return { trees, preferred };
}

export function sidebarInitIds(ctx: UIContext, projection: StoryExplorerProjection): string[] {
  const registry = ctx.game.registry;
  return [...new Set([...registry.inits.keys(), ...projection.drafts.flatMap(draft => draft.document.initId ? [draft.document.initId] : []),
    ...Array.from(registry.stories.values(), row => row.initId ?? ''),
    ...Array.from(storyEntries({ drafts: projection.drafts }, registry.storyEntries).values()).flatMap(row => [...row.availableInits, ...(row.directoryPlacements ?? []).map(place => place.initId)]),
  ])].filter(Boolean);
}

export function sidebarSearch(state: StoryExplorerState, explorer: EditorExplorerStateSnapshot): string {
  const channel = state.auxiliaryTool === 'senders' ? 'senders' : state.directoryMode === 'entries' ? 'entries' : 'stories';
  return explorer.queries[channel] ?? '';
}

export type StoryExplorerNodeDomain =
  | { kind: 'init'; initId: string }
  | { kind: 'directory'; initId: string; node: StoryDirectoryNode; details: ReturnType<typeof directoryStatus> }
  | { kind: 'story'; item: ReturnType<typeof storyList>[number]; initId: string }
  | { kind: 'entry'; entry: StoryEntryDef; initId: string };

export interface StoryExplorerNodeProjection {
  readonly sourceKey: string;
  readonly scope: string;
  readonly sourceMod?: string;
  readonly roots: readonly EditorExplorerNode[];
  readonly preferredEntryInit: ReadonlyMap<string, string>;
  readonly domainByPlacement: ReadonlyMap<string, StoryExplorerNodeDomain>;
}

/** Build the full source tree before query matching or presentation filtering. */
export function buildStoryExplorerNodes(ctx: UIContext, projection: StoryExplorerProjection,
  initIds: readonly string[], appliedDirectories: StoryDirectoryCatalog['storyDirectories'], directoryMode: StoryExplorerState['directoryMode'] = 'all'): StoryExplorerNodeProjection {
  const registry = ctx.game.registry;
  const sourceKey = storyExplorerSourceValue(projection.source);
  const scope = projection.source.kind === 'runtime' ? projection.runtimeScope : sourceKey;
  const packCatalog = ctx.game as typeof ctx.game & Partial<import('../../arona-clicker/contracts/runtime/runtime').PackCatalogReadModel>;
  const resourceIdentity = (target: StoryEditorTarget): string => {
    const owner = registry.storyDirectoryContentOwner(target.id, target.kind) ?? target.id.split(':')[0];
    return storyExplorerResourceIdentity(target, sourceKey, !sourceKey ? packCatalog.getRunningStoryPackId?.(owner) : undefined);
  };
  const sourceState = { drafts: projection.drafts };
  const entries = storyEntries(sourceState, registry.storyEntries);
  const items = storyList(sourceState, registry.stories);
  const storyNames = new Map(items.map(item => [item.storyId, item.name]));
  const entryName = (entry: StoryEntryDef) => entry.openingTitle || storyNames.get(entry.storyId) || entry.id;
  const drafts = new Map(projection.drafts.filter(draft => !draft.entryOnly).map(draft => [draft.document.id, draft]));
  const catalog: StoryDirectoryCatalog = {
    stories: new Map(items.map(({ storyId }) => [storyId, drafts.get(storyId)?.document ?? registry.stories.get(storyId)!])),
    storyEntries: entries, storyDirectories: registry.storyDirectories, characters: registry.characters,
    storyDirectoryContentOwner: editorDirectoryContentOwner(ctx, projection),
    storyDirectoryCharacterOwner: id => registry.storyDirectoryCharacterOwner(id),
  };
  const { trees, preferred } = buildEditorStoryDirectories(catalog, initIds, ctx.game.state.activeInit);
  const designCounts = hierarchyDesignCounts(mergeDirectoryDesigns(registry.storyDirectories, appliedDirectories, projection.sourceMod));
  const domainByPlacement = new Map<string, StoryExplorerNodeDomain>();
  const storyNode = (item: ReturnType<typeof storyList>[number], initId: string, parentPlacement: string): EditorExplorerNode => {
    const target = { kind: 'story' as const, id: item.storyId };
    const placementKey = storyExplorerPlacementIdentity(parentPlacement, target);
    const draft = item.draft;
    domainByPlacement.set(placementKey, { kind: 'story', item, initId });
    return { placementKey, sourceKey, resource: { providerKey: 'story', resourceKey: resourceIdentity(target), kind: 'story', id: target.id },
      label: item.name || '未命名 Story', searchableText: [item.name, target.id], children: [], childState: { kind: 'empty' },
      presentation: { kind: 'story', icon: 'book', auxiliaryLabel: draft?.dirty || draft?.persisted ? '草稿' : undefined,
        tooltip: `${item.name} · ${target.id}` } };
  };
  const entryNode = (entry: StoryEntryDef, initId: string, parentPlacement: string): EditorExplorerNode => {
    const target = { kind: 'entry' as const, id: entry.id };
    const placementKey = storyExplorerPlacementIdentity(parentPlacement, target);
    const label = entryName(entry);
    domainByPlacement.set(placementKey, { kind: 'entry', entry, initId });
    const activation = entry.activation.kind === 'active' ? '主动接取'
      : entry.activation.kind === 'random' ? '随机抽取' : '好感／角色阶段';
    return { placementKey, sourceKey, resource: { providerKey: 'story', resourceKey: resourceIdentity(target), kind: 'entry', id: target.id },
      label, searchableText: [label, target.id], children: [], childState: { kind: 'empty' },
      presentation: { kind: 'entry', icon: 'document', auxiliaryLabel: '入口', tooltip: `${label} · ${target.id} · ${activation}` } };
  };
  const directoryNode = (node: StoryDirectoryNode, initId: string): EditorExplorerNode => {
    const placementKey = JSON.stringify([scope, initId, node.id]);
    const children = node.children.map(child => directoryNode(child, initId));
    const childStories = node.stories.flatMap(({ id }) => {
      const item = items.find(candidate => candidate.storyId === id);
      return item ? [storyNode(item, initId, placementKey)] : [];
    });
    const trailingEntries: EditorExplorerNode[] = [];
    const storyGroups = new Map<string, EditorExplorerNode[]>();
    for (const child of childStories) {
      const row = domainByPlacement.get(child.placementKey);
      if (row?.kind === 'story') storyGroups.set(row.item.storyId, [child]);
    }
    for (const { id } of node.entries) {
      const entry = entries.get(id);
      if (!entry) continue;
      const row = entryNode(entry, initId, placementKey);
      ((directoryMode !== 'entries' ? storyGroups.get(entry.storyId) : undefined) ?? trailingEntries).push(row);
    }
    children.push(...(directoryMode === 'entries' ? [] : [...storyGroups.values()].flat()), ...trailingEntries);
    const ref = storyDirectoryResourceRefId({ sourceKey, initId, logicalDirectoryKey: node.id });
    const resource: EditorResourceRef = { providerKey: storyDirectoryBrowseProviderKey,
      resourceKey: storyDirectoryResourceKey({ sourceKey, initId, logicalDirectoryKey: node.id }),
      kind: ref.kind, id: ref.id, ownerModName: node.modName };
    const actions: readonly EditorExplorerNodeAction[] = [{ id: 'manage', label: '管理', icon: 'gear', resource, sourceKey,
      attributes: { 'data-editor-directory': 'folder', 'data-directory-init-id': initId, 'data-directory-folder-id': node.id,
        ...(node.modName ? { 'data-directory-owner': node.modName } : {}) } }];
    const details = directoryStatus(node, node.source === 'Path'
      ? designCounts.get(hierarchyDesignKey(initId, node.hierarchyString)) : undefined);
    domainByPlacement.set(placementKey, { kind: 'directory', initId, node, details });
    return { placementKey, resource, sourceKey, label: node.title, searchableText: [node.title, node.id], children,
      childState: editorExplorerChildState(children.length), presentation: { kind: 'directory',
        markers: node.id === '@characters' ? ['deferred-dom'] : [],
        auxiliaryLabel: details.short, auxiliaryTone: details.short,
        tooltip: `${node.title} · ${details.origin} · 手动资料 ${details.designs} 份 · Story ${details.stories} / Entry ${details.entries}` },
      actions };
  };
  const roots = [...trees].map(([initId, tree]) => {
    const placementKey = JSON.stringify([scope, initId, null]);
    const title = initId ? registry.inits.get(initId)?.name || initId : '其他';
    const children = tree.roots.map(node => directoryNode(node, initId));
    const ref = storyDirectoryResourceRefId({ sourceKey, initId, logicalDirectoryKey: '' });
    const resource: EditorResourceRef = { providerKey: storyDirectoryBrowseProviderKey,
      resourceKey: storyDirectoryResourceKey({ sourceKey, initId, logicalDirectoryKey: '' }),
      kind: ref.kind, id: ref.id };
    domainByPlacement.set(placementKey, { kind: 'init', initId });
    return { placementKey, resource, sourceKey, label: title, searchableText: [title, initId], children,
      childState: editorExplorerChildState(children.length), presentation: { kind: initId ? 'init' : 'group' },
      actions: [{ id: 'manage', label: '管理', icon: 'gear', resource, sourceKey,
        attributes: { 'data-editor-directory': 'folder', 'data-directory-init-id': initId, 'data-directory-folder-id': '' } }] } satisfies EditorExplorerNode;
  });
  return { sourceKey, scope, sourceMod: projection.sourceMod, roots, preferredEntryInit: preferred, domainByPlacement };
}

export function renderSidebarTree(ctx: UIContext, explorerState: StoryExplorerState, projection: StoryExplorerProjection,
  initIds: readonly string[], initFilter: string,
  appliedDirectories: StoryDirectoryCatalog['storyDirectories'], explorer: EditorExplorerStateSnapshot,
  activeResourceKey?: string): string {
  const nodes = buildStoryExplorerNodes(ctx, projection, initIds, appliedDirectories, explorerState.directoryMode);
  const query = sidebarSearch(explorerState, explorer);
  const allNodes: EditorExplorerNode[] = [];
  const visit = (node: EditorExplorerNode): void => { allNodes.push(node); node.children.forEach(visit); };
  nodes.roots.forEach(visit);
  const domain = (node: EditorExplorerNode) => nodes.domainByPlacement.get(node.placementKey);
  const initSelected = (initId: string): boolean => !initFilter || initFilter === (initId || 'other');
  const sourceVisible = (node: EditorExplorerNode): boolean => {
    if (!nodes.sourceMod) return true;
    const row = domain(node);
    if (row?.kind === 'story') return (row.item.draft?.packSource?.modName
      ?? ctx.game.registry.storyDirectoryContentOwner(row.item.storyId, 'story')) === nodes.sourceMod;
    if (row?.kind === 'entry') return ctx.game.registry.storyDirectoryContentOwner(row.entry.id) === nodes.sourceMod
      || !ctx.game.registry.storyEntries.has(row.entry.id);
    return true;
  };
  const entryVisibleAt = (node: EditorExplorerNode): boolean => {
    const row = domain(node);
    if (row?.kind !== 'entry') return true;
    if (initFilter && initSelected(row.initId)) return true;
    if (nodes.preferredEntryInit.has(row.entry.id)) return nodes.preferredEntryInit.get(row.entry.id) === row.initId;
    return row.entry.availableInits.length ? row.entry.availableInits.includes(row.initId)
      : Boolean(row.entry.directoryPlacements?.some(place => place.initId === row.initId));
  };
  const domainVisible = (node: EditorExplorerNode): boolean => {
    const row = domain(node);
    if (row?.kind === 'init') return initSelected(row.initId);
    if (!sourceVisible(node)) return false;
    if (row?.kind === 'story') return explorerState.directoryMode !== 'entries' && initSelected(row.initId);
    if (row?.kind === 'entry') return explorerState.directoryMode !== 'stories' && initSelected(row.initId) && entryVisibleAt(node);
    return true;
  };
  const reveal = explorer.reveal;
  const revealPlacementKey = (() => {
    if (!reveal) return undefined;
    if (reveal.placementKey) return reveal.placementKey;
    const candidates = allNodes.filter(node => node.resource?.resourceKey === reveal.resourceKey
      && (domain(node)?.kind === 'story' || domain(node)?.kind === 'entry'));
    const entry = candidates.map(domain).find((row): row is Extract<StoryExplorerNodeDomain, { kind: 'entry' }> => row?.kind === 'entry');
    const preferredInit = entry
      ? [initFilter === 'other' ? other : initFilter, ctx.game.state.activeInit, nodes.preferredEntryInit.get(entry.entry.id),
        ...entry.entry.availableInits, ...(entry.entry.directoryPlacements ?? []).map(place => place.initId)]
        .find((initId): initId is string => Boolean(initId && candidates.some(node => domain(node)?.kind === 'entry'
          && domain(node)?.kind === 'entry' && domain(node)!.initId === initId)))
      : ctx.game.state.activeInit;
    return candidates.find(node => domain(node)?.kind === 'entry' && domain(node)?.kind === 'entry'
      ? domain(node)!.initId === preferredInit : domain(node)?.kind === 'story' && domain(node)?.initId === preferredInit)?.placementKey
      ?? candidates[0]?.placementKey;
  })();
  const tree = projectEditorExplorerTree(nodes.roots, {
    query, domainVisible, revealPlacementKey,
    expandedOverrides: explorer.expandedOverrides,
    searchExpandedOverrides: explorer.searchExpandedOverrides,
    selectedPlacementKey: explorer.selectedPlacementKey,
    activeResourceKey,
    defaultExpanded: node => {
      const row = domain(node);
      return row?.kind === 'init' && (row.initId === ctx.game.state.activeInit || initFilter === row.initId);
    },
  });
  return renderEditorExplorerTree(ctx, tree, tree.emptyReason === 'no-items'
    ? '当前目录没有可浏览的 Story 或 Entry。' : '没有匹配的 Story 或 Entry。');
}
