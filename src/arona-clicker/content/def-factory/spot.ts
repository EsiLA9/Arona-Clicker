import type { TagPath } from '../../../engine/core/tag';
import type { GachaPoolId } from '../../../engine/types/character';
import type { ExtraCompound } from '../../../engine/types/extra';
import type { Condition, ConditionGroup, ValueExpression } from '../../../engine/types/expression';
import type { AreaId, SpotId } from '../../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../../engine/types/reveal';
import type { LevelUpgradeDef, SpotDef, SpotFunctionalityDef } from '../../../data-services/contracts/world';
import type { ShopId } from '../../../data-services/contracts/shop';
import { Expr } from '../../../engine/def-factory/expr';
import { revealResource } from '../../../engine/def-factory/reveal';

export class SpotBuilder {
  private readonly _id: SpotId; private readonly _areaId: AreaId; private _name = ''; private _description = '';
  private _baseCost: ValueExpression = Expr.const(0); private _baseCostResource = 'base:resource:credit';
  private _baseYield: ValueExpression = Expr.const(0); private _baseYieldResource = 'base:resource:credit';
  private _baseCapacity = 0; private _managerBonusYield: ValueExpression = Expr.const(0); private _conditionText?: string;
  private _levelUpgrades: LevelUpgradeDef[] = []; private _yieldPerLevel?: number; private _upgradeCostBase?: number; private _upgradeCostGrowth?: number; private _maxLevel?: number;
  private _tags: TagPath[] = []; private _global = false; private _revealTriggers: RevealTrigger[] = []; private _functionalities: SpotFunctionalityDef[] = []; private _gachaPools: GachaPoolId[] = []; private _extra?: ExtraCompound;
  constructor(id: SpotId, areaId: AreaId) { this._id = id; this._areaId = areaId; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  cost(value: number | ValueExpression, resourceId?: string): this { this._baseCost = typeof value === 'number' ? Expr.const(value) : value; if (resourceId) this._baseCostResource = resourceId; return this; }
  costResource(id: string): this { this._baseCostResource = id; return this; }
  yield(value: number | ValueExpression, resourceId?: string): this { this._baseYield = typeof value === 'number' ? Expr.const(value) : value; if (resourceId) this._baseYieldResource = resourceId; return this; }
  yieldResource(id: string): this { this._baseYieldResource = id; return this; }
  capacity(value: number): this { this._baseCapacity = value; return this; }
  managerBonus(value: number | ValueExpression): this { this._managerBonusYield = typeof value === 'number' ? Expr.const(value) : value; return this; }
  conditionText(value: string): this { this._conditionText = value; return this; }
  genericUpgrade(upgradeCostBase: number, upgradeCostGrowth: number, yieldPerLevel: number): this { this._upgradeCostBase = upgradeCostBase; this._upgradeCostGrowth = upgradeCostGrowth; this._yieldPerLevel = yieldPerLevel; return this; }
  maxLevel(value: number): this { this._maxLevel = value; return this; }
  levelUpTo(maxLevel: number): this { for (let lv = 2; lv <= maxLevel; lv++) this._levelUpgrades.push({ level: lv, effects: [{ op: 'setSpotLevel', target: this._id, value: String(lv) }] }); return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  global(): this { this._global = true; return this; }
  functionality(...defs: SpotFunctionalityDef[]): this { this._functionalities.push(...defs); return this; }
  linearYield(id: string, resource: string, amountPerLevel: number): this { this._functionalities.push({ id, kind: 'linearYield', resource, amountPerLevel }); return this; }
  linearYieldWhen(id: string, resource: string, amountPerLevel: number, condition: ConditionGroup): this { this._functionalities.push({ id, kind: 'linearYield', resource, amountPerLevel, condition }); return this; }
  restartInit(id: string): this { this._functionalities.push({ id, kind: 'restartInit' }); return this; }
  hardResetInit(id: string): this { this._functionalities.push({ id, kind: 'hardResetInit' }); return this; }
  gacha(id: string): this { this._functionalities.push({ id, kind: 'gacha' }); return this; }
  shop(id: string, shopId: ShopId): this { this._functionalities.push({ id, kind: 'shop', shopId }); return this; }
  gachaPools(...poolIds: GachaPoolId[]): this { this._gachaPools.push(...poolIds); return this; }
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this { this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target }); return this; }
  revealResource(target: RevealTarget, resourceId: string, amount: number): this { this._revealTriggers.push(revealResource(target, resourceId, amount)); return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  build(): SpotDef {
    if (!this._name) throw new Error(`SpotBuilder(${this._id}): name 未设置`); if (!this._description) throw new Error(`SpotBuilder(${this._id}): description 未设置`);
    const def: SpotDef = { id: this._id, areaId: this._areaId, name: this._name, description: this._description, baseCost: this._baseCost, baseCostResource: this._baseCostResource, baseYield: this._baseYield, baseYieldResource: this._baseYieldResource, baseCapacity: this._baseCapacity, managerBonusYield: this._managerBonusYield, tags: this._tags };
    if (this._conditionText) def.conditionText = this._conditionText; if (this._levelUpgrades.length) def.levelUpgrades = this._levelUpgrades; if (this._yieldPerLevel !== undefined) def.yieldPerLevel = this._yieldPerLevel;
    if (this._upgradeCostBase !== undefined) def.upgradeCostBase = this._upgradeCostBase; if (this._upgradeCostGrowth !== undefined) def.upgradeCostGrowth = this._upgradeCostGrowth; if (this._maxLevel !== undefined) def.maxLevel = this._maxLevel;
    if (this._global) def.global = true; if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers; if (this._functionalities.length) def.functionalities = this._functionalities; if (this._gachaPools.length) def.gachaPools = this._gachaPools; if (this._extra) def.extra = this._extra;
    return def;
  }
}
export const spot = (id: SpotId, areaId: AreaId): SpotBuilder => new SpotBuilder(id, areaId);
