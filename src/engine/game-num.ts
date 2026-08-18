// ============================================================
// engine/game-num.ts — 统一数值注册 + 懒求值（GameNum）
//
// 每个 Resource 拥有一棵 gain 树，根节点即 primitiveGain：
// 每 Tick 对该资源求值一次，得到本 Tick 的获取量。
//
// 成员树"逐级到最末端"（credit 为例）：
//   primitiveGain (add)
//   ├── spot:credit_printer (mul)
//   │   ├── baseLine (add)
//   │   │   ├── base (expr: baseYield)
//   │   │   └── manager (运行时叶子: managerBonus)
//   │   ├── tag (运行时叶子: tagMultiplier)
//   │   └── enh (运行时叶子: enhancementMultiplier)
//   ├── spot:field_work (mul) ...
//   └── affectors (运行时叶子: affectorFlows)
//
// 节点只存定义（id + 组合/来源），求值时懒读取 PlayerState —— 不缓存、按需计算。
// ============================================================

import {
  PlayerState,
  ValueExpression,
  Character,
  Resource,
  Effect,
} from './types';
import { Registry } from './registry';
import { ValueSystem } from './value-system';
import { CharacterSystem } from './character-system';
import { AffectorEngine } from './affector-engine';
import { matchesTag } from './tag';

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

export interface GameNumContext {
  valueSystem: ValueSystem;
  registry: Registry;
  characterSystem: CharacterSystem;
  affectorEngine: AffectorEngine;
}

const add = (id: string, children: GameNum[]): GameNum => ({ id, kind: 'add', children });
const mul = (id: string, children: GameNum[]): GameNum => ({ id, kind: 'mul', children });

export class GameNumSystem {
  /** resource → primitiveGain 根节点（add 树）。 */
  private readonly gains = new Map<string, GameNum>();
  /** spotId → 该 Spot 的产出子树（构建时缓存，供单 Spot 最终产出查询）。 */
  private readonly spotNodes = new Map<string, GameNum>();
  private built = false;

  constructor(private readonly ctx: GameNumContext) {}

  /** 已注册的资源集合。 */
  getResources(): string[] {
    return [...this.gains.keys()];
  }

  /** 根节点（primitiveGain）定义，便于溯源/展示。 */
  getGainNode(resource: string): GameNum | undefined {
    return this.gains.get(resource);
  }

  /** 从注册表数据构建所有资源的 primitiveGain 树（数据加载后调用一次）。 */
  buildAll(): void {
    if (this.built) return;
    const resources = new Set<string>([Resource.Credit, Resource.Pyroxene]);
    for (const spot of this.ctx.registry.spots.values()) resources.add(spot.baseYieldResource);
    for (const resource of resources) this.buildResourceGain(resource);
    this.built = true;
  }

  /** 为单个资源构建 gain 树（可单独注册新资源）。 */
  buildResourceGain(resource: string): void {
    if (this.gains.has(resource)) return;
    const children: GameNum[] = [];
    for (const spot of this.ctx.registry.spots.values()) {
      if (spot.baseYieldResource !== resource) continue;
      children.push(this.buildSpotProduction(spot.id));
    }
    children.push({ id: `affectors:${resource}`, kind: 'affectorFlows', resource });
    this.gains.set(resource, add(`primitiveGain:${resource}`, children));
  }

  /** 懒求值：某资源本 Tick 的获取量（primitiveGain）。 */
  evaluateResourceGain(resource: string, state: PlayerState): number {
    const node = this.gains.get(resource);
    if (!node) return 0;
    return this.evaluate(node, state);
  }

  /**
   * 懒求值：某 Spot 的最终产出值（随状态实时变化）。
   * = spot 产出子树（base + manager + tag + enh 倍率） + 挂载在该 Spot 上的
   *   功能/其他 Affector 的 addResource 贡献（如 linearYield 每级额外产出）。
   */
  evaluateSpotYield(spotId: string, state: PlayerState): number {
    const spot = this.ctx.registry.spots.get(spotId);
    if (!spot) return 0;
    const node = this.spotNodes.get(spotId) ?? this.buildSpotProduction(spotId);
    let total = this.evaluate(node, state);

    for (const instance of this.ctx.affectorEngine.getActiveInstances()) {
      if (instance.mountEntityId !== spotId) continue;
      const pack = this.ctx.affectorEngine.getPack(instance.packId);
      if (!pack) continue;
      for (const entry of pack.entries) {
        if (!instance.activeEntryIds.includes(entry.id)) continue;
        for (const effect of entry.effects) {
          if (effect.op !== 'addResource') continue;
          total += this.resolveEffectValue(effect, state);
        }
      }
    }
    return total;
  }

