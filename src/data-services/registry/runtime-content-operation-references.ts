import type { RuntimeDefinitionRef } from '../contracts/runtime-content-browser';
import type { ReferenceEntry, ReferenceRequest } from './runtime-content-reference-types';
import {
  OPERATION_KIND as KIND,
  actionOwnerEvents,
  actionOwnerLocations,
  appendContextualCandidate,
  appendContextualLocal,
  appendDynamicContextualLocal,
  appendLocal,
  appendSceneActionChoiceLocal,
  asRecord,
  asString,
  fieldRows,
  localLocations,
  localLocationsInLocation,
  locationOwnerContexts,
  locationsForPool,
  poolOwnerEvents,
  refKey,
  refsFrom,
  rootPath,
  stringValues,
  type OperationContextEntry as ContextEntry,
  type OperationLocalTarget as LocalTarget,
  type OperationRecord as RecordValue,
} from './runtime-content-operation-context';

function appendGlobal(
  requests: ReferenceRequest[],
  path: string,
  value: unknown,
  relation: string,
  targetKind: string,
): void {
  const id = asString(value);
  if (id !== null) requests.push({
    path: rootPath(path),
    value: id,
    relation,
    confidence: 'declared',
    scope: 'global',
    targetKinds: [targetKind],
  });
}

function appendGlobalArray(
  requests: ReferenceRequest[],
  value: unknown,
  path: string,
  relation: string,
  targetKind: string,
): void {
  stringValues(value, path).forEach(row => appendGlobal(requests, row.path, row.value, relation, targetKind));
}

function appendPredicateLocals(
  requests: ReferenceRequest[],
  value: unknown,
  path: string,
  owner: ContextEntry,
  ancestors: WeakSet<object> = new WeakSet(),
): void {
  if (value === null || typeof value !== 'object' || ancestors.has(value)) return;
  const record = asRecord(value);
  if (!record) return;
  ancestors.add(value);
  try {
    if (record.kind === 'track') {
      const id = asString(record.trackId);
      if (id !== null) appendLocal(requests, `${path}.trackId`, id, 'Operation track', owner, localLocations(owner, 'track', id));
    } else if (record.kind === 'knownFact') {
      const id = asString(record.factId);
      if (id !== null) appendLocal(requests, `${path}.factId`, id, 'Operation fact', owner, localLocations(owner, 'fact', id));
    } else if (record.kind === 'all' || record.kind === 'any') {
      fieldRows(record, 'terms').forEach(row => appendPredicateLocals(requests, row.value, `${path}.${row.path}`, owner, ancestors));
    }
  } finally {
    ancestors.delete(value);
  }
}

function appendEventPredicates(requests: ReferenceRequest[], value: unknown, base: string, owner: ContextEntry): void {
  const prefix = (path: string): string => base ? `${base}.${path}` : path;
  fieldRows(asRecord(value), 'objectives').forEach(row => appendPredicateLocals(requests, asRecord(row.value)?.predicate, `${prefix(row.path)}.predicate`, owner));
  fieldRows(asRecord(value), 'partialOutcomes').forEach(row => appendPredicateLocals(requests, asRecord(row.value)?.predicate, `${prefix(row.path)}.predicate`, owner));
  fieldRows(asRecord(value), 'hardFailureConditions').forEach(row => appendPredicateLocals(requests, asRecord(row.value)?.predicate, `${prefix(row.path)}.predicate`, owner));
  fieldRows(asRecord(value), 'failureConditions').forEach(row => appendPredicateLocals(requests, asRecord(row.value)?.predicate, `${prefix(row.path)}.predicate`, owner));
}

function appendEffectLocal(
  requests: ReferenceRequest[],
  effect: unknown,
  path: string,
  owners: readonly ContextEntry[],
): void {
  const record = asRecord(effect);
  if (!record) return;
  const add = (field: string, target: LocalTarget, relation: string): void => {
    const id = asString(record[field]);
    if (id !== null) appendContextualLocal(requests, `${path}.${field}`, id, relation, owners, target);
  };
  const addDynamic = (field: string, target: LocalTarget, relation: string): void => {
    const id = asString(record[field]);
    if (id !== null) appendDynamicContextualLocal(requests, `${path}.${field}`, id, relation, owners, target);
  };
  if (record.kind === 'actorResourceDelta') addDynamic('resourceId', 'actor-resource', 'Operation actor resource');
  if (record.kind === 'teamResourceDelta') addDynamic('resourceId', 'team-resource', 'Operation team resource');
  if (record.kind === 'actorPosition') {
    const id = asString(record.positionId);
    if (id !== null) appendContextualCandidate(requests, `${path}.positionId`, id, 'Operation position', owners, (owner, value) => localLocations(owner, 'position', value));
  }
  if (record.kind === 'eventTrackDelta') add('trackId', 'track', 'Operation track');
  if (record.kind === 'eventFact') add('factId', 'fact', 'Operation fact');
  if (record.kind === 'heldItem') add('itemId', 'item', 'Operation item');
}

