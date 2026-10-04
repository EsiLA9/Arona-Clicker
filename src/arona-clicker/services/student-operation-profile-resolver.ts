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
import type { OperationActionDef } from '../contracts/operation-action';
import { validateOperationActorInitializations } from './operation-definition-validation';
import { validateOperationActionActorReferences, validateOperationActionContent } from './operation-action-content-validation';

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
  actionDefinitions: ReadonlyMap<string, OperationActionDef>,
): OperationStudentProfileSnapshot {
  if (profile.characterId !== participant.characterId) {
    fail('Profile ' + profile.id + ' Character mismatch for actor ' + participant.actorId);
  }

  const declaredCandidateIds = new Set(profile.candidateActionIds);
  if (declaredCandidateIds.has(OPERATION_WAIT_ACTION_ID)) {
    fail('Profile ' + profile.id + ' uses the reserved Wait fallback action ID as a candidate');
  }
  for (const actionId of declaredCandidateIds) {
    const action = actionDefinitions.get(actionId);
    if (!action) fail('Profile ' + profile.id + ' references missing Action ' + actionId);
    if (!action.allowedParticipantKinds.includes('student')) {
      fail('Profile ' + profile.id + ' references Action that does not allow student participants: ' + actionId);
    }
  }
  const prioritizedIds = profile.actionPriorityIds.filter(actionId => declaredCandidateIds.has(actionId));
  const prioritizedSet = new Set(prioritizedIds);
  const orderedIds = [
    ...prioritizedIds,
    ...profile.candidateActionIds.filter(actionId => !prioritizedSet.has(actionId)),
  ];
  const capabilities = new Set(profile.capabilityIds);

  const actionCandidates: OperationActionCandidateSnapshot[] = orderedIds.map(actionId => {
    const action = actionDefinitions.get(actionId)!;
    const missingCapabilityIds = action.requiredCapabilityIds.filter(id => !capabilities.has(id));
    return {
      actionId,
      eligible: missingCapabilityIds.length === 0,
      requiredCapabilityIds: [...action.requiredCapabilityIds],
      missingCapabilityIds,
      reasonIds: unique([...profile.reasonIds, ...action.reasonIds]),
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
  const actionDefinitions = ensureUniqueBy(admission.actionDefinitions, value => value.id, 'Action');
  ensureUniqueBy(admission.studentSkillRules, value => value.id, 'Student Skill Rule');
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
      profile: snapshotProfile(participant, profile, actionDefinitions),
    };
  });

  const selectedProfileIds = new Set(
    admission.participants
      .filter((participant): participant is Extract<OperationAdmittedParticipant, { kind: 'student' }> => participant.kind === 'student')
      .map(participant => participant.profileId),
  );
  if (selectedProfileIds.size !== profilesById.size) fail('Admission contains an unselected or duplicate student Profile');

  const runStart: OperationRunStartInput = {
    eventDefinition: event,
    actors,
    actionDefinitions: [...admission.actionDefinitions],
    studentSkillRules: [...admission.studentSkillRules],
  };
  const initializationIssues = validateOperationActorInitializations(
    event,
    actors,
    runStart.actionDefinitions,
    runStart.studentSkillRules,
  );
  if (initializationIssues.length > 0) throw new StudentOperationProfileResolutionError(initializationIssues);
  const profileReferences = actors.flatMap(actor => actor.participantKind === 'student' ? [actor.profile] : []);
  const content = validateOperationActionContent(
    event,
    runStart.actionDefinitions,
    runStart.studentSkillRules,
    profileReferences,
  );
  if (content.issues.length > 0) throw new StudentOperationProfileResolutionError(content.issues);
  const actorReferenceIssues = validateOperationActionActorReferences(
    event,
    content.actionDefinitions,
    content.studentSkillRules,
    actors,
  );
  if (actorReferenceIssues.length > 0) throw new StudentOperationProfileResolutionError(actorReferenceIssues);
  return freezeTree(runStart);
}
