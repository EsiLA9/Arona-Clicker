import type { TagPath } from '../../engine/core/tag';
import type { ConditionGroup } from '../../engine/types/expression';

export interface PassivePoolChild { id: string; weight?: number; cooldownFrames?: number; }
export interface PassivePoolDef {
  id: string; name?: string; tags?: TagPath[]; condition?: ConditionGroup; owner?: string;
  cooldownFrames?: number; children: PassivePoolChild[];
}
