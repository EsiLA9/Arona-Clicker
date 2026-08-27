// ============================================================
// engine/expression/game-num-build.ts — GameNumSystem 树构建
// 从 game-num.ts 拆出：buildAll / buildResourceGain / buildSpotProduction
//   / buildZoneNode / rebuildZoneIndex / registerZoneNode
//   / allEntitiesOfKind / scopeTags / linkHierarchy / setParent / collect
// ============================================================

import type { PlayerState } from '../types';
import type { Registry } from '../registry/registry';
import type { GameNumSystem } from './game-num';
import type { GameNum, ZoneNode, MulNode } from './game-num-internal';
import { TagPath } from '../core/tag';
import { EntityRef, entityKey, tagPrefixesBottomUp } from './tag-effect';

// ---- 构建 ----

export function buildAll(system: GameNumSystem, state?: PlayerState): void {
  system.state = state;
  system.gains.clear();
  system.named.clear();
  system.spotSubtrees.clear();
  system.spotZone.clear();
  system.zoneIndex.clear();
  system.entityZoneNodes.clear();
  system.parents.clear();
  system.allNodes = [];
  system.zoneNodes = [];
  system.syncedAffectorSources.clear();

  // 先建 Area / Init 乘区节点（逐级上抛的上层）
  if (system.registry.areas) {
    for (const area of system.registry.areas.values()) {
      buildZoneNode(system, { kind: 'area', id: area.id }, 'mul');
    }
  }
  if (system.registry.inits) {
    for (const init of system.registry.inits.values()) {
      buildZoneNode(system, { kind: 'init', id: init.id }, 'mul');
    }
  }

  const resourceSet = new Set<string>();
  for (const spot of system.registry.spots.values()) if (spot.baseYieldResource) resourceSet.add(spot.baseYieldResource);
  if (system.registry.resourceDisplays) for (const r of system.registry.resourceDisplays.keys()) resourceSet.add(r);
  if (state?.resources) for (const r of Object.keys(state.resources)) resourceSet.add(r);
  system.resourceSet = resourceSet;
  for (const res of resourceSet) {
    system.gains.set(res, buildResourceGain(system, system.registry, res));
  }
  system.mayReadResources = gainsMayReadResource(system);
}

function buildResourceGain(system: GameNumSystem, registry: Registry, resource: string): GameNum {
  const children: GameNum[] = [];
  const root: GameNum = { id: `primitiveGain:${resource}`, kind: 'add', children };
  for (const spot of registry.spots.values()) {
    if (spot.baseYieldResource !== resource) continue;
    const sub = buildSpotProduction(system, spot.id);
    setParent(system, sub, root);
    children.push(sub);
  }
  const affectorNode: GameNum = { id: `affectors:${resource}`, kind: 'affectorFlows', resource };
  system.allNodes.push(affectorNode);
  children.push(affectorNode);
  collect(system, root);
  return root;
}

function buildSpotProduction(system: GameNumSystem, spotId: string): GameNum {
  const spot = system.registry.spots.get(spotId)!;

  const base: GameNum = spot.baseYield
    ? { id: `base:${spotId}`, kind: 'expr', expr: spot.baseYield }
    : { id: `base:${spotId}`, kind: 'const', value: 0 };
  const levelLinear: GameNum | undefined = spot.yieldPerLevel
    ? { id: `levelLinear:${spotId}`, kind: 'levelLinear', spotId }
    : undefined;
  const baseYield: GameNum = {
    id: `baseYield:${spotId}`,
    kind: 'add',
    children: levelLinear ? [base, levelLinear] : [base],
  };

  const flatZone = buildZoneNode(system, { kind: 'spot', id: spotId }, 'flat', spot.baseYieldResource);
  const baseLine: GameNum = { id: `baseLine:${spotId}`, kind: 'add', children: [baseYield, flatZone] };

  const mulZone = buildZoneNode(system, { kind: 'spot', id: spotId }, 'mul', spot.baseYieldResource);
  mulZone.childMulMap!.set('defaultMul', []);
  mulZone.childMulMap!.set('defaultAddMul', []);

  const owned: GameNum = { id: `owned:${spotId}`, kind: 'owned', spotId };
  const spotMul: GameNum = { id: `spot:${spotId}`, kind: 'mul', children: [owned, baseLine, mulZone] };

  // 逐级上抛
  const area = system.registry.areas?.get(spot.areaId);
  if (area) {
    const aNode = system.entityZoneNodes.get(entityKey({ kind: 'area', id: area.id }));
    if (aNode) linkHierarchy(system, spotMul, aNode);
    const init = system.registry.inits?.get(area.initId);
    if (init) {
      const iNode = system.entityZoneNodes.get(entityKey({ kind: 'init', id: init.id }));
      if (iNode) linkHierarchy(system, spotMul, iNode);
    }
  }

  setParent(system, owned, spotMul);
  setParent(system, flatZone, baseLine);
  setParent(system, baseLine, spotMul);
  setParent(system, mulZone, spotMul);

  collect(system, spotMul);
  system.spotSubtrees.set(spotId, spotMul);
  system.spotZone.set(spotId, { flat: flatZone, mul: mulZone });
  return spotMul;
}

