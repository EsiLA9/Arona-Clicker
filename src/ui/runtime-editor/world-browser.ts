import { renderEditorDirectoryTools } from '../workspace/editor-directory';
import { bindEditorDirectoryScrollbars, refreshEditorDirectoryScrollbars, renderEditorDirectoryScroll } from '../workspace/editor-directory-scroll';
import { renderEditorReviewFields, renderEditorReviewSection } from '../workspace/editor-review';
import type { UIContext } from '../runtime/context';
import { createEditorWorkspaceColumn } from '../workspace/editor-workspace-frame';
import type { WorkspaceColumnSpec } from '../components/shared/workspace-frame';
import { editorLayout, editorToolIcon, renderEditorTool, renderEditorToolGroup } from '../workspace/editor-workspace';
import { EditorExplorerService, type EditorExplorerStateSnapshot } from '../workspace/editor-explorer-service';
import { projectEditorExplorerTree, renderEditorExplorerSearch, renderEditorExplorerTree } from '../workspace/editor-directory';
import type { EditorExplorerProjection, EditorWorkbenchBusinessChrome, EditorWorkbenchBusinessProjection } from '../workspace/editor-workbench';
import { buildDefaultWorldTree, resolveWorldSummary, worldBrowseProviderKey, worldEntityKey, worldExplorerNodes, type WorldBrowseInstance, type WorldEntityRef, type WorldSummary, type WorldTreeNode } from './world-browser-provider';
export { buildDefaultWorldTree, resolveWorldResourceRequest, worldEntityIdentity, worldEntityKey, type WorldBrowseInstance, type WorldBrowseInstanceState, type WorldEntityRef, type WorldProviderState, type WorldTreeNode } from './world-browser-provider';
export type WorldBrowserSession = WorldBrowseInstance;

const worldColumns = {
  tree: { slot: 'left', key: 'editor-explorer', title: '世界目录' },
  detail: { slot: 'center', key: 'editor-content', title: '内容摘要' },
  review: { slot: 'right', key: 'editor-inspector', title: '便捷信息' },
} as const;
export const worldWorkType = 'world';
export const worldWorkIcon = editorToolIcon('locate');

export function worldTreePath(nodes: readonly WorldTreeNode[], ref: WorldEntityRef, preferredKey?: string): WorldTreeNode[] {
  const key = worldEntityKey(ref);
  for (const node of nodes) {
    if (node.ref && worldEntityKey(node.ref) === key && (!preferredKey || node.key === preferredKey)) return [node];
    const path = worldTreePath(node.children, ref, preferredKey);
    if (path.length) return [node, ...path];
  }
  return [];
}

const emptyExplorerState: EditorExplorerStateSnapshot = { queries: {}, expandedPlacementKeys: [], searchExpandedPlacementKeys: [],
  expandedOverrides: {}, searchExpandedOverrides: {}, scrollTopByHost: {} };

export function renderWorldTree(ctx: UIContext, roots: readonly WorldTreeNode[], explorer: EditorExplorerStateSnapshot = emptyExplorerState,
  activeResourceKey?: string): string {
  const tree = projectEditorExplorerTree(worldExplorerNodes(roots), {
    query: explorer.queries.default ?? '',
    expandedOverrides: explorer.expandedOverrides,
    searchExpandedOverrides: explorer.searchExpandedOverrides,
    selectedPlacementKey: explorer.selectedPlacementKey,
    activeResourceKey,
    revealPlacementKey: explorer.reveal?.placementKey,
  });
  return renderEditorExplorerTree(ctx, tree, tree.emptyReason === 'no-items' ? '当前没有世界内容。' : '没有匹配的世界内容。');
}

export function refreshWorldExplorerTree(root: HTMLElement, ctx: UIContext, explorer: EditorExplorerStateSnapshot,
  activeResourceKey?: string): boolean {
  const nav = root.querySelector<HTMLElement>('[data-world-tree]');
  if (!nav) return false;
  nav.innerHTML = renderWorldTree(ctx, buildDefaultWorldTree(ctx.game.registry), explorer, activeResourceKey);
  refreshEditorDirectoryScrollbars(root);
  return true;
}

