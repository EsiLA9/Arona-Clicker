// ============================================================
// engine/def-factory/init.ts — Init 定义链式 Builder
// 构造 InitDef：必填 id/name/description/defaultAreas，其余差异字段链式填充。
// .build() 返回标准 InitDef（纯数据，可进 Schema 协议、可被数据包编辑器消费）。
// ============================================================

import type { TagPath } from '../core/tag';
import type { ExtraCompound } from '../types/extra';
import type {
  Condition,
  ConditionGroup,
  Effect,
} from '../types/expression';
import type { AreaId, InitId, StoryId } from '../types/ids';
import type { RevealTarget, RevealTrigger } from '../types/reveal';
import type { ResourceAmount } from '../types/common';
import type { TriggerDef } from '../types/trigger';
import type { EntryEffectDef, InitDef } from '../types/world';
import { r } from './resource';
import { revealCredit as _revealCredit } from './reveal';

export class InitBuilder {
  private readonly _id: InitId;
  private _name = '';
  private _description = '';
  private _defaultAreas: AreaId[] = [];
  private _startStoryId?: StoryId;
  private _worldTilt?: string;
  private _worldTiltAlias?: string;
  private _purchaseCost?: ResourceAmount[];
  private _triggers: TriggerDef[] = [];
  private _revealTriggers: RevealTrigger[] = [];
  private _enterEffects: EntryEffectDef[] = [];
  private _tags: TagPath[] = [];
  private _extra?: ExtraCompound;

  constructor(id: InitId) {
    this._id = id;
  }

  /** @label 名称 */
  name(value: string): this {
    this._name = value;
    return this;
  }

  /** @label 描述 */
  desc(value: string): this {
    this._description = value;
    return this;
  }

  /** @label 默认区域 */
  areas(...ids: AreaId[]): this {
    this._defaultAreas = ids;
    return this;
  }

  /** @label 起始剧情 */
  startStory(id: StoryId): this {
    this._startStoryId = id;
    return this;
  }

  /** @label 世界倾斜数值 */
  tilt(value: string): this {
    this._worldTilt = value;
    return this;
  }

  /** @label 倾斜值展示别名 */
  tiltAlias(value: string): this {
    this._worldTiltAlias = value;
    return this;
  }

  /** 购买费用（单条）：cost(Resource.Pyroxene, 20) → purchaseCost: [{resourceId, amount}]。 */
  cost(resourceId: string, amount: number): this {
    this._purchaseCost = [r(resourceId, amount)];
    return this;
  }

  /** 购买费用（多条，整体替换）。 */
  purchaseCost(...entries: ResourceAmount[]): this {
    this._purchaseCost = entries;
    return this;
  }

  /** 追加世界线专属 Trigger。 */
  triggers(...defs: TriggerDef[]): this {
    this._triggers.push(...defs);
    return this;
  }

  /** 每次进入都执行的条目。 */
  onEnter(...effects: Effect[]): this {
    this._enterEffects.push({ effects });
    return this;
  }

  /** 仅首次进入执行的条目。 */
  onEnterFirst(...effects: Effect[]): this {
    this._enterEffects.push({ first: true, effects });
    return this;
  }

  /** 带进入条件的条目（EntryEffectDef.condition 仅支持组合条件组）。 */
  onEnterWhen(condition: ConditionGroup, ...effects: Effect[]): this {
    this._enterEffects.push({ condition, effects });
    return this;
  }

  /** 追加揭示 Trigger（condition 缺省 = 恒真）。 */
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this {
    this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target });
    return this;
  }

  /** 追加「全局累计产出达到 N 信用点」门槛的揭示 Trigger（base 数据标准门槛糖）。 */
  revealCredit(target: RevealTarget, producedAmount: number): this {
    this._revealTriggers.push(_revealCredit(target, producedAmount));
    return this;
  }

  /** @label 标签 */
  tags(...paths: TagPath[]): this {
    this._tags.push(...paths);
    return this;
  }

  /** Extra 附加数据。 */
  extra(value: ExtraCompound): this {
    this._extra = value;
    return this;
  }

  build(): InitDef {
    if (!this._name) throw new Error(`InitBuilder(${this._id}): name 未设置`);
    if (!this._description) throw new Error(`InitBuilder(${this._id}): description 未设置`);
    const def: InitDef = {
      id: this._id,
      name: this._name,
      description: this._description,
      defaultAreas: this._defaultAreas,
    };
    if (this._startStoryId) def.startStoryId = this._startStoryId;
    if (this._worldTilt) def.worldTilt = this._worldTilt;
    if (this._worldTiltAlias) def.worldTiltAlias = this._worldTiltAlias;
    if (this._purchaseCost) def.purchaseCost = this._purchaseCost;
    if (this._triggers.length) def.triggers = this._triggers;
    if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._enterEffects.length) def.enterEffects = this._enterEffects;
    if (this._tags.length) def.tags = this._tags;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

/** Init 定义链式构造入口。 */
export const init = (id: InitId): InitBuilder => new InitBuilder(id);
