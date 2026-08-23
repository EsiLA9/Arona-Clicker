// ============================================================
// engine/passive-pool-system.ts — 被动闲聊池系统（ADR-001 rev2 池层落地）
//
// 树状抽选 + reactor 反射 gate：
//   - 每个池的 condition 经 ConditionDepIndex 登记依赖，事件命中即标脏；
//     可用性查询惰性重算（推式标脏 × 拉式求值，ADR-002 模式）。
//   - 抽取：从根池递归下降，gate 不过的分支整枝剪除；叶子候选按
//     「路径上各池权重连乘 × entry 自身权重」加权，单次加权抽取。
//   - 未被任何池引用的 entry 自动归入引擎默认根池；未声明池时全部
//     entry 进默认根池——等价于无池平铺模型。
// ============================================================

import type { GameEvent, PassiveStoryEntry, PlayerState } from './types';
import { Registry } from './registry';
import { ConditionSystem } from './condition-system';
import { EventDrivenReactor } from './event-driven-reactor';
import { CONDITION_DEP_EVENT_TYPES, ConditionDepIndex } from './condition-deps';
import { EventBus } from './event-bus';

export class PassivePoolSystem extends EventDrivenReactor {
  private readonly condDeps = new ConditionDepIndex<string>();
  /** gate 已失效、待重算的池。 */
  private readonly dirty = new Set<string>();
  /** poolId → gate 结果缓存（仅含声明了 condition 的池）。 */
  private readonly gateCache = new Map<string, boolean>();

  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem: ConditionSystem,
    eventBus?: EventBus,
  ) {
    super(eventBus ?? new EventBus());
    this.rebuildIndex();
    this.subscribeTo(CONDITION_DEP_EVENT_TYPES);
  }

  /** 注册表变化（加载/热替换）后重建依赖索引。 */
  rebuildIndex(): void {
    this.condDeps.clear();
    this.dirty.clear();
    this.gateCache.clear();
    for (const pool of this.registry.passivePools.values()) {
      if (!pool.condition) continue;
      this.condDeps.register(pool.id, pool.condition);
      // 初始即标脏：gate 结果在首次查询时求值（避免未求值被缓存回退误放行）
      this.dirty.add(pool.id);
    }
  }

  /** 池 gate 是否满足（事件标脏 + 惰性重算；翻转时发 poolGateChanged）。 */
  isAvailable(poolId: string, state: PlayerState): boolean {
    const pool = this.registry.passivePools.get(poolId);
    if (!pool?.condition) return true;
    if (this.dirty.has(poolId)) {
      const next = this.conditionSystem.evaluateGroup(pool.condition, state);
      const prev = this.gateCache.get(poolId);
      this.gateCache.set(poolId, next);
      this.dirty.delete(poolId);
      if (prev !== undefined && prev !== next) {
        this.eventBus.emit({ type: 'poolGateChanged', poolId, available: next });
      }
    }
    return this.gateCache.get(poolId) ?? true;
  }

  /**
   * 抽取一条被动闲聊 entry。
   * @param state 当前状态
   * @param eligible 叶子资格谓词（availableInits / triggerCondition / repeatable 等，
   *                 由 StoryService 注入以复用既有语义）；返回 false 的叶子剪除。
   * @returns 命中的 entry id，无可用候选返回 null。
   */
  pick(state: PlayerState, eligible: (entry: PassiveStoryEntry) => boolean): string | null {
    interface Leaf { id: string; weight: number }
    const leaves: Leaf[] = [];
    const visitedPools = new Set<string>();

    const walk = (nodeId: string, pathWeight: number): void => {
      const pool = this.registry.passivePools.get(nodeId);
      if (pool) {
        if (visitedPools.has(nodeId)) return; // 环防护：池图必须为树/DAG
        visitedPools.add(nodeId);
        // gate 剪枝只影响本子树的候选资格；entry 归属（孤儿判定）是结构性的，见下
        if (!this.isAvailable(nodeId, state)) return;
        for (const child of pool.children) {
          walk(child.id, pathWeight * (child.weight ?? 1));
        }
        return;
      }
      // 叶子：被动闲聊 entry
      const entry = this.registry.passiveStories.get(nodeId);
      if (!entry || !eligible(entry)) return;
      leaves.push({ id: entry.id, weight: Math.max(0, entry.weight) * pathWeight });
    };

    const referenced = this.referencedEntryIds();
    for (const rootId of this.rootPoolIds()) {
      walk(rootId, 1);
    }

    // 孤儿 entry（未被任何池声明引用）→ 默认根池（自身 weight 即路径权重）
    for (const entry of this.registry.passiveStories.values()) {
      if (referenced.has(entry.id)) continue;
      if (!eligible(entry)) continue;
      leaves.push({ id: entry.id, weight: Math.max(0, entry.weight) });
    }

    const total = leaves.reduce((sum, leaf) => sum + leaf.weight, 0);
    if (!(total > 0)) return null;
    let roll = Math.random() * total;
    let selected = leaves[leaves.length - 1]!;
    for (const leaf of leaves) {
      roll -= leaf.weight;
      if (roll < 0) {
        selected = leaf;
        break;
      }
    }
    return selected.id;
  }

  /** 顶层池 = 未被其它池作为子节点引用的池；若互相引用成环（无拓扑根），退化为全部池（由环防护终止）。 */
  private rootPoolIds(): string[] {
    const childRefs = new Set<string>();
    for (const pool of this.registry.passivePools.values()) {
      for (const child of pool.children) {
        if (this.registry.passivePools.has(child.id)) childRefs.add(child.id);
      }
    }
    const all = [...this.registry.passivePools.keys()];
    const roots = all.filter(id => !childRefs.has(id));
    return roots.length > 0 ? roots : all;
  }

  /** 被任何池声明引用的 entry id（结构性归属，与 gate 可用性无关）。 */
  private referencedEntryIds(): Set<string> {
    const refs = new Set<string>();
    for (const pool of this.registry.passivePools.values()) {
      for (const child of pool.children) refs.add(child.id);
    }
    return refs;
  }

  protected onEvent(_type: GameEvent['type'], event: GameEvent): void {
    for (const poolId of this.condDeps.affected(event)) this.dirty.add(poolId);
  }
}
