import type { Character } from '../types/ids';

/** Event-scoped student capabilities and action preferences; contains references, not executable rules. */
export interface StudentOperationProfileDef {
  readonly id: string;
  readonly characterId: Character;
  /** Candidate actions this student can prepare. */
  readonly candidateActionIds: readonly string[];
  /** Stable preference order applied within the candidate set. */
  readonly actionPriorityIds: readonly string[];
  /** Event-scoped capabilities that may unlock additional legal plans. */
  readonly capabilityIds: readonly string[];
  /** Stable reason keys explaining the profile's contributions. */
  readonly reasonIds: readonly string[];
  /** Optional Commit-time rule reference; execution is owned by Task 0215. */
  readonly randomSkillRuleId?: string;
}
