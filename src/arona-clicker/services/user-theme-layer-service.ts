import type {
  BackgroundLayerDef,
  PresentationHostDef,
  PresentationHostState,
} from '../../engine/types/theme';
import type { UserThemeDraft } from '../types/user-theme';

export interface ThemeLayerTargetRef {
  kind: 'global' | 'host';
  hostId?: string;
  state?: PresentationHostState;
}

export type ThemeLayerDirection = 'up' | 'down';

const SYSTEM_COLOR_LAYER_ID = 'system-color-background';
const SAFE_ID = /^[a-zA-Z0-9_-]{1,64}$/;

export function targetRefKey(target: ThemeLayerTargetRef): string {
  return target.kind === 'global'
    ? 'global'
    : `host:${target.hostId ?? ''}:${target.state ?? 'default'}`;
}

function stateOf(target: ThemeLayerTargetRef): PresentationHostState {
  return target.state ?? 'default';
}

function hostOf(draft: UserThemeDraft, target: ThemeLayerTargetRef, create = false): PresentationHostDef | undefined {
  const hostId = target.kind === 'global' ? 'global' : target.hostId;
  if (!hostId) return undefined;
  const hosts = draft.presentation?.hosts ?? (create
    ? ((draft.presentation ??= { hosts: [] }).hosts ??= [])
    : undefined);
  if (!hosts) return undefined;
  let host = hosts.find(item => item.id === hostId);
  if (!host && create) {
    host = { id: hostId };
    hosts.push(host);
  }
  return host;
}

function stateDefOf(host: PresentationHostDef, state: PresentationHostState, create = false): {
  layers?: BackgroundLayerDef[];
  layerOrder?: string[];
} | undefined {
  if (!host) return undefined;
  if (state === 'default') return host;
  if (!host.states && create) host.states = {};
  if (create && host.states && !host.states[state]) host.states[state] = { layers: [] };
  return host.states?.[state];
}

export function getTargetLayers(draft: UserThemeDraft, target: ThemeLayerTargetRef): readonly BackgroundLayerDef[] {
  const host = hostOf(draft, target);
  return stateDefOf(host!, stateOf(target))?.layers ?? [];
}

export function getTargetLayerOrder(draft: UserThemeDraft, target: ThemeLayerTargetRef): readonly string[] {
  const host = hostOf(draft, target);
  return stateDefOf(host!, stateOf(target))?.layerOrder ?? [];
}

export function hasLocalTarget(draft: UserThemeDraft, target: ThemeLayerTargetRef): boolean {
  const host = hostOf(draft, target);
  if (!host) return false;
  return stateOf(target) === 'default' ? host.layers !== undefined : host.states?.[stateOf(target)] !== undefined;
}

function setLayers(draft: UserThemeDraft, target: ThemeLayerTargetRef, layers: BackgroundLayerDef[]): void {
  const host = hostOf(draft, target, true)!;
  const stateDef = stateDefOf(host, stateOf(target), true)!;
  stateDef.layers = layers;
}

function setOrder(draft: UserThemeDraft, target: ThemeLayerTargetRef, order: string[]): void {
  const host = hostOf(draft, target, true)!;
  const stateDef = stateDefOf(host, stateOf(target), true)!;
  stateDef.layerOrder = order;
}

function idBase(target: ThemeLayerTargetRef, index: number): string {
  const prefix = target.kind === 'global' ? 'user-background' : `${target.hostId ?? 'host'}-${stateOf(target)}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${prefix}-layer-${index + 1}`;
}

function normalizedId(candidate: string | undefined, target: ThemeLayerTargetRef, index: number, used: Set<string>): string {
  let id = candidate && SAFE_ID.test(candidate) && candidate !== SYSTEM_COLOR_LAYER_ID ? candidate : idBase(target, index);
  let suffix = 2;
  while (used.has(id) || id === SYSTEM_COLOR_LAYER_ID) id = `${candidate && SAFE_ID.test(candidate) ? candidate : idBase(target, index)}-${suffix++}`;
  used.add(id);
  return id;
}

