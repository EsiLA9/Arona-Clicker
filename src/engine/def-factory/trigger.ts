// ============================================================
// engine/def-factory/trigger.ts — Trigger 定义链式 Builder
// 构造 TriggerDef。.build() 返回标准 TriggerDef。
// once 缺省 true（引擎语义），无需显式声明。
// ============================================================

import type { ExtraCompound } from '../types/extra';
import type { Condition, ConditionGroup, Effect } from '../types/expression';
import type { TriggerDef, TriggerEventDef } from '../types/trigger';

export class TriggerBuilder {
  private readonly _id?: string;
  private _on?: TriggerEventDef;
  private _condition?: Condition | ConditionGroup;
  private _effects: Effect[] = [];
  private _once = true;
  private _extra?: ExtraCompound;

  constructor(id?: string) {
    this._id = id;
  }

  /** 每 tick 侦测（every 缺省 1）。 */
  onTick(every?: number): this {
    this._on = every ? { kind: 'tick', every } : { kind: 'tick' };
    return this;
  }

  onResource(resourceId?: string): this {
    this._on = resourceId ? { kind: 'resource', resource: resourceId } : { kind: 'resource' };
    return this;
  }

  onSpotLevel(spotId?: string): this {
    this._on = spotId ? { kind: 'spotLevel', spotId } : { kind: 'spotLevel' };
    return this;
  }

  onItem(itemId?: string): this {
    this._on = itemId ? { kind: 'item', itemId } : { kind: 'item' };
    return this;
  }

  onStory(storyId?: string): this {
    this._on = storyId ? { kind: 'story', storyId } : { kind: 'story' };
    return this;
  }

  onInit(initId?: string): this {
    this._on = initId ? { kind: 'init', initId } : { kind: 'init' };
    return this;
  }

  onArea(areaId?: string): this {
    this._on = areaId ? { kind: 'area', areaId } : { kind: 'area' };
    return this;
  }

  /** 附加条件（可为单条原子条件或组合条件组）。 */
  when(condition: Condition | ConditionGroup): this {
    this._condition = condition;
    return this;
  }

  effects(...effs: Effect[]): this { this._effects.push(...effs); return this; }

  /**
   * 一次性触发（缺省 true，引擎按真值判断必须显式输出；once:false 表示条件满足即可重复触发）。
   */
  once(value = true): this { this._once = value; return this; }

  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): TriggerDef {
    if (!this._on) throw new Error(`TriggerBuilder(${this._id ?? 'anon'}): on 未设置`);
    const def: TriggerDef = {
      ...(this._id ? { id: this._id } : {}),
      on: this._on,
      effects: this._effects,
    };
    if (this._condition) def.condition = this._condition;
    // 引擎按 trigger.once 真值判断（缺省不归一为 true），once 必须显式输出，否则一次性触发器会变成可重复触发
    def.once = this._once;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

export const trigger = (id?: string): TriggerBuilder => new TriggerBuilder(id);