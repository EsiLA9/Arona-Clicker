import type { UIContext } from '../runtime/context';
import { getAreaReveal } from '../components/tooltip/tooltip';
import type { PanelState } from '../components/shared/app-shell';
import { resolveEntityPresentation, renderEntityPresentationOptions } from '../components/presentation/entity-presentation';
import { getForegroundInteractionStatus, isReplayPresentationActive } from '../workspace/foreground-interaction';

export type AreaNavigationState = Pick<PanelState,
  'conversationVariantId' | 'storyGate' | 'storyReplay' | 'workspace' | 'workspaceNavigation' | 'areaMapSession'>;

export function renderAreaNavigationContent(ctx: UIContext, panelState: AreaNavigationState, allowAreaMapEntry?: boolean): string {
  const { game, view } = ctx;
  const init = game.world.inits.get(view.activeInit);
  const currentAreaId = view.currentAreaId;
  const currentArea = currentAreaId ? game.world.areas.get(currentAreaId) : undefined;
  const currentPresentation = currentArea ? resolveEntityPresentation(ctx, 'area', currentArea.id) : undefined;
  const areaName = currentPresentation?.name ?? currentArea?.name ?? '—';
  const areaDescription = currentPresentation?.description ?? currentArea?.description ?? init?.description ?? '';
  const interactionBlocked = !getForegroundInteractionStatus(game, panelState, 'openAreaOverview').allowed;
  const quickStoryRouteAllowed = !isReplayPresentationActive(panelState) && !panelState.workspace
    && (!panelState.workspaceNavigation || panelState.workspaceNavigation.current.kind === 'game');
  const quickStories = currentArea && quickStoryRouteAllowed
    ? game.story.getAreaStoryDeliveries(currentArea.id).slice(0, 5)
    : [];
  const quickStoryButtons = quickStories.length
    ? `<div class="area-hero-story-list" role="group" aria-label="区域故事快捷入口">${quickStories.map(delivery => `
        <button type="button" class="area-hero-story-entry" data-area-story-quick-enter="${ctx.escapeHtml(delivery.entryId)}"${interactionBlocked || game.story.isBlockingInteraction(delivery.owner) ? ' disabled' : ''}><span>${ctx.escapeHtml(delivery.title)}</span></button>`).join('')}
      </div>`
    : '';
  const mapEntry = currentArea ? game.areaMap?.getEntryView(currentArea.id) : undefined;
  const mapRouteAllowed = allowAreaMapEntry
    ?? (!panelState.workspace && (!panelState.workspaceNavigation || panelState.workspaceNavigation.current.kind === 'game'));
  const mapButton = mapEntry && mapEntry.ready
    ? `<button type="button" class="area-map-entry" data-area-map-open="${ctx.escapeHtml(currentArea!.id)}"${interactionBlocked || !mapRouteAllowed || panelState.areaMapSession ? ' disabled' : ''}>区域地图</button>` : '';

  // hero 横幅
  const hero = currentArea
    ? `<div class="area-hero">
        <button type="button" class="area-hero__open" data-area-workspace-open="${ctx.escapeHtml(currentArea.id)}" aria-label="打开区域工作区：${ctx.escapeHtml(areaName)}"${interactionBlocked ? ' disabled aria-disabled="true" title="剧情进行中，暂不可打开区域工作区"' : ''}>
          <h2>${ctx.escapeHtml(areaName)}</h2>
          <p>${ctx.escapeHtml(areaDescription)}</p>
        </button>
      </div>
      ${getAreaReveal(ctx, currentArea).utilityKnown && !isReplayPresentationActive(panelState)
        ? renderEntityPresentationOptions(ctx, 'area', currentArea.id)
        : ''}`
    : `<div class="area-hero"><h2>${ctx.escapeHtml(areaName)}</h2><p>${ctx.escapeHtml(areaDescription)}</p></div>`;

  // 可前往区域包含直接出口与沿已探索拓扑能够抵达的地点。
  const adjacent = currentArea
    ? game.reachableAreaIds().filter(areaId => game.world.areas.get(areaId)?.initId === view.activeInit)
    : [];
  // 非 passive 剧情演出进行中禁止移动（演出锁定）
  const storyLocked = game.story.isBlockingMovement() || isReplayPresentationActive(panelState);
  const reachableRows = adjacent.map(areaId => renderAreaNavItem(ctx, areaId, isReplayPresentationActive(panelState))).join('');

  return `
    ${hero}
    ${mapButton}
    ${quickStoryButtons}
    <div class="nav-sub">可前往区域</div>
    ${reachableRows || '<div class="nav-item"><span class="nav-marker"></span><span>暂无可达区域</span><small>—</small></div>'}
    <div class="rail-note"><span class="eyebrow">SYSTEM NOTE</span><p>${storyLocked ? '剧情演出中，暂不可移动区域。' : '点击区域即可前往；已探索地点会沿当前有效通路尽量连通。'}</p></div>`;
}

/** 生成单个区域导航项，供元素级揭示刷新复用。 */
export function renderAreaNavItem(ctx: UIContext, areaId: string, replayLocked = false): string {
  const { game, view } = ctx;
  const area = game.world.areas.get(areaId);
  if (!area) return '';
  const visible = view.visibility.areas[area.id] ?? false;
  const storyLocked = game.story.isBlockingMovement() || replayLocked;
  const reveal = getAreaReveal(ctx, area);
  const presentation = resolveEntityPresentation(ctx, 'area', area.id);
  const name = reveal.nameKnown ? (presentation?.name ?? area.name) : '未知区域';
  const isLocked = !visible || storyLocked;
  const spotCount = game.world.spotsOfArea(area.id).length;
  const marker = isLocked ? '<span class="nav-lock">🔒</span>' : '<span class="nav-marker"></span>';
  const state = storyLocked
    ? '<small>演出中</small>'
    : isLocked
      ? '<small>LOCKED</small>'
      : `<small>${spotCount} SPOT</small>`;
  return `
      <button class="nav-item area-nav hover-wrap ${isLocked ? 'is-locked' : ''}" data-ui-area-nav="reachable:${area.id}" data-ui-area-nav-kind="reachable" data-area="${area.id}" data-tooltip="area:${area.id}" aria-disabled="${isLocked}" ${isLocked ? 'data-locked' : ''}>
        ${marker}<span>${ctx.escapeHtml(name)}</span>${state}
      </button>`;
}

