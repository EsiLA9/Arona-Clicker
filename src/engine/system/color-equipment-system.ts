// ============================================================
// engine/system/color-equipment-system.ts — 色彩装备系统
//
// 核心收集品 ColorEquipment（捆绑头像视觉 ColorGroup + 效用 effects）。
// 职责：
// - tryUnlock / recheckUnlocks：条件编排 + 级联解锁（收集装备即解锁其引用的全部 Color）
// - 库存查询：ownedEquipments / isOwned / getDef / getAll
// - 解析：groupOf（装备 → ColorGroup）、avatarColors（Group 各 slot 实际 hex）
// - effectsOf：按变体当前 equippedEquipment 聚合效果（迁移自 ColorSystem.effectsOf）
//
// 所有写操作经 StateMutationService（collectEquipment / unlockColor）。
// ============================================================

import type {
  ColorEquipmentDef,
  ColorGroupDef,
  ColorGroupId,
  Condition,
  ConditionGroup,
  Effect,
  EquipmentId,
  PlayerState,
  VariantId,
} from '../types';
import type { Registry } from '../registry/registry';
import type { StateMutationService } from './state-mutation-service';

export class ColorEquipmentSystem {
  constructor(
    private readonly registry: Registry,
    private readonly mutations: StateMutationService,
    private readonly getState: () => PlayerState,
    private readonly checkCondition: (expr: Condition | ConditionGroup, state: PlayerState) => boolean,
  ) {}

  // --- 定义查询 ---

  getDef(equipmentId: EquipmentId): ColorEquipmentDef | undefined {
    return this.registry.colorEquipments.get(equipmentId);
  }

  getAll(): ColorEquipmentDef[] {
    return [...this.registry.colorEquipments.values()];
  }

  // --- 库存查询 ---

  isOwned(state: PlayerState, equipmentId: EquipmentId): boolean {
    return state.equipmentsOwned?.includes(equipmentId) ?? false;
  }

  ownedEquipments(state: PlayerState): ColorEquipmentDef[] {
    return (state.equipmentsOwned ?? [])
      .map(id => this.registry.colorEquipments.get(id))
      .filter((d): d is ColorEquipmentDef => !!d);
  }

  // --- 解析 ---

  /** 装备引用的 ColorGroup（未定义返回 undefined）。 */
  groupOf(equipmentId: EquipmentId): ColorGroupDef | undefined {
    const def = this.getDef(equipmentId);
    if (!def) return undefined;
    return this.registry.colorGroups.get(def.colorGroupId);
  }

  /** 解析某 ColorGroup 各 slot 的实际 hex（按 slot 顺序，供默认头像/预览消费）。 */
  avatarColorsForGroup(groupId: ColorGroupId): string[] {
    const group = this.registry.colorGroups.get(groupId);
    if (!group) return [];
    return group.slots.map(slot => slot.color);
  }

  /** 解析装备 ColorGroup 各 slot 的实际 hex（按 slot 顺序，供 AvatarRenderer 消费）。 */
  avatarColors(equipmentId: EquipmentId): string[] {
    const group = this.groupOf(equipmentId);
    if (!group) return [];
    return this.avatarColorsForGroup(group.id);
  }

  /**
   * 变体当前装备的聚合效果声明（单装备槽：null/未拥有 → 空数组）。
   * 消费方按现有 Effect 语义求值（如 effect-engine）。
   */
  effectsOf(state: PlayerState, variantId: VariantId): Effect[] {
    const entry = state.roster?.[variantId];
    if (!entry?.equippedEquipment) return [];
    return this.getDef(entry.equippedEquipment)?.effects ?? [];
  }

  // --- 解锁编排（写经 mutations） ---

  /**
   * 尝试收集装备：条件校验 → collectEquipment → 级联解锁其引用的 ColorGroup。
   * @returns 'unlocked' 成功 | 'already' 幂等 | false 条件不满足或定义缺失
   */
  tryUnlock(equipmentId: EquipmentId): 'unlocked' | 'already' | false {
    const def = this.getDef(equipmentId);
    if (!def) return false;
    const state = this.getState();
    if (this.isOwned(state, equipmentId)) return 'already';
    if (def.unlock && !this.checkCondition(def.unlock, state)) return false;
    if (!this.mutations.collectEquipment(equipmentId)) return 'already';
    const group = this.groupOf(equipmentId);
    if (group) {
      this.mutations.unlockGroup(group.id);
    }
    return 'unlocked';
  }

  /**
   * 扫描全部装备，对尚未拥有且条件已满足者执行 tryUnlock。
   * 仅覆盖带 unlock 条件的装备（缺省无 unlock = 不可自动解锁）。
   * 挂在 characterAcquired / flagChanged 时机，使"达成条件即自动收集"闭环。
   * @returns 本次新收集的装备 id 列表（空数组 = 无变化）。
   */
  recheckUnlocks(): EquipmentId[] {
    const newly: EquipmentId[] = [];
    for (const def of this.getAll()) {
      if (!def.unlock) continue;
      if (this.tryUnlock(def.id) === 'unlocked') newly.push(def.id);
    }
    return newly;
  }
}
