// ============================================================
// engine/expression/game-num.ts — GameNumSystem（GameNum 数值树宿主 + 区表）
//
// 职责（门面层）：
// - 构造：子系统注入 + 事件订阅（enhancementAdded/Removed、spotTag/Level 变更、
//   manager/extra/resource 变更 → 失效重建）。
// - 状态字段：价值树（gains）、spot 子树、zone 节点、
//   parents / allNodes / zoneNodes 等索引（供 build/tag 模块读写）。
// - 求值入口：evaluate / evaluateWithBreakdown / getGainNode / getResources /
//   evaluateResourceGain /
//   evaluateSpotYield（层级视图含自身 flat/flows；getSpotMultiplier 已删，UI 经
//   buildZoneNode 精确读区节点）。
//
// 树构建见 ./game-num-build.ts，区表维护与 Affector 桥接见 ./game-num-tag.ts，
// 纯求值见 ./game-num-eval.ts。
// ============================================================

import type { ValueExpression } from '../types';
import type { GameNumState } from '../contracts/state-query';
import type { EventBus } from '../core/event-bus';
import type { GameNumRegistryContext, GameNumFlowSource } from '../contracts/evaluation-context';
import type { GameNumAffectorContext } from '../contracts/evaluation-context';
import { ValueSystem } from './value-system';
import type { GameNum, GameNumEvalDeps, BreakdownResult } from './game-num-eval';
import { evaluateGameNum, evaluateGameNumBreakdown } from './game-num-eval';
import { TagEffectRecord, EntityRef, ZoneModifierDecl } from './tag-effect';
import type { ZoneNode, ZoneIndexEntry } from './game-num-internal';
import { buildAll as buildAllImpl, buildZoneNode as buildZoneNodeImpl, rebuildZoneIndex as rebuildZoneIndexImpl } from './game-num-build';import {
  registerTagEffect as registerTagEffectImpl,
  registerEntityEffect as registerEntityEffectImpl,
  removeTagEffect as removeTagEffectImpl,
  removeTagEffectsBySource as removeTagEffectsBySourceImpl,
  syncAffectorZoneEffects as syncAffectorZoneEffectsImpl,
  markAllDirty,
  markDirty,
  markZoneDirty,
  markSubtreeDirty,
} from './game-num-tag';

export { aggregateZone } from './game-num-eval';
export type { GameNum } from './game-num-eval';

/** GameNumSystem 构造上下文（宿主注入系统与可选事件总线）。 */
export interface GameNumContext {
  valueSystem: ValueSystem;
  registry: GameNumRegistryContext;
  affectorEngine: GameNumAffectorContext;
  eventBus?: EventBus;
}

export class GameNumSystem {
  readonly bus?: EventBus;
  readonly registry: GameNumRegistryContext;
  readonly valueSystem: ValueSystem;
  readonly affectorEngine: GameNumAffectorContext;

  /** 资源 -> 该资源 primitiveGain 根节点（add 树）。 */
  gains = new Map<string, GameNum>();
  /** spot -> 其产出子树根（spotFull = spotProduct + spotExtra；evaluateSpotYield 用）。 */
  spotSubtrees = new Map<string, GameNum>();

  /** zoneIndex：tagKey / entityKey -> 命中的 flat/mul 区节点集合（注册来源路由用）。 */
  zoneIndex = new Map<string, ZoneIndexEntry>();
  /** 子节点 -> 父节点列表（脏位向上回溯用）。 */
  parents = new Map<string, GameNum[]>();
  /** 所有节点（整树失效用）。 */
  allNodes: GameNum[] = [];
  /** 所有 zone 节点（rebuildZoneIndex 重建反路由用）。 */
  zoneNodes: ZoneNode[] = [];

