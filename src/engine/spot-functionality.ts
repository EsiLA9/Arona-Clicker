// ============================================================
// engine/spot-functionality.ts — Spot 功能系统（内源 + 外源）
//
// 可知性/可达性层级的生效层：条件满足 + 已拥有才计入产出（AccessStage.active）。
//
// Spot 的功能分两种来源：
// - 内源：SpotDef.functionalities（Spot 自身声明）。
// - 外源：已获得的 Enhancement 通过 addsFunctionalities 注入，
//         作用于 productionTags 命中的 Spot（空 = 全局）。
//
// 持续型功能（linearYield）类比 Affector，按当前 Spot 等级生效；
// 交互型功能（restartInit）由 UI 提供操作入口。
// ============================================================

import { SpotDef, PlayerState, ProductionResult, SpotFunctionalityDef } from './types';
import { Registry } from './registry';
import { ConditionSystem } from './condition-system';
import { matchesTag } from './tag';

export class SpotFunctionalitySystem {
  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem?: ConditionSystem,
  ) {}

  /**
   * Spot 的生效功能 = 内源(spot.functionalities) + 外源(已获得 enhancement 注入、tag 匹配)。
   * 可带生效条件的功能在各自结算处判断。
   */
  functionalitiesOf(spot: SpotDef, state: PlayerState): SpotFunctionalityDef[] {
    const out: SpotFunctionalityDef[] = [...(spot.functionalities ?? [])];
    for (const enhId of state.unlockedEnhancements) {
      const enh = this.registry.enhancements.get(enhId);
      if (!enh?.addsFunctionalities?.length) continue;
      // 外源功能按 enhancement 的 productionTags 命中 spot（空 = 全局；层级前缀匹配）
      if (enh.productionTags?.length
        && !enh.productionTags.some(query => (spot.tags ?? []).some(declared => matchesTag(declared, query)))) {
        continue;
      }
      out.push(...enh.addsFunctionalities);
    }
    return out;
  }

  /** Spot 是否拥有某类功能（供 UI 展示交互型功能入口）。 */
  hasFunctionality(spot: SpotDef, state: PlayerState, kind: SpotFunctionalityDef['kind']): boolean {
    return this.functionalitiesOf(spot, state).some(fn => fn.kind === kind);
  }

  /**
   * 计算某 Spot 当前等级下由"功能"提供的额外产出。
   * 仅返回生效且 amount > 0 的条目；容量限制由调用方（tick 结算）处理。
   */
  extraYields(spot: SpotDef, level: number, state: PlayerState): ProductionResult[] {
    const out: ProductionResult[] = [];
    for (const fn of this.functionalitiesOf(spot, state)) {
      if (fn.condition && !this.conditionSystem?.evaluateGroup(fn.condition, state)) continue;
      if (fn.kind === 'linearYield') {
        const amount = level * (fn.amountPerLevel ?? 0);
        if (amount > 0) out.push({ spotId: spot.id, resource: fn.resource ?? '', amount });
      }
    }
    return out;
  }
}
