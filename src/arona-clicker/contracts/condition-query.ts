import type { Condition, ConditionGroup } from '../../engine/types';
import type { PlayerState } from '../types/state';

export interface ConditionQueryPort {
  evaluateExpr(expr: Condition | ConditionGroup, state: PlayerState): boolean;
  evaluateGroup(group: ConditionGroup, state: PlayerState): boolean;
}
