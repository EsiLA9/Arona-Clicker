import { buildStoryDirectory, type StoryDirectoryCatalog, type StoryDirectoryDocument, type StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { StoryAuthoringResult } from '../../arona-clicker/contracts/runtime/story-authoring';
import { parseCharacterStoryDirectoryId, type StoryDirectoryDef } from '../../data-services/contracts/story-directory';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import type { ModalManager } from '../interaction/modal';
import type { UIContext } from '../runtime/context';
import { patchEditorDOM } from './dom';
import { openStoryEditorDialog } from './editor-dialog';
import { storyEditingMod, storyEditingMods } from './identity';

interface DirectoryDialogOptions {
  packId?: string | null;
  stories: ReadonlyMap<string, StoryDirectoryDocument>;
  entries: ReadonlyMap<string, StoryEntryDef>;
  target?: { story?: StoryDirectoryDocument; entry?: StoryEntryDef; modName?: string; packId?: string };
  save?: (packId: string, directory: StoryDirectoryDef, remove?: boolean) => StoryAuthoringResult;
  place: (initId: string, directoryId: string | undefined, order: number | undefined, packId: string) => string | undefined;
  open: (kind: 'story' | 'entry', id: string) => void;
  beforeRemove: (root: HTMLElement) => void;
  onClose: () => void;
}

export function openStoryDirectoryDialog(modal: ModalManager, ctx: UIContext, trigger: HTMLElement, options: DirectoryDialogOptions): HTMLElement {
  const escape = ctx.escapeHtml;
  const registry = ctx.game.registry;
  const target = options.target;
  const applicable = target?.entry?.availableInits;
  const initialInit = target?.story?.initId ?? (applicable?.length && !applicable.includes(ctx.view.activeInit) ? applicable[0] : ctx.view.activeInit);
  let initId = initialInit;
  const mods = storyEditingMods(ctx.game).filter(mod => options.packId === undefined || (mod.packRecordId ?? mod.id) === options.packId);
  const matching = mods.filter(mod => mod.modName === target?.modName);
  let packId = options.packId === undefined ? target?.packId ?? (matching.length === 1 ? matching[0].packRecordId ?? matching[0].id : '')
    : mods.length ? options.packId ?? '' : '';
  let query = '';
  let selectedId = '';
  let create = false;
  let panel: HTMLElement;
  let tree: ReturnType<typeof buildStoryDirectory>;

  const pack = () => {
    if (options.packId !== undefined && packId !== options.packId) return undefined;
    try { return packId ? storyEditingMod(ctx.game, packId).record : undefined; }
    catch { return undefined; }
  };
  const syncTree = () => {
    const editing = pack();
    const modName = editing?.manifest.modName;
    const definitions = new Map([...registry.storyDirectories].filter(([, row]) => row.modName !== modName));
    for (const definition of editing?.datapack.storyDirectories ?? []) definitions.set(definition.id, { definition, modName: modName! });
    const characters = new Map(registry.characters);
    for (const character of editing?.datapack.characters ?? []) if (!characters.has(character.id)) characters.set(character.id, character);
    const catalog: StoryDirectoryCatalog = { storyDirectories: definitions, stories: options.stories,
      storyEntries: options.entries, characters, storyDirectoryContentOwner: id => id === (target?.story ?? target?.entry)?.id
        ? target?.modName ?? modName : registry.storyDirectoryContentOwner(id),
      storyDirectoryCharacterOwner: id => registry.storyDirectoryCharacterOwner(id)
        ?? (editing?.datapack.characters.some(row => row.id === id) ? modName : undefined) };
    tree = buildStoryDirectory(catalog, initId);
  };
  const locate = () => {
    selectedId = target?.entry ? tree.entryFolders.get(target.entry.id)?.id ?? ''
      : [...tree.nodes.values()].find(node => node.stories.some(story => story.id === target?.story?.id))?.id ?? '';
  };
  const canPlace = (node?: StoryDirectoryNode) => {
    const editing = pack();
    if (!target || !editing || !initId || (target.modName && editing.manifest.modName !== target.modName)) return false;
    if (applicable?.length && !applicable.includes(initId)) return false;
    return node?.modName === editing.manifest.modName || Boolean(target.entry && node?.definition?.acceptExternalEntries);
  };
  const branch = (nodes: StoryDirectoryNode[]): string => nodes.map(node => {
    const children = branch(node.children);
    const q = query.trim().toLocaleLowerCase();
    const names = [node.title, ...node.stories.map(story => story.name),
      ...node.entries.map(row => entryName(row.id))];
    if (q && !children && !names.some(name => name.toLocaleLowerCase().includes(q))) return '';
    return `<li data-editor-key="directory:${escape(node.id)}"><button type="button" class="story-editor-list-item${node.id === selectedId ? ' is-selected' : ''}" data-directory-select="${escape(node.id)}" aria-pressed="${node.id === selectedId}">
      <strong>${escape(node.title)}</strong>${node.source === 'AutoCreated' && node.modName ? '<small>角色自动目录</small>' : ''}</button>
      ${children ? `<ul>${children}</ul>` : ''}</li>`;
  }).join('');
  const entryName = (id: string) => {
    const entry = options.entries.get(id);
    return entry?.openingTitle ?? options.stories.get(entry?.storyId ?? '')?.name ?? id;
  };
  const button = (name: string, label: string) => `<button type="button" class="mini-action" data-directory-action="${name}">${label}</button>`;
  const field = (key: string, label: string, value?: string | number, type = 'text') =>
    `<label class="story-editor-property">${label}<input data-directory-field="${key}" type="${type}" value="${escape(String(value ?? ''))}"></label>`;
  const renderTree = () => `<ul class="story-directory-tree">${branch(tree.roots)}</ul>`;
  const renderContent = () => {
    const node = tree.nodes.get(selectedId);
    if (!node) return '<p class="story-editor-hint">选择一个目录查看其中的正文和入口。</p>';
    const link = (kind: string, id: string, title: string) => `<button type="button" class="story-editor-list-item" data-directory-open="${kind}" data-directory-id="${escape(id)}">
      <strong>${escape(title)}</strong><small>${kind === 'story' ? 'Story 正文' : 'StoryEntry 入口'}</small></button>`;
    return `<h3>${escape(node.title)}</h3>
      ${node.children.map(child => `<button type="button" class="story-editor-list-item" data-directory-select="${escape(child.id)}"><strong>${escape(child.title)}</strong><small>子目录</small></button>`).join('')}
      ${node.stories.map(story => link('story', story.id, story.name)).join('')}
      ${node.entries.map(row => link('entry', row.id, entryName(row.id))).join('')}`;
  };
  const renderDetails = () => {
    const node = tree.nodes.get(selectedId);
    const editing = pack();
    const own = Boolean(editing && node?.modName === editing.manifest.modName);
    const definition = create ? undefined : node?.definition;
    const placement = target?.entry?.directoryPlacements?.find(row => row.initId === initId);
    const canEdit = Boolean(editing && options.save && initId && (create || own));
    const checked = (value?: boolean) => value ? ' checked' : '';
    const parentId = create ? (own ? node?.id : undefined) : definition?.parentId;
    const parentOptions = [...tree.nodes.values()].filter(folder => folder.modName === editing?.manifest.modName
      && (create || folder.id !== node?.id));
    const covers = new Map(registry.pics);
    for (const picture of editing?.datapack.pics ?? []) covers.set(picture.id, picture);
    return `<h3>${create ? '新建目录' : '目录资料'}</h3>
      ${editing && options.save && initId ? button('new', '新建目录') : '<p class="story-editor-hint">选择编辑态 Mod 后可以编辑自己的目录。</p>'}
      ${canEdit ? `${create ? field('id', '目录短名') : ''}
        ${field('title', '标题', definition?.title ?? (create ? undefined : node?.source === 'Manual' ? node.title : undefined))}
        <label class="story-editor-property">公开简介<textarea data-directory-field="description">${escape(definition?.description ?? '')}</textarea></label>
        <label class="story-editor-property">封面<select data-directory-field="cover"><option value="">无</option>${[...covers.values()].map(pic => `<option value="${escape(pic.id)}"${pic.id === definition?.coverPicId ? ' selected' : ''}>${escape(pic.label ?? pic.id)}</option>`).join('')}</select></label>
        ${create || node?.source === 'Manual' ? `<label class="story-editor-property">上级目录<select data-directory-field="parent">
          <option value="">Init 根目录</option>${parentOptions.map(folder => `<option value="${escape(folder.id)}"${folder.id === parentId ? ' selected' : ''}>${escape(folder.title)}</option>`).join('')}</select></label>` : ''}
        ${field('order', '同级顺序', definition?.order, 'number')}
        <label><input type="checkbox" data-directory-field="public"${checked(definition?.public)}> 提前公开资料</label>
        <label><input type="checkbox" data-directory-field="external"${checked(definition?.acceptExternalEntries)}> 允许其他 Mod 明确收录自有入口</label>
        <div class="story-editor-actions">${button('save', '保存目录')}${definition ? button('remove', '移除配置') : ''}</div>`
        : node?.modName ? `<p class="story-editor-hint">所属 Mod ${escape(node.modName)}</p>` : ''}
      ${canPlace(node) ? `<div class="story-editor-actions">${target?.entry ? field('placement-order', '入口顺序', placement?.order, 'number') : ''}${button('place', '将当前内容放在这里')}</div>` : ''}
      ${editing && (target?.story?.directoryId || placement) && (!target?.modName || target.modName === editing.manifest.modName) ? button('clear', '恢复自动归档') : ''}`;
  };
  const refresh = (keys: string[]) => {
    const renders: Record<string, () => string> = { tree: renderTree, content: renderContent, details: renderDetails };
    for (const key of keys) {
      const region = panel.querySelector<HTMLElement>(`[data-directory-region="${key}"]`)!;
      const next = region.cloneNode(false) as HTMLElement;
      next.innerHTML = renders[key]();
      patchEditorDOM(region, next, options.beforeRemove);
    }
  };
  const message = (text: string) => { panel.querySelector<HTMLElement>('[data-directory-message]')!.textContent = text; };
  const read = (key: string) => panel.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-directory-field="${key}"]`)?.value.trim() || undefined;
  const selected = (key: string) => panel.querySelector<HTMLInputElement>(`[data-directory-field="${key}"]`)?.checked;
  syncTree();
  locate();
  panel = openStoryEditorDialog(modal, {
    title: 'Story 目录', panelClass: 'story-catalog-dialog story-directory-dialog', onClose: options.onClose,
    body: `<div class="story-catalog-tools">
      <label>世界线<select data-directory-init>${[...registry.inits.values()].map(init => `<option value="${escape(init.id)}"${init.id === initId ? ' selected' : ''}>${escape(init.name)}</option>`).join('')}<option value=""${initId ? '' : ' selected'}>其他正文</option></select></label>
      <label>编辑态 Mod<select data-directory-mod${options.packId !== undefined ? ' disabled' : ''}><option value="">仅浏览</option>${mods.map(mod => {
        const id = mod.packRecordId ?? mod.id;
        return `<option value="${escape(id)}"${id === packId ? ' selected' : ''}>${escape(mod.modName)} · ${escape(mod.version)}</option>`;
      }).join('')}</select></label>
      <label>搜索<input type="search" data-directory-search placeholder="目录、正文或入口"></label>
    </div><div class="story-directory-columns">
      <nav aria-label="Story 目录" data-directory-region="tree">${renderTree()}</nav>
      <section aria-label="目录内容" data-directory-region="content">${renderContent()}</section>
      <section aria-label="目录资料" data-directory-region="details">${renderDetails()}</section>
    </div>`,
    footer: '<p data-directory-message role="status"></p><button type="button" class="modal-cancel" data-modal-action="close">关闭</button>',
    onAction: () => modal.close(),
  }, trigger);
  panel.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-directory-search]')) {
      query = event.target.value;
      refresh(['tree']);
    }
  });
  panel.addEventListener('change', event => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    if (event.target.matches('[data-directory-init]')) initId = event.target.value;
    else if (event.target.matches('[data-directory-mod]')) packId = event.target.value;
    else return;
    create = false;
    syncTree();
    locate();
    refresh(['tree', 'content', 'details']);
    message('');
  });
  panel.addEventListener('click', event => {
    const control = event.target instanceof Element && event.target.closest<HTMLButtonElement>('button');
    if (!control) return;
    if (control.dataset.directorySelect) {
      selectedId = control.dataset.directorySelect;
      create = false;
      refresh(['tree', 'content', 'details']);
      message('');
    } else if (control.dataset.directoryOpen && control.dataset.directoryId) {
      options.open(control.dataset.directoryOpen === 'story' ? 'story' : 'entry', control.dataset.directoryId);
    } else {
      const action = control.dataset.directoryAction;
      const node = tree.nodes.get(selectedId);
      const editing = pack();
      if (!action || !editing) return;
      if (action === 'new') { create = true; refresh(['details']); message(''); return; }
      if (action === 'place' || action === 'clear') {
        const order = read('placement-order');
        if (action === 'place' && !canPlace(node)) return;
        const error = options.place(initId, action === 'place' ? node?.id : undefined, order === undefined ? undefined : Number(order), packId);
        if (error) message(error);
        else modal.close();
        return;
      }
      if (!options.save || !initId || (!create && node?.modName !== editing.manifest.modName)) return;
      const shortId = read('id');
      if (create && (!shortId || !/^[a-z0-9_-]+$/.test(shortId))) { message('目录短名使用小写字母、数字、下划线或连字符。'); return; }
      const id = create ? `${editing.manifest.modName}:story-directory:${shortId}` : node!.id;
      if (create && tree.nodes.has(id)) { message('该 Mod 已有同 ID 的目录。'); return; }
      const order = read('order');
      const directory: StoryDirectoryDef = { id, initId, characterId: definitionCharacter(node), parentId: read('parent'),
        title: read('title'), description: read('description'), coverPicId: read('cover'), order: order === undefined ? undefined : Number(order),
        public: selected('public'), acceptExternalEntries: selected('external') };
      if (action === 'remove' && node?.source === 'Manual' && (node.children.length || node.entries.length || node.stories.length)) {
        message('请先移动子目录和内容，再移除目录。'); return;
      }
      const result = options.save(packId, directory, action === 'remove');
      message(result.message);
      if (!result.ok) return;
      create = false;
      selectedId = id;
      syncTree();
      refresh(['tree', 'content', 'details']);
    }
  });
  const definitionCharacter = (node?: StoryDirectoryNode) => !create && node?.source === 'AutoCreated'
    ? node.definition?.characterId ?? parseCharacterStoryDirectoryId(node.id)?.characterId : undefined;
  return panel;
}
