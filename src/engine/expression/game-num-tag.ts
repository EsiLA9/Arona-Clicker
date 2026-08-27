// ============================================================
// engine/expression/game-num-tag.ts — GameNumSystem 区表维护 + Affector 桥接
// 从 game-num.ts 拆出：registerTagEffect / registerEntityEffect / removeTagEffect
//   / removeTagEffectsBySource / clearTagEffectsByLife / routeToZoneNodes
//   / addContribution / applyBound / toValueNode / removeContribByKey
//   / syncAffectorZoneEffects / registerAffectorModifier
// ============================================================

import type { PlayerState, ValueExpression } from '../types';
import type { AffectorEngine } from '../effect/affector-engine';
import type { GameNumSystem } from './game-num';
import type { GameNum, ZoneNode, MulNode } from './game-num-internal';
import { tagId } from '../core/tag';
import { TagEffectRecord, EntityRef, entityKey, ZoneModifierDecl } from './tag-effect';

// ---- 区表写入 ----

export function registerTagEffect(system: GameNumSystem, state: PlayerState, tagKey: string, record: TagEffectRecord): void {
  const list = ((state.tagEffects ??= {})[tagKey] ??= []);
  const i = list.findIndex(r => r.id === record.id);
  if (i >= 0) list[i] = record;
  else list.push(record);
  routeToZoneNodes(system, tagKey, record);
}

export function registerEntityEffect(system: GameNumSystem, state: PlayerState, entityKeyStr: string, record: TagEffectRecord): void {
  const list = ((state.entityEffects ??= {})[entityKeyStr] ??= []);
  const i = list.findIndex(r => r.id === record.id);
  if (i >= 0) list[i] = record;
  else list.push(record);
  routeToZoneNodes(system, entityKeyStr, record);
}

export function removeTagEffect(system: GameNumSystem, state: PlayerState, tagKey: string, id: string): void {
  const list = state.tagEffects?.[tagKey];
  const rec = list?.find(r => r.id === id);
  if (list) {
    const i = list.findIndex(r => r.id === id);
    if (i >= 0) list.splice(i, 1);
  }
  removeContribByKey(system, tagKey, rec?.source, id);
}

export function removeTagEffectsBySource(system: GameNumSystem, state: PlayerState, source: string): void {
  if (state.tagEffects) {
    for (const list of Object.values(state.tagEffects)) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].source === source) list.splice(i, 1);
    }
  }
  if (state.entityEffects) {
    for (const list of Object.values(state.entityEffects)) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].source === source) list.splice(i, 1);
    }
  }
  const prefix = `contrib:${source}:`;
  for (const n of system.zoneNodes) {
    let changed = false;
    const zn = n as MulNode;
    if (zn.childMulMap) {
      for (const list of zn.childMulMap.values()) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].id.startsWith(prefix)) {
            list.splice(i, 1);
            changed = true;
          }
        }
      }
    }
    if (zn.bound && zn.bound.source?.startsWith(source)) {
      zn.bound = undefined;
      changed = true;
    }
    if (changed) markDirty(system, n);
  }
}

export function clearTagEffectsByLife(system: GameNumSystem, state: PlayerState, life: 'global' | 'init' | 'snapshot'): void {
  if (state.tagEffects) {
    for (const list of Object.values(state.tagEffects)) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].life === life) list.splice(i, 1);
    }
  }
  if (state.entityEffects) {
    for (const list of Object.values(state.entityEffects)) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].life === life) list.splice(i, 1);
    }
  }
  markAllDirty(system);
}

// ---- 命名乘区路由 ----

function routeToZoneNodes(system: GameNumSystem, key: string, record: TagEffectRecord): void {
  const entry = system.zoneIndex.get(key);
  if (!entry) return;
  const resMatch = (n: GameNum) => {
    const zn = n as ZoneNode;
    return !record.resource || !zn.resource || record.resource === zn.resource;
  };
  const targets = record.category === 'flat' ? entry.flat : entry.mul;
  for (const n of targets) {
    if (!resMatch(n)) continue;
    if (record.category === 'flat') addContribution(system, n, 'flat', record);
    else if (record.category === 'bound') applyBound(system, n, record);
    else addContribution(system, n, record.multiplierId ?? 'defaultMul', record);
    markDirty(system, n);
  }
}

function addContribution(system: GameNumSystem, node: GameNum, zoneName: string, record: TagEffectRecord): void {
  const n = node as MulNode;
  const map = n.childMulMap ??= new Map();
  let list = map.get(zoneName);
  if (!list) {
    list = [];
    map.set(zoneName, list);
  }
  const contribId = `contrib:${record.source}:${record.id}`;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].id === contribId) list.splice(i, 1);
  const valueNode = toValueNode(record.value);
  const child: GameNum =
    record.category === 'flat'
      ? { ...valueNode, id: contribId }
      : { id: contribId, kind: 'sub', children: [valueNode, { id: `${contribId}:1`, kind: 'const', value: 1 }] };
  list.push(child);
}

