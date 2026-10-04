import {
  OPERATION_NO_ELIGIBLE_ACTION_REASON_ID,
  OPERATION_WAIT_ACTION_ID,
  type OperationBoundedValueDef,
  type OperationCardZones,
  type OperationEventDef,
} from '../contracts/operation';

export function isOperationRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isNonEmptyOperationId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function rejectUnsupportedFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(path + ' contains unsupported field: ' + key);
  }
}

function collectIds(value: unknown, path: string, issues: string[]): Set<string> {
  const result = new Set<string>();
  if (!Array.isArray(value)) {
    issues.push(path + ' must be an array of IDs');
    return result;
  }
  value.forEach((id, index) => {
    if (!isNonEmptyOperationId(id)) {
      issues.push(path + '[' + index + '] must be a non-empty ID');
    } else if (result.has(id)) {
      issues.push(path + ' contains duplicate ID: ' + id);
    } else {
      result.add(id);
    }
  });
  return result;
}

function validateBoundedValue(value: unknown, path: string, issues: string[]): value is OperationBoundedValueDef {
  if (!isOperationRecord(value)) {
    issues.push(path + ' must define initial, min, and max');
    return false;
  }
  const { initial, min, max } = value;
  if (typeof initial !== 'number' || !Number.isFinite(initial)
    || typeof min !== 'number' || !Number.isFinite(min)
    || typeof max !== 'number' || !Number.isFinite(max)) {
    issues.push(path + ' values must be finite numbers');
    return false;
  }
  if (min > max) issues.push(path + '.min must not exceed max');
  if (initial < min || initial > max) issues.push(path + '.initial is outside its bounds');
  return min <= max && initial >= min && initial <= max;
}

/** Parses the finite card zones and reports malformed IDs for both definitions and local deltas. */
export function readOperationCardZones(value: unknown, path: string, issues: string[]): OperationCardZones | null {
  if (!isOperationRecord(value)) {
    issues.push(path + ' must define drawPile, hand, discard, and played');
    return null;
  }
  const zones: Record<string, string[]> = {};
  for (const zone of ['drawPile', 'hand', 'discard', 'played'] as const) {
    const cards = value[zone];
    if (!Array.isArray(cards)) {
      issues.push(path + '.' + zone + ' must be an array');
      zones[zone] = [];
      continue;
    }
    zones[zone] = cards.filter((card): card is string => {
      const valid = isNonEmptyOperationId(card);
      if (!valid) issues.push(path + '.' + zone + ' contains an invalid card ID');
      return valid;
    });
  }
  return zones as unknown as OperationCardZones;
}

export function operationCardCounts(zones: OperationCardZones): Map<string, number> {
  const counts = new Map<string, number>();
  for (const zone of [zones.drawPile, zones.hand, zones.discard, zones.played]) {
    for (const cardId of zone) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }
  return counts;
}

export function sameOperationCardCounts(
  expected: ReadonlyMap<string, number>,
  actual: ReadonlyMap<string, number>,
): boolean {
  if (expected.size !== actual.size) return false;
  for (const [id, count] of expected) if (actual.get(id) !== count) return false;
  return true;
}

function validateOperationActionEffect(value: unknown, path: string, issues: string[]): void {
  if (!isOperationRecord(value)) {
    issues.push(path + ' must be an effect object');
    return;
  }
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) {
    issues.push(path + '.amount must be a finite number');
  }
  switch (value.kind) {
    case 'actorHpDelta':
      rejectUnsupportedFields(value, ['kind', 'recipient', 'amount'], path, issues);
      if (value.recipient !== 'actor' && value.recipient !== 'target') {
        issues.push(path + '.recipient must be actor or target');
      }
      break;
    case 'actorResourceDelta':
      rejectUnsupportedFields(value, ['kind', 'recipient', 'resourceId', 'amount'], path, issues);
      if (value.recipient !== 'actor' && value.recipient !== 'target') {
        issues.push(path + '.recipient must be actor or target');
      }
      if (!isNonEmptyOperationId(value.resourceId)) issues.push(path + '.resourceId must be a non-empty ID');
      break;
    case 'teamResourceDelta':
      rejectUnsupportedFields(value, ['kind', 'recipient', 'resourceId', 'amount'], path, issues);
      if (value.recipient !== 'actorTeam' && value.recipient !== 'targetTeam') {
        issues.push(path + '.recipient must be actorTeam or targetTeam');
      }
      if (!isNonEmptyOperationId(value.resourceId)) issues.push(path + '.resourceId must be a non-empty ID');
      break;
    case 'eventTrackDelta':
      rejectUnsupportedFields(value, ['kind', 'trackId', 'amount'], path, issues);
      if (!isNonEmptyOperationId(value.trackId)) issues.push(path + '.trackId must be a non-empty ID');
      break;
    default:
      issues.push(path + '.kind is not a supported Operation Action effect');
  }
}

