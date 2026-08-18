// ============================================================
// engine/visibility-engine.ts — 可见性引擎
//
// 可知性/可达性层级的第一层：可见性（AccessStage.hidden ↔ visible）。
// 上层仅回答"实体是否出现"，不涉及揭示/可达性/生效：
//   可见性 → 揭示 → 可达性 → 生效
// 可见性由 revealTriggers 中的 existence 目标承担（原 visibilityCondition 的职责）：
// 无 existence 门槛 = 默认可见；有 = 任一满足即可见。
// ============================================================

import {
  PlayerState,
  VisibilitySnapshot,
  InitId,
  AreaId,
  SpotId,
  EnhancementId,
  StoryId,
  ItemId,
  RevealTrigger,
} from './types';
import { Registry } from './registry';
import { ConditionSystem } from './condition-system';
import { existenceMet } from './reveal';

export class VisibilityEngine {
  private registry: Registry;
  private conditionSystem: ConditionSystem;

  constructor(registry: Registry, conditionSystem: ConditionSystem) {
    this.registry = registry;
    this.conditionSystem = conditionSystem;
  }

  /** 计算完整可见性快照 */
  compute(state: PlayerState): VisibilitySnapshot {
    return {
      inits: this.computeSet(
        [...this.registry.inits.keys()],
        id => this.registry.inits.get(id)!.revealTriggers,
        state,
      ),
      areas: this.computeSet(
        [...this.registry.areas.keys()],
        id => this.registry.areas.get(id)!.revealTriggers,
        state,
      ),
      spots: this.computeSet(
        [...this.registry.spots.keys()],
        id => this.registry.spots.get(id)!.revealTriggers,
        state,
      ),
      enhancements: this.computeSet(
        [...this.registry.enhancements.keys()],
        id => this.registry.enhancements.get(id)!.revealTriggers,
        state,
      ),
      items: this.computeSet(
        [...this.registry.items.keys()],
        id => this.registry.items.get(id)!.revealTriggers,
        state,
      ),
      stories: this.computeSet(
        [...this.registry.stories.keys()],
        id => undefined, // 故事可见性由 triggerCondition 控制，此处暂不处理
        state,
      ),
    };
  }

  /** 检查单个实体是否可见 */
  isInitVisible(initId: InitId, state: PlayerState): boolean {
    return this.checkSingle(this.registry.inits.get(initId)?.revealTriggers, state);
  }

  isAreaVisible(areaId: AreaId, state: PlayerState): boolean {
    return this.checkSingle(this.registry.areas.get(areaId)?.revealTriggers, state);
  }

  isSpotVisible(spotId: SpotId, state: PlayerState): boolean {
    return this.checkSingle(this.registry.spots.get(spotId)?.revealTriggers, state);
  }

  isEnhancementVisible(enhId: EnhancementId, state: PlayerState): boolean {
    return this.checkSingle(this.registry.enhancements.get(enhId)?.revealTriggers, state);
  }

  private computeSet<T extends string>(
    ids: T[],
    getTriggers: (id: T) => RevealTrigger[] | undefined,
    state: PlayerState,
  ): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const id of ids) {
      result[id] = this.checkSingle(getTriggers(id), state);
    }
    return result;
  }

  private checkSingle(triggers: RevealTrigger[] | undefined, state: PlayerState): boolean {
    return existenceMet(triggers, cond => this.conditionSystem.evaluateExpr(cond, state));
  }
}