function applyBound(system: GameNumSystem, node: GameNum, record: TagEffectRecord): void {
  const n = node as MulNode;
  const min = record.min ?? -Infinity;
  const max = record.max ?? Infinity;
  const prev = n.bound;
  n.bound = {
    min: prev ? Math.max(prev.min, min) : min,
    max: prev ? Math.min(prev.max, max) : max,
    source: record.source,
  };
}

function toValueNode(v: number | GameNum | undefined): GameNum {
  if (v && typeof v === 'object' && 'kind' in v) return v as GameNum;
  return { id: `const:${Math.random().toString(36).slice(2)}`, kind: 'const', value: typeof v === 'number' ? v : 0 };
}

function removeContribByKey(system: GameNumSystem, key: string, source: string | undefined, id: string): void {
  const entry = system.zoneIndex.get(key);
  if (!entry) return;
  const contribId = `contrib:${source}:${id}`;
  for (const n of [...entry.flat, ...entry.mul]) {
    let changed = false;
    const zn = n as MulNode;
    if (zn.childMulMap) {
      for (const list of zn.childMulMap.values()) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].id === contribId) {
            list.splice(i, 1);
            changed = true;
          }
        }
      }
    }
    if (zn.bound && zn.bound.source === id) {
      zn.bound = undefined;
      changed = true;
    }
    if (changed) markDirty(system, n);
  }
}

// ---- Affector 桥接 ----

export function syncAffectorZoneEffects(system: GameNumSystem, affector: AffectorEngine, state: PlayerState): void {
  const activeSources = new Set<string>();
  for (const instance of affector.getActiveInstances()) {
    const source = `affector:${instance.instanceId}`;
    activeSources.add(source);
    removeTagEffectsBySource(system, state, source);
    const pack = affector.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!instance.activeEntryIds.includes(entry.id)) continue;
      for (const modifier of entry.zoneModifiers ?? []) {
        registerAffectorModifier(system, state, source, modifier, instance.mountEntityId);
      }
    }
  }
  for (const source of system.syncedAffectorSources) {
    if (!activeSources.has(source)) removeTagEffectsBySource(system, state, source);
  }
  system.syncedAffectorSources = activeSources;
}

function registerAffectorModifier(system: GameNumSystem, state: PlayerState, source: string, modifier: ZoneModifierDecl, mountEntityId: string): void {
  const idSuffix = modifier.multiplierId ? `:${modifier.multiplierId}` : '';
  const id = `${source}:${modifier.category}${idSuffix}`;
  const valueNode: GameNum =
    typeof modifier.value === 'number'
      ? { id, kind: 'const', value: modifier.value }
      : { id, kind: 'expr', expr: modifier.value as ValueExpression };
  const record: TagEffectRecord = {
    id,
    source,
    category: modifier.category,
    ...(modifier.multiplierId ? { multiplierId: modifier.multiplierId } : {}),
    value: valueNode,
    life: modifier.life ?? 'global',
    ...(modifier.resource ? { resource: modifier.resource } : {}),
    ...(modifier.min !== undefined ? { min: modifier.min } : {}),
    ...(modifier.max !== undefined ? { max: modifier.max } : {}),
  };
  if (modifier.target.kind === 'tag') {
    registerTagEffect(system, state, tagId(modifier.target.tag), record);
  } else if (modifier.target.ref.id === '*') {
    for (const e of allEntitiesOfKind(system, modifier.target.ref.kind)) {
      registerEntityEffect(system, state, entityKey(e), record);
    }
  } else {
    registerEntityEffect(system, state, entityKey(modifier.target.ref), record);
  }
}

function allEntitiesOfKind(system: GameNumSystem, kind: EntityRef['kind']): EntityRef[] {
  if (kind === 'spot') return [...system.registry.spots.keys()].map(id => ({ kind, id }));
  if (kind === 'area') return [...system.registry.areas?.keys() ?? []].map(id => ({ kind, id }));
  if (kind === 'init') return [...system.registry.inits?.keys() ?? []].map(id => ({ kind, id }));
  return [];
}

// ---- 脏位（tag 模块复用 markDirty/markAllDirty 内部实现） ----

export function markAllDirty(system: GameNumSystem): void {
  for (const n of system.allNodes) {
    n.dirty = true;
    n.cached = undefined;
  }
}

export function markDirty(system: GameNumSystem, node: GameNum): void {
  const stack: GameNum[] = [node];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.dirty === true) continue;
    n.dirty = true;
    for (const p of system.parents.get(n.id) ?? []) stack.push(p);
  }
}