export function renderWorldDetail(ctx: UIContext, summary?: WorldSummary): string {
  const e = ctx.escapeHtml;
  if (!summary) return '<p>从左侧目录选择世界内容。</p>';
  const link = (ref: WorldEntityRef, name: string) => `<button type="button" class="mini-action" data-editor-resource-origin="instance-link" data-editor-resource-provider="world" data-editor-resource-kind="${ref.kind}" data-editor-resource-id="${e(ref.id)}" data-editor-resource-key="${e(worldEntityKey(ref))}">${e(name)}</button>`;
  const fields = [
    { label: '类型', content: summary.kindLabel },
    { label: 'ID', content: `<code>${e(summary.ref.id)}</code>` },
    ...(summary.parent ? [{ label: summary.ref.kind === 'area' ? '所属 Init' : '所属 Area', content: link(summary.parent.ref, summary.parent.label) }] : []),
  ];
  return `<h3>${e(summary.title)}</h3>${renderEditorReviewFields(ctx, '内容摘要', fields)}
    <p>${e(summary.description)}</p>
    ${summary.children.length || summary.ref.kind !== 'spot' ? renderEditorReviewSection(ctx, 'world-children', summary.ref.kind === 'init' ? '所属 Area' : '所属 Spot',
      summary.children.length ? `<ul>${summary.children.map(item => `<li>${link(item.ref, item.label)}</li>`).join('')}</ul>` : '', '暂无条目。') : ''}`;
}

export function createWorldEditorExplorerColumn(ctx: UIContext, explorer: EditorExplorerStateSnapshot, activeResourceKey?: string): WorkspaceColumnSpec {
  const roots = buildDefaultWorldTree(ctx.game.registry);
  return createEditorWorkspaceColumn(ctx, { ...worldColumns.tree, bindingKey: 'world-explorer', hostId: 'editor-explorer',
    workspaceOwner: 'editor-workbench', themeScope: 'left.editor', leaveAction: 'data-world-editor-leave', scroll: 'content',
    content: renderEditorExplorerSearch(ctx, { query: explorer.queries.default ?? '', channel: 'default', label: '搜索世界内容', className: 'editor-explorer-search',
      attributes: 'data-editor-key="world-search"' })
      + renderEditorDirectoryTools("目录工具", '<button type="button" class="mini-action" data-editor-workspace-action="locate-world">定位选中项</button>', "world-directory-tools")
      + renderEditorDirectoryScroll(ctx, "world-tree", "world-tree-list", "", `<nav data-world-tree aria-label="世界目录">${renderWorldTree(ctx, roots, explorer, activeResourceKey)}</nav>`) });
}

export function worldExplorerProjection(ctx: UIContext, state: EditorExplorerStateSnapshot, service: EditorExplorerService,
  getActiveResourceKey?: () => string | undefined): EditorExplorerProjection {
  return { type: 'world', state, column: createWorldEditorExplorerColumn(ctx, state, getActiveResourceKey?.()), bindColumn: root => {
    const unbindInteractions = service.bindColumn(root, 'world', { onQuery: () => refreshWorldExplorerTree(root, ctx, service.snapshot('world'), getActiveResourceKey?.()) });
    const unbindScrollbars = bindEditorDirectoryScrollbars(root);
    const host = root.querySelector<HTMLElement>('[data-scroll-key="world-tree"]');
    if (host) host.scrollTop = service.scrollTop('world', 'world-tree');
    return () => { unbindInteractions(); unbindScrollbars(); };
  } };
}

export function createWorldEditorBusinessColumns(ctx: UIContext, session: WorldBrowserSession): WorkspaceColumnSpec[] {
  return [
    createEditorWorkspaceColumn(ctx, { ...worldColumns.detail, bindingKey: 'world-detail', hostId: 'world-detail',
      workspaceOwner: 'world-editor', themeScope: 'center.world-editor',
      content: `<section data-world-detail>${renderWorldDetail(ctx, resolveWorldSummary(ctx.game.registry, session.state.provider.target))}</section>` }),
    createEditorWorkspaceColumn(ctx, { ...worldColumns.review, bindingKey: 'world-review', hostId: 'world-review',
      workspaceOwner: 'world-editor', themeScope: 'right.world-editor', visible: editorLayout.state.mode === 'advanced', content: '' }),
  ];
}

export function worldEditorBusinessChrome(ctx: UIContext): EditorWorkbenchBusinessChrome {
  return {
    canDuplicate: false,
    commands: renderEditorToolGroup('世界内容', renderEditorTool(ctx, 'locate', '显示目录', 'locate-world')),
    status: '当前运行内容',
  };
}

export function createWorldEditorBusinessProjection(ctx: UIContext, session: WorldBrowserSession): EditorWorkbenchBusinessProjection {
  return { columns: createWorldEditorBusinessColumns(ctx, session), ...worldEditorBusinessChrome(ctx) };
}
