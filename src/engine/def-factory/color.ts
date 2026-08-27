// ============================================================
// engine/def-factory/color.ts — Color 定义链式 Builder
// 构造 ColorDef。.build() 返回标准 ColorDef。
// ============================================================

import type { ExtraCompound } from '../types/extra';
import type { Condition, ConditionGroup } from '../types/expression';
import type { Character } from '../types/ids';
import type { ColorDef, ColorId, ThemeToken } from '../types/character';
import { cond } from './condition';

export class ColorBuilder {
  private readonly _id: ColorId;
  private _name = '';
  private _description?: string;
  private _theme: Partial<Record<ThemeToken, string>> = {};
  private _unlock?: Condition | ConditionGroup;

  constructor(id: ColorId) {
    this._id = id;
  }

  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }

  /** 覆盖主题 token（primary 必给，其余可由 primary 经 HSL 派生）。 */
  theme(tokens: Record<ThemeToken, string>): this {
    this._theme = tokens;
    return this;
  }

  /** primary token 快捷设置。 */
  primary(hex: string): this {
    this._theme = { ...this._theme, primary: hex };
    return this;
  }

  /** 全量主题 token（primary 之外的深/浅覆盖）。 */
  tokens(overrides: Record<string, string>): this {
    this._theme = { ...this._theme, ...overrides };
    return this;
  }

  unlock(condition: Condition | ConditionGroup): this { this._unlock = condition; return this; }

  /** 获得指定原型角色 ≥ 次数后解锁（base 数据标准门槛）。 */
  unlockProtoStat(character: Character, minAcquired = 1): this {
    this._unlock = cond('protoStat', String(character), '>=', minAcquired);
    return this;
  }

  /** flag 置 1 后解锁。 */
  unlockFlag(flag: string): this {
    this._unlock = cond('flag', flag, '>=', 1);
    return this;
  }

  build(): ColorDef {
    if (!this._name) throw new Error(`ColorBuilder(${this._id}): name 未设置`);
    if (!this._theme.primary) throw new Error(`ColorBuilder(${this._id}): primary token 未设置`);
    const def: ColorDef = {
      id: this._id,
      name: this._name,
      theme: this._theme as Record<ThemeToken, string>,
    };
    if (this._description) def.description = this._description;
    if (this._unlock) def.unlock = this._unlock;
    return def;
  }
}

export const color = (id: ColorId): ColorBuilder => new ColorBuilder(id);