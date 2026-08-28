// ============================================================
// engine/expression/game-num-build.ts — GameNumSystem 树构建
// 从 game-num.ts 拆出：buildAll / buildResourceGain / buildSpotProduction
//   / buildZoneNode / rebuildZoneIndex / registerZoneNode
//   / allEntitiesOfKind / scopeTags / setParent / collect / gainResourceDeps
// ============================================================

import type { PlayerState, Value, ValueExpression } from '../types';
import type { Registry } from '../registry/registry';
import type { GameNumSystem } from './game-num';
import type { GameNum, ZoneNode } from './game-num-internal';
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
  system.zoneNodeById.clear();
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
  system.gainResourceDeps = gainResourceDeps(system);
  system.mayReadResources = [...system.gainResourceDeps.values()].some(s => s.size > 0);
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

  const owned: GameNum = { id: `owned:${spotId}`, kind: 'owned', spotId };
  const spotMul: GameNum = { id: `spot:${spotId}`, kind: 'mul', children: [owned, baseLine, mulZone] };

  // 逐级上抛：所属 Area / Init 的乘区以 hierarchy 节点加入 spotMul（显式 add 子节点，
  // 替代旧 childMulMap 的 'hierarchy' 组；值 = 1 + Σ(upperZone - 1)，与旧行为一致）。
  const upperNodes: GameNum[] = [];
  const area = system.registry.areas?.get(spot.areaId);
  if (area) {
    const aNode = system.entityZoneNodes.get(entityKey({ kind: 'area', id: area.id }));
    if (aNode) upperNodes.push(aNode);
    const init = system.registry.inits?.get(area.initId);
    if (init) {
      const iNode = system.entityZoneNodes.get(entityKey({ kind: 'init', id: init.id }));
      if (iNode) upperNodes.push(iNode);
    }
  }
  if (upperNodes.length > 0) {
    const hierarchyAdd: GameNum = {
      id: `hierarchy:${spotId}`,
      kind: 'add',
      children: [{ id: `hierarchy:${spotId}:1`, kind: 'const', value: 1 }],
    };
    for (const upper of upperNodes) {
      const subNode: GameNum = {
        id: `hier:${upper.id}`,
        kind: 'sub',
        children: [upper, { id: `hier:${upper.id}:1`, kind: 'const', value: 1 }],
      };
      hierarchyAdd.children.push(subNode);
      setParent(system, upper, subNode);
      setParent(system, subNode, hierarchyAdd);
    }
    setParent(system, hierarchyAdd, spotMul);
    spotMul.children.push(hierarchyAdd);
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

export function setParent(system: GameNumSystem, child: GameNum, parent: GameNum): void {
  const arr = system.parents.get(child.id) ?? [];
  if (!arr.includes(parent)) arr.push(parent);
  system.parents.set(child.id, arr);
}

export function collect(system: GameNumSystem, node: GameNum): void {
  if (system.allNodes.includes(node)) return;
  system.allNodes.push(node);
  const kids: GameNum[] = node.kind === 'add' || node.kind === 'sub' || node.kind === 'mul' ? node.children : [];
  for (const c of kids) collect(system, c);
}

// ---- 内部：gain 资源依赖静态扫描 ----

/** Value 叶子的资源依赖：仅 source='res' 直接读 state.resources。 */
function valueResourceDeps(val: Value, out: Set<string>): void {
  if (val.source !== 'res') return;
  const id = String(val.params.resource ?? '');
  if (id) out.add(id);
}

/** ValueExpression 的资源依赖（类型化遍历，funclet 参数为字面量不展开其 calc）。 */
function exprResourceDeps(expr: ValueExpression, out: Set<string>): void {
  switch (expr.type) {
    case 'const':
      return;
    case 'value':
      valueResourceDeps(expr.value, out);
      return;
    case 'floor':
    case 'ceil':
    case 'round':
      exprResourceDeps(expr.expr, out);
      return;
    case 'clamp':
      exprResourceDeps(expr.expr, out);
      exprResourceDeps(expr.min, out);
      exprResourceDeps(expr.max, out);
      return;
    default:
      exprResourceDeps(expr.left, out);
      exprResourceDeps(expr.right, out);
  }
}

/** GameNum 子树的资源依赖。zone/affectorFlows 叶子的动态值不经本树求值，不计入（与旧扫描等价）。 */
function nodeResourceDeps(node: GameNum, out: Set<string>): void {
  switch (node.kind) {
    case 'const':
    case 'owned':
    case 'levelLinear':
    case 'zone':
    case 'affectorFlows':
      return;
    case 'expr':
      exprResourceDeps(node.expr, out);
      return;
    case 'add':
    case 'sub':
    case 'mul':
      for (const c of node.children) nodeResourceDeps(c, out);
  }
}

/** 每个 primitiveGain 一个资源依赖集合（resourceChanged 定向失效用，Phase 5 接线）。 */
export function gainResourceDeps(system: GameNumSystem): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  for (const [resource, gain] of system.gains) {
    const set = new Set<string>();
    nodeResourceDeps(gain, set);
    deps.set(resource, set);
  }
  return deps;
}