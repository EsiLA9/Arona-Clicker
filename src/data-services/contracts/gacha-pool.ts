import type { CharacterRarity } from '../../engine/types/ids';
import type { Condition, ConditionGroup } from '../../engine/types/expression';
import type { GachaPoolId, VariantId } from '../../engine/types/character';

export enum GachaMode {
  BaClassic = 'ba-classic',
}

export interface DupRewards {
  shards: number;
  bonusResources?: Record<string, number>;
}

export interface GachaPityDef {
  guaranteedAt: number;
  keepOnHit?: boolean;
}

export interface GachaRateEntry {
  rarity: CharacterRarity;
  weight: number;
}

export interface GachaPoolDef {
  id: GachaPoolId;
  name: string;
  description?: string;
  mode: GachaMode;
  currency: string;
  costPerPull: number;
  rates: GachaRateEntry[];
  featured?: VariantId[];
  pity?: GachaPityDef;
  dupRewards?: DupRewards;
  members: VariantId[];
  closeWhen?: Condition | ConditionGroup;
}
