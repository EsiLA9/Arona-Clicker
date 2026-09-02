import type { TagPath } from '../../engine/core/tag';
import type { ExtraCompound } from '../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../engine/types/expression';
import type { AreaId, EnhancementId, InitId } from '../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../engine/types/reveal';
import type { ResourceAmount } from './common';
import type { AffectorPackRef } from '../../engine/types/trigger';
import type { SpotFunctionalityDef } from './world';

export type EnhancementAttachment =
  | { kind: 'area'; areaId: AreaId }
  | { kind: 'init'; initId: InitId }
  | { kind: 'global' };

export interface EnhancementDef {
  id: EnhancementId;
  name: string;
  description: string;
  effects: Effect[];
  autoApply: boolean;
  maxStacks?: number;
  price?: ResourceAmount[];
  tags?: TagPath[];
  attachment?: EnhancementAttachment;
  irreversible?: boolean;
  addsFunctionalities?: SpotFunctionalityDef[];
  affectorPackIds?: AffectorPackRef[];
  revealTriggers?: RevealTrigger[];
  extra?: ExtraCompound;
}

export type EnhancementRevealCondition = Condition | ConditionGroup;
