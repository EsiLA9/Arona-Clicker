import type { GameEvent } from '../../engine/types';
import type { PassiveStoryEntry } from '../../data-services/contracts/story-entry';
import type { PlayerState } from '../types/state';
import { Registry } from '../../data-services/registry/registry';
import { ConditionSystem } from '../../engine/expression/condition-system';
import { EventDrivenReactor } from '../../engine/effect/event-driven-reactor';
import { CONDITION_DEP_EVENT_TYPES, ConditionDepIndex } from '../../engine/expression/condition-deps';
import { EventBus } from '../../engine/core/event-bus';

export class PassivePoolSystem extends EventDrivenReactor {
  private readonly condDeps = new ConditionDepIndex<string>();
  private readonly dirty = new Set<string>();
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

  rebuildIndex(): void {
    this.condDeps.clear();
    this.dirty.clear();
    this.gateCache.clear();
    for (const pool of this.registry.passivePools.values()) {
      if (!pool.condition) continue;
      this.condDeps.register(pool.id, pool.condition);
      this.dirty.add(pool.id);
    }
  }

  isAvailable(poolId: string, state: PlayerState): boolean {
    const pool = this.registry.passivePools.get(poolId);
    if (!pool?.condition) return true;
    if (this.dirty.has(poolId)) {
      const next = this.conditionSystem.evaluateGroup(pool.condition, state);
      const prev = this.gateCache.get(poolId);
      this.gateCache.set(poolId, next);
      this.dirty.delete(poolId);
      if (prev !== undefined && prev !== next) this.eventBus.emit({ type: 'poolGateChanged', poolId, available: next });
    }
    return this.gateCache.get(poolId) ?? true;
  }

  pick(
    state: PlayerState,
    eligible: (entry: PassiveStoryEntry) => boolean,
    opts: { owner?: string | null; cooldowns?: Record<string, number>; blocks?: Record<string, unknown> } = {},
  ): string | null {
    const { owner = null, cooldowns = {}, blocks = {} } = opts;
    const frame = state.totalFrames;
    const inCooldown = (id: string, cd?: number): boolean => {
      if (!cd) return false;
      const last = cooldowns[id];
      return last !== undefined && frame - last < cd;
    };
    const ownerOk = (effectiveOwner?: string): boolean => owner === null ? !effectiveOwner : effectiveOwner === owner;
    interface Leaf { id: string; weight: number }
    const leaves: Leaf[] = [];
    const visitedPools = new Set<string>();
    const walk = (nodeId: string, pathWeight: number, poolCooldown: number | undefined, inheritedOwner: string | undefined): void => {
      const pool = this.registry.passivePools.get(nodeId);
      if (pool) {
        if (visitedPools.has(nodeId)) return;
        visitedPools.add(nodeId);
        const effectiveOwner = pool.owner ?? inheritedOwner;
        if (pool.owner && !ownerOk(pool.owner)) return;
        if (effectiveOwner && blocks[effectiveOwner]) return;
        if (inCooldown(pool.id, pool.cooldownFrames ?? poolCooldown)) return;
        if (!this.isAvailable(nodeId, state)) return;
        for (const child of pool.children) walk(child.id, pathWeight * (child.weight ?? 1), pool.cooldownFrames, effectiveOwner);
        return;
      }
      const entry = this.registry.passiveStories.get(nodeId);
      if (!entry || !eligible(entry)) return;
      const effectiveOwner = entry.owner ?? inheritedOwner;
      if (!ownerOk(effectiveOwner)) return;
      if (effectiveOwner && blocks[effectiveOwner]) return;
      if (inCooldown(entry.id, entry.cooldownFrames)) return;
      leaves.push({ id: entry.id, weight: Math.max(0, entry.weight) * pathWeight });
    };
    const referenced = this.referencedEntryIds();
    for (const rootId of this.rootPoolIds()) walk(rootId, 1, undefined, undefined);
    for (const entry of this.registry.passiveStories.values()) {
      if (referenced.has(entry.id) || !eligible(entry) || !ownerOk(entry.owner)) continue;
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
      if (roll < 0) { selected = leaf; break; }
    }
    return selected.id;
  }

  private rootPoolIds(): string[] {
    const childRefs = new Set<string>();
    for (const pool of this.registry.passivePools.values()) {
      for (const child of pool.children) if (this.registry.passivePools.has(child.id)) childRefs.add(child.id);
    }
    const all = [...this.registry.passivePools.keys()];
    const roots = all.filter(id => !childRefs.has(id));
    return roots.length > 0 ? roots : all;
  }

  private referencedEntryIds(): Set<string> {
    const refs = new Set<string>();
    for (const pool of this.registry.passivePools.values()) for (const child of pool.children) refs.add(child.id);
    return refs;
  }

  protected onEvent(_type: GameEvent['type'], event: GameEvent): void {
    for (const poolId of this.condDeps.affected(event)) this.dirty.add(poolId);
  }
}