function appendEventEffects(requests: ReferenceRequest[], value: unknown, base: string, owner: ContextEntry): void {
  const prefix = (path: string): string => base ? `${base}.${path}` : path;
  fieldRows(asRecord(value), 'studentSkillRules').forEach(row => {
    fieldRows(asRecord(row.value), 'effects').forEach(effect => appendEffectLocal(requests, effect.value, `${prefix(row.path)}.${effect.path}`, [owner]));
  });
}

function appendActionLocalRefs(
  requests: ReferenceRequest[],
  value: RecordValue,
  owners: readonly ContextEntry[],
  locationOwners: readonly ContextEntry[],
): void {
  const target = asRecord(value.target);
  if (target?.kind === 'actor') {
    stringValues(target.allowedActorIds, 'target.allowedActorIds').forEach(row => appendContextualLocal(requests, row.path, row.value, 'Operation actor', owners, 'actor'));
    stringValues(target.allowedActorTypes, 'target.allowedActorTypes').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation actor type', owners, (owner, id) => localLocations(owner, 'actor-type', id)));
    stringValues(target.allowedPositionIds, 'target.allowedPositionIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation position', owners, (owner, id) => localLocations(owner, 'position', id)));
  }
  const cost = asRecord(value.cost);
  const resourceId = asString(cost?.resourceId);
  if (resourceId !== null) {
    const targetType: LocalTarget = cost?.scope === 'actor' ? 'actor-resource' : cost?.scope === 'team' ? 'team-resource' : 'resource';
    appendDynamicContextualLocal(requests, 'cost.resourceId', resourceId, 'Operation action cost resource', owners, targetType);
  }
  fieldRows(value, 'effects').forEach(row => appendEffectLocal(requests, row.value, row.path, owners));

  const condition = asRecord(value.cardCondition);
  if (!condition) return;
  stringValues(condition.requiredFactIds, 'cardCondition.requiredFactIds').forEach(row => appendContextualLocal(requests, row.path, row.value, 'Operation fact', owners, 'fact'));
  stringValues(condition.forbiddenFactIds, 'cardCondition.forbiddenFactIds').forEach(row => appendContextualLocal(requests, row.path, row.value, 'Operation fact', owners, 'fact'));
  stringValues(condition.positionIds, 'cardCondition.positionIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation position', owners, (owner, id) => localLocations(owner, 'position', id)));
  stringValues(condition.weaponIds, 'cardCondition.weaponIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation weapon', owners, (owner, id) => localLocations(owner, 'weapon', id)));
  stringValues(condition.sceneIds, 'cardCondition.sceneIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation scene context', locationOwners, (owner, id) => localLocationsInLocation(owner, 'scene', id)));
  stringValues(condition.activityIds, 'cardCondition.activityIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation activity context', locationOwners, (owner, id) => localLocationsInLocation(owner, 'activity', id)));
}

function appendPoolSelectorLocals(
  requests: ReferenceRequest[],
  value: RecordValue,
  eventOwners: readonly ContextEntry[],
  locationOwners: readonly ContextEntry[],
): void {
  const selector = asRecord(value.selector);
  if (!selector) return;
  stringValues(selector.requiredFactIds, 'selector.requiredFactIds').forEach(row => appendContextualLocal(requests, row.path, row.value, 'Operation fact', eventOwners, 'fact'));
  stringValues(selector.forbiddenFactIds, 'selector.forbiddenFactIds').forEach(row => appendContextualLocal(requests, row.path, row.value, 'Operation fact', eventOwners, 'fact'));
  stringValues(selector.positionIds, 'selector.positionIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation position', eventOwners, (owner, id) => localLocations(owner, 'position', id)));
  stringValues(selector.weaponIds, 'selector.weaponIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation weapon', eventOwners, (owner, id) => localLocations(owner, 'weapon', id)));
  stringValues(selector.sceneIds, 'selector.sceneIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation scene context', locationOwners, (owner, id) => localLocationsInLocation(owner, 'scene', id)));
  stringValues(selector.activityIds, 'selector.activityIds').forEach(row => appendContextualCandidate(requests, row.path, row.value, 'Operation activity context', locationOwners, (owner, id) => localLocationsInLocation(owner, 'activity', id)));
}

