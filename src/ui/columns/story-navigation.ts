import type { UIContext } from '../runtime/context';
import { getStoryReveal } from '../components/tooltip/tooltip';
import {
  baseStoryHierarchy,
  StoryContentTable,
  StoryContentCategoryDef,
  StoryContentPartDef,
  StoryContentChapterDef,
  StoryContentItem,
} from '../../arona-clicker/content/story/story-hierarchy';

/** StoryWorkspace 与 Game 旧左栏共用故事导航内容，但不共用 Workspace 身份。 */
export function renderStoryNavigation(ctx: UIContext, path: string[]): string {
  const hierarchy = baseStoryHierarchy;
  return `
    ${renderStoryBreadcrumb(ctx, hierarchy, path)}
    <div class="story-nav-body">${renderStoryLevel(ctx, hierarchy, path)}</div>`;
}

/** 面包屑导航：点击任一级返回对应深度（0 = 分类页）。 */
function renderStoryBreadcrumb(ctx: UIContext, h: StoryContentTable, path: string[]): string {
  const crumbs: { label: string; depth: number; current: boolean }[] = [{ label: '故事', depth: 0, current: path.length === 0 }];
  if (path.length >= 1) {
    const cat = h.categories.find(c => c.id === path[0]);
    if (cat) crumbs.push({ label: cat.name, depth: 1, current: path.length === 1 });
  }
  if (path.length >= 2) {
    const part = h.categories.find(c => c.id === path[0])?.parts.find(p => p.id === path[1]);
    if (part) crumbs.push({ label: part.name, depth: 2, current: path.length === 2 });
  }
  if (path.length >= 3) {
    const ch = h.categories.find(c => c.id === path[0])?.parts.find(p => p.id === path[1])?.chapters?.find(ch => ch.id === path[2]);
    if (ch) crumbs.push({ label: ch.name, depth: 3, current: true });
  }
  const items = crumbs.map((c, i) => {
    const sep = i > 0 ? '<span class="story-crumb-sep">/</span>' : '';
    const btn = c.current
      ? `<span class="story-crumb current">${ctx.escapeHtml(c.label)}</span>`
      : `<button class="story-crumb" data-story-back="${c.depth}">${ctx.escapeHtml(c.label)}</button>`;
    return `${sep}${btn}`;
  }).join('');
  return `<div class="story-breadcrumb">${items}</div>`;
}

/** 按导航路径渲染对应层级内容。 */
function renderStoryLevel(ctx: UIContext, h: StoryContentTable, path: string[]): string {
  // 层级 1：分类选择（仅显示当前 init 有可用项的的分类）
  if (path.length === 0) {
    const cats = h.categories
      .filter(cat => countItemsInCategory(ctx, cat) > 0)
      .map(cat => {
        const count = countItemsInCategory(ctx, cat);
        return `
        <button class="nav-item story-nav-btn" data-story-nav="${cat.id}">
          <span class="nav-marker"></span><span>${ctx.escapeHtml(cat.name)}</span><small>${count} 项</small>
        </button>`;
      }).join('');
    const archive = `
      <button class="nav-item story-nav-btn" data-story-archive="1">
        <span class="nav-marker"></span><span>档案</span><small>记录</small>
      </button>`;
    const catsBody = cats || '<div class="nav-item"><span class="nav-marker"></span><span>当前世界线暂无故事</span></div>';
    return `${catsBody}${archive}`;
  }

  const cat = h.categories.find(c => c.id === path[0]);
  if (!cat) return '<div class="nav-item"><span class="nav-marker"></span><span>未知分类</span></div>';

  // 层级 2：篇选择（仅显示当前 init 可用的篇）
  if (path.length === 1) {
    const parts = cat.parts
      .filter(part => countItemsInPart(ctx, part) > 0)
      .map(part => {
        const count = countItemsInPart(ctx, part);
        const label = part.chapters ? `${part.name} · ${part.chapters.length} 章` : part.name;
        return `
        <button class="nav-item story-nav-btn" data-story-nav="${cat.id}:${part.id}">
          <span class="nav-marker"></span><span>${ctx.escapeHtml(label)}</span><small>${count} 项</small>
        </button>`;
      }).join('');
    return parts || '<div class="nav-item"><span class="nav-marker"></span><span>暂无篇目</span></div>';
  }

  const part = cat.parts.find(p => p.id === path[1]);
  if (!part) return '<div class="nav-item"><span class="nav-marker"></span><span>未知篇目</span></div>';

  // 层级 3：章选择（仅主线故事有章层级，仅显示当前 init 可用的章）
  if (path.length === 2 && part.chapters) {
    const chapters = part.chapters
      .filter(ch => availableItemsInChapter(ctx, ch).length > 0)
      .map(ch => {
        const count = availableItemsInChapter(ctx, ch).length;
        return `
        <button class="nav-item story-nav-btn" data-story-nav="${cat.id}:${part.id}:${ch.id}">
          <span class="nav-marker"></span><span>${ctx.escapeHtml(ch.name)}</span><small>${count} 项</small>
        </button>`;
      }).join('');
    return chapters || '<div class="nav-item"><span class="nav-marker"></span><span>暂无章节</span></div>';
  }

  // 层级 4 / 末级：故事小项列表
  return resolveItemsAt(ctx, h, path);
}

