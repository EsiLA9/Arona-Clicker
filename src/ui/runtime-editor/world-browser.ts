import { chooseEditorExplorerPosition, indexEditorExplorer } from '../workspace/editor-explorer-nodes';
import { editorExplorerKindFilter, type EditorExplorerDescription } from '../workspace/editor-explorer-column';
import { renderEditorReviewFields, renderEditorReviewSection } from '../workspace/editor-review';
import type { UIContext } from '../runtime/context';
import { createEditorWorkspaceColumn } from '../workspace/editor-workspace-frame';
import type { WorkspaceColumnSpec } from '../components/shared/workspace-frame';
import { editorLayout, renderEditorTool, renderEditorToolGroup } from '../workspace/editor-workspace';
import type { EditorExplorerStateSnapshot } from '../workspace/editor-explorer-service';
import type { EditorWorkbenchBusinessChrome, EditorWorkbenchBusinessProjection } from '../workspace/editor-workbench';
import { resolveWorldSummary, worldBrowseProviderKey, worldEntityKey, worldExplorerNodes, type WorldBrowseInstance, type WorldEntityRef, type WorldSummary } from './world-browser-provider';
export { resolveWorldResourceRequest, worldEntityKey, type WorldBrowseInstance, type WorldBrowseInstanceState, type WorldEntityRef, type WorldProviderState } from './world-browser-provider';
export type WorldBrowserSession = WorldBrowseInstance;

const worldColumns = {
  detail: { slot: 'center', key: 'editor-content', title: '内容摘要' },
  review: { slot: 'right', key: 'editor-inspector', title: '便捷信息' },
} as const;
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

export function describeWorldExplorer(ctx: UIContext, state: EditorExplorerStateSnapshot, activeResourceKey?: string): EditorExplorerDescription {
  const positions = worldExplorerNodes(ctx.game.registry);
  const reveal = state.reveal;
  const revealPlacementKey = reveal && chooseEditorExplorerPosition(indexEditorExplorer(positions).candidates(reveal.resourceKey),
    reveal.placementKey ?? state.selectedPlacementKey)?.placementKey;
  return { title: '世界目录', leaveAction: 'data-world-editor-leave', panes: [{
      key: 'world-directory', title: '世界目录', scrollKey: 'world-tree', listKey: 'world-tree-list',
      search: { channel: 'default', label: '搜索世界内容', className: 'editor-explorer-search',
        attributes: 'data-editor-key="world-search"' },
      filters: { id: 'world-explorer-filters', defaultOpen: true, facets: [editorExplorerKindFilter(['init', 'area', 'spot'])] },
      tools: `<button type="button" class="mini-action" data-editor-workspace-action="locate-world"${activeResourceKey ? '' : ' disabled'}>定位当前世界资源</button>`,
      navigationAttribute: 'data-world-tree',
      tree: { positions, options: {
        expandedOverrides: state.expandedOverrides, searchExpandedOverrides: state.searchExpandedOverrides,
        selectedPlacementKey: state.selectedPlacementKey, activeResourceKey, revealPlacementKey,
      }, emptyMessage: '当前没有世界内容。', noMatchMessage: '没有匹配的世界内容。' },
  }] };
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
