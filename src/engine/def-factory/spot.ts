// ============================================================
// engine/def-factory/spot.ts — Spot 定义链式 Builder
// 构造 SpotDef：必填 id/areaId/name/description，其余差异字段链式填充。
// .build() 返回标准 SpotDef（纯数据，可进 Schema 协议、可被数据包编辑器消费）。
// ============================================================

import type { TagPath } from '../core/tag';
import type { GachaPoolId } from '../types/character';
import type { ExtraCompound } from '../types/extra';
import type {
  Condition,
  ConditionGroup,
  ValueExpression,
} from '../types/expression';
import { Resource } from '../types/ids';
import type { AreaId, SpotId } from '../types/ids';
import type { RevealTarget, RevealTrigger } from '../types/reveal';
import type { LevelUpgradeDef, SpotDef, SpotFunctionalityDef } from '../types/world';
import { Expr } from './expr';
import { revealResource } from './reveal';

export class SpotBuilder {
  private readonly _id: SpotId;
  private readonly _areaId: AreaId;
  private _name = '';
  private _description = '';
  private _baseCost: ValueExpression = Expr.const(0);
  private _baseCostResource: string = Resource.Credit;
  private _baseYield: ValueExpression = Expr.const(0);
  private _baseYieldResource: string = Resource.Credit;
  private _baseCapacity = 0;
  private _managerBonusYield: ValueExpression = Expr.const(0);
  private _conditionText?: string;
  private _levelUpgrades: LevelUpgradeDef[] = [];
  private _yieldPerLevel?: number;
  private _upgradeCostBase?: number;
  private _upgradeCostGrowth?: number;
  private _maxLevel?: number;
  private _tags: TagPath[] = [];
  private _global = false;
  private _revealTriggers: RevealTrigger[] = [];
  private _functionalities: SpotFunctionalityDef[] = [];
  private _gachaPools: GachaPoolId[] = [];
  private _extra?: ExtraCompound;