export function buildZoneNode(system: GameNumSystem, scope: EntityRef, part: 'flat' | 'mul', resource?: string): ZoneNode {
  const id = `zone:${scope.kind}:${scope.id}:${part}${resource ? `:${resource}` : ''}`;
  const existing = system.zoneNodeById.get(id);
  if (existing) return existing;
  const node: ZoneNode = {
    id,
    kind: 'zone' as const,
    scope,
    part,
    ...(resource ? { resource } : {}),
    childMulMap: new Map(),
  };
  registerZoneNode(system, node);
  system.allNodes.push(node);
  system.zoneNodes.push(node);
  system.zoneNodeById.set(id, node);
  return node;
}

export function rebuildZoneIndex(system: GameNumSystem): void {
  system.zoneIndex.clear();
  for (const n of system.zoneNodes) registerZoneNode(system, n);
}

function registerZoneNode(system: GameNumSystem, node: ZoneNode): void {
  const keys = tagPrefixesBottomUp(scopeTags(system, node.scope)).map(k => k as string);
  keys.push(entityKey(node.scope));
  for (const k of keys) {
    let entry = system.zoneIndex.get(k);
    if (!entry) {
      entry = { flat: new Set(), mul: new Set() };
      system.zoneIndex.set(k, entry);
    }
    entry[node.part].add(node);
  }
  if (node.scope.kind === 'area' || node.scope.kind === 'init') {
    system.entityZoneNodes.set(entityKey(node.scope), node);
  }
}

function allEntitiesOfKind(system: GameNumSystem, kind: EntityRef['kind']): EntityRef[] {
  if (kind === 'spot') return [...system.registry.spots.keys()].map(id => ({ kind, id }));
  if (kind === 'area') return [...system.registry.areas?.keys() ?? []].map(id => ({ kind, id }));
  if (kind === 'init') return [...system.registry.inits?.keys() ?? []].map(id => ({ kind, id }));
  return [];
}

function scopeTags(system: GameNumSystem, scope: EntityRef): TagPath[] {
  interface TaggedDef { tags?: TagPath[] }
  let def: TaggedDef | undefined;
  switch (scope.kind) {
    case 'spot': def = system.registry.spots.get(scope.id) as TaggedDef | undefined; break;
    case 'area': def = system.registry.areas.get(scope.id) as TaggedDef | undefined; break;
    case 'init': def = system.registry.inits.get(scope.id) as TaggedDef | undefined; break;
    case 'enhancement': def = system.registry.enhancements.get(scope.id) as TaggedDef | undefined; break;
  }
  return def?.tags ?? [];
}

function linkHierarchy(system: GameNumSystem, spotMul: GameNum, upperNode: GameNum): void {
  const sm = spotMul as MulNode;
  const map = sm.childMulMap ??= new Map();
  let list = map.get('hierarchy');
  if (!list) {
    list = [];
    map.set('hierarchy', list);
  }
  list.push({
    id: `hier:${upperNode.id}`,
    kind: 'sub' as const,
    children: [upperNode, { id: `hier:${upperNode.id}:1`, kind: 'const' as const, value: 1 }],
  });
  setParent(system, upperNode, spotMul);
}

export function setParent(system: GameNumSystem, child: GameNum, parent: GameNum): void {
  const arr = system.parents.get(child.id) ?? [];
  if (!arr.includes(parent)) arr.push(parent);
  system.parents.set(child.id, arr);
}

export function collect(system: GameNumSystem, node: GameNum): void {
  if (system.allNodes.includes(node)) return;
  system.allNodes.push(node);
  const kids: GameNum[] =
    node.kind === 'add' || node.kind === 'sub' || node.kind === 'mul' || node.kind === 'div' || node.kind === 'min' || node.kind === 'max' || node.kind === 'pow'
      ? node.children
      : node.kind === 'clamp'
        ? [node.min, node.value, node.max]
        : node.kind === 'floor' || node.kind === 'ceil' || node.kind === 'round'
          ? [node.child]
          : node.kind === 'cond'
            ? [node.test, node.then, node.else]
            : [];
  for (const c of kids) collect(system, c);
}

// ---- 内部：gainsMayReadResource ----

export function gainsMayReadResource(system: GameNumSystem): boolean {
  for (const node of system.gains.values()) {
    let found = false;
    const walk = (n: GameNum): void => {
      if (found) return;
      if (n.kind === 'expr') {
        found = JSON.stringify(n.expr).includes('"source":"res"') || JSON.stringify(n.expr).includes('"source":"resource"');
        return;
      }
      const kids =
        n.kind === 'add' || n.kind === 'sub' || n.kind === 'mul' || n.kind === 'div' || n.kind === 'min' || n.kind === 'max' || n.kind === 'pow'
          ? n.children
          : n.kind === 'clamp'
            ? [n.min, n.value, n.max]
            : n.kind === 'floor' || n.kind === 'ceil' || n.kind === 'round'
              ? [n.child]
              : n.kind === 'cond'
                ? [n.test, n.then, n.else]
                : [];
      for (const c of kids) walk(c);
    };
    walk(node);
    if (found) return true;
  }
  return false;
}