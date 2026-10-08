import {
  OPERATION_NO_ELIGIBLE_ACTION_REASON_ID,
  OPERATION_WAIT_ACTION_ID,
  type OperationActionCandidateSnapshot,
  type OperationActorInitialization,
  type EventRun,
  type OperationRunStartInput,
  type OperationStudentProfileSnapshot,
} from '../contracts/operation';
import type { OperationAdmission, OperationAdmittedParticipant, OperationParticipantSpec } from '../contracts/operation-participant';
import type { OperationResolvedContent } from '../contracts/operation-content-resolver';
import type { StudentOperationProfileDef } from '../contracts/student-operation-profile';
import type { OperationActionDef } from '../contracts/operation-action';
import type { OperationCardPoolDef, OperationStrategyProfileDef } from '../../data-services/contracts/operation';
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
  actorId: string,
  characterId: string,
  profile: StudentOperationProfileDef,
  actionDefinitions: ReadonlyMap<string, OperationActionDef>,
  strategyProfiles: ReadonlyMap<string, OperationStrategyProfileDef>,
  cardPools: ReadonlyMap<string, OperationCardPoolDef>,
): OperationStudentProfileSnapshot {
  if (profile.characterId !== characterId) {
    fail('Profile ' + profile.id + ' Character mismatch for actor ' + actorId);
  }

  const declaredCandidateIds = new Set(profile.candidateActionIds);
  if (declaredCandidateIds.has(OPERATION_WAIT_ACTION_ID)) {
    fail('Profile ' + profile.id + ' uses the reserved Wait fallback action ID as a candidate');
  }
  const cardPoolIds = [...(profile.cardPoolIds ?? [])];
  for (const poolId of cardPoolIds) if (!cardPools.has(poolId)) fail('Profile ' + profile.id + ' references missing CardPool ' + poolId);
  const strategyProfile = profile.strategyProfileId ? strategyProfiles.get(profile.strategyProfileId) : undefined;
  if (profile.strategyProfileId && !strategyProfile) fail('Profile ' + profile.id + ' references missing StrategyProfile ' + profile.strategyProfileId);
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
    ...(profile.strategyProfileId ? { strategyProfileId: profile.strategyProfileId } : {}),
    strategyBiases: strategyProfile?.biases.map(bias => ({ ...bias })) ?? [],
    cardPoolIds,
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

function validateRunStart(runStart: OperationRunStartInput): OperationRunStartInput {
  const initializationIssues = validateOperationActorInitializations(
    runStart.eventDefinition,
    runStart.actors,
    runStart.actionDefinitions,
    runStart.studentSkillRules,
  );
  if (initializationIssues.length > 0) throw new StudentOperationProfileResolutionError(initializationIssues);
  const profileReferences = runStart.actors.flatMap(actor => actor.participantKind === 'student' ? [actor.profile] : []);
  const content = validateOperationActionContent(
    runStart.eventDefinition,
    runStart.actionDefinitions,
    runStart.studentSkillRules,
    profileReferences,
    runStart.actors
      .filter((actor): actor is Extract<OperationActorInitialization, { participantKind: 'opponent' | 'environment' }> => actor.participantKind !== 'student')
      .map(actor => ({ actorId: actor.actorId, participantKind: actor.participantKind, candidateActionIds: actor.candidateActionIds })),
  );
  if (content.issues.length > 0) throw new StudentOperationProfileResolutionError(content.issues);
  const actorReferenceIssues = validateOperationActionActorReferences(
    runStart.eventDefinition,
    content.actionDefinitions,
    content.studentSkillRules,
    runStart.actors,
  );
  if (actorReferenceIssues.length > 0) throw new StudentOperationProfileResolutionError(actorReferenceIssues);
  const cardPoolsById = ensureUniqueBy(runStart.operationCardPools ?? [], value => value.id, 'CardPool');
  const strategiesById = ensureUniqueBy(runStart.operationStrategyProfiles ?? [], value => value.id, 'StrategyProfile');
  const usedPoolIds = new Set([
    ...(runStart.eventDefinition.cardPoolIds ?? []),
    ...runStart.eventDefinition.locations.flatMap(location => location.cardPoolIds ?? []),
    ...runStart.actors.flatMap(actor => actor.participantKind === 'student' ? actor.profile.cardPoolIds ?? [] : []),
  ]);
  for (const poolId of usedPoolIds) if (!cardPoolsById.has(poolId)) fail('RunStart content references missing CardPool ' + poolId);
  const actionsById = new Map(runStart.actionDefinitions.map(action => [action.id, action]));
  for (const pool of cardPoolsById.values()) for (const entry of pool.entries) {
    const action = actionsById.get(entry.actionId);
    if (!action) fail('CardPool ' + pool.id + ' references missing Action ' + entry.actionId);
    if (!action.allowedParticipantKinds.includes('student')) fail('CardPool ' + pool.id + ' Action does not allow student participants: ' + entry.actionId);
  }
  for (const actor of runStart.actors) {
    if (actor.participantKind !== 'student') continue;
    if (actor.profile.strategyProfileId) {
      const strategy = strategiesById.get(actor.profile.strategyProfileId);
      if (!strategy) fail('RunStart Profile references missing StrategyProfile ' + actor.profile.strategyProfileId);
      if (JSON.stringify(actor.profile.strategyBiases ?? []) !== JSON.stringify(strategy.biases)) {
        fail('RunStart Profile Strategy snapshot differs from StrategyProfile ' + strategy.id);
      }
    } else if ((actor.profile.strategyBiases ?? []).length > 0) {
      fail('RunStart Profile contains Strategy biases without a StrategyProfile ID: ' + actor.profile.id);
    }
  }
  return freezeTree({
    ...runStart,
    actionDefinitions: [...content.actionDefinitions],
    studentSkillRules: [...content.studentSkillRules],
  });
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
  const strategyProfiles = ensureUniqueBy(admission.operationStrategyProfiles ?? [], value => value.id, 'StrategyProfile');
  const cardPools = ensureUniqueBy(admission.operationCardPools ?? [], value => value.id, 'CardPool');
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
        displayName: actor.displayName ?? actor.type,
        avatarRef: actor.avatarRef ?? null,
        ...(participant.factionId ? { factionId: participant.factionId } : {}),
        candidateActionIds: [...participant.candidateActionIds],
      };
    }

    const profile = profilesById.get(participant.profileId);
    if (!profile) fail('student participant references missing Profile: ' + participant.profileId);
    return {
      actorId: actor.id,
      participantKind: 'student',
      characterId: participant.characterId,
      displayName: participant.displayName ?? actor.displayName ?? actor.type,
      avatarRef: participant.avatarRef ?? actor.avatarRef ?? null,
      profile: snapshotProfile(participant.actorId, participant.characterId, profile, actionDefinitions, strategyProfiles, cardPools),
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
    operationCardPools: [...admission.operationCardPools ?? []],
    operationStrategyProfiles: [...admission.operationStrategyProfiles ?? []],
  };
  return validateRunStart(runStart);
}