function validateOperationActionEffects(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push(path + ' must be an array');
    return;
  }
  value.forEach((effect, index) => validateOperationActionEffect(effect, path + '[' + index + ']', issues));
}

/** Validates the closed, data-only Action contract before it enters an Operation resolver. */
export function validateOperationActionDef(value: unknown): readonly string[] {
  const issues: string[] = [];
  if (!isOperationRecord(value)) return ['action definition must be an object'];
  rejectUnsupportedFields(value, [
    'id', 'allowedParticipantKinds', 'requiredCapabilityIds', 'reasonIds', 'tagIds', 'cost', 'target', 'effects',
  ], 'action', issues);
  if (!isNonEmptyOperationId(value.id)) issues.push('id must be a non-empty Action ID');

  const allowedKinds = collectIds(value.allowedParticipantKinds, 'allowedParticipantKinds', issues);
  if (allowedKinds.size === 0) issues.push('allowedParticipantKinds must contain at least one participant kind');
  for (const kind of allowedKinds) {
    if (!['student', 'opponent', 'environment'].includes(kind)) {
      issues.push('allowedParticipantKinds contains an unsupported participant kind: ' + kind);
    }
  }
  collectIds(value.requiredCapabilityIds, 'requiredCapabilityIds', issues);
  collectIds(value.reasonIds, 'reasonIds', issues);
  collectIds(value.tagIds, 'tagIds', issues);

  if (value.cost !== undefined) {
    if (!isOperationRecord(value.cost)) {
      issues.push('cost must be an object');
    } else {
      rejectUnsupportedFields(value.cost, ['scope', 'resourceId', 'amount'], 'cost', issues);
      if (value.cost.scope !== 'actor' && value.cost.scope !== 'team') issues.push('cost.scope must be actor or team');
      if (!isNonEmptyOperationId(value.cost.resourceId)) issues.push('cost.resourceId must be a non-empty ID');
      if (typeof value.cost.amount !== 'number' || !Number.isFinite(value.cost.amount) || value.cost.amount <= 0) {
        issues.push('cost.amount must be a positive finite number');
      }
    }
  }

  if (!isOperationRecord(value.target)) {
    issues.push('target must be an object');
  } else if (value.target.kind === 'none') {
    rejectUnsupportedFields(value.target, ['kind'], 'target', issues);
    if (value.target.relation !== undefined) issues.push('target.relation must be omitted when target.kind is none');
  } else if (value.target.kind === 'actor') {
    rejectUnsupportedFields(value.target, ['kind', 'relation'], 'target', issues);
    if (!['self', 'sameTeam', 'otherTeam', 'any'].includes(String(value.target.relation))) {
      issues.push('target.relation must be self, sameTeam, otherTeam, or any');
    }
  } else {
    issues.push('target.kind must be none or actor');
  }

  validateOperationActionEffects(value.effects, 'effects', issues);
  return issues;
}

function validateCombinationRule(value: unknown, path: string, issues: string[]): void {
  if (!isOperationRecord(value) || !isNonEmptyOperationId(value.id)) {
    issues.push(path + '.id must be a non-empty ID');
    return;
  }
  rejectUnsupportedFields(value, ['id', 'priority', 'inputTagIds', 'targetMatch', 'effects'], path, issues);
  if (!Number.isSafeInteger(value.priority)) issues.push(path + '.priority must be a safe integer');
  const tags = collectIds(value.inputTagIds, path + '.inputTagIds', issues);
  if (!Array.isArray(value.inputTagIds) || value.inputTagIds.length !== 2 || tags.size !== 2) {
    issues.push(path + '.inputTagIds must contain two distinct ordered tag IDs');
  }
  if (value.targetMatch !== 'same-target' && value.targetMatch !== 'no-target') {
    issues.push(path + '.targetMatch must be same-target or no-target');
  }
  validateOperationActionEffects(value.effects, path + '.effects', issues);
}