  constructor(id: SpotId, areaId: AreaId) {
    this._id = id;
    this._areaId = areaId;
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

  /** 基础购买花费（数值 → Expr.const）。baseCostResource 缺省信用点。 */
  cost(value: number | ValueExpression, resourceId?: string): this {
    this._baseCost = typeof value === 'number' ? Expr.const(value) : value;
    if (resourceId) this._baseCostResource = resourceId;
    return this;
  }

  /** @label 购买资源 */
  costResource(id: string): this {
    this._baseCostResource = id;
    return this;
  }

  /** 基础产出（数值 → Expr.const）。baseYieldResource 缺省信用点。 */
  yield(value: number | ValueExpression, resourceId?: string): this {
    this._baseYield = typeof value === 'number' ? Expr.const(value) : value;
    if (resourceId) this._baseYieldResource = resourceId;
    return this;
  }

  /** @label 产出资源 */
  yieldResource(id: string): this {
    this._baseYieldResource = id;
    return this;
  }

  /** @label 基础容量 */
  capacity(value: number): this {
    this._baseCapacity = value;
    return this;
  }

  /** 管理加成产出（数值 → Expr.const）。 */
  managerBonus(value: number | ValueExpression): this {
    this._managerBonusYield = typeof value === 'number' ? Expr.const(value) : value;
    return this;
  }

  /** @label 条件文本 */
  conditionText(value: string): this {
    this._conditionText = value;
    return this;
  }

  /**
   * 通用升级公式：产出线性提升（yieldPerLevel）+ 花费指数增长（upgradeCostBase × growth^(N-1)）。
   */
  genericUpgrade(upgradeCostBase: number, upgradeCostGrowth: number, yieldPerLevel: number): this {
    this._upgradeCostBase = upgradeCostBase;
    this._upgradeCostGrowth = upgradeCostGrowth;
    this._yieldPerLevel = yieldPerLevel;
    return this;
  }

  /** @label 等级上限 */
  maxLevel(value: number): this {
    this._maxLevel = value;
    return this;
  }

  /**
   * 自动生成自我引用 levelUpgrades 块：等级 2..maxLevel 每级一条
   * `{ level, effects: [{ op: 'setSpotLevel', target: 自身 id, value: String(level) }] }`
   * （消解 base 数据里重复 16 次的样板块）。
   */
  levelUpTo(maxLevel: number): this {
    for (let lv = 2; lv <= maxLevel; lv++) {
      this._levelUpgrades.push({
        level: lv,
        effects: [{ op: 'setSpotLevel', target: this._id, value: String(lv) }],
      });
    }
    return this;
  }

  /** @label 标签 */
  tags(...paths: TagPath[]): this {
    this._tags.push(...paths);
    return this;
  }

  /** @label 跨世界线共享 */
  global(): this {
    this._global = true;
    return this;
  }

  /** 追加任意 Spot 功能（kind 未来扩展兜底）。 */
  functionality(...defs: SpotFunctionalityDef[]): this {
    this._functionalities.push(...defs);
    return this;
  }

  /** linearYield：升级提供每级线性额外产出。 */
  linearYield(id: string, resource: string, amountPerLevel: number): this {
    this._functionalities.push({ id, kind: 'linearYield', resource, amountPerLevel });
    return this;
  }

  /** linearYield + 生效条件。 */
  linearYieldWhen(
    id: string,
    resource: string,
    amountPerLevel: number,
    condition: ConditionGroup,
  ): this {
    this._functionalities.push({ id, kind: 'linearYield', resource, amountPerLevel, condition });
    return this;
  }

  /** restartInit：软重启（保留快照 + 统计）。 */
  restartInit(id: string): this {
    this._functionalities.push({ id, kind: 'restartInit' });
    return this;
  }

  /** hardResetInit：硬重置（删除快照，保留统计）。 */
  hardResetInit(id: string): this {
    this._functionalities.push({ id, kind: 'hardResetInit' });
    return this;
  }

  /** gacha：招募功能入口。 */
  gacha(id: string): this {
    this._functionalities.push({ id, kind: 'gacha' });
    return this;
  }

  /** 追加专有卡池（缺省仅开放全局通用卡池）。 */
  gachaPools(...poolIds: GachaPoolId[]): this {
    this._gachaPools.push(...poolIds);
    return this;
  }

  /** 追加揭示 Trigger（condition 缺省 = 恒真）。 */
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this {
    this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target });
    return this;
  }

  /** 追加「持有指定资源 ≥ amount」门槛的揭示 Trigger。 */
  revealResource(target: RevealTarget, resourceId: string, amount: number): this {
    this._revealTriggers.push(revealResource(target, resourceId, amount));
    return this;
  }

  /** Extra 附加数据。 */
  extra(value: ExtraCompound): this {
    this._extra = value;
    return this;
  }

  build(): SpotDef {
    if (!this._name) throw new Error(`SpotBuilder(${this._id}): name 未设置`);
    if (!this._description) throw new Error(`SpotBuilder(${this._id}): description 未设置`);
    const def: SpotDef = {
      id: this._id,
      areaId: this._areaId,
      name: this._name,
      description: this._description,
      baseCost: this._baseCost,
      baseCostResource: this._baseCostResource,
      baseYield: this._baseYield,
      baseYieldResource: this._baseYieldResource,
      baseCapacity: this._baseCapacity,
      managerBonusYield: this._managerBonusYield,
      tags: this._tags,
    };
    if (this._conditionText) def.conditionText = this._conditionText;
    if (this._levelUpgrades.length) def.levelUpgrades = this._levelUpgrades;
    if (this._yieldPerLevel !== undefined) def.yieldPerLevel = this._yieldPerLevel;
    if (this._upgradeCostBase !== undefined) def.upgradeCostBase = this._upgradeCostBase;
    if (this._upgradeCostGrowth !== undefined) def.upgradeCostGrowth = this._upgradeCostGrowth;
    if (this._maxLevel !== undefined) def.maxLevel = this._maxLevel;
    if (this._global) def.global = true;
    if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._functionalities.length) def.functionalities = this._functionalities;
    if (this._gachaPools.length) def.gachaPools = this._gachaPools;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

/** Spot 定义链式构造入口。 */
export const spot = (id: SpotId, areaId: AreaId): SpotBuilder => new SpotBuilder(id, areaId);
