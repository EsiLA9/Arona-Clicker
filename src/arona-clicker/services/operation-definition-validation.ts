import {
  OPERATION_NO_ELIGIBLE_ACTION_REASON_ID,
  OPERATION_WAIT_ACTION_ID,
  type OperationBoundedValueDef,
  type OperationCardZones,
  type OperationEventDef,
} from '../contracts/operation';
import type { OperationActionDef } from '../contracts/operation-action';
import { validateOperationActionDef, validateOperationActionEffects } from './operation-tactical-definition-validation';

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
    issues.push(path + ' must define drawPile, hand, and discard');
    return null;
  }
  const zones: Record<string, string[]> = {};
  rejectUnsupportedFields(value, ['drawPile', 'hand', 'discard'], path, issues);
  for (const zone of ['drawPile', 'hand', 'discard'] as const) {
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
  for (const zone of [zones.drawPile, zones.hand, zones.discard]) {
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

function validatePredicate(
  value: unknown,
  trackIds: ReadonlySet<string>,
  factIds: ReadonlySet<string>,
  path: string,
  issues: string[],
): void {
  if (!isOperationRecord(value)) {
    issues.push(path + ' must be a predicate object');
    return;
  }
  if (value.kind === 'track') {
    rejectUnsupportedFields(value, ['kind', 'trackId', 'operator', 'value'], path, issues);
    if (!isNonEmptyOperationId(value.trackId) || !trackIds.has(value.trackId)) issues.push(path + '.trackId references an undeclared track');
    if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(String(value.operator))) issues.push(path + '.operator is unsupported');
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) issues.push(path + '.value must be finite');
    return;
  }
  if (value.kind === 'knownFact') {
    rejectUnsupportedFields(value, ['kind', 'factId', 'present'], path, issues);
    if (!isNonEmptyOperationId(value.factId) || !factIds.has(value.factId)) issues.push(path + '.factId references an undeclared fact');
    if (typeof value.present !== 'boolean') issues.push(path + '.present must be boolean');
    return;
  }
  if (value.kind === 'all' || value.kind === 'any') {
    rejectUnsupportedFields(value, ['kind', 'terms'], path, issues);
    if (!Array.isArray(value.terms) || value.terms.length === 0) {
      issues.push(path + '.terms must contain at least one predicate');
      return;
    }
    value.terms.forEach((term, index) => {
      if (!isOperationRecord(term) || (term.kind !== 'track' && term.kind !== 'knownFact')) {
        issues.push(path + '.terms[' + index + '] must be a simple track or fact predicate');
      } else {
        validatePredicate(term, trackIds, factIds, path + '.terms[' + index + ']', issues);
      }
    });
    return;
  }
  issues.push(path + '.kind is unsupported');
}

function validateObjectives(
  value: unknown,
  trackIds: ReadonlySet<string>,
  factIds: ReadonlySet<string>,
  path: string,
  issues: string[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(path + ' must be an array');
    return;
  }
  const ids = new Set<string>();
  value.forEach((objective, index) => {
    const rowPath = path + '[' + index + ']';
    if (!isOperationRecord(objective)) {
      issues.push(rowPath + ' must be an objective object');
      return;
    }
    rejectUnsupportedFields(objective, ['id', 'description', 'kind', 'predicate'], rowPath, issues);
    if (!isNonEmptyOperationId(objective.id)) issues.push(rowPath + '.id must be a non-empty ID');
    else if (ids.has(objective.id)) issues.push(path + ' contains duplicate ID: ' + objective.id);
    else ids.add(objective.id);
    if (typeof objective.description !== 'string' || objective.description.trim().length === 0) issues.push(rowPath + '.description must be non-empty');
    if (objective.kind !== 'primary' && objective.kind !== 'secondary') issues.push(rowPath + '.kind must be primary or secondary');
    validatePredicate(objective.predicate, trackIds, factIds, rowPath + '.predicate', issues);
  });
}

