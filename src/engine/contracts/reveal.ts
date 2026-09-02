import type { Condition, ConditionGroup } from '../types/expression';

export type RevealStage =
  | 'invisible'
  | 'presence'
  | 'partial'
  | 'known'
  | 'utility'
  | 'purchaseable'
  | 'owned';

export type RevealTarget = 'existence' | 'name' | 'condition' | 'utility' | 'unlock';

export interface RevealTrigger {
  reveal: RevealTarget;
  condition?: Condition | ConditionGroup;
}

export type AccessStage = 'hidden' | 'obfuscated' | 'revealed' | 'accessible' | 'active';

export interface RevealRegistryEntry {
  readonly revealTriggers?: readonly RevealTrigger[];
}

/** 可见性引擎读取数据包揭示声明所需的最小只读索引。 */
export interface RevealRegistryContext {
  readonly inits: ReadonlyMap<string, RevealRegistryEntry>;
  readonly areas: ReadonlyMap<string, RevealRegistryEntry>;
  readonly spots: ReadonlyMap<string, RevealRegistryEntry>;
  readonly enhancements: ReadonlyMap<string, RevealRegistryEntry>;
  readonly items: ReadonlyMap<string, RevealRegistryEntry>;
  readonly storyEntries: ReadonlyMap<string, RevealRegistryEntry>;
  readonly activeStories: ReadonlyMap<string, RevealRegistryEntry>;
  readonly passiveStories: ReadonlyMap<string, RevealRegistryEntry>;
}

/** VisibilityEngine 产生的只读可见性结果，不属于 PlayerState。 */
export interface VisibilitySnapshot {
  inits: Record<string, boolean>;
  areas: Record<string, boolean>;
  spots: Record<string, boolean>;
  enhancements: Record<string, boolean>;
  items: Record<string, boolean>;
  stories: Record<string, boolean>;
}
