// ============================================================
// engine/game-num-eval.ts — GameNum 节点纯求值
// evaluateGameNum：按节点语义递归求值（const/expr/add/mul/owned/levelLinear/
// zone/affectorFlows/clamp/floor/...）。从 game-num.ts 抽出，便于对最末端求值语义独立测试。
//
// 节点级运行时字段（挂载在 GameNum 上，由宿主 GameNumSystem 维护）：
//   dirty    标记该节点是否需要重算（源变动时由宿主标记，读取到 dirty 才重算）
//   cached   上次求值结果缓存（仅 dirty===false 时有效）
//   childMulMap  命名乘区容器：zoneName -> 贡献节点集合；乘区值 = 1 + Σ(贡献求值)
//   bound    上下限夹取 [min,max]（非法 min>max 不夹取）
//
// 乘区语义统一为「1 + Σ」：原始乘区因子 f 以贡献节点 (f - 1) 存入，
// 故 1 + Σ(fᵢ - 1) ≡ Π fᵢ，与旧「原始因子连乘」逐位一致；custom/累乘区同理。
// flat 区为纯加法（Σ 原始值），不走 1+Σ。
//
// 侵入点（动态数据）都作为参数传入：
//   state   PlayerState（懒读取，不缓存）
//   enh/zone 效果从 PlayerState / 节点 childMulMap 读取，由宿主注入上下文。
// 其余上下文由宿主注入（valueSystem / registry / characterSystem / affectorEngine）。
// ============================================================

import { PlayerState, ValueExpression, Character, AffectorFlow } from '../types';
import { ValueSystem } from './value-system';
import { CharacterSystem } from '../system/character-system';
import { AffectorEngine } from '../effect/affector-engine';
import { Registry } from '../registry/registry';
import { TagPath } from '../core/tag';
import { EntityRef, TagEffectRecord, entityKey, tagPrefixesBottomUp } from './tag-effect';

/** 乘区上下限。source 记录最后设置者，用于按 source 撤销。 */
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
 * 组合算子：add/sub/mul/div/min/max/pow（多叉，从左到右折叠）、
 * clamp（min/value/max 三节点）、floor/ceil/round（单节点）、cond（test/then/else）。
 * 叶子：const/expr/owned/levelLinear/affectorFlows/
 * zone（按作用目标聚合的 flat 区 / mul 区，支持命名乘区 childMulMap 与 bound）。
 * 整棵树必须为无环图（节点仅持子节点引用，无反向引用）。 */
