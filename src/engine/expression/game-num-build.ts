// ============================================================
// engine/expression/game-num-build.ts — GameNumSystem 树构建
// 从 game-num.ts 拆出：buildAll / buildResourceGain（显式四级层级树）
//   / buildZoneNode / rebuildZoneIndex / registerZoneNode
//   / ensureFlowsNodes / scopeTags / setParent / collect / gainResourceDeps
//
// Phase 6 起每资源一棵显式层级树（tree-design.md §2）：
//   primitiveGain:<res> = globalProduct + globalFlat + globalFlows
//   globalProduct = (Σ initFull) × globalMulZone（决策项 2：乘完整值）
//   initFull  = (Σ areaProduct) × initMulZone + initExtra
//   areaFull  = (Σ spotProduct) × areaMulZone + areaExtra
//   spotFull  = spotBase × spotMulZone + spotExtra
// 乘区只乘下一级 base 链（spotProduct / areaProduct 进上级 base 和，逐级连乘）；
// flat / flows 不进乘区，经 spotExtra / areaExtra / initExtra 直加到总产出。
// spotFull / areaFull / initFull 为层级视图节点，额外项经 Extra 节点进入上级。
// ============================================================

import type { Value, ValueExpression } from '../types';
import type { GameNumState } from '../contracts/state-query';
import type { GameNumSystem } from './game-num';
import type { GameNum, ZoneNode } from './game-num-internal';
import { TagPath } from '../core/tag';
import { EntityRef, entityKey, tagPrefixesBottomUp } from './tag-effect';

// ---- 构建 ----

export function buildAll(system: GameNumSystem, state?: GameNumState): void {
  system.state = state;
  system.gains.clear();
  system.spotSubtrees.clear();
  system.zoneIndex.clear();
  system.parents.clear();
  system.allNodes = [];
  system.zoneNodes = [];
  system.syncedAffectorSources.clear();
  system.spotProductNodes.clear();
  system.spotFullNodes.clear();
  system.spotExtraNodes.clear();
  system.areaExtraNodes.clear();
  system.initExtraNodes.clear();
  system.flowsNodeById.clear();
  system.affectorFlowsNodes = new Map();
  zoneNodeMaps.set(system, new Map());

  const resourceSet = new Set<string>();
  for (const spot of system.registry.spots.values()) if (spot.baseYieldResource) resourceSet.add(spot.baseYieldResource);
  if (system.registry.resourceDisplays) for (const r of system.registry.resourceDisplays.keys()) resourceSet.add(r);
  if (state?.resources) for (const r of Object.keys(state.resources)) resourceSet.add(r);
  system.resourceSet = resourceSet;
  for (const res of resourceSet) {
    system.gains.set(res, buildResourceGain(system, res));
  }
  system.gainResourceDeps = gainResourceDeps(system);
  system.mayReadResources = [...system.gainResourceDeps.values()].some(s => s.size > 0);
  if (state) ensureFlowsNodes(system, system.affectorEngine);
}

/**
 * 每资源一棵层级树。spot 子树在所有资源树中统一构建（无跨树 DAG 共享）：
 * 非 baseYieldResource 树中 spotBase 恒 0，仅承载挂载到该 spot 的其他资源 flows。
 */