function collectEvent(
  requests: ReferenceRequest[],
  value: RecordValue,
  source: RuntimeDefinitionRef,
): void {
  const owner = { ref: source, value };
  appendGlobalArray(requests, value.locationIds, 'locationIds', 'Operation Location', KIND.locations);
  appendGlobal(requests, 'initialLocationId', value.initialLocationId, 'Initial Operation Location', KIND.locations);
  appendGlobal(requests, 'initId', value.initId, 'World Init', 'inits');
  appendGlobalArray(requests, value.cardPoolIds, 'cardPoolIds', 'Operation Card Pool', KIND.cardPools);
  const rewards = asRecord(value.rewards);
  for (const outcome of ['success', 'partialSuccess'] as const) {
    appendGlobal(requests, `rewards.${outcome}.resourceId`, asRecord(rewards?.[outcome])?.resourceId, 'Resource display', 'resourceDisplays');
  }
  fieldRows(value, 'participants').forEach(row => {
    const participant = asRecord(row.value);
    if (!participant) return;
    appendGlobalArray(requests, participant.candidateActionIds, `${row.path}.candidateActionIds`, 'Operation Action', KIND.actions);
    appendGlobal(requests, `${row.path}.profileId`, participant.profileId, 'Student Operation Profile', KIND.studentProfiles);
    const actorId = asString(participant.actorId);
    if (actorId !== null) appendLocal(requests, `${row.path}.actorId`, actorId, 'Operation actor', owner, localLocations(owner, 'actor', actorId));
  });
  fieldRows(value, 'studentSkillRules').forEach(row => {
    const rule = asRecord(row.value);
    appendGlobalArray(requests, rule?.triggerActionIds, `${row.path}.triggerActionIds`, 'Operation Action', KIND.actions);
  });
  fieldRows(asRecord(value.playerSceneDeck), 'cards').forEach(row => {
    appendGlobal(requests, `playerSceneDeck.${row.path}.actionId`, asRecord(row.value)?.actionId, 'Operation Action', KIND.actions);
  });
  stringValues(value.knownFactIds, 'knownFactIds').forEach(row => appendLocal(requests, row.path, row.value, 'Operation fact', owner, localLocations(owner, 'fact', row.value)));
  stringValues(value.heldItemIds, 'heldItemIds').forEach(row => appendLocal(requests, row.path, row.value, 'Operation item', owner, localLocations(owner, 'item', row.value)));
  fieldRows(value, 'actors').forEach(row => {
    const actor = asRecord(row.value);
    appendGlobal(requests, `${row.path}.avatarRef`, actor?.avatarRef, 'Operation actor avatar picture', 'pics');
    const teamId = asString(actor?.teamId);
    if (teamId !== null) appendLocal(requests, `${row.path}.teamId`, teamId, 'Operation team', owner, localLocations(owner, 'team', teamId));
    stringValues(actor?.targetPriorityActorIds, `${row.path}.targetPriorityActorIds`).forEach(target => {
      appendLocal(requests, target.path, target.value, 'Operation actor', owner, localLocations(owner, 'actor', target.value));
    });
  });
  appendEventPredicates(requests, value, '', owner);
  appendEventEffects(requests, value, '', owner);
}

