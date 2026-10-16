import type { RuntimeDefinitionRef } from '../contracts/runtime-content-browser';
import type { ReferenceEntry, ReferenceLocation, ReferenceRequest } from './runtime-content-reference-types';

type Entry = ReferenceEntry;
export const OPERATION_KIND = {
  events: 'operationEvents',
  locations: 'operationLocations',
  actions: 'operationActions',
  studentProfiles: 'studentOperationProfiles',
  strategyProfiles: 'operationStrategyProfiles',
  cardPools: 'operationCardPools',
} as const;

export type OperationRecord = Record<string, unknown>;
export type OperationLocalTarget = 'actor' | 'team' | 'track' | 'fact' | 'item' | 'position' | 'weapon' | 'actor-type' | 'actor-resource' | 'team-resource' | 'resource' | 'skill-rule';
export type OperationContextEntry = { readonly ref: RuntimeDefinitionRef; readonly value: OperationRecord };

export function asRecord(value: unknown): OperationRecord | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const record = Object.create(null) as OperationRecord;
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) record[key] = descriptor.value;
    }
    return record;
  } catch {
    return null;
  }
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asRows(value: unknown): readonly unknown[] {
  try {
    if (!Array.isArray(value)) return [];
    const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 100_000) return [];
    const rows: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      rows.push(descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined);
    }
    return rows;
  } catch {
    return [];
  }
}

export function fieldRows(value: unknown, field: string): readonly { readonly value: unknown; readonly path: string }[] {
  const rows = asRows(asRecord(value)?.[field]);
  return rows.map((row, index) => ({ value: row, path: `${field}[${index}]` }));
}

export function refKey(ref: RuntimeDefinitionRef): string {
  return `${ref.definitionKind}\u0000${ref.fullId ?? ''}`;
}

export function rootPath(path: string): string {
  if (path.startsWith('$')) return path;
  return `$${path.startsWith('.') ? path : `.${path}`}`;
}

function entryRef(entry: Entry): RuntimeDefinitionRef {
  return entry.ref;
}

function entriesOf(entries: readonly Entry[], kind: string): readonly Entry[] {
  return entries.filter(entry => !entry.derived && entry.ref.definitionKind === kind && entry.ref.fullId !== null);
}

