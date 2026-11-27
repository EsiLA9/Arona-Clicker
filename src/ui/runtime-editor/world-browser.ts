import { renderEditorDirectoryList, renderEditorDirectoryRow, renderEditorDirectoryToggle, renderEditorDirectoryTools } from '../workspace/editor-directory';
import { renderEditorDirectoryScroll } from '../workspace/editor-directory-scroll';
import { renderEditorReviewFields, renderEditorReviewSection } from '../workspace/editor-review';
import type { UIContext } from '../runtime/context';
import { createEditorWorkspaceColumn, createEditorWorkspaceFrame, renderEditorWorkspaceFrame } from '../workspace/editor-workspace-frame';
import type { WorkspaceColumnSpec } from '../components/shared/workspace-frame';
import type { BrowseInstanceSnapshot } from '../workspace/browse-instance-manager';
import type { EditorBrowseInstanceState } from '../workspace/editor-browse-instances';
import type { StoryBrowseInstanceState } from '../story-editor/workspace-session';
import { editorLayout, editorWorkspaceEdges, editorToolIcon, renderEditorWorkspace, renderEditorTool, renderEditorToolGroup } from '../workspace/editor-workspace';
import type { EditorExplorerStateSnapshot } from '../workspace/editor-explorer-service';
import { buildDefaultWorldTree, resolveWorldSummary, worldBrowseProviderKey, worldEntityKey, type WorldBrowseInstance, type WorldEntityRef, type WorldSummary, type WorldTreeNode } from './world-browser-provider';
export { buildDefaultWorldTree, worldEntityIdentity, worldEntityKey, type WorldBrowseInstance, type WorldBrowseInstanceState, type WorldEntityRef, type WorldProviderState, type WorldTreeNode } from './world-browser-provider';
export type WorldBrowserSession = WorldBrowseInstance;

const worldColumns = {
  tree: { slot: 'left', key: 'editor-explorer', title: '世界目录' },
  detail: { slot: 'center', key: 'editor-content', title: '内容摘要' },
  review: { slot: 'right', key: 'editor-inspector', title: '便捷信息' },
} as const;
export const worldEditorEdges = editorWorkspaceEdges(Object.values(worldColumns).map(column => column.slot));
export const worldWorkType = 'world';
export const worldWorkIcon = editorToolIcon('locate');
const labels = { init: 'Init', area: 'Area', spot: 'Spot' };

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

export function renderWorldTree(ctx: UIContext, roots: readonly WorldTreeNode[], explorer: EditorExplorerStateSnapshot = emptyExplorerState): string {
  const e = ctx.escapeHtml;
  const selected = explorer.selectedPlacementKey;
  const list = (nodes: readonly WorldTreeNode[], hidden = false): string =>
    renderEditorDirectoryList(nodes.map(node => {
      const open = explorer.expandedPlacementKeys.includes(node.key);
      const control = node.ref ? `<button type="button" class="editor-directory-row" aria-pressed="${node.key === selected}" data-editor-placement-select data-editor-placement-key="${e(node.key)}" data-world-node-key="${e(node.key)}" data-world-resource-key="${e(worldEntityKey(node.ref))}" data-world-select="${node.ref.kind}" data-world-id="${e(node.ref.id)}"><strong class="editor-directory-name">${e(node.label)}</strong> <small>${labels[node.ref.kind]}${node.isDefault ? ' · 默认' : ''}</small></button>` : e(node.label);
      return renderEditorDirectoryRow(ctx, { key: node.key, control, attributes: `data-world-node="${e(node.key)}" data-world-placement-key="${e(node.key)}"`,
        controlsBefore: node.children.length ? renderEditorDirectoryToggle(open, `data-world-expand="${e(node.key)}" data-editor-expand data-editor-placement-key="${e(node.key)}" aria-label="展开或收起 ${e(node.label)}"`) : undefined,
        children: node.children.length ? list(node.children, !open) : undefined });
    }).join(''), hidden ? 'hidden' : '');
  return roots.length ? list(roots) : '<p>当前没有世界内容。</p>';
}

