import type { ValueExpression } from '../../engine/types';
import type { PlayerState } from '../types/state';

export interface ValueQueryPort {
  evaluate(expr: ValueExpression, state: PlayerState): number;
}
