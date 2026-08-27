// ============================================================
// engine/def-factory/area.ts — Area 定义链式 Builder
// 构造 AreaDef。.build() 返回标准 AreaDef。
// ============================================================

import type { TagPath } from '../core/tag';
import type { ExtraCompound } from '../types/extra';
import type { Condition, ConditionGroup, Effect } from '../types/expression';
import type { AreaId, InitId, SpotId } from '../types/ids';
import type { RevealTarget, RevealTrigger } from '../types/reveal';
import type { ThemeDef } from '../types/character';
import type { AreaDef, EntryEffectDef } from '../types/world';
import { revealCredit, revealResource } from './reveal';

export class AreaBuilder {
  private readonly _id: AreaId;
  private readonly _initId: InitId;
  private _name = '';
  private _description = '';
  private _defaultSpots: SpotId[] = [];
  private _adjacentAreaIds?: AreaId[];
  private _enterEffects: EntryEffectDef[] = [];
  private _revealTriggers: RevealTrigger[] = [];
  private _tags: TagPath[] = [];
  private _theme?: ThemeDef;
  private _extra?: ExtraCompound;

  constructor(id: AreaId, initId: InitId) {
    this._id = id;
    this._initId = initId;
  }

  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  spots(...ids: SpotId[]): this { this._defaultSpots = ids; return this; }
  adjacent(...ids: AreaId[]): this { this._adjacentAreaIds = ids; return this; }

  /** @label 场景主题 */
  theme(colorId: string, tokens?: Record<string, string>): this {
    this._theme = tokens ? { colorId, tokens } : { colorId };
    return this;
  }

  /** 每次进入都执行的条目。 */
  onEnter(...effects: Effect[]): this { this._enterEffects.push({ effects }); return this; }
  /** 仅首次进入执行的条目。 */
  onEnterFirst(...effects: Effect[]): this { this._enterEffects.push({ first: true, effects }); return this; }
  /** 带进入条件的条目。 */
  onEnterWhen(condition: ConditionGroup, ...effects: Effect[]): this {
    this._enterEffects.push({ condition, effects });
    return this;
  }

  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this {
    this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target });
    return this;
  }

  /** 追加「持有资源 ≥ amount」门槛的揭示 Trigger。 */
  revealResource(target: RevealTarget, resourceId: string, amount: number): this {
    this._revealTriggers.push(revealResource(target, resourceId, amount));
    return this;
  }

  /** 追加「全局累计产出达到 N 信用点」门槛的揭示 Trigger。 */
  revealCredit(target: RevealTarget, producedAmount: number): this {
    this._revealTriggers.push(revealCredit(target, producedAmount));
    return this;
  }

  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): AreaDef {
    if (!this._name) throw new Error(`AreaBuilder(${this._id}): name 未设置`);
    if (!this._description) throw new Error(`AreaBuilder(${this._id}): description 未设置`);
    const def: AreaDef = {
      id: this._id,
      initId: this._initId,
      name: this._name,
      description: this._description,
      defaultSpots: this._defaultSpots,
    };
    if (this._adjacentAreaIds) def.adjacentAreaIds = this._adjacentAreaIds;
    if (this._enterEffects.length) def.enterEffects = this._enterEffects;
    if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._tags.length) def.tags = this._tags;
    if (this._theme) def.theme = this._theme;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

export const area = (id: AreaId, initId: InitId): AreaBuilder => new AreaBuilder(id, initId);