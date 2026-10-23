import type { Character } from '../../types/ids';
import type { OperationEventDef } from './operation';
import type { OperationCardPoolDef, OperationStrategyProfileDef } from '../../../data-services/contracts/operation';
import type { StudentOperationProfileDef } from './student-operation-profile';
import type { OperationActionDef } from './operation-action';
import type { OperationStudentSkillRuleDef } from './operation-skill';
export type { OperationParticipantSpec } from '../../../data-services/contracts/operation';

export type OperationParticipantKind = 'student' | 'opponent' | 'environment';

export interface OperationStudentParticipant {
  readonly actorId: string;
  readonly kind: 'student';
  readonly characterId: Character;
  /** Actual held roster Variant used to establish the Character admission. */
  readonly variantId: string;
  readonly displayName?: string;
  readonly avatarRef?: string | null;
  readonly profileId: string;
}

export interface OperationNonStudentParticipant {
  readonly actorId: string;
  readonly kind: 'opponent' | 'environment';
  readonly factionId?: string;
  readonly candidateActionIds: readonly string[];
}

export type OperationAdmittedParticipant =
  | OperationStudentParticipant
  | OperationNonStudentParticipant;

/** Validated, detached input for U2 student Profile and U3 non-student candidate projections. */
export interface OperationAdmission {
  readonly eventDefinition: OperationEventDef;
  readonly participants: readonly OperationAdmittedParticipant[];
  readonly studentProfiles: readonly StudentOperationProfileDef[];
  readonly actionDefinitions: readonly OperationActionDef[];
  readonly studentSkillRules: readonly OperationStudentSkillRuleDef[];
  /** Present on standard Admission; optional only for low-level legacy test fixtures. */
  readonly operationCardPools?: readonly OperationCardPoolDef[];
  /** Present on standard Admission; optional only for low-level legacy test fixtures. */
  readonly operationStrategyProfiles?: readonly OperationStrategyProfileDef[];
}