function buildResourceGain(system: GameNumSystem, resource: string): GameNum {
  const root: GameNum = { id: `primitiveGain:${resource}`, kind: 'add', children: [] };

  const globalMulZone = buildZoneNode(system, { kind: 'global', id: '*' }, 'mul');
  const initSum: GameNum = { id: `initSum:${resource}`, kind: 'add', children: [] };
  const globalProduct: GameNum = {
    id: `globalProduct:${resource}`,
    kind: 'mul',
    children: [initSum, globalMulZone],
  };
  const globalFlatZone = buildZoneNode(system, { kind: 'global', id: '*' }, 'flat');
  const globalFlows = createFlowsNode(system, undefined, resource);
  root.children.push(globalProduct, globalFlatZone, globalFlows);
  setParent(system, initSum, globalProduct);
  setParent(system, globalMulZone, globalProduct);
  setParent(system, globalProduct, root);
  setParent(system, globalFlatZone, root);
  setParent(system, globalFlows, root);

  for (const init of system.registry.inits?.values() ?? []) {
    initSum.children.push(buildInitNode(system, init.id, resource, initSum));
  }
  // 孤儿 spot（无 area/init 链，registry 可只声明 spots）：base 链与 Extra 直挂根（不进任何乘区）
  for (const spot of system.registry.spots.values()) {
    if (spot.baseYieldResource !== resource) continue;
    if (system.spotFullNodes.has(`${spot.id}@${resource}`)) continue;
    const built = buildSpotNode(system, spot.id, resource);
    root.children.push(built.spotProduct, built.spotExtra);
    setParent(system, built.spotProduct, root);
    setParent(system, built.spotExtra, root);
  }
  collect(system, root);
  return root;
}

function buildInitNode(system: GameNumSystem, initId: string, resource: string, initSum: GameNum): GameNum {
  const initBase: GameNum = { id: `initBase:${initId}:${resource}`, kind: 'add', children: [] };
  const initMulZone = buildZoneNode(system, { kind: 'init', id: initId }, 'mul');
  const initProduct: GameNum = {
    id: `initProduct:${initId}:${resource}`,
    kind: 'mul',
    children: [initBase, initMulZone],
  };
  const initFlatZone = buildZoneNode(system, { kind: 'init', id: initId }, 'flat');
  const initExtra: GameNum = { id: `initExtra:${initId}:${resource}`, kind: 'add', children: [initFlatZone] };
  system.initExtraNodes.set(`${initId}@${resource}`, initExtra);
  const initFull: GameNum = {
    id: `init:${initId}:${resource}`,
    kind: 'add',
    children: [initProduct, initExtra],
  };
  setParent(system, initBase, initProduct);
  setParent(system, initMulZone, initProduct);
  setParent(system, initProduct, initFull);
  setParent(system, initFlatZone, initExtra);
  setParent(system, initExtra, initFull);
  setParent(system, initFull, initSum);
  collect(system, initFull);

  for (const area of system.registry.areas?.values() ?? []) {
    if (area.initId !== initId) continue;
    initBase.children.push(buildAreaNode(system, area.id, resource, initBase, initExtra));
  }
  return initFull;
}

function buildAreaNode(
  system: GameNumSystem,
  areaId: string,
  resource: string,
  initBase: GameNum,
  initExtra: Extract<GameNum, { children: GameNum[] }>,
): GameNum {
  const areaBase: GameNum = { id: `areaBase:${areaId}:${resource}`, kind: 'add', children: [] };
  const areaMulZone = buildZoneNode(system, { kind: 'area', id: areaId }, 'mul');
  const areaProduct: GameNum = {
    id: `areaProduct:${areaId}:${resource}`,
    kind: 'mul',
    children: [areaBase, areaMulZone],
  };
  const areaFlatZone = buildZoneNode(system, { kind: 'area', id: areaId }, 'flat');
  const areaExtra: GameNum = { id: `areaExtra:${areaId}:${resource}`, kind: 'add', children: [areaFlatZone] };
  system.areaExtraNodes.set(`${areaId}@${resource}`, areaExtra);
  initExtra.children.push(areaExtra);
  const areaFull: GameNum = {
    id: `area:${areaId}:${resource}`,
    kind: 'add',
    children: [areaProduct, areaExtra],
  };
  setParent(system, areaBase, areaProduct);
  setParent(system, areaMulZone, areaProduct);
  setParent(system, areaProduct, areaFull);
  setParent(system, areaProduct, initBase);
  setParent(system, areaFlatZone, areaExtra);
  setParent(system, areaExtra, areaFull);
  setParent(system, areaExtra, initExtra);
  collect(system, areaFull);

  for (const spot of system.registry.spots.values()) {
    if (spot.areaId !== areaId || !spot.baseYieldResource) continue;
    const built = buildSpotNode(system, spot.id, resource);
    areaBase.children.push(built.spotProduct);
    setParent(system, built.spotProduct, areaBase);
    areaExtra.children.push(built.spotExtra);
    setParent(system, built.spotExtra, areaExtra);
  }
  return areaProduct;
}

