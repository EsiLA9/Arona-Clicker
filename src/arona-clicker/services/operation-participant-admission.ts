import type { Character } from '../types/ids';
import type { PlayerState } from '../types/state';
import type { OperationAdmission, OperationAdmittedParticipant, OperationParticipantSpec } from '../contracts/operation-participant';
import type { OperationContentResolver, OperationResolvedContent } from '../contracts/operation-content-resolver';
import type { StudentOperationProfileDef } from '../contracts/student-operation-profile';
import type { CharacterSystem } from './character-system';
import type { RosterSystem } from './roster-system';
import { validateOperationEventDef } from './operation-definition-validation';
import { validateOperationActionContent } from './operation-action-content-validation';
import type { OperationActionDef } from '../contracts/operation-action';
import type { OperationStudentSkillRuleDef } from '../contracts/operation-skill';

export class OperationAdmissionError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'OperationAdmissionError';
  }
}

export interface OperationParticipantAdmissionDependencies {
  readonly resolver: OperationContentResolver;
  readonly characterSystem?: CharacterSystem;
  readonly rosterSystem?: RosterSystem;
  readonly getState?: () => PlayerState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

function cloneFreeze<T>(value: T): T {
  const cloned = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) return;
    Object.freeze(item);
    for (const child of Object.values(item as Record<string, unknown>)) freeze(child);
  };
  freeze(cloned);
  return cloned;
}

function readParticipants(value: unknown, issues: string[]): OperationParticipantSpec[] {
  if (!Array.isArray(value)) {
    issues.push('participants must be an array');
    return [];
  }
  const result: OperationParticipantSpec[] = [];
  const ids = new Set<string>();
  value.forEach((raw, index) => {
    const path = 'participants[' + index + ']';
    if (!isRecord(raw) || !isNonEmptyId(raw.actorId)) {
      issues.push(path + '.actorId must be a non-empty ID');
      return;
    }
    if (ids.has(raw.actorId)) issues.push('participants contains duplicate actorId: ' + raw.actorId);
    ids.add(raw.actorId);
    if (raw.kind === 'student') {
      for (const field of Object.keys(raw)) {
        if (!['actorId', 'kind', 'profileId'].includes(field)) {
          issues.push(path + ' contains unsupported student participant field: ' + field);
        }
      }
      if (raw.profileId !== undefined && !isNonEmptyId(raw.profileId)) {
        issues.push(path + '.profileId must be a non-empty ID when supplied');
      }
      if (raw.characterId !== undefined || raw.variantId !== undefined) {
        issues.push(path + ' must not pin player-owned Character or Variant state');
      }
      result.push({ actorId: raw.actorId, kind: 'student', ...(isNonEmptyId(raw.profileId) ? { profileId: raw.profileId } : {}) });
    } else if (raw.kind === 'opponent' || raw.kind === 'environment') {
      for (const field of Object.keys(raw)) {
        if (!['actorId', 'kind', 'factionId', 'candidateActionIds'].includes(field)) {
          issues.push(path + ' contains unsupported non-student participant field: ' + field);
        }
      }
      if (raw.factionId !== undefined && !isNonEmptyId(raw.factionId)) {
        issues.push(path + '.factionId must be a non-empty ID when supplied');
      }
      if (raw.profileId !== undefined || raw.characterId !== undefined || raw.variantId !== undefined) {
        issues.push(path + ' non-student participants must not reference Character, Variant, or student Profile');
      }
      const rawCandidates = raw.candidateActionIds;
      const candidateActionIds: string[] = [];
      if (!Array.isArray(rawCandidates)) {
        issues.push(path + '.candidateActionIds must be an array of Action IDs');
      } else {
        const candidateIds = new Set<string>();
        rawCandidates.forEach((actionId, candidateIndex) => {
          if (!isNonEmptyId(actionId)) {
            issues.push(path + '.candidateActionIds[' + candidateIndex + '] must be a non-empty Action ID');
          } else if (candidateIds.has(actionId)) {
            issues.push(path + '.candidateActionIds contains duplicate Action ID: ' + actionId);
          } else {
            candidateIds.add(actionId);
            candidateActionIds.push(actionId);
          }
        });
      }
      result.push({
        actorId: raw.actorId,
        kind: raw.kind,
        ...(isNonEmptyId(raw.factionId) ? { factionId: raw.factionId } : {}),
        candidateActionIds,
      });
    } else {
      issues.push(path + '.kind must be student, opponent, or environment');
    }
  });
  return result;
}

