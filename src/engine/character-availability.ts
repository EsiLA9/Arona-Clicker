// ============================================================
// engine/character-availability.ts — 角色可及性管理
//
// 两个概念：限定卡池（closeWhen 满足后关闭）与世界 Pool（关闭池成员并入的常驻集合）。
// 可获得渠道 = 活动限定池成员 ∪ 世界 Pool；story/event 显式授予不受限。
// ============================================================

import type {
  Condition,
  ConditionGroup,
  GachaPoolDef,
  PlayerState,
  VariantId,
} from './types';
import type { Registry } from './registry';
import type { StateMutationService } from './state-mutation-service';

export class CharacterAvailabilityService {
  constructor(
    private readonly registry: Registry,
    private readonly mutations: StateMutationService,
    private readonly getState: () => PlayerState,
    private readonly checkCondition: (expr: Condition | ConditionGroup, state: PlayerState) => boolean,
  ) {}

  /** 池是否已关闭（声明了 closeWhen 且条件满足）。 */
  isPoolClosed(pool: GachaPoolDef, state: PlayerState): boolean {
    return pool.closeWhen !== undefined && this.checkCondition(pool.closeWhen, state);
  }

  /** 当前世界 Pool（已并入常驻集合的差分）。 */
  worldPool(state: PlayerState): VariantId[] {
    return state.worldPool ?? [];
  }

  /**
   * 某池当前可抽集合：池已关闭 → 空；否则 = 池成员 ∪ 世界 Pool
   * （常驻角色出现在一切开放池中）。
   */
  drawableOf(pool: GachaPoolDef, state: PlayerState): VariantId[] {
    if (this.isPoolClosed(pool, state)) return [];
    const set = new Set(pool.members);
    for (const id of this.worldPool(state)) set.add(id);
    return [...set];
  }

  /** 全部开放池的可获得差分（限定 ∪ 常驻）；用于 UI 展示与校验。 */
  availableVariantIds(state: PlayerState): VariantId[] {
    const set = new Set<VariantId>();
    for (const pool of this.registry.gachaPools.values()) {
      if (this.isPoolClosed(pool, state)) continue;
      for (const id of pool.members) set.add(id);
    }
    for (const id of this.worldPool(state)) set.add(id);
    return [...set];
  }

  /**
   * 刷新世界 Pool：遍历所有声明 closeWhen 的池，条件满足者成员并入
   * （经 StateMutationService 写入，幂等——已在世界 Pool 的跳过）。
   */
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
