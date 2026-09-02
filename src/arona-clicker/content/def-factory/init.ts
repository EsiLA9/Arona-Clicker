import type { TagPath } from '../../../engine/core/tag';
import type { ExtraCompound } from '../../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../../engine/types/expression';
import type { AreaId, InitId, StoryId } from '../../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../../engine/types/reveal';
import type { ResourceAmount } from '../../../engine/contracts/resource';
import type { TriggerDef } from '../../../engine/types/trigger';
import type { EntryEffectDef, InitDef } from '../../../data-services/contracts/world';
import { r } from '../../../engine/def-factory/resource';
import { revealCredit } from '../../../engine/def-factory/reveal';

export class InitBuilder {
  private readonly _id: InitId; private _name = ''; private _description = ''; private _defaultAreas: AreaId[] = [];
  private _startStoryId?: StoryId; private _worldTilt?: string; private _worldTiltAlias?: string; private _purchaseCost?: ResourceAmount[];
  private _triggers: TriggerDef[] = []; private _revealTriggers: RevealTrigger[] = []; private _enterEffects: EntryEffectDef[] = []; private _tags: TagPath[] = []; private _extra?: ExtraCompound;
  constructor(id: InitId) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  areas(...ids: AreaId[]): this { this._defaultAreas = ids; return this; }
  startStory(id: StoryId): this { this._startStoryId = id; return this; }
  tilt(value: string): this { this._worldTilt = value; return this; }
  tiltAlias(value: string): this { this._worldTiltAlias = value; return this; }
  cost(resourceId: string, amount: number): this { this._purchaseCost = [r(resourceId, amount)]; return this; }
  purchaseCost(...entries: ResourceAmount[]): this { this._purchaseCost = entries; return this; }
  triggers(...defs: TriggerDef[]): this { this._triggers.push(...defs); return this; }
  onEnter(...effects: Effect[]): this { this._enterEffects.push({ effects }); return this; }
  onEnterFirst(...effects: Effect[]): this { this._enterEffects.push({ first: true, effects }); return this; }
  onEnterWhen(condition: ConditionGroup, ...effects: Effect[]): this { this._enterEffects.push({ condition, effects }); return this; }
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this { this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target }); return this; }
  revealCredit(target: RevealTarget, producedAmount: number): this { this._revealTriggers.push(revealCredit(target, producedAmount)); return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  build(): InitDef {
    if (!this._name) throw new Error(`InitBuilder(${this._id}): name 未设置`);
    if (!this._description) throw new Error(`InitBuilder(${this._id}): description 未设置`);
    const def: InitDef = { id: this._id, name: this._name, description: this._description, defaultAreas: this._defaultAreas };
    if (this._startStoryId) def.startStoryId = this._startStoryId; if (this._worldTilt) def.worldTilt = this._worldTilt; if (this._worldTiltAlias) def.worldTiltAlias = this._worldTiltAlias;
    if (this._purchaseCost) def.purchaseCost = this._purchaseCost; if (this._triggers.length) def.triggers = this._triggers; if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._enterEffects.length) def.enterEffects = this._enterEffects; if (this._tags.length) def.tags = this._tags; if (this._extra) def.extra = this._extra;
    return def;
  }
}
export const init = (id: InitId): InitBuilder => new InitBuilder(id);
