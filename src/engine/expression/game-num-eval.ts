// ============================================================
// engine/game-num-eval.ts — GameNum 节点纯求值
// evaluateGameNum：按节点语义递归求值（const/expr/add/mul/owned/levelLinear
// /managerBonus/tagMultiplier/enhancementMultiplier/affectorFlows）。
// 从 game-num.ts 抽出，便于对最末端的求值语义独立测试。
//
// 侵入点（动态数据）都作为参数传入：
//   state   PlayerState（懒读取，不缓存）
//   enh     { index, cache } — 强化 → spot 反向索引 与 倍率缓存（由宿主维护）
//   prodCache — spot 产出子树整体系数缓存（宿主事件驱动失效；affectorFlows 不缓存）
// 其余上下文由宿主注入（valueSystem / registry / characterSystem / affectorEngine）。
// ============================================================

import { PlayerState, ValueExpression, Character, Effect } from '../types';
import { ValueSystem } from './value-system';
import { CharacterSystem } from '../system/character-system';
import { AffectorEngine } from '../effect/affector-engine';
import { Registry } from '../registry/registry';

export type GameNum =
  | { id: string; kind: 'const'; value: number }
  | { id: string; kind: 'expr'; expr: ValueExpression }
  | { id: string; kind: 'add'; children: GameNum[] }
  | { id: string; kind: 'mul'; children: GameNum[] }
  | { id: string; kind: 'owned'; spotId: string }
  | { id: string; kind: 'levelLinear'; spotId: string }
  | { id: string; kind: 'managerBonus'; spotId: string }
  | { id: string; kind: 'tagMultiplier'; spotId: string }
  | { id: string; kind: 'enhancementMultiplier'; spotId: string }
  | { id: string; kind: 'affectorFlows'; resource: string };

export interface GameNumEvalDeps {
  valueSystem: ValueSystem;
  registry: Registry;
  characterSystem: CharacterSystem;
  affectorEngine: AffectorEngine;
  /** spotId → 已解锁且 tag 匹配的强化 id 列表（反向索引）。 */
  enhIndex: ReadonlyMap<string, string[]>;
  /** spotId → 产出强化倍率缓存（宿主在强化/spot tag 变化时整体清空）。 */
  enhCache: Map<string, number>;
  /**
   * spotId → spot 产出子树整体系数缓存（P1-2）。
   * 宿主经事件驱动失效（升级/指派/强化/tag/extra，及存在 res 引用时资源变化）；
   * 缺省时不缓存。affectorFlows 叶子不缓存，保持实时。
   */
  prodCache?: Map<string, number>;
}

/** spot 产出子树根节点 id 前缀（buildSpotProduction 约定），用于识别可缓存的 mul 节点。 */
export const SPOT_NODE_PREFIX = 'spot:';

/** 懒求值：递归求值任意 GameNum 节点。 */
export function evaluateGameNum(node: GameNum, state: PlayerState, deps: GameNumEvalDeps): number {
  switch (node.kind) {
    case 'const':
      return node.value;
    case 'expr':
      return deps.valueSystem.evaluate(node.expr, state);
    case 'add':
      return node.children.reduce((sum, child) => sum + evaluateGameNum(child, state, deps), 0);
    case 'mul': {
      if (deps.prodCache && node.id.startsWith(SPOT_NODE_PREFIX)) {
        // 仅缓存「当前拥有」的 spot：所有权切换可能不经写入口事件（如测试直写
        // spotLevels），未拥有时绕过缓存读写可避免陈旧系数污染
        const spotId = node.id.slice(SPOT_NODE_PREFIX.length);
        if ((state.spotLevels[spotId] ?? 0) > 0) {
          const cached = deps.prodCache.get(spotId);
          if (cached !== undefined) return cached;
          const value = node.children.reduce((product, child) => product * evaluateGameNum(child, state, deps), 1);
          if (value !== 0) deps.prodCache.set(spotId, value);
          return value;
        }
      }
      return node.children.reduce((product, child) => product * evaluateGameNum(child, state, deps), 1);
    }
    case 'owned':
      return (state.spotLevels[node.spotId] ?? 0) > 0 ? 1 : 0;
    case 'levelLinear': {
      // 每级产出线性提升：floor((level-1) × yieldPerLevel)，等级 1 无增量
      const level = state.spotLevels[node.spotId] ?? 0;
      const spot = deps.registry.spots.get(node.spotId);
      const perLevel = spot?.yieldPerLevel ?? 0;
      return Math.floor(Math.max(0, level - 1) * perLevel);
    }
    case 'managerBonus': {
      // 冻结：manager 加成不再参与数值（docs-818/12-character-rework.md §4.4），恒 0
      void state;
      return 0;
    }
    case 'tagMultiplier': {
      // 冻结：角色标签加成不再参与数值，恒 1
      return 1;
    }
    case 'enhancementMultiplier': {
      const spot = deps.registry.spots.get(node.spotId);
      if (!spot) return 1;
      const cached = deps.enhCache.get(node.spotId);
      if (cached !== undefined) return cached;
      // 反向索引只含「已解锁且 tag 匹配」的强化，内层从 O(解锁强化数) 降为 O(适用强化数)
      let multiplier = 1;
      for (const enhId of deps.enhIndex.get(node.spotId) ?? []) {
        const enh = deps.registry.enhancements.get(enhId);
        if (enh?.productionMultiplier) multiplier *= enh.productionMultiplier;
      }
      deps.enhCache.set(node.spotId, multiplier);
      return multiplier;
    }
    case 'affectorFlows':
      return evaluateResourceAffectorFlows(node.resource, state, deps);
  }
}

/** 某 Spot 上挂载：所有活跃 Affector 的 addResource 贡献之和（evaluateSpotYield 的补充项）。 */
export function evaluateSpotAffectorFlows(spotId: string, state: PlayerState, deps: GameNumEvalDeps): number {
  let total = 0;
  for (const instance of deps.affectorEngine.getActiveInstances()) {
    if (instance.mountEntityId !== spotId) continue;
    const pack = deps.affectorEngine.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!instance.activeEntryIds.includes(entry.id)) continue;
      for (const effect of entry.effects) {
        if (effect.op !== 'addResource') continue;
        total += resolveEffectValue(effect, state, deps.valueSystem);
      }
    }
  }
  return total;
}

/** 该资源所有活跃 Affector 的 addResource 贡献之和（懒求值）。 */
export function evaluateResourceAffectorFlows(resource: string, state: PlayerState, deps: GameNumEvalDeps): number {
  let sum = 0;
  for (const instance of deps.affectorEngine.getActiveInstances()) {
    const pack = deps.affectorEngine.getPack(instance.packId);
    if (!pack) continue;
    for (const entry of pack.entries) {
      if (!instance.activeEntryIds.includes(entry.id)) continue;
      for (const effect of entry.effects) {
        if (effect.op !== 'addResource' || effect.target !== resource) continue;
        sum += resolveEffectValue(effect, state, deps.valueSystem);
      }
    }
  }
  return sum;
}

export function resolveEffectValue(effect: Effect, state: PlayerState, valueSystem: ValueSystem): number {
  const value = effect.value;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return valueSystem.evaluate(value as ValueExpression, state);
  }
  return Number(value) || 0;
}