import type { Condition, ConditionGroup } from '../../engine/types/expression';
import type { WorldInformationTarget } from '../../engine/contracts/world-information';

/** World information is public when omitted, remembered after a gate, or only granted explicitly. */
export type { WorldInformationTarget };
export type WorldInformationRule =
  | { mode: 'condition'; condition: Condition | ConditionGroup }
  | { mode: 'explicit' };
export type WorldInformationDef = Partial<Record<WorldInformationTarget, WorldInformationRule>>;

