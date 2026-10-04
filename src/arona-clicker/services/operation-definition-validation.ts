import type { OperationBoundedValueDef, OperationCardZones, OperationEventDef } from '../contracts/operation';

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
