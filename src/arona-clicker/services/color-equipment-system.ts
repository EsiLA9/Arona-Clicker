import type { ColorEquipmentDef, ColorGroupDef } from '../../data-services/contracts/color';
import type { ColorGroupId, EquipmentId, VariantId } from '../types/character';
import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import type { PlayerState } from '../types/state';
import type { Registry } from '../../data-services/registry/registry';
import type { ColorEquipmentMutationPort } from '../contracts/mutation';

/** AronaClicker 色彩装备领域服务。 */
export class ColorEquipmentSystem {
  constructor(
    private readonly registry: Registry,
    private readonly mutations: ColorEquipmentMutationPort,
    private readonly getState: () => PlayerState,
    private readonly checkCondition: (expr: Condition | ConditionGroup, state: PlayerState) => boolean,
  ) {}

  getDef(equipmentId: EquipmentId): ColorEquipmentDef | undefined { return this.registry.colorEquipments.get(equipmentId); }
  getAll(): ColorEquipmentDef[] { return [...this.registry.colorEquipments.values()]; }

  isOwned(state: PlayerState, equipmentId: EquipmentId): boolean {
    return state.equipmentsOwned?.includes(equipmentId) ?? false;
  }

  ownedEquipments(state: PlayerState): ColorEquipmentDef[] {
    return (state.equipmentsOwned ?? [])
      .map(id => this.registry.colorEquipments.get(id))
      .filter((d): d is ColorEquipmentDef => !!d);
  }

  groupOf(equipmentId: EquipmentId): ColorGroupDef | undefined {
    const def = this.getDef(equipmentId);
    return def ? this.registry.colorGroups.get(def.colorGroupId) : undefined;
  }

  avatarColorsForGroup(groupId: ColorGroupId): string[] {
    const group = this.registry.colorGroups.get(groupId);
    return group ? group.slots.map(slot => slot.color) : [];
  }

  avatarColors(equipmentId: EquipmentId): string[] {
    const group = this.groupOf(equipmentId);
    return group ? this.avatarColorsForGroup(group.id) : [];
  }

  effectsOf(state: PlayerState, variantId: VariantId): Effect[] {
    const entry = state.roster?.[variantId];
    return entry?.colorEquipment ? this.getDef(entry.colorEquipment)?.effects ?? [] : [];
  }

  tryUnlock(equipmentId: EquipmentId): 'unlocked' | 'already' | false {
    const def = this.getDef(equipmentId);
    if (!def) return false;
    const state = this.getState();
    if (this.isOwned(state, equipmentId)) return 'already';
    if (def.unlock && !this.checkCondition(def.unlock, state)) return false;
    if (!this.mutations.collectEquipment(equipmentId)) return 'already';
    const group = this.groupOf(equipmentId);
    if (group) this.mutations.unlockGroup(group.id);
    return 'unlocked';
  }

  recheckUnlocks(): EquipmentId[] {
    const newly: EquipmentId[] = [];
    for (const def of this.getAll()) {
      if (def.unlock && this.tryUnlock(def.id) === 'unlocked') newly.push(def.id);
    }
    return newly;
  }
}