function validateLocationTactics(
  value: unknown,
  locations: ReadonlySet<string>,
  trackIds: ReadonlySet<string>,
  issues: string[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push('locationTactics must be an array');
    return;
  }
  const seenLocations = new Set<string>();
  value.forEach((entry, index) => {
    const path = 'locationTactics[' + index + ']';
    if (!isOperationRecord(entry) || !isNonEmptyOperationId(entry.locationId)) {
      issues.push(path + '.locationId must be a non-empty ID');
      return;
    }
    rejectUnsupportedFields(entry, ['locationId', 'enabledActionIds', 'combinationRules'], path, issues);
    if (!locations.has(entry.locationId)) issues.push(path + '.locationId references an undeclared Location: ' + entry.locationId);
    if (seenLocations.has(entry.locationId)) issues.push('locationTactics contains duplicate locationId: ' + entry.locationId);
    seenLocations.add(entry.locationId);

    collectIds(entry.enabledActionIds, path + '.enabledActionIds', issues);
    if (!Array.isArray(entry.combinationRules)) {
      issues.push(path + '.combinationRules must be an array');
      return;
    }
    const ruleIds = new Set<string>();
    entry.combinationRules.forEach((rule, ruleIndex) => {
      const rulePath = path + '.combinationRules[' + ruleIndex + ']';
      if (isOperationRecord(rule) && isNonEmptyOperationId(rule.id)) {
        if (ruleIds.has(rule.id)) issues.push(path + '.combinationRules contains duplicate ID: ' + rule.id);
        ruleIds.add(rule.id);
      }
      validateCombinationRule(rule, rulePath, issues);
      if (isOperationRecord(rule) && Array.isArray(rule.effects)) {
        rule.effects.forEach((effect, effectIndex) => {
          if (isOperationRecord(effect) && effect.kind === 'eventTrackDelta'
            && isNonEmptyOperationId(effect.trackId) && !trackIds.has(effect.trackId)) {
            issues.push(rulePath + '.effects[' + effectIndex + '].trackId references an undeclared track: ' + effect.trackId);
          }
        });
      }
    });
  });
}

