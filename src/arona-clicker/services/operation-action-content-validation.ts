import type { OperationActionDef, OperationActionEffectDef } from '../contracts/operation-action';
import type { OperationActorInitialization, OperationActorDef, OperationEventDef } from '../contracts/operation';
import type { OperationStudentSkillRuleDef } from '../contracts/operation-skill';
import {
  isOperationActionDef,
  isOperationStudentSkillRuleDef,
  validateOperationActionDef,
  validateOperationActionEffects,
  validateOperationStudentSkillRuleDef,
} from './operation-tactical-definition-validation';
import { OPERATION_WAIT_ACTION_ID } from '../contracts/operation';

export interface OperationActionProfileReference {
  readonly id: string;
  readonly candidateActionIds: readonly string[];
  readonly capabilityIds: readonly string[];
  readonly randomSkillRuleId?: string;
}

export interface OperationActionParticipantCandidateReference {
  readonly actorId: string;
  readonly participantKind: 'opponent' | 'environment';
  readonly candidateActionIds: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

function indexById<T>(values: readonly T[], idOf: (value: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) if (!result.has(idOf(value))) result.set(idOf(value), value);
  return result;
}

function legalTargetActors(event: OperationEventDef, source: OperationActorDef, action: OperationActionDef): readonly OperationActorDef[] {
  if (action.target.kind !== 'actor') return [];
  switch (action.target.relation) {
    case 'self': return [source];
    case 'sameTeam': return source.teamId ? event.actors.filter(actor => actor.teamId === source.teamId) : [];
    case 'otherTeam': return source.teamId
      ? event.actors.filter(actor => actor.teamId !== undefined && actor.teamId !== source.teamId)
      : [];
    case 'any': return event.actors;
  }
}

function hasActorResource(actor: OperationActorDef, resourceId: string): boolean {
  return Object.prototype.hasOwnProperty.call(actor.resources ?? {}, resourceId);
}

function hasTeamResource(event: OperationEventDef, actor: OperationActorDef, resourceId: string): boolean {
  if (!actor.teamId) return false;
  const team = event.teams?.find(candidate => candidate.id === actor.teamId);
  return team !== undefined && Object.prototype.hasOwnProperty.call(team.resources ?? {}, resourceId);
}

function validateEffectResourceReferences(
  event: OperationEventDef,
  source: OperationActorDef,
  targets: readonly OperationActorDef[],
  hasTarget: boolean,
  effects: readonly OperationActionEffectDef[],
  path: string,
  issues: string[],
): void {
  effects.forEach((effect, index) => {
    const effectPath = path + '.effects[' + index + ']';
    if (effect.kind === 'actorResourceDelta') {
      if (effect.recipient === 'actor') {
        if (!hasActorResource(source, effect.resourceId)) {
          issues.push(effectPath + ' references an undeclared actor resource: ' + effect.resourceId);
        }
      } else if (!hasTarget) {
        issues.push(effectPath + ' targets an Actor but this result has no Actor target');
      } else {
        for (const target of targets) {
          if (!hasActorResource(target, effect.resourceId)) {
            issues.push(effectPath + ' references an undeclared target actor resource: ' + effect.resourceId);
            break;
          }
        }
      }
    } else if (effect.kind === 'teamResourceDelta') {
      if (effect.recipient === 'actorTeam') {
        if (!hasTeamResource(event, source, effect.resourceId)) {
          issues.push(effectPath + ' references an undeclared actor Team resource: ' + effect.resourceId);
        }
      } else if (!hasTarget) {
        issues.push(effectPath + ' targets a Team but this result has no Actor target');
      } else {
        for (const target of targets) {
          if (!hasTeamResource(event, target, effect.resourceId)) {
            issues.push(effectPath + ' references an undeclared target Team resource: ' + effect.resourceId);
            break;
          }
        }
      }
    } else if (effect.kind === 'actorHpDelta' && effect.recipient === 'target' && !hasTarget) {
      issues.push(effectPath + ' targets an Actor but this result has no Actor target');
    }
  });
}

function validateActionResourceReferences(
  event: OperationEventDef,
  source: OperationActorDef,
  action: OperationActionDef,
  path: string,
  issues: string[],
): void {
  if (action.cost) {
    const declared = action.cost.scope === 'actor'
      ? hasActorResource(source, action.cost.resourceId)
      : hasTeamResource(event, source, action.cost.resourceId);
    if (!declared) issues.push(path + '.cost references an undeclared ' + action.cost.scope + ' resource: ' + action.cost.resourceId);
  }

  const targets = legalTargetActors(event, source, action);
  validateEffectResourceReferences(event, source, targets, action.target.kind === 'actor', action.effects, path, issues);
}

/**
 * Validates all resolver-owned Action/Skill definitions and their static Event, Profile,
 * Location, combination, and skill-trigger references before admission succeeds.
 */
export function validateOperationActionContent(
  event: OperationEventDef,
  rawActions: unknown,
  rawSkillRules: unknown,
  profiles: readonly OperationActionProfileReference[],
  nonStudentCandidates: readonly OperationActionParticipantCandidateReference[] = [],
): {
  readonly issues: readonly string[];
  readonly actionDefinitions: readonly OperationActionDef[];
  readonly studentSkillRules: readonly OperationStudentSkillRuleDef[];
} {
  const issues: string[] = [];
  const actionDefinitions: OperationActionDef[] = [];
  const studentSkillRules: OperationStudentSkillRuleDef[] = [];

  if (!Array.isArray(rawActions)) {
    issues.push('actionDefinitions must be an array');
  } else {
    const seen = new Set<string>();
    rawActions.forEach((value, index) => {
      const definitionIssues = validateOperationActionDef(value);
      for (const issue of definitionIssues) issues.push('actionDefinitions[' + index + ']: ' + issue);
      if (isOperationActionDef(value)) {
        if (value.id === OPERATION_WAIT_ACTION_ID) issues.push('actionDefinitions contains the reserved Wait fallback ID');
        if (seen.has(value.id)) issues.push('actionDefinitions contains duplicate Action ID: ' + value.id);
        seen.add(value.id);
        if (definitionIssues.length === 0) actionDefinitions.push(value);
      }
    });
  }

  if (!Array.isArray(rawSkillRules)) {
    issues.push('studentSkillRules must be an array');
  } else {
    const seen = new Set<string>();
    rawSkillRules.forEach((value, index) => {
      const ruleIssues = validateOperationStudentSkillRuleDef(value);
      for (const issue of ruleIssues) issues.push('studentSkillRules[' + index + ']: ' + issue);
      if (isOperationStudentSkillRuleDef(value)) {
        if (seen.has(value.id)) issues.push('studentSkillRules contains duplicate Rule ID: ' + value.id);
        seen.add(value.id);
        if (ruleIssues.length === 0) studentSkillRules.push(value);
      }
    });
  }

  const actionsById = indexById(actionDefinitions, value => value.id);
  const rulesById = indexById(studentSkillRules, value => value.id);
  const trackIds = new Set((Array.isArray(event.tracks) ? event.tracks : [])
    .map(track => track?.id)
    .filter(isNonEmptyId));
  const factIds = new Set(Array.isArray(event.factIds) ? event.factIds.filter(isNonEmptyId) : []);
  const itemIds = new Set(Array.isArray(event.itemIds) ? event.itemIds.filter(isNonEmptyId) : []);

  for (const [index, action] of actionDefinitions.entries()) {
    for (const [effectIndex, effect] of action.effects.entries()) {
      if (effect.kind === 'eventTrackDelta' && !trackIds.has(effect.trackId)) {
        issues.push('actionDefinitions[' + index + '].effects[' + effectIndex + '].trackId references an undeclared track: ' + effect.trackId);
      } else if (effect.kind === 'eventFact' && !factIds.has(effect.factId)) {
        issues.push('actionDefinitions[' + index + '].effects[' + effectIndex + '].factId references an undeclared fact: ' + effect.factId);
      } else if (effect.kind === 'heldItem' && !itemIds.has(effect.itemId)) {
        issues.push('actionDefinitions[' + index + '].effects[' + effectIndex + '].itemId references an undeclared held item: ' + effect.itemId);
      }
    }
  }

  for (const [index, rule] of studentSkillRules.entries()) {
    for (const actionId of rule.triggerActionIds) {
      const action = actionsById.get(actionId);
      if (!action) {
        issues.push('studentSkillRules[' + index + '].triggerActionIds references a missing Action: ' + actionId);
      } else if (!action.allowedParticipantKinds.includes('student')) {
        issues.push('studentSkillRules[' + index + '] trigger Action does not allow student participants: ' + actionId);
      }
    }
    for (const [effectIndex, effect] of rule.effects.entries()) {
      if (effect.kind === 'eventTrackDelta' && !trackIds.has(effect.trackId)) {
        issues.push('studentSkillRules[' + index + '].effects[' + effectIndex + '].trackId references an undeclared track: ' + effect.trackId);
      } else if (effect.kind === 'eventFact' && !factIds.has(effect.factId)) {
        issues.push('studentSkillRules[' + index + '].effects[' + effectIndex + '].factId references an undeclared fact: ' + effect.factId);
      } else if (effect.kind === 'heldItem' && !itemIds.has(effect.itemId)) {
        issues.push('studentSkillRules[' + index + '].effects[' + effectIndex + '].itemId references an undeclared held item: ' + effect.itemId);
      }
    }
  }

  for (const [index, profile] of profiles.entries()) {
    for (const actionId of profile.candidateActionIds) {
      if (actionId === OPERATION_WAIT_ACTION_ID) {
        issues.push('studentProfiles[' + index + '].candidateActionIds contains the reserved Wait fallback action ID');
        continue;
      }
      const action = actionsById.get(actionId);
      if (!action) {
        issues.push('studentProfiles[' + index + '].candidateActionIds references a missing Action: ' + actionId);
      } else if (!action.allowedParticipantKinds.includes('student')) {
        issues.push('studentProfiles[' + index + '] candidate Action does not allow student participants: ' + actionId);
      }
    }
    if (profile.randomSkillRuleId !== undefined) {
      const rule = rulesById.get(profile.randomSkillRuleId);
      if (!rule) {
        issues.push('studentProfiles[' + index + '].randomSkillRuleId references a missing Student Skill Rule: ' + profile.randomSkillRuleId);
      } else if (!rule.triggerActionIds.some(id => {
        if (!profile.candidateActionIds.includes(id)) return false;
        const action = actionsById.get(id);
        return action !== undefined
          && action.allowedParticipantKinds.includes('student')
          && action.requiredCapabilityIds.every(capabilityId => profile.capabilityIds.includes(capabilityId));
      })) {
        issues.push('studentProfiles[' + index + '] Skill Rule has no eligible trigger Action in candidateActionIds');
      }
    }
  }

  for (const participant of nonStudentCandidates) {
    const path = 'participants[' + participant.actorId + ']';
    if (!Array.isArray(participant.candidateActionIds)) {
      issues.push(path + '.candidateActionIds must be an array of Action IDs');
      continue;
    }
    const seen = new Set<string>();
    for (const actionId of participant.candidateActionIds) {
      if (!isNonEmptyId(actionId)) {
        issues.push(path + '.candidateActionIds contains an invalid Action ID');
        continue;
      }
      if (actionId === OPERATION_WAIT_ACTION_ID) {
        issues.push(path + '.candidateActionIds contains the reserved Wait fallback action ID');
        continue;
      }
      if (seen.has(actionId)) {
        issues.push(path + '.candidateActionIds contains duplicate Action ID: ' + actionId);
        continue;
      }
      seen.add(actionId);
      const action = actionsById.get(actionId);
      if (!action) {
        issues.push(path + '.candidateActionIds references a missing Action: ' + actionId);
      } else if (!action.allowedParticipantKinds.includes(participant.participantKind)) {
        issues.push(path + ' candidate Action does not allow ' + participant.participantKind + ' participants: ' + actionId);
      } else if (action.requiredCapabilityIds.length > 0) {
        issues.push(path + ' candidate Action requires student capabilities unavailable to ' + participant.participantKind + ' participants: ' + actionId);
      }
    }
  }

  const locationTactics = Array.isArray(event.locationTactics) ? event.locationTactics : [];
  for (const [locationIndex, tactics] of locationTactics.entries()) {
    if (!isRecord(tactics) || !Array.isArray(tactics.enabledActionIds) || !Array.isArray(tactics.combinationRules)) continue;
    const enabledIds = new Set(tactics.enabledActionIds);
    for (const actionId of tactics.enabledActionIds) {
      if (!actionsById.has(actionId)) {
        issues.push('locationTactics[' + locationIndex + '].enabledActionIds references a missing Action: ' + actionId);
      }
    }
    const enabledStudentActions = [...enabledIds]
      .map(id => actionsById.get(id))
      .filter((action): action is OperationActionDef => action?.allowedParticipantKinds.includes('student') === true);
    for (const [ruleIndex, rule] of tactics.combinationRules.entries()) {
      if (!isRecord(rule) || !Array.isArray(rule.inputTagIds)) continue;
      const inputTagIds = rule.inputTagIds as unknown[];
      const slotActions = inputTagIds.map(tagId => typeof tagId === 'string'
        ? enabledStudentActions.filter(action => action.tagIds.includes(tagId))
        : []);
      slotActions.forEach((candidates, slotIndex) => {
        if (candidates.length === 0) {
          issues.push('locationTactics[' + locationIndex + '].combinationRules[' + ruleIndex + '].inputTagIds[' + slotIndex + '] does not match an enabled student Action tag: ' + String(inputTagIds[slotIndex]));
        }
      });
      if (slotActions.length === 2 && slotActions.every(candidates => candidates.length > 0)) {
        const expectedTargetKind = rule.targetMatch === 'same-target' ? 'actor' : 'none';
        const compatible = slotActions[0].some(actionA => slotActions[1].some(actionB =>
          actionA.target.kind === expectedTargetKind && actionB.target.kind === expectedTargetKind,
        ));
        if (!compatible) {
          issues.push('locationTactics[' + locationIndex + '].combinationRules[' + ruleIndex + '] tag slots do not have enabled student Actions compatible with targetMatch ' + String(rule.targetMatch));
        }
      }
    }
  }

  return { issues, actionDefinitions, studentSkillRules };
}

/** Validates cost/effect resource IDs against the actors and Teams in one admitted Run. */
export function validateOperationActionActorReferences(
  event: OperationEventDef,
  actionDefinitions: readonly OperationActionDef[],
  studentSkillRules: readonly OperationStudentSkillRuleDef[],
  actorInitializations: readonly OperationActorInitialization[],
): readonly string[] {
  const issues: string[] = [];
  const actionsById = indexById(actionDefinitions, value => value.id);
  const rulesById = indexById(studentSkillRules, value => value.id);
  const actorsById = indexById(event.actors, value => value.id);

  for (const [index, initialization] of actorInitializations.entries()) {
    const source = actorsById.get(initialization.actorId);
    if (!source) continue;
    const path = 'actors[' + index + ']';
    if (initialization.participantKind !== 'student') {
      if (!Array.isArray(initialization.candidateActionIds)) {
        issues.push(path + '.candidateActionIds must be an array of Action IDs');
        continue;
      }
      for (const actionId of initialization.candidateActionIds) {
        const action = actionsById.get(actionId);
        if (!action) {
          issues.push(path + '.candidateActionIds references a missing Action: ' + actionId);
        } else if (!action.allowedParticipantKinds.includes(initialization.participantKind)) {
          issues.push(path + ' candidate Action does not allow ' + initialization.participantKind + ' participants: ' + actionId);
        } else if (action.requiredCapabilityIds.length > 0) {
          issues.push(path + ' candidate Action requires student capabilities unavailable to ' + initialization.participantKind + ' participants: ' + actionId);
        } else {
          validateActionResourceReferences(event, source, action, path + '.candidate Action ' + actionId, issues);
        }
      }
      continue;
    }
    const profile = initialization.profile;
    for (const actionId of profile.eligibleActionIds) {
      const action = actionsById.get(actionId);
      if (action) validateActionResourceReferences(event, source, action, path + '.profile.action ' + actionId, issues);
    }
    const skill = profile.randomSkillRuleId ? rulesById.get(profile.randomSkillRuleId) : undefined;
    if (skill) {
      for (const actionId of skill.triggerActionIds) {
        if (!profile.eligibleActionIds.includes(actionId)) continue;
        const trigger = actionsById.get(actionId);
        if (!trigger) continue;
        const skillAction: OperationActionDef = { ...trigger, effects: skill.effects };
        validateActionResourceReferences(event, source, skillAction, path + '.profile Skill Rule ' + skill.id, issues);
      }
    }
  }

  for (const [locationIndex, tactics] of (event.locationTactics ?? []).entries()) {
    const enabledActions = tactics.enabledActionIds
      .map(id => actionsById.get(id))
      .filter((action): action is OperationActionDef => action !== undefined && action.allowedParticipantKinds.includes('student'));
    for (const [ruleIndex, rule] of tactics.combinationRules.entries()) {
      const slotAActions = enabledActions.filter(action => action.tagIds.includes(rule.inputTagIds[0]));
      const slotBActions = enabledActions.filter(action => action.tagIds.includes(rule.inputTagIds[1]));
      for (const slotA of actorInitializations) {
        if (slotA.participantKind !== 'student') continue;
        const sourceA = actorsById.get(slotA.actorId);
        if (!sourceA) continue;
        for (const actionA of slotAActions) {
          if (!slotA.profile.eligibleActionIds.includes(actionA.id)) continue;
          for (const slotB of actorInitializations) {
            if (slotB.participantKind !== 'student' || slotB.actorId === slotA.actorId) continue;
            const sourceB = actorsById.get(slotB.actorId);
            if (!sourceB) continue;
            for (const actionB of slotBActions) {
              if (!slotB.profile.eligibleActionIds.includes(actionB.id)) continue;
              const path = 'locationTactics[' + locationIndex + '].combinationRules[' + ruleIndex + ']';
              if (rule.targetMatch === 'no-target') {
                if (actionA.target.kind === 'none' && actionB.target.kind === 'none') {
                  validateEffectResourceReferences(event, sourceA, [], false, rule.effects, path, issues);
                }
              } else if (rule.targetMatch === 'same-target'
                && actionA.target.kind === 'actor' && actionB.target.kind === 'actor') {
                const targetsB = new Set(legalTargetActors(event, sourceB, actionB).map(target => target.id));
                const sharedTargets = legalTargetActors(event, sourceA, actionA).filter(target => targetsB.has(target.id));
                for (const target of sharedTargets) {
                  validateEffectResourceReferences(event, sourceA, [target], true, rule.effects, path, issues);
                }
              }
            }
          }
        }
      }
    }
  }

  return issues;
}
