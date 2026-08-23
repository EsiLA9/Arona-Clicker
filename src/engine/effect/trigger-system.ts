// ============================================================
// engine/trigger-system.ts — Trigger DSL 桥接系统
//
// 可知性/可达性层级的生效层：事件命中 + 条件满足才执行（AccessStage.active）。
//
// 对外（数据包内容作者）只暴露 TriggerDef 声明式 DSL：
//   { id, on: 事件模式, condition?: 条件, effects: 效果, once? }
// 内部由本系统桥接到 EventBus 侦测 → ConditionSystem 求值 → EffectEngine 执行。
//
// 生命周期：
//   mount(def, group?)      挂载一个 Trigger（可归组；重复 id 覆盖定义）
//   unmount(id)             移除单个 Trigger
//   unmountGroup(group)     移除整组（如进入/离开某世界线时挂载/移除专属 Trigger）
//   clear()                 清空全部
//
// once 语义与生命周期解耦：unmount 不清除完成记录，重新挂载同 id 且 once
// 已完成后不再触发。迭代采用快照，允许 effects 执行期间动态挂载/移除。
// ============================================================

import { PlayerState, TriggerDef, GameEvent, TriggerEventDef } from '../types';
import { EventBus } from '../core/event-bus';
import { ConditionSystem } from '../expression/condition-system';
import { EffectEngine } from './effect-engine';
import { EventDrivenReactor } from './event-driven-reactor';

export const GLOBAL_TRIGGER_GROUP = 'global';

/** 触发器 `on.kind` 到派发事件类型的映射，避免对所有事件全量扫描。 */
const ON_KIND_TO_EVENT = {
  tick: 'tick',
  resource: 'resourceChanged',
  spotLevel: 'spotLevelChanged',
  item: 'itemCollected',
  story: 'storyCompleted',
  init: 'initEntered',
  area: 'areaEntered',
} as const;

export class TriggerSystem extends EventDrivenReactor {
  private readonly triggers = new Map<string, TriggerDef>();
  /** id → 所属分组（用于整组挂载/移除）。 */
  private readonly groups = new Map<string, string>();
  /** 按事件类型分桶：每个事件只派发给关心该类型的触发器，消除 O(事件×触发器) 全扫描。 */
  private readonly byType = new Map<GameEvent['type'], Set<string>>();
  /** id → 其桶对应的事件类型，便于卸载时精确移除。 */
  private readonly bucketType = new Map<string, GameEvent['type']>();
  private state: PlayerState | null = null;
  private readonly completed = new Set<string>();

  constructor(
    eventBus: EventBus,
    private readonly conditionSystem: ConditionSystem,
    private readonly effectEngine: EffectEngine,
  ) {
    super(eventBus);
    // 仅订阅触发器关心的 7 种事件类型；每类事件只派发给对应桶，
    // `tick` 类不再被高频 resourceChanged/spotProduced 反复扫描。
    this.subscribeTo(Object.values(ON_KIND_TO_EVENT));
  }

  setState(state: PlayerState): void {
    this.state = state;
    this.completed.clear();
    for (const id of state.triggersCompleted ?? []) this.completed.add(id);
  }

  /** 挂载一个 Trigger（默认归入 global 组）。重复 id 以新定义覆盖。 */
  mount(def: TriggerDef, group = GLOBAL_TRIGGER_GROUP): void {
    this.triggers.set(def.id, def);
    this.groups.set(def.id, group);
    this.registerBucket(def);
  }

  /** 批量挂载（数据包级）。 */
  load(defs: TriggerDef[]): void {
    for (const def of defs) this.mount(def);
  }

  /** 移除单个 Trigger。 */
  unmount(id: string): boolean {
    const removed = this.triggers.delete(id);
    this.groups.delete(id);
    this.removeBucket(id);
    return removed;
  }

  /** 移除整组 Trigger（如离开世界线时）。 */
  unmountGroup(group: string): void {
    for (const [id, g] of [...this.groups]) {
      if (g === group) {
        this.triggers.delete(id);
        this.groups.delete(id);
        this.removeBucket(id);
      }
    }
  }

  has(id: string): boolean {
    return this.triggers.has(id);
  }

  clear(): void {
    this.triggers.clear();
    this.groups.clear();
    this.byType.clear();
    this.bucketType.clear();
  }

  /** EventDrivenReactor 命中入口：派发给本类型桶。 */
  protected onEvent(type: GameEvent['type'], event: GameEvent): void {
    this.processType(type, event);
  }

  private processType(type: GameEvent['type'], event: GameEvent): void {
    if (!this.state) return;
    const bucket = this.byType.get(type);
    if (!bucket || bucket.size === 0) return;
    // 快照迭代：fire 执行 effects 可能动态挂载/移除，不允许在遍历中改 set
    for (const id of [...bucket]) {
      const trigger = this.triggers.get(id);
      if (!trigger) { this.removeBucket(id); continue; }
      if (!this.matchesEvent(trigger.on, event)) continue;
      if (trigger.once && this.completed.has(trigger.id)) continue;
      if (trigger.condition && !this.conditionSystem.evaluateExpr(trigger.condition, this.state)) continue;
      this.fire(trigger);
    }
  }

  private registerBucket(def: TriggerDef): void {
    const type = ON_KIND_TO_EVENT[def.on.kind];
    let set = this.byType.get(type);
    if (!set) { set = new Set<string>(); this.byType.set(type, set); }
    set.add(def.id);
    this.bucketType.set(def.id, type);
  }

  private removeBucket(id: string): void {
    const type = this.bucketType.get(id);
    if (type) this.byType.get(type)?.delete(id);
    this.bucketType.delete(id);
  }

  private matchesEvent(on: TriggerEventDef, event: GameEvent): boolean {
    switch (on.kind) {
      case 'tick':
        if (event.type !== 'tick') return false;
        return on.every ? event.frame % on.every === 0 : true;
      case 'resource':
        return event.type === 'resourceChanged'
          && (!on.resource || event.resource === on.resource);
      case 'spotLevel':
        return event.type === 'spotLevelChanged'
          && (!on.spotId || event.spotId === on.spotId);
      case 'item':
        return event.type === 'itemCollected'
          && (!on.itemId || event.itemId === on.itemId);
      case 'story':
        return event.type === 'storyCompleted'
          && (!on.storyId || event.storyId === on.storyId);
      case 'init':
        return event.type === 'initEntered'
          && (!on.initId || event.initId === on.initId);
      case 'area':
        return event.type === 'areaEntered'
          && (!on.areaId || event.areaId === on.areaId);
      default:
        return false;
    }
  }

  private fire(trigger: TriggerDef): void {
    // once 先落账再执行，避免执行产生的级联事件重复触发
    if (trigger.once) {
      this.completed.add(trigger.id);
      if (this.state) this.state.triggersCompleted = [...(this.state.triggersCompleted ?? []), trigger.id];
    }
    this.effectEngine.applyEffects(trigger.effects);
  }
}
