// ============================================================
// arona-clicker/content/def-factory/cultivate-curve.ts
// ============================================================

import type { ValueExpression } from '../../../engine/types/expression';
import type { CultivateCurveDef } from '../../../data-services/contracts/cultivate-curve';
import type { CultivateCurveId } from '../../types/character';

export class CultivateCurveBuilder {
  private readonly _id: CultivateCurveId;
  private _maxLevel = 1;
  private _expTable?: number[];
  private _starMax?: number;
  private _starCost?: number[];
  private _levelCapPerStar?: number;
  private _levelBonusPerLevel?: ValueExpression;

  constructor(id: CultivateCurveId) { this._id = id; }
  maxLevel(value: number): this { this._maxLevel = value; return this; }
  expTable(...values: number[]): this { this._expTable = values; return this; }
  starMax(value: number): this { this._starMax = value; return this; }
  starCost(...values: number[]): this { this._starCost = values; return this; }
  levelCapPerStar(value: number): this { this._levelCapPerStar = value; return this; }
  levelBonusPerLevel(value: ValueExpression): this { this._levelBonusPerLevel = value; return this; }

  build(): CultivateCurveDef {
    const def: CultivateCurveDef = { id: this._id, maxLevel: this._maxLevel };
    if (this._expTable) def.expTable = this._expTable;
    if (this._starMax !== undefined) def.starMax = this._starMax;
    if (this._starCost) def.starCost = this._starCost;
    if (this._levelCapPerStar !== undefined) def.levelCapPerStar = this._levelCapPerStar;
    if (this._levelBonusPerLevel) def.levelBonusPerLevel = this._levelBonusPerLevel;
    return def;
  }
}

export const cultivateCurve = (id: CultivateCurveId): CultivateCurveBuilder => new CultivateCurveBuilder(id);
