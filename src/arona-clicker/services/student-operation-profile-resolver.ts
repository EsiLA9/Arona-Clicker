import {
  OPERATION_NO_ELIGIBLE_ACTION_REASON_ID,
  OPERATION_WAIT_ACTION_ID,
  type OperationActionCandidateSnapshot,
  type OperationActorInitialization,
  type OperationRunStartInput,
  type OperationStudentProfileSnapshot,
} from '../contracts/operation';
import type { OperationAdmission, OperationAdmittedParticipant } from '../contracts/operation-participant';
import type { StudentOperationProfileDef } from '../contracts/student-operation-profile';

export class StudentOperationProfileResolutionError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'StudentOperationProfileResolutionError';
  }
}

function fail(message: string): never {
  throw new StudentOperationProfileResolutionError([message]);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
  }
  return value;
}

function snapshotProfile(
  participant: Extract<OperationAdmittedParticipant, { kind: 'student' }>,
  profile: StudentOperationProfileDef,
  requirements: ReadonlyMap<string, { readonly requiredCapabilityIds: readonly string[]; readonly reasonIds: readonly string[] }>,
): OperationStudentProfileSnapshot {
  if (profile.characterId !== participant.characterId) {
    fail('Profile ' + profile.id + ' Character mismatch for actor ' + participant.actorId);
  }

  const declaredCandidateIds = new Set(profile.candidateActionIds);
  if (declaredCandidateIds.has(OPERATION_WAIT_ACTION_ID)) {
    fail('Profile ' + profile.id + ' uses the reserved Wait fallback action ID as a candidate');
  }
  const eventCandidateIds = new Set([...declaredCandidateIds].filter(actionId => requirements.has(actionId)));
  const prioritizedIds = profile.actionPriorityIds.filter(actionId => eventCandidateIds.has(actionId));
  const prioritizedSet = new Set(prioritizedIds);
  const orderedIds = [
    ...prioritizedIds,
    ...profile.candidateActionIds.filter(actionId => eventCandidateIds.has(actionId) && !prioritizedSet.has(actionId)),
  ];
  const capabilities = new Set(profile.capabilityIds);

  const actionCandidates: OperationActionCandidateSnapshot[] = orderedIds.map(actionId => {
    const requirement = requirements.get(actionId)!;
    const missingCapabilityIds = requirement.requiredCapabilityIds.filter(id => !capabilities.has(id));
    return {
      actionId,
      eligible: missingCapabilityIds.length === 0,
      requiredCapabilityIds: [...requirement.requiredCapabilityIds],
      missingCapabilityIds,
      reasonIds: unique([...profile.reasonIds, ...requirement.reasonIds]),
    };
  });
  const eligibleActionIds = actionCandidates.filter(candidate => candidate.eligible).map(candidate => candidate.actionId);
  const base: OperationStudentProfileSnapshot = {
    id: profile.id,
    characterId: profile.characterId,
    candidateActionIds: [...profile.candidateActionIds],
    actionPriorityIds: [...profile.actionPriorityIds],
    capabilityIds: [...profile.capabilityIds],
    reasonIds: [...profile.reasonIds],
    actionCandidates,
    eligibleActionIds,
    ...(eligibleActionIds.length === 0
      ? {
          fallback: {
            actionId: OPERATION_WAIT_ACTION_ID,
            reasonIds: [OPERATION_NO_ELIGIBLE_ACTION_REASON_ID] as const,
          },
        }
      : {}),
    ...(profile.randomSkillRuleId ? { randomSkillRuleId: profile.randomSkillRuleId } : {}),
  };
  return freezeTree(base);
}

function ensureUniqueBy<T>(values: readonly T[], idOf: (value: T) => string, label: string): Map<string, T> {
  const index = new Map<string, T>();
  for (const value of values) {
    const id = idOf(value);
    if (index.has(id)) fail('duplicate ' + label + ' ID: ' + id);
    index.set(id, value);
  }
  return index;
}

/**
 * Converts the already-admitted U1 DTO into one detached Actor/Profile initialization.
 * Actions are only qualified and ordered here; target, cost, effect, and resolution belong to 0215.
 */
export function resolveOperationRunStart(admission: OperationAdmission): OperationRunStartInput {
  const event = admission.eventDefinition;
  const participantsByActorId = ensureUniqueBy(admission.participants, value => value.actorId, 'participant actor');
  const profilesById = ensureUniqueBy(admission.studentProfiles, value => value.id, 'student Profile');
  const requirements = new Map((event.actionRequirements ?? []).map(requirement => [requirement.actionId, requirement]));
  const eventActorIds = new Set(event.actors.map(actor => actor.id));

  for (const actorId of participantsByActorId.keys()) {
    if (!eventActorIds.has(actorId)) fail('participant references missing Event actor: ' + actorId);
  }
  if (participantsByActorId.size !== eventActorIds.size) {
    for (const actorId of eventActorIds) {
      if (!participantsByActorId.has(actorId)) fail('Event actor has no admitted participant: ' + actorId);
    }
  }

  const actors: OperationActorInitialization[] = event.actors.map(actor => {
    const participant = participantsByActorId.get(actor.id);
    if (!participant) fail('Event actor has no admitted participant: ' + actor.id);
    if (participant.kind !== 'student') {
      return {
        actorId: actor.id,
        participantKind: participant.kind,
        ...(participant.factionId ? { factionId: participant.factionId } : {}),
      };
    }

    const profile = profilesById.get(participant.profileId);
    if (!profile) fail('student participant references missing Profile: ' + participant.profileId);
    return {
      actorId: actor.id,
      participantKind: 'student',
      characterId: participant.characterId,
      profile: snapshotProfile(participant, profile, requirements),
    };
  });

  const selectedProfileIds = new Set(
    admission.participants
      .filter((participant): participant is Extract<OperationAdmittedParticipant, { kind: 'student' }> => participant.kind === 'student')
      .map(participant => participant.profileId),
  );
  if (selectedProfileIds.size !== profilesById.size) fail('Admission contains an unselected or duplicate student Profile');

  return freezeTree({ eventDefinition: event, actors });
}
