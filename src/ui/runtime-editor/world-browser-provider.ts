import type { ContentCatalogQueryPort } from '../../arona-clicker/contracts/runtime/content-catalog';
import type { BrowseInstance, BrowseInstanceSeed } from '../workspace/browse-instance-manager';
import type { EditorResourceOpenRequest } from '../workspace/editor-resource-request';
import type { EditorExplorerNode } from '../workspace/editor-explorer-nodes';
import { renderEditorEntityIcon } from '../components/shared/editor-entity-icon';

export type WorldEntityRef = { kind: 'init' | 'area' | 'spot'; id: string };
export type WorldCatalog = Pick<ContentCatalogQueryPort, 'inits' | 'areas' | 'spots'>;
export interface WorldProviderState {
  target?: WorldEntityRef;
}
export interface WorldBrowseInstanceState {
  provider: WorldProviderState;
}
export type WorldBrowseInstance = BrowseInstance<WorldBrowseInstanceState>;
export interface WorldSummary {
  ref: WorldEntityRef;
  title: string;
  kindLabel: string;
  description: string;
  parent?: { ref: WorldEntityRef; label: string };
  children: { ref: WorldEntityRef; label: string }[];
}

export const worldBrowseProviderKey = 'world';
export const worldBrowseReuseKey = 'world-browser';

const labels: Record<WorldEntityRef['kind'], string> = { init: 'Init', area: 'Area', spot: 'Spot' };

export const worldEntityKey = (ref: WorldEntityRef): string => `${ref.kind}:${ref.id}`;
export function resolveWorldResourceRequest(request: EditorResourceOpenRequest): WorldEntityRef | undefined {
  const { providerKey, resourceKey, kind, id } = request.resource;
  if (providerKey !== worldBrowseProviderKey || !id || (kind !== 'init' && kind !== 'area' && kind !== 'spot')) return undefined;
  const ref = { kind, id } as WorldEntityRef;
  return worldEntityKey(ref) === resourceKey ? ref : undefined;
}
export function worldExplorerNodes(catalog: WorldCatalog): EditorExplorerNode[] {
  const missingParent = 'missing-parent';
  const position = (kind: WorldEntityRef['kind'], entity: { id: string; name: string },
    parentKey?: string, isDefault = false): EditorExplorerNode => {
    const resourceKey = worldEntityKey({ kind, id: entity.id });
    const label = entity.name || entity.id;
    return { placementKey: resourceKey, parentKey, folder: kind === 'spot' ? undefined : {},
      resource: { providerKey: worldBrowseProviderKey, resourceKey, kind, id: entity.id },
      resourceActionLabel: '查看 ' + labels[kind] + ' · ' + label,
      label, searchableText: [label, entity.id], presentation: { kind,
        auxiliaryLabel: labels[kind] + (isDefault ? ' · 默认' : ''), markers: ['strong-label'] } };
  };
  const roots = [...catalog.inits.values()].map(init => position('init', init))
    .sort((a, b) => a.label.localeCompare(b.label) || a.placementKey.localeCompare(b.placementKey));
  const areas = [...catalog.areas.values()].map(area => {
    const init = catalog.inits.get(area.initId);
    return position('area', area, init ? worldEntityKey({ kind: 'init', id: init.id }) : missingParent,
      init?.defaultAreas.includes(area.id));
  });
  const spots = [...catalog.spots.values()].map(spot => {
    const area = catalog.areas.get(spot.areaId);
    return position('spot', spot, area ? worldEntityKey({ kind: 'area', id: area.id }) : missingParent,
      area?.defaultSpots.includes(spot.id));
  });
  if ([...areas, ...spots].some(node => node.parentKey === missingParent)) {
    roots.push({ placementKey: missingParent, folder: {}, label: '归属缺失', searchableText: ['归属缺失'] });
  }
  return [...roots, ...areas, ...spots];
}

export function prepareWorldTarget(catalog: WorldCatalog, ref: WorldEntityRef): WorldEntityRef | undefined {
  const exists = ref.kind === 'init' ? catalog.inits.has(ref.id)
    : ref.kind === 'area' ? catalog.areas.has(ref.id) : catalog.spots.has(ref.id);
  return exists ? { kind: ref.kind, id: ref.id } : undefined;
}

export function initialWorldProviderState(catalog: WorldCatalog, activeInitId?: string): WorldProviderState {
  const init = (activeInitId ? catalog.inits.get(activeInitId) : undefined) ?? catalog.inits.values().next().value;
  return { target: init ? { kind: 'init', id: init.id } : undefined };
}

export function resolveWorldSummary(catalog: WorldCatalog, target?: WorldEntityRef): WorldSummary | undefined {
  if (!target) return undefined;
  const init = target.kind === 'init' ? catalog.inits.get(target.id) : undefined;
  const area = target.kind === 'area' ? catalog.areas.get(target.id) : undefined;
  const spot = target.kind === 'spot' ? catalog.spots.get(target.id) : undefined;
  const entity = init ?? area ?? spot;
  if (!entity) return undefined;
  const children = init ? [...catalog.areas.values()].filter(item => item.initId === init.id).map(item => ({ ref: { kind: 'area' as const, id: item.id }, label: item.name || item.id }))
    : area ? [...catalog.spots.values()].filter(item => item.areaId === area.id).map(item => ({ ref: { kind: 'spot' as const, id: item.id }, label: item.name || item.id })) : [];
  const parent = area ? { ref: { kind: 'init' as const, id: area.initId }, label: catalog.inits.get(area.initId)?.name || area.initId }
    : spot ? { ref: { kind: 'area' as const, id: spot.areaId }, label: catalog.areas.get(spot.areaId)?.name || spot.areaId } : undefined;
  return {
    ref: { kind: target.kind, id: target.id }, title: entity.name || entity.id,
    kindLabel: labels[target.kind], description: entity.description, parent, children,
  };
}

export function prepareWorldBrowseSeed(catalog: WorldCatalog, ref: WorldEntityRef): BrowseInstanceSeed<WorldBrowseInstanceState> | undefined {
  const target = prepareWorldTarget(catalog, ref);
  const summary = target && resolveWorldSummary(catalog, target);
  if (!target || !summary) return undefined;
  return {
    providerKey: worldBrowseProviderKey,
    resourceKey: worldEntityKey(target),
    reuseKey: worldBrowseReuseKey,
    state: { provider: { target } },
    presentation: { title: summary.title, kind: target.kind, typeLabel: 'World', icon: renderEditorEntityIcon(target.kind) },
  };
}