export function renderWorldDetail(ctx: UIContext, summary?: WorldSummary): string {
  const e = ctx.escapeHtml;
  if (!summary) return '<p>从左侧目录选择世界内容。</p>';
  const link = (ref: WorldEntityRef, name: string) => `<button type="button" class="mini-action" data-world-select="${ref.kind}" data-world-id="${e(ref.id)}">${e(name)}</button>`;
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

export function createWorldEditorExplorerColumn(ctx: UIContext, session?: WorldBrowserSession, explorer: EditorExplorerStateSnapshot = emptyExplorerState): WorkspaceColumnSpec {
  return createEditorWorkspaceColumn(ctx, { ...worldColumns.tree, bindingKey: 'world-explorer', hostId: 'editor-explorer',
    workspaceOwner: 'editor-workbench', themeScope: 'left.editor', leaveAction: 'data-world-editor-leave', scroll: 'content',
    content: renderEditorDirectoryTools("目录工具", '<button type="button" class="mini-action" data-editor-workspace-action="locate-world">定位选中项</button>', "world-directory-tools")
      + renderEditorDirectoryScroll(ctx, "world-tree", "world-tree-list", "", `<nav data-world-tree aria-label="世界目录">${renderWorldTree(ctx, buildDefaultWorldTree(ctx.game.registry), explorer)}</nav>`) });
}

export function createWorldEditorFrame(ctx: UIContext, session: WorldBrowserSession, explorer?: WorkspaceColumnSpec,
  explorerState: EditorExplorerStateSnapshot = emptyExplorerState) {
  return createEditorWorkspaceFrame('world-editor', [
    explorer ?? createWorldEditorExplorerColumn(ctx, session, explorerState),
    createEditorWorkspaceColumn(ctx, { ...worldColumns.detail, bindingKey: 'world-detail', hostId: 'world-detail',
      workspaceOwner: 'world-editor', themeScope: 'center.world-editor',
      content: `<section data-world-detail>${renderWorldDetail(ctx, resolveWorldSummary(ctx.game.registry, session.state.provider.target))}</section>` }),
    createEditorWorkspaceColumn(ctx, { ...worldColumns.review, bindingKey: 'world-review', hostId: 'world-review',
      workspaceOwner: 'world-editor', themeScope: 'right.world-editor', visible: editorLayout.state.mode === 'advanced', content: '' }),
  ]);
}

export function worldEditorChrome(ctx: UIContext, session: WorldBrowserSession,
  activeExplorerType: 'story' | 'world' = 'world',
  browseInstances?: BrowseInstanceSnapshot<EditorBrowseInstanceState>) {
  const instances = browseInstances?.instances.map(instance => {
    const active = instance.id === browseInstances.activeBrowseInstanceId;
    if (instance.providerKey === worldBrowseProviderKey) return { id: instance.id, active,
      title: instance.presentation.title, typeLabel: 'World', label: instance.presentation.title, icon: worldWorkIcon };
    const story = instance.state as StoryBrowseInstanceState;
    const document = story.document;
    if (!document && !active) return undefined;
    const typeLabel = document?.target.kind === 'entry' ? 'Entry' : 'Story';
    return { id: instance.id, active, title: document?.name ?? '查阅故事', typeLabel,
      label: document ? `${typeLabel} · ${document.name} · ${document.target.id}` : undefined,
      icon: document && editorToolIcon('open') };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))
    ?? [{ id: String(session.id), title: '世界内容', active: true, typeLabel: 'World', label: '世界内容', icon: worldWorkIcon }];
  return {
    layout: editorLayout.state, edges: worldEditorEdges, temporaryView: false, canDuplicate: false,
    workTypes: [
      { id: 'story', name: '故事编辑', icon: editorToolIcon('open'), active: activeExplorerType === 'story' },
      { id: worldWorkType, name: '世界编辑器', icon: worldWorkIcon, active: activeExplorerType === 'world' },
    ],
    instances,
    commands: renderEditorToolGroup('世界内容', renderEditorTool(ctx, 'locate', '显示目录', 'locate-world')),
    status: '当前运行内容',
  };
}

export function renderWorldBrowser(ctx: UIContext, session: WorldBrowserSession,
  activeExplorerType: 'story' | 'world' = 'world', explorer?: WorkspaceColumnSpec,
  browseInstances?: BrowseInstanceSnapshot<EditorBrowseInstanceState>,
  explorerState: EditorExplorerStateSnapshot = emptyExplorerState): string {
  const frame = renderEditorWorkspaceFrame(ctx, createWorldEditorFrame(ctx, session, explorer, explorerState));
  return renderEditorWorkspace(ctx, worldEditorChrome(ctx, session, activeExplorerType, browseInstances), frame);
}