function validateProfile(value: unknown, path: string, issues: string[]): StudentOperationProfileDef | null {
  if (!isRecord(value) || !isNonEmptyId(value.id) || !isNonEmptyId(value.characterId)) {
    issues.push(path + ' must define non-empty id and characterId');
    return null;
  }
  const readIds = (field: string): string[] => {
    const raw = value[field];
    if (!Array.isArray(raw)) {
      issues.push(path + '.' + field + ' must be an array of IDs');
      return [];
    }
    const ids: string[] = [];
    const seen = new Set<string>();
    raw.forEach((id, index) => {
      if (!isNonEmptyId(id)) issues.push(path + '.' + field + '[' + index + '] must be a non-empty ID');
      else if (seen.has(id)) issues.push(path + '.' + field + ' contains duplicate ID: ' + id);
      else {
        seen.add(id);
        ids.push(id);
      }
    });
    return ids;
  };
  const candidateActionIds = readIds('candidateActionIds');
  const actionPriorityIds = readIds('actionPriorityIds');
  const capabilityIds = readIds('capabilityIds');
  const reasonIds = readIds('reasonIds');
  for (const actionId of actionPriorityIds) {
    if (!candidateActionIds.includes(actionId)) issues.push(path + '.actionPriorityIds contains an action outside candidateActionIds: ' + actionId);
  }
  if (value.randomSkillRuleId !== undefined && !isNonEmptyId(value.randomSkillRuleId)) {
    issues.push(path + '.randomSkillRuleId must be a non-empty rule reference');
  }
  const allowed = new Set(['id', 'characterId', 'candidateActionIds', 'actionPriorityIds', 'capabilityIds', 'reasonIds', 'randomSkillRuleId']);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) issues.push(path + ' contains unsupported runtime/payment field ' + field);
  }
  return {
    id: value.id,
    characterId: value.characterId as Character,
    candidateActionIds,
    actionPriorityIds,
    capabilityIds,
    reasonIds,
    ...(isNonEmptyId(value.randomSkillRuleId) ? { randomSkillRuleId: value.randomSkillRuleId } : {}),
  };
}

function parseProfiles(value: unknown, issues: string[]): StudentOperationProfileDef[] {
  if (!Array.isArray(value)) {
    issues.push('studentProfiles must be an array');
    return [];
  }
  const result: StudentOperationProfileDef[] = [];
  const profileIds = new Set<string>();
  value.forEach((profile, index) => {
    const parsed = validateProfile(profile, 'studentProfiles[' + index + ']', issues);
    if (!parsed) return;
    if (profileIds.has(parsed.id)) issues.push('studentProfiles contains duplicate profile ID: ' + parsed.id);
    profileIds.add(parsed.id);
    result.push(parsed);
  });
  return result;
}

function checkEventParticipantShape(actorDefinitions: unknown, participants: readonly OperationParticipantSpec[], issues: string[]): void {
  if (!Array.isArray(actorDefinitions)) {
    issues.push('eventDefinition.actors must be an array');
    return;
  }
  const actorIds = new Set<string>();
  for (const [index, actor] of actorDefinitions.entries()) {
    if (!isRecord(actor) || !isNonEmptyId(actor.id)) {
      issues.push('eventDefinition.actors[' + index + '].id must be a non-empty ID');
      continue;
    }
    if (actorIds.has(actor.id)) issues.push('eventDefinition.actors contains duplicate actor ID: ' + actor.id);
    actorIds.add(actor.id);
  }
  const participantIds = new Set(participants.map(participant => participant.actorId));
  for (const id of actorIds) if (!participantIds.has(id)) issues.push('participants are missing actor ID: ' + id);
  for (const id of participantIds) if (!actorIds.has(id)) issues.push('participants reference undeclared actor ID: ' + id);
}

function readResolvedContent(
  value: unknown,
  requestedEventId: string,
  issues: string[],
): {
  readonly content: OperationResolvedContent;
  readonly participants: readonly OperationParticipantSpec[];
  readonly profiles: readonly StudentOperationProfileDef[];
  readonly actionDefinitions: readonly OperationActionDef[];
  readonly studentSkillRules: readonly OperationStudentSkillRuleDef[];
} | null {
  if (!isRecord(value)) {
    issues.push('resolver returned no content for eventId: ' + requestedEventId);
    return null;
  }
  if (!isRecord(value.eventDefinition)) {
    issues.push('resolver content must include eventDefinition');
    return null;
  }
  if (value.eventDefinition.id !== requestedEventId) {
    issues.push('resolver event ID mismatch: requested ' + requestedEventId + ' but received ' + String(value.eventDefinition.id));
  }
  const eventIssues = validateOperationEventDef(value.eventDefinition as unknown as import('../contracts/operation').OperationEventDef);
  issues.push(...eventIssues.map(issue => 'eventDefinition: ' + issue));
  const participants = readParticipants(value.participants, issues);
  const profiles = parseProfiles(value.studentProfiles, issues);
  checkEventParticipantShape(value.eventDefinition.actors, participants, issues);
  const actionContent = validateOperationActionContent(
    value.eventDefinition as unknown as import('../contracts/operation').OperationEventDef,
    value.actionDefinitions,
    value.studentSkillRules,
    profiles,
    participants
      .filter((participant): participant is Extract<OperationParticipantSpec, { kind: 'opponent' | 'environment' }> => participant.kind !== 'student')
      .map(participant => ({
        actorId: participant.actorId,
        participantKind: participant.kind,
        candidateActionIds: participant.candidateActionIds,
      })),
  );
  issues.push(...actionContent.issues);
  return {
    content: value as unknown as OperationResolvedContent,
    participants,
    profiles,
    actionDefinitions: actionContent.actionDefinitions,
    studentSkillRules: actionContent.studentSkillRules,
  };
}

