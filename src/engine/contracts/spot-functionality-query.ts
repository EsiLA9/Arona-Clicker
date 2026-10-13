import type { ConditionGroup, ValueExpression } from '../types';
import type { FunctionalityState } from './state-query';

export interface SpotFunctionalityView {
  readonly id: string;
  readonly kind: string;
  readonly requiresOwned?: boolean;
  readonly condition?: ConditionGroup;
  readonly resource?: string;
  readonly amount?: number | ValueExpression;
  readonly amountPerLevel?: number;
  readonly startLevel?: number;
  readonly shopId?: string;
  readonly operationEventId?: string;
}

export interface SpotFunctionalitySubject {
  readonly id: string;
  readonly functionalities?: SpotFunctionalityView[];
}

/** UI 展示设施交互入口所需的功能查询能力。 */
export interface SpotFunctionalityQueryPort {
  /** 返回来源和持有要求已满足的功能定义；保留 condition 未满足项供 Affector 监听。 */
  definitionsOf(spot: SpotFunctionalitySubject, state: FunctionalityState): SpotFunctionalityView[];
  /** 返回当前准入条件均满足、可展示和使用的功能。 */
  functionalitiesOf(spot: SpotFunctionalitySubject, state: FunctionalityState): SpotFunctionalityView[];
  hasFunctionality(spot: SpotFunctionalitySubject, state: FunctionalityState, kind: string): boolean;
}
