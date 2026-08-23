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
  Resource,
  Value,
  ValueExpression,
} from '../types';
import { Registry } from '../registry/registry';
import { ValueSystem } from './value-system';
import { CharacterSystem } from '../system/character-system';
import { AffectorEngine } from '../effect/affector-engine';
import { matchesTag } from '../core/tag';
import type { EventBus } from '../core/event-bus';
export type { GameNum } from './game-num-eval';
import { evaluateGameNum, evaluateSpotAffectorFlows, GameNumEvalDeps } from './game-num-eval';
import type { GameNum } from './game-num-eval';

export interface GameNumContext {
  valueSystem: ValueSystem;
  registry: Registry;
  characterSystem: CharacterSystem;
  affectorEngine: AffectorEngine;
  /** 可选：注入后订阅强化解锁/移除事件，增量维护产出反向索引与倍率缓存。 */
  eventBus?: EventBus;
}

const add = (id: string, children: GameNum[]): GameNum => ({ id, kind: 'add', children });
const mul = (id: string, children: GameNum[]): GameNum => ({ id, kind: 'mul', children });

export class GameNumSystem {
  /** resource → primitiveGain 根节点（add 树）。 */
  private readonly gains = new Map<string, GameNum>();
  /** spotId → 该 Spot 的产出子树（构建时缓存，供单 Spot 最终产出查询）。 */
  private readonly spotNodes = new Map<string, GameNum>();
  /** spotId → 已解锁且与 spot tags 匹配的强化 id 列表（反向索引：避免每 Tick 全量扫所有强化）。 */
  private readonly spotEnhIndex = new Map<string, string[]>();
  /** 当前已解锁强化集合（镜像，用于动态 tag 变化时重建索引）。 */
  private readonly unlocked = new Set<string>();
   /** spotId → 已计算的产出强化倍率缓存（在强化解锁/移除、spot tag 变化时整体失效）。 */
   private readonly enhCache = new Map<string, number>();
   /** spotId → spot 产出子树整体系数缓存（P1-2；事件驱动失效，见构造函数订阅）。 */
   private readonly productionCache = new Map<string, number>();
   /** 静态扫描结果：产出表达式是否引用资源余额（null = 未扫描）。 */
   private resourceDependentExprs: boolean | null = null;
   private built = false;

   constructor(private readonly ctx: GameNumContext) {
     const bus = ctx.eventBus;
     if (bus) {
       // 产出的强化倍率只取决于「已解锁强化 × spot tags(含动态)」组合：
       // 解锁/移除增量维护索引；spot tag 动态变化时整索引重建。
       bus.on('enhancementAdded', (e) => {
         if (e.type !== 'enhancementAdded') return;
         this.unlocked.add(e.enhancementId);
         this.addEnhToIndex(e.enhancementId);
         this.invalidateProduction();
       });
       bus.on('enhancementRemoved', (e) => {
         if (e.type !== 'enhancementRemoved') return;
         this.unlocked.delete(e.enhancementId);
         this.removeEnhFromIndex(e.enhancementId);
         this.invalidateProduction();
       });
       bus.on('spotTagChanged', () => {
         this.rebuildIndex();
         this.invalidateProduction();
       });
       // 产出子树内的 base/manager/tag 叶子依赖等级与指派（含 spotCount/managerCount
       // 类表达式对任意 spot/init 的读取），以及 data 源对 Extra 的读取：
       // 对应写入口的事件到达时整体失效。升级/指派是低频操作，不构成 Tick 热点。
       for (const type of ['spotLevelChanged', 'managerChanged', 'extraChanged'] as const) {
         bus.on(type, () => this.productionCache.clear());
       }
       // 资源余额默认不影响产出；仅当静态扫描发现存在 res 引用（含 funclet 展开）时才失效，
       // 避免每 Tick 的 resourceChanged 把缓存打穿。
       bus.on('resourceChanged', () => {
         if (this.mayReadResources()) this.productionCache.clear();
       });
     }
   }

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

  /** 用当前已解锁强化重建反向索引（加载存档/新游戏后调用一次）。 */
  rebuildEnhIndex(unlocked: string[]): void {
    this.unlocked.clear();
    for (const id of unlocked) this.unlocked.add(id);
    this.rebuildIndex();
    this.invalidateProduction();
  }

