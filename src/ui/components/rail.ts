import { UIContext } from '../context';
import { renderTabs, TabDef } from './tabs';
import { getAreaReveal, getInitReveal, getStoryReveal, describeCondition } from './tooltip';

const LEFT_TABS: TabDef[] = [
  { id: 'area', label: '区域' },
  { id: 'story', label: '故事' },
  { id: 'init', label: '世界线' },
];

export function renderLeftPanel(ctx: UIContext, activeTab: string): string {
  let body: string;
  let tab: string;
  switch (activeTab) {
    case 'init': body = renderInitTab(ctx); tab = 'init'; break;
    case 'story': body = renderStoryTab(ctx); tab = 'story'; break;
    default: body = renderAreaTab(ctx); tab = 'area'; break;
  }
  return `
    <aside class="panel left-panel">
      ${renderTabs(ctx, 'left', LEFT_TABS, tab)}
      <div class="panel-body">${body}</div>
    </aside>`;
}

function renderAreaTab(ctx: UIContext): string {
  const { game, view } = ctx;
  const init = game.registry.inits.get(view.activeInit);
  const currentAreaId = view.currentAreaId;
  const currentArea = currentAreaId ? game.registry.areas.get(currentAreaId) : undefined;
  const initName = init?.name ?? '未进入';
  const areaName = currentArea?.name ?? '—';

  // hero 横幅
  const hero = `
    <div class="area-hero">
      <span class="eyebrow">CURRENT AREA</span>
      <h2>${ctx.escapeHtml(areaName)}</h2>
      <p>${ctx.escapeHtml(currentArea?.description ?? init?.description ?? '')}</p>
      <small class="hero-worldline">WORLDLINE：${ctx.escapeHtml(initName)}</small>
    </div>`;

  // 可前往区域 = 严格按当前 Area 的可达性（相邻区域）
  const adjacent = currentArea?.adjacentAreaIds ?? [];
  // 非 passive 剧情演出进行中禁止移动（演出锁定）
  const storyLocked = view.currentStory !== null && view.currentStory.type !== 'passive';
  const reachableRows = adjacent.map(areaId => {
    const area = game.registry.areas.get(areaId);
    const spotCount = game.registry.spotsOfArea(areaId).length;
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

  const currentSpotCount = currentArea ? game.registry.spotsOfArea(currentArea.id).length : 0;
  const currentOwned = currentArea
    ? game.registry.spotsOfArea(currentArea.id).filter(id => (view.spotLevels[id] ?? 0) > 0).length
    : 0;
  const currentRow = currentArea
    ? `
      <button class="nav-item area-nav active hover-wrap" data-tooltip="area:${currentArea.id}" aria-disabled="true">
        <span class="nav-marker"></span><span>${ctx.escapeHtml(currentArea.name)}</span><small>${currentOwned}/${currentSpotCount} 启用</small>
      </button>`
    : '<div class="nav-item"><span class="nav-marker"></span><span>未进入</span><small>—</small></div>';

  return `
    ${hero}
    <div class="panel-heading"><span class="eyebrow">NAVIGATION</span><span class="index">01</span></div>
    <div class="nav-sub">当前位置</div>
    ${currentRow}
    <div class="nav-sub">可前往区域</div>
    ${reachableRows || '<div class="nav-item"><span class="nav-marker"></span><span>无可达区域</span><small>—</small></div>'}
    <div class="rail-note"><span class="eyebrow">SYSTEM NOTE</span><p>${storyLocked ? '剧情演出中，暂不可移动区域。' : '点击可前往的区域即可移动；锁定区域需满足条件后才会开放。'}</p></div>`;
}

function renderInitTab(ctx: UIContext): string {
  const { game, view } = ctx;
  const totalInits = game.registry.inits.size;
  const initRows = [...game.registry.inits.values()].map((init) => {
    const reveal = getInitReveal(ctx, init);
    if (reveal.stage === 'invisible') return '';
    const unlocked = reveal.stage === 'owned';
    const isCurrent = init.id === view.activeInit;
    const areas = game.registry.areasOfInit(init.id);
    const name = reveal.nameKnown ? init.name : '未知世界线';
    return `
      <div class="nav-item ${isCurrent ? 'active' : ''}">
        <span class="nav-marker"></span>
        <span>${ctx.escapeHtml(name)}</span>
        <small>${unlocked ? `${areas.length} AREA` : 'LOCKED'}</small>
      </div>`;
  }).join('');
  return `
    <div class="panel-heading"><span class="eyebrow">WORLD LINE ARCHIVE</span><span class="index">03</span></div>
    ${initRows || '<div class="nav-item"><span class="nav-marker"></span><span>暂无世界线</span><small>—</small></div>'}
    <div class="rail-note"><span class="eyebrow">SYSTEM NOTE</span><p>世界线档案：${view.unlockedInits.length} / ${totalInits} 已解锁。切换世界线需先完成当前主线。</p></div>`;
}

function renderStoryTab(ctx: UIContext): string {
  const { game, view } = ctx;
  const currentInit = view.activeInit;

  // 仅收集 type === 'active' 的故事，且 availableInits 包含当前 init 或为空
  const stories = [...game.registry.stories.values()].filter(s => {
    if (s.type !== 'active') return false;
    if (s.availableInits.length > 0 && !s.availableInits.includes(currentInit)) return false;
    return true;
  });

  if (stories.length === 0) {
    return `
      <div class="panel-heading"><span class="eyebrow">STORY ARCHIVE</span><span class="index">02</span></div>
      <div class="nav-item"><span class="nav-marker"></span><span>暂无主动故事</span><small>—</small></div>
      <div class="rail-note"><span class="eyebrow">SYSTEM NOTE</span><p>当前世界线没有可触发的主动故事。</p></div>`;
  }

  const hasActiveStory = view.currentStory !== null && view.currentStory.type === 'active';
  const activeStoryId = view.currentStory?.storyId ?? null;

  const rows = stories.map(story => {
    const reveal = getStoryReveal(ctx, story);
    const completed = view.storyLog.some(s => s.storyId === story.id);
    const isRunning = activeStoryId === story.id;
    const storyLocked = hasActiveStory && !isRunning;

    // 状态判定
    let status: string;
    let button = '';
    if (completed) {
      status = '<small class="story-done">✓ 已完成</small>';
    } else if (isRunning) {
      status = '<small class="story-active">● 进行中</small>';
    } else if (storyLocked) {
      status = '<small class="story-locked">🔒 演出中</small>';
    } else if (reveal.stage === 'owned') {
      // 已完成但上面已经处理（此分支理论上不会进入）
      status = '<small class="story-done">✓ 已完成</small>';
    } else {
      // 未完成，判断是否可达
      if (reveal.conditionKnown) {
        const condText = story.triggerCondition
          ? describeCondition(story.triggerCondition, ctx.nameOf)
          : '无条件';
        status = `<small class="story-cond">${ctx.escapeHtml(condText)}</small>`;
        if (reveal.stage === 'purchaseable') {
          button = `<button data-start-story="${story.id}" class="story-trigger">进入故事</button>`;
        } else {
          button = '<small class="story-locked">条件不足</small>';
        }
      } else {
        status = '<small class="story-locked">条件未知</small>';
      }
    }

    const name = reveal.nameKnown ? story.name : '???';
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

  const runningCount = stories.filter(s => view.storyLog.some(l => l.storyId === s.id)).length;
  return `
    <div class="panel-heading"><span class="eyebrow">STORY ARCHIVE</span><span class="index">02</span></div>
    <div class="nav-sub">主动故事 · ${runningCount}/${stories.length} 已完成</div>
    ${rows}
    <div class="rail-note"><span class="eyebrow">SYSTEM NOTE</span><p>主动故事是当前世界线的主线剧情。点击"进入故事"即可开始。</p></div>`;
}
