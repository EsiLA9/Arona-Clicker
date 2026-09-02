import type {
  Condition,
  ConditionGroup,
  VariantId,
} from '../../engine/types';
import type { GachaPoolDef } from '../../data-services/contracts/gacha-pool';
import type { PlayerState } from '../types/state';
import type { Registry } from '../../data-services/registry/registry';
import type { AvailabilityMutationPort } from '../contracts/mutation';
import type { AvailabilityQueryPort } from '../contracts/availability-query';

/** AronaClicker 角色可及性：限定池关闭与世界 Pool 合并。 */
export class CharacterAvailabilityService implements AvailabilityQueryPort {
  constructor(
    private readonly registry: Registry,
    private readonly mutations: AvailabilityMutationPort,
    private readonly getState: () => PlayerState,
    private readonly checkCondition: (expr: Condition | ConditionGroup, state: PlayerState) => boolean,
  ) {}

  isPoolClosed(pool: GachaPoolDef, state: PlayerState): boolean {
    return pool.closeWhen !== undefined && this.checkCondition(pool.closeWhen, state);
  }

  worldPool(state: PlayerState): VariantId[] {
    return state.worldPool ?? [];
  }

  drawableOf(pool: GachaPoolDef, state: PlayerState): VariantId[] {
    if (this.isPoolClosed(pool, state)) return [];
    const set = new Set(pool.members);
    for (const id of this.worldPool(state)) set.add(id);
    return [...set];
  }

  availableVariantIds(state: PlayerState): VariantId[] {
    const set = new Set<VariantId>();
    for (const pool of this.registry.gachaPools.values()) {
      if (this.isPoolClosed(pool, state)) continue;
      for (const id of pool.members) set.add(id);
    }
    for (const id of this.worldPool(state)) set.add(id);
    return [...set];
  }

  refreshWorldPool(): void {
    const state = this.getState();
    const merged: VariantId[] = [];
    for (const pool of this.registry.gachaPools.values()) {
      if (!pool.closeWhen || !this.checkCondition(pool.closeWhen, state)) continue;
      const world = new Set(this.worldPool(state));
      for (const id of pool.members) {
        if (!world.has(id)) {
          world.add(id);
          merged.push(id);
        }
      }
    }
    if (merged.length > 0) this.mutations.mergeIntoWorldPool(merged);
  }
}