function collectLocation(
  requests: ReferenceRequest[],
  value: RecordValue,
  source: RuntimeDefinitionRef,
  events: readonly ContextEntry[],
): void {
  const owner = { ref: source, value };
  const eventOwners = locationOwnerContexts(owner, events);
  appendGlobalArray(requests, value.cardPoolIds, 'cardPoolIds', 'Operation Card Pool', KIND.cardPools);
  appendGlobalArray(requests, value.enabledActionIds, 'enabledActionIds', 'Operation Action', KIND.actions);
  fieldRows(value, 'routeEdges').forEach(row => {
    const edge = asRecord(row.value);
    appendGlobal(requests, `${row.path}.targetLocationId`, edge?.targetLocationId, 'Operation Location', KIND.locations);
    const requiredItem = asString(edge?.requiredHeldItemId);
    if (requiredItem !== null) appendContextualLocal(requests, `${row.path}.requiredHeldItemId`, requiredItem, 'Operation item', eventOwners, 'item');
    stringValues(edge?.anyOfHeldItemIds, `${row.path}.anyOfHeldItemIds`).forEach(item => appendContextualLocal(requests, item.path, item.value, 'Operation item', eventOwners, 'item'));
  });
  fieldRows(value, 'scenes').forEach(row => {
    const scene = asRecord(row.value);
    appendGlobalArray(requests, scene?.enabledActionIds, `${row.path}.enabledActionIds`, 'Operation Action', KIND.actions);
    fieldRows(scene, 'sceneActions').forEach(action => appendGlobal(requests, `${row.path}.${action.path}.actionId`, asRecord(action.value)?.actionId, 'Operation Action', KIND.actions));
    fieldRows(scene, 'purchaseOffers').forEach(offer => appendGlobal(requests, `${row.path}.${offer.path}.actionId`, asRecord(offer.value)?.actionId, 'Operation Action', KIND.actions));
    appendSceneActionChoiceLocal(requests, scene?.sceneActionChoice, `${row.path}.sceneActionChoice`, scene, row.path, owner);
    fieldRows(scene, 'purchaseOffers').forEach(offer => {
      const factId = asString(asRecord(offer.value)?.purchaseFactId);
      if (factId !== null) appendContextualLocal(requests, `${row.path}.${offer.path}.purchaseFactId`, factId, 'Operation fact', eventOwners, 'fact');
    });
    if (scene) appendPredicateLocalsForContexts(requests, scene.completion, `${row.path}.completion`, eventOwners);
  });
  fieldRows(value, 'sceneActions').forEach(action => appendGlobal(requests, `${action.path}.actionId`, asRecord(action.value)?.actionId, 'Operation Action', KIND.actions));
  fieldRows(value, 'purchaseOffers').forEach(offer => {
    appendGlobal(requests, `${offer.path}.actionId`, asRecord(offer.value)?.actionId, 'Operation Action', KIND.actions);
    const factId = asString(asRecord(offer.value)?.purchaseFactId);
    if (factId !== null) appendContextualLocal(requests, `${offer.path}.purchaseFactId`, factId, 'Operation fact', eventOwners, 'fact');
  });
  appendSceneActionChoiceLocal(requests, value.sceneActionChoice, 'sceneActionChoice', value, '', owner);
  appendLocationPredicates(requests, value, eventOwners);
}

function appendPredicateLocalsForContexts(
  requests: ReferenceRequest[],
  predicate: unknown,
  path: string,
  owners: readonly ContextEntry[],
  ancestors: WeakSet<object> = new WeakSet(),
): void {
  if (predicate === null || typeof predicate !== 'object' || ancestors.has(predicate)) return;
  const record = asRecord(predicate);
  if (!record) return;
  ancestors.add(predicate);
  try {
    if (record.kind === 'track') {
      const id = asString(record.trackId);
      if (id !== null) appendContextualLocal(requests, `${path}.trackId`, id, 'Operation track', owners, 'track');
    } else if (record.kind === 'knownFact') {
      const id = asString(record.factId);
      if (id !== null) appendContextualLocal(requests, `${path}.factId`, id, 'Operation fact', owners, 'fact');
    } else if (record.kind === 'all' || record.kind === 'any') {
      fieldRows(record, 'terms').forEach(row => appendPredicateLocalsForContexts(requests, row.value, `${path}.${row.path}`, owners, ancestors));
    }
  } finally {
    ancestors.delete(predicate);
  }
}

function appendLocationPredicates(
  requests: ReferenceRequest[],
  value: RecordValue,
  owners: readonly ContextEntry[],
): void {
  for (const field of ['objectives', 'partialOutcomes', 'failureConditions'] as const) {
    fieldRows(value, field).forEach(row => appendPredicateLocalsForContexts(requests, asRecord(row.value)?.predicate, `${row.path}.predicate`, owners));
  }
}

