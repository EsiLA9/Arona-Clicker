// ============================================================
// engine/condition-deps.ts — 条件叶子 → 事件 的共享反向依赖索引
//
// 从 visibility-index 抽取（ADR-002 rev2 落点 4）：任何「以 Condition(组)
// 为依赖声明」的消费方（可见性 / Affector / 未来 PassivePool）复用同一套
// 挂靠与命中语义，替代各自的每帧/每 Tick 全量重估。
// ============================================================

import { Condition, ConditionGroup, GameEvent } from '../types';
import { parseTagId, tagDisplay } from '../core/tag';

/** stat 目标依赖的非每帧事件集合（宽依赖；statChanged 事件上线后可收窄）。 */
export const STAT_DEP_EVENTS: readonly GameEvent['type'][] = [
  'storyCompleted',
  'storyTriggered',
  'initEntered',
  'areaEntered',
  'enhancementAdded',
  'enhancementRemoved',
  'itemCollected',
  'spotLevelChanged',
  'managerChanged',
  'initUnlocked',
];

/** ConditionDepIndex 可能声明的全部事件类型超集（供构造期分桶订阅）。 */
export const CONDITION_DEP_EVENT_TYPES: readonly GameEvent['type'][] = [
  ...new Set<GameEvent['type']>([
    ...STAT_DEP_EVENTS,
    'resourceChanged',
    'flagChanged',
    'extraChanged',
    'spotTagChanged',
    'tagCollectedChanged',
  ]),
];

/** 展开条件组为原子条件叶子。 */
export function collectConditionLeaves(node: Condition | ConditionGroup | undefined): Condition[] {
  if (!node) return [];
  if ('conditions' in node && 'type' in node) {
    return (node as ConditionGroup).conditions.flatMap(collectConditionLeaves);
  }
  return [node as Condition];
}

/** 事件携带的实体 key（用于 byEvent 精确命中；无实体语义的事件返回 undefined）。 */
export function eventEntityKeyOf(e: GameEvent): string | undefined {
  switch (e.type) {
    case 'resourceChanged': return e.resource;
    case 'spotLevelChanged': return e.spotId;
    case 'managerChanged': return e.spotId;
    case 'flagChanged': return e.flag;
    case 'enhancementAdded':
    case 'enhancementRemoved': return e.enhancementId;
    case 'itemCollected': return e.itemId;
    case 'storyCompleted': return e.storyId;
    case 'initEntered': return e.initId;
    case 'areaEntered': return e.areaId;
    case 'tagCollectedChanged': return e.kind;
    default: return undefined;
  }
}