export type GameNum =
  | (GNAttrs & { id: string; kind: 'const'; value: number })
  | (GNAttrs & { id: string; kind: 'expr'; expr: ValueExpression })
  | (GNAttrs & { id: string; kind: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max' | 'pow'; children: GameNum[]; childMulMap?: Map<string, GameNum[]>; bound?: ZoneBound })
  | (GNAttrs & { id: string; kind: 'clamp'; min: GameNum; value: GameNum; max: GameNum })
  | (GNAttrs & { id: string; kind: 'floor' | 'ceil' | 'round'; child: GameNum })
  | (GNAttrs & { id: string; kind: 'cond'; test: GameNum; then: GameNum; else: GameNum })
  | (GNAttrs & { id: string; kind: 'owned'; spotId: string })
  | (GNAttrs & { id: string; kind: 'levelLinear'; spotId: string })
  | (GNAttrs & { id: string; kind: 'affectorFlows'; resource: string })
  | (GNAttrs & { id: string; kind: 'zone'; scope: EntityRef; part: 'flat' | 'mul'; resource?: string; childMulMap?: Map<string, GameNum[]>; bound?: ZoneBound });

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
  registry: Registry;
  characterSystem: CharacterSystem;
  affectorEngine: AffectorEngine;
}

/** spot 产出子树根节点 id 前缀（buildSpotProduction 约定），用于识别可缓存的 mul 节点。 */
export const SPOT_NODE_PREFIX = 'spot:';

/** 取实体声明 tags（自下而上聚合用）。registry 各实体 def 的 tags 字段可选。 */
const entityTagsOf = (ref: EntityRef, deps: GameNumEvalDeps): TagPath[] => {
  let def: { tags?: TagPath[] } | undefined;
  switch (ref.kind) {
    case 'spot':
      def = deps.registry.spots.get(ref.id);
      break;
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
  return def?.tags ?? [];
};

/** 把 TagEffectRecord.value（number 或 const/expr 节点）解析为数值。 */
function resolveRecordValue(v: number | GameNum | undefined, state: PlayerState, vs: ValueSystem): number {
  if (typeof v === 'number') return v;
  if (v && v.kind === 'const') return v.value;
  if (v && v.kind === 'expr') return vs.evaluate(v.expr, state);
  return 0;
}

/**
 * 按作用目标双路聚合某实体在某资源上的区修饰器（兜底路径，当节点无 childMulMap 时使用）：
 * - tag 路径：实体 tags 自下而上前缀展开命中 state.tagEffects；
 * - entity 路径：实体精确键 + 同 kind 通配键（'*'）命中 state.entityEffects。
 * flat 求和；mul/custom 连乘（custom 按 multiplierId 分组）；bound 夹取（非法 bound 回落不夹取）。
 * 空集时 flat→0、mul→1，保证无修饰器场景下数值与现状一致。
 */
export function aggregateZone(
  state: PlayerState,
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
  const customGroups = new Map<string, number>();
  for (const r of records) {
    if (!matchResource(r)) continue;
    const v = resolveRecordValue(r.value, state, vs);
    if (r.category === 'mul') product *= v;
    else if (r.category === 'custom' && r.multiplierId) {
      customGroups.set(r.multiplierId, (customGroups.get(r.multiplierId) ?? 1) * v);
    } else if (r.category === 'bound') {
      lo = Math.max(lo, r.min ?? -Infinity);
      hi = Math.min(hi, r.max ?? Infinity);
    }
  }
  for (const g of customGroups.values()) product *= g;
  if (lo > hi) return product;
  return Math.min(Math.max(product, lo), hi);
}

/** 命名乘区求值：flat = Σ 贡献；mul = Π(1 + Σ 贡献)。bound 对 mul 结果夹取。 */
function zoneValue(node: GameNum & { kind: 'zone' }, state: PlayerState, deps: GameNumEvalDeps, useCache: boolean): number {
  const map = node.childMulMap;
  if (map) {
    if (node.part === 'flat') {
      let sum = 0;
      for (const list of map.values()) for (const c of list) sum += evaluateGameNum(c, state, deps, useCache);
      return sum;
    }
    let product = 1;
    for (const list of map.values()) {
      let s = 0;
      for (const c of list) s += evaluateGameNum(c, state, deps, useCache);
      product *= 1 + s;
    }
    if (node.bound && node.bound.min <= node.bound.max) {
      product = Math.min(Math.max(product, node.bound.min), node.bound.max);
    }
    return product;
  }
  // 兜底：节点未接入 childMulMap 时走全局区表聚合
  const tags = entityTagsOf(node.scope, deps);
  return aggregateZone(state, node.scope, tags, node.resource, node.part, deps.valueSystem);
}

/** 懒求值：递归求值任意 GameNum 节点；useCache=false 时跳过节点缓存（溯源分解用）。 */
export function evaluateGameNum(node: GameNum, state: PlayerState, deps: GameNumEvalDeps, useCache = true): number {
  if (useCache && node.dirty === false && node.cached !== undefined) return node.cached;
  const value = switchEval(node, state, deps, useCache);
  if (useCache) {
    node.cached = value;
    node.dirty = false;
  }
  return value;
}

function switchEval(node: GameNum, state: PlayerState, deps: GameNumEvalDeps, useCache: boolean): number {
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
      let result = node.children.reduce((product, child) => product * evaluateGameNum(child, state, deps, useCache), 1);
      if (node.childMulMap) {
        for (const list of node.childMulMap.values()) {
          let s = 0;
          for (const c of list) s += evaluateGameNum(c, state, deps, useCache);
          result *= 1 + s;
        }
      }
      if (node.bound && node.bound.min <= node.bound.max) {
        result = Math.min(Math.max(result, node.bound.min), node.bound.max);
      }
      return result;
    }
    case 'div': {
      if (node.children.length === 0) return 0;
      const [head, ...tail] = node.children;
      return tail.reduce((acc, child) => {
        const d = evaluateGameNum(child, state, deps, useCache);
        return d === 0 ? 0 : acc / d;
      }, evaluateGameNum(head, state, deps, useCache));
    }
    case 'min':
      return node.children.reduce((m, child) => Math.min(m, evaluateGameNum(child, state, deps, useCache)), Infinity);
    case 'max':
      return node.children.reduce((m, child) => Math.max(m, evaluateGameNum(child, state, deps, useCache)), -Infinity);
    case 'pow': {
      if (node.children.length === 0) return 0;
      const [head, ...tail] = node.children;
      return tail.reduce((acc, child) => Math.pow(acc, evaluateGameNum(child, state, deps, useCache)), evaluateGameNum(head, state, deps, useCache));
    }
    case 'clamp': {
      const v = evaluateGameNum(node.value, state, deps, useCache);
      const lo = evaluateGameNum(node.min, state, deps, useCache);
      const hi = evaluateGameNum(node.max, state, deps, useCache);
      return Math.min(Math.max(v, lo), hi);
    }
    case 'floor':
      return Math.floor(evaluateGameNum(node.child, state, deps, useCache));
    case 'ceil':
      return Math.ceil(evaluateGameNum(node.child, state, deps, useCache));
    case 'round':
      return Math.round(evaluateGameNum(node.child, state, deps, useCache));
    case 'cond':
      return evaluateGameNum(evaluateGameNum(node.test, state, deps, useCache) !== 0 ? node.then : node.else, state, deps, useCache);
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
      return evaluateResourceAffectorFlows(node.resource, state, deps);
  }
}

/**
 * 溯源分解：递归展开每个子节点的贡献明细（id/kind/value/children），供
 * tooltip 展示「base 5 × 强化 1.5 = 15」。返回结构与 evaluateGameNum 同复杂度，
 * 不走缓存（useCache=false），仅在调试/tooltip 触发时使用。
 */
