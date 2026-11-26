import { renderEditorDirectoryList, renderEditorDirectoryRow, renderEditorDirectoryToggle, renderEditorDirectoryTools } from '../workspace/editor-directory';
import { renderEditorDirectoryScroll } from '../workspace/editor-directory-scroll';
import { renderEditorReviewFields, renderEditorReviewSection } from '../workspace/editor-review';
import type { ContentCatalogQueryPort } from '../../arona-clicker/contracts/runtime/content-catalog';
import type { UIContext } from '../runtime/context';
import { createEditorWorkspaceColumn, createEditorWorkspaceFrame, renderEditorWorkspaceFrame } from '../workspace/editor-workspace-frame';
import { editorLayout, editorWorkspaceEdges, editorToolIcon, renderEditorWorkspace, renderEditorTool, renderEditorToolGroup } from '../workspace/editor-workspace';

export type WorldEntityRef = { kind: 'init' | 'area' | 'spot'; id: string };
export interface WorldTreeNode {
  key: string;
  label: string;
  ref?: WorldEntityRef;
  isDefault?: boolean;
  children: readonly WorldTreeNode[];
}
type WorldCatalog = Pick<ContentCatalogQueryPort, 'inits' | 'areas' | 'spots'>;
export interface WorldBrowserSession {
  id: number;
  selected?: WorldEntityRef;
  selectedNodeKey?: string;
  expanded: Set<string>;
  scrollTop?: number;
}

const worldColumns = {
  tree: { slot: 'left', key: 'world-tree', title: '世界目录' },
  detail: { slot: 'center', key: 'world-detail', title: '内容摘要' },
  review: { slot: 'right', key: 'world-review', title: '便捷信息' },
} as const;
export const worldEditorEdges = editorWorkspaceEdges(Object.values(worldColumns).map(column => column.slot));
export const worldWorkType = 'world';
export const worldWorkIcon = editorToolIcon('locate');
export const worldEntityKey = (ref: WorldEntityRef): string => `${ref.kind}:${ref.id}`;
const labels = { init: 'Init', area: 'Area', spot: 'Spot' };

export function buildDefaultWorldTree(catalog: WorldCatalog): WorldTreeNode[] {
  type Branch = Omit<WorldTreeNode, 'children'> & { children: Branch[] };
  const branch = (kind: WorldEntityRef['kind'], entity: { id: string; name: string }, isDefault = false): Branch => {
    const ref = { kind, id: entity.id };
    return { key: worldEntityKey(ref), label: entity.name || entity.id, ref, isDefault, children: [] };
  };
  const inits = new Map([...catalog.inits.values()].map(init => [init.id, branch('init', init)]));
  const areas = new Map<string, Branch>();
  const orphan: Branch = { key: 'missing-parent', label: '归属缺失', children: [] };
  for (const area of catalog.areas.values()) {
    const node = branch('area', area, catalog.inits.get(area.initId)?.defaultAreas.includes(area.id));
    areas.set(area.id, node);
    (inits.get(area.initId) ?? orphan).children.push(node);
  }
  for (const spot of catalog.spots.values()) {
    (areas.get(spot.areaId) ?? orphan).children.push(branch('spot', spot, catalog.areas.get(spot.areaId)?.defaultSpots.includes(spot.id)));
  }
  const roots = [...inits.values()].sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  if (orphan.children.length) roots.push(orphan);
  return roots;
}

export function worldTreePath(nodes: readonly WorldTreeNode[], ref: WorldEntityRef, preferredKey?: string): WorldTreeNode[] {
  const key = worldEntityKey(ref);
  for (const node of nodes) {
    if (node.ref && worldEntityKey(node.ref) === key && (!preferredKey || node.key === preferredKey)) return [node];
    const path = worldTreePath(node.children, ref, preferredKey);
    if (path.length) return [node, ...path];
  }
  return [];
}

export function renderWorldTree(ctx: UIContext, roots: readonly WorldTreeNode[], session: WorldBrowserSession): string {
  const e = ctx.escapeHtml;
  const selected = session.selectedNodeKey;
  const list = (nodes: readonly WorldTreeNode[], hidden = false): string =>
    renderEditorDirectoryList(nodes.map(node => {
      const open = session.expanded.has(node.key);
      const control = node.ref ? `<button type="button" class="editor-directory-row" aria-pressed="${node.key === selected}" data-world-node-key="${e(node.key)}" data-world-select="${node.ref.kind}" data-world-id="${e(node.ref.id)}"><strong class="editor-directory-name">${e(node.label)}</strong> <small>${labels[node.ref.kind]}${node.isDefault ? ' · 默认' : ''}</small></button>` : e(node.label);
      return renderEditorDirectoryRow(ctx, { key: node.key, control, attributes: `data-world-node="${e(node.key)}"`,
        controlsBefore: node.children.length ? renderEditorDirectoryToggle(open, `data-world-expand="${e(node.key)}" aria-label="展开或收起 ${e(node.label)}"`) : undefined,
        children: node.children.length ? list(node.children, !open) : undefined });
    }).join(''), hidden ? 'hidden' : '');
  return roots.length ? list(roots) : '<p>当前没有世界内容。</p>';
}

