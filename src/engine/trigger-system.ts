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

import { PlayerState, TriggerDef, GameEvent, TriggerEventDef } from './types';
import { EventBus } from './event-bus';
import { ConditionSystem } from './condition-system';
import { EffectEngine } from './effect-engine';

export const GLOBAL_TRIGGER_GROUP = 'global';

export class TriggerSystem {
  private readonly triggers = new Map<string, TriggerDef>();
  /** id → 所属分组（用于整组挂载/移除）。 */
  private readonly groups = new Map<string, string>();
  private state: PlayerState | null = null;
  private readonly completed = new Set<string>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly conditionSystem: ConditionSystem,
    private readonly effectEngine: EffectEngine,
  ) {
    this.eventBus.onAny(event => this.onEvent(event));
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
  }

  /** 批量挂载（数据包级）。 */
  load(defs: TriggerDef[]): void {
    for (const def of defs) this.mount(def);
  }

  /** 移除单个 Trigger。 */
  unmount(id: string): boolean {
    const removed = this.triggers.delete(id);
    this.groups.delete(id);
    return removed;
  }

  /** 移除整组 Trigger（如离开世界线时）。 */
  unmountGroup(group: string): void {
    for (const [id, g] of [...this.groups]) {
      if (g === group) {
        this.triggers.delete(id);
        this.groups.delete(id);
      }
    }
  }

  has(id: string): boolean {
    return this.triggers.has(id);
  }

  clear(): void {
    this.triggers.clear();
    this.groups.clear();
  }

  private onEvent(event: GameEvent): void {
    if (!this.state) return;
    // 快照迭代：fire 执行 effects 可能动态挂载/移除，不允许在遍历中改 map
    for (const trigger of [...this.triggers.values()]) {
      if (!this.matchesEvent(trigger.on, event)) continue;
      if (trigger.once && this.completed.has(trigger.id)) continue;
      if (trigger.condition && !this.conditionSystem.evaluateExpr(trigger.condition, this.state)) continue;
      this.fire(trigger);
    }
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
