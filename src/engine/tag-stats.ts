// ============================================================
// engine/tag-stats.ts — 按 tag 聚合的收集统计服务（派生视图）
//
// 七类实体（inits / areas / spots / characters / enhancements /
// passiveStories / activeStories）各自独立统计，不跨类型加和：
//   declared  = 注册期扫描实体声明的 tags（含祖先前缀登记，父 tag 命中子声明）
//   collected = 运行期事件驱动增量维护的「已收集」集合
//
// 统计是从既有原始状态派生的视图，不新增 PlayerState 字段（三层状态纪律）；
// 各类型的收集判定复用既有系统的语义（getUnlocked / storyLog 等）。
// ============================================================

import type { EventBus } from './event-bus';
import { parseTagId, tagDisplay, TagPath } from './tag';

/** 参与按 tag 收集统计的实体类型（各类型统计相互独立）。 */
export type TagStatKind =
  | 'inits'
  | 'areas'
  | 'spots'
  | 'characters'
  | 'enhancements'
  | 'passiveStories'
  | 'activeStories';

export const TAG_STAT_KINDS: readonly TagStatKind[] = [
  'inits', 'areas', 'spots', 'characters', 'enhancements', 'passiveStories', 'activeStories',
];

interface KindIndex {
  /** tagDisplay → 已声明该 tag 的实体 id 集（含祖先前缀登记）。 */
  readonly declared: Map<string, Set<string>>;
  /** tagDisplay → 已收集实体 id 集（同前缀登记）。 */
  readonly collected: Map<string, Set<string>>;
  /** 实体 id → 其声明的全部登记 key（collect/uncollect 定位用）。 */
  readonly byEntity: Map<string, string[]>;
}

const newKindIndex = (): KindIndex => ({
  declared: new Map(),
  collected: new Map(),
  byEntity: new Map(),
});

export interface TagStatEntity {
  id: string;
  tags?: TagPath[];
}

export class TagStatService {
  private readonly kinds = new Map<TagStatKind, KindIndex>();
  private state: PlayerStateLike | null = null;
  /** 抑制 setState 重建路径的事件发射（读档语义与其它系统一致：不发、靠 recheck 兜底）。 */
  private silent = false;

  constructor(
    private readonly registry: TagStatRegistry,
    private readonly eventBus?: EventBus,
  ) {
    for (const kind of TAG_STAT_KINDS) this.kinds.set(kind, newKindIndex());
    this.buildDeclared();

    if (!eventBus) return;
    const bus = eventBus;
    bus.on('initUnlocked', e => this.collect('inits', e.initId));
    bus.on('areaEntered', e => this.collect('areas', e.areaId));
    bus.on('spotLevelChanged', e => {
      if (e.newLevel > 0) this.collect('spots', e.spotId);
      else this.uncollect('spots', e.spotId);
    });
    // characters：roster 单一真相来源（拥有任一差分即收集其原型，F-04）。
    // 事件只做「标脏」，整体重算
    bus.on('characterAcquired', () => this.recollectCharacters());
    bus.on('enhancementAdded', e => this.collect('enhancements', e.enhancementId));
    bus.on('enhancementRemoved', e => this.uncollect('enhancements', e.enhancementId));
    // StoryEntry 与 Story 当前 1:1 同 id：完成即收集两类 entry（按 byEntity 去重）
    bus.on('storyCompleted', e => {
      this.collect('passiveStories', e.storyId);
      this.collect('activeStories', e.storyId);
    });
  }

  setState(state: PlayerStateLike): void {
    this.state = state;
    // 整体换状态（新游戏/读档/切世界线）：从快照全量重建 collected。
    // 重建路径不发 tagCollectedChanged，条件新鲜度由挂载时 recheck / rebuild 兜底。
    this.silent = true;
    try {
      this.rebuildCollected();
    } finally {
      this.silent = false;
    }
  }

  // --- 查询 API ---

  /** 已声明该 tag 的实体总数（query 命中 declared 前缀，如 office 命中 office/admin）。 */
  declaredCount(kind: TagStatKind, tag: TagPath | string): number {
    return this.lookup(kind, 'declared', tag).size;
  }

  /** 已收集该 tag 的实体数。 */
  collectedCount(kind: TagStatKind, tag: TagPath | string): number {
    return this.lookup(kind, 'collected', tag).size;
  }

  /** 已收集实体 id 列表。 */
  collectedIds(kind: TagStatKind, tag: TagPath | string): string[] {
    return [...this.lookup(kind, 'collected', tag)];
  }

  /** 收集进度 x/y。 */
  progress(kind: TagStatKind, tag: TagPath | string): { collected: number; declared: number } {
    return {
      collected: this.collectedCount(kind, tag),
      declared: this.declaredCount(kind, tag),
    };
  }

  // --- 内部实现 ---

  private lookup(kind: TagStatKind, side: 'declared' | 'collected', tag: TagPath | string): Set<string> {
    const idx = this.kinds.get(kind);
    if (!idx) return new Set();
    const path = typeof tag === 'string' ? parseTagId(tag) : tag;
    return idx[side].get(tagDisplay(path)) ?? new Set();
  }

  /**
   * 重建声明侧倒排（数据包加载/热替换后调用）。
   * 注意：服务构造早于数据包加载，此方法必须在 registry 就绪后再调一次。
   */
  rebuildDeclared(): void {
    for (const idx of this.kinds.values()) {
      idx.declared.clear();
      idx.byEntity.clear();
      idx.collected.clear();
    }
    this.buildDeclared();
    // collected 依赖 byEntity，重建后按当前状态重新登记
    if (this.state) {
      const keepSilent = this.silent;
      this.silent = true;
      try {
        this.rebuildCollected();
      } finally {
        this.silent = keepSilent;
      }
    }
  }

