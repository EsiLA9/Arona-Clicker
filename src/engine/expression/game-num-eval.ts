// ============================================================
// engine/game-num-eval.ts — GameNum 节点纯求值
// evaluateGameNum：按节点语义递归求值（const/expr/add/sub/mul/owned/levelLinear/
// zone/affectorFlows）。从 game-num.ts 抽出，便于对最末端求值语义独立测试。
//
// 节点级运行时字段（挂载在 GameNum 上，由宿主 GameNumSystem 维护）：
//   dirty    标记该节点是否需要重算（源变动时由宿主标记，读取到 dirty 才重算）
//   cached   上次求值结果缓存（仅 dirty===false 时有效）
//
// zone 节点求值统一走 state 表聚合（aggregateZone）——state.tagEffects / state.entityEffects
// 是唯一真相（Phase 1 后不再有 childMulMap 投影）。
//
// 侵入点（动态数据）都作为参数传入：
//   state   PlayerState（懒读取，不缓存）
//   其余上下文由宿主注入（valueSystem / registry / affectorEngine）。
// ============================================================

import { ValueExpression, AffectorFlow } from '../types';
import type { GameNumState } from '../contracts/state-query';
import { ValueSystem } from './value-system';
import type { GameNumAffectorContext } from '../contracts/evaluation-context';
import type { GameNumRegistryContext } from '../contracts/evaluation-context';
import { qualifyTagPath, TagPath } from '../core/tag';
import { EntityRef, TagEffectRecord, entityKey, tagPrefixesBottomUp } from './tag-effect';

/** 乘区上下限夹取区间（bound 记录合并结果，zone 求值时对 mul 结果夹取）。 */
export interface ZoneBound {
  min: number;
  max: number;
  source?: string;
}

export interface GNAttrs {
  /** 节点级脏位：true 表示下次读取需重算。 */
  dirty?: boolean;
  /** 上次求值缓存（dirty===false 时有效）。 */
  cached?: number;
}

/** GameNum 节点类型。
 * 组合算子：add/sub/mul（多叉，从左到右折叠）。
 * 叶子：const/expr/owned/levelLinear/affectorFlows/
 * zone（按作用目标聚合的 flat 区 / mul 区，求值统一走 state 表 aggregateZone）。
 * 整棵树必须为无环图（节点仅持子节点引用，无反向引用）。 */
export type GameNum =
  | (GNAttrs & { id: string; kind: 'const'; value: number })
  | (GNAttrs & { id: string; kind: 'expr'; expr: ValueExpression })
  | (GNAttrs & { id: string; kind: 'add' | 'sub' | 'mul'; children: GameNum[] })
  | (GNAttrs & { id: string; kind: 'owned'; spotId: string })
  | (GNAttrs & { id: string; kind: 'levelLinear'; spotId: string })
  | (GNAttrs & { id: string; kind: 'affectorFlows'; resource: string; mount?: string })
  | (GNAttrs & { id: string; kind: 'zone'; scope: EntityRef; part: 'flat' | 'mul'; resource?: string });

/** 贡献明细（溯源分解 API 输出）。children 仅组合节点存在，与子节点顺序一致。 */
export interface Contribution {
  id: string;
  kind: string;
  value: number;
  label?: string;
  children?: Contribution[];
}

/** 溯源分解结果：根节点最终值 + 贡献明细。 */
export interface BreakdownResult {
  value: number;
  contributions: Contribution[];
}

export interface GameNumEvalDeps {
  valueSystem: ValueSystem;
  registry: GameNumRegistryContext;
  affectorEngine: GameNumAffectorContext;
}

/** 取实体 tags（spot 按「有效 tags」= 声明 + 运行时增撤，docs-824/08 T6；其余读声明；自下而上聚合用）。 */
const entityTagsOf = (ref: EntityRef, deps: GameNumEvalDeps, state: GameNumState): TagPath[] => {
  if (ref.kind === 'spot') {
    return deps.registry.effectiveSpotTags(ref.id, state.spotTagOverrides);
  }
  let def: { tags?: TagPath[] } | undefined;
  switch (ref.kind) {
    case 'area':
      def = deps.registry.areas.get(ref.id) as { tags?: TagPath[] } | undefined;
      break;
    case 'init':
      def = deps.registry.inits.get(ref.id) as { tags?: TagPath[] } | undefined;
      break;
    case 'enhancement':
      def = deps.registry.enhancements.get(ref.id) as { tags?: TagPath[] } | undefined;
      break;
  }
  return (def?.tags ?? []).map(tag => qualifyTagPath(tag, deps.registry.tagOwnerOf?.(ref.id) ?? 'base'));
};

