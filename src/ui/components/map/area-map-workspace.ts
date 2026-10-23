import type { UIContext } from '../../runtime/context';
import type { PanelState } from '../shared/app-shell';
import type { AreaMapNodeView } from '../../../arona-clicker/contracts/world/area-map-query';
import type { AreaMapSession } from '../../workspace/area-map-session';
import { renderWorkspaceFrame } from '../shared/workspace-frame';
import { renderWorkspaceTitlebar } from '../shared/workspace-titlebar';
import { renderLeftPanel } from '../shared/rail';
import { travelErrorText } from '../shared/errors';
import { buildConditionView, renderConditionTree } from '../../presentation/condition-presentation';
import '../../css/area-map.css';

export function areaMapReason(reason?: string): string {
  if (reason === 'Unavailable') return '目标不可用';
  if (reason === 'Locked') return '条件尚未满足';
  return reason ? travelErrorText[reason as keyof typeof travelErrorText] ?? '暂时无法操作' : '';
}

export function areaMapTravelLabel(node?: AreaMapNodeView): string {
  return node?.travelMethod === 'visited' ? '快速返回'
    : node?.travelMethod === 'transit' ? '乘交通前往' : '尝试前往';
}

export function renderAreaMapNode(ctx: UIContext, session: AreaMapSession, node: AreaMapNodeView): string {
  const esc = ctx.escapeHtml;
  const icon = node.appearance.iconPicId ? ctx.game.pics.urlOf(node.appearance.iconPicId) : undefined;
  return `<g class="area-map-node area-map-node--${node.appearance.kind}" data-area-map-node="${esc(node.id)}"
      data-area-map-id="${esc(session.currentMapId)}" data-area-map-revision="${session.revision}"
      transform="translate(${node.position.x} ${node.position.y})" role="button" tabindex="0"
      aria-label="${esc(node.name)}" aria-pressed="${session.selectedNodeId === node.id}" data-available="${node.ready}" data-current="${!!node.current}">
    <title>${esc([node.name, node.description, node.ready ? '' : areaMapReason(node.reason)].filter(Boolean).join(' · '))}</title>
    <circle class="area-map-node__ring" r="28" />
    <circle class="area-map-node__point" r="16" />
    ${icon ? `<image href="${esc(icon)}" x="-12" y="-12" width="24" height="24" pointer-events="none" />` : ''}
    <text class="area-map-node__name" y="49" text-anchor="middle">${esc(node.name)}</text>
  </g>`;
}

export function renderAreaMapEdges(session: AreaMapSession): string {
  const nodes = new Map(session.view.nodes.map(node => [node.id, node]));
  return session.view.edges.map(edge => {
    const from = nodes.get(edge.fromNodeId)!, to = nodes.get(edge.toNodeId)!;
    const dx = to.position.x - from.position.x, dy = to.position.y - from.position.y;
    const length = Math.hypot(dx, dy) || 1, inset = Math.min(22, length / 3);
    return `<line data-area-map-edge="${edge.fromNodeId}:${edge.toNodeId}" x1="${from.position.x + dx / length * inset}" y1="${from.position.y + dy / length * inset}" x2="${to.position.x - dx / length * inset}" y2="${to.position.y - dy / length * inset}" ${edge.directed ? `marker-end="url(#area-map-arrow-${session.sessionId})"` : ''} />`;
  }).join('');
}

export function renderAreaMapDetail(ctx: UIContext, session: AreaMapSession): string {
  const node = session.view.nodes.find(node => node.id === session.selectedNodeId);
  const esc = ctx.escapeHtml;
  const title = node?.name ?? session.view.name;
  const description = node ? node.description : session.view.description;
  const conditions = node?.conditions?.map(condition => renderConditionTree(buildConditionView(condition, {
    nameOf: ctx.nameOf, formatNumber: ctx.formatNumber, evaluate: cond => ctx.game.conditionSystem.evaluateExpr(cond, ctx.game.state),
  }), esc)).join('') ?? '';
  return `<h2>${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}
    ${node?.visited !== undefined ? `<p class="area-map-detail__visit">${node.current ? '当前位置' : node.visited ? '已到访' : '尚未到访'}</p>` : ''}
    ${node ? `<p class="area-map-detail__status">${esc(node.ready ? node.actionKind === 'openMap' ? '点击节点打开地图' : node.actionKind === 'attemptAreaTravel' ? areaMapTravelLabel(node) : '信息节点' : areaMapReason(node.reason))}</p>`
      : '<p class="area-map-detail__status">选择节点查看详情</p>'}${conditions}`;
}