function refsUnique(entries: readonly OperationContextEntry[]): readonly OperationContextEntry[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = refKey(entry.ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function refsFrom(entries: readonly Entry[], kind: string): readonly OperationContextEntry[] {
  return entriesOf(entries, kind).flatMap(entry => {
    const value = asRecord(entry.value);
    return value ? [{ ref: entryRef(entry), value }] : [];
  });
}

export function stringValues(value: unknown, path: string): readonly { readonly value: string; readonly path: string }[] {
  return asRows(value).flatMap((item, index) => {
    const text = asString(item);
    return text === null ? [] : [{ value: text, path: `${path}[${index}]` }];
  });
}

export function localLocations(owner: OperationContextEntry, target: OperationLocalTarget, value: string): readonly ReferenceLocation[] {
  const locations: ReferenceLocation[] = [];
  const add = (path: string, candidate: unknown): void => {
    if (candidate === value) locations.push({ ref: owner.ref, path });
  };
  const rows = (field: string): readonly { readonly value: OperationRecord; readonly path: string }[] =>
    fieldRows(owner.value, field).flatMap(row => {
      const record = asRecord(row.value);
      return record ? [{ value: record, path: row.path }] : [];
    });

  if (target === 'track') {
    rows('tracks').forEach(row => add(`${row.path}.id`, row.value.id));
  } else if (target === 'fact') {
    stringValues(owner.value.factIds, 'factIds').forEach(row => add(row.path, row.value));
  } else if (target === 'item') {
    stringValues(owner.value.itemIds, 'itemIds').forEach(row => add(row.path, row.value));
  } else if (target === 'actor') {
    rows('actors').forEach(row => add(`${row.path}.id`, row.value.id));
  } else if (target === 'team') {
    rows('teams').forEach(row => add(`${row.path}.id`, row.value.id));
  } else if (target === 'position') {
    rows('actors').forEach(row => add(`${row.path}.positionId`, row.value.positionId));
  } else if (target === 'weapon') {
    rows('actors').forEach(row => add(`${row.path}.weaponId`, row.value.weaponId));
  } else if (target === 'actor-type') {
    rows('actors').forEach(row => add(`${row.path}.type`, row.value.type));
  } else if (target === 'skill-rule') {
    rows('studentSkillRules').forEach(row => add(`${row.path}.id`, row.value.id));
  } else if (target === 'actor-resource' || target === 'resource') {
    rows('actors').forEach(actor => {
      const resources = asRecord(actor.value.resources);
      if (resources) Object.keys(resources).forEach(key => add(`${actor.path}.resources[${JSON.stringify(key)}]`, key));
    });
  }

  if (target === 'team-resource' || target === 'resource') {
    rows('teams').forEach(team => {
      const resources = asRecord(team.value.resources);
      if (resources) Object.keys(resources).forEach(key => add(`${team.path}.resources[${JSON.stringify(key)}]`, key));
    });
  }
  return locations;
}

export function localLocationsInLocation(owner: OperationContextEntry, target: 'scene-action' | 'scene' | 'activity', value: string): readonly ReferenceLocation[] {
  const locations: ReferenceLocation[] = [];
  const add = (path: string, candidate: unknown): void => {
    if (candidate === value) locations.push({ ref: owner.ref, path });
  };
  const addSceneActions = (record: OperationRecord, path: string): void => {
    fieldRows(record, 'sceneActions').forEach(row => {
      const action = asRecord(row.value);
      if (action) add(`${path ? `${path}.` : ''}${row.path}.id`, action.id);
    });
  };

  if (target === 'activity') add('activityId', owner.value.activityId);
  if (target === 'scene') {
    add('interactionSceneId', owner.value.interactionSceneId);
    fieldRows(owner.value, 'scenes').forEach(row => {
      const scene = asRecord(row.value);
      if (scene) add(`${row.path}.id`, scene.id);
    });
  }
  if (target === 'scene-action') {
    addSceneActions(owner.value, '');
    fieldRows(owner.value, 'scenes').forEach(row => {
      const scene = asRecord(row.value);
      if (scene) addSceneActions(scene, row.path);
    });
  }
  return locations;
}

export function eventsForLocation(locationId: string, events: readonly OperationContextEntry[]): readonly OperationContextEntry[] {
  return events.filter(event => stringValues(event.value.locationIds, 'locationIds').some(row => row.value === locationId));
}

export function hasId(value: unknown, id: string): boolean {
  return stringValues(value, '').some(row => row.value === id);
}

function poolHasAction(pool: OperationContextEntry, actionId: string): boolean {
  return fieldRows(pool.value, 'entries').some(row => asRecord(row.value)?.actionId === actionId);
}

function profileHasAction(profile: OperationContextEntry, actionId: string, pools: readonly OperationContextEntry[]): boolean {
  const direct = hasId(profile.value.candidateActionIds, actionId) || hasId(profile.value.actionPriorityIds, actionId);
  const poolIds = stringValues(profile.value.cardPoolIds, 'cardPoolIds').map(row => row.value);
  return direct || pools.some(pool => poolIds.includes(pool.ref.fullId ?? '') && poolHasAction(pool, actionId));
}

function locationHasAction(location: OperationContextEntry, actionId: string, pools: readonly OperationContextEntry[]): boolean {
  const direct = hasId(location.value.enabledActionIds, actionId)
    || fieldRows(location.value, 'scenes').some(row => hasId(asRecord(row.value)?.enabledActionIds, actionId))
    || fieldRows(location.value, 'sceneActions').some(row => asRecord(row.value)?.actionId === actionId)
    || fieldRows(location.value, 'purchaseOffers').some(row => asRecord(row.value)?.actionId === actionId)
    || fieldRows(location.value, 'scenes').some(row => {
      const scene = asRecord(row.value);
      return fieldRows(scene, 'sceneActions').some(action => asRecord(action.value)?.actionId === actionId)
        || fieldRows(scene, 'purchaseOffers').some(offer => asRecord(offer.value)?.actionId === actionId);
    });
  const poolIds = stringValues(location.value.cardPoolIds, 'cardPoolIds').map(row => row.value);
  return direct || pools.some(pool => poolIds.includes(pool.ref.fullId ?? '') && poolHasAction(pool, actionId));
}

function eventHasAction(
  event: OperationContextEntry,
  actionId: string,
  profiles: readonly OperationContextEntry[],
  pools: readonly OperationContextEntry[],
): boolean {
  const direct = fieldRows(event.value, 'participants').some(row => {
    const participant = asRecord(row.value);
    return hasId(participant?.candidateActionIds, actionId);
  })
    || fieldRows(event.value, 'studentSkillRules').some(row => hasId(asRecord(row.value)?.triggerActionIds, actionId))
    || fieldRows(asRecord(event.value.playerSceneDeck), 'cards').some(row => asRecord(row.value)?.actionId === actionId);
  const profileIds = fieldRows(event.value, 'participants').flatMap(row => {
    const profileId = asString(asRecord(row.value)?.profileId);
    return profileId === null ? [] : [profileId];
  });
  const eventProfileUsesAction = profiles.some(profile => profileIds.includes(profile.ref.fullId ?? '')
    && profileHasAction(profile, actionId, pools));
  const poolIds = stringValues(event.value.cardPoolIds, 'cardPoolIds').map(row => row.value);
  const eventPoolUsesAction = pools.some(pool => poolIds.includes(pool.ref.fullId ?? '') && poolHasAction(pool, actionId));
  return direct || eventProfileUsesAction || eventPoolUsesAction;
}

export function actionOwnerEvents(
  actionId: string,
  events: readonly OperationContextEntry[],
  locations: readonly OperationContextEntry[],
  profiles: readonly OperationContextEntry[],
  pools: readonly OperationContextEntry[],
): readonly OperationContextEntry[] {
  const owners = events.filter(event => eventHasAction(event, actionId, profiles, pools));
  for (const location of locations) {
    if (!locationHasAction(location, actionId, pools)) continue;
    owners.push(...eventsForLocation(location.ref.fullId ?? '', events));
  }
  return refsUnique(owners);
}

export function locationOwnerContexts(
  source: OperationContextEntry,
  events: readonly OperationContextEntry[],
): readonly OperationContextEntry[] {
  return refsUnique(eventsForLocation(source.ref.fullId ?? '', events));
}

export function poolOwnerEvents(
  poolId: string,
  events: readonly OperationContextEntry[],
  locations: readonly OperationContextEntry[],
  profiles: readonly OperationContextEntry[],
): readonly OperationContextEntry[] {
  const owners = events.filter(event => hasId(event.value.cardPoolIds, poolId)
    || fieldRows(event.value, 'participants').some(row => {
      const profileId = asString(asRecord(row.value)?.profileId);
      return profileId !== null && profiles.some(profile => profile.ref.fullId === profileId && hasId(profile.value.cardPoolIds, poolId));
    }));
  for (const location of locations) {
    if (!hasId(location.value.cardPoolIds, poolId)) continue;
    owners.push(...eventsForLocation(location.ref.fullId ?? '', events));
  }
  return refsUnique(owners);
}

export function locationsForPool(
  poolId: string,
  locations: readonly OperationContextEntry[],
  events: readonly OperationContextEntry[],
  profiles: readonly OperationContextEntry[],
): readonly OperationContextEntry[] {
  const owners = locations.filter(location => hasId(location.value.cardPoolIds, poolId));
  for (const event of poolOwnerEvents(poolId, events, locations, profiles)) {
    const locationIds = stringValues(event.value.locationIds, 'locationIds').map(row => row.value);
    owners.push(...locations.filter(location => locationIds.includes(location.ref.fullId ?? '')));
  }
  return refsUnique(owners);
}

export function actionOwnerLocations(
  actionId: string,
  locations: readonly OperationContextEntry[],
  events: readonly OperationContextEntry[],
  profiles: readonly OperationContextEntry[],
  pools: readonly OperationContextEntry[],
): readonly OperationContextEntry[] {
  const owners = locations.filter(location => locationHasAction(location, actionId, pools));
  for (const event of events) {
    if (!eventHasAction(event, actionId, profiles, pools)) continue;
    const locationIds = stringValues(event.value.locationIds, 'locationIds').map(row => row.value);
    owners.push(...locations.filter(location => locationIds.includes(location.ref.fullId ?? '')));
  }
  return refsUnique(owners);
}

function matchingLocations(
  owner: OperationContextEntry,
  target: OperationLocalTarget,
  value: string,
): readonly ReferenceLocation[] {
  return localLocations(owner, target, value);
}

export function appendLocal(
  requests: ReferenceRequest[],
  path: string,
  value: string,
  relation: string,
  owner: OperationContextEntry,
  locations: readonly ReferenceLocation[],
): void {
  requests.push({
    path: rootPath(path),
    value,
    relation,
    confidence: 'declared',
    scope: 'local',
    locations: locations.map(location => ({ ...location, path: rootPath(location.path) })),
    context: owner.ref,
  });
}

export function appendContextualLocal(
  requests: ReferenceRequest[],
  path: string,
  value: string,
  relation: string,
  owners: readonly OperationContextEntry[],
  target: OperationLocalTarget,
): void {
  if (!value) return;
  if (owners.length === 0) {
    requests.push({ path: rootPath(path), value, relation, confidence: 'inferred', scope: 'candidate', locations: [] });
    return;
  }
  owners.forEach(owner => appendLocal(requests, path, value, relation, owner, matchingLocations(owner, target, value)));
}

export function appendContextualLocationLocal(
  requests: ReferenceRequest[],
  path: string,
  value: string,
  relation: string,
  owners: readonly OperationContextEntry[],
  target: 'scene-action' | 'scene' | 'activity',
): void {
  if (!value) return;
  if (owners.length === 0) {
    requests.push({ path: rootPath(path), value, relation, confidence: 'inferred', scope: 'candidate', locations: [] });
    return;
  }
  owners.forEach(owner => appendLocal(requests, path, value, relation, owner, localLocationsInLocation(owner, target, value)));
}

export function appendDynamicContextualLocal(
  requests: ReferenceRequest[],
  path: string,
  value: string,
  relation: string,
  owners: readonly OperationContextEntry[],
  target: OperationLocalTarget,
): void {
  if (owners.length === 0) {
    requests.push({ path: rootPath(path), value, relation, confidence: 'inferred', scope: 'candidate', locations: [] });
    return;
  }
  owners.forEach(owner => {
    const locations = localLocations(owner, target, value);
    if (locations.length > 1) {
      requests.push({
        path: rootPath(path),
        value,
        relation,
        confidence: 'inferred',
        scope: 'candidate',
        locations: locations.map(location => ({ ...location, path: rootPath(location.path) })),
        context: owner.ref,
      });
    } else appendLocal(requests, path, value, relation, owner, locations);
  });
}

export function appendContextualCandidate(
  requests: ReferenceRequest[],
  path: string,
  value: string,
  relation: string,
  owners: readonly OperationContextEntry[],
  locate: (owner: OperationContextEntry, value: string) => readonly ReferenceLocation[],
): void {
  if (owners.length === 0) {
    requests.push({ path: rootPath(path), value, relation, confidence: 'inferred', scope: 'candidate', locations: [] });
    return;
  }
  owners.forEach(owner => requests.push({
    path: rootPath(path),
    value,
    relation,
    confidence: 'inferred',
    scope: 'candidate',
    locations: locate(owner, value).map(location => ({ ...location, path: rootPath(location.path) })),
    context: owner.ref,
  }));
}

export function appendSceneActionChoiceLocal(
  requests: ReferenceRequest[],
  choice: unknown,
  choicePath: string,
  actionContainer: unknown,
  actionBase: string,
  owner: OperationContextEntry,
): void {
  const choiceValue = asRecord(choice);
  stringValues(choiceValue?.candidateSceneActionIds, `${choicePath}.candidateSceneActionIds`).forEach(candidate => {
    const locations = fieldRows(actionContainer, 'sceneActions').flatMap(action => {
      const actionValue = asRecord(action.value);
      return actionValue?.id === candidate.value
        ? [{ ref: owner.ref, path: `${actionBase ? `${actionBase}.` : ''}${action.path}.id` }]
        : [];
    });
    appendLocal(requests, candidate.path, candidate.value, 'Operation Scene Action', owner, locations);
  });
}

