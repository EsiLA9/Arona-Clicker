import type { UIContext } from '../../runtime/context';
import type { PanelState } from '../shared/app-shell';
import { createAreaNavigationColumn } from '../../columns';
import { renderWorkspaceFrame, type WorkspaceFrameSpec } from '../shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../shared/workspace-titlebar';
import { resolveEntityPresentation } from '../presentation/entity-presentation';

function placeholder(ctx: UIContext, areaName: string, detail: string): string {
  return `<div class="workspace-placeholder"><h2>${ctx.escapeHtml(areaName)}</h2><p>${ctx.escapeHtml(detail)}</p></div>`;
}

export function createAreaWorkspaceFrame(ctx: UIContext, areaId: string, state: PanelState): WorkspaceFrameSpec {
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

  const center = `<div class="area-workspace__center-content" data-scroll-owner="content-region">
        <section class="area-workspace__overview"><h2>${ctx.escapeHtml(areaName)}</h2>${areaDescription ? `<p>${ctx.escapeHtml(areaDescription)}</p>` : ''}</section>
        ${storyList}
      </div>`;
  const right = placeholder(ctx, areaName, '区域详情将在此逐步设计。');

  return { id: 'area',
    columns: [{ ...createAreaNavigationColumn(ctx, state, { key: 'navigation', workspaceOwner: 'area', appearance: { hostId: 'leftPanel.area', themeScope: 'left.area', className: 'left-panel ui-cluster--left-panel area-workspace__left' } }), width: 'var(--workspace-left-width)', slot: 'left', role: 'navigation', workspaceOwner: 'area' },
      { key: 'primary', width: 'var(--workspace-center-width)',
        slot: 'center',
        role: 'primary',
        workspaceOwner: 'area',
        hostId: 'centerPanel.area.main',
        themeScope: 'center.game',
        surface: 'panel',
        className: 'area-workspace__center',
        header: renderWorkspaceTitlebar(ctx, 'center', '区域概览', 'data-area-workspace-leave'),
        content: center,
        scroll: 'content',
      },
      { key: 'inspector', width: 'var(--workspace-right-width)',
        slot: 'right',
        role: 'inspector',
        workspaceOwner: 'area',
        hostId: 'rightPanel.area.inspector',
        themeScope: 'right.game',
        surface: 'panel',
        className: 'area-workspace__right',
        header: renderWorkspaceTitlebar(ctx, 'right', '区域详情'),
        content: right,
        scroll: 'content',
      }]
  };
}

export function renderAreaWorkspace(ctx: UIContext, areaId: string, state: PanelState): string {
  return renderWorkspaceFrame(ctx, createAreaWorkspaceFrame(ctx, areaId, state));
}
