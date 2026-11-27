import { renderEditorDirectoryList, renderEditorDirectoryRow, renderEditorDirectoryToggle, renderEditorGear, renderStoryDocumentIcon } from '../workspace/editor-directory';
import { buildStoryDirectory, legacyStoryHierarchy, type StoryDirectoryCatalog, type StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { UIContext } from '../runtime/context';
import { editorLayout } from '../workspace/editor-workspace';
import { storyEntries, storyList, type StoryEditorState, type StoryEditorTarget } from './model';
import { storyExplorerSourceValue, type StoryExplorerProjection, type StoryExplorerState } from './pack-source';
import { directoryStatus, hierarchyDesignCounts, hierarchyDesignKey, mergeDirectoryDesigns } from './directory-status';
import { storyBrowseIdentity } from './workspace-session';
import type { EditorExplorerStateSnapshot } from '../workspace/editor-explorer-service';

const other = '';

export function storyExplorerResourceIdentity(target: StoryEditorTarget, source: string, runningPackId?: string): string {
  return storyBrowseIdentity(target, source, runningPackId).resourceKey;
}

export function storyExplorerPlacementIdentity(parentPlacement: string, target: StoryEditorTarget): string {
  return JSON.stringify([parentPlacement, target.kind, target.id]);
}

export function directoryManagementAttrs(e: UIContext['escapeHtml'], initId: string, node: Pick<StoryDirectoryNode, 'id' | 'modName'>): string {
  return `data-editor-directory="folder" data-directory-init-id="${e(initId)}" data-directory-folder-id="${e(node.id)}"${node.modName ? ` data-directory-owner="${e(node.modName)}"` : ''}`;
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

export function sidebarFolderChoices(state: StoryExplorerState, explorer: EditorExplorerStateSnapshot): Readonly<Record<string, boolean>> {
  return sidebarSearch(state, explorer).trim() ? explorer.searchExpandedOverrides : explorer.expandedOverrides;
}

function matches(target: StoryEditorTarget | null | undefined, kind: StoryEditorTarget['kind'], id: string): boolean {
  return target?.kind === kind && target.id === id;
}

export function renderSidebarTree(ctx: UIContext, state: StoryEditorState, explorerState: StoryExplorerState, projection: StoryExplorerProjection,
  initIds: readonly string[], initFilter: string,
  appliedDirectories: StoryDirectoryCatalog['storyDirectories'], explorer: EditorExplorerStateSnapshot,
): string {
  const e = ctx.escapeHtml;
  const registry = ctx.game.registry;
  const query = sidebarSearch(explorerState, explorer).trim().toLocaleLowerCase();
  const inSearch = (label: string, id: string) => !query || `${label}\n${id}`.toLocaleLowerCase().includes(query);
  const sourceValue = storyExplorerSourceValue(projection.source);
  const scope = projection.source.kind === 'runtime' ? projection.runtimeScope : sourceValue;
  const resourceSource = sourceValue;
  const packCatalog = ctx.game as typeof ctx.game & Partial<import('../../arona-clicker/contracts/runtime/runtime').PackCatalogReadModel>;
  const resourceIdentity = (target: StoryEditorTarget): string => {
    const owner = registry.storyDirectoryContentOwner(target.id, target.kind) ?? target.id.split(':')[0];
    return storyExplorerResourceIdentity(target, resourceSource, !resourceSource ? packCatalog.getRunningStoryPackId?.(owner) : undefined);
  };
  const advanced = editorLayout.state.mode === 'advanced';
  const managed = state.directoryManagement?.location();
  const revealing = explorer.reveal;
  const reveals = (target: StoryEditorTarget): boolean => Boolean(revealing && resourceIdentity(target) === revealing.resourceKey);
  const sourceState = { drafts: projection.drafts };
  const entries = storyEntries(sourceState, registry.storyEntries);
  const drafts = new Map(projection.drafts.filter(draft => !draft.entryOnly).map(draft => [draft.document.id, draft]));
  const items = storyList(sourceState, registry.stories);
  const storyNames = new Map(items.map(item => [item.storyId, item.name]));
  const entryName = (entry: StoryEntryDef) => entry.openingTitle || storyNames.get(entry.storyId) || entry.id;
  const visibleStories = new Map(items.filter(item =>
    (!projection.sourceMod || (item.draft?.packSource?.modName ?? registry.storyDirectoryContentOwner(item.storyId, 'story')) === projection.sourceMod
      || reveals({ kind: 'story', id: item.storyId }))
    && (reveals({ kind: 'story', id: item.storyId }) || explorerState.directoryMode !== 'entries' && inSearch(item.name, item.storyId)))
    .map(item => [item.storyId, item]));
  const visibleEntries = new Map([...entries].filter(([id, entry]) =>
    (!projection.sourceMod || registry.storyDirectoryContentOwner(id) === projection.sourceMod || !registry.storyEntries.has(id) || reveals({ kind: 'entry', id }))
    && (reveals({ kind: 'entry', id }) || explorerState.directoryMode !== 'stories' && inSearch(entryName(entry), id))));
  const edited = state.directoryManagement?.editedDirectories();
  const storyDirectories = edited
    ? new Map([...registry.storyDirectories].filter(([, row]) => row.modName !== edited.modName))
    : registry.storyDirectories;
  if (edited && storyDirectories instanceof Map) {
    for (const definition of edited.definitions) storyDirectories.set(definition.id, { definition, modName: edited.modName });
  }
  const designCounts = hierarchyDesignCounts(mergeDirectoryDesigns(storyDirectories, appliedDirectories, edited?.modName ?? projection.sourceMod));
  const catalog: StoryDirectoryCatalog = {
    stories: new Map(items.map(({ storyId }) => [storyId, drafts.get(storyId)?.document ?? registry.stories.get(storyId)!])),
    storyEntries: entries, storyDirectories, characters: registry.characters,
    storyDirectoryContentOwner: editorDirectoryContentOwner(ctx, projection),
    storyDirectoryCharacterOwner: id => registry.storyDirectoryCharacterOwner(id),
  };
  const activeInit = ctx.game.state.activeInit;
  const { trees, preferred } = buildEditorStoryDirectories(catalog, initIds, activeInit);
  const fold = sidebarFolderChoices(explorerState, explorer);
  const located = advanced ? undefined : state.target;
  const targetEntry = located?.kind === 'entry' ? visibleEntries.get(located.id)
    : revealing ? [...visibleEntries].find(([id]) => resourceIdentity({ kind: 'entry', id }) === revealing.resourceKey)?.[1] : undefined;
  const targetEntryInits = targetEntry?.availableInits.length ? targetEntry.availableInits
    : targetEntry?.directoryPlacements?.length ? targetEntry.directoryPlacements.map(place => place.initId)
      : targetEntry ? [preferred.get(targetEntry.id) ?? other] : [];
  const requestedInit = initFilter === 'other' ? other : initFilter;
  const preferredEntryInit = [requestedInit, activeInit].find(id => id && targetEntryInits.includes(id)) ?? targetEntryInits[0];
  const revealPlacementKey = (() => {
    if (!revealing) return undefined;
    if (revealing.placementKey) return revealing.placementKey;
    const target = targetEntry ? { kind: 'entry' as const, id: targetEntry.id }
      : [...visibleStories.keys()].map(id => ({ kind: 'story' as const, id }))
        .find(candidate => resourceIdentity(candidate) === revealing.resourceKey);
    if (!target) return undefined;
    const candidates: { initId: string; key: string }[] = [];
    for (const [initId, tree] of trees) {
      const visit = (nodes: readonly StoryDirectoryNode[]): void => nodes.forEach(node => {
        const path = JSON.stringify([scope, initId, node.id]);
        if (target.kind === 'story' ? node.stories.some(item => item.id === target.id) : node.entries.some(item => item.id === target.id)) {
          candidates.push({ initId, key: storyExplorerPlacementIdentity(path, target) });
        }
        visit(node.children);
      });
      visit(tree.roots);
    }
    const preferredInit = target.kind === 'entry' ? preferredEntryInit : activeInit;
    return candidates.find(candidate => candidate.initId === preferredInit)?.key ?? candidates[0]?.key;
  })();
  const leaf = (kind: StoryEditorTarget['kind'], id: string, path: string, name: string, hint: string, label: string, storyKey?: string, initId?: string) => {
    const target = { kind, id } as StoryEditorTarget;
    const resourceKey = resourceIdentity(target);
    const placementIdentity = storyExplorerPlacementIdentity(path, target);
    const revealedHere = reveals(target) && (!revealPlacementKey || revealPlacementKey === placementIdentity);
    const selected = revealedHere || explorer.selectedPlacementKey === placementIdentity || !advanced && matches(state.target, kind, id);
    const locatedHere = revealedHere || (explorer.selectedPlacementKey ? explorer.selectedPlacementKey === placementIdentity
      : matches(located, kind, id) && (kind === 'story' || initId === preferredEntryInit));
    const data = kind === 'story' ? `data-editor-story="${e(storyKey!)}"` : `data-editor-entry="${e(id)}"`;
    const opensFrom = advanced ? ` data-sidebar-open-source="${e(sourceValue)}" data-editor-resource-source="${e(sourceValue)}"${kind === 'story' ? ` data-sidebar-story-id="${e(id)}"` : ''}` : '';
    const control = `<button type="button" class="editor-directory-row story-editor-tree-item" data-story-target-kind="${kind}" data-editor-resource-provider="story" data-editor-resource-kind="${kind}" data-editor-resource-id="${e(id)}" data-editor-placement-select data-editor-resource-key="${e(resourceKey)}" data-editor-placement-key="${e(placementIdentity)}" ${data}${opensFrom} aria-pressed="${locatedHere}" title="${e(hint)}">
      ${renderStoryDocumentIcon(kind)}<span class="editor-directory-name">${e(name)}</span>${label ? `<small>${e(label)}</small>` : ''}</button>`;
    return { selected: locatedHere,
      html: renderEditorDirectoryRow(ctx, { key: placementIdentity, control, attributes: `data-editor-placement-key="${e(placementIdentity)}"` }) };
  };
  type Row = ReturnType<typeof leaf> & { emptyFolder?: boolean };
  const storyRow = (id: string, path: string): Row => {
    const item = visibleStories.get(id)!;
    const name = item.name || '未命名 Story';
    return leaf('story', id, path, name, `${name} · ${id}`, item.draft?.dirty || item.draft?.persisted ? '草稿' : '', item.key);
  };
  const entryRow = (id: string, path: string, initId: string): Row => {
    const entry = visibleEntries.get(id)!;
    const type = entry.activation.kind === 'active' ? '主动接取' : entry.activation.kind === 'random' ? '随机抽取' : '好感／角色阶段';
    const name = entryName(entry);
    return leaf('entry', id, path, name, `${name} · ${id} · ${type}`, '入口', undefined, initId);
  };
  const branch = (initId: string, node: Pick<StoryDirectoryNode, 'id' | 'title' | 'modName'>, rows: Row[], keepEmpty: boolean,
    openByDefault = false, details?: ReturnType<typeof directoryStatus>,
  ): Row | undefined => {
    const { id, title } = node;
    const active = managed?.initId === initId && managed.directoryId === id;
    if (!rows.length && !keepEmpty && !active) return;
    const path = JSON.stringify([scope, initId, id || null]);
    const selected = active || rows.some(row => row.selected);
    const open = fold[path] ?? (Boolean(query) || selected || openByDefault);
    const deferred = id === '@characters' && rows.some(row => row.emptyFolder);
    const children = deferred && !open ? rows.filter(row => !row.emptyFolder || row.selected) : rows;
    const references = details ? details.stories + details.entries : 0;
    const note = details && [details.short,
      details.designs > 1 ? `资料×${details.designs}` : !details.designs ? '无资料' : details.short === '手动' ? '' : '有资料',
      references > 1 ? `内容×${references}` : '',
    ].filter(Boolean).join(' · ');
    const hint = details ? `${title} · ${details.origin} · 手动资料 ${details.designs} 份 · Story ${details.stories} / Entry ${details.entries}` : title;
    const control = renderEditorDirectoryToggle(rows.length ? open : undefined,
      `data-sidebar-folder="${e(path)}" data-editor-expand data-editor-placement-key="${e(path)}"${deferred ? ' data-sidebar-deferred' : ''} title="${e(hint)}"`,
      `<span class="editor-directory-name">${e(title)}</span>${details && note ? `<small class="story-editor-tree-note" data-directory-origin="${e(details.short)}">${e(note)}</small>` : ''}`,
      'editor-directory-row editor-directory-branch');
    const actions = `<button type="button" class="mini-action editor-directory-manage" ${directoryManagementAttrs(e, initId, node)} aria-pressed="${active}" aria-label="管理${e(title)}" title="管理${e(title)}">${renderEditorGear()}</button>`;
    return { selected, emptyFolder: !rows.length, html: renderEditorDirectoryRow(ctx, { key: path, control, actions,
      attributes: `data-editor-placement-key="${e(path)}"`,
      children: rows.length ? renderEditorDirectoryList(children.map(row => row.html).join(''), open ? '' : 'hidden') : undefined }) };
  };
  const directoryRows = (nodes: readonly StoryDirectoryNode[], initId: string, included: boolean): Row[] => nodes.flatMap(node => {
    const path = JSON.stringify([scope, initId, node.id]);
    const rows = directoryRows(node.children, initId, included);
    const storyGroups = new Map<string, Row[]>();
    for (const { id } of node.stories) {
      if (visibleStories.has(id) && (included || reveals({ kind: 'story', id }))) storyGroups.set(id, [storyRow(id, path)]);
    }
    const trailingEntries: Row[] = [];
    for (const { id } of node.entries) {
      const entry = visibleEntries.get(id);
      if (!entry) continue;
      const location = initFilter && included || (preferred.has(id) ? preferred.get(id) === initId
        : entry.availableInits.length ? entry.availableInits.includes(initId)
          : entry.directoryPlacements?.some(place => place.initId === initId));
      if (location && (included || reveals({ kind: 'entry', id }))) {
        (storyGroups.get(entry.storyId) ?? trailingEntries).push(entryRow(id, path, initId));
      }
    }
    for (const group of storyGroups.values()) rows.push(...group);
    rows.push(...trailingEntries);
    const details = directoryStatus(node, node.source === 'Path' ? designCounts.get(hierarchyDesignKey(initId, node.hierarchyString)) : undefined);
    const result = branch(initId, node, rows, included && (node.source === 'AutoCreated' || node.source === 'Manual' || node.source === 'Path') && inSearch(node.title, node.id), false, details);
    return result ? [result] : [];
  });
  const rows = [...trees].flatMap(([initId, tree]) => {
    const included = !initFilter || initFilter === (initId || 'other');
    const rows = directoryRows(tree.roots, initId, included);
    const title = initId ? registry.inits.get(initId)?.name || initId : '其他';
    const result = branch(initId, { id: '', title }, rows, included && Boolean(initId) && inSearch(title, initId),
      initId === activeInit || Boolean(initFilter && included));
    return result ? [result.html] : [];
  });
  return rows.length ? renderEditorDirectoryList(rows.join(''), 'aria-label="故事目录"')
    : '<p class="story-editor-empty">没有匹配的 Story 或 Entry。</p>';
}