function normalizeTarget(draft: UserThemeDraft, target: ThemeLayerTargetRef): void {
  const layers = [...getTargetLayers(draft, target)];
  const order = getTargetLayerOrder(draft, target);
  if (!hasLocalTarget(draft, target) && layers.length === 0 && order.length === 0) return;
  const oldIds = layers.map(layer => layer.id);
  const used = new Set<string>();
  const ids = layers.map((layer, index) => normalizedId(layer.id, target, index, used));
  layers.forEach((layer, index) => { layer.id = ids[index]; });
  const oldToNew = new Map<string, string>();
  oldIds.forEach((oldId, index) => { if (oldId) oldToNew.set(oldId, ids[index]); });
  const nextOrder: string[] = [];
  for (const id of order) {
    const mapped = oldToNew.get(id) ?? id;
    if ((mapped === SYSTEM_COLOR_LAYER_ID || used.has(mapped)) && !nextOrder.includes(mapped)) nextOrder.push(mapped);
  }
  for (const id of ids) if (!nextOrder.includes(id)) nextOrder.push(id);
  if (target.kind === 'global' && !nextOrder.includes(SYSTEM_COLOR_LAYER_ID)) nextOrder.unshift(SYSTEM_COLOR_LAYER_ID);
  setLayers(draft, target, layers);
  setOrder(draft, target, nextOrder);
}

export function normalizeUserThemeLayerIds(draft: UserThemeDraft): void {
  normalizeTarget(draft, { kind: 'global' });
  for (const host of draft.presentation?.hosts ?? []) {
    normalizeTarget(draft, { kind: 'host', hostId: host.id, state: 'default' });
    for (const state of ['active', 'inactive', 'disabled'] as const) {
      if (host.states?.[state]) normalizeTarget(draft, { kind: 'host', hostId: host.id, state });
    }
  }
}

export function materializeTargetLayers(
  draft: UserThemeDraft,
  target: ThemeLayerTargetRef,
  resolvedLayers: readonly BackgroundLayerDef[],
): readonly BackgroundLayerDef[] {
  if (hasLocalTarget(draft, target)) return getTargetLayers(draft, target);
  const fallback = resolvedLayers
    .filter(layer => target.kind !== 'global' || layer.id !== SYSTEM_COLOR_LAYER_ID)
    .map(layer => structuredClone(layer));
  setLayers(draft, target, fallback);
  normalizeTarget(draft, target);
  return getTargetLayers(draft, target);
}

export function addTargetLayer(draft: UserThemeDraft, target: ThemeLayerTargetRef, layer: BackgroundLayerDef): string {
  normalizeTarget(draft, target);
  const layers = [...getTargetLayers(draft, target)];
  const id = normalizedId(layer.id, target, layers.length, new Set(layers.map(item => item.id).filter((value): value is string => Boolean(value))));
  layers.push({ ...structuredClone(layer), id, enabled: layer.enabled !== false ? undefined : false });
  setLayers(draft, target, layers);
  const order = [...getTargetLayerOrder(draft, target)];
  if (!order.includes(id)) order.push(id);
  if (target.kind === 'global' && !order.includes(SYSTEM_COLOR_LAYER_ID)) order.unshift(SYSTEM_COLOR_LAYER_ID);
  setOrder(draft, target, order);
  return id;
}

export function updateTargetLayer(draft: UserThemeDraft, target: ThemeLayerTargetRef, layerId: string, next: BackgroundLayerDef): boolean {
  normalizeTarget(draft, target);
  const layers = [...getTargetLayers(draft, target)];
  const index = layers.findIndex(layer => layer.id === layerId);
  if (index < 0) return false;
  const used = new Set(layers.map(layer => layer.id).filter((id): id is string => Boolean(id)));
  used.delete(layerId);
  const nextId = normalizedId(next.id, target, index, used);
  layers[index] = { ...structuredClone(next), id: nextId, enabled: next.enabled === false ? false : undefined };
  setLayers(draft, target, layers);
  if (nextId !== layerId) setOrder(draft, target, getTargetLayerOrder(draft, target).map(id => id === layerId ? nextId : id));
  return true;
}

