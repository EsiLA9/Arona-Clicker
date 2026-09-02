import type { ConditionGroup } from '../../engine/types/expression';
import type { ExtraCompound } from '../../engine/types/extra';
import type { ItemId } from '../../engine/types/ids';

export interface DropTableEntry {
  itemId: ItemId;
  min: number;
  max: number;
  weight: number;
  condition?: ConditionGroup;
}

export interface DropTableDef {
  id: string;
  entries: DropTableEntry[];
  guaranteed?: { itemId: ItemId; count: number }[];
  maxRolls: number;
  condition?: ConditionGroup;
  extra?: ExtraCompound;
}
