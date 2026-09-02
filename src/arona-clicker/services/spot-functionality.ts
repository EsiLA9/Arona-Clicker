import { SpotFunctionalityDef } from '../../data-services/contracts/world';
import type { PlayerState } from '../types/state';
import type { FunctionalityState } from '../../engine/contracts/state-query';
import type { SpotFunctionalitySubject, SpotFunctionalityView } from '../../engine/contracts/spot-functionality-query';
import { TagPath, matchesTag } from '../../engine/core/tag';
import { Registry } from '../../data-services/registry/registry';
import { ConditionSystem } from '../../engine/expression/condition-system';

export class SpotFunctionalitySystem {
  constructor(
    private readonly registry: Registry,
    private readonly conditionSystem?: ConditionSystem,
    private readonly enhTargetTags?: (enhId: string) => TagPath[],
  ) {}
  functionalitiesOf(spot: SpotFunctionalitySubject, state: FunctionalityState): SpotFunctionalityView[] {
    const out: SpotFunctionalityView[] = [...(spot.functionalities ?? [])];
    for (const enhId of state.unlockedEnhancements) {
      const enh = this.registry.enhancements.get(enhId);
      if (!enh?.addsFunctionalities?.length) continue;
      const tags = this.enhTargetTags?.(enhId) ?? [];
      const effective = this.registry.effectiveSpotTags(spot.id, state.spotTagOverrides);
      if (tags.length > 0 && !tags.some(query => effective.some(declared => matchesTag(declared, query)))) continue;
      out.push(...enh.addsFunctionalities);
    }
    return out;
  }
  hasFunctionality(spot: SpotFunctionalitySubject, state: FunctionalityState, kind: string): boolean {
    return this.functionalitiesOf(spot, state).some(fn => fn.kind === kind);
  }
}
