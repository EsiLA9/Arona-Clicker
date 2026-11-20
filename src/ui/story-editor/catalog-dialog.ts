import { baseStoryHierarchy, type StoryContentItem } from '../../arona-clicker/content/story/story-hierarchy';
import type { StoryEntryCatalog, StoryEntryDef } from '../../data-services/contracts/story-entry';
import { STORY_CATALOG_ORDER_STEP, UNGROUPED_STORY_CHAPTER_ID, withAuthoredStoryCatalog } from '../columns/authored-story-catalog';
import type { ModalManager } from '../interaction/modal';
import type { UIContext } from '../runtime/context';
import { patchEditorDOM } from './dom';
import { openStoryEditorDialog } from './editor-dialog';
import { readStructuredInput } from './structured-value';

interface Folder {
  path: string[];
  id: string;
  name: string;
  trail: string;
  children: Folder[];
  items: StoryContentItem[];
  parent?: Folder;
}

export interface CatalogDialogMemory {
  path?: string[];
  expanded: Set<string>;
  treeScroll: number;
}

const pathKey = (path: readonly string[]) => JSON.stringify(path);
const folderValue = (id: string, name: string) => id.startsWith('author-') || id.startsWith('author:') ? name : id;
const catalogPath = (catalog: StoryEntryCatalog) => [
  catalog.category, catalog.part,
  ...(catalog.chapter && catalog.chapter !== UNGROUPED_STORY_CHAPTER_ID ? [catalog.chapter] : []),
];

export function storyCatalogLabel(catalog: StoryEntryCatalog): string {
  const [categoryValue, partValue, chapterValue] = catalogPath(catalog);
  const match = (node: { id: string; name: string }, value?: string) => node.id === value || node.name === value;
  const category = baseStoryHierarchy.categories.find(node => match(node, categoryValue));
  const part = category?.parts.find(node => match(node, partValue));
  const chapter = part?.chapters?.find(node => match(node, chapterValue));
  return [category?.name ?? categoryValue, part?.name ?? partValue, chapter?.name ?? chapterValue ?? '不分章'].join(' / ');
}

