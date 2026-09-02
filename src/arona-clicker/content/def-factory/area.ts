import type { TagPath } from '../../../engine/core/tag';
import type { ExtraCompound } from '../../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../../engine/types/expression';
import type { AreaId, InitId, SpotId } from '../../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../../engine/types/reveal';
import type { ThemeDef } from '../../../engine/types/theme';
import type { AreaDef, EntryEffectDef } from '../../../data-services/contracts/world';
import { revealCredit, revealResource } from '../../../engine/def-factory/reveal';

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
  constructor(id: AreaId, initId: InitId) { this._id = id; this._initId = initId; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  spots(...ids: SpotId[]): this { this._defaultSpots = ids; return this; }
  adjacent(...ids: AreaId[]): this { this._adjacentAreaIds = ids; return this; }
  theme(colorGroupId: string, tokens?: Record<string, string>): this { this._theme = tokens ? { colorGroupId, tokens } : { colorGroupId }; return this; }
  onEnter(...effects: Effect[]): this { this._enterEffects.push({ effects }); return this; }
  onEnterFirst(...effects: Effect[]): this { this._enterEffects.push({ first: true, effects }); return this; }
  onEnterWhen(condition: ConditionGroup, ...effects: Effect[]): this { this._enterEffects.push({ condition, effects }); return this; }
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this { this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target }); return this; }
  revealResource(target: RevealTarget, resourceId: string, amount: number): this { this._revealTriggers.push(revealResource(target, resourceId, amount)); return this; }
  revealCredit(target: RevealTarget, producedAmount: number): this { this._revealTriggers.push(revealCredit(target, producedAmount)); return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  build(): AreaDef {
    if (!this._name) throw new Error(`AreaBuilder(${this._id}): name 未设置`);
    if (!this._description) throw new Error(`AreaBuilder(${this._id}): description 未设置`);
    const def: AreaDef = { id: this._id, initId: this._initId, name: this._name, description: this._description, defaultSpots: this._defaultSpots };
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