  // ---- Phase 6 显式层级树的节点索引（buildAll 填充，key 均为 `<entityId>@<resource>`） ----
  /** spotId@res -> spotFull（flows 挂载点）。 */
  spotFullNodes = new Map<string, GameNum>();
  /** spotId@res -> spotProduct（进上级 areaBase 的 base 链节点）。 */
  spotProductNodes = new Map<string, GameNum>();
  /** spotId@res -> spotExtra（spotFlat + spotFlows）。 */
  spotExtraNodes = new Map<string, GameNum>();
  /** areaId@res -> areaExtra（areaFlat + areaFlows + Σ spotExtra）。 */
  areaExtraNodes = new Map<string, GameNum>();
  /** initId@res -> initExtra（initFlat + initFlows + Σ areaExtra）。 */
  initExtraNodes = new Map<string, GameNum>();
  /** flows 节点 id -> 节点（ensureFlowsNodes 幂等创建用）。 */
  flowsNodeById = new Map<string, GameNum>();

  /** 活跃 Affector 源集合，用于按 source 反查撤回区记录。 */
  syncedAffectorSources = new Set<string>();
  /** source -> 其写入区表的位置，撤销时不扫描整张 state 表。 */
  sourceEffectLocations = new Map<string, Set<{ table: 'tag' | 'entity'; key: string; recordId: string }>>();

  /** 每个 primitiveGain 的资源依赖集合（buildAll 静态扫描产物；resourceChanged 定向失效的数据基础）。 */
  gainResourceDeps = new Map<string, Set<string>>();
  /** 任一 gain 读资源时为 true（gainResourceDeps 的派生）。 */
  mayReadResources = false;
  /** 区表 key -> 该键下登记记录 expr 所读资源集合（register 时累积，resourceChanged 定向失效用）。 */
  zoneKeyResourceDeps = new Map<string, Set<string>>();
  /** flows expr 所读资源集合（syncAffectorZoneEffects 重建；resourceChanged 定向失效用）。 */
  flowsResourceDeps = new Map<string, Set<string>>();
  /** resource -> flows 节点列表（flows 按挂载层级分发出多个节点，Phase 6）。 */
  affectorFlowsNodes = new Map<string, GameNum[]>();
  /** `(resource, mount)` -> 当前活跃 flow 来源；仅由 Affector 同步过程重建。 */
  affectorFlowSources = new Map<string, readonly GameNumFlowSource[]>();

  /** 已登记资源集合（spot 基础产出 + state.resources，含仅经 affectorFlows 产出的资源）。 */
  resourceSet = new Set<string>();
  state?: GameNumState;

  constructor(ctx: GameNumContext) {
    this.bus = ctx.eventBus;
    this.registry = ctx.registry;
    this.valueSystem = ctx.valueSystem;
    this.affectorEngine = ctx.affectorEngine;

    const invalidate = () => this.invalidateProduction();
    this.bus?.on('enhancementAdded', invalidate);
    this.bus?.on('enhancementRemoved', () => {
      this.invalidateProduction();
      if (this.affectorEngine && this.state) this.syncAffectorZoneEffects(this.affectorEngine, this.state);
    });
    this.bus?.on('spotTagChanged', () => {
      // spot 有效标签变化（T6 状态层覆盖）：zoneIndex 按构建期标签建的，
      // 必须先按当前有效 tags 重建反路由，否则后续 sync 仍命中旧 spot 集。
      this.rebuildZoneIndex();
      this.invalidateProduction();
      if (this.affectorEngine && this.state) this.syncAffectorZoneEffects(this.affectorEngine, this.state);
    });
    this.bus?.on('spotLevelChanged', () => {
      this.invalidateProduction();
      if (this.affectorEngine && this.state) this.syncAffectorZoneEffects(this.affectorEngine, this.state);
    });
    this.bus?.on('managerChanged', invalidate);
    this.bus?.on('extraChanged', invalidate);
    this.bus?.on('resourceChanged', event => {
      this.onResourceChanged(event.resource);
    });
    // Affector 生命周期 / 激活 entry 集变化 → 重同步区表与 flows
    // （T7 事件化：替代 Affector 反向持 GameNum 的 notifyGameNum 通道）
    this.bus?.on('affectorRuntimeChanged', () => this.onAffectorInstancesChanged());
  }