interface BuiltSpot {
  spotProduct: GameNum;
  spotExtra: GameNum;
}

function buildSpotNode(system: GameNumSystem, spotId: string, resource: string): BuiltSpot {
  const spot = system.registry.spots.get(spotId)!;
  const own = spot.baseYieldResource === resource;

  let spotBase: GameNum;
  const owned: GameNum = { id: `owned:${spotId}`, kind: 'owned', spotId };
  if (own) {
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
    const baseSum: GameNum = { id: `baseSum:${spotId}:${resource}`, kind: 'add', children: [baseYield] };
    spotBase = { id: `spotBase:${spotId}:${resource}`, kind: 'mul', children: [owned, baseSum] };
    setParent(system, base, baseYield);
    if (levelLinear) setParent(system, levelLinear, baseYield);
    setParent(system, baseYield, baseSum);
    setParent(system, baseSum, spotBase);
    setParent(system, owned, spotBase);
  } else {
    spotBase = { id: `spotBase:${spotId}:${resource}`, kind: 'const', value: 0 };
  }

  const spotMulZone = buildZoneNode(system, { kind: 'spot', id: spotId }, 'mul', resource);
  const spotProduct: GameNum = {
    id: `spotProduct:${spotId}:${resource}`,
    kind: 'mul',
    children: [spotBase, spotMulZone],
  };
  // spotFlat 受 owned 门控（未拥有 spot 不产出 flat，与旧 baseLine 语义一致）；flows 不门控
  const spotExtraChildren: GameNum[] = [];
  if (own) {
    const spotFlatZone = buildZoneNode(system, { kind: 'spot', id: spotId }, 'flat', resource);
    const gatedFlat: GameNum = {
      id: `spotFlatGated:${spotId}:${resource}`,
      kind: 'mul',
      children: [owned, spotFlatZone],
    };
    setParent(system, owned, gatedFlat);
    setParent(system, spotFlatZone, gatedFlat);
    spotExtraChildren.push(gatedFlat);
  }
  const spotExtra: GameNum = { id: `spotExtra:${spotId}:${resource}`, kind: 'add', children: spotExtraChildren };
  if (own) setParent(system, spotExtraChildren[0], spotExtra);
  const spotFull: GameNum = {
    id: `spot:${spotId}:${resource}`,
    kind: 'add',
    children: [spotProduct, spotExtra],
  };
  setParent(system, spotBase, spotProduct);
  setParent(system, spotMulZone, spotProduct);
  setParent(system, spotProduct, spotFull);
  setParent(system, spotExtra, spotFull);
  collect(system, spotFull);
  system.spotFullNodes.set(`${spotId}@${resource}`, spotFull);
  system.spotProductNodes.set(`${spotId}@${resource}`, spotProduct);
  system.spotExtraNodes.set(`${spotId}@${resource}`, spotExtra);
  if (own) system.spotSubtrees.set(spotId, spotFull);
  return { spotProduct, spotExtra };
}

// ---- flows 节点动态创建（Affector 挂载 → 层级分发，Phase 6） ----

/** mountEntityId 解析到层级实体则原样返回；否则归入 global 兜底节点。 */
function resolveFlowsMount(system: GameNumSystem, mountEntityId: string): string | undefined {
  if (system.registry.spots.has(mountEntityId)) return mountEntityId;
  if (system.registry.areas?.has(mountEntityId)) return mountEntityId;
  if (system.registry.inits?.has(mountEntityId)) return mountEntityId;
  return undefined;
}