  /** 注册期：扫描各类型实体的 tags 声明建倒排（祖先前缀登记）。 */
  private buildDeclared(): void {
    const entitiesOf: Record<TagStatKind, Iterable<TagStatEntity>> = {
      inits: this.registry.inits.values(),
      areas: this.registry.areas.values(),
      spots: this.registry.spots.values(),
      characters: [...this.registry.characters.values()].filter(ch => ch.id !== 'none'),
      enhancements: this.registry.enhancements.values(),
      passiveStories: this.registry.passiveStories.values(),
      activeStories: this.registry.activeStories.values(),
    };
    for (const kind of TAG_STAT_KINDS) {
      const idx = this.kinds.get(kind)!;
      for (const entity of entitiesOf[kind]) this.declare(idx, entity.id, entity.tags ?? []);
    }
  }

  private declare(idx: KindIndex, id: string, tags: TagPath[]): void {
    if (tags.length === 0) return;
    const keys = new Set<string>();
    for (const path of tags) {
      for (let i = 1; i <= path.length; i++) keys.add(tagDisplay(path.slice(0, i)));
    }
    for (const key of keys) {
      const set = idx.declared.get(key) ?? new Set<string>();
      set.add(id);
      idx.declared.set(key, set);
    }
    idx.byEntity.set(id, [...keys]);
  }

  /** 把实体登记进其声明过的所有 tag 的 collected 集；实际有增删时发变更事件。 */
  private collect(kind: TagStatKind, id: string): void {
    const idx = this.kinds.get(kind);
    if (!idx || !id || !idx.byEntity.has(id)) return;
    let changed = false;
    for (const key of idx.byEntity.get(id)!) {
      const set = idx.collected.get(key) ?? new Set<string>();
      if (!set.has(id)) {
        set.add(id);
        idx.collected.set(key, set);
        changed = true;
      }
    }
    this.emitChanged(kind, changed);
  }

  private uncollect(kind: TagStatKind, id: string): void {
    const idx = this.kinds.get(kind);
    if (!idx || !id) return;
    let changed = false;
    for (const key of idx.byEntity.get(id) ?? []) {
      if (idx.collected.get(key)?.delete(id)) changed = true;
    }
    this.emitChanged(kind, changed);
  }

  /** 仅在 collected 实际变化时发出（升级不重复计数、无关事件不触发依赖方）。 */
  private emitChanged(kind: TagStatKind, changed: boolean): void {
    if (!changed || this.silent) return;
    this.eventBus?.emit({ type: 'tagCollectedChanged', kind });
  }

  /** 从状态快照全量重建 collected（新游戏/读档/世界线切换）。 */
  private rebuildCollected(): void {
    for (const idx of this.kinds.values()) idx.collected.clear();
    const state = this.state;
    if (!state) return;

    for (const initId of state.unlockedInits ?? []) this.collect('inits', initId);
    for (const areaId of state.visitedAreas ?? []) this.collect('areas', areaId);
    for (const [spotId, level] of Object.entries(state.spotLevels)) {
      if (level > 0) this.collect('spots', spotId);
    }
    for (const enhId of state.unlockedEnhancements ?? []) this.collect('enhancements', enhId);
    for (const story of state.storyLog ?? []) {
      this.collect('passiveStories', story.storyId);
      this.collect('activeStories', story.storyId);
    }
    this.recollectCharacters();
  }

  /** 角色收集全量重算：roster 持有差分 → 原型（单一真相来源，F-04）。 */
  private recollectCharacters(): void {
    const state = this.state;
    if (!state) return;
    const ownedProtos = new Set<string>();
    for (const variantId of Object.keys(state.roster ?? {})) {
      const proto = this.registry.characterVariants?.get(variantId)?.proto;
      if (proto !== undefined) ownedProtos.add(proto);
    }
    for (const ch of this.registry.characters.values()) {
      if (ch.id === 'none') continue;
      if (ownedProtos.has(ch.id)) this.collect('characters', ch.id as string);
      else this.uncollect('characters', ch.id as string);
    }
  }
}

/** 最小依赖面（避免直接耦合 Registry / PlayerState 全量类型，便于测试桩替换）。 */
export interface TagStatRegistry {
  readonly inits: ReadonlyMap<string, TagStatEntity>;
  readonly areas: ReadonlyMap<string, TagStatEntity>;
  readonly spots: ReadonlyMap<string, TagStatEntity>;
  readonly characters: ReadonlyMap<string, { id: string; tags?: TagPath[] }>;
  readonly enhancements: ReadonlyMap<string, TagStatEntity>;
  readonly passiveStories: ReadonlyMap<string, TagStatEntity>;
  readonly activeStories: ReadonlyMap<string, TagStatEntity>;
  /** 差分表（F-04：roster 差分 → 原型解析）。 */
  readonly characterVariants?: ReadonlyMap<string, { id: string; proto: string }>;
}

export interface PlayerStateLike {
  readonly spotLevels: Record<string, number>;
  readonly spotManagers: Record<string, string>;
  readonly flags: Record<string, string>;
  /** F-04：通讯录（差分 id → 持有实例），角色收集的唯一来源。 */
  readonly roster?: Readonly<Record<string, unknown>>;
  readonly unlockedInits?: readonly string[];
  readonly visitedAreas?: readonly string[];
  readonly unlockedEnhancements?: readonly string[];
  readonly storyLog?: readonly { storyId: string }[];
}