export function evaluateGameNumBreakdown(node: GameNum, state: PlayerState, deps: GameNumEvalDeps): Contribution {
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
      const extra = node.childMulMap
        ? [...node.childMulMap.entries()].map(([z, list]) => {
            const sum = list.reduce((s, c) => s + evaluateGameNum(c, state, deps, false), 0);
            return { id: `${node.id}:${z}`, kind: 'zone', value: 1 + sum, label: z };
          })
        : undefined;
      return { id: node.id, kind: 'mul', value, children: extra ? [...children, ...extra] : children };
    }
    case 'div': {
      const children = node.children.map(c => evaluateGameNumBreakdown(c, state, deps));
      const value = children.length === 0 ? 0
        : children.slice(1).reduce((acc, c) => (c.value === 0 ? 0 : acc / c.value), children[0].value);
      return { id: node.id, kind: 'div', value, children };
    }
    case 'min': {
      const children = node.children.map(c => evaluateGameNumBreakdown(c, state, deps));
      return { id: node.id, kind: 'min', value: children.reduce((m, c) => Math.min(m, c.value), Infinity), children };
    }
    case 'max': {
      const children = node.children.map(c => evaluateGameNumBreakdown(c, state, deps));
      return { id: node.id, kind: 'max', value: children.reduce((m, c) => Math.max(m, c.value), -Infinity), children };
    }
    case 'pow': {
      const children = node.children.map(c => evaluateGameNumBreakdown(c, state, deps));
      const value = children.length === 0 ? 0
        : children.slice(1).reduce((acc, c) => Math.pow(acc, c.value), children[0].value);
      return { id: node.id, kind: 'pow', value, children };
    }
    case 'clamp': {
      const value = evaluateGameNumBreakdown(node.value, state, deps);
      const min = evaluateGameNumBreakdown(node.min, state, deps);
      const max = evaluateGameNumBreakdown(node.max, state, deps);
      return { id: node.id, kind: 'clamp', value: Math.min(Math.max(value.value, min.value), max.value), children: [value, min, max] };
    }
    case 'floor': {
      const child = evaluateGameNumBreakdown(node.child, state, deps);
      return { id: node.id, kind: 'floor', value: Math.floor(child.value), children: [child] };
    }
    case 'ceil': {
      const child = evaluateGameNumBreakdown(node.child, state, deps);
      return { id: node.id, kind: 'ceil', value: Math.ceil(child.value), children: [child] };
    }
    case 'round': {
      const child = evaluateGameNumBreakdown(node.child, state, deps);
      return { id: node.id, kind: 'round', value: Math.round(child.value), children: [child] };
    }
    case 'cond': {
      const test = evaluateGameNumBreakdown(node.test, state, deps);
      const taken = evaluateGameNumBreakdown(test.value !== 0 ? node.then : node.else, state, deps);
      return { id: node.id, kind: 'cond', value: taken.value, children: [test, taken] };
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
      const children = node.childMulMap
        ? [...node.childMulMap.entries()].map(([z, list]) => {
            const sum = list.reduce((s, c) => s + evaluateGameNum(c, state, deps, false), 0);
            return { id: `${node.id}:${z}`, kind: 'zone', value: node.part === 'flat' ? sum : 1 + sum, label: z };
          })
        : undefined;
      return { id: node.id, kind: 'zone', value, label, ...(children ? { children } : {}) };
    }
    case 'affectorFlows':
      return { id: node.id, kind: 'affectorFlows', value: evaluateResourceAffectorFlows(node.resource, state, deps), label: node.resource };
  }
}

/** 某 Spot 上挂载：所有活跃 Affector 的 flows 贡献之和（evaluateSpotYield 的补充项）。 */
export function evaluateSpotAffectorFlows(spotId: string, state: PlayerState, deps: GameNumEvalDeps): number {
  let total = 0;
  for (const instance of deps.affectorEngine.getActiveInstances()) {
    if (instance.mountEntityId !== spotId) continue;
    const pack = deps.affectorEngine.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!instance.activeEntryIds.includes(entry.id)) continue;
      for (const flow of entry.flows ?? []) {
        total += resolveFlowValue(flow, state, deps.valueSystem);
      }
    }
  }
  return total;
}

/** 该资源所有活跃 Affector 的 flows 贡献之和（懒求值）。 */
export function evaluateResourceAffectorFlows(resource: string, state: PlayerState, deps: GameNumEvalDeps): number {
  let sum = 0;
  for (const instance of deps.affectorEngine.getActiveInstances()) {
    const pack = deps.affectorEngine.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!instance.activeEntryIds.includes(entry.id)) continue;
      for (const flow of entry.flows ?? []) {
        if (flow.resource !== resource) continue;
        sum += resolveFlowValue(flow, state, deps.valueSystem);
      }
    }
  }
  return sum;
}

export function resolveFlowValue(flow: AffectorFlow, state: PlayerState, valueSystem: ValueSystem): number {
  const value = flow.value;
  if (typeof value === 'number') return value;
  return valueSystem.evaluate(value, state);
}