export function renderAreaMapWorkspace(ctx: UIContext, session: AreaMapSession, state: PanelState): string {
  const esc = ctx.escapeHtml;
  const camera = session.viewports.get(session.currentMapId)!;
  const selected = session.view.nodes.find(node => node.id === session.selectedNodeId);
  const toolbar = `<nav class="area-map-toolbar" aria-label="地图操作">
    <strong data-area-map-title>${esc(session.view.name)}</strong>
    <button type="button" data-area-map-action="back" ${session.history.length ? '' : 'disabled'}>上一图</button>
    <button type="button" data-area-map-action="current">当前区域地图</button>
    <button type="button" data-area-map-action="fit">适应视图</button>
    <button type="button" data-area-map-action="reset">重置视角</button>
    <button type="button" data-area-map-action="close">关闭地图</button>
  </nav>`;
  const center = renderWorkspaceTitlebar(ctx, 'center', '区域地图') + toolbar
    + `<svg class="area-map-viewport" data-area-map-viewport data-area-map-session="${esc(session.sessionId)}" viewBox="0 0 1000 700" aria-label="${esc(session.view.name)}">
      <defs><marker id="area-map-arrow-${esc(session.sessionId)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--muted-on-panel)" /></marker></defs>
      <g data-area-map-world transform="translate(${camera.x} ${camera.y}) scale(${camera.scale})">
        <g data-area-map-edges>${renderAreaMapEdges(session)}</g>
        <g data-area-map-nodes>${session.view.nodes.map(node => renderAreaMapNode(ctx, session, node)).join('')}</g>
      </g>
      <text data-area-map-empty x="500" y="350" text-anchor="middle" ${session.view.nodes.length ? 'hidden' : ''}>这张地图暂无可见节点</text>
    </svg>`;
  const right = renderWorkspaceTitlebar(ctx, 'right', '地图详情')
    + `<div class="area-map-detail" data-area-map-detail-scroll data-scroll-owner="content-region"><section data-area-map-detail>${renderAreaMapDetail(ctx, session)}</section></div>
       <div class="area-map-actions" data-area-map-actions>
         <button type="button" data-area-map-action="travel" data-area-map-travel-node="${esc(selected?.id ?? '')}" data-area-map-id="${esc(session.currentMapId)}" data-area-map-revision="${session.revision}" ${selected?.actionKind === 'attemptAreaTravel' ? '' : 'hidden'} ${selected?.ready && !session.submitting ? '' : 'disabled'}>${areaMapTravelLabel(selected)}</button>
         <p data-area-map-feedback role="status">${esc(session.feedback?.text ?? '')}</p>
       </div>`;
  return renderWorkspaceFrame(ctx, {
    id: 'area-map',
    left: { slot: 'left', role: 'navigation', workspaceOwner: 'area-map', hostId: 'leftPanel.area-map.navigation', themeScope: 'left.game', content: renderLeftPanel(ctx, state), scroll: 'none' },
    center: { slot: 'center', role: 'primary', workspaceOwner: 'area-map', hostId: 'centerPanel.area-map.main', themeScope: 'center.game', surface: 'panel', className: 'area-map-center', content: center, scroll: 'none' },
    right: { slot: 'right', role: 'inspector', workspaceOwner: 'area-map', hostId: 'rightPanel.area-map.inspector', themeScope: 'right.game', surface: 'panel', className: 'area-map-inspector', content: right, scroll: 'none' },
  });
}
