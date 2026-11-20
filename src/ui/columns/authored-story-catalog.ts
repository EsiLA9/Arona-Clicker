import type { StoryContentTable } from '../../arona-clicker/content/story/story-hierarchy';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';

export const UNGROUPED_STORY_CHAPTER_ID = 'author-ungrouped';
export const STORY_CATALOG_ORDER_STEP = 100;

/** Entry catalog is pack-owned: directory placement survives export without changing playback state. */
export function withAuthoredStoryCatalog(base: StoryContentTable, entries: Iterable<StoryEntryDef>): StoryContentTable {
  const table = structuredClone(base);
  const placed = [...entries].filter(entry => entry.catalog);
  const originalRank = new Map(placed.map((entry, index) => [entry.id, index]));
  const orders = new Map(placed.map(entry => [entry.id, entry.catalog?.order]));
  const placedIds = new Set(placed.map(entry => entry.id));
  for (const category of table.categories) for (const part of category.parts) {
    if (part.items) part.items = part.items.filter(item => !placedIds.has(item.entryId));
    for (const chapter of part.chapters ?? []) chapter.items = chapter.items.filter(item => !placedIds.has(item.entryId));
  }
  for (const entry of placed.sort((a,b)=>(a.catalog?.order ?? Number.MAX_SAFE_INTEGER)-(b.catalog?.order ?? Number.MAX_SAFE_INTEGER))) {
    const metadata = entry.catalog;
    if (!metadata) continue;
    const {category:categoryName,part:partName} = metadata;
    const chapterName = metadata.chapter === UNGROUPED_STORY_CHAPTER_ID ? undefined : metadata.chapter;
    let category = table.categories.find(x => x.id === categoryName || x.name === categoryName);
    if (!category) { category = { id: `author-${encodeURIComponent(categoryName)}`, name: categoryName, parts: [] }; table.categories.push(category); }
    let part = category.parts.find(x => x.id === partName || x.name === partName);
    if (!part) { part = { id: `author-${encodeURIComponent(partName)}`, name: partName, items: [] }; category.parts.push(part); }
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
        ? part.chapters.find(x => x.id !== UNGROUPED_STORY_CHAPTER_ID && (x.id === chapterName || x.name === chapterName))
        : part.chapters.find(x => x.id === UNGROUPED_STORY_CHAPTER_ID);
      if (!chapter) {
        const id = chapterName === 'ungrouped' ? 'author:chapter:ungrouped'
          : chapterName ? `author-${encodeURIComponent(chapterName)}` : UNGROUPED_STORY_CHAPTER_ID;
        chapter = { id, name: chapterName || '未分章', items: [] };
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