  /** 清空全部产出缓存（强化倍率 + spot 整体系数；世界线切换/存档加载时随状态整体更换调用）。 */
  invalidateProduction(): void {
    this.enhCache.clear();
    this.productionCache.clear();
  }

  /**
   * 静态扫描全部 Spot 的产出表达式是否引用资源余额（res 源，含 funclet 定义展开）。
   * 惰性计算一次：无引用时 resourceChanged 无需失效产出缓存。
   */
  private mayReadResources(): boolean {
    if (this.resourceDependentExprs === null) {
      let result = false;
      for (const spot of this.ctx.registry.spots.values()) {
        if (
          exprReadsResource(spot.baseYield, this.ctx.valueSystem) ||
          exprReadsResource(spot.managerBonusYield, this.ctx.valueSystem)
        ) {
          result = true;
          break;
        }
      }
      this.resourceDependentExprs = result;
    }
    return this.resourceDependentExprs;
  }

  /** 基于当前已解锁集合与 registry spot tags 重建反向索引。 */
  private rebuildIndex(): void {
    this.spotEnhIndex.clear();
    for (const enhId of this.unlocked) this.addEnhToIndex(enhId);
  }

  /** 把单个强化按其 productionTags 与 spot tags 的匹配关系登记进各 spot 的反向索引。 */
  private addEnhToIndex(enhId: string): void {
    const enh = this.ctx.registry.enhancements.get(enhId);
    if (!enh?.productionMultiplier) return;
    const queries = enh.productionTags ?? [];
    for (const spot of this.ctx.registry.spots.values()) {
      const spotTags = spot.tags ?? [];
      if (queries.length > 0 && !queries.some(q => spotTags.some(t => matchesTag(t, q)))) continue;
      let list = this.spotEnhIndex.get(spot.id);
      if (!list) { list = []; this.spotEnhIndex.set(spot.id, list); }
      if (!list.includes(enhId)) list.push(enhId);
    }
  }

  /** 从所有 spot 的反向索引中移除某强化（解锁回退）。 */
  private removeEnhFromIndex(enhId: string): void {
    for (const list of this.spotEnhIndex.values()) {
      const i = list.indexOf(enhId);
      if (i >= 0) list.splice(i, 1);
    }
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
    return this.evaluate(node, state) + evaluateSpotAffectorFlows(spotId, state, this.evalDeps());
  }

  /** 懒求值：递归求值任意 GameNum 节点。 */
  evaluate(node: GameNum, state: PlayerState): number {
    return evaluateGameNum(node, state, this.evalDeps());
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

  /** 组装求值依赖（含宿主维护的反向索引与倍率缓存）。 */
  private evalDeps(): GameNumEvalDeps {
    return {
      valueSystem: this.ctx.valueSystem,
      registry: this.ctx.registry,
      characterSystem: this.ctx.characterSystem,
      affectorEngine: this.ctx.affectorEngine,
      enhIndex: this.spotEnhIndex,
      enhCache: this.enhCache,
      prodCache: this.productionCache,
    };
  }
}

/** 表达式是否引用资源余额：mul 展开；value 走 Value 扫描。 */
const exprReadsResource = (expr: ValueExpression, vs: ValueSystem, seen = new Set<string>()): boolean => {
  if (expr.type === 'mul') {
    return exprReadsResource(expr.left, vs, seen) || exprReadsResource(expr.right, vs, seen);
  }
  if (expr.type !== 'value') return false;
  return valueReadsResource(expr.value, vs, seen);
};

/** Value 是否引用资源余额：res 直接命中；funclet 展开其定义（seen 防环）。 */
const valueReadsResource = (val: Value, vs: ValueSystem, seen: Set<string>): boolean => {
  if (val.source === 'res') return true;
  if (val.source === 'funclet') {
    const id = String(val.params.funclet ?? '');
    if (seen.has(id)) return false;
    const def = vs.getFunclet(id);
    if (!def) return false;
    seen.add(id);
    return exprReadsResource(def.calc, vs, seen);
  }
  return false;
};
