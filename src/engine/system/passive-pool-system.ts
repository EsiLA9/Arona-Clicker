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

import type { GameEvent, PassiveStoryEntry, PlayerState } from '../types';
import { Registry } from '../registry/registry';
import { ConditionSystem } from '../expression/condition-system';
import { EventDrivenReactor } from '../effect/event-driven-reactor';
import { CONDITION_DEP_EVENT_TYPES, ConditionDepIndex } from '../expression/condition-deps';
import { EventBus } from '../core/event-bus';

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
   * @param opts.owner 壁垒：仅抽取归属该 VariantId 的 entry/pool（owner 未设置者仅全局闲聊可见）。
   * @param opts.cooldowns 冷却表（entryId/poolId → 上次抽取帧）；命中后未满 cooldownFrames 者剪除。
   * @param opts.blocks 阻断态：若某学生对话空间被 block 锁定，其 entry 整体剪除（直到条件满足解锁）。
   * @returns 命中的 entry id，无可用候选返回 null。
   */
  pick(
    state: PlayerState,
    eligible: (entry: PassiveStoryEntry) => boolean,
    opts: {
      owner?: string | null;
      cooldowns?: Record<string, number>;
      blocks?: Record<string, unknown>;
    } = {},
  ): string | null {
    const { owner = null, cooldowns = {}, blocks = {} } = opts;
    const frame = state.totalFrames;

    const inCooldown = (id: string, cd?: number): boolean => {
      if (!cd) return false;
      const last = cooldowns[id];
      if (last === undefined) return false;
      return frame - last < cd;
    };

    // 壁垒路由 + 阻断剪枝：effective owner 与入参 owner 必须匹配（或二者皆空）。
    // effective owner = entry.owner ?? 最近声明 owner 的祖先池（池内 entry 继承池归属）。
    const ownerOk = (effectiveOwner?: string): boolean => {
      if (owner === null) return !effectiveOwner; // 全局闲聊：只收无 owner 者
      return effectiveOwner === owner; // 对话空间：只收归该学生者
    };

    interface Leaf { id: string; weight: number }
    const leaves: Leaf[] = [];
    const visitedPools = new Set<string>();

    const walk = (nodeId: string, pathWeight: number, poolCooldown: number | undefined, inheritedOwner: string | undefined): void => {
      const pool = this.registry.passivePools.get(nodeId);
      if (pool) {
        if (visitedPools.has(nodeId)) return; // 环防护：池图必须为树/DAG
        visitedPools.add(nodeId);
        // 壁垒：仅"显式声明 owner 的池"受归属约束；无 owner 的池是中立容器，放行其子树
        const effOwner = pool.owner ?? inheritedOwner;
        if (pool.owner && !ownerOk(pool.owner)) return;
        // 阻断：若该池归属的学生对话空间被锁定，整体不可抽
        if (effOwner && blocks[effOwner]) return;
        // 冷却：池级冷却未满则整枝剪除
        if (inCooldown(pool.id, pool.cooldownFrames ?? poolCooldown)) return;
        // gate 剪枝只影响本子树的候选资格
        if (!this.isAvailable(nodeId, state)) return;
        for (const child of pool.children) {
          walk(child.id, pathWeight * (child.weight ?? 1), pool.cooldownFrames, effOwner);
        }
        return;
      }
      // 叶子：被动闲聊 entry（继承祖先池 owner 作为 effective owner）
      const entry = this.registry.passiveStories.get(nodeId);
      if (!entry || !eligible(entry)) return;
      const effOwner = entry.owner ?? inheritedOwner;
      // 壁垒：effective owner 不匹配则剪除
      if (!ownerOk(effOwner)) return;
      // 阻断：若该 entry 归属学生对话空间被锁定，剪除
      if (effOwner && blocks[effOwner]) return;
      // 冷却：entry 级冷却未满则剪除
      if (inCooldown(entry.id, entry.cooldownFrames)) return;
      leaves.push({ id: entry.id, weight: Math.max(0, entry.weight) * pathWeight });
    };

    const referenced = this.referencedEntryIds();
    for (const rootId of this.rootPoolIds()) {
      walk(rootId, 1, undefined, undefined);
    }

    // 孤儿 entry（未被任何池声明引用）→ 默认根池（自身 weight 即路径权重）
    for (const entry of this.registry.passiveStories.values()) {
      if (referenced.has(entry.id)) continue;
      if (!eligible(entry)) continue;
      if (!ownerOk(entry.owner)) continue;
      if (entry.owner && blocks[entry.owner]) continue;
      if (inCooldown(entry.id, entry.cooldownFrames)) continue;
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