/** 把 TagEffectRecord.value（number 或 const/expr 节点）解析为数值。 */
function resolveRecordValue(v: number | GameNum | undefined, state: GameNumState, vs: ValueSystem): number {
  if (typeof v === 'number') return v;
  if (v && v.kind === 'const') return v.value;
  if (v && v.kind === 'expr') return vs.evaluate(v.expr, state);
  return 0;
}

/**
	 * 按作用目标双路聚合某实体在某资源上的区修饰器（唯一求值路径，Phase 1 后不再有 childMulMap 投影）：
	 * - tag 路径：实体 tags 自下而上前缀展开命中 state.tagEffects；
	 * - entity 路径：实体精确键 + 同 kind 通配键（'*'）命中 state.entityEffects。
	 *
	 * 语义（分桶，依 category 区分）：
	 * - flat：求和（Σ 原始值）
	 * - mul（默认乘区，加百分比）：1 + Σ(f-1)，即 +a%  +b% → 1+(a+b)
	 * - custom（手动新乘区，✕倍）：按 multiplierId 分组，组内 Πv、组间连乘
	 * - bound：夹取下上界（非法 bound 回落不夹取）
	 *
	 * 空集时 flat→0、mul→1，保证无修饰器场景下数值正确。
	 */
export function aggregateZone(
  state: GameNumState,
  scope: EntityRef,
  tags: TagPath[],
  resource: string | undefined,
  part: 'flat' | 'mul',
  vs: ValueSystem,
): number {
  const records: TagEffectRecord[] = [];
  for (const tk of tagPrefixesBottomUp(tags)) {
    const list = state.tagEffects?.[tk];
    if (list) records.push(...list);
  }
  for (const key of [entityKey(scope), `${scope.kind}:*`]) {
    const list = state.entityEffects?.[key];
    if (list) records.push(...list);
  }
  const matchResource = (r: TagEffectRecord) => !r.resource || r.resource === resource;
  if (part === 'flat') {
    let sum = 0;
    for (const r of records) {
      if (r.category === 'flat' && matchResource(r)) sum += resolveRecordValue(r.value, state, vs);
    }
    return sum;
  }
  let product = 1;
  let lo = -Infinity;
  let hi = Infinity;
  // 默认乘区（mul，加百分比）：1 + Σ(f-1)
  let addMulSum = 0;
  const customGroups = new Map<string, number>();
  for (const r of records) {
    if (!matchResource(r)) continue;
    const v = resolveRecordValue(r.value, state, vs);
    if (r.category === 'mul') addMulSum += v - 1;
    else if (r.category === 'custom' && r.multiplierId) {
      customGroups.set(r.multiplierId, (customGroups.get(r.multiplierId) ?? 1) * v);
    } else if (r.category === 'bound') {
      lo = Math.max(lo, r.min ?? -Infinity);
      hi = Math.min(hi, r.max ?? Infinity);
    }
  }
  product *= 1 + addMulSum;
  for (const g of customGroups.values()) product *= g;
  if (lo > hi) return product;
  return Math.min(Math.max(product, lo), hi);
}

/** zone 节点求值：唯一路径为全局区表聚合（state.tagEffects / state.entityEffects 是唯一真相）。 */
function zoneValue(node: GameNum & { kind: 'zone' }, state: GameNumState, deps: GameNumEvalDeps, useCache: boolean): number {
  const tags = entityTagsOf(node.scope, deps, state);
  return aggregateZone(state, node.scope, tags, node.resource, node.part, deps.valueSystem);
}

/** 懒求值：递归求值任意 GameNum 节点；useCache=false 时跳过节点缓存（溯源分解用）。 */
export function evaluateGameNum(node: GameNum, state: GameNumState, deps: GameNumEvalDeps, useCache = true): number {
  if (useCache && node.dirty === false && node.cached !== undefined) return node.cached;
  const value = switchEval(node, state, deps, useCache);
  if (useCache) {
    node.cached = value;
    node.dirty = false;
  }
  return value;
}

function switchEval(node: GameNum, state: GameNumState, deps: GameNumEvalDeps, useCache: boolean): number {
  switch (node.kind) {
    case 'const':
      return node.value;
    case 'expr':
      return deps.valueSystem.evaluate(node.expr, state);
    case 'add':
      return node.children.reduce((sum, child) => sum + evaluateGameNum(child, state, deps, useCache), 0);
    case 'sub': {
      if (node.children.length === 0) return 0;
      const [head, ...tail] = node.children;
      return tail.reduce((acc, child) => acc - evaluateGameNum(child, state, deps, useCache), evaluateGameNum(head, state, deps, useCache));
    }
    case 'mul': {
      return node.children.reduce((product, child) => product * evaluateGameNum(child, state, deps, useCache), 1);
    }
    case 'owned':
      return (state.spotLevels[node.spotId] ?? 0) > 0 ? 1 : 0;
    case 'levelLinear': {
      const level = state.spotLevels[node.spotId] ?? 0;
      const spot = deps.registry.spots.get(node.spotId);
      const perLevel = spot?.yieldPerLevel ?? 0;
      return Math.floor(Math.max(0, level - 1) * perLevel);
    }
    case 'zone':
      return zoneValue(node, state, deps, useCache);
    case 'affectorFlows':
      return evaluateAffectorFlowsNode(node, state, deps);
  }
}

