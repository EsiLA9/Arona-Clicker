import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import type { ExtraCompound } from '../../engine/types/extra';
import type { ItemId } from '../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../engine/types/reveal';
import type { ResourceAmount } from './common';
import type { AffectorPackRef } from '../../engine/types/trigger';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  icon?: string;
  maxStack: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'consumable' | 'material' | 'key';
  revealTriggers?: RevealTrigger[];
  useCondition?: ConditionGroup;
  useEffects?: Effect[];
  pickupEffects?: Effect[];
  sellPrice?: ResourceAmount;
  affectorPackIds?: AffectorPackRef[];
  extra?: ExtraCompound;
}

export type ItemRevealCondition = Condition | ConditionGroup;