function validateOutcomeConditions(
  value: unknown,
  trackIds: ReadonlySet<string>,
  factIds: ReadonlySet<string>,
  path: string,
  issues: string[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(path + ' must be an array');
    return;
  }
  const ids = new Set<string>();
  value.forEach((condition, index) => {
    const rowPath = path + '[' + index + ']';
    if (!isOperationRecord(condition)) {
      issues.push(rowPath + ' must be a condition object');
      return;
    }
    rejectUnsupportedFields(condition, ['id', 'description', 'predicate'], rowPath, issues);
    if (!isNonEmptyOperationId(condition.id)) issues.push(rowPath + '.id must be a non-empty ID');
    else if (ids.has(condition.id)) issues.push(path + ' contains duplicate ID: ' + condition.id);
    else ids.add(condition.id);
    if (typeof condition.description !== 'string' || condition.description.trim().length === 0) issues.push(rowPath + '.description must be non-empty');
    validatePredicate(condition.predicate, trackIds, factIds, rowPath + '.predicate', issues);
  });
}

function validateLocations(
  value: unknown,
  trackIds: ReadonlySet<string>,
  factIds: ReadonlySet<string>,
  itemIds: ReadonlySet<string>,
  issues: string[],
): Set<string> {
  const locationIds = new Set<string>();
  if (!Array.isArray(value)) {
    issues.push('locations must be an array');
    return locationIds;
  }
  value.forEach((entry, index) => {
    if (!isOperationRecord(entry) || !isNonEmptyOperationId(entry.id)) {
      issues.push('locations[' + index + '].id must be a non-empty ID');
    } else if (locationIds.has(entry.id)) {
      issues.push('locations contains duplicate ID: ' + entry.id);
    } else {
      locationIds.add(entry.id);
    }
  });
  value.forEach((entry, index) => {
    const path = 'locations[' + index + ']';
    if (!isOperationRecord(entry) || !isNonEmptyOperationId(entry.id)) {
      return;
    }
    rejectUnsupportedFields(entry, ['id', 'interactionSceneId', 'activityId', 'cardPoolIds', 'enabledActionIds', 'combinationRules', 'actionMode', 'sceneActions', 'sceneActionBatches', 'costGain', 'maxCarryCost', 'objectives', 'partialOutcomes', 'failureConditions', 'maxBeats', 'maxVisits', 'routeEdges'], path, issues);
    for (const field of ['interactionSceneId', 'activityId'] as const) {
      const value = entry[field];
      if (value !== undefined && !isNonEmptyOperationId(value)) {
        issues.push(path + '.' + field + ' must be a non-empty ID');
      }
    }
    if (entry.cardPoolIds !== undefined) collectIds(entry.cardPoolIds, path + '.cardPoolIds', issues);
    collectIds(entry.enabledActionIds, path + '.enabledActionIds', issues);
    const hasSceneContract = entry.actionMode !== undefined || entry.sceneActions !== undefined || entry.sceneActionBatches !== undefined;
    if (hasSceneContract) {
      if (entry.actionMode !== 'individual' && entry.actionMode !== 'global') {
        issues.push(path + '.actionMode must be individual or global');
      }
      if (!Array.isArray(entry.sceneActions) || entry.sceneActions.length === 0) {
        issues.push(path + '.sceneActions must contain at least one scene action');
      }
      if (!Number.isSafeInteger(entry.sceneActionBatches) || Number(entry.sceneActionBatches) <= 0) {
        issues.push(path + '.sceneActionBatches must be a positive safe integer');
      }
      if (Array.isArray(entry.sceneActions)) {
        const sceneActionIds = new Set<string>();
        entry.sceneActions.forEach((action, actionIndex) => {
          const actionPath = path + '.sceneActions[' + actionIndex + ']';
          if (!isOperationRecord(action)) {
            issues.push(actionPath + ' must be a SceneAction object');
            return;
          }
          rejectUnsupportedFields(action, ['id', 'actionId', 'scope', 'playerCost', 'performerPolicy', 'selectionPolicy', 'title', 'description'], actionPath, issues);
          if (!isNonEmptyOperationId(action.id)) issues.push(actionPath + '.id must be a non-empty SceneAction ID');
          else if (sceneActionIds.has(action.id)) issues.push(path + '.sceneActions contains duplicate ID: ' + action.id);
          else sceneActionIds.add(action.id);
          if (!isNonEmptyOperationId(action.actionId)) issues.push(actionPath + '.actionId must be a non-empty Action ID');
          if (action.scope !== 'individual' && action.scope !== 'global') issues.push(actionPath + '.scope must be individual or global');
          else if (action.scope !== entry.actionMode) issues.push(actionPath + '.scope must match the Location actionMode');
          if (action.selectionPolicy !== undefined && action.selectionPolicy !== 'required' && action.selectionPolicy !== 'fixed') issues.push(actionPath + '.selectionPolicy must be required or fixed');
          if (action.performerPolicy !== undefined && action.performerPolicy !== 'selected-student' && action.performerPolicy !== 'none' && action.performerPolicy !== 'optional-student') issues.push(actionPath + '.performerPolicy must be selected-student, none, or optional-student');
          if ((action.performerPolicy === 'none' || action.performerPolicy === 'optional-student') && action.scope !== 'global') issues.push(actionPath + ' actorless-capable SceneAction is only supported for global scope');
          if (action.title !== undefined && (typeof action.title !== 'string' || action.title.trim() === '')) issues.push(actionPath + '.title must be a non-empty string when supplied');
          if (action.description !== undefined && typeof action.description !== 'string') issues.push(actionPath + '.description must be a string when supplied');
          if (typeof action.playerCost !== 'number' || !Number.isFinite(action.playerCost) || action.playerCost < 0
            || action.playerCost > Number.MAX_SAFE_INTEGER) {
            issues.push(actionPath + '.playerCost must be a non-negative finite number in the safe numeric range');
          }
        });
      }
    }
    for (const field of ['costGain', 'maxCarryCost'] as const) {
      const amount = entry[field];
      if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0
        || amount > Number.MAX_SAFE_INTEGER)) {
        issues.push(path + '.' + field + ' must be a non-negative finite number in the safe numeric range');
      }
    }
    validateObjectives(entry.objectives, trackIds, factIds, path + '.objectives', issues);
    validateOutcomeConditions(entry.partialOutcomes, trackIds, factIds, path + '.partialOutcomes', issues);
    validateOutcomeConditions(entry.failureConditions, trackIds, factIds, path + '.failureConditions', issues);
    if (entry.maxBeats !== undefined && (!Number.isSafeInteger(entry.maxBeats) || Number(entry.maxBeats) <= 0)) {
      issues.push(path + '.maxBeats must be a positive safe integer');
    }
    if (entry.maxVisits !== undefined && (!Number.isSafeInteger(entry.maxVisits) || Number(entry.maxVisits) <= 0)) {
      issues.push(path + '.maxVisits must be a positive safe integer');
    }
    if (!Array.isArray(entry.routeEdges)) {
      issues.push(path + '.routeEdges must be an array');
      return;
    }
    const routeIds = new Set<string>();
    entry.routeEdges.forEach((route, routeIndex) => {
      const routePath = path + '.routeEdges[' + routeIndex + ']';
      if (!isOperationRecord(route)) {
        issues.push(routePath + ' must be a RouteEdge object');
        return;
      }
      rejectUnsupportedFields(route, ['id', 'targetLocationId', 'label', 'description', 'requiredHeldItemId', 'anyOfHeldItemIds', 'consumeRequiredHeldItem'], routePath, issues);
      if (!isNonEmptyOperationId(route.id)) issues.push(routePath + '.id must be a non-empty routeId');
      else if (routeIds.has(route.id)) issues.push(path + '.routeEdges contains duplicate routeId: ' + route.id);
      else routeIds.add(route.id);
      if (!isNonEmptyOperationId(route.targetLocationId) || !locationIds.has(route.targetLocationId)) {
        issues.push(routePath + '.targetLocationId references an undeclared Location');
      }
      if (typeof route.label !== 'string' || route.label.trim().length === 0) issues.push(routePath + '.label must be non-empty');
      if (typeof route.description !== 'string' || route.description.trim().length === 0) issues.push(routePath + '.description must be non-empty');
      if (route.requiredHeldItemId !== undefined
        && (!isNonEmptyOperationId(route.requiredHeldItemId) || !itemIds.has(route.requiredHeldItemId))) {
        issues.push(routePath + '.requiredHeldItemId references an undeclared item');
      }
      if (route.anyOfHeldItemIds !== undefined) {
        const alternatives = collectIds(route.anyOfHeldItemIds, routePath + '.anyOfHeldItemIds', issues);
        if (alternatives.size < 2) issues.push(routePath + '.anyOfHeldItemIds must contain at least two item IDs');
        alternatives.forEach(itemId => { if (!itemIds.has(itemId)) issues.push(routePath + '.anyOfHeldItemIds references an undeclared item: ' + itemId); });
      }
      if (route.requiredHeldItemId !== undefined && route.anyOfHeldItemIds !== undefined) {
        issues.push(routePath + ' must use either requiredHeldItemId or anyOfHeldItemIds');
      }
      if (route.consumeRequiredHeldItem !== undefined && typeof route.consumeRequiredHeldItem !== 'boolean') {
        issues.push(routePath + '.consumeRequiredHeldItem must be boolean');
      }
      if (route.consumeRequiredHeldItem === true && route.requiredHeldItemId === undefined) {
        issues.push(routePath + '.consumeRequiredHeldItem requires requiredHeldItemId');
      }
    });
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
          if (!isOperationRecord(effect)) return;
          if (effect.kind === 'eventTrackDelta' && isNonEmptyOperationId(effect.trackId) && !trackIds.has(effect.trackId)) {
            issues.push(rulePath + '.effects[' + effectIndex + '].trackId references an undeclared track: ' + effect.trackId);
          } else if (effect.kind === 'eventFact' && isNonEmptyOperationId(effect.factId) && !factIds.has(effect.factId)) {
            issues.push(rulePath + '.effects[' + effectIndex + '].factId references an undeclared fact: ' + effect.factId);
          } else if (effect.kind === 'heldItem' && isNonEmptyOperationId(effect.itemId) && !itemIds.has(effect.itemId)) {
            issues.push(rulePath + '.effects[' + effectIndex + '].itemId references an undeclared item: ' + effect.itemId);
          }
        });
      }
    });
  });
  return locationIds;
}

