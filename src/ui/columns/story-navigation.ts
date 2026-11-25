import type { StoryDirectoryEntry, StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { UIContext } from '../runtime/context';
import { getStoryReveal } from '../components/tooltip/tooltip';
import { renderStoryDescription, renderStoryDirectoryDetails } from '../components/story/story-directory-details';

export function storyDirectoryTrail(roots: readonly StoryDirectoryNode[], path: readonly string[]): StoryDirectoryNode[] {
  const trail: StoryDirectoryNode[] = [];
  let siblings = roots;
  for (const id of path) {
    const node = siblings.find(folder => folder.id === id);
    if (!node) break;
    trail.push(node);
    siblings = node.children;
  }
  if (trail.length < path.length) {
    const find = (nodes: readonly StoryDirectoryNode[], id: string): StoryDirectoryNode[] | undefined => {
      for (const node of nodes) {
        if (node.id === id) return [node];
        const child = find(node.children, id);
        if (child) return [node, ...child];
      }
    };
    for (let depth = path.length - 1; depth >= trail.length; depth--) {
      const moved = find(roots, path[depth]);
      if (moved) return moved;
    }
  }
  return trail;
}

export function renderStoryDirectoryOverview(ctx: UIContext, node?: StoryDirectoryNode): string {
  if (node) return renderStoryDirectoryDetails(ctx, {
    title: node.title, description: node.definition?.description, coverPicId: node.definition?.coverPicId,
    theme: node.definition?.themeDesignId ? ctx.game.registry.themeDesigns.get(node.definition.themeDesignId) : undefined,
    read: node.read ?? 0, completed: node.completed ?? 0,
  });
  const init = ctx.game.registry.inits.get(ctx.view.activeInit);
  return init?.description ? renderStoryDirectoryDetails(ctx, { title: init.name, description: init.description })
    : '<div class="workspace-placeholder"><p>选择左侧目录浏览故事与阅读记录。</p></div>';
}

function entryDetails(ctx: UIContext, row: StoryDirectoryEntry) {
  const registry = ctx.game.registry;
  const entry = registry.storyEntries.get(row.id);
  const story = entry && registry.stories.get(entry.storyId);
  const status = row.progress === 'completed' ? '已完成' : row.progress === 'read' ? '已阅读' : '正文已完成';
  if (row.historical || !entry || !story) return { name: row.title ?? '故事记录', status: status + ' · 内容未载入' };
  if (!getStoryReveal(ctx, entry).nameKnown) return { name: '???', status };
  const owner = registry.storyDirectoryContentOwner(entry.id);
  return {
    name: row.legacy?.name ?? entry.openingTitle ?? story.name, status,
    description: entry.publicDescription?.trim() || (owner && owner === registry.storyDirectoryContentOwner(story.id, 'story') ? story.publicDescription : undefined),
  };
}

export function renderStoryDirectoryEntryDetails(ctx: UIContext, row: StoryDirectoryEntry, node?: StoryDirectoryNode): string {
  const details = entryDetails(ctx, row);
  const theme = node?.definition?.themeDesignId;
  return `${renderStoryDirectoryDetails(ctx, { title: details.name, description: details.description,
    theme: theme ? ctx.game.registry.themeDesigns.get(theme) : undefined })}<p>${ctx.escapeHtml(details.status)}</p>`;
}

export function renderStoryNavigation(ctx: UIContext, path: string[], roots = ctx.game.story.getStoryDirectory(), selectedEntryId?: string): string {
  const trail = storyDirectoryTrail(roots, path);
  const current = trail.at(-1);
  const crumbs = ['故事', ...trail.map(node => node.title)].map((title, depth) => depth === trail.length
    ? `<span class="story-crumb current">${ctx.escapeHtml(title)}</span>`
    : `<button type="button" class="story-crumb" data-story-back="${depth}">${ctx.escapeHtml(title)}</button>`);
  const folderRows = (current?.children ?? roots).map(folder => {
    const route = [...trail.map(node => node.id), folder.id].map(encodeURIComponent).join(':');
    return `<button type="button" class="nav-item story-nav-btn" data-story-nav="${ctx.escapeHtml(route)}">
      <span class="nav-marker"></span><span>${ctx.escapeHtml(folder.title)}${renderStoryDescription(ctx, folder.definition?.description, true)}</span>
      <small>已读 ${folder.read ?? 0} · 完成 ${folder.completed ?? 0}</small>
    </button>`;
  }).join('');
  const entryRows = (current?.entries ?? []).map(row => {
    const { name, status, description } = entryDetails(ctx, row);
    const running = !row.historical && ctx.view.currentStory?.storyId === row.id;
    const button = !running && row.canReplay && !row.historical
      ? `<button type="button" data-replay-story="${ctx.escapeHtml(row.id)}" class="story-trigger">重读</button>` : '';
    return `<div class="nav-item story-entry${running ? ' active' : ''}">
      <span class="nav-marker"></span><div class="story-entry-body">
        <button type="button" class="story-name mini-action" data-story-directory-entry="${ctx.escapeHtml(row.id)}" aria-pressed="${selectedEntryId === row.id}">${ctx.escapeHtml(name)}</button>
        ${renderStoryDescription(ctx, description, true)}
        <small class="${running ? 'story-active' : 'story-done'}">${running ? '● 播放中' : status}</small>
        ${button}
      </div>
    </div>`;
  }).join('');
  const archive = current ? '' : '<button type="button" class="nav-item story-nav-btn" data-story-archive="1"><span class="nav-marker"></span><span>档案</span><small>记录</small></button>';
  const empty = !folderRows && !entryRows
    ? `<div class="nav-item"><span class="nav-marker"></span><span>${current ? '暂无公开故事' : '当前世界线暂无故事'}</span></div>` : '';
  return `<div class="story-breadcrumb">${crumbs.join('<span class="story-crumb-sep">/</span>')}</div>
    <div class="story-nav-body">${folderRows}${entryRows}${empty}${archive}</div>`;
}