interface StudentOperationProfileIndexes {
  readonly byId: ReadonlyMap<string, readonly StudentOperationProfileDef[]>;
  readonly byCharacterId: ReadonlyMap<Character, readonly StudentOperationProfileDef[]>;
}

function indexStudentProfiles(profiles: readonly StudentOperationProfileDef[]): StudentOperationProfileIndexes {
  const byId = new Map<string, StudentOperationProfileDef[]>();
  const byCharacterId = new Map<Character, StudentOperationProfileDef[]>();
  for (const profile of profiles) {
    const idGroup = byId.get(profile.id) ?? [];
    idGroup.push(profile);
    byId.set(profile.id, idGroup);
    const characterGroup = byCharacterId.get(profile.characterId) ?? [];
    characterGroup.push(profile);
    byCharacterId.set(profile.characterId, characterGroup);
  }
  return { byId, byCharacterId };
}

function resolveStudentProfile(
  participant: OperationParticipantSpec & { readonly kind: 'student' },
  characterId: Character,
  profiles: StudentOperationProfileIndexes,
  characters: CharacterSystem,
  issues: string[],
): StudentOperationProfileDef | null {
  const matchingId = participant.profileId === undefined
    ? profiles.byCharacterId.get(characterId) ?? []
    : profiles.byId.get(participant.profileId) ?? [];
  if (matchingId.length === 0) {
    issues.push(participant.profileId
      ? 'student participant ' + participant.actorId + ' references missing Profile ' + participant.profileId
      : 'no StudentOperationProfile exists for Character ' + characterId);
    return null;
  }
  if (matchingId.length > 1) {
    issues.push(participant.profileId
      ? 'student participant ' + participant.actorId + ' resolves duplicate Profile ID ' + participant.profileId
      : 'multiple StudentOperationProfiles exist for Character ' + characterId);
    return null;
  }
  const profile = matchingId[0];
  if (profile.characterId !== characterId) {
    issues.push('Profile ' + profile.id + ' Character mismatch: selected ' + characterId + ' but Profile declares ' + profile.characterId);
    return null;
  }
  if (!characters.exists(profile.characterId)) {
    issues.push('Profile ' + profile.id + ' references unknown Character ' + profile.characterId);
    return null;
  }
  return profile;
}

function indexOwnedVariantsByCharacter(
  state: PlayerState,
  roster: RosterSystem,
): ReadonlyMap<Character, string> {
  const variantsByCharacter = new Map<Character, string>();
  for (const variantId of Object.keys(state.roster ?? {}).sort()) {
    const progress = roster.getOwned(state, variantId);
    if (!progress) continue;
    const variant = roster.getVariant(variantId);
    if (!variant || !isNonEmptyId(variant.proto) || variantsByCharacter.has(variant.proto as Character)) continue;
    variantsByCharacter.set(variant.proto as Character, variant.id);
  }
  return variantsByCharacter;
}

/** Resolves trusted content and AC ownership before any EventRun owner call. */
export class OperationParticipantAdmission {
  constructor(private readonly dependencies: OperationParticipantAdmissionDependencies) {}

