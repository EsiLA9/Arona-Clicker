import type { Character } from '../types/ids';
import type { OperationEventDef } from './operation';
import type { StudentOperationProfileDef } from './student-operation-profile';
import type { OperationActionDef } from './operation-action';
import type { OperationStudentSkillRuleDef } from './operation-skill';

export type OperationParticipantKind = 'student' | 'opponent' | 'environment';

/** Definition-level participant slot associated with one OperationActorDef ID. */
export type OperationParticipantSpec =
  | {
      readonly actorId: string;
      readonly kind: 'student';
      /** Optional content pin; if present it must resolve to the selected Character. */
      readonly profileId?: string;
    }
  | {
      readonly actorId: string;
      readonly kind: 'opponent' | 'environment';
      readonly factionId?: string;
    };

export interface OperationStudentParticipant {
  readonly actorId: string;
  readonly kind: 'student';
  readonly characterId: Character;
  /** Actual held roster Variant used to establish the Character admission. */
  readonly variantId: string;
  readonly profileId: string;
}

export interface OperationNonStudentParticipant {
  readonly actorId: string;
  readonly kind: 'opponent' | 'environment';
  readonly factionId?: string;
}

export type OperationAdmittedParticipant =
  | OperationStudentParticipant
  | OperationNonStudentParticipant;

/** Validated, detached input retained as the hand-off point for U2 Actor/Profile snapshots. */
export interface OperationAdmission {
  readonly eventDefinition: OperationEventDef;
  readonly participants: readonly OperationAdmittedParticipant[];
  readonly studentProfiles: readonly StudentOperationProfileDef[];
  readonly actionDefinitions: readonly OperationActionDef[];
  readonly studentSkillRules: readonly OperationStudentSkillRuleDef[];
}
