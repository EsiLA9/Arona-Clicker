import type { OperationActionEffectDef } from './operation-action';

/** Finite, resolver-supplied Student skill rule. It contains no executable callback or AC PlayerCost. */
export interface OperationStudentSkillRuleDef {
  readonly id: string;
  /** Evaluated against the student's submitted Action after intervention and before Combination consumption. */
  readonly triggerActionIds: readonly string[];
  /** Integer basis points in the closed range [0, 10000]. */
  readonly chanceBps: number;
  /** Inline, finite local effect result; this is not a general Operation Outcome definition. */
  readonly effects: readonly OperationActionEffectDef[];
}