  /** 懒求值：递归求值任意 GameNum 节点。 */
  evaluate(node: GameNum, state: PlayerState): number {
    switch (node.kind) {
      case 'const':
        return node.value;
      case 'expr':
        return this.ctx.valueSystem.evaluate(node.expr, state);
      case 'add':
        return node.children.reduce((sum, child) => sum + this.evaluate(child, state), 0);
      case 'mul':
        return node.children.reduce((product, child) => product * this.evaluate(child, state), 1);
      case 'owned':
        return (state.spotLevels[node.spotId] ?? 0) > 0 ? 1 : 0;
      case 'levelLinear': {
        // 每级产出线性提升：floor((level-1) × yieldPerLevel)，等级 1 无增量
        const level = state.spotLevels[node.spotId] ?? 0;
        const spot = this.ctx.registry.spots.get(node.spotId);
        const perLevel = spot?.yieldPerLevel ?? 0;
        return Math.floor(Math.max(0, level - 1) * perLevel);
      }
      case 'managerBonus': {
        const manager = state.spotManagers[node.spotId] ?? Character.None;
        if (manager === Character.None) return 0;
        const spot = this.ctx.registry.spots.get(node.spotId);
        if (!spot) return 0;
        return this.ctx.valueSystem.evaluate(spot.managerBonusYield, state);
      }
      case 'tagMultiplier': {
        const manager = state.spotManagers[node.spotId] ?? Character.None;
        if (manager === Character.None) return 1;
        const spot = this.ctx.registry.spots.get(node.spotId);
        if (!spot) return 1;
        return (spot.tags ?? []).reduce(
          (multiplier, tag) => multiplier * this.ctx.characterSystem.getTagBonus(manager, tag),
          1,
        );
      }
      case 'enhancementMultiplier': {
        const spot = this.ctx.registry.spots.get(node.spotId);
        if (!spot) return 1;
        const spotTags = spot.tags ?? [];
        let multiplier = 1;
        for (const enhId of state.unlockedEnhancements) {
          const enh = this.ctx.registry.enhancements.get(enhId);
          if (!enh?.productionMultiplier) continue;
          // 作用域为全局（当前 Init）：只按 tag 匹配，不按 Area 限定
          if (enh.productionTags && enh.productionTags.length > 0
            && !enh.productionTags.some(query => spotTags.some(declared => matchesTag(declared, query)))) {
            continue;
          }
          multiplier *= enh.productionMultiplier;
        }
        return multiplier;
      }
      case 'affectorFlows':
        return this.evaluateAffectorFlows(node.resource, state);
    }
  }

  /** 构建单个 Spot 的产出子树（逐级展开到末端；缓存复用）。 */
  private buildSpotProduction(spotId: string): GameNum {
    const cached = this.spotNodes.get(spotId);
    if (cached) return cached;
    const node = mul(`spot:${spotId}`, [
      { id: `owned:${spotId}`, kind: 'owned', spotId },
      add(`baseLine:${spotId}`, [
        add(`baseYield:${spotId}`, [
          { id: `base:${spotId}`, kind: 'expr', expr: this.spot(spotId).baseYield },
          ...(this.spot(spotId).yieldPerLevel
            ? [{ id: `levelLinear:${spotId}`, kind: 'levelLinear' as const, spotId }]
            : []),
        ]),
        { id: `manager:${spotId}`, kind: 'managerBonus', spotId },
      ]),
      { id: `tag:${spotId}`, kind: 'tagMultiplier', spotId },
      { id: `enh:${spotId}`, kind: 'enhancementMultiplier', spotId },
    ]);
    this.spotNodes.set(spotId, node);
    return node;
  }

  private spot(spotId: string) {
    const spot = this.ctx.registry.spots.get(spotId);
    if (!spot) throw new Error(`GameNum: unknown spot ${spotId}`);
    return spot;
  }

  /** 该资源所有活跃 Affector 的 addResource 贡献之和（懒求值）。 */
  private evaluateAffectorFlows(resource: string, state: PlayerState): number {
    let sum = 0;
    for (const instance of this.ctx.affectorEngine.getActiveInstances()) {
      const pack = this.ctx.affectorEngine.getPack(instance.packId);
      if (!pack) continue;
      for (const entry of pack.entries) {
        if (!instance.activeEntryIds.includes(entry.id)) continue;
        for (const effect of entry.effects) {
          if (effect.op !== 'addResource' || effect.target !== resource) continue;
          sum += this.resolveEffectValue(effect, state);
        }
      }
    }
    return sum;
  }

  private resolveEffectValue(effect: Effect, state: PlayerState): number {
    const value = effect.value;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null && 'type' in value) {
      return this.ctx.valueSystem.evaluate(value as ValueExpression, state);
    }
    return Number(value) || 0;
  }
}
