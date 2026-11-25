import { buildStoryDirectory, legacyStoryHierarchy, type StoryDirectoryCatalog, type StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { UIContext } from '../runtime/context';
import { storyEntries, storyList, type StoryEditorState, type StoryEditorTarget } from './model';
import { directoryStatus, hierarchyDesignCounts, hierarchyDesignKey, mergeDirectoryDesigns } from './directory-status';

const other = '';

export function directoryManagementAttrs(e: UIContext['escapeHtml'], initId: string, node: Pick<StoryDirectoryNode, 'id' | 'modName'>): string {
  return `data-editor-directory="folder" data-directory-init-id="${e(initId)}" data-directory-folder-id="${e(node.id)}"${node.modName ? ` data-directory-owner="${e(node.modName)}"` : ''}`;
}

export function editorDirectoryContentOwner(ctx: UIContext, state: StoryEditorState): StoryDirectoryCatalog['storyDirectoryContentOwner'] {
  return (id, kind) => ctx.game.registry.storyDirectoryContentOwner(id, kind)
    ?? state.drafts.find(draft => kind === 'story' ? !draft.entryOnly && draft.document.id === id
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

export function sidebarInitIds(ctx: UIContext, state: StoryEditorState): string[] {
  const registry = ctx.game.registry;
  return [...new Set([...registry.inits.keys(), ...state.drafts.flatMap(draft => draft.document.initId ? [draft.document.initId] : []),
    ...Array.from(registry.stories.values(), row => row.initId ?? ''),
    ...Array.from(storyEntries(state, registry.storyEntries).values()).flatMap(row => [...row.availableInits, ...(row.directoryPlacements ?? []).map(place => place.initId)]),
  ])].filter(Boolean);
}

export function sidebarSearch(state: StoryEditorState): string {
  return state.sidebarMode === 'entries' ? state.entrySearch : state.search;
}

export function sidebarFolderChoices(state: StoryEditorState) {
  return sidebarSearch(state).trim() ? state.sidebarSearchFolders : state.sidebarFolders;
}

function matches(target: StoryEditorTarget | null | undefined, kind: StoryEditorTarget['kind'], id: string): boolean {
  return target?.kind === kind && target.id === id;
}

export function renderSidebarTree(ctx: UIContext, state: StoryEditorState, initIds: readonly string[], initFilter: string,
  appliedDirectories: StoryDirectoryCatalog['storyDirectories'],
): string {
  const e = ctx.escapeHtml;
  const registry = ctx.game.registry;
  const query = sidebarSearch(state).trim().toLocaleLowerCase();
  const inSearch = (label: string, id: string) => !query || `${label}\n${id}`.toLocaleLowerCase().includes(query);
  const scope = state.sourceSelection ?? state.sidebarRuntimeScope ?? '';
  const managed = state.directoryManagement?.location();
  const revealing = state.sidebarReveal;
  const entries = storyEntries(state, registry.storyEntries);
  const drafts = new Map(state.drafts.filter(draft => !draft.entryOnly).map(draft => [draft.document.id, draft]));
  const items = storyList({ ...state, search: '' }, registry.stories);
  const storyNames = new Map(items.map(item => [item.storyId, item.name]));
  const entryName = (entry: StoryEntryDef) => entry.openingTitle || storyNames.get(entry.storyId) || entry.id;
  const visibleStories = new Map(items.filter(item =>
    (!state.sourceMod || (item.draft?.packSource?.modName ?? registry.storyDirectoryContentOwner(item.storyId, 'story')) === state.sourceMod
      || matches(revealing, 'story', item.storyId))
    && (matches(revealing, 'story', item.storyId) || state.sidebarMode !== 'entries' && inSearch(item.name, item.storyId)))
    .map(item => [item.storyId, item]));
  const visibleEntries = new Map([...entries].filter(([id, entry]) =>
    (!state.sourceMod || registry.storyDirectoryContentOwner(id) === state.sourceMod || !registry.storyEntries.has(id) || matches(revealing, 'entry', id))
    && (matches(revealing, 'entry', id) || state.sidebarMode !== 'stories' && inSearch(entryName(entry), id))));
  const edited = state.directoryManagement?.editedDirectories();
  const storyDirectories = edited
    ? new Map([...registry.storyDirectories].filter(([, row]) => row.modName !== edited.modName))
    : registry.storyDirectories;
  if (edited && storyDirectories instanceof Map) {
    for (const definition of edited.definitions) storyDirectories.set(definition.id, { definition, modName: edited.modName });
  }
  const designCounts = hierarchyDesignCounts(mergeDirectoryDesigns(storyDirectories, appliedDirectories, edited?.modName ?? state.sourceMod));
  const catalog: StoryDirectoryCatalog = {
    stories: new Map(items.map(({ storyId }) => [storyId, drafts.get(storyId)?.document ?? registry.stories.get(storyId)!])),
    storyEntries: entries, storyDirectories, characters: registry.characters,
    storyDirectoryContentOwner: editorDirectoryContentOwner(ctx, state),
    storyDirectoryCharacterOwner: id => registry.storyDirectoryCharacterOwner(id),
  };
  const activeInit = ctx.game.state.activeInit;
  const { trees, preferred } = buildEditorStoryDirectories(catalog, initIds, activeInit);
  const fold = sidebarFolderChoices(state);
  const targetEntry = state.target?.kind === 'entry' ? visibleEntries.get(state.target.id) : undefined;
  const targetEntryInits = targetEntry?.availableInits.length ? targetEntry.availableInits
    : targetEntry?.directoryPlacements?.length ? targetEntry.directoryPlacements.map(place => place.initId)
      : targetEntry ? [preferred.get(targetEntry.id) ?? other] : [];
  const preferredEntryInit = initFilter && initFilter !== 'other' && targetEntry && !targetEntry.availableInits.length ? initFilter
    : [initFilter, activeInit].find(id => id && targetEntryInits.includes(id)) ?? targetEntryInits[0];
  const leaf = (kind: StoryEditorTarget['kind'], id: string, path: string, name: string, hint: string, label: string, storyKey?: string, initId?: string) => {
    const selected = matches(state.target, kind, id);
    const data = kind === 'story' ? `data-editor-story="${e(storyKey!)}"` : `data-editor-entry="${e(id)}"`;
    return { selected: selected && (kind === 'story' || initId === preferredEntryInit), html: `<li data-editor-key="${e(JSON.stringify([path, kind, id]))}">
      <button type="button" class="story-editor-tree-row story-editor-tree-item" ${data} aria-pressed="${selected}" title="${e(hint)}">
        <span class="story-editor-tree-name">${e(name)}</span>${label ? `<small>${e(label)}</small>` : ''}
      </button></li>` };
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
    const open = fold?.get(path) ?? (Boolean(query) || selected || openByDefault);
    const deferred = id === '@characters' && rows.some(row => row.emptyFolder);
    const children = deferred && !open ? rows.filter(row => !row.emptyFolder || row.selected) : rows;
    const references = details ? details.stories + details.entries : 0;
    const note = details && [details.short,
      details.designs > 1 ? `资料×${details.designs}` : !details.designs ? '无资料' : details.short === '手动' ? '' : '有资料',
      references > 1 ? `内容×${references}` : '',
    ].filter(Boolean).join(' · ');
    const hint = details ? `${title} · ${details.origin} · 手动资料 ${details.designs} 份 · Story ${details.stories} / Entry ${details.entries}` : title;
    return { selected, emptyFolder: !rows.length, html: `<li data-editor-key="${e(path)}">
      <div class="story-editor-tree-heading">
        <button type="button" class="story-editor-tree-row story-editor-tree-branch" data-sidebar-folder="${e(path)}"${deferred ? ' data-sidebar-deferred' : ''}${rows.length ? ` aria-expanded="${open}"` : ' disabled'} title="${e(hint)}">
          <span class="story-editor-tree-arrow" aria-hidden="true">${rows.length ? open ? '▾' : '▸' : ''}</span><span class="story-editor-tree-name">${e(title)}</span>
          ${details && note ? `<small class="story-editor-tree-note" data-directory-origin="${e(details.short)}">${e(note)}</small>` : ''}
        </button>
        <button type="button" class="mini-action" ${directoryManagementAttrs(e, initId, node)} aria-pressed="${active}" aria-label="管理${e(title)}" title="管理${e(title)}">管理</button>
      </div>
      ${rows.length ? `<ul${open ? '' : ' hidden'}>${children.map(row => row.html).join('')}</ul>` : ''}</li>` };
  };
  const directoryRows = (nodes: readonly StoryDirectoryNode[], initId: string, included: boolean): Row[] => nodes.flatMap(node => {
    const path = JSON.stringify([scope, initId, node.id]);
    const rows = directoryRows(node.children, initId, included);
    const storyGroups = new Map<string, Row[]>();
    for (const { id } of node.stories) {
      if (visibleStories.has(id) && (included || matches(revealing, 'story', id))) storyGroups.set(id, [storyRow(id, path)]);
    }
    const trailingEntries: Row[] = [];
    for (const { id } of node.entries) {
      const entry = visibleEntries.get(id);
      if (!entry) continue;
      const location = initFilter && included || (preferred.has(id) ? preferred.get(id) === initId
        : entry.availableInits.length || entry.directoryPlacements?.some(place => place.initId === initId));
      if (location && (included || matches(revealing, 'entry', id))) {
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
  return rows.length ? `<ul class="story-editor-tree" aria-label="故事目录">${rows.join('')}</ul>`
    : '<p class="story-editor-empty">没有匹配的 Story 或 Entry。</p>';
}
