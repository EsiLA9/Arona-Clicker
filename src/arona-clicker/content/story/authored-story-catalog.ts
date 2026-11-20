import type { StoryContentTable } from './story-hierarchy';
import type { StoryEntryDef } from '../../../data-services/contracts/story-entry';

export const UNGROUPED_STORY_CHAPTER_ID = 'author-ungrouped';
export const STORY_CATALOG_ORDER_STEP = 100;

/** Entry catalog is pack-owned: directory placement survives export without changing playback state. */
export function withAuthoredStoryCatalog(base: StoryContentTable, entries: Iterable<StoryEntryDef>, sourceOf?: (id: string) => string | undefined): StoryContentTable {
  const table = structuredClone(base);
  const placed = [...entries].filter(entry => entry.catalog);
  const originalRank = new Map(placed.map((entry, index) => [entry.id, index]));
  const orders = new Map(placed.map(entry => [entry.id, entry.catalog?.order]));
  const placedIds = new Set(placed.map(entry => entry.id));
  const authored = new Map<object, string | undefined>();
  for (const category of table.categories) for (const part of category.parts) {
    if (part.items) part.items = part.items.filter(item => !placedIds.has(item.entryId));
    for (const chapter of part.chapters ?? []) chapter.items = chapter.items.filter(item => !placedIds.has(item.entryId));
  }
  for (const entry of placed.sort((a,b)=>(a.catalog?.order ?? Number.MAX_SAFE_INTEGER)-(b.catalog?.order ?? Number.MAX_SAFE_INTEGER))) {
    const metadata = entry.catalog;
    if (!metadata) continue;
    const {category:categoryName,part:partName} = metadata;
    const chapterName = metadata.chapter === UNGROUPED_STORY_CHAPTER_ID ? undefined : metadata.chapter;
    const source = sourceOf?.(entry.id);
    const authoredId = (name: string) => source ? `author:${source}:${encodeURIComponent(name)}` : `author-${encodeURIComponent(name)}`;
    const matches = (node: { id: string; name: string }, value: string) => node.id === value
      || (node.name === value && (!authored.has(node) || authored.get(node) === source));
    let category = table.categories.find(x => matches(x, categoryName));
    if (!category) {
      category = { id: authoredId(categoryName), name: categoryName, parts: [] };
      authored.set(category, source);
      table.categories.push(category);
    }
    let part = category.parts.find(x => matches(x, partName));
    if (!part) {
      part = { id: authoredId(partName), name: partName, items: [] };
      authored.set(part, source);
      category.parts.push(part);
    }
    const item = { id: entry.id, entryId: entry.id, name: entry.openingTitle, replayable: entry.replayable };
    if (chapterName || part.chapters) {
      part.chapters ??= [];
      if (part.items?.length) {
        const ungrouped = part.chapters.find(x => x.id === UNGROUPED_STORY_CHAPTER_ID);
        if (ungrouped) ungrouped.items.unshift(...part.items);
        else part.chapters.unshift({ id: UNGROUPED_STORY_CHAPTER_ID, name: '未分章', items: part.items });
        delete part.items;
      }
      let chapter = chapterName
        ? part.chapters.find(x => x.id !== UNGROUPED_STORY_CHAPTER_ID && matches(x, chapterName))
        : part.chapters.find(x => x.id === UNGROUPED_STORY_CHAPTER_ID);
      if (!chapter) {
        const id = chapterName === 'ungrouped' && !source ? 'author:chapter:ungrouped'
          : chapterName ? authoredId(chapterName) : UNGROUPED_STORY_CHAPTER_ID;
        chapter = { id, name: chapterName || '未分章', items: [] };
        if (chapterName) authored.set(chapter, source);
        part.chapters.push(chapter);
      }
      chapter.items.push(item);
    } else { part.items ??= []; part.items.push(item); }
  }
  for (const category of table.categories) for (const part of category.parts) {
    for (const siblings of [part.items, ...part.chapters?.map(chapter => chapter.items) ?? []]) {
      if (!siblings) continue;
      siblings.sort((a, b) => (originalRank.get(a.entryId) ?? -1) - (originalRank.get(b.entryId) ?? -1));
      siblings.forEach((item, index) => { item.catalogAutoOrder = (index + 1) * STORY_CATALOG_ORDER_STEP; });
      siblings.sort((a, b) => (orders.get(a.entryId) ?? a.catalogAutoOrder!) - (orders.get(b.entryId) ?? b.catalogAutoOrder!)
        || a.entryId.localeCompare(b.entryId));
    }
  }
  return table;
}