export function openStoryCatalogDialog(modal: ModalManager, ctx: UIContext, trigger: HTMLElement, options: {
  entry: StoryEntryDef;
  entries: ReadonlyMap<string, StoryEntryDef>;
  storyName: (storyId: string) => string | undefined;
  memory: CatalogDialogMemory;
  pendingOrder?: string;
  canEdit: (row: StoryEntryDef) => boolean;
  beforeRemove: (root: HTMLElement) => void;
  onClose: () => void;
  commit: (value: StoryEntryCatalog | undefined, orders: ReadonlyMap<string, number | undefined>) => string | undefined;
}): HTMLElement {
  const { entry, entries, memory } = options;
  const escape = ctx.escapeHtml;
  const roots: Folder[] = [];
  const folders = new Map<string, Folder>();
  const add = (id: string, name: string, parent?: Folder, items: StoryContentItem[] = []): Folder => {
    const path = [...parent?.path ?? [], folderValue(id, name)];
    const folder: Folder = { path, id, name, parent, trail: parent ? `${parent.trail} / ${name}` : name, children: [], items };
    (parent?.children ?? roots).push(folder);
    folders.set(pathKey(path), folder);
    return folder;
  };
  for (const category of withAuthoredStoryCatalog(baseStoryHierarchy, entries.values()).categories) {
    const root = add(category.id, category.name);
    for (const part of category.parts) {
      const loose = part.chapters?.find(chapter => chapter.id === UNGROUPED_STORY_CHAPTER_ID)?.items;
      const folder = add(part.id, part.name, root, part.items ?? loose ?? []);
      for (const chapter of part.chapters ?? []) {
        if (chapter.id !== UNGROUPED_STORY_CHAPTER_ID) add(chapter.id, chapter.name, folder, chapter.items);
      }
    }
  }
  const original = entry.catalog;
  let selected: Folder | undefined;
  if (original) {
    let level = roots;
    for (const value of catalogPath(original)) {
      const match = level.find(node => node.id === value || node.name === value);
      if (!match) break;
      selected = match;
      level = match.children;
    }
  } else {
    selected = [...folders.values()].find(folder => folder.items.some(item => item.entryId === entry.id));
    for (let length = memory.path?.length ?? 0; !selected && length > 0; length--) {
      selected = folders.get(pathKey(memory.path!.slice(0, length)));
    }
  }
  const originalFolder = selected;
  const expanded = new Set(memory.expanded);
  const reveal = (folder?: Folder) => {
    for (let parent = folder?.parent; parent; parent = parent.parent) expanded.add(pathKey(parent.path));
  };
  reveal(selected);

  let query = '';
  let filter = '';
  let order = options.pendingOrder ?? String(original?.order ?? '');
  const canEditEntry = options.canEdit(entry);
  const stagedOrders = new Map<string, number | undefined>();
  const orderInputs = new Map<string, string>();
  const parseOrder = (text: string) => text.trim() ? readStructuredInput('number', text.trim()) : { ok: true as const, value: undefined };
  const initName = (id: string) => ctx.game.registry.inits.get(id)?.name || id;
  const scope = (row: StoryEntryDef) => row.availableInits?.length ? row.availableInits.map(initName).join(' / ') : '全 Init 可用';
  const initIds = new Set([...ctx.game.registry.inits.keys(), ctx.view.activeInit]);
  for (const row of entries.values()) for (const id of row.availableInits ?? []) initIds.add(id);
  const matches = (row: StoryEntryDef) => filter === '' || filter === 'all'
    ? filter === '' || !row.availableInits?.length
    : !row.availableInits?.length || row.availableInits.includes(filter === 'current' ? ctx.view.activeInit : filter.slice(5));
  const items = (folder: Folder) => folder.items.flatMap((item, index) => {
    const row = entries.get(item.entryId);
    if (!row || !matches(row)) return [];
    const current = row.id === entry.id;
    const parsed = current && canEditEntry ? parseOrder(order) : undefined;
    const explicit = parsed?.ok ? parsed.value as number | undefined
      : stagedOrders.has(row.id) ? stagedOrders.get(row.id) : row.catalog?.order;
    const auto = item.catalogAutoOrder ?? (index + 1) * STORY_CATALOG_ORDER_STEP;
    return [{ row, title: row.openingTitle || item.name || options.storyName(row.storyId) || row.id,
      explicit, effective: explicit ?? auto, canEdit: options.canEdit(row) && (current || Boolean(row.catalog)) }];
  }).sort((a, b) => a.effective - b.effective || a.row.id.localeCompare(b.row.id));
  const folderButton = (folder: Folder, content: string) => `<button type="button" class="mini-action" data-catalog-select="${escape(pathKey(folder.path))}" aria-pressed="${folder === selected}">${content}</button>`;
  const browse = (): string => {
    const needle = query.trim().toLowerCase();
    const contains = (value: string) => value.toLowerCase().includes(needle);
    if (needle) {
      const results: string[] = [];
      for (const folder of folders.values()) {
        if (contains(folder.trail) || contains(folder.id)) results.push(folderButton(folder, escape(folder.trail)));
        for (const { row, title } of items(folder)) {
          if ([title, row.id, row.storyId, options.storyName(row.storyId) ?? ''].some(contains)) {
            results.push(folderButton(folder, `<strong>${escape(title)}</strong><small>${escape(folder.trail)} · ${escape(row.id)}</small>`));
          }
        }
      }
      return results.length ? results.slice(0, 80).join('') + (results.length > 80 ? `<p>共 ${results.length} 项，已显示前 80 项。可缩小搜索范围。</p>` : '') : '<p>无匹配结果。</p>';
    }
    const counts = new Map<Folder, number>();
    const count = (folder: Folder): number => {
      const total = items(folder).length + folder.children.reduce((sum, child) => sum + count(child), 0);
      counts.set(folder, total);
      return total;
    };
    roots.forEach(count);
    const tree = (branches: Folder[]): string => `<ul>${branches.map(folder => {
      const key = pathKey(folder.path);
      const open = expanded.has(key);
      return `<li data-editor-key="catalog:${escape(key)}"><div class="story-catalog-row">
        ${folder.children.length ? `<button type="button" data-catalog-toggle="${escape(key)}" aria-label="${open ? '收起' : '展开'}${escape(folder.name)}" aria-expanded="${open}">${open ? '▾' : '▸'}</button>` : ''}
        ${folderButton(folder, `${escape(folder.name)} <small>${counts.get(folder)}</small>`)}
        </div>${open && folder.children.length ? tree(folder.children) : ''}</li>`;
    }).join('')}</ul>`;
    return tree(roots);
  };
  const destination = () => {
    const depth = selected?.path.length ?? 0;
    const siblings = depth > 1 ? items(selected!) : [];
    const next = ['分类', '篇章', '章节'][depth];
    return `<h3>${selected ? escape(selected.trail) : '选择目录位置'}</h3>
      <p>当前 Entry · ${escape(scope(entry))}</p>
      ${depth === 2 ? '<p>保存到此篇章，不分章。</p>' : ''}
      ${depth > 1 ? `${canEditEntry ? `<label>条目顺序<input data-catalog-order value="${escape(order)}" inputmode="decimal" placeholder="留空使用自动值"></label>` : '<p>当前 Entry 所属 Mod 未处于编辑态。</p>'}
        <h4>同级条目 · ${siblings.length}</h4>
        ${siblings.some(item => item.canEdit) ? `<p class="story-editor-hint">${filter ? '查看全部目录时可拖动排序。' : '拖动条目调整顺序。顺序值留空时使用自动值。'}</p>` : ''}
        ${siblings.length ? `<ul class="story-catalog-siblings">${siblings.map(({ row, title, explicit, effective, canEdit }) => `<li data-editor-key="catalog-entry:${escape(row.id)}" data-catalog-row="${escape(row.id)}">
          ${canEdit && !filter ? '<span data-catalog-drag draggable="true" title="拖动排序">⠿</span>' : ''}
          <div><strong>${escape(title)}${row.id === entry.id ? '（当前 Entry）' : ''}</strong><small>${escape(scope(row))} · ${explicit === undefined ? '自动 ' : '顺序 '}${effective}${canEdit ? '' : ' · 只读'}</small></div>
          ${canEdit && row.id !== entry.id ? `<label>顺序<input data-catalog-peer-order="${escape(row.id)}" value="${escape(orderInputs.get(row.id) ?? String(explicit ?? ''))}" inputmode="decimal" placeholder="自动"></label>` : ''}
        </li>`).join('')}</ul>` : '<p>当前筛选下无同级条目。</p>'}` : ''}
      <div class="story-editor-actions"><button type="button" class="mini-action" data-catalog-root>回到目录根</button>
        ${next && canEditEntry ? `<label>新${next}名称<input data-catalog-new-name></label><button type="button" class="mini-action" data-catalog-add>新建${next}</button>` : ''}
      </div>`;
  };
  const panel = openStoryEditorDialog(modal, {
    title: '编辑故事目录位置',
    panelClass: 'story-catalog-dialog',
    body: `<div class="story-catalog-tools"><label>搜索目录或 Entry<input type="search" data-catalog-search></label>
      <label>按 Init 浏览<select data-catalog-init><option value="">全部目录</option><option value="current">当前 Init · ${escape(initName(ctx.view.activeInit))}</option><option value="all">仅全 Init 可用</option>
      ${[...initIds].map(id => `<option value="init:${escape(id)}">${escape(initName(id))} · ${escape(id)}</option>`).join('')}</select></label></div>
      <div class="story-catalog-columns"><section data-catalog-browse aria-label="故事目录">${browse()}</section>
      <section data-catalog-destination aria-label="目标位置">${destination()}</section></div>`,
    footer: `<p class="story-editor-error condition-tree-error" data-catalog-error role="alert" hidden></p>
      ${original && canEditEntry ? '<button type="button" class="mini-action mini-action--danger" data-modal-action="remove-catalog">移除目录位置</button>' : ''}
      <button type="button" class="modal-close">取消</button><button type="button" class="primary-button" data-modal-action="save-catalog">${canEditEntry ? '确认位置' : '保存条目顺序'}</button>`,
    onClose: () => {
      memory.expanded = new Set([...expanded].filter(key => existing.has(key)));
      if (!query) memory.treeScroll = left.scrollTop;
      options.onClose();
    },
    onAction: action => {
      if (action !== 'save-catalog' && action !== 'remove-catalog') return;
      let catalog: StoryEntryCatalog | undefined = canEditEntry ? undefined : original;
      for (const [id, text] of orderInputs) {
        const parsed = parseOrder(text);
        if (!parsed.ok) {
          showError(parsed.message);
          return;
        }
        stagedOrders.set(id, parsed.value as number | undefined);
      }
      if (action === 'save-catalog' && canEditEntry) {
        if (!selected || selected.path.length < 2) {
          showError('请选择一个篇章或章节。');
          return;
        }
        const parsed = parseOrder(order);
        if (!parsed.ok) {
          showError(parsed.message);
          return;
        }
        const [category, part, chapter] = selected === originalFolder && original && selected.path.length === catalogPath(original).length
          ? catalogPath(original) : selected.path;
        catalog = { category, part, ...(chapter ? { chapter } : {}), ...(parsed.value !== undefined ? { order: parsed.value as number } : {}) };
      }
      const error = options.commit(catalog, stagedOrders);
      if (error) showError(error);
      else {
        if (catalog && selected) memory.path = [...selected.path];
        modal.close();
      }
    },
  }, trigger);
  const existing = new Set(folders.keys());
  const left = panel.querySelector<HTMLElement>('[data-catalog-browse]')!;
  const right = panel.querySelector<HTMLElement>('[data-catalog-destination]')!;
  const error = panel.querySelector<HTMLElement>('[data-catalog-error]')!;
  const search = panel.querySelector<HTMLInputElement>('[data-catalog-search]')!;
  const showError = (message = '') => {
    error.textContent = message;
    error.hidden = !message;
  };
  const patch = (region: HTMLElement, html: string) => {
    const next = region.cloneNode(false) as HTMLElement;
    next.innerHTML = html;
    patchEditorDOM(region, next, options.beforeRemove);
  };
  const refresh = () => {
    showError();
    patch(left, browse());
    patch(right, destination());
  };
  left.scrollTop = memory.treeScroll;
  left.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest' });
  panel.addEventListener('input', event => {
    if (event.target === search) {
      if (!query && search.value) memory.treeScroll = left.scrollTop;
      query = search.value;
      patch(left, browse());
      left.scrollTop = query ? 0 : memory.treeScroll;
    } else if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-catalog-order')) {
      order = event.target.value;
      showError();
    } else if (event.target instanceof HTMLInputElement && event.target.dataset.catalogPeerOrder) {
      orderInputs.set(event.target.dataset.catalogPeerOrder, event.target.value);
      showError();
    }
  });
  panel.addEventListener('change', event => {
    if (event.target instanceof HTMLSelectElement && event.target.hasAttribute('data-catalog-init')) {
      filter = event.target.value;
      refresh();
    } else if (event.target instanceof HTMLInputElement && event.target.dataset.catalogPeerOrder) {
      const parsed = parseOrder(event.target.value);
      if (!parsed.ok) showError(parsed.message);
      else {
        stagedOrders.set(event.target.dataset.catalogPeerOrder, parsed.value as number | undefined);
        patch(right, destination());
      }
    } else if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-catalog-order')) {
      patch(right, destination());
    }
  });
  panel.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    const { catalogToggle, catalogSelect } = button.dataset;
    if (catalogToggle !== undefined) {
      if (expanded.has(catalogToggle)) expanded.delete(catalogToggle);
      else expanded.add(catalogToggle);
      patch(left, browse());
      return;
    }
    if (catalogSelect !== undefined) selected = folders.get(catalogSelect);
    else if (button.hasAttribute('data-catalog-root')) selected = undefined;
    else if (button.hasAttribute('data-catalog-add')) {
      const input = right.querySelector<HTMLInputElement>('[data-catalog-new-name]');
      const name = input?.value.trim();
      if (!name) {
        showError('请输入目录名称。');
        input?.focus();
        return;
      }
      selected = (selected?.children ?? roots).find(folder => folder.name === name || folder.id === name)
        ?? add(`author-${encodeURIComponent(name)}`, name, selected);
      if (input) input.value = '';
    } else return;
    const fromSearch = Boolean(query);
    query = search.value = '';
    reveal(selected);
    refresh();
    right.scrollTop = 0;
    if (fromSearch) left.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest' });
  });
  let dragging: string | undefined;
  let marker: HTMLElement | undefined;
  const clearMarker = () => {
    marker?.classList.remove('is-insert-before', 'is-insert-after');
    marker = undefined;
  };
  const findDrop = (event: DragEvent) => {
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-catalog-row]') : null;
    if (!selected || filter || !dragging || !row || row.dataset.catalogRow === dragging) return;
    const box = row.getBoundingClientRect();
    return { row, after: event.clientY > box.top + box.height / 2 };
  };
  right.addEventListener('dragstart', event => {
    const handle = event.target instanceof Element ? event.target.closest('[data-catalog-drag]') : null;
    const row = handle?.closest<HTMLElement>('[data-catalog-row]')?.dataset.catalogRow;
    if (!row || !event.dataTransfer || filter) return;
    dragging = row;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-story-catalog-entry', row);
  });
  right.addEventListener('dragover', event => {
    clearMarker();
    const drop = findDrop(event);
    if (!drop) return;
    event.preventDefault();
    marker = drop.row;
    marker.classList.add(drop.after ? 'is-insert-after' : 'is-insert-before');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  right.addEventListener('dragleave', event => {
    if (!(event.relatedTarget instanceof Node) || !right.contains(event.relatedTarget)) clearMarker();
  });
  right.addEventListener('dragend', () => { dragging = undefined; clearMarker(); });
  right.addEventListener('drop', event => {
    const drop = findDrop(event);
    clearMarker();
    const id = dragging;
    dragging = undefined;
    if (!drop || !selected || !id || event.dataTransfer?.getData('application/x-story-catalog-entry') !== id) return;
    event.preventDefault();
    const siblings = items(selected);
    const from = siblings.findIndex(({ row }) => row.id === id);
    if (!siblings[from]?.canEdit) return;
    siblings.splice(from, 1);
    const to = siblings.findIndex(({ row }) => row.id === drop.row.dataset.catalogRow) + Number(drop.after);
    if (to === from) return;
    const before = siblings[to - 1]?.effective;
    const after = siblings[to]?.effective;
    const value = before === undefined ? after - STORY_CATALOG_ORDER_STEP
      : after === undefined ? before + STORY_CATALOG_ORDER_STEP : before / 2 + after / 2;
    if (!Number.isFinite(value) || before !== undefined && value <= before || after !== undefined && value >= after) {
      showError('相邻条目之间没有可用的排序值。请调整一个可编辑条目的顺序值，或拖到其他位置。');
      return;
    }
    if (id === entry.id) order = String(value);
    else {
      orderInputs.delete(id);
      stagedOrders.set(id, value);
    }
    showError();
    patch(right, destination());
  });
  return panel;
}
