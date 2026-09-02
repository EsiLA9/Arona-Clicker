import type { GachaPoolDef } from '../../data-services/contracts/gacha-pool';

export interface GachaQueryPort {
  getPool(poolId: string): GachaPoolDef | undefined;
  countersOf(poolId: string): { pity: number; pulls: number };
}
