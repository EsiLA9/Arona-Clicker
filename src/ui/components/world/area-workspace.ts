import type { UIContext } from '../../runtime/context';
import type { PanelState } from '../shared/app-shell';
import { renderLeftPanel } from '../shared/rail';
import { renderWorkspaceFrame } from '../shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../shared/workspace-titlebar';
import { resolveEntityPresentation } from '../presentation/entity-presentation';

function placeholder(ctx: UIContext, areaName: string, detail: string): string {
  return `<div class="workspace-placeholder"><h2>${ctx.escapeHtml(areaName)}</h2><p>${ctx.escapeHtml(detail)}</p></div>`;
}

export function renderAreaWorkspace(ctx: UIContext, areaId: string, state: PanelState): string {
  const area = ctx.game.world.areas.get(areaId);
  const presentation = area ? resolveEntityPresentation(ctx, 'area', area.id) : undefined;
  const areaName = presentation?.name ?? area?.name ?? '未知区域';
  const areaDescription = presentation?.description ?? area?.description ?? '';
  const deliveries = ctx.game.story.getAreaStoryDeliveries(areaId);
  const storyList = deliveries.length > 0
    ? `<section class="area-workspace__stories" aria-label="待接取故事">
        <h3>待接取故事</h3>
        <div class="area-workspace__story-list">${deliveries.map(delivery => `
          <article class="area-story-delivery" data-area-story-entry="${ctx.escapeHtml(delivery.entryId)}">
            <div class="area-story-delivery__body"><strong>${ctx.escapeHtml(delivery.title)}</strong></div>
            <button type="button" class="story-trigger" data-area-story-accept="${ctx.escapeHtml(delivery.entryId)}">接取</button>
          </article>`).join('')}
        </div>
      </section>`
    : '<p class="area-workspace__empty" role="status">这个区域目前没有待接取的故事。</p>';

  const left = renderLeftPanel(ctx, state);
  const center = renderWorkspaceTitlebar(ctx, 'center', '区域概览', 'data-area-workspace-leave')
    + `<div class="area-workspace__center-content" data-scroll-owner="content-region">
        <section class="area-workspace__overview"><h2>${ctx.escapeHtml(areaName)}</h2>${areaDescription ? `<p>${ctx.escapeHtml(areaDescription)}</p>` : ''}</section>
        ${storyList}
      </div>`;
  const right = renderWorkspaceTitlebar(ctx, 'right', '区域详情')
    + placeholder(ctx, areaName, '区域详情将在此逐步设计。');

  return renderWorkspaceFrame(ctx, {
    id: 'area',
    left: {
      slot: 'left',
      role: 'navigation',
      workspaceOwner: 'area',
      hostId: 'leftPanel.area.navigation',
      themeScope: 'left.game',
      className: 'area-workspace__left',
      content: left,
      scroll: 'none',
    },
    center: {
      slot: 'center',
      role: 'primary',
      workspaceOwner: 'area',
      hostId: 'centerPanel.area.main',
      themeScope: 'center.game',
      surface: 'panel',
      className: 'area-workspace__center',
      content: center,
      scroll: 'content',
    },
    right: {
      slot: 'right',
      role: 'inspector',
      workspaceOwner: 'area',
      hostId: 'rightPanel.area.inspector',
      themeScope: 'right.game',
      surface: 'panel',
      className: 'area-workspace__right',
      content: right,
      scroll: 'content',
    },
  });
}
