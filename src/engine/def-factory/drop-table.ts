// ============================================================
// engine/def-factory/drop-table.ts — DropTableDef 链式 Builder
// ============================================================

import type { ExtraCompound } from '../types/extra';
import type { ConditionGroup } from '../types/expression';
import type { ItemId } from '../types/ids';
import type { DropTableDef, DropTableEntry } from '../types/content';

export class DropTableBuilder {
  private readonly _id: string;
  private _entries: DropTableEntry[] = [];
  private _guaranteed?: { itemId: ItemId; count: number }[];
  private _maxRolls = 1;
  private _condition?: ConditionGroup;
  private _extra?: ExtraCompound;

  constructor(id: string) {
    this._id = id;
  }

  /** @label 最大掷数 */
  maxRolls(value: number): this { this._maxRolls = value; return this; }

  /** 必出条目（追加）。 */
  guaranteed(itemId: ItemId, count: number): this {
    this._guaranteed = [...(this._guaranteed ?? []), { itemId, count }];
    return this;
  }

  /** 掉落条目（追加）：(itemId, min, max, weight)。 */
  entry(itemId: ItemId, min: number, max: number, weight: number): this {
    this._entries.push({ itemId, min, max, weight });
    return this;
  }

  condition(group: ConditionGroup): this { this._condition = group; return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): DropTableDef {
    const def: DropTableDef = {
      id: this._id,
      entries: this._entries,
      maxRolls: this._maxRolls,
    };
    if (this._guaranteed) def.guaranteed = this._guaranteed;
    if (this._condition) def.condition = this._condition;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

export const dropTable = (id: string): DropTableBuilder => new DropTableBuilder(id);