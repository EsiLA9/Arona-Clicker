import type { PackCatalogReadModel, PackCatalogRecord } from '../../arona-clicker/contracts/runtime/runtime';
import type { UIContext } from '../runtime/context';
import { worldEntityKey, type WorldEntityRef } from '../runtime-editor/world-browser-provider';
import { isLoadedStoryPack } from '../story-editor/pack-source';
import { storyBrowseIdentity } from '../story-editor/workspace-session';
import { chooseEditorExplorerPosition, indexEditorExplorer, type EditorExplorerNode } from './editor-explorer-nodes';
import type { EditorExplorerStateSnapshot } from './editor-explorer-service';
import { editorExplorerKindFilter, type EditorExplorerDescription } from './editor-explorer-column';
import { storyEntryType } from '../../data-services/contracts/story-entry';
import type { EditorEntryIconType } from '../components/shared/editor-entity-icon';

interface PackExplorerItem {
  kind: 'story' | 'entry' | 'init' | 'area' | 'spot';
  id: string;
  label: string;
  entryType?: EditorEntryIconType;
}

function packItems({ datapack }: PackCatalogRecord): PackExplorerItem[] {
  return [
    ...datapack.stories.map(row => ({ kind: 'story' as const, id: row.id, label: row.name || row.id })),
    ...[...datapack.activeStories, ...datapack.passiveStories].map(row =>
      ({ kind: 'entry' as const, id: row.id, label: row.openingTitle || row.id, entryType: storyEntryType(row) })),
    ...datapack.inits.map(row => ({ kind: 'init' as const, id: row.id, label: row.name || row.id })),
    ...datapack.areas.map(row => ({ kind: 'area' as const, id: row.id, label: row.name || row.id })),
    ...datapack.spots.map(row => ({ kind: 'spot' as const, id: row.id, label: row.name || row.id })),
  ];
}

export function runtimeWorldPack(ctx: UIContext, { kind, id }: WorldEntityRef): string | undefined {
  const registry = ctx.game.registry;
  const owner = kind === 'init' ? registry.initOwnerOf?.(id) : kind === 'area' ? registry.areaOwnerOf?.(id) : registry.spotOwnerOf?.(id);
  const query = ctx.game as typeof ctx.game & Partial<PackCatalogReadModel>;
  return owner && query.getRunningStoryPackId?.(owner);
}

export class DatapackExplorer {
  private readonly records = new Map<string, { digest: string; items: readonly PackExplorerItem[] }>();

  nodes(ctx: UIContext): EditorExplorerNode[] {
    const query = ctx.game as typeof ctx.game & Partial<PackCatalogReadModel>;
    const entries = query.getPackCatalog?.().entries ?? [];
    const records = new Set(entries.map(entry => entry.packRecordId ?? entry.id));
    for (const id of this.records.keys()) if (!records.has(id)) this.records.delete(id);
    return entries.flatMap(entry => {
      const packId = entry.packRecordId ?? entry.id;
      const cached = this.records.get(packId);
      const record = cached && cached.digest === entry.contentDigest ? undefined : query.getPackRecord?.(packId);
      const items = record ? packItems(record) : cached?.digest === entry.contentDigest ? cached?.items ?? [] : [];
      if (record && entry.contentDigest) this.records.set(packId, { digest: entry.contentDigest, items });
      const label = `${entry.name} · ${entry.version}`;
      const parentKey = JSON.stringify(['pack', packId]);
      const root: EditorExplorerNode = { placementKey: parentKey, folder: {}, label, searchableText: [label, packId] };
      const children = items.map((item): EditorExplorerNode => {
        const { kind, id } = item;
        const sourceKey = `pack:${packId}`;
        const unavailable = '此资源当前无法从对应的数据包版本打开。';
        let resourceKey: string;
        let available: boolean;
        const isStory = kind === 'story' || kind === 'entry';
        if (kind === 'story' || kind === 'entry') {
          resourceKey = storyBrowseIdentity({ kind, id }, sourceKey).resourceKey;
          available = isLoadedStoryPack(query, entry);
        } else {
          resourceKey = worldEntityKey({ kind, id });
          available = runtimeWorldPack(ctx, { kind, id }) === packId;
        }
        const typeLabel = { story: 'Story', entry: 'Entry', init: 'Init', area: 'Area', spot: 'Spot' }[kind];
        return { placementKey: JSON.stringify([packId, kind, id]), parentKey, label: item.label, searchableText: [item.label, id, typeLabel],
          sourceKey, resource: { providerKey: isStory ? 'story' : 'world', resourceKey, kind, id, ownerModName: entry.modName },
          openDisabledReason: available ? undefined : unavailable,
          presentation: { auxiliaryLabel: typeLabel, entryType: item.entryType } };
      });
      return [root, ...children];
    });
  }

  describe(ctx: UIContext, state: EditorExplorerStateSnapshot, active?: { resourceKey: string; sourceKey: string }): EditorExplorerDescription {
    const positions = this.nodes(ctx);
    const reveal = state.reveal;
    const revealPlacementKey = reveal && chooseEditorExplorerPosition(indexEditorExplorer(positions).candidates(reveal.resourceKey, reveal.sourceKey),
      reveal.placementKey)?.placementKey;
    return { title: '数据包目录', leaveAction: 'data-column-back' as const, panes: [{
      key: 'datapack-directory', title: '数据包目录', scrollKey: 'datapack-tree', listKey: 'datapack-tree-list',
      search: { channel: 'default', label: '搜索数据包内容', className: 'editor-explorer-search',
        attributes: 'data-editor-key="datapack-search"' },
      filters: { id: 'datapack-explorer-filters', defaultOpen: true, facets: [editorExplorerKindFilter(['story', 'entry', 'init', 'area', 'spot'])] },
      tree: { positions, options: { activeResourceKey: active?.resourceKey, activeSourceKey: active?.sourceKey,
        selectedPlacementKey: state.selectedPlacementKey, expandedOverrides: state.expandedOverrides,
        searchExpandedOverrides: state.searchExpandedOverrides, revealPlacementKey },
      emptyMessage: '当前没有已导入的数据包。', noMatchMessage: '没有匹配的数据包内容。' },
    }] };
  }
}
