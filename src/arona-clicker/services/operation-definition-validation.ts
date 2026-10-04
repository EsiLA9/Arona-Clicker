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

  if (!Array.isArray(raw.actors)) {
    issues.push('actors must be an array');
  } else {
    const actorIds = new Set<string>();
    raw.actors.forEach((actor, index) => {
      const path = 'actors[' + index + ']';
      if (!isOperationRecord(actor) || !isNonEmptyOperationId(actor.id)) {
        issues.push(path + '.id must be a non-empty ID');
        return;
      }
      if (actorIds.has(actor.id)) issues.push('actors contains duplicate ID: ' + actor.id);
      actorIds.add(actor.id);
      if (!isNonEmptyOperationId(actor.type)) issues.push(path + '.type must be a non-empty value');
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
