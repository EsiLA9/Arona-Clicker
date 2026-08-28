// ============================================================
// engine/def-factory/color-group.ts — ColorGroupDef 链式 Builder
// 构造色彩组（唯一色彩实体：重点色彩组 + 头像渲染方案 + theme-tree 预设）。
// .build() 返回标准 ColorGroupDef。
// ============================================================

import type { Condition, ConditionGroup } from '../types/expression';
import type { Character } from '../types/ids';
import type {
  ColorGroupDef,
  ColorGroupId,
  ColorGroupRole,
  ColorGroupSlot,
  CompositionType,
  ThemeToken,
} from '../types/character';
import { cond } from './condition';

export class ColorGroupBuilder {
  private readonly _id: ColorGroupId;
  private _name = '';
  private _description?: string;
  private _compositionType: CompositionType = 'solid';
  private readonly _slots: ColorGroupSlot[] = [];
  private _theme: Partial<Record<ThemeToken, string>> = {};
  private _unlock?: Condition | ConditionGroup;

  constructor(id: ColorGroupId) {
    this._id = id;
  }

  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }

  /** 构成方式（solid/gradient/duotone/pie/radial）。 */
  type(value: CompositionType): this { this._compositionType = value; return this; }

  /** 追加一个色位（role + 内联色值 hex）。 */
  slot(role: ColorGroupRole, color: string): this {
    this._slots.push({ role, color });
    return this;
  }

  /** 主色位快捷：追加 role='primary' 的色位；其色值同时成为 theme.primary 的缺省。 */
  primary(color: string): this { return this.slot('primary', color); }

  /** theme-tree 预设覆盖表（token 键，如 primary / panel / playerBubble / bg）；未给的由主色位色值派生。 */
  theme(tokens: Partial<Record<ThemeToken, string>>): this {
    this._theme = { ...this._theme, ...tokens };
    return this;
  }

  unlock(condition: Condition | ConditionGroup): this { this._unlock = condition; return this; }

  /** 获得指定原型角色 ≥ 次数后解锁。 */
  unlockProtoStat(character: Character, minAcquired = 1): this {
    this._unlock = cond('protoStat', String(character), '>=', minAcquired);
    return this;
  }

  /** flag 置 1 后解锁。 */
  unlockFlag(flag: string): this {
    this._unlock = cond('flag', flag, '>=', 1);
    return this;
  }

  build(): ColorGroupDef {
    if (!this._name) throw new Error(`ColorGroupBuilder(${this._id}): name 未设置`);
    if (this._slots.length === 0) throw new Error(`ColorGroupBuilder(${this._id}): 至少 1 个色位`);
    const def: ColorGroupDef = {
      id: this._id,
      name: this._name,
      compositionType: this._compositionType,
      slots: this._slots,
    };
    if (this._description) def.description = this._description;
    if (Object.keys(this._theme).length > 0) def.theme = this._theme;
    if (this._unlock) def.unlock = this._unlock;
    return def;
  }
}

export const colorGroup = (id: ColorGroupId): ColorGroupBuilder => new ColorGroupBuilder(id);
