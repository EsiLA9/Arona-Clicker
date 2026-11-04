import type { StoryContentTable } from '../../arona-clicker/content/story/story-hierarchy';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';

/** Entry Extra is pack-owned: directory placement survives export without changing playback state. */
export function withAuthoredStoryCatalog(base: StoryContentTable, entries: Iterable<StoryEntryDef>): StoryContentTable {
  const table = structuredClone(base);
  for (const entry of entries) {
    const metadata = entry.extra?.v.storyCatalog;
    if (metadata?.t !== 'dict') continue;
    const text = (name: string) => { const v = metadata.v[name]; return v?.t === 'str' ? v.v.trim() : ''; };
    const categoryName = text('category'), partName = text('part'), chapterName = text('chapter');
    if (!categoryName || !partName) continue;
    for (const category of table.categories) for (const part of category.parts) {
      if (part.items) part.items = part.items.filter(x => x.entryId !== entry.id);
      for (const chapter of part.chapters ?? []) chapter.items = chapter.items.filter(x => x.entryId !== entry.id);
    }
    let category = table.categories.find(x => x.id === categoryName || x.name === categoryName);
    if (!category) { category = { id: `author-${encodeURIComponent(categoryName)}`, name: categoryName, parts: [] }; table.categories.push(category); }
    let part = category.parts.find(x => x.id === partName || x.name === partName);
    if (!part) { part = { id: `author-${encodeURIComponent(partName)}`, name: partName, items: [] }; category.parts.push(part); }
    const item = { id: entry.id, entryId: entry.id, name: entry.openingTitle, replayable: entry.replayable };
    if (chapterName || part.chapters) {
      part.chapters ??= [];
      if (part.items?.length) { part.chapters.unshift({ id: 'author-ungrouped', name: '未分章', items: part.items }); delete part.items; }
      let chapter = part.chapters.find(x => x.id === chapterName || x.name === (chapterName || '未分章'));
      if (!chapter) { chapter = { id: `author-${encodeURIComponent(chapterName)}`, name: chapterName || '未分章', items: [] }; part.chapters.push(chapter); }
      chapter.items.push(item);
    } else { part.items ??= []; part.items.push(item); }
  }
  return table;
}