function collectStudentProfile(
  requests: ReferenceRequest[],
  value: RecordValue,
  source: RuntimeDefinitionRef,
  events: readonly ContextEntry[],
): void {
  appendGlobal(requests, 'characterId', value.characterId, 'Character', 'characters');
  appendGlobalArray(requests, value.candidateActionIds, 'candidateActionIds', 'Operation Action', KIND.actions);
  appendGlobalArray(requests, value.actionPriorityIds, 'actionPriorityIds', 'Operation Action', KIND.actions);
  appendGlobal(requests, 'strategyProfileId', value.strategyProfileId, 'Operation Strategy Profile', KIND.strategyProfiles);
  appendGlobalArray(requests, value.cardPoolIds, 'cardPoolIds', 'Operation Card Pool', KIND.cardPools);
  const skillRuleId = asString(value.randomSkillRuleId);
  if (skillRuleId !== null) {
    const owners = events.filter(event => fieldRows(event.value, 'participants').some(row => asRecord(row.value)?.profileId === source.fullId));
    appendContextualLocal(requests, 'randomSkillRuleId', skillRuleId, 'Operation student skill rule', owners, 'skill-rule');
  }
}

function collectAction(
  requests: ReferenceRequest[],
  value: RecordValue,
  source: RuntimeDefinitionRef,
  events: readonly ContextEntry[],
  locations: readonly ContextEntry[],
  profiles: readonly ContextEntry[],
  pools: readonly ContextEntry[],
): void {
  const actionId = source.fullId;
  const owners = actionId === null ? [] : actionOwnerEvents(actionId, events, locations, profiles, pools);
  const locationOwners = actionId === null ? [] : actionOwnerLocations(actionId, locations, events, profiles, pools);
  appendActionLocalRefs(requests, value, owners, locationOwners);
}

function collectCardPool(
  requests: ReferenceRequest[],
  value: RecordValue,
  source: RuntimeDefinitionRef,
  events: readonly ContextEntry[],
  locations: readonly ContextEntry[],
  profiles: readonly ContextEntry[],
): void {
  fieldRows(value, 'entries').forEach(row => appendGlobal(requests, `${row.path}.actionId`, asRecord(row.value)?.actionId, 'Operation Action', KIND.actions));
  const poolId = source.fullId;
  const eventOwners = poolId === null ? [] : poolOwnerEvents(poolId, events, locations, profiles);
  const locationOwners = poolId === null ? [] : locationsForPool(poolId, locations, events, profiles);
  appendPoolSelectorLocals(requests, value, eventOwners, locationOwners);
}

/** Collect only declared Operation links and owner-scoped Operation facts. */
export function collectOperationReferences(
  source: RuntimeDefinitionRef,
  value: unknown,
  entries: readonly ReferenceEntry[],
): readonly ReferenceRequest[] {
  const record = asRecord(value);
  if (!record) return [];
  const requests: ReferenceRequest[] = [];
  const events = refsFrom(entries, KIND.events);
  const locations = refsFrom(entries, KIND.locations);
  const profiles = refsFrom(entries, KIND.studentProfiles);
  const pools = refsFrom(entries, KIND.cardPools);

  if (source.definitionKind === KIND.events) collectEvent(requests, record, source);
  if (source.definitionKind === KIND.locations) collectLocation(requests, record, source, events);
  if (source.definitionKind === KIND.studentProfiles) collectStudentProfile(requests, record, source, events);
  if (source.definitionKind === KIND.actions) collectAction(requests, record, source, events, locations, profiles, pools);
  if (source.definitionKind === KIND.cardPools) collectCardPool(requests, record, source, events, locations, profiles);

  const unique = new Map<string, ReferenceRequest>();
  for (const request of requests) {
    const context = request.context ? refKey(request.context) : '';
    const key = `${request.path}\u0000${request.value}\u0000${request.scope}\u0000${context}\u0000${request.relation}`;
    if (!unique.has(key)) unique.set(key, request);
  }
  return Object.freeze([...unique.values()].map(request => Object.freeze({
    ...request,
    ...(request.targetKinds ? { targetKinds: Object.freeze([...request.targetKinds]) } : {}),
    ...(request.locations ? { locations: Object.freeze([...request.locations.map(location => Object.freeze({ ...location }))]) } : {}),
  })));
}
