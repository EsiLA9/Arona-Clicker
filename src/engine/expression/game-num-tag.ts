// ============================================================
// engine/expression/game-num-tag.ts — GameNumSystem 区表写入 + Affector 桥接
// 从 game-num.ts 拆出：registerTagEffect / registerEntityEffect / removeTagEffect
//   / removeTagEffectsBySource / syncAffectorZoneEffects
//   / registerAffectorModifier
//
// Phase 1 起：state.tagEffects / state.entityEffects 是唯一真相，写入只落 state 表；
// zone 求值由 aggregateZone 扫描 state 表（game-num-eval.ts），本文件不再维护
// childMulMap 投影。zoneIndex 降级为定向失效索引（写入后反查 zone 节点 markDirty）。
//
// 注意：本模块所有函数都信任调用方传入的 state 即当前 PlayerState。
// GameNumSystem.state 若与 GameInstance._state 脱钩（startNewGame 后未重新 buildAll），
// 会导致写入/清理落错对象——见 docs/todoTask/taskProduction/HANDOFF.md「Phase 1 阻塞项」。
// ============================================================

import type { ValueExpression } from '../types';
import type { GameNumState } from '../contracts/state-query';
import type { GameNumAffectorContext } from '../contracts/evaluation-context';
import type { GameNumSystem } from './game-num';
import type { GameNum } from './game-num-internal';
import type { GameNumFlowSource } from '../contracts/evaluation-context';
import { tagId } from '../core/tag';
import { TagEffectRecord, EntityRef, entityKey, ZoneModifierDecl } from './tag-effect';
import { exprResourceDepsOf, ensureFlowsNodes } from './game-num-build';
import { flowBucketKey } from './game-num-eval';

// ---- 区表写入 ----

/** 区记录 value 的资源依赖：const / 字面量无依赖，expr 经类型化扫描取 source='res' 集合。 */
function recordValueResourceDeps(record: TagEffectRecord): Set<string> {
  const v = record.value;
  if (v === undefined || typeof v === 'number' || v.kind !== 'expr') return new Set();
  return exprResourceDepsOf(v.expr);
}

/** 区记录 value 读资源时登记 key -> 资源依赖（resourceChanged 定向失效用；只增不减，过标记安全）。 */
function accumulateKeyResourceDeps(system: GameNumSystem, key: string, record: TagEffectRecord): void {
  const deps = recordValueResourceDeps(record);
  if (deps.size === 0) return;
  const set = system.zoneKeyResourceDeps.get(key) ?? new Set<string>();
  for (const d of deps) set.add(d);
  system.zoneKeyResourceDeps.set(key, set);
}

export function registerTagEffect(system: GameNumSystem, state: GameNumState, tagKey: string, record: TagEffectRecord): void {
  const list = ((state.tagEffects ??= {})[tagKey] ??= []);
  const i = list.findIndex(r => r.id === record.id);
  if (i >= 0) {
    removeSourceLocation(system, list[i], 'tag', tagKey);
    list[i] = record;
  }
  else list.push(record);
  addSourceLocation(system, record, 'tag', tagKey);
  accumulateKeyResourceDeps(system, tagKey, record);
  markZoneDirty(system, tagKey);
}

export function registerEntityEffect(system: GameNumSystem, state: GameNumState, entityKeyStr: string, record: TagEffectRecord): void {
  const list = ((state.entityEffects ??= {})[entityKeyStr] ??= []);
  const i = list.findIndex(r => r.id === record.id);
  if (i >= 0) {
    removeSourceLocation(system, list[i], 'entity', entityKeyStr);
    list[i] = record;
  }
  else list.push(record);
  addSourceLocation(system, record, 'entity', entityKeyStr);
  accumulateKeyResourceDeps(system, entityKeyStr, record);
  markZoneDirty(system, entityKeyStr);
}

export function removeTagEffect(system: GameNumSystem, state: GameNumState, tagKey: string, id: string): void {
  const list = state.tagEffects?.[tagKey];
  if (list) {
    const i = list.findIndex(r => r.id === id);
    if (i >= 0) {
      const [removed] = list.splice(i, 1);
      removeSourceLocation(system, removed, 'tag', tagKey);
    }
  }
  markZoneDirty(system, tagKey);
}

export function removeTagEffectsBySource(system: GameNumSystem, state: GameNumState, source: string): void {
  const affectedKeys = new Set<string>();
  const locations = system.sourceEffectLocations.get(source);
  if (!locations) return;
  for (const location of locations) {
    const table = location.table === 'tag' ? state.tagEffects : state.entityEffects;
    const list = table?.[location.key];
    if (!list) continue;
    const index = list.findIndex(record => record.id === location.recordId && record.source === source);
    if (index >= 0) {
      list.splice(index, 1);
      affectedKeys.add(location.key);
    }
  }
  system.sourceEffectLocations.delete(source);
  for (const key of affectedKeys) markZoneDirty(system, key);
}

