import type { ContentCatalogQueryPort } from '../../arona-clicker/contracts/runtime/content-catalog';
import type { BrowseInstance, BrowseInstanceSeed } from '../workspace/browse-instance-manager';
import type { EditorResourceOpenRequest } from '../workspace/editor-resource-request';
import type { EditorExplorerNode } from '../workspace/editor-explorer-nodes';

export type WorldEntityRef = { kind: 'init' | 'area' | 'spot'; id: string };
export interface WorldTreeNode {
  key: string;
  label: string;
  ref?: WorldEntityRef;
  isDefault?: boolean;
  children: readonly WorldTreeNode[];
}
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
export const worldEntityIdentity = (ref: WorldEntityRef): string => worldEntityKey(ref);
export function worldTreePlacementIdentity(parentPlacement: string | undefined, ref: WorldEntityRef): string {
  return JSON.stringify([parentPlacement ?? null, worldEntityIdentity(ref)]);
}

export function buildDefaultWorldTree(catalog: WorldCatalog): WorldTreeNode[] {
  type Branch = Omit<WorldTreeNode, 'children'> & { children: Branch[] };
  const branch = (kind: WorldEntityRef['kind'], entity: { id: string; name: string }, parentPlacement?: string, isDefault = false): Branch => {
    const ref = { kind, id: entity.id };
    return { key: worldTreePlacementIdentity(parentPlacement, ref), label: entity.name || entity.id, ref, isDefault, children: [] };
  };
  const inits = new Map([...catalog.inits.values()].map(init => [init.id, branch('init', init)]));
  const areas = new Map<string, Branch>();
  const orphan: Branch = { key: 'missing-parent', label: '归属缺失', children: [] };
  for (const area of catalog.areas.values()) {
    const parent = inits.get(area.initId) ?? orphan;
    const node = branch('area', area, parent.key, Boolean(catalog.inits.get(area.initId)?.defaultAreas.includes(area.id)));
    areas.set(area.id, node);
    parent.children.push(node);
  }
  for (const spot of catalog.spots.values()) {
    const parent = areas.get(spot.areaId) ?? orphan;
    parent.children.push(branch('spot', spot, parent.key, Boolean(catalog.areas.get(spot.areaId)?.defaultSpots.includes(spot.id))));
  }
  const roots = [...inits.values()].sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  if (orphan.children.length) roots.push(orphan);
  return roots;
}

/** Search-ready World projection. The existing World renderer adopts this contract in Task 0422. */
export function worldExplorerNodes(roots: readonly WorldTreeNode[]): EditorExplorerNode[] {
  const project = (node: WorldTreeNode): EditorExplorerNode => {
    const children = node.children.map(project);
    const resource = node.ref ? {
      providerKey: worldBrowseProviderKey, resourceKey: worldEntityKey(node.ref),
      kind: node.ref.kind, id: node.ref.id,
    } : undefined;
    return {
      placementKey: node.key, ...(resource ? { resource } : {}), label: node.label,
      searchableText: [node.label, ...(node.ref ? [node.ref.id] : [])], children,
      childState: children.length ? { kind: 'loaded', totalCount: children.length } : { kind: 'empty' },
      presentation: { kind: node.ref?.kind ?? 'group', auxiliaryLabel: node.ref
        ? `${labels[node.ref.kind]}${node.isDefault ? ' · 默认' : ''}` : undefined,
        markers: [...(node.ref ? ['strong-label'] : []), ...(node.isDefault ? ['default'] : [])] },
    };
  };
  return roots.map(project);
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
    resourceKey: worldEntityIdentity(target),
    reuseKey: worldBrowseReuseKey,
    state: { provider: { target } },
    presentation: { title: summary.title, kind: target.kind },
  };
}
