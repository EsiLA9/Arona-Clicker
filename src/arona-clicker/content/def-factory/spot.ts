import type { TagPath } from '../../../engine/core/tag';
import type { GachaPoolId } from '../../../engine/types/character';
import type { ExtraCompound } from '../../../engine/types/extra';
import type { Condition, ConditionGroup, ValueExpression } from '../../../engine/types/expression';
import type { AreaId, SpotId } from '../../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../../engine/types/reveal';
import type { LevelUpgradeDef, SpotDef, SpotFunctionalityDef } from '../../../data-services/contracts/world';
import type { PaymentOptionDef } from '../../../data-services/contracts/cost';
import type { ShopId } from '../../../data-services/contracts/shop';
import { Expr } from '../../../engine/def-factory/expr';
import { revealResource } from '../../../engine/def-factory/reveal';

export class SpotBuilder {
  private readonly _id: SpotId; private readonly _areaId: AreaId; private _name = ''; private _description = '';
  private _conditionText?: string;
  private _purchaseOptions: PaymentOptionDef[] = [{ id: 'free', label: '免费', costs: [] }]; private _levelUpgrades: LevelUpgradeDef[] = []; private _maxLevel?: number;
  private _tags: TagPath[] = []; private _global = false; private _revealTriggers: RevealTrigger[] = []; private _functionalities: SpotFunctionalityDef[] = []; private _gachaPools: GachaPoolId[] = []; private _extra?: ExtraCompound;
  constructor(id: SpotId, areaId: AreaId) { this._id = id; this._areaId = areaId; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  purchaseCost(value: number | ValueExpression, resourceId = 'base:resource:credit'): this {
    this._purchaseOptions = [{ id: 'purchase', label: '购买', costs: [{ type: 'resource', resourceId, amount: typeof value === 'number' ? Expr.const(value) : value }] }];
    return this;
  }
  /** 旧内容的过渡拼写；结果仍然是显式 purchaseOptions。新内容应使用 purchaseCost。 */
  cost(value: number | ValueExpression, resourceId?: string): this { return this.purchaseCost(value, resourceId); }
  purchaseOptions(...options: PaymentOptionDef[]): this { this._purchaseOptions = options; return this; }
  flow(id: string, resource: string, amount: number | ValueExpression): this { this._functionalities.push({ id, kind: 'flow', resource, amount }); return this; }
  conditionText(value: string): this { this._conditionText = value; return this; }
  genericUpgrade(resourceIdOrBase: string | number, priceBaseOrGrowth: number, priceGrowthOrLinear?: number, linearOrResource?: number | string): this {
    const resourceId = typeof resourceIdOrBase === 'string' ? resourceIdOrBase : 'base:resource:credit';
    const priceBase = typeof resourceIdOrBase === 'string' ? priceBaseOrGrowth : resourceIdOrBase;
    const priceGrowth = typeof resourceIdOrBase === 'string' ? priceGrowthOrLinear! : priceBaseOrGrowth;
    const linearAmountPerLevel = typeof resourceIdOrBase === 'string'
      ? typeof linearOrResource === 'number' ? linearOrResource : undefined
      : priceGrowthOrLinear;
    if (this._levelUpgrades.length === 0) this.levelUpTo(this._maxLevel ?? 3);
    for (const upgrade of this._levelUpgrades) {
      const amount = Math.floor(priceBase * Math.pow(priceGrowth, upgrade.level - 1));
      upgrade.paymentOptions = [{ id: `upgrade-${upgrade.level}`, label: `升级 Lv.${upgrade.level}`, costs: [{ type: 'resource', resourceId, amount: Expr.const(amount) }] }];
    }
    if (linearAmountPerLevel !== undefined) {
      this._functionalities.push({
        id: `${this._id}:generic-level-linear`,
        kind: 'linearYield',
        resource: 'base:resource:credit',
        amountPerLevel: linearAmountPerLevel,
        startLevel: 1,
      });
    }
    return this;
  }
  maxLevel(value: number): this { this._maxLevel = value; return this; }
  levelUpTo(maxLevel: number): this { for (let lv = 2; lv <= maxLevel; lv++) this._levelUpgrades.push({ level: lv, paymentOptions: [{ id: 'free', label: '免费', costs: [] }], effects: [{ op: 'setSpotLevel', target: this._id, value: String(lv) }] }); return this; }
  paymentOptions(level: number, ...options: PaymentOptionDef[]): this {
    const upgrade = this._levelUpgrades.find(item => item.level === level);
    if (upgrade) upgrade.paymentOptions = options;
    else this._levelUpgrades.push({ level, paymentOptions: options, effects: [] });
    return this;
  }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  global(): this { this._global = true; return this; }
  functionality(...defs: SpotFunctionalityDef[]): this { this._functionalities.push(...defs); return this; }
  linearYield(id: string, resource: string, amountPerLevel: number, startLevel?: number): this { this._functionalities.push({ id, kind: 'linearYield', resource, amountPerLevel, ...(startLevel === undefined ? {} : { startLevel }) }); return this; }
  linearYieldWhen(id: string, resource: string, amountPerLevel: number, condition: ConditionGroup, startLevel?: number): this { this._functionalities.push({ id, kind: 'linearYield', resource, amountPerLevel, condition, ...(startLevel === undefined ? {} : { startLevel }) }); return this; }
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
    const def: SpotDef = { id: this._id, areaId: this._areaId, name: this._name, description: this._description, tags: this._tags, purchaseOptions: this._purchaseOptions };
    if (this._conditionText) def.conditionText = this._conditionText; if (this._levelUpgrades.length) def.levelUpgrades = this._levelUpgrades;
    if (this._maxLevel !== undefined) def.maxLevel = this._maxLevel;
    if (this._global) def.global = true; if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers; if (this._functionalities.length) def.functionalities = this._functionalities; if (this._gachaPools.length) def.gachaPools = this._gachaPools; if (this._extra) def.extra = this._extra;
    return def;
  }
}
export const spot = (id: SpotId, areaId: AreaId): SpotBuilder => new SpotBuilder(id, areaId);