/** Pure definition/reference validation. A non-empty result is a complete diagnostic list. */
export function validateOperationEventDef(definition: OperationEventDef): readonly string[] {
  const issues: string[] = [];
  if (!isOperationRecord(definition)) return ['event definition must be an object'];
  const raw = definition as unknown as Record<string, unknown>;
  if (!isNonEmptyOperationId(raw.id)) issues.push('id must be a non-empty ID');

  const locations = collectIds(raw.locationIds, 'locationIds', issues);
  if (!isNonEmptyOperationId(raw.initialLocationId) || !locations.has(raw.initialLocationId)) {
    issues.push('initialLocationId must reference a declared location');
  }

  const trackIds = new Set<string>();
  if (!Array.isArray(raw.tracks)) {
    issues.push('tracks must be an array');
  } else {
    raw.tracks.forEach((value, index) => {
      const path = 'tracks[' + index + ']';
      if (!isOperationRecord(value) || !isNonEmptyOperationId(value.id)) {
        issues.push(path + '.id must be a non-empty ID');
        return;
      }
      if (trackIds.has(value.id)) issues.push('tracks contains duplicate ID: ' + value.id);
      trackIds.add(value.id);
      validateBoundedValue(value, path, issues);
    });
  }

  const facts = collectIds(raw.factIds, 'factIds', issues);
  const knownFacts = collectIds(raw.knownFactIds, 'knownFactIds', issues);
  for (const id of knownFacts) if (!facts.has(id)) issues.push('knownFactIds contains undeclared fact: ' + id);

  const items = collectIds(raw.itemIds, 'itemIds', issues);
  const heldItems = collectIds(raw.heldItemIds, 'heldItemIds', issues);
  for (const id of heldItems) if (!items.has(id)) issues.push('heldItemIds contains undeclared item: ' + id);

  const teamIds = new Set<string>();
  if (raw.teams !== undefined) {
    if (!Array.isArray(raw.teams)) {
      issues.push('teams must be an array');
    } else {
      raw.teams.forEach((team, index) => {
        const path = 'teams[' + index + ']';
        if (!isOperationRecord(team) || !isNonEmptyOperationId(team.id)) {
          issues.push(path + '.id must be a non-empty ID');
          return;
        }
        rejectUnsupportedFields(team, ['id', 'resources'], path, issues);
        if (teamIds.has(team.id)) issues.push('teams contains duplicate ID: ' + team.id);
        teamIds.add(team.id);
        if (team.resources !== undefined) {
          if (!isOperationRecord(team.resources)) {
            issues.push(path + '.resources must be a record');
          } else {
            for (const [resourceId, resource] of Object.entries(team.resources)) {
              if (!isNonEmptyOperationId(resourceId)) issues.push(path + '.resources contains an invalid ID');
              validateBoundedValue(resource, path + '.resources.' + resourceId, issues);
            }
          }
        }
      });
    }
  }

  if (raw.actionRequirements !== undefined) {
    if (!Array.isArray(raw.actionRequirements)) {
      issues.push('actionRequirements must be an array');
    } else {
      const actionIds = new Set<string>();
      raw.actionRequirements.forEach((value, index) => {
        const path = 'actionRequirements[' + index + ']';
        if (!isOperationRecord(value) || !isNonEmptyOperationId(value.actionId)) {
          issues.push(path + '.actionId must be a non-empty ID');
          return;
        }
        if (actionIds.has(value.actionId)) issues.push('actionRequirements contains duplicate actionId: ' + value.actionId);
        if (value.actionId === OPERATION_WAIT_ACTION_ID) issues.push(path + '.actionId uses the reserved Wait fallback ID');
        actionIds.add(value.actionId);
        collectIds(value.requiredCapabilityIds, path + '.requiredCapabilityIds', issues);
        collectIds(value.reasonIds, path + '.reasonIds', issues);
      });
    }
  }

  const actorIds = new Set<string>();
  if (!Array.isArray(raw.actors)) {
    issues.push('actors must be an array');
  } else {
    raw.actors.forEach((actor, index) => {
      const path = 'actors[' + index + ']';
      if (!isOperationRecord(actor) || !isNonEmptyOperationId(actor.id)) {
        issues.push(path + '.id must be a non-empty ID');
        return;
      }
      if (actorIds.has(actor.id)) issues.push('actors contains duplicate ID: ' + actor.id);
      actorIds.add(actor.id);
      if (!isNonEmptyOperationId(actor.type)) issues.push(path + '.type must be a non-empty value');
      if (actor.teamId !== undefined) {
        if (!isNonEmptyOperationId(actor.teamId)) issues.push(path + '.teamId must be a non-empty ID');
        else if (!teamIds.has(actor.teamId)) issues.push(path + '.teamId references an undeclared Team: ' + actor.teamId);
      }
      validateBoundedValue(actor.hp, path + '.hp', issues);
      if (actor.resources !== undefined) {
        if (!isOperationRecord(actor.resources)) {
          issues.push(path + '.resources must be a record');
        } else {
          for (const [resourceId, resource] of Object.entries(actor.resources)) {
            if (!isNonEmptyOperationId(resourceId)) issues.push(path + '.resources contains an invalid ID');
            validateBoundedValue(resource, path + '.resources.' + resourceId, issues);
          }
        }
      }
    });
  }

  if (Array.isArray(raw.actors)) {
    raw.actors.forEach((actor, index) => {
      if (!isOperationRecord(actor) || actor.targetPriorityActorIds === undefined) return;
      const path = 'actors[' + index + '].targetPriorityActorIds';
      const targetIds = collectIds(actor.targetPriorityActorIds, path, issues);
      for (const targetId of targetIds) {
        if (!actorIds.has(targetId)) issues.push(path + ' contains an undeclared Actor ID: ' + targetId);
      }
    });
  }

  validateLocationTactics(raw.locationTactics, locations, trackIds, issues);

  if (!isOperationRecord(raw.playerRouteState)) {
    issues.push('playerRouteState must be an object');
  } else {
    const playerCost = raw.playerRouteState.playerCost;
    if (typeof playerCost !== 'number' || !Number.isFinite(playerCost) || playerCost < 0) {
      issues.push('playerRouteState.playerCost must be a non-negative finite number');
    }
    readOperationCardZones(raw.playerRouteState.cards, 'playerRouteState.cards', issues);
  }

  if (raw.randomSeed !== undefined && !Number.isSafeInteger(raw.randomSeed)) {
    issues.push('randomSeed must be a safe integer');
  }
  return issues;
}

