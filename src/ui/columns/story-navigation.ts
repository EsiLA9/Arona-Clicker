import type { StoryDirectoryNode } from '../../arona-clicker/content/story/story-directory';
import type { UIContext } from '../runtime/context';
import { getStoryReveal } from '../components/tooltip/tooltip';

export function storyDirectoryTrail(roots: readonly StoryDirectoryNode[], path: readonly string[]): StoryDirectoryNode[] {
  const trail: StoryDirectoryNode[] = [];
  let siblings = roots;
  for (const id of path) {
    const node = siblings.find(folder => folder.id === id);
    if (!node) break;
    trail.push(node);
    siblings = node.children;
  }
  return trail;
}

export function renderStoryDirectoryOverview(ctx: UIContext, node?: StoryDirectoryNode): string {
  if (!node) return '<div class="workspace-placeholder"><p>选择左侧目录浏览故事与阅读记录。</p></div>';
  const cover = ctx.game.pics.urlOf(node.definition?.coverPicId);
  return `<section class="story-directory-overview">
    ${cover ? `<img class="story-directory-cover" src="${ctx.escapeHtml(cover)}" alt="">` : ''}
    <h2>${ctx.escapeHtml(node.title)}</h2>
    ${node.definition?.description ? `<p>${ctx.escapeHtml(node.definition.description)}</p>` : ''}
    <small>已读 ${node.read ?? 0} · 已完成 ${node.completed ?? 0}</small>
  </section>`;
}

export function renderStoryNavigation(ctx: UIContext, path: string[], roots = ctx.game.story.getStoryDirectory()): string {
  const trail = storyDirectoryTrail(roots, path);
  const current = trail.at(-1);
  const crumbs = ['故事', ...trail.map(node => node.title)].map((title, depth) => depth === trail.length
    ? `<span class="story-crumb current">${ctx.escapeHtml(title)}</span>`
    : `<button type="button" class="story-crumb" data-story-back="${depth}">${ctx.escapeHtml(title)}</button>`);
  const folderRows = (current?.children ?? roots).map(folder => {
    const route = [...trail.map(node => node.id), folder.id].map(encodeURIComponent).join(':');
    return `<button type="button" class="nav-item story-nav-btn" data-story-nav="${ctx.escapeHtml(route)}">
      <span class="nav-marker"></span><span>${ctx.escapeHtml(folder.title)}</span>
      <small>已读 ${folder.read ?? 0} · 完成 ${folder.completed ?? 0}</small>
    </button>`;
  }).join('');
  const entries = ctx.game.registry.storyEntries;
  const entryRows = (current?.entries ?? []).map(row => {
    const entry = entries.get(row.id);
    const story = entry && ctx.game.registry.stories.get(entry.storyId);
    const name = row.historical || !entry || !story ? row.title ?? '故事记录'
      : getStoryReveal(ctx, entry).nameKnown ? row.legacy?.name ?? entry.openingTitle ?? story.name : row.title ?? '???';
    const running = !row.historical && ctx.view.currentStory?.storyId === row.id;
    const status = running ? '● 播放中' : row.progress === 'completed' ? '已完成' : row.progress === 'read' ? '已阅读' : '正文已完成';
    const button = !running && row.canReplay && !row.historical
      ? `<button type="button" data-replay-story="${ctx.escapeHtml(row.id)}" class="story-trigger">重读</button>` : '';
    return `<div class="nav-item story-entry${running ? ' active' : ''}">
      <span class="nav-marker"></span><div class="story-entry-body">
        <span class="story-name">${ctx.escapeHtml(name)}</span>
        <small class="${running ? 'story-active' : 'story-done'}">${status}${row.historical ? ' · 内容未载入' : ''}</small>
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