function addSourceLocation(
  system: GameNumSystem,
  record: TagEffectRecord,
  table: 'tag' | 'entity',
  key: string,
): void {
  if (!record.source) return;
  const locations = system.sourceEffectLocations.get(record.source) ?? new Set();
  for (const location of locations) {
    if (location.table === table && location.key === key && location.recordId === record.id) return;
  }
  locations.add({ table, key, recordId: record.id });
  system.sourceEffectLocations.set(record.source, locations);
}

function removeSourceLocation(
  system: GameNumSystem,
  record: TagEffectRecord | undefined,
  table: 'tag' | 'entity',
  key: string,
): void {
  if (!record?.source) return;
  const locations = system.sourceEffectLocations.get(record.source);
  if (!locations) return;
  for (const location of locations) {
    if (location.table === table && location.key === key && location.recordId === record.id) {
      locations.delete(location);
      break;
    }
  }
  if (locations.size === 0) system.sourceEffectLocations.delete(record.source);
}

// ---- 定向失效（zoneIndex 反查） ----

/** 按 tagKey / entityKey 反查命中的 zone 节点并沿 parents 传播 markDirty。 */
export function markZoneDirty(system: GameNumSystem, key: string): void {
  const entry = system.zoneIndex.get(key);
  if (!entry) return;
  for (const n of entry.flat) markDirty(system, n);
  for (const n of entry.mul) markDirty(system, n);
}

// ---- Affector 桥接 ----

export function syncAffectorZoneEffects(system: GameNumSystem, affector: GameNumAffectorContext, state: GameNumState): void {
  const activeSources = new Set<string>();
  for (const instance of affector.getActiveInstances()) {
    const source = `affector:${instance.instanceId}`;
    activeSources.add(source);
    removeTagEffectsBySource(system, state, source);
    const pack = affector.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!isActiveEntry(instance, entry.id)) continue;
      for (const modifier of entry.zoneModifiers ?? []) {
        const packModName = pack.id.includes(':') ? pack.id.split(':')[0] : 'base';
        registerAffectorModifier(system, state, source, modifier, instance.mountEntityId, packModName);
      }
    }
  }
  for (const source of system.syncedAffectorSources) {
    if (!activeSources.has(source)) removeTagEffectsBySource(system, state, source);
  }
  system.syncedAffectorSources = activeSources;
  ensureFlowsNodes(system, affector);
  rebuildActiveFlowIndex(system, affector);
}

/** 同步活跃 flow 的 bucket 与资源依赖；求值阶段不再扫描所有 Active Affector。 */
function rebuildActiveFlowIndex(system: GameNumSystem, affector: GameNumAffectorContext): void {
  const flowsDeps = new Map<string, Set<string>>();
  const flowSources = new Map<string, GameNumFlowSource[]>();
  for (const instance of affector.getActiveInstances()) {
    const pack = affector.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!isActiveEntry(instance, entry.id)) continue;
      for (const flow of entry.flows ?? []) {
        const bucket = flowBucketKey(flow.resource, resolveFlowMount(system, instance.mountEntityId));
        const sources = flowSources.get(bucket) ?? [];
        sources.push({ flow });
        flowSources.set(bucket, sources);
        if (typeof flow.value === 'number') continue;
        const deps = exprResourceDepsOf(flow.value);
        if (deps.size === 0) continue;
        const set = flowsDeps.get(flow.resource) ?? new Set<string>();
        for (const d of deps) set.add(d);
        flowsDeps.set(flow.resource, set);
      }
    }
  }
  system.flowsResourceDeps = flowsDeps;
  system.affectorFlowSources = flowSources;
}

function resolveFlowMount(system: GameNumSystem, mountEntityId: string): string | undefined {
  if (system.registry.spots.has(mountEntityId)) return mountEntityId;
  if (system.registry.areas?.has(mountEntityId)) return mountEntityId;
  if (system.registry.inits?.has(mountEntityId)) return mountEntityId;
  return undefined;
}

function isActiveEntry(instance: { activeEntryIds: readonly string[]; activeEntryIdSet?: ReadonlySet<string> }, entryId: string): boolean {
  return instance.activeEntryIdSet?.has(entryId) ?? instance.activeEntryIds.includes(entryId);
}

function registerAffectorModifier(system: GameNumSystem, state: GameNumState, source: string, modifier: ZoneModifierDecl, mountEntityId: string, defaultModName: string): void {
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
    ...(modifier.resource ? { resource: modifier.resource } : {}),
    ...(modifier.min !== undefined ? { min: modifier.min } : {}),
    ...(modifier.max !== undefined ? { max: modifier.max } : {}),
  };
  if (modifier.target.kind === 'tag') {
    registerTagEffect(system, state, tagId(modifier.target.tag, defaultModName), record);
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

/** 自根向下整棵子树标脏（resourceChanged 定向失效：受影响 primitiveGain 的子树整体重算；
 * DAG 共享节点（zone 节点）会被多次标记，无害）。 */
export function markSubtreeDirty(root: GameNum): void {
  const stack: GameNum[] = [root];
  const seen = new Set<GameNum>();
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    n.dirty = true;
    n.cached = undefined;
    if (n.kind === 'add' || n.kind === 'sub' || n.kind === 'mul') {
      for (const c of n.children) stack.push(c);
    }
  }
}