/** 统计分类下的故事项总数。 */
function countItemsInCategory(ctx: UIContext, cat: StoryContentCategoryDef): number {
  return cat.parts.reduce((sum, p) => sum + availableItemsInPart(ctx, p).length, 0);
}

/** 统计篇下的故事项总数（章展开）。 */
function countItemsInPart(ctx: UIContext, part: StoryContentPartDef): number {
  return availableItemsInPart(ctx, part).length;
}

/** 当前 init 下可用的故事项（章内可用项）。 */
function availableItemsInChapter(ctx: UIContext, ch: StoryContentChapterDef): StoryContentItem[] {
  return ch.items.filter(item => isEntryAvailable(ctx, item.entryId));
}

/** 当前 init 下可用的篇内故事项（章展开合计）。 */
function availableItemsInPart(ctx: UIContext, part: StoryContentPartDef): StoryContentItem[] {
  if (part.chapters) return part.chapters.flatMap(ch => availableItemsInChapter(ctx, ch));
  return (part.items ?? []).filter(item => isEntryAvailable(ctx, item.entryId));
}

/** 该 StoryEntry 是否归属于当前 init（availableInits 为空 = 所有 init 可用）。 */
function isEntryAvailable(ctx: UIContext, entryId: string): boolean {
  const entry = ctx.game.registry.activeStories.get(entryId);
  if (!entry) return false;
  if (entry.availableInits.length > 0 && !entry.availableInits.includes(ctx.view.activeInit)) return false;
  return ctx.view.storyLog.some(record => record.storyId === entry.storyId);
}

/** 解析当前路径下应展示的故事条目 HTML。 */
function resolveItemsAt(ctx: UIContext, h: StoryContentTable, path: string[]): string {
  const { game, view } = ctx;
  let items: StoryContentItem[] = [];
  const cat = h.categories.find(c => c.id === path[0]);
  const part = cat?.parts.find(p => p.id === path[1]);
  if (path.length >= 3 && part?.chapters) {
    const ch = part.chapters.find(ch => ch.id === path[2]);
    items = ch ? availableItemsInChapter(ctx, ch) : [];
  } else if (part) {
    items = availableItemsInPart(ctx, part);
  }

  const activeStoryId = view.currentStory?.storyId ?? null;

  const rows = items.map(item => {
    const entry = game.registry.activeStories.get(item.entryId);
    if (!entry) return '';
    const story = game.registry.stories.get(entry.storyId);
    if (!story) return '';
    const isRunning = activeStoryId === item.entryId;
    // 重读策略：内容项显式声明优先，否则回退 entry.replayable
    const replayable = item.replayable ?? entry.replayable === true;

    const status = isRunning
      ? '<small class="story-active">● 重读中</small>'
      : '<small class="story-done">✓ 已完成</small>';
    const button = replayable && !isRunning
      ? `<button data-replay-story="${item.entryId}" class="story-trigger">重读</button>`
      : '';

    const name = getStoryReveal(ctx, entry).nameKnown ? (item.name ?? story.name) : '???';
    return `
      <div class="nav-item story-entry ${isRunning ? 'active' : ''}">
        <span class="nav-marker"></span>
        <div class="story-entry-body">
          <span class="story-name">${ctx.escapeHtml(name)}</span>
          ${status}
          ${button}
        </div>
      </div>`;
  }).join('');

  if (!rows) return '<div class="nav-item"><span class="nav-marker"></span><span>暂无故事</span><small>—</small></div>';
  return rows;
}