// a 是否为 b 的前缀（含相等）
function isPrefix(a: string[], b: string[]): boolean {
  if (a.length > b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * 条件 → 依赖方 反向索引。
 * register 可对同一 key 叠加多条条件（跨 entry/多 gate）；unregister 摘除该 key 全部依赖。
 * affected(event) 返回受影响 key 集合（含 extra 路径前缀双向匹配、tag、stat 宽依赖）。
 */
export class ConditionDepIndex<K> {
  private byEvent = new Map<GameEvent['type'], Map<string, Set<K>>>();
  private extraDeps = new Map<string, Set<K>>();
  private tagDeps = new Map<string, Set<K>>();
  private statDeps = new Set<K>();

  /** 登记一条条件声明；返回是否落入 stat 宽依赖（调用方可据此做轮询降级）。 */
  register(key: K, condition: Condition | ConditionGroup | undefined): boolean {
    let wide = false;
    for (const leaf of collectConditionLeaves(condition)) {
      if (this.addLeaf(key, leaf)) wide = true;
    }
    return wide;
  }

  unregister(key: K): void {
    for (const byKey of this.byEvent.values()) {
      for (const set of byKey.values()) set.delete(key);
    }
    for (const set of this.extraDeps.values()) set.delete(key);
    for (const set of this.tagDeps.values()) set.delete(key);
    this.statDeps.delete(key);
  }

  clear(): void {
    this.byEvent.clear();
    this.extraDeps.clear();
    this.tagDeps.clear();
    this.statDeps.clear();
  }

  /** 给定事件，返回需失效的全部依赖方 key。 */
  affected(event: GameEvent): Set<K> {
    const hit = new Set<K>();
    const byKey = this.byEvent.get(event.type);
    if (byKey) {
      const star = byKey.get('*');
      if (star) for (const k of star) hit.add(k);
      const key = eventEntityKeyOf(event);
      if (key !== undefined) {
        const s = byKey.get(key);
        if (s) for (const k of s) hit.add(k);
      }
    }

    if (event.type === 'extraChanged') {
      const p = event.path as unknown as string[];
      for (const [pk, set] of this.extraDeps) {
        const dp = JSON.parse(pk) as string[];
        if (isPrefix(dp, p) || isPrefix(p, dp)) {
          for (const k of set) hit.add(k);
        }
      }
    }

    // Spot 解锁/升级改变「拥有某 tag 的 spot 数」，hasTag/countTags 依赖需失效
    if (event.type === 'spotLevelChanged') {
      for (const set of this.tagDeps.values()) {
        for (const k of set) hit.add(k);
      }
    }

    if (event.type === 'spotTagChanged') {
      const s = this.tagDeps.get(event.tag);
      if (s) for (const k of s) hit.add(k);
    }

    if (STAT_DEP_EVENTS.includes(event.type)) {
      for (const k of this.statDeps) hit.add(k);
    }
    return hit;
  }

  /** 返回 true 表示该叶子归入 stat 宽依赖（含未知 target 的保守回退）。 */
  private addLeaf(key: K, leaf: Condition): boolean {
    switch (leaf.target) {
      case 'resource':
        this.indexAdd('resourceChanged', leaf.key, key);
        return false;
      case 'spotLevel':
        this.indexAdd('spotLevelChanged', leaf.key, key);
        return false;
      case 'manager':
        this.indexAdd('managerChanged', leaf.key, key);
        return false;
      case 'flag':
        this.indexAdd('flagChanged', leaf.key, key);
        return false;
      case 'hasEnh':
        this.indexAdd('enhancementAdded', leaf.key, key);
        this.indexAdd('enhancementRemoved', leaf.key, key);
        return false;
      case 'hasTag':
      case 'countTags': {
        const tagKey = tagDisplay(parseTagId(leaf.key));
        const set = this.tagDeps.get(tagKey) ?? new Set<K>();
        set.add(key);
        this.tagDeps.set(tagKey, set);
        return false;
      }
      case 'extra': {
        const pk = JSON.stringify(leaf.key as unknown as string[]);
        const set = this.extraDeps.get(pk) ?? new Set<K>();
        set.add(key);
        this.extraDeps.set(pk, set);
        return false;
      }
      case 'tagCount': {
        // key = `<kind>:<tagDisplay>`；按 kind 精确挂靠 tagCollectedChanged 事件
        const kind = leaf.key.split(':', 1)[0] || '*';
        this.indexAdd('tagCollectedChanged', kind, key);
        return false;
      }
      case 'hasReadStory':
      case 'hasReadStoryInRun':
        this.indexAdd('storyCompleted', leaf.key, key);
        return false;
      case 'visitedStoryInChain':
        this.indexAdd('storyCompleted', undefined, key);
        this.indexAdd('storyTriggered', undefined, key);
        return false;
      default:
        // stat 及未知 target：保守归入宽依赖（非每帧事件触发）
        this.statDeps.add(key);
        return true;
    }
  }

  private indexAdd(eventType: GameEvent['type'], key: string | undefined, dep: K): void {
    let byKey = this.byEvent.get(eventType);
    if (!byKey) {
      byKey = new Map();
      this.byEvent.set(eventType, byKey);
    }
    const k = key ?? '*';
    let set = byKey.get(k);
    if (!set) {
      set = new Set();
      byKey.set(k, set);
    }
    set.add(dep);
  }
}