/** Rebuilds trusted static rules around the Character/Profile snapshots saved in an EventRun. */
export function resolveOperationRunResume(
  content: OperationResolvedContent,
  run: EventRun,
  characterExists: (characterId: string) => boolean,
): OperationRunStartInput {
  if (!content || content.eventDefinition.id !== run.eventId) fail('restore content does not match saved eventId');
  const event = content.eventDefinition;
  const participantsByActorId = ensureUniqueBy(content.participants, value => value.actorId, 'participant actor');
  const profilesById = ensureUniqueBy(content.studentProfiles, value => value.id, 'student Profile');
  const actionsById = ensureUniqueBy(content.actionDefinitions, value => value.id, 'Action');
  const strategyProfiles = ensureUniqueBy(content.operationStrategyProfiles ?? [], value => value.id, 'StrategyProfile');
  const cardPools = ensureUniqueBy(content.operationCardPools ?? [], value => value.id, 'CardPool');
  ensureUniqueBy(content.studentSkillRules, value => value.id, 'Student Skill Rule');
  const statesByActorId = ensureUniqueBy(run.actorStates, value => value.id, 'saved Actor');
  const actors: OperationActorInitialization[] = event.actors.map(actor => {
    const savedActor = statesByActorId.get(actor.id);
    if (!savedActor) fail('saved Actor is missing: ' + actor.id);
    const participant = participantsByActorId.get(actor.id);
    const saved = statesByActorId.get(actor.id);
    if (!participant || !saved) fail('saved Run is missing participant Actor ' + actor.id);
    if (participant.kind !== saved.participantKind) fail('saved Actor participant kind mismatch: ' + actor.id);
    if (participant.kind !== 'student') {
      return {
        actorId: actor.id,
        participantKind: participant.kind,
        displayName: savedActor.displayName ?? actor.displayName ?? actor.type,
        avatarRef: savedActor.avatarRef ?? actor.avatarRef ?? null,
        ...(participant.factionId ? { factionId: participant.factionId } : {}),
        candidateActionIds: [...participant.candidateActionIds],
      };
    }

    if (!saved.characterId || !characterExists(saved.characterId)) fail('saved Run references unknown Character ' + String(saved.characterId));
    if (!saved.profile || saved.profile.characterId !== saved.characterId) fail('saved Student Profile snapshot is malformed for ' + actor.id);
    if (participant.profileId !== undefined && saved.profile.id !== participant.profileId) {
      fail('saved Student Profile does not match Event participant ' + actor.id);
    }
    const profile = profilesById.get(saved.profile.id);
    if (!profile || profile.characterId !== saved.characterId) fail('saved Run references missing or mismatched StudentOperationProfile ' + saved.profile.id);
    if (participant.profileId === undefined
      && content.studentProfiles.filter(candidate => candidate.characterId === saved.characterId).length !== 1) {
      fail('saved Student Profile is ambiguous for Character ' + saved.characterId);
    }
    const expectedProfile = snapshotProfile(actor.id, saved.characterId, profile, actionsById, strategyProfiles, cardPools);
    if (JSON.stringify(expectedProfile) !== JSON.stringify(saved.profile)) {
      fail('saved Student Profile snapshot differs from current content for Actor ' + actor.id);
    }
    return {
      actorId: actor.id,
      participantKind: 'student',
      characterId: saved.characterId,
      displayName: savedActor.displayName ?? actor.displayName ?? actor.type,
      avatarRef: savedActor.avatarRef ?? actor.avatarRef ?? null,
      profile: saved.profile,
    };
  });

  if (actors.length !== run.actorStates.length) fail('saved Run contains undeclared Actor state');
  for (const actorId of participantsByActorId.keys()) {
    if (!event.actors.some(actor => actor.id === actorId)) fail('current Event content has an undeclared participant Actor ' + actorId);
  }
  const runStart: OperationRunStartInput = {
    eventDefinition: event,
    actors,
    actionDefinitions: [...content.actionDefinitions],
    studentSkillRules: [...content.studentSkillRules],
    operationCardPools: [...content.operationCardPools ?? []],
    operationStrategyProfiles: [...content.operationStrategyProfiles ?? []],
  };
  return validateRunStart(runStart);
}
