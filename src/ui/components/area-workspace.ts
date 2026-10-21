import type { UIContext } from '../context';
import type { PanelState } from './app-shell';
import { renderLeftPanel } from './rail';
import { renderWorkspaceFrame } from './workspace-frame';
import { renderWorkspaceTitlebar } from './workspace-titlebar';
import { resolveEntityPresentation } from './entity-presentation';

function placeholder(ctx: UIContext, areaName: string, detail: string): string {
  return `<div class="workspace-placeholder"><h2>${ctx.escapeHtml(areaName)}</h2><p>${ctx.escapeHtml(detail)}</p></div>`;
}

export function renderAreaWorkspace(ctx: UIContext, areaId: string, state: PanelState): string {
  const area = ctx.game.world.areas.get(areaId);
  const presentation = area ? resolveEntityPresentation(ctx, 'area', area.id) : undefined;
  const areaName = presentation?.name ?? area?.name ?? '未知区域';
  const areaDescription = presentation?.description ?? area?.description ?? '';

  const left = renderLeftPanel(ctx, state);
  const center = renderWorkspaceTitlebar(ctx, 'center', '区域概览', 'data-area-workspace-leave')
    + `<div class="workspace-placeholder"><h2>${ctx.escapeHtml(areaName)}</h2>${areaDescription ? `<p>${ctx.escapeHtml(areaDescription)}</p>` : ''}<p>区域概览将在此逐步设计。</p></div>`;
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
      scroll: 'none',
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