function createFlowsNode(system: GameNumSystem, mount: string | undefined, resource: string): GameNum {
  const id = `flows:${mount ?? 'global'}:${resource}`;
  const existing = system.flowsNodeById.get(id);
  if (existing) return existing;
  const node: GameNum = { id, kind: 'affectorFlows', resource, ...(mount !== undefined ? { mount } : {}) };
  system.flowsNodeById.set(id, node);
  const list = system.affectorFlowsNodes.get(resource) ?? [];
  list.push(node);
  system.affectorFlowsNodes.set(resource, list);
  return node;
}

/** 把 flows 节点挂到对应层级：spot → spotExtra（随 areaExtra 上抛）；area/init → 各自 Extra；其他 → 资源树根（global）。 */
function attachFlowsNode(system: GameNumSystem, mount: string | undefined, resource: string): void {
  const node = createFlowsNode(system, mount, resource);
  if ((system.parents.get(node.id) ?? []).length > 0) return;
  let parent: GameNum | undefined;
  if (mount !== undefined) {
    parent = system.spotExtraNodes.get(`${mount}@${resource}`)
      ?? system.areaExtraNodes.get(`${mount}@${resource}`)
      ?? system.initExtraNodes.get(`${mount}@${resource}`);
  }
  if (!parent) parent = system.gains.get(resource);
  if (!parent || parent.kind !== 'add') return;
  parent.children.push(node);
  setParent(system, node, parent);
  collect(system, node);
}

/** 按当前活跃 Affector 实例补齐缺失的 flows 节点（buildAll 收尾与实例变化时调用；幂等）。 */
export function ensureFlowsNodes(system: GameNumSystem, affector: { getActiveInstances(): readonly { mountEntityId: string; packId: string; activeEntryIds: readonly string[] }[]; getPack(id: string): { entries: readonly { id: string; flows?: readonly { resource: string }[] }[] } | undefined }): void {
  for (const instance of affector.getActiveInstances()) {
    const pack = affector.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!instance.activeEntryIds.includes(entry.id)) continue;
      for (const flow of entry.flows ?? []) {
        attachFlowsNode(system, resolveFlowsMount(system, instance.mountEntityId), flow.resource);
      }
    }
  }
}

// ---- zone 节点 ----

/** zone 节点 id -> 节点去重表（仅 build 模块内部；按 system 隔离，buildAll 重建时整表换新。
 * 运行期 buildZoneNode 复用同一表，保证 UI/测试读到与树内相同的节点实例）。 */
const zoneNodeMaps = new WeakMap<GameNumSystem, Map<string, ZoneNode>>();

function zoneNodeMap(system: GameNumSystem): Map<string, ZoneNode> {
  let map = zoneNodeMaps.get(system);
  if (!map) {
    map = new Map();
    zoneNodeMaps.set(system, map);
  }
  return map;
}

export function buildZoneNode(system: GameNumSystem, scope: EntityRef, part: 'flat' | 'mul', resource?: string): ZoneNode {
  const id = `zone:${scope.kind}:${scope.id}:${part}${resource ? `:${resource}` : ''}`;
  const byId = zoneNodeMap(system);
  const existing = byId.get(id);
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
  byId.set(id, node);
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
}

function scopeTags(system: GameNumSystem, scope: EntityRef): TagPath[] {
  interface TaggedDef { tags?: TagPath[] }
  // Spot 按「有效 tags」派生（声明 + 运行时增撤，docs-824/08 T6）；其余实体仍读声明
  if (scope.kind === 'spot') {
    return system.registry.effectiveSpotTags(scope.id, system.state?.spotTagOverrides);
  }
  let def: TaggedDef | undefined;
  switch (scope.kind) {
    case 'area': def = system.registry.areas.get(scope.id) as TaggedDef | undefined; break;
    case 'init': def = system.registry.inits.get(scope.id) as TaggedDef | undefined; break;
    case 'enhancement': def = system.registry.enhancements.get(scope.id) as TaggedDef | undefined; break;
    case 'global': break;
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

/** ValueExpression 的资源依赖集合（区记录 / flows 动态值登记定向失效用）。 */
export function exprResourceDepsOf(expr: ValueExpression): Set<string> {
  const out = new Set<string>();
  exprResourceDeps(expr, out);
  return out;
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