export function renderWorldDetail(ctx: UIContext, selected?: WorldEntityRef): string {
  const e = ctx.escapeHtml;
  const { inits, areas, spots } = ctx.game.registry;
  const init = selected?.kind === 'init' ? inits.get(selected.id) : undefined;
  const area = selected?.kind === 'area' ? areas.get(selected.id) : undefined;
  const spot = selected?.kind === 'spot' ? spots.get(selected.id) : undefined;
  const entity = init ?? area ?? spot;
  if (!entity || !selected) return '<p>从左侧目录选择世界内容。</p>';
  const link = (kind: WorldEntityRef['kind'], id: string, name?: string) => name !== undefined
    ? `<button type="button" class="mini-action" data-world-select="${kind}" data-world-id="${e(id)}">${e(name || id)}</button>`
    : `<code>${e(id)}</code>（归属缺失）`;
  const children = init ? [...areas.values()].filter(item => item.initId === init.id).map(item => link('area', item.id, item.name))
    : area ? [...spots.values()].filter(item => item.areaId === area.id).map(item => link('spot', item.id, item.name)) : [];
  const parent = area ? link('init', area.initId, inits.get(area.initId)?.name)
    : spot ? link('area', spot.areaId, areas.get(spot.areaId)?.name) : '';
  const fields = [
    { label: '类型', content: labels[selected.kind] },
    { label: 'ID', content: `<code>${e(entity.id)}</code>` },
    ...(parent ? [{ label: area ? '所属 Init' : '所属 Area', content: parent }] : []),
  ];
  return `<h3>${e(entity.name || entity.id)}</h3>${renderEditorReviewFields(ctx, '内容摘要', fields)}
    <p>${e(entity.description)}</p>
    ${init || area ? renderEditorReviewSection(ctx, 'world-children', init ? '所属 Area' : '所属 Spot',
      children.length ? `<ul>${children.map(item => `<li>${item}</li>`).join('')}</ul>` : '', '暂无条目。') : ''}`;
}

export function renderWorldBrowser(ctx: UIContext, session: WorldBrowserSession): string {
  const frame = renderEditorWorkspaceFrame(ctx, createEditorWorkspaceFrame('world-editor', [
    createEditorWorkspaceColumn(ctx, { ...worldColumns.tree, bindingKey: 'world-tree', hostId: 'world-tree',
      workspaceOwner: 'world-editor', themeScope: 'left.world-editor', leaveAction: 'data-world-editor-leave', scroll: 'content',
      content: renderEditorDirectoryTools("目录工具", '<button type="button" class="mini-action" data-editor-workspace-action="locate-world">定位选中项</button>', "world-directory-tools")
        + renderEditorDirectoryScroll(ctx, "world-tree", "world-tree-list", "", `<nav data-world-tree aria-label="世界目录">${renderWorldTree(ctx, buildDefaultWorldTree(ctx.game.registry), session)}</nav>`) }),
    createEditorWorkspaceColumn(ctx, { ...worldColumns.detail, bindingKey: 'world-detail', hostId: 'world-detail',
      workspaceOwner: 'world-editor', themeScope: 'center.world-editor',
      content: `<section data-world-detail>${renderWorldDetail(ctx, session.selected)}</section>` }),
    createEditorWorkspaceColumn(ctx, { ...worldColumns.review, bindingKey: 'world-review', hostId: 'world-review',
      workspaceOwner: 'world-editor', themeScope: 'right.world-editor', visible: editorLayout.state.mode === 'advanced', content: '' }),
  ]));
  return renderEditorWorkspace(ctx, {
    layout: editorLayout.state, edges: worldEditorEdges, temporaryView: false, canDuplicate: false,
    workTypes: [
      { id: 'story', name: '故事编辑', icon: editorToolIcon('open'), active: false },
      { id: worldWorkType, name: '世界编辑器', icon: worldWorkIcon, active: true },
    ],
    instances: [{ id: session.id, title: '世界内容', active: true }],
    commands: renderEditorToolGroup('世界内容', renderEditorTool(ctx, 'locate', '显示目录', 'locate-world')),
    status: '当前运行内容',
  }, frame);
}