/**
 * 溯源分解：递归展开每个子节点的贡献明细（id/kind/value/children），供
 * tooltip 展示「base 5 × 强化 1.5 = 15」。返回结构与 evaluateGameNum 同复杂度，
 * 不走缓存（useCache=false），仅在调试/tooltip 触发时使用。
 */
export function evaluateGameNumBreakdown(node: GameNum, state: GameNumState, deps: GameNumEvalDeps): Contribution {
  switch (node.kind) {
    case 'const':
      return { id: node.id, kind: 'const', value: node.value };
    case 'expr':
      return { id: node.id, kind: 'expr', value: deps.valueSystem.evaluate(node.expr, state) };
    case 'add': {
      const children = node.children.map(c => evaluateGameNumBreakdown(c, state, deps));
      return { id: node.id, kind: 'add', value: children.reduce((s, c) => s + c.value, 0), children };
    }
    case 'sub': {
      const children = node.children.map(c => evaluateGameNumBreakdown(c, state, deps));
      const value = children.length === 0 ? 0
        : children.slice(1).reduce((acc, c) => acc - c.value, children[0].value);
      return { id: node.id, kind: 'sub', value, children };
    }
    case 'mul': {
      const children = node.children.map(c => evaluateGameNumBreakdown(c, state, deps));
      const value = children.length === 0 ? 0 : children.reduce((acc, c) => acc * c.value, 1);
      return { id: node.id, kind: 'mul', value, children };
    }
    case 'owned':
      return { id: node.id, kind: 'owned', value: (state.spotLevels[node.spotId] ?? 0) > 0 ? 1 : 0, label: node.spotId };
    case 'levelLinear': {
      const level = state.spotLevels[node.spotId] ?? 0;
      const spot = deps.registry.spots.get(node.spotId);
      const perLevel = spot?.yieldPerLevel ?? 0;
      return { id: node.id, kind: 'levelLinear', value: Math.floor(Math.max(0, level - 1) * perLevel), label: node.spotId };
    }
    case 'zone': {
      const scope = node.scope;
      const label = `zone:${scope.kind}:${scope.id}:${node.part}${node.resource ? `:${node.resource}` : ''}`;
      const value = zoneValue(node, state, deps, false);
      return { id: node.id, kind: 'zone', value, label };
    }
    case 'affectorFlows':
      return { id: node.id, kind: 'affectorFlows', value: evaluateAffectorFlowsNode(node, state, deps), label: node.mount ? `${node.resource}@${node.mount}` : node.resource };
  }
}

/** mountEntityId 是否解析为层级实体（spot/area/init）——决定 flows 进层级节点还是 global 兜底。 */
function isLevelEntity(registry: GameNumRegistryContext, entityId: string): boolean {
  return registry.spots.has(entityId)
    || registry.areas?.has(entityId) === true
    || registry.inits?.has(entityId) === true;
}

/**
 * affectorFlows 节点求值：按节点挂载过滤活跃实例——
 * - mount 指向 spot/area/init：只累计挂在该实体上的实例（层级 flows 分发，Phase 6）；
 * - mount 缺省（global 兜底节点）：只累计挂在非层级实体（enhancement/item 等）上的实例。
 */
export function evaluateAffectorFlowsNode(node: GameNum & { kind: 'affectorFlows' }, state: GameNumState, deps: GameNumEvalDeps): number {
  let sum = 0;
  for (const instance of deps.affectorEngine.getActiveInstances()) {
    if (node.mount !== undefined ? instance.mountEntityId !== node.mount : isLevelEntity(deps.registry, instance.mountEntityId)) continue;
    const pack = deps.affectorEngine.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!instance.activeEntryIds.includes(entry.id)) continue;
      for (const flow of entry.flows ?? []) {
        if (flow.resource !== node.resource) continue;
        sum += resolveFlowValue(flow, state, deps.valueSystem);
      }
    }
  }
  return sum;
}

export function resolveFlowValue(flow: AffectorFlow, state: GameNumState, valueSystem: ValueSystem): number {
  const value = flow.value;
  if (typeof value === 'number') return value;
  return valueSystem.evaluate(value, state);
}