/** Validates the detached participant/Profile hand-off before the owner creates a Run. */
export function validateOperationActorInitializations(
  eventDefinition: OperationEventDef,
  value: unknown,
): readonly string[] {
  const issues: string[] = [];
  if (!Array.isArray(value)) return ['actors must be an array of admitted actor snapshots'];

  const actorDefinitions = eventDefinition.actors;
  const actionRequirements = new Map((eventDefinition.actionRequirements ?? []).map(requirement => [requirement.actionId, requirement]));
  const expectedIds = new Set(actorDefinitions.map(actor => actor.id));
  const seenIds = new Set<string>();
  value.forEach((entry, index) => {
    const path = 'actors[' + index + ']';
    if (!isOperationRecord(entry) || !isNonEmptyOperationId(entry.actorId)) {
      issues.push(path + '.actorId must be a non-empty ID');
      return;
    }
    if (seenIds.has(entry.actorId)) issues.push('actors contains duplicate actorId: ' + entry.actorId);
    seenIds.add(entry.actorId);
    if (!expectedIds.has(entry.actorId)) issues.push(path + '.actorId references an undeclared Event actor: ' + entry.actorId);

    if (entry.participantKind === 'student') {
      if (!isNonEmptyOperationId(entry.characterId)) issues.push(path + '.characterId must be a non-empty Character ID');
      if (!isOperationRecord(entry.profile) || !isNonEmptyOperationId(entry.profile.id)) {
        issues.push(path + '.profile must define a non-empty Profile ID');
        return;
      }
      const profile = entry.profile;
      if (profile.characterId !== entry.characterId) issues.push(path + '.profile.characterId must match actor characterId');
      const candidateIds = collectIds(profile.candidateActionIds, path + '.profile.candidateActionIds', issues);
      if (candidateIds.has(OPERATION_WAIT_ACTION_ID)) {
        issues.push(path + '.profile.candidateActionIds contains the reserved Wait fallback ID');
      }
      const priorityIds = collectIds(profile.actionPriorityIds, path + '.profile.actionPriorityIds', issues);
      const capabilityIds = collectIds(profile.capabilityIds, path + '.profile.capabilityIds', issues);
      collectIds(profile.reasonIds, path + '.profile.reasonIds', issues);
      for (const id of priorityIds) {
        if (!candidateIds.has(id)) issues.push(path + '.profile.actionPriorityIds contains an undeclared candidate: ' + id);
      }
      if (profile.randomSkillRuleId !== undefined && !isNonEmptyOperationId(profile.randomSkillRuleId)) {
        issues.push(path + '.profile.randomSkillRuleId must be a non-empty rule reference');
      }
      if (!Array.isArray(profile.actionCandidates)) {
        issues.push(path + '.profile.actionCandidates must be an array');
      } else {
        const projectedActionIds = new Set<string>();
        const projectedActionOrder: string[] = [];
        const eligibleActionOrder: string[] = [];
        const rawCandidateOrder = Array.isArray(profile.candidateActionIds)
          ? [...new Set(profile.candidateActionIds.filter(isNonEmptyOperationId))]
          : [];
        const rawPriorityOrder = Array.isArray(profile.actionPriorityIds)
          ? [...new Set(profile.actionPriorityIds.filter(isNonEmptyOperationId))]
          : [];
        const candidateSet = new Set(rawCandidateOrder.filter(id => actionRequirements.has(id)));
        const priorityOrder = rawPriorityOrder.filter(id => candidateSet.has(id));
        const prioritySet = new Set(priorityOrder);
        const expectedActionOrder = [
          ...priorityOrder,
          ...rawCandidateOrder.filter(id => candidateSet.has(id) && !prioritySet.has(id)),
        ];
        profile.actionCandidates.forEach((candidate, candidateIndex) => {
          const candidatePath = path + '.profile.actionCandidates[' + candidateIndex + ']';
          if (!isOperationRecord(candidate) || !isNonEmptyOperationId(candidate.actionId)) {
            issues.push(candidatePath + '.actionId must be a non-empty ID');
            return;
          }
          if (projectedActionIds.has(candidate.actionId)) issues.push(path + '.profile.actionCandidates contains duplicate actionId: ' + candidate.actionId);
          projectedActionIds.add(candidate.actionId);
          projectedActionOrder.push(candidate.actionId);
          if (!candidateIds.has(candidate.actionId)) issues.push(candidatePath + '.actionId is not in candidateActionIds');
          if (typeof candidate.eligible !== 'boolean') issues.push(candidatePath + '.eligible must be boolean');
          const required = collectIds(candidate.requiredCapabilityIds, candidatePath + '.requiredCapabilityIds', issues);
          const missing = collectIds(candidate.missingCapabilityIds, candidatePath + '.missingCapabilityIds', issues);
          collectIds(candidate.reasonIds, candidatePath + '.reasonIds', issues);
          const requirement = actionRequirements.get(candidate.actionId);
          if (!requirement) {
            issues.push(candidatePath + '.actionId is not declared by event actionRequirements');
          } else {
            const expectedRequired = [...requirement.requiredCapabilityIds];
            if (!sameOrderedIds(candidate.requiredCapabilityIds, expectedRequired)) {
              issues.push(candidatePath + '.requiredCapabilityIds does not match the Event action requirement');
            }
            const expectedMissing = expectedRequired.filter(id => !capabilityIds.has(id));
            if (!sameOrderedIds(candidate.missingCapabilityIds, expectedMissing)) {
              issues.push(candidatePath + '.missingCapabilityIds does not match the Profile capabilities');
            }
            const profileReasonIds = Array.isArray(profile.reasonIds)
              ? profile.reasonIds.filter(isNonEmptyOperationId)
              : [];
            const expectedReasons = [...new Set([...profileReasonIds, ...requirement.reasonIds])];
            if (!sameOrderedIds(candidate.reasonIds, expectedReasons)) {
              issues.push(candidatePath + '.reasonIds does not match the Profile and Event reasons');
            }
            const expectedEligible = expectedMissing.length === 0;
            if (candidate.eligible !== expectedEligible) {
              issues.push(candidatePath + '.eligible does not match required capabilities');
            }
            if (expectedEligible) eligibleActionOrder.push(candidate.actionId);
          }
          for (const id of missing) {
            if (!required.has(id)) issues.push(candidatePath + '.missingCapabilityIds contains an undeclared requirement: ' + id);
            if (capabilityIds.has(id)) issues.push(candidatePath + '.missingCapabilityIds contains a present capability: ' + id);
          }
          if (candidate.eligible === true && missing.size > 0) issues.push(candidatePath + ' is eligible despite missing capabilities');
          if (candidate.eligible === false && missing.size === 0) issues.push(candidatePath + ' is ineligible without a missing capability');
        });
        if (!sameOrderedIds(projectedActionOrder, expectedActionOrder)) {
          issues.push(path + '.profile.actionCandidates does not match candidate/actionPriority order and event declaration');
        }
      }
      collectIds(profile.eligibleActionIds, path + '.profile.eligibleActionIds', issues);
      const expectedEligibleIds: string[] = [];
      if (Array.isArray(profile.actionCandidates)) {
        for (const candidate of profile.actionCandidates) {
          if (!isOperationRecord(candidate) || !isNonEmptyOperationId(candidate.actionId)) continue;
          const requirement = actionRequirements.get(candidate.actionId);
          if (requirement && requirement.requiredCapabilityIds.every(id => capabilityIds.has(id))) {
            expectedEligibleIds.push(candidate.actionId);
          }
        }
      }
      if (!sameOrderedIds(profile.eligibleActionIds, expectedEligibleIds)) {
        issues.push(path + '.profile.eligibleActionIds must match eligible candidates in declared order');
      }
      if (expectedEligibleIds.length === 0) {
        if (!isOperationRecord(profile.fallback)
          || profile.fallback.actionId !== OPERATION_WAIT_ACTION_ID
          || !Array.isArray(profile.fallback.reasonIds)
          || profile.fallback.reasonIds.length !== 1
          || profile.fallback.reasonIds[0] !== OPERATION_NO_ELIGIBLE_ACTION_REASON_ID) {
          issues.push(path + '.profile.fallback must use the stable Wait action and reason');
        }
      } else if (profile.fallback !== undefined) {
        issues.push(path + '.profile.fallback must be omitted when an eligible action exists');
      }
      if (entry.factionId !== undefined) issues.push(path + ' student snapshot must not define factionId');
    } else if (entry.participantKind === 'opponent' || entry.participantKind === 'environment') {
      if (entry.factionId !== undefined && !isNonEmptyOperationId(entry.factionId)) {
        issues.push(path + '.factionId must be a non-empty ID when supplied');
      }
      if (entry.characterId !== undefined || entry.profile !== undefined) {
        issues.push(path + ' non-student snapshot must not define Character or Profile data');
      }
    } else {
      issues.push(path + '.participantKind must be student, opponent, or environment');
    }
  });

  for (const id of expectedIds) if (!seenIds.has(id)) issues.push('actors is missing Event actor: ' + id);
  if (seenIds.size !== expectedIds.size) issues.push('actors must contain every Event actor exactly once');
  return issues;
}

function sameOrderedIds(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((id, index) => id === expected[index]);
}