  admit(eventId: string, characterIds: readonly Character[]): OperationAdmission {
    const issues: string[] = [];
    if (!isNonEmptyId(eventId)) throw new OperationAdmissionError(['eventId must be a non-empty stable ID']);
    if (!Array.isArray(characterIds)) throw new OperationAdmissionError(['characterIds must be an array']);

    let resolved: OperationResolvedContent | null;
    try {
      resolved = this.dependencies.resolver.resolve(eventId);
    } catch (error) {
      const detail = error instanceof Error && error.message ? ': ' + error.message : '';
      throw new OperationAdmissionError(['operation content resolver failed for eventId ' + eventId + detail]);
    }

    let parsed: ReturnType<typeof readResolvedContent>;
    try {
      parsed = readResolvedContent(resolved, eventId, issues);
    } catch (error) {
      const detail = error instanceof Error && error.message ? ': ' + error.message : '';
      throw new OperationAdmissionError(['operation content is malformed or unreadable for eventId ' + eventId + detail]);
    }
    if (!parsed) throw new OperationAdmissionError(issues);
    const { content, participants, profiles, actionDefinitions, studentSkillRules } = parsed;
    const profileIndexes = indexStudentProfiles(profiles);
    const currentState = this.dependencies.getState?.();
    const requiredInitId = content.eventDefinition.initId;
    if (requiredInitId !== undefined) {
      if (!currentState) issues.push('Operation Event requires current Init context: ' + requiredInitId);
      else if (currentState.activeInit !== requiredInitId) {
        issues.push('Operation Event ' + eventId + ' belongs to Init ' + requiredInitId + ', current Init is ' + currentState.activeInit);
      }
    }

    const studentSlots = participants.filter((participant): participant is Extract<OperationParticipantSpec, { kind: 'student' }> => participant.kind === 'student');
    if (studentSlots.length !== characterIds.length) {
      issues.push('student participant slot count ' + studentSlots.length + ' does not match selected Character count ' + characterIds.length);
    }
    const characters = this.dependencies.characterSystem;
    const roster = this.dependencies.rosterSystem;
    const unlockedIds = new Set<string>();
    const ownedVariantIds = new Map<Character, string>();
    const admissionCount = Math.min(studentSlots.length, characterIds.length);
    if (admissionCount > 0) {
      if (!characters || !roster || !currentState) {
        throw new OperationAdmissionError(['operation entry is unavailable because Character/Roster services are not wired']);
      }
      for (const character of characters.getUnlocked(currentState)) unlockedIds.add(character.id);
      for (const [characterId, variantId] of indexOwnedVariantsByCharacter(currentState, roster)) {
        ownedVariantIds.set(characterId, variantId);
      }
    }
    const seenCharacters = new Set<string>();
    const admittedByActorId = new Map<string, OperationAdmittedParticipant>();
    const profilesByActorId = new Map<string, StudentOperationProfileDef>();
    const count = admissionCount;

    for (let index = 0; index < count; index++) {
      if (!characters) {
        issues.push('operation entry is unavailable because Character services are not wired');
        continue;
      }
      const characterId = characterIds[index];
      const slot = studentSlots[index];
      if (!isNonEmptyId(characterId)) {
        issues.push('characterIds[' + index + '] must be a non-empty Character ID');
        continue;
      }
      if (seenCharacters.has(characterId)) {
        issues.push('characterIds contains duplicate Character ID: ' + characterId);
        continue;
      }
      seenCharacters.add(characterId);
      if (!characters.exists(characterId as Character) || characterId === 'none') {
        issues.push('unknown or invalid Character ID: ' + characterId);
        continue;
      }
      const ownedVariantId = ownedVariantIds.get(characterId as Character);
      if (!ownedVariantId) {
        issues.push('Character ' + characterId + ' has no owned Registry Variant with matching proto');
        continue;
      }
      if (!unlockedIds.has(characterId as Character)) {
        issues.push('Character ' + characterId + ' is not unlocked by the current roster');
        continue;
      }
      if (!slot) continue;
      const profile = resolveStudentProfile(slot, characterId as Character, profileIndexes, characters, issues);
      if (!profile) continue;
      admittedByActorId.set(slot.actorId, { actorId: slot.actorId, kind: 'student', characterId: characterId as Character, variantId: ownedVariantId, profileId: profile.id });
      profilesByActorId.set(slot.actorId, profile);
    }

    const admitted: OperationAdmittedParticipant[] = [];
    const selectedProfiles: StudentOperationProfileDef[] = [];
    for (const participant of participants) {
      if (participant.kind === 'student') {
        const admittedStudent = admittedByActorId.get(participant.actorId);
        const selectedProfile = profilesByActorId.get(participant.actorId);
        if (admittedStudent && selectedProfile) {
          admitted.push(admittedStudent);
          selectedProfiles.push(selectedProfile);
        }
      } else {
        admitted.push(participant);
      }
    }
    if (admitted.length !== participants.length) issues.push('one or more participants could not be admitted');
    if (issues.length > 0) throw new OperationAdmissionError(issues);

    try {
      return cloneFreeze({
        eventDefinition: content.eventDefinition,
        participants: admitted,
        studentProfiles: selectedProfiles,
        actionDefinitions,
        studentSkillRules,
      });
    } catch {
      throw new OperationAdmissionError(['resolved Operation content must contain only cloneable data']);
    }
  }
}
