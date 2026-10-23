import type { ValueExpression } from '../../../engine/types/index';
import type { PlayerState } from '../../types/state';

export interface ValueQueryPort {
  evaluate(expr: ValueExpression, state: PlayerState): number;
}