/** 清除某个目标的本地覆盖；host 没有其他用户配置时连 host 记录一起移除。 */
export function clearTargetOverride(draft: UserThemeDraft, target: ThemeLayerTargetRef): boolean {
  const host = hostOf(draft, target);
  if (!host) return false;
  if (stateOf(target) === 'default') { delete host.layers; delete host.layerOrder; }
  else if (host.states) { delete host.states[stateOf(target)]; }
  if (!host.layers && !host.layerOrder && !host.opacity && !host.states && !host.decoration && !host.shape && !host.cornerRadius && !host.skewXDeg && !host.textColorMode) {
    draft.presentation!.hosts = draft.presentation!.hosts?.filter(item => item !== host);
  }
  return true;
}

/** 构造一份仅用于预览的 draft：目标层被 layer 临时替换（layerId 为空则追加），不写回会话 draft。 */
export function withPreviewLayer(
  draft: UserThemeDraft,
  target: ThemeLayerTargetRef,
  layerId: string | null,
  layer: BackgroundLayerDef,
  resolvedLayers: readonly BackgroundLayerDef[] = [],
): UserThemeDraft {
  const next = structuredClone(draft);
  const previewId = layerId ?? layer.id ?? `preview-${targetRefKey(target)}`;
  const layers = hasLocalTarget(next, target) ? [...getTargetLayers(next, target)] : resolvedLayers.map(item => structuredClone(item));
  const index = layerId ? layers.findIndex(item => item.id === layerId) : -1;
  if (index >= 0) layers[index] = { ...layer, id: previewId };
  else layers.push({ ...layer, id: previewId });
  setLayers(next, target, layers);
  const order = [...getTargetLayerOrder(next, target)];
  // 目标还没有本地覆盖时 stored order 为空；必须用带入层的实际堆叠顺序补齐，
  // 否则缺序的层在 theme-runtime 的顺序排序里会被推到最顶，遮住正在预览的层。
  for (const item of layers) if (item.id && !order.includes(item.id)) order.push(item.id);
  if (!order.includes(previewId)) order.push(previewId);
  if (target.kind === 'global' && !order.includes(SYSTEM_COLOR_LAYER_ID)) order.unshift(SYSTEM_COLOR_LAYER_ID);
  setOrder(next, target, order);
  return next;
}

export function removeTargetLayer(draft: UserThemeDraft, target: ThemeLayerTargetRef, layerId: string): boolean {
  if (layerId === SYSTEM_COLOR_LAYER_ID) return false;
  normalizeTarget(draft, target);
  const layers = [...getTargetLayers(draft, target)];
  const index = layers.findIndex(layer => layer.id === layerId);
  if (index < 0) return false;
  layers.splice(index, 1);
  setLayers(draft, target, layers);
  setOrder(draft, target, getTargetLayerOrder(draft, target).filter(id => id !== layerId));
  return true;
}

export function moveTargetLayer(draft: UserThemeDraft, target: ThemeLayerTargetRef, layerId: string, direction: ThemeLayerDirection): boolean {
  normalizeTarget(draft, target);
  const order = [...getTargetLayerOrder(draft, target)];
  const index = order.indexOf(layerId);
  const next = index + (direction === 'up' ? 1 : -1);
  if (index < 0 || next < 0 || next >= order.length) return false;
  [order[index], order[next]] = [order[next], order[index]];
  setOrder(draft, target, order);
  return true;
}

export function setTargetLayerEnabled(draft: UserThemeDraft, target: ThemeLayerTargetRef, layerId: string, enabled: boolean): boolean {
  normalizeTarget(draft, target);
  const layers = [...getTargetLayers(draft, target)];
  const layer = layers.find(item => item.id === layerId);
  if (!layer) return false;
  layer.enabled = enabled ? undefined : false;
  setLayers(draft, target, layers);
  return true;
}
