import type { ColorEquipmentDef, ColorGroupDef } from '../../data-services/contracts/color';
import type { ColorGroupId, EquipmentId, VariantId } from '../types/character';
import type { Effect } from '../../engine/types/expression';
import type { PlayerState } from '../types/state';

export interface ColorEquipmentQueryPort {
  getDef(equipmentId: EquipmentId): ColorEquipmentDef | undefined;
  getAll(): ColorEquipmentDef[];
  isOwned(state: PlayerState, equipmentId: EquipmentId): boolean;
  ownedEquipments(state: PlayerState): ColorEquipmentDef[];
  groupOf(equipmentId: EquipmentId): ColorGroupDef | undefined;
  avatarColorsForGroup(groupId: ColorGroupId): string[];
  avatarColors(equipmentId: EquipmentId): string[];
  effectsOf(state: PlayerState, variantId: VariantId): Effect[];
}
