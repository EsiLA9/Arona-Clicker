import { renderEditorReviewFields } from '../workspace/editor-review';
import { buildStoryDirectory, storyHierarchyNodeId, type StoryDirectoryCatalog, type StoryDirectoryDocument, type StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { StoryAuthoringResult } from '../../arona-clicker/contracts/runtime/story-authoring';
import type { ContentCatalogQueryPort } from '../../arona-clicker/contracts/runtime/content-catalog';
import { isStoryHierarchy, parseCharacterStoryDirectoryId, type StoryDirectoryDef, type StoryEntryDirectoryPlacement } from '../../data-services/contracts/story-directory';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { StoryDirectoryReference } from '../../data-services/authoring/story-directory-references';
import type { UIContext } from '../runtime/context';
import { storyEditingMod, storyEditingMods } from './identity';
import { buildEditorStoryDirectories, directoryManagementAttrs } from './sidebar-tree';
import { renderStoryDirectoryDetails } from '../components/story/story-directory-details';
import { renderTabs } from '../components/shared/tabs';
import { directoryStatus, mergeDirectoryDesigns } from './directory-status';
import { preferStoryDirectoryDescription, type RegisteredStoryDirectory } from '../../data-services/registry/story-directory-validation';

interface DirectoryNavigation {
  tab: 'design' | 'contents';
  tabScroll: Record<'design' | 'contents', number>;
  expanded: Set<string>;
}

interface DirectoryManagementOptions {
  packId?: string | null;
  stories: ReadonlyMap<string, StoryDirectoryDocument>;
  entries: ReadonlyMap<string, StoryEntryDef>;
  initIds: readonly string[];
  location?: { initId: string; directoryId: string };
  navigation?: DirectoryNavigation;
  contentOwner: StoryDirectoryCatalog['storyDirectoryContentOwner'];
  sourceLabel?: string;
  sourceMod?: string;
  appliedCatalog: () => ContentCatalogQueryPort;
  target?: { story?: StoryDirectoryDocument; entry?: StoryEntryDef; modName?: string; packId?: string };
  save?: (packId: string, directory: StoryDirectoryDef | readonly StoryDirectoryDef[], remove?: boolean) => StoryAuthoringResult;
  references: (packId: string, node: StoryDirectoryNode) => readonly (StoryDirectoryReference & { source?: string; sourceLabel?: string })[];
  place: (initId: string, position: Omit<StoryEntryDirectoryPlacement, 'initId'> | undefined, packId: string) => string | undefined;
}

export function createStoryDirectoryManagement(ctx: UIContext, options: DirectoryManagementOptions) {
  const e = ctx.escapeHtml;
  const registry = ctx.game.registry;
  const target = options.target;
  const applicable = target?.entry?.availableInits;
  const initId = options.location?.initId ?? (target?.story ? target.story.initId ?? ''
    : applicable?.length && !applicable.includes(ctx.view.activeInit) ? applicable[0] : ctx.view.activeInit);
  const matching = options.packId === undefined ? storyEditingMods(ctx.game).filter(mod => mod.modName === target?.modName) : [];
  const packId = options.packId ?? (options.packId === undefined ? target?.packId
    ?? (matching.length === 1 ? matching[0].packRecordId ?? matching[0].id : '') : '');
  const readPack = () => {
    try { return packId ? storyEditingMod(ctx.game, packId).record : undefined; }
    catch { return undefined; }
  };
  let editing = readPack();
  const directoryDefinitions = () => {
    const modName = editing?.manifest.modName;
    const definitions = new Map([...registry.storyDirectories].filter(([, row]) => row.modName !== modName));
    for (const definition of editing?.datapack.storyDirectories ?? []) definitions.set(definition.id, { definition, modName: modName! });
    return definitions;
  };
  const build = (includeHierarchyPath?: string) => {
    const modName = editing?.manifest.modName;
    const characters = new Map(registry.characters);
    for (const character of editing?.datapack.characters ?? []) if (!characters.has(character.id)) characters.set(character.id, character);
    const catalog: StoryDirectoryCatalog = { storyDirectories: directoryDefinitions(), stories: options.stories,
      storyEntries: options.entries, characters, storyDirectoryContentOwner: (id, kind) => id === (target?.story ?? target?.entry)?.id
        ? target?.modName ?? modName : options.contentOwner(id, kind),
      storyDirectoryCharacterOwner: id => registry.storyDirectoryCharacterOwner(id)
        ?? (editing?.datapack.characters.some(row => row.id === id) ? modName : undefined) };
    return initId ? buildStoryDirectory(catalog, initId, { includeEmptyCharacters: true, includeHierarchyPath })
      : buildEditorStoryDirectories(catalog, options.initIds, ctx.view.activeInit).trees.get('')!;
  };
  const hierarchyPrefix = storyHierarchyNodeId('');
  const reopenPath = options.location?.directoryId.startsWith(hierarchyPrefix)
    ? options.location.directoryId.slice(hierarchyPrefix.length) : undefined;
  let tree = build(reopenPath);
  let selectedId = options.location?.directoryId ?? (target?.entry ? tree.entryFolders.get(target.entry.id)?.id
    : [...tree.nodes.values()].find(node => node.stories.some(story => story.id === target?.story?.id))?.id) ?? '';
  let create: 'legacy' | 'path' | 'design' | undefined;
  let editingDesign = false;
  let tab: DirectoryNavigation['tab'] = options.navigation?.tab ?? (selectedId ? 'design' : 'contents');
  const tabScroll = options.navigation?.tabScroll ?? { design: 0, contents: 0 };
  const expanded = options.navigation?.expanded ?? new Set<string>();
  let pendingScroll: number | undefined;
  let candidateId: string | undefined;
  let moving = false;
  let moveQuery = '';
  let moveParent: string | undefined;
  let sorting: string[] | undefined;
  let removing = false;
  let status = '';
  const values = new Map<string, string>();
  const canSetPath = () => Boolean(target && editing && (initId || target.story)
    && (!target.modName || editing.manifest.modName === target.modName) && (!applicable?.length || applicable.includes(initId)));
  const canPlace = (node?: StoryDirectoryNode) => Boolean(canSetPath() && node && (node.source === 'Path'
    || (initId && (node.modName === editing?.manifest.modName || target?.entry && node.definition?.acceptExternalEntries))));
  const button = (name: string, label: string, disabled = false) => `<button type="button" class="mini-action${name === 'confirm-remove' ? ' mini-action--danger' : ''}" data-directory-action="${name}"${disabled ? ' disabled' : ''}>${label}</button>`;
  const createButton = (name: string, label: string, owner?: string) =>
    `<button type="button" class="mini-action" data-directory-create="${name}"${owner ? ` data-directory-create-owner="${e(owner)}"` : ''}>${label}</button>`;
  const value = (key: string, fallback?: string | number) => values.get(key) ?? String(fallback ?? '');
  const field = (key: string, label: string, fallback?: string | number, type = 'text') =>
    `<label class="story-editor-property">${label}<input data-directory-field="${key}" type="${type}" value="${e(value(key, fallback))}"></label>`;
  const checked = (key: string, fallback?: boolean) => value(key, fallback ? 'true' : '') === 'true' ? ' checked' : '';
  const initTitle = initId ? registry.inits.get(initId)?.name || initId : '其他';
  const title = () => tree.nodes.get(selectedId)?.title ?? initTitle;
  const path = (id?: string): string => {
    const parts = [];
    let node = id ? tree.nodes.get(id) : undefined;
    while (node) {
      parts.unshift(node.title);
      node = tree.nodes.get(node.parentId ?? '');
    }
    return [initTitle, ...parts].join(' / ');
  };
  const owns = (node?: StoryDirectoryNode) => Boolean(editing && options.save && initId && node?.modName === editing.manifest.modName);
  const candidatesAt = (node: StoryDirectoryNode, definitions: ReadonlyMap<string, RegisteredStoryDirectory>) =>
    [...definitions.values()].filter(row => row.definition.initId === initId && row.definition.hierarchyString === node.hierarchyString);
  const candidates = (node: StoryDirectoryNode) => candidatesAt(node,
    mergeDirectoryDesigns(directoryDefinitions(), options.appliedCatalog().storyDirectories, editing?.manifest.modName ?? options.sourceMod),
  ).sort((a, b) => a.definition.id.localeCompare(b.definition.id));
  const primaryOf = (rows: readonly RegisteredStoryDirectory[]) => rows.reduce<RegisteredStoryDirectory | undefined>(
    (winner, row) => preferStoryDirectoryDescription(row.definition, winner?.definition) ? row : winner, undefined);
  const candidate = (node: StoryDirectoryNode) => candidateId === ''
    ? undefined : candidateId ? candidates(node).find(row => row.definition.id === candidateId)
      : node.hierarchyPrimary?.definition.primary === 'path' ? undefined : node.hierarchyPrimary;
  const ownsDesign = (node?: StoryDirectoryNode) => node?.source === 'Path'
    ? Boolean(editing && options.save && initId && candidate(node)?.modName === editing.manifest.modName) : owns(node);
  const canEditDesign = (node?: StoryDirectoryNode) => Boolean(editing && options.save && initId
    && (create || ownsDesign(node) && editingDesign));
  const themes = () => new Map([...registry.themeDesigns, ...(editing?.datapack.themeDesigns ?? []).map(row => [row.id, row] as const)]);
  const movable = (node?: StoryDirectoryNode): node is StoryDirectoryNode & { definition: StoryDirectoryDef } =>
    Boolean(owns(node) && node?.source === 'Manual' && node.definition);
  const children = () => tree.nodes.get(selectedId)?.children ?? tree.roots;
  const editableChildren = () => children().filter(movable);
  const pendingOrder = () => {
    const current = editableChildren();
    if (!sorting || current.every((child, index) => child.id === sorting![index])) return [];
    const slots = current.map(child => child.order ?? Number.MAX_SAFE_INTEGER);
    for (let index = slots.length - 2; index >= 0; index--) {
      const next = slots[index + 1];
      if (slots[index] >= next) slots[index] = next - Math.max(1, Math.abs(next) * Number.EPSILON);
    }
    const finite = slots.every(Number.isFinite);
    return sorting.map((id, index) => ({ ...tree.nodes.get(id)!.definition!, order: finite ? slots[index] : index * 100 }));
  };
  const parentChoices = (node: StoryDirectoryNode) => {
    const excluded = new Set<string>();
    const exclude = (item: StoryDirectoryNode) => { excluded.add(item.id); item.children.forEach(exclude); };
    exclude(node);
    return new Set([...tree.nodes.values()].filter(item => item.source !== 'Path' && owns(item) && !excluded.has(item.id)).map(item => item.id));
  };
  const sortArrows = (id: string, ids: readonly string[]) => {
    const index = ids.indexOf(id);
    if (index === -1) return '';
    return `<div class="story-editor-actions">
      ${button(`up:${e(id)}`, '上移', index === 0)}
      ${button(`down:${e(id)}`, '下移', index === ids.length - 1)}
    </div>`;
  };

  const renderContent = () => {
    const node = tree.nodes.get(selectedId);
    const link = (kind: 'story' | 'entry', id: string, name: string) => `<li data-editor-key="${kind}:${e(id)}">
      <button type="button" class="story-editor-tree-row" data-story-target-kind="${kind}" title="${e(name)} · ${e(id)}" data-editor-${kind}-target="${e(id)}">
        <span class="story-editor-tree-name">${e(name)}</span><small>${kind === 'story' ? '正文' : '入口'}</small>
      </button></li>`;
    const leaves = (folder?: StoryDirectoryNode) => [
      ...(folder?.stories ?? []).map(story => link('story', story.id, story.name)),
      ...(folder?.entries ?? []).map(row => {
        const entry = options.entries.get(row.id);
        return link('entry', row.id, entry?.openingTitle || options.stories.get(entry?.storyId ?? '')?.name || row.id);
      }),
    ].join('');
    const branch = (child: StoryDirectoryNode, topLevel = false): string => {
      const open = expanded.has(child.id);
      const count = child.children.length + child.stories.length + child.entries.length;
      return `<li data-editor-key="directory-child:${e(child.id)}"><div class="story-editor-tree-heading">
        ${count && !sorting ? `<button type="button" class="mini-action" data-directory-action="fold:${e(child.id)}" aria-label="${open ? '折叠' : '展开'}${e(child.title)}" aria-expanded="${open}">${open ? '▾' : '▸'}</button>` : ''}
        <button type="button" class="story-editor-tree-row" ${directoryManagementAttrs(e, initId, child)}${sorting ? ' disabled' : ''} title="${e(child.title)}"><span class="story-editor-tree-name">${e(child.title)}</span><small>${count} 项</small></button>
        ${sorting && topLevel ? sortArrows(child.id, sorting) : ''}</div>
        ${open && !sorting ? `<ul>${child.children.map(item => branch(item)).join('')}${leaves(child)}</ul>` : ''}</li>`;
    };
    const directories = children();
    const order = new Map(pendingOrder().map(row => [row.id, row.order]));
    const ordered = order.size ? [...directories].sort((a, b) => (order.get(a.id) ?? a.order ?? Number.MAX_SAFE_INTEGER)
      - (order.get(b.id) ?? b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)) : directories;
    const contents = ordered.map(child => branch(child, true)).join('') + leaves(node);
    const toolbar = sorting
      ? button('save-order', '保存顺序', order.size === 0) + button('cancel-order', '取消')
      : !target && !create && !moving && !removing && editableChildren().length > 1 ? button('sort', '调整同级顺序') : '';
    return `${toolbar ? `<div class="story-editor-actions story-editor-actions--tools" data-editor-key="directory-order-tools">${toolbar}</div>` : ''}
      ${contents ? `<ul class="story-editor-tree" data-editor-key="directory-contents">${contents}</ul>` : '<p class="story-editor-empty">此目录暂无内容。</p>'}`;
  };

  const renderMove = (node: StoryDirectoryNode) => {
    const allowed = parentChoices(node);
    const query = moveQuery.trim().toLocaleLowerCase();
    const option = (id: string, label: string) => `<button type="button" class="story-editor-list-item" data-editor-key="move-parent:${e(id)}" data-directory-action="parent:${e(id)}" aria-pressed="${moveParent === id}"><strong>${e(label)}</strong></button>`;
    const branch = (items: readonly StoryDirectoryNode[]): string => items.map(item => {
      const nested = branch(item.children);
      const match = allowed.has(item.id) && `${path(item.id)} ${item.id}`.toLocaleLowerCase().includes(query);
      if (!match && !nested) return '';
      return `<li>${match ? option(item.id, item.title) : `<span>${e(item.title)}</span>`}${nested ? `<ul>${nested}</ul>` : ''}</li>`;
    }).join('');
    const choices = branch(tree.roots);
    const currentParent = node.definition?.parentId ?? '';
    return `<div class="story-editor-authoring">
      <label class="story-editor-property">搜索上级目录<input type="search" data-directory-field="move-query" value="${e(moveQuery)}"></label>
      <p class="story-editor-hint">原位置：${e(path(node.id))}</p>
      ${moveParent === undefined ? '' : `<p class="story-editor-hint">新位置：${e(path(moveParent) + ' / ' + node.title)}</p>`}
      <ul class="story-directory-parent-tree">${!query || `init 根目录 ${initTitle}`.toLocaleLowerCase().includes(query) ? `<li>${option('', 'Init 根目录')}</li>` : ''}${choices}</ul>
      <div class="story-editor-actions story-editor-actions--tools">${button('confirm-move', '确认移动', moveParent === undefined || moveParent === currentParent)}${button('cancel-move', '取消')}</div>
    </div>`;
  };

  const renderRemove = (node: StoryDirectoryNode) => {
    const refs = options.references(packId, node);
    return `<div class="story-editor-authoring">
      <p>${refs.length ? '请先整理以下引用，再移除目录。' : node.source === 'Path' ? `删除「${e(candidate(node)?.definition.title || candidate(node)?.definition.id || '目录资料')}」？此路径下的故事和阅读记录会保留。` : node.source === 'AutoCreated' ? '确认恢复此角色目录的默认资料？' : '确认移除此空目录？'}</p>
      ${refs.map(ref => `<button type="button" class="story-editor-list-item" data-directory-reference-kind="${ref.kind}" data-directory-reference-id="${e(ref.id)}"
        data-directory-reference-init="${e(initId)}"${ref.source ? ` data-directory-reference-source="${e(ref.source)}"` : ''}><strong>${e(ref.title)}</strong><small>${e(ref.sourceLabel || (ref.kind === 'directory' ? '子目录' : ref.kind === 'story' ? '正文' : '入口'))} · ${e(ref.id)}</small></button>`).join('')}
      <div class="story-editor-actions story-editor-actions--tools">${button('confirm-remove', node.source === 'Path' ? '确认删除' : node.source === 'AutoCreated' ? '确认恢复' : '确认移除', Boolean(refs.length))}${button('cancel-remove', '取消')}</div>
    </div>`;
  };

  const renderPreview = () => {
    const node = tree.nodes.get(selectedId);
    const editable = canEditDesign(node);
    const definition = create ? undefined : node?.source === 'Path' ? candidate(node)?.definition : node?.definition;
    const publicDirectory = editable ? value('public', definition?.public ? 'true' : '') === 'true' : definition?.public;
    const description = !selectedId && !create ? registry.inits.get(initId)?.description : definition?.description;
    const characterId = node?.source === 'AutoCreated' && parseCharacterStoryDirectoryId(node.id)?.characterId;
    const defaultTitle = characterId ? registry.characters.get(characterId)?.displayName || title()
      : create === 'path' ? value('new-hierarchy').split('/').at(-1) || '新建目录'
      : create === 'legacy' ? '新建目录' : node?.source === 'Path' ? node.hierarchyString.split('/').at(-1)! : title();
    const themeId = editable ? value('theme', definition?.themeDesignId) : definition?.themeDesignId;
    if (node?.source === 'Path' && !definition && !create) {
      return '<p class="story-editor-hint">默认使用路径末级作为目录名称。</p>';
    }
    return `<small class="story-editor-hint">玩家资料预览${designDirty() ? ' · 未保存' : ''}</small>
      ${renderStoryDirectoryDetails(ctx, {
        title: (editable ? value('title', definition?.title).trim() : definition?.title) || defaultTitle,
        description: editable ? value('description', description) : description,
        coverPicId: editable ? value('cover', definition?.coverPicId) : definition?.coverPicId,
        theme: themeId ? themes().get(themeId) ?? options.appliedCatalog().themeDesigns.get(themeId) : undefined,
      })}
      ${definition || editable ? `<small class="story-editor-hint">${publicDirectory ? '提前公开目录资料' : '目录可见后展示资料'}</small>` : ''}`;
  };

  const designFields = ['id', 'title', 'description', 'cover', 'theme', 'public', 'external', 'new-hierarchy'];
  const designDirty = () => Boolean(create || designFields.some(key => values.has(key)));
  const clearDesign = () => designFields.forEach(key => values.delete(key));
  const renderDesign = () => {
    const node = tree.nodes.get(selectedId);
    const pathNode = node?.source === 'Path';
    const pathForm = create === 'path' || create === 'design' || !create && pathNode;
    const definition = create ? undefined : pathNode ? candidate(node)?.definition : node?.definition;
    const covers = new Map(registry.pics);
    for (const picture of editing?.datapack.pics ?? []) covers.set(picture.id, picture);
    return `<div class="story-editor-authoring">
      <div class="story-hierarchy-preview" data-directory-preview data-editor-key="directory-preview">${renderPreview()}</div>
      ${canEditDesign(node) ? `${create === 'path' ? field('new-hierarchy', '层级路径', pathNode ? node.hierarchyString + '/' : '') : ''}
        ${create ? field('id', pathForm ? '资料短名' : '目录短名') : ''}
        ${field('title', '标题', definition?.title ?? (create ? undefined : node?.source === 'Manual' ? node.title : undefined))}
        <label class="story-editor-property">公开简介<textarea data-directory-field="description">${e(value('description', definition?.description))}</textarea></label>
        <label class="story-editor-property">封面<select data-directory-field="cover"><option value="">无</option>${[...covers.values()].map(pic => `<option value="${e(pic.id)}"${pic.id === value('cover', definition?.coverPicId) ? ' selected' : ''}>${e(pic.label ?? pic.id)}</option>`).join('')}</select></label>
        <label class="story-editor-property">目录主题<select data-directory-field="theme"><option value=""${value('theme', definition?.themeDesignId) ? '' : ' selected'}>默认主题</option>${[...themes().values()].map(theme => `<option value="${e(theme.id)}"${theme.id === value('theme', definition?.themeDesignId) ? ' selected' : ''}>${e(theme.name)}</option>`).join('')}</select></label>
        ${create === 'legacy' || !create && node?.source === 'Manual' ? `<p class="story-editor-hint">上级目录：${e(path(create ? node?.id : node?.parentId))}</p>` : ''}
        <label><input type="checkbox" data-directory-field="public"${checked('public', definition?.public)}> 提前公开目录资料</label>
        ${pathForm ? '' : `<label><input type="checkbox" data-directory-field="external"${checked('external', definition?.acceptExternalEntries)}> 允许其他 Mod 明确收录自有入口</label>`}
        <div class="story-editor-actions story-editor-actions--tools">${button('save', pathForm ? '保存目录资料' : '保存目录', Boolean(sorting))}
          ${create ? button('cancel', '取消') : button('reset-design', '取消编辑')}</div>` : ''}
    </div>`;
  };

  const renderDetails = () => {
    const node = tree.nodes.get(selectedId);
    if (node && moving) return renderMove(node);
    if (node && removing) return renderRemove(node);
    const pathNode = node?.source === 'Path';
    const placement = target?.entry?.directoryPlacements?.find(row => row.initId === initId);
    const targetPath = target?.story?.hierarchyString ?? placement?.hierarchyString;
    const writable = editing && options.save && initId && !sorting && !moving && !removing;
    const selected = pathNode ? candidate(node) : undefined;
    const choices = pathNode ? candidates(node) : [];
    const details = node && directoryStatus(node, choices.length);
    const applied = pathNode ? primaryOf(candidatesAt(node, options.appliedCatalog().storyDirectories)) : undefined;
    const next = primaryOf(choices);
    const appliedLabel = (row?: RegisteredStoryDirectory) => row && row.definition.primary !== 'path'
      ? `${row.definition.title || row.definition.id} · ${row.modName}` : '路径默认显示';
    const ownsCurrent = ownsDesign(node);
    const busy = designDirty();
    const definition = pathNode ? selected?.definition : node?.definition;
    const creationActions = options.save && initId && !busy && !sorting && !removing && !moving
      ? (pathNode ? createButton('new-design', '创建手动资料') : '')
        + (!selectedId || !pathNode && node?.modName ? createButton('new', '新建子目录', node?.modName) : '')
        + (!selectedId || pathNode ? createButton('new-path', '新建路径目录') : '')
        + (node?.source === 'AutoCreated' && node.modName && !definition && !editingDesign
          ? createButton('edit-design', '创建手动资料', node.modName) : '') : '';
    const actions = button('view-design', '查看') + creationActions + (writable
      ? (ownsCurrent && definition ? button('edit-design', '编辑', busy || editingDesign)
          + button('remove', node?.source === 'AutoCreated' ? '恢复默认资料' : '删除', busy) : '')
        + (movable(node) ? button('move', '移动目录', busy) : '') : '');
    return `<div class="story-editor-authoring story-hierarchy-inspector">
      <p class="story-hierarchy-path" title="层级位置">${e(pathNode ? `${initTitle} / ${node.hierarchyString.split('/').join(' / ')}` : path(selectedId))}</p>
      ${node?.modName && !pathNode ? `<p class="story-editor-hint">所属 Mod ${e(node.modName)}</p>` : ''}
      ${options.sourceLabel ? `<p class="story-editor-hint">${e(options.sourceLabel)}</p>` : ''}
      ${details ? renderEditorReviewFields(ctx, '层级状态', [
        { label: '构建来源', content: e(details.origin) },
        { label: '手动资料', content: details.designs ? `${details.designs} 份` : '无' },
        { label: '直接归属', content: `${details.stories} 条 Story · ${details.entries} 条 Entry` },
      ]) : ''}
      ${pathNode ? `${renderEditorReviewFields(ctx, '资料生效状态', [
        { label: '当前生效', content: e(appliedLabel(applied)) },
        ...(JSON.stringify(next?.definition) !== JSON.stringify(applied?.definition)
          ? [{ label: '应用后', content: e(next?.definition.id === applied?.definition.id && appliedLabel(next) === appliedLabel(applied)
            ? '资料有更新' : appliedLabel(next)) }] : []),
      ])}
        <p class="story-editor-hint">选择已有资料后可预览。</p>
        <ul class="story-editor-tree" aria-label="选择已有手动资料">
          <li><button type="button" class="story-editor-tree-row" data-directory-action="candidate:" aria-pressed="${!create && !selected}">路径默认显示</button></li>
          ${choices.map(row => `<li data-editor-key="hierarchy-design:${e(row.definition.id)}"><button type="button" class="story-editor-tree-row"
            data-directory-action="candidate:${e(row.definition.id)}" aria-pressed="${!create && selected?.definition.id === row.definition.id}" title="${e(row.definition.id)}">
            <span class="story-editor-tree-name">${e(row.definition.title || row.definition.id)}</span><small>${e(row.modName)}</small></button></li>`).join('')}
        </ul>
      ` : ''}
      <div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="资料操作">${actions}</div>
      ${pathNode ? `
        ${writable && choices.some(row => row.modName === editing?.manifest.modName) ? `<div class="story-editor-actions story-editor-actions--tools" role="group" aria-label="显示设置">
          ${ownsDesign(node) ? button('primary-design', '设为主资料', Boolean(create) || editingDesign || selected?.definition.primary === 'design') : ''}
          ${button('primary-path', '恢复默认显示', Boolean(create) || editingDesign || node.hierarchyPrimary?.definition.primary === 'path' && node.hierarchyPrimary.modName === editing?.manifest.modName)}
        </div>` : ''}` : ''}
      ${canSetPath() && !create ? `<div class="story-editor-actions story-editor-actions--tools">
        ${field('placement-hierarchy', '层级路径（用 / 分隔）', targetPath ?? (pathNode ? node.hierarchyString : ''))}
        ${target?.entry ? field('placement-order', '入口顺序', placement?.order, 'number') : ''}
        ${button('place-path', '按路径归档')}${canPlace(node) ? button('place', '将当前内容放在这里') : ''}</div>` : ''}
      ${canSetPath() && (target?.story?.directoryId || targetPath || placement) ? button('clear', '恢复自动归档') : ''}
    </div>`;
  };
  const input = (control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
    const key = control.dataset.directoryField;
    if (key === 'move-query') { moveQuery = control.value; return 'region'; }
    if (key) values.set(key,
      control instanceof HTMLInputElement && control.type === 'checkbox' ? String(control.checked) : control.value);
    if (key && designFields.includes(key)) return 'preview';
  };
  const commit = (updates: StoryDirectoryDef | readonly StoryDirectoryDef[], remove = false) => {
    const result = options.save!(packId, updates, remove);
    status = result.message;
    if (!result.ok) return false;
    editing = readPack();
    tree = build();
    return true;
  };
  const action = (name: string, root: HTMLElement): boolean => {
    const node = tree.nodes.get(selectedId);
    const switchTab = (next: typeof tab) => {
      if (next === tab) return;
      tabScroll[tab] = root.querySelector<HTMLElement>('.story-editor-center .workspace-column__body')?.scrollTop ?? 0;
      tab = next;
      pendingScroll = tabScroll[tab];
    };
    if (name === 'tab:design' || name === 'tab:contents') {
      switchTab(name === 'tab:design' ? 'design' : 'contents');
      return false;
    }
    if (name === 'view-design') { switchTab('design'); return false; }
    if (name.startsWith('fold:')) {
      const id = name.slice('fold:'.length);
      if (!expanded.delete(id)) expanded.add(id);
      return false;
    }
    if (name.startsWith('candidate:') && node?.source === 'Path') {
      if (moving || removing || sorting) return false;
      if (designDirty()) { status = '请先保存或放弃当前目录设计。'; return false; }
      const id = name.slice('candidate:'.length);
      if (id && !candidates(node).some(row => row.definition.id === id)) return false;
      candidateId = id;
      editingDesign = false;
      status = '';
      switchTab('design');
      return false;
    }
    if (!editing) return false;
    const read = (key: string) => root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-directory-field="${key}"]`)?.value.trim() || undefined;
    const selected = (key: string) => root.querySelector<HTMLInputElement>(`[data-directory-field="${key}"]`)?.checked;
    if (name === 'reset-design') { clearDesign(); editingDesign = false; status = ''; return false; }
    if (name === 'edit-design' && ownsDesign(node) && !create && !sorting && !removing) {
      editingDesign = true;
      status = '';
      switchTab('design');
      return false;
    }
    if (name === 'new-design' && node?.source === 'Path' && options.save && initId && !sorting && !moving && !removing) {
      if (designDirty()) { status = '请先保存或放弃当前目录设计。'; return false; }
      create = 'design';
      editingDesign = false;
      switchTab('design');
      return false;
    }
    if (name === 'new' || name === 'new-path' || name === 'cancel') {
      if (name !== 'cancel' && (!options.save || !initId || sorting || selectedId &&
        (name === 'new' ? node?.source === 'Path' || !owns(node) : node?.source !== 'Path'))) return false;
      if (name !== 'cancel' && designDirty()) { status = '请先保存或放弃当前目录设计。'; return false; }
      create = name === 'new' ? 'legacy' : name === 'new-path' ? 'path' : undefined;
      editingDesign = false;
      clearDesign(); status = '';
      if (create) switchTab('design');
      return false;
    }
    if (name === 'place' || name === 'place-path' || name === 'clear') {
      if (!canSetPath() || name === 'place' && !canPlace(node)) return false;
      const order = read('placement-order');
      const hierarchyString = name === 'place-path' ? read('placement-hierarchy') : node?.source === 'Path' ? node.hierarchyString : undefined;
      if (name === 'place-path' && !isStoryHierarchy(hierarchyString)) { status = '请填写有效的层级路径，各级用 / 分隔。'; return false; }
      const position = name === 'clear' ? undefined : {
        ...(hierarchyString ? { hierarchyString } : { directoryId: node?.id }),
        ...(order === undefined ? {} : { order: Number(order) }),
      };
      status = options.place(initId, position, packId) ?? '';
      return !status;
    }
    if (!options.save || !initId) return false;
    if ((name === 'primary-design' || name === 'primary-path') && node?.source === 'Path' && !sorting && !moving && !removing) {
      if (designDirty()) { status = '请先保存或放弃当前目录设计。'; return false; }
      const own = candidates(node).filter(row => row.modName === editing?.manifest.modName);
      const selected = candidate(node);
      const preferred = selected?.modName === editing.manifest.modName ? selected
        : name === 'primary-path' ? own[0] : undefined;
      if (!preferred) return false;
      const primary = name === 'primary-path' ? 'path' : 'design';
      const changes: StoryDirectoryDef[] = [{ ...preferred.definition, primary }];
      for (const row of own) {
        if (row.definition.id === preferred.definition.id || !row.definition.primary) continue;
        const { primary: previous, ...definition } = row.definition;
        changes.push(definition);
      }
      if (commit(changes)) {
        candidateId = primary === 'path' ? '' : preferred.definition.id;
        switchTab('design');
      }
      return false;
    }
    if (name === 'sort' && !target && !create && !moving && !removing) {
      sorting = editableChildren().map(child => child.id);
      status = '仅调整当前编辑态 Mod 的手动子目录。';
      return false;
    }
    if (sorting) {
      if (name === 'cancel-order') { sorting = undefined; status = ''; }
      else if (name === 'save-order') {
        const updates = pendingOrder();
        if (updates.length && commit(updates)) sorting = undefined;
      } else if (name.startsWith('up:') || name.startsWith('down:')) {
        const index = sorting.indexOf(name.slice(name.indexOf(':') + 1));
        const next = index + (name.startsWith('up:') ? -1 : 1);
        if (index >= 0 && next >= 0 && next < sorting.length) [sorting[index], sorting[next]] = [sorting[next], sorting[index]];
      }
      return false;
    }
    if (name === 'move' && movable(node) && !designDirty()) {
      moving = true; moveQuery = ''; moveParent = undefined; status = '';
      return false;
    }
    if (moving && movable(node)) {
      if (name === 'cancel-move') { moving = false; status = ''; }
      else if (name.startsWith('parent:')) {
        const candidate = name.slice('parent:'.length);
        if (!candidate || parentChoices(node).has(candidate)) moveParent = candidate;
      } else if (name === 'confirm-move' && moveParent !== undefined && (node.definition.parentId ?? '') !== moveParent
        && (!moveParent || parentChoices(node).has(moveParent))) {
        if (commit({ ...node.definition, parentId: moveParent || undefined })) moving = false;
      }
      return false;
    }
    const pathNode = node?.source === 'Path';
    const currentDefinition = pathNode ? candidate(node)?.definition : node?.definition;
    if (name === 'remove' && currentDefinition && ownsDesign(node) && !designDirty()) {
      removing = true; status = '';
      return false;
    }
    if (removing && node && currentDefinition && ownsDesign(node)) {
      if (name === 'cancel-remove') { removing = false; status = ''; }
      else if (name === 'confirm-remove' && !options.references(packId, node).length && commit(currentDefinition, true)) {
        removing = false;
        editingDesign = false;
        clearDesign();
        candidateId = undefined;
        selectedId = tree.nodes.has(node.id) ? node.id : node.parentId ?? '';
      }
      return false;
    }
    if (name !== 'save' || !canEditDesign(node)) return false;
    const shortId = read('id');
    const pathForm = create === 'path' || create === 'design' || !create && pathNode;
    const hierarchyString = create === 'path' ? read('new-hierarchy') : pathForm ? node!.hierarchyString : undefined;
    if (pathForm && !isStoryHierarchy(hierarchyString)) { status = '请填写有效的层级路径，各级用 / 分隔。'; return false; }
    const newDefinition = Boolean(create);
    if (newDefinition && (!shortId || !/^[a-z0-9_-]+$/.test(shortId))) { status = '短名使用小写字母、数字、下划线或连字符。'; return false; }
    const id = newDefinition ? `${editing.manifest.modName}:${pathForm ? 'story-hierarchy' : 'story-directory'}:${shortId}` : currentDefinition?.id ?? node!.id;
    if (newDefinition && editing.datapack.storyDirectories?.some(row => row.id === id)) { status = '该 Mod 已有同 ID 的目录资料。'; return false; }
    const characterId = !create && node?.source === 'AutoCreated' ? node.definition?.characterId ?? parseCharacterStoryDirectoryId(node.id)?.characterId : undefined;
    const directory: StoryDirectoryDef = { id, initId, title: read('title'), description: read('description'),
      coverPicId: read('cover'), themeDesignId: read('theme'), order: create ? undefined : currentDefinition?.order, public: selected('public'),
      ...(pathForm ? { hierarchyString, primary: create ? undefined : currentDefinition?.primary }
        : { characterId, parentId: create ? node?.id : node?.definition?.parentId, acceptExternalEntries: selected('external') }) };
    if (commit(directory)) {
      create = undefined;
      editingDesign = !hierarchyString;
      clearDesign();
      candidateId = hierarchyString ? id : undefined;
      selectedId = hierarchyString ? storyHierarchyNodeId(hierarchyString) : id;
    }
    return false;
  };
  return { title, renderDetails, renderPreview, input, action, status: () => status,
    navigation: (): DirectoryNavigation => ({ tab, tabScroll, expanded }),
    renderTabs: () => renderTabs(ctx, 'center', [
      { id: 'design', label: '目录设计', action: 'directory-tab:design' },
      { id: 'contents', label: '内容概览', action: 'directory-tab:contents' },
    ], tab, '层级管理'),
    renderContent: () => `<section role="tabpanel" aria-label="目录设计" data-editor-key="directory-design"${tab !== 'design' ? ' hidden' : ''}>${renderDesign()}</section>
      <section role="tabpanel" aria-label="内容概览" data-editor-key="directory-overview"${tab !== 'contents' ? ' hidden' : ''}>${renderContent()}</section>`,
    restoreTabScroll: (body?: HTMLElement | null) => {
      if (body && pendingScroll !== undefined) body.scrollTop = pendingScroll;
      pendingScroll = undefined;
    },
    editedDirectories: () => editing && { modName: editing.manifest.modName, definitions: editing.datapack.storyDirectories ?? [] },
    location: () => ({ initId, directoryId: selectedId }) };
}
