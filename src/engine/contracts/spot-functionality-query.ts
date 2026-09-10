import type { ConditionGroup } from '../types';
import type { FunctionalityState } from './state-query';

export interface SpotFunctionalityView {
  readonly id: string;
  readonly kind: string;
  readonly condition?: ConditionGroup;
  readonly resource?: string;
  readonly amountPerLevel?: number;
  readonly shopId?: string;
}

export interface SpotFunctionalitySubject {
  readonly id: string;
  readonly functionalities?: SpotFunctionalityView[];
}

/** UI 展示设施交互入口所需的功能查询能力。 */
export interface SpotFunctionalityQueryPort {
  functionalitiesOf(spot: SpotFunctionalitySubject, state: FunctionalityState): SpotFunctionalityView[];
  hasFunctionality(spot: SpotFunctionalitySubject, state: FunctionalityState, kind: string): boolean;
}