/** Pure definition/reference validation. A non-empty result is a complete diagnostic list. */
export function validateOperationEventDef(definition: OperationEventDef): readonly string[] {
  const issues: string[] = [];
  if (!isOperationRecord(definition)) return ['event definition must be an object'];
  const raw = definition as unknown as Record<string, unknown>;
  if (!isNonEmptyOperationId(raw.id)) issues.push('id must be a non-empty ID');
  if (Object.prototype.hasOwnProperty.call(raw, 'actionRequirements')) {
    issues.push('actionRequirements is removed; declare trusted Action definitions in OperationResolvedContent');
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

  const locations = validateLocations(raw.locations, trackIds, facts, items, issues);
  if (!isNonEmptyOperationId(raw.initialLocationId) || !locations.has(raw.initialLocationId)) {
    issues.push('initialLocationId must reference a declared location');
  }
  if (!Number.isSafeInteger(raw.maxLocationVisits) || Number(raw.maxLocationVisits) <= 0) {
    issues.push('maxLocationVisits must be a positive safe integer');
  }

  validateObjectives(raw.objectives, trackIds, facts, 'objectives', issues);
  validateOutcomeConditions(raw.partialOutcomes, trackIds, facts, 'partialOutcomes', issues);
  validateOutcomeConditions(raw.hardFailureConditions, trackIds, facts, 'hardFailureConditions', issues);

  if (raw.rewards !== undefined) {
    if (!isOperationRecord(raw.rewards)) {
      issues.push('rewards must be an object');
    } else {
      rejectUnsupportedFields(raw.rewards, ['success', 'partialSuccess'], 'rewards', issues);
      const allowedResourceIds = new Set(['base:resource:credit', 'base:resource:pyroxene']);
      for (const outcome of ['success', 'partialSuccess'] as const) {
        const reward = raw.rewards[outcome];
        if (reward === undefined) continue;
        const path = 'rewards.' + outcome;
        if (!isOperationRecord(reward)) {
          issues.push(path + ' must be a resource reward object');
          continue;
        }
        rejectUnsupportedFields(reward, ['kind', 'resourceId', 'amount'], path, issues);
        if (reward.kind !== 'resource') issues.push(path + '.kind must be resource');
        if (typeof reward.resourceId !== 'string' || !allowedResourceIds.has(reward.resourceId)) {
          issues.push(path + '.resourceId is not in the Operation reward allowlist');
        }
        if (!Number.isSafeInteger(reward.amount) || Number(reward.amount) <= 0) {
          issues.push(path + '.amount must be a positive safe integer');
        }
      }
    }
  }

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
      if (actor.displayName !== undefined && (typeof actor.displayName !== 'string' || actor.displayName.trim() === '')) {
        issues.push(path + '.displayName must be a non-empty string when supplied');
      }
      if (actor.avatarRef !== undefined && typeof actor.avatarRef !== 'string') {
        issues.push(path + '.avatarRef must be a string when supplied');
      }
      if (actor.description !== undefined && typeof actor.description !== 'string') {
        issues.push(path + '.description must be a string when supplied');
      }
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

  if (!isOperationRecord(raw.playerRouteState)) {
    issues.push('playerRouteState must be an object');
  } else {
    rejectUnsupportedFields(raw.playerRouteState, ['playerCost'], 'playerRouteState', issues);
    const playerCost = raw.playerRouteState.playerCost;
    if (typeof playerCost !== 'number' || !Number.isFinite(playerCost) || playerCost < 0
      || playerCost > Number.MAX_SAFE_INTEGER) {
      issues.push('playerRouteState.playerCost must be a non-negative finite number in the safe numeric range');
    }
  }

  if (raw.playerSceneDeck !== undefined) {
    if (!isOperationRecord(raw.playerSceneDeck)) {
      issues.push('playerSceneDeck must be an object');
    } else {
      rejectUnsupportedFields(raw.playerSceneDeck, ['cards', 'initialDraw', 'locationEntryDraw', 'maxHandSize'], 'playerSceneDeck', issues);
      if (!Array.isArray(raw.playerSceneDeck.cards) || raw.playerSceneDeck.cards.length === 0) {
        issues.push('playerSceneDeck.cards must contain at least one card definition');
      }
      for (const field of ['initialDraw', 'locationEntryDraw'] as const) {
        const count = raw.playerSceneDeck[field];
        if (!Number.isSafeInteger(count) || Number(count) < 0) issues.push('playerSceneDeck.' + field + ' must be a non-negative safe integer');
      }
      if (!Number.isSafeInteger(raw.playerSceneDeck.maxHandSize) || Number(raw.playerSceneDeck.maxHandSize) <= 0) {
        issues.push('playerSceneDeck.maxHandSize must be a positive safe integer');
      }
      if (Array.isArray(raw.playerSceneDeck.cards)) {
        const cardIds = new Set<string>();
        raw.playerSceneDeck.cards.forEach((card, index) => {
          const path = 'playerSceneDeck.cards[' + index + ']';
          if (!isOperationRecord(card)) {
            issues.push(path + ' must be a PlayerSceneCard definition');
            return;
          }
          rejectUnsupportedFields(card, ['id', 'actionId', 'playerCost', 'timing', 'copies', 'selectionPolicy', 'performerPolicy', 'title', 'description'], path, issues);
          if (!isNonEmptyOperationId(card.id)) issues.push(path + '.id must be a non-empty card definition ID');
          else if (cardIds.has(card.id)) issues.push('playerSceneDeck.cards contains duplicate ID: ' + card.id);
          else cardIds.add(card.id);
          if (!isNonEmptyOperationId(card.actionId)) issues.push(path + '.actionId must be a non-empty Action ID');
          if (typeof card.playerCost !== 'number' || !Number.isFinite(card.playerCost) || card.playerCost < 0
            || card.playerCost > Number.MAX_SAFE_INTEGER) {
            issues.push(path + '.playerCost must be a non-negative finite number in the safe numeric range');
          }
          if (card.timing !== 'scene') issues.push(path + '.timing must be scene');
          if (card.selectionPolicy !== undefined && card.selectionPolicy !== 'required' && card.selectionPolicy !== 'fixed') issues.push(path + '.selectionPolicy must be required or fixed');
          if (card.performerPolicy !== undefined && card.performerPolicy !== 'selected-student' && card.performerPolicy !== 'none' && card.performerPolicy !== 'optional-student') issues.push(path + '.performerPolicy must be selected-student, none, or optional-student');
          if (card.title !== undefined && (typeof card.title !== 'string' || card.title.trim() === '')) issues.push(path + '.title must be a non-empty string when supplied');
          if (card.description !== undefined && typeof card.description !== 'string') issues.push(path + '.description must be a string when supplied');
          if (!Number.isSafeInteger(card.copies) || Number(card.copies) <= 0) issues.push(path + '.copies must be a positive safe integer');
        });
      }
    }
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
  rawActionDefinitions: unknown,
  rawStudentSkillRules: unknown,
): readonly string[] {
  const issues: string[] = [];
  if (!Array.isArray(value)) return ['actors must be an array of admitted actor snapshots'];

  const actionDefinitionsList: OperationActionDef[] = [];
  if (!Array.isArray(rawActionDefinitions)) {
    issues.push('actionDefinitions must be an array');
  } else {
    const seenActions = new Set<string>();
    rawActionDefinitions.forEach((action, index) => {
      const actionIssues = validateOperationActionDef(action);
      for (const issue of actionIssues) issues.push('actionDefinitions[' + index + ']: ' + issue);
      if (!isOperationRecord(action) || !isNonEmptyOperationId(action.id)) return;
      if (action.id === OPERATION_WAIT_ACTION_ID) issues.push('actionDefinitions contains the reserved Wait fallback ID');
      if (seenActions.has(action.id)) issues.push('actionDefinitions contains duplicate Action ID: ' + action.id);
      seenActions.add(action.id);
      if (actionIssues.length === 0) actionDefinitionsList.push(action as unknown as OperationActionDef);
    });
  }
  const actionDefinitions = new Map(actionDefinitionsList.map(action => [action.id, action]));
  const studentSkillRuleIds = new Set<string>();
  if (!Array.isArray(rawStudentSkillRules)) {
    issues.push('studentSkillRules must be an array');
  } else {
    const seenRules = new Set<string>();
    rawStudentSkillRules.forEach((rule, index) => {
      if (!isOperationRecord(rule) || !isNonEmptyOperationId(rule.id)) {
        issues.push('studentSkillRules[' + index + '].id must be a non-empty ID');
      } else if (seenRules.has(rule.id)) {
        issues.push('studentSkillRules contains duplicate Rule ID: ' + rule.id);
      } else {
        seenRules.add(rule.id);
        studentSkillRuleIds.add(rule.id);
      }
    });
  }

  const actorDefinitions = eventDefinition.actors;
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
    if (entry.displayName !== undefined && !isNonEmptyOperationId(entry.displayName)) issues.push(path + '.displayName must be a non-empty string when supplied');
    if (entry.avatarRef !== undefined && entry.avatarRef !== null && typeof entry.avatarRef !== 'string') issues.push(path + '.avatarRef must be a string or null when supplied');

    if (entry.participantKind === 'student') {
      rejectUnsupportedFields(entry, ['actorId', 'participantKind', 'characterId', 'displayName', 'avatarRef', 'profile'], path, issues);
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
      } else if (profile.randomSkillRuleId !== undefined && !studentSkillRuleIds.has(profile.randomSkillRuleId)) {
        issues.push(path + '.profile.randomSkillRuleId references a missing Student Skill Rule: ' + profile.randomSkillRuleId);
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
        const candidateSet = new Set(rawCandidateOrder);
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
          const action = actionDefinitions.get(candidate.actionId);
          if (!action) {
            issues.push(candidatePath + '.actionId is not declared by the Action catalog');
          } else {
            if (!action.allowedParticipantKinds.includes('student')) {
              issues.push(candidatePath + '.actionId does not allow student participants');
            }
            const expectedRequired = [...action.requiredCapabilityIds];
            if (!sameOrderedIds(candidate.requiredCapabilityIds, expectedRequired)) {
              issues.push(candidatePath + '.requiredCapabilityIds does not match the Action definition');
            }
            const expectedMissing = expectedRequired.filter(id => !capabilityIds.has(id));
            if (!sameOrderedIds(candidate.missingCapabilityIds, expectedMissing)) {
              issues.push(candidatePath + '.missingCapabilityIds does not match the Profile capabilities');
            }
            const profileReasonIds = Array.isArray(profile.reasonIds)
              ? profile.reasonIds.filter(isNonEmptyOperationId)
              : [];
            const expectedReasons = [...new Set([...profileReasonIds, ...action.reasonIds])];
            if (!sameOrderedIds(candidate.reasonIds, expectedReasons)) {
              issues.push(candidatePath + '.reasonIds does not match the Profile and Action reasons');
            }
            const expectedEligible = expectedMissing.length === 0;
            if (candidate.eligible !== expectedEligible) {
              issues.push(candidatePath + '.eligible does not match Action required capabilities');
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
          const action = actionDefinitions.get(candidate.actionId);
          if (action && action.requiredCapabilityIds.every(id => capabilityIds.has(id))) {
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
      rejectUnsupportedFields(entry, ['actorId', 'participantKind', 'displayName', 'avatarRef', 'factionId', 'candidateActionIds'], path, issues);
      if (entry.factionId !== undefined && !isNonEmptyOperationId(entry.factionId)) {
        issues.push(path + '.factionId must be a non-empty ID when supplied');
      }
      const candidateIds = collectIds(entry.candidateActionIds, path + '.candidateActionIds', issues);
      if (candidateIds.has(OPERATION_WAIT_ACTION_ID)) {
        issues.push(path + '.candidateActionIds contains the reserved Wait fallback ID');
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
