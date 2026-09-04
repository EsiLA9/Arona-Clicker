import { UIContext } from '../context';
import { renderTabs, TabDef } from './tabs';
import { getAreaReveal, getStoryReveal, describeCondition } from './tooltip';
import { renderContactsTab } from './contacts';
import type { ActiveStoryEntry } from '../../data-services/contracts/story-entry';
import type { StoryDef } from '../../data-services/contracts/story';
import type { PanelState } from './app-shell';
import { renderBackground } from '../background-service';
import {
  baseStoryHierarchy,
  StoryContentTable,
  StoryContentCategoryDef,
  StoryContentPartDef,
  StoryContentChapterDef,
  StoryContentItem,
} from '../../arona-clicker/content/story-hierarchy';

const LEFT_TABS: TabDef[] = [
  { id: 'area', label: '区域' },
  { id: 'contacts', label: '通讯录' },
  { id: 'story', label: '故事' },
];

export function renderLeftPanel(ctx: UIContext, panelState: PanelState): string {
  const { leftTab: activeTab, selectedVariantId } = panelState;
  let body: string;
  let tab: string;
  switch (activeTab) {
    case 'story': body = renderStoryTab(ctx, panelState); tab = 'story'; break;
    case 'contacts': body = renderContactsTab(ctx, selectedVariantId, panelState.studentChats, panelState.getUnread); tab = 'contacts'; break;
    default: body = renderAreaTab(ctx); tab = 'area'; break;
  }
  return `
    <aside class="ui-cluster ui-cluster--left-panel panel left-panel" data-theme-scope="left">
      ${renderBackground(ctx.backgroundForHost('leftPanel'), 'console-panel-background')}
      ${renderTabs(ctx, 'left', LEFT_TABS, tab)}
      <div class="ui-cluster ui-cluster--left-${tab} panel-body" data-theme-scope="left.${tab}">${body}</div>
    </aside>`;
}

function renderAreaTab(ctx: UIContext): string {
  const { game, view } = ctx;
  const init = game.world.inits.get(view.activeInit);
  const currentAreaId = view.currentAreaId;
  const currentArea = currentAreaId ? game.world.areas.get(currentAreaId) : undefined;
  const initName = init?.name ?? '未进入';
  const areaName = currentArea?.name ?? '—';

  // hero 横幅
  const hero = `
    <div class="area-hero">
      <h2>${ctx.escapeHtml(areaName)}</h2>
      <p>${ctx.escapeHtml(currentArea?.description ?? init?.description ?? '')}</p>
    </div>`;

  // 可前往区域 = 严格按当前 Area 的可达性（相邻区域）
  const adjacent = currentArea?.adjacentAreaIds ?? [];
  // 非 passive 剧情演出进行中禁止移动（演出锁定）
  const storyLocked = view.currentStory !== null && view.currentStory.type !== 'passive';
  const reachableRows = adjacent.map(areaId => {
    const area = game.world.areas.get(areaId);
    const spotCount = game.world.spotsOfArea(areaId).length;
    const visible = view.visibility.areas[areaId] ?? false;
    if (!area) return '';
    const reveal = getAreaReveal(ctx, area);
    const name = reveal.nameKnown ? area.name : '未知区域';
    const isLocked = !visible || storyLocked;
    // 不用 disabled（会阻断 mouseenter，导致 hover tooltip 失效），
    // 改用 aria-disabled + is-locked 类；点击由 controller 拦截。
    const marker = isLocked ? '<span class="nav-lock">🔒</span>' : '<span class="nav-marker"></span>';
    const state = storyLocked
      ? '<small>演出中</small>'
      : isLocked
        ? '<small>LOCKED</small>'
        : `<small>${spotCount} SPOT</small>`;
    return `
      <button class="nav-item area-nav hover-wrap ${isLocked ? 'is-locked' : ''}" data-area="${areaId}" data-tooltip="area:${areaId}" aria-disabled="${isLocked}" ${isLocked ? 'data-locked' : ''}>
        ${marker}<span>${ctx.escapeHtml(name)}</span>${state}
      </button>`;
  }).join('');

  const currentSpotCount = currentArea ? game.world.spotsOfArea(currentArea.id).length : 0;
  const currentOwned = currentArea
    ? game.world.spotsOfArea(currentArea.id).filter(id => (view.spotLevels[id] ?? 0) > 0).length
    : 0;
  const currentRow = currentArea
    ? `
      <button class="nav-item area-nav active hover-wrap" data-tooltip="area:${currentArea.id}" aria-disabled="true">
        <span class="nav-marker"></span><span>${ctx.escapeHtml(currentArea.name)}</span><small>${currentOwned}/${currentSpotCount} 启用</small>
      </button>`
    : '<div class="nav-item"><span class="nav-marker"></span><span>未进入</span><small>—</small></div>';

  return `
    ${hero}
    <div class="nav-sub">当前位置</div>
    ${currentRow}
    <div class="nav-sub">可前往区域</div>
    ${reachableRows || '<div class="nav-item"><span class="nav-marker"></span><span>无可达区域</span><small>—</small></div>'}
    <div class="rail-note"><span class="eyebrow">SYSTEM NOTE</span><p>${storyLocked ? '剧情演出中，暂不可移动区域。' : '点击可前往的区域即可移动；锁定区域需满足条件后才会开放。'}</p></div>`;
}

function renderStoryTab(ctx: UIContext, panelState: PanelState): string {
  const hierarchy = baseStoryHierarchy;
  const path = panelState.storyNavPath;
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
  return true;
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

  const hasActiveStory = view.currentStory !== null && view.currentStory.type === 'active';
  const activeStoryId = view.currentStory?.storyId ?? null;

  const rows = items.map(item => {
    const entry = game.registry.activeStories.get(item.entryId);
    if (!entry) return '';
    const story = game.registry.stories.get(entry.storyId);
    if (!story) return '';
    const reveal = getStoryReveal(ctx, entry);
    const completed = view.storyLog.some(s => s.storyId === story.id);
    const isRunning = activeStoryId === item.entryId;
    const storyLocked = hasActiveStory && !isRunning;
    // 重读策略：内容项显式声明优先，否则回退 entry.replayable
    const replayable = item.replayable ?? entry.replayable === true;

    let status: string;
    let button = '';
    if (completed) {
      status = '<small class="story-done">✓ 已完成</small>';
      if (replayable && !isRunning) {
        button = `<button data-replay-story="${item.entryId}" class="story-trigger">重读</button>`;
      }
    } else if (isRunning) {
      status = '<small class="story-active">● 进行中</small>';
    } else if (storyLocked) {
      status = '<small class="story-locked">🔒 演出中</small>';
    } else if (reveal.stage === 'owned') {
      status = '<small class="story-done">✓ 已完成</small>';
    } else if (reveal.conditionKnown) {
      const condText = entry.triggerCondition
        ? describeCondition(entry.triggerCondition, ctx.nameOf)
        : '无条件';
      status = `<small class="story-cond">${ctx.escapeHtml(condText)}</small>`;
      if (reveal.stage === 'purchaseable') {
        button = `<button data-start-story="${item.entryId}" class="story-trigger">进入故事</button>`;
      } else {
        button = '<small class="story-locked">条件不足</small>';
      }
    } else {
      status = '<small class="story-locked">条件未知</small>';
    }

    const name = reveal.nameKnown ? (item.name ?? story.name) : '???';
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