  /**
   * resourceChanged 定向失效（Phase 5）：只重算受该资源影响的子树——
   * ① 静态依赖该资源的 primitiveGain（gainResourceDeps）；
   * ② 登记过读该资源 expr 的区表 key 命中的 zone 节点；
   * ③ flows expr 读该资源的 affectorFlows 节点。
   * 不读任何资源的 gain 保持跨帧缓存。
   */
  onResourceChanged(resource: string): void {
    for (const [gainId, deps] of this.gainResourceDeps) {
      if (!deps.has(resource)) continue;
      const gain = this.gains.get(gainId);
      if (gain) markSubtreeDirty(gain);
    }
    for (const [key, deps] of this.zoneKeyResourceDeps) {
      if (deps.has(resource)) markZoneDirty(this, key);
    }
    for (const node of this.affectorFlowsNodes.get(resource) ?? []) {
      markDirty(this, node);
    }
  }

  /**
   * Affector 实例集合 / 激活 entry 集变化（mount / unmount / recheck 翻转）：
   * 同步区表记录 + 补齐缺失的层级 flows 节点 + 全部 flows 节点失效（缓存值随活跃集变化）。
   */
  onAffectorInstancesChanged(): void {
    if (!this.state) return;
    this.syncAffectorZoneEffects(this.affectorEngine, this.state);
    for (const nodes of this.affectorFlowsNodes.values()) {
      for (const node of nodes) markDirty(this, node);
    }
  }

  private evalDeps(): GameNumEvalDeps {
    return {
      valueSystem: this.valueSystem,
      registry: this.registry,
      affectorEngine: this.affectorEngine,
      affectorFlowSources: this.affectorFlowSources,
    };
  }

  // ---------------- 构建（委托 ./game-num-build.ts） ----------------

  buildAll(state?: GameNumState): void {
    buildAllImpl(this, state);
  }

  buildZoneNode(scope: EntityRef, part: 'flat' | 'mul', resource?: string): ZoneNode {
    return buildZoneNodeImpl(this, scope, part, resource);
  }

  rebuildZoneIndex(): void {
    rebuildZoneIndexImpl(this);
  }

  // ---------------- 脏位 ----------------

  /** 整表失效（结构变化调用）。 */
  invalidateProduction(): void {
    markAllDirty(this);
  }

  // ---------------- 区表 + 命名乘区路由（委托 ./game-num-tag.ts） ----------------

  registerTagEffect(state: GameNumState, tagKey: string, record: TagEffectRecord): void {
    registerTagEffectImpl(this, state, tagKey, record);
  }

  registerEntityEffect(state: GameNumState, entityKeyStr: string, record: TagEffectRecord): void {
    registerEntityEffectImpl(this, state, entityKeyStr, record);
  }

  removeTagEffect(state: GameNumState, tagKey: string, id: string): void {
    removeTagEffectImpl(this, state, tagKey, id);
  }

  removeTagEffectsBySource(state: GameNumState, source: string): void {
    removeTagEffectsBySourceImpl(this, state, source);
  }

  syncAffectorZoneEffects(affector: GameNumAffectorContext, state: GameNumState): void {
    syncAffectorZoneEffectsImpl(this, affector, state);
  }

  // ---------------- 求值入口 ----------------

  evaluate(node: GameNum, state: GameNumState): number {
    return evaluateGameNum(node, state, this.evalDeps());
  }

  evaluateWithBreakdown(node: GameNum, state: GameNumState): BreakdownResult {
    return {
      value: this.evaluate(node, state),
      contributions: [evaluateGameNumBreakdown(node, state, this.evalDeps())],
    };
  }

  getGainNode(resource: string): GameNum | undefined {
    return this.gains.get(resource);
  }

  /** 当前已构建产出的资源清单（tick-system 遍历用）。 */
  getResources(): string[] {
    return [...this.gains.keys()];
  }

  evaluateResourceGain(resource: string, state: GameNumState): number {
    const node = this.gains.get(resource);
    if (!node) return 0;
    return this.evaluate(node, state);
  }

  evaluateSpotYield(spotId: string, state: GameNumState): number {
    const node = this.spotSubtrees.get(spotId);
    if (!node) return 0;
    return this.evaluate(node, state);
  }

  }
