import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import type { ThemeDef, ThemeToken } from '../../engine/types/theme';
import type { ColorGroupId, EquipmentId } from '../../engine/types/character';

export interface ThemeDesignDef {
  id: string;
  name: string;
  description?: string;
  entityKey?: string;
  theme: ThemeDef;
  unlock?: Condition | ConditionGroup;
}

export type CompositionType = 'solid' | 'gradient' | 'duotone' | 'pie' | 'radial';
export type ColorGroupRole = 'primary' | 'secondary' | 'accent' | 'highlight' | 'shadow' | 'edge';

export interface ColorGroupSlot {
  role: ColorGroupRole;
  color: string;
}

export interface ColorGroupDef {
  id: ColorGroupId;
  name: string;
  description?: string;
  compositionType: CompositionType;
  slots: ColorGroupSlot[];
  theme?: Partial<Record<ThemeToken, string>>;
  unlock?: Condition | ConditionGroup;
}

export interface ColorEquipmentDef {
  id: EquipmentId;
  name: string;
  description?: string;
  colorGroupId: ColorGroupId;
  effects: Effect[];
  theme?: ThemeDef;
  unlock?: Condition | ConditionGroup;
  category?: 'common' | 'rare' | 'epic';
}
