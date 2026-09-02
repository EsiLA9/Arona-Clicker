import type { GachaPoolDef } from '../../data-services/contracts/gacha-pool';
import type { VariantId } from '../types/character';
import type { PlayerState } from '../types/state';

export interface AvailabilityQueryPort {
  isPoolClosed(pool: GachaPoolDef, state: PlayerState): boolean;
  worldPool(state: PlayerState): VariantId[];
  drawableOf(pool: GachaPoolDef, state: PlayerState): VariantId[];
  availableVariantIds(state: PlayerState): VariantId[];
}
