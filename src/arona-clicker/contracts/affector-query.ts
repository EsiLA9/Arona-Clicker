import type { AffectorPackDef, AffectorPackRef } from '../../engine/types';

export interface AffectorQueryPort {
  getPack(ref: AffectorPackRef): AffectorPackDef | undefined;
}
