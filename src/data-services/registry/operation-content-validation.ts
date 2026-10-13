import type { Datapack } from '../contracts/datapack';
import type {
  OperationActionDef,
  OperationCardConditionDef,
  OperationCardPoolDef,
  OperationEventContentDef,
  OperationLocationDef,
  OperationSceneDef,
  OperationScenePurchaseOfferDef,
  OperationStrategyProfileDef,
  StudentOperationProfileDef,
} from '../contracts/operation';

const MAX_EVENT_LOCATIONS = 20;
const MAX_EVENT_VISITS = 100;
const MAX_OPERATION_LOCATION_VISITS = 100;
const MAX_OPERATION_SCENES = 32;
const MAX_SCENE_BATCHES = 10;
const MAX_CARD_COPIES = 40;
const MAX_HAND_SIZE = 12;
const MAX_CHARACTER_HAND_SIZE = 10;
const MAX_OPERATION_POOL_ENTRIES = 64;
const MAX_OPERATION_POOL_WEIGHT = 100_000;
const MAX_STRATEGY_BIASES = 16;
const MAX_STRATEGY_BIAS_BPS = 30_000;

export interface OperationContentValidationContext {
  readonly initIds?: ReadonlySet<string>;
  readonly characterIds?: ReadonlySet<string>;
  readonly locations?: ReadonlyMap<string, OperationLocationDef>;
  readonly actions?: ReadonlyMap<string, OperationActionDef>;
  readonly profiles?: ReadonlyMap<string, StudentOperationProfileDef>;
  readonly strategyProfiles?: ReadonlyMap<string, OperationStrategyProfileDef>;
  readonly cardPools?: ReadonlyMap<string, OperationCardPoolDef>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function localId(value: unknown): value is string {
  return nonEmpty(value) && /^[a-z0-9_-]+$/.test(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeCount(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
}

function mergeById<T extends { readonly id: string }>(
  prior: ReadonlyMap<string, T> | undefined,
  incoming: readonly T[] | undefined,
): Map<string, T> {
  const result = new Map(prior ?? []);
  for (const value of incoming ?? []) result.set(value.id, value);
  return result;
}

function readIds(value: unknown, path: string, issues: string[], local = false): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    issues.push(path + ' must be an array of IDs');
    return ids;
  }
  value.forEach((id, index) => {
    const valid = local ? localId(id) : nonEmpty(id);
    if (!valid) issues.push(path + '[' + index + '] must be a ' + (local ? 'local' : 'non-empty') + ' ID');
    else if (ids.has(id)) issues.push(path + ' contains duplicate ID: ' + id);
    else ids.add(id);
  });
  return ids;
}

function checkCardConditionShape(value: unknown, path: string, issues: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push(path + ' must be a finite Operation CardCondition object');
    return;
  }
  const allowed = new Set(['sceneIds', 'activityIds', 'positionIds', 'weaponIds', 'requiredFactIds', 'forbiddenFactIds']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(path + ' contains unsupported selector field: ' + key);
  const required = readIds(value.requiredFactIds ?? [], path + '.requiredFactIds', issues);
  const forbidden = readIds(value.forbiddenFactIds ?? [], path + '.forbiddenFactIds', issues);
  for (const field of ['sceneIds', 'activityIds', 'positionIds', 'weaponIds']) readIds(value[field] ?? [], path + '.' + field, issues);
  for (const id of required) if (forbidden.has(id)) issues.push(path + ' fact cannot be both required and forbidden: ' + id);
}

function checkSceneActionChoiceShape(
  value: unknown,
  sceneActions: readonly unknown[] | undefined,
  actionMode: unknown,
  path: string,
  issues: string[],
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.push(path + ' must be a SceneAction choice object');
    return;
  }
  for (const key of Object.keys(value)) if (key !== 'candidateSceneActionIds' && key !== 'chooseExactly') {
    issues.push(path + ' contains unsupported field: ' + key);
  }
  const candidates = readIds(value.candidateSceneActionIds, path + '.candidateSceneActionIds', issues, true);
  if (candidates.size < 2) issues.push(path + '.candidateSceneActionIds must contain at least two SceneAction IDs');
  if (!safeCount(value.chooseExactly, 1, candidates.size)) issues.push(path + '.chooseExactly must be between 1 and the candidate count');
  if (actionMode !== 'global') issues.push(path + ' requires global SceneAction mode');
  const actions = new Map<string, Record<string, unknown>>();
  for (const action of sceneActions ?? []) if (isRecord(action) && localId(action.id)) actions.set(action.id, action);
  for (const id of candidates) {
    const action = actions.get(id);
    if (!action) issues.push(path + '.candidateSceneActionIds references an undeclared SceneAction: ' + id);
    else if (action.scope !== 'global' || action.selectionPolicy === 'fixed') {
      issues.push(path + '.candidateSceneActionIds must reference required Global SceneActions: ' + id);
    }
  }
  for (const action of actions.values()) if (action.scope === 'global' && action.selectionPolicy !== 'fixed' && !candidates.has(String(action.id))) {
    issues.push(path + ' must include every selectable Global SceneAction in candidateSceneActionIds');
  }
}

function checkPurchaseOffersShape(
  value: unknown,
  path: string,
  actionMode: unknown,
  sceneActionBatches: unknown,
  issues: string[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(path + ' must contain at least one purchase offer');
    return;
  }
  if (actionMode !== 'global' || (sceneActionBatches !== undefined && !safeCount(sceneActionBatches, 1, MAX_SCENE_BATCHES))) {
    issues.push(path + ' requires global SceneAction mode and, when supplied, a positive batch limit');
  }
  const offerIds = new Set<string>();
  value.forEach((offer, index) => {
    const offerPath = path + '[' + index + ']';
    if (!isRecord(offer)) {
      issues.push(offerPath + ' must be a PurchaseOffer object');
      return;
    }
    for (const key of Object.keys(offer)) if (!['id', 'actionId', 'playerCost', 'purchaseFactId', 'title', 'description'].includes(key)) {
      issues.push(offerPath + ' contains unsupported field: ' + key);
    }
    if (!localId(offer.id)) issues.push(offerPath + '.id must be a local PurchaseOffer ID');
    else if (offerIds.has(offer.id)) issues.push(path + ' contains duplicate PurchaseOffer ID: ' + offer.id);
    else offerIds.add(offer.id);
    if (!nonEmpty(offer.actionId)) issues.push(offerPath + '.actionId must be a full Action ID');
    if (!safeCount(offer.playerCost, 0, Number.MAX_SAFE_INTEGER)) issues.push(offerPath + '.playerCost must be a non-negative safe integer');
    if (!nonEmpty(offer.purchaseFactId)) issues.push(offerPath + '.purchaseFactId must be an Event fact ID');
    if (offer.title !== undefined && (typeof offer.title !== 'string' || offer.title.trim() === '')) issues.push(offerPath + '.title must be non-empty when supplied');
    if (offer.description !== undefined && typeof offer.description !== 'string') issues.push(offerPath + '.description must be a string');
  });
}

function checkCardConditionFacts(value: OperationCardConditionDef | undefined, path: string, facts: ReadonlySet<string>, issues: string[]): void {
  for (const field of ['requiredFactIds', 'forbiddenFactIds'] as const) {
    for (const factId of value?.[field] ?? []) if (!facts.has(factId)) issues.push(path + '.' + field + ' references an undeclared Event fact: ' + factId);
  }
}

function checkStrategyProfileShape(profile: OperationStrategyProfileDef, path: string, issues: string[]): void {
  if (!Array.isArray(profile.biases) || profile.biases.length > MAX_STRATEGY_BIASES) {
    issues.push(path + '.biases must contain at most ' + MAX_STRATEGY_BIASES + ' entries');
    return;
  }
  const seen = new Set<string>();
  profile.biases.forEach((bias, index) => {
    const biasPath = path + '.biases[' + index + ']';
    if (!isRecord(bias) || !nonEmpty(bias.tagId)) {
      issues.push(biasPath + '.tagId must be a non-empty Strategy tag ID');
      return;
    }
    if (seen.has(bias.tagId)) issues.push(path + '.biases contains duplicate tagId: ' + bias.tagId);
    seen.add(bias.tagId);
    if (!safeCount(bias.biasBps, 1, MAX_STRATEGY_BIAS_BPS)) {
      issues.push(biasPath + '.biasBps must be between 1 and ' + MAX_STRATEGY_BIAS_BPS);
    }
  });
}

function checkCardPoolShape(pool: OperationCardPoolDef, path: string, issues: string[]): void {
  checkCardConditionShape(pool.selector, path + '.selector', issues);
  if (!Array.isArray(pool.entries) || pool.entries.length < 1 || pool.entries.length > MAX_OPERATION_POOL_ENTRIES) {
    issues.push(path + '.entries must contain 1 to ' + MAX_OPERATION_POOL_ENTRIES + ' entries');
    return;
  }
  pool.entries.forEach((entry, index) => {
    const entryPath = path + '.entries[' + index + ']';
    if (!isRecord(entry) || !nonEmpty(entry.actionId)) issues.push(entryPath + '.actionId must be a non-empty Operation Action ID');
    if (!safeCount(entry.weight, 1, MAX_OPERATION_POOL_WEIGHT)) {
      issues.push(entryPath + '.weight must be between 1 and ' + MAX_OPERATION_POOL_WEIGHT);
    }
  });
}

function checkPredicate(value: unknown, path: string, tracks: ReadonlySet<string>, facts: ReadonlySet<string>, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(path + ' must be a Predicate object');
  } else if (value.kind === 'track') {
    if (!nonEmpty(value.trackId) || !tracks.has(value.trackId)) issues.push(path + '.trackId references an undeclared Event track: ' + String(value.trackId));
    if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(String(value.operator))) issues.push(path + '.operator is unsupported');
    if (!finite(value.value)) issues.push(path + '.value must be finite');
  } else if (value.kind === 'knownFact') {
    if (!nonEmpty(value.factId) || !facts.has(value.factId)) issues.push(path + '.factId references an undeclared Event fact: ' + String(value.factId));
    if (typeof value.present !== 'boolean') issues.push(path + '.present must be boolean');
  } else if (value.kind === 'all' || value.kind === 'any') {
    if (!Array.isArray(value.terms) || value.terms.length === 0) issues.push(path + '.terms must contain at least one Predicate');
    else value.terms.forEach((term, index) => checkPredicate(term, path + '.terms[' + index + ']', tracks, facts, issues));
  } else {
    issues.push(path + '.kind is unsupported');
  }
}

function checkConditionList(
  values: unknown,
  path: string,
  tracks: ReadonlySet<string>,
  facts: ReadonlySet<string>,
  issues: string[],
  objectives = false,
): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    issues.push(path + ' must be an array');
    return;
  }
  const ids = new Set<string>();
  values.forEach((value, index) => {
    const itemPath = path + '[' + index + ']';
    if (!isRecord(value) || !localId(value.id)) {
      issues.push(itemPath + '.id must be a local ID');
      return;
    }
    if (ids.has(value.id)) issues.push(path + ' contains duplicate local ID: ' + value.id);
    ids.add(value.id);
    if (typeof value.description !== 'string' || value.description.trim().length === 0) issues.push(itemPath + '.description must be non-empty');
    if (objectives && value.kind !== 'primary' && value.kind !== 'secondary') issues.push(itemPath + '.kind must be primary or secondary');
    checkPredicate(value.predicate, itemPath + '.predicate', tracks, facts, issues);
  });
}

function checkActionEffects(
  effects: unknown,
  path: string,
  tracks: ReadonlySet<string>,
  facts: ReadonlySet<string>,
  items: ReadonlySet<string>,
  issues: string[],
): void {
  if (!Array.isArray(effects)) {
    issues.push(path + ' must be an array');
    return;
  }
  effects.forEach((effect, index) => {
    const effectPath = path + '[' + index + ']';
    if (!isRecord(effect)) {
      issues.push(effectPath + ' must be an Operation effect');
      return;
    }
    if (effect.kind === 'eventTrackDelta') {
      if (!nonEmpty(effect.trackId) || !tracks.has(effect.trackId)) issues.push(effectPath + '.trackId references an undeclared Event track: ' + String(effect.trackId));
      if (!finite(effect.amount)) issues.push(effectPath + '.amount must be finite');
    } else if (effect.kind === 'eventFact') {
      if (!nonEmpty(effect.factId) || !facts.has(effect.factId)) issues.push(effectPath + '.factId references an undeclared Event fact: ' + String(effect.factId));
    } else if (effect.kind === 'heldItem') {
      if (!nonEmpty(effect.itemId) || !items.has(effect.itemId)) issues.push(effectPath + '.itemId references an undeclared Event item: ' + String(effect.itemId));
    } else if (effect.kind === 'actorPosition') {
      if (effect.recipient !== 'actor' && effect.recipient !== 'target') issues.push(effectPath + '.recipient must be actor or target');
      if (!nonEmpty(effect.positionId)) issues.push(effectPath + '.positionId must be a non-empty Operation position ID');
    } else if (!['actorHpDelta', 'actorResourceDelta', 'teamResourceDelta'].includes(String(effect.kind))) {
      issues.push(effectPath + '.kind is unsupported');
    }
  });
}

function checkActionShape(action: OperationActionDef, path: string, issues: string[]): void {
  if (typeof action.title !== 'string' || action.title.trim() === '') issues.push(path + '.title must be a non-empty author-facing title');
  if (action.description !== undefined && typeof action.description !== 'string') issues.push(path + '.description must be a string');
  const kinds = new Set(['student', 'opponent', 'environment']);
  if (!Array.isArray(action.allowedParticipantKinds) || action.allowedParticipantKinds.length === 0
    || action.allowedParticipantKinds.some(kind => !kinds.has(kind))) {
    issues.push(path + '.allowedParticipantKinds must contain supported participant kinds');
  }
  readIds(action.requiredCapabilityIds, path + '.requiredCapabilityIds', issues);
  readIds(action.reasonIds, path + '.reasonIds', issues);
  readIds(action.tagIds, path + '.tagIds', issues);
  if (action.strategyTagIds !== undefined) readIds(action.strategyTagIds, path + '.strategyTagIds', issues);
  checkCardConditionShape(action.cardCondition, path + '.cardCondition', issues);
  if (!isRecord(action.target) || (action.target.kind !== 'none' && action.target.kind !== 'actor')) {
    issues.push(path + '.target must be none or actor');
  } else if (action.target.kind === 'none') {
    if (Object.keys(action.target).some(key => key !== 'kind')) issues.push(path + '.target none mode only accepts kind');
  } else if (!['self', 'sameTeam', 'otherTeam', 'any'].includes(String(action.target.relation))) {
    issues.push(path + '.target.relation is unsupported');
  }
  if (action.target.kind === 'actor') {
    if (action.target.selectionMode !== undefined
      && action.target.selectionMode !== 'select' && action.target.selectionMode !== 'all-eligible') {
      issues.push(path + '.target.selectionMode must be select or all-eligible');
    }
    for (const field of ['allowedActorIds', 'allowedActorTypes', 'allowedPositionIds'] as const) {
      const values = action.target[field];
      if (values !== undefined && (!Array.isArray(values) || values.length === 0 || values.some(value => !nonEmpty(value)))) {
        issues.push(path + '.target.' + field + ' must contain non-empty strings');
      }
    }
  }
  if (action.cost !== undefined && (!isRecord(action.cost)
    || (action.cost.scope !== 'actor' && action.cost.scope !== 'team')
    || !nonEmpty(action.cost.resourceId) || !finite(action.cost.amount) || Number(action.cost.amount) <= 0)) {
    issues.push(path + '.cost must define a valid actor/team resource and positive amount');
  }
  if (!Array.isArray(action.effects)) issues.push(path + '.effects must be an array');
  else action.effects.forEach((effect, index) => {
    if (!isRecord(effect) || ![
      'actorHpDelta', 'actorPosition', 'actorResourceDelta', 'teamResourceDelta', 'eventTrackDelta', 'eventFact', 'heldItem',
    ].includes(String(effect.kind))) issues.push(path + '.effects[' + index + '].kind is unsupported');
  });
}

function checkProfile(
  profile: StudentOperationProfileDef,
  path: string,
  characters: ReadonlySet<string>,
  actions: ReadonlyMap<string, OperationActionDef>,
  strategyProfiles: ReadonlyMap<string, OperationStrategyProfileDef>,
  cardPools: ReadonlyMap<string, OperationCardPoolDef>,
  issues: string[],
): void {
  if (!nonEmpty(profile.characterId) || !characters.has(profile.characterId)) {
    issues.push(path + '.characterId references an unknown Character: ' + String(profile.characterId));
  }
  const candidates = readIds(profile.candidateActionIds, path + '.candidateActionIds', issues);
  const priorities = readIds(profile.actionPriorityIds, path + '.actionPriorityIds', issues);
  readIds(profile.capabilityIds, path + '.capabilityIds', issues);
  readIds(profile.reasonIds, path + '.reasonIds', issues);
  for (const poolId of readIds(profile.cardPoolIds ?? [], path + '.cardPoolIds', issues)) {
    if (!cardPools.has(poolId)) issues.push(path + '.cardPoolIds references an unknown OperationCardPool: ' + poolId);
  }
  if (profile.strategyProfileId !== undefined && !strategyProfiles.has(profile.strategyProfileId)) {
    issues.push(path + '.strategyProfileId references an unknown OperationStrategyProfile: ' + profile.strategyProfileId);
  }
  for (const actionId of candidates) {
    const action = actions.get(actionId);
    if (!action) issues.push(path + '.candidateActionIds references an unknown OperationAction: ' + actionId);
    else if (!action.allowedParticipantKinds.includes('student')) issues.push(path + '.candidateActionIds references an Action that disallows students: ' + actionId);
  }
  for (const actionId of priorities) if (!candidates.has(actionId)) issues.push(path + '.actionPriorityIds references an ID outside candidateActionIds: ' + actionId);
  if (profile.randomSkillRuleId !== undefined && !localId(profile.randomSkillRuleId)) {
    issues.push(path + '.randomSkillRuleId must be a local Event skill-rule ID');
  }
}

function checkLocationShape(location: OperationLocationDef, path: string, issues: string[]): void {
  if (location.stage !== 'combat' && location.stage !== 'scene') issues.push(path + '.stage must be combat or scene');
  readIds(location.enabledActionIds, path + '.enabledActionIds', issues);
  if (location.interactionSceneId !== undefined && !nonEmpty(location.interactionSceneId)) issues.push(path + '.interactionSceneId must be a non-empty ID');
  if (location.activityId !== undefined && !nonEmpty(location.activityId)) issues.push(path + '.activityId must be a non-empty ID');
  if (location.cardPoolIds !== undefined) readIds(location.cardPoolIds, path + '.cardPoolIds', issues);
  if (!Array.isArray(location.routeEdges)) issues.push(path + '.routeEdges must be an array');
  if (location.maxVisits !== undefined && !safeCount(location.maxVisits, 1, MAX_OPERATION_LOCATION_VISITS)) {
    issues.push(path + '.maxVisits must be between 1 and ' + MAX_OPERATION_LOCATION_VISITS);
  }
  if (Array.isArray(location.routeEdges)) {
    const routeIds = new Set<string>();
    location.routeEdges.forEach((edge, index) => {
      const routePath = path + '.routeEdges[' + index + ']';
      if (!isRecord(edge) || !localId(edge.id)) issues.push(routePath + '.id must be a local ID');
      else if (routeIds.has(edge.id)) issues.push(path + '.routeEdges contains duplicate ID: ' + edge.id);
      else routeIds.add(edge.id);
      if (!nonEmpty(edge.targetLocationId)) issues.push(routePath + '.targetLocationId must be a full Operation Location ID');
      if (edge.requiredHeldItemId !== undefined && !nonEmpty(edge.requiredHeldItemId)) {
        issues.push(routePath + '.requiredHeldItemId must be an Event item ID');
      }
      if (edge.anyOfHeldItemIds !== undefined) {
        if (!Array.isArray(edge.anyOfHeldItemIds) || edge.anyOfHeldItemIds.length < 2
          || edge.anyOfHeldItemIds.some((itemId: unknown) => !nonEmpty(itemId))
          || new Set(edge.anyOfHeldItemIds).size !== edge.anyOfHeldItemIds.length) {
          issues.push(routePath + '.anyOfHeldItemIds must contain at least two Event item IDs');
        }
      }
      if (edge.requiredHeldItemId !== undefined && edge.anyOfHeldItemIds !== undefined) {
        issues.push(routePath + ' must use either requiredHeldItemId or anyOfHeldItemIds');
      }
      if (edge.consumeRequiredHeldItem !== undefined && typeof edge.consumeRequiredHeldItem !== 'boolean') {
        issues.push(routePath + '.consumeRequiredHeldItem must be boolean');
      }
      if (edge.consumeRequiredHeldItem === true && edge.requiredHeldItemId === undefined) {
        issues.push(routePath + '.consumeRequiredHeldItem requires requiredHeldItemId');
      }
      if (edge.consumeRequiredHeldItem === true && edge.anyOfHeldItemIds !== undefined) {
        issues.push(routePath + '.consumeRequiredHeldItem cannot be used with anyOfHeldItemIds');
      }
    });
  }
  if (location.actionMode !== undefined && location.actionMode !== 'individual' && location.actionMode !== 'global') {
    issues.push(path + '.actionMode must be individual or global');
  }
  if (location.actionMode !== undefined && location.sceneActionBatches !== undefined
    && !safeCount(location.sceneActionBatches, 1, MAX_SCENE_BATCHES)) {
    issues.push(path + '.sceneActionBatches must be between 1 and ' + MAX_SCENE_BATCHES);
  }
  if (location.sceneActions !== undefined && !Array.isArray(location.sceneActions)) issues.push(path + '.sceneActions must be an array');
  if (location.sceneActions?.length && location.actionMode === undefined) issues.push(path + '.actionMode is required when sceneActions are declared');
  if (location.actionMode !== undefined && (!Array.isArray(location.sceneActions) || location.sceneActions.length === 0)
    && !Array.isArray(location.purchaseOffers)) {
    issues.push(path + '.sceneActions must contain at least one action when actionMode is declared');
  }
  if (location.costGain !== undefined && !safeCount(location.costGain, 0, Number.MAX_SAFE_INTEGER)) issues.push(path + '.costGain must be a non-negative safe integer');
  if (location.maxCarryCost !== undefined && !safeCount(location.maxCarryCost, 0, Number.MAX_SAFE_INTEGER)) issues.push(path + '.maxCarryCost must be a non-negative safe integer');

  const sceneIds = new Set<string>();
  (location.sceneActions ?? []).forEach((action, index) => {
    const actionPath = path + '.sceneActions[' + index + ']';
    if (!isRecord(action) || !localId(action.id)) issues.push(actionPath + '.id must be a local ID');
    else if (sceneIds.has(action.id)) issues.push(path + '.sceneActions contains duplicate ID: ' + action.id);
    else sceneIds.add(action.id);
    if (!nonEmpty(action.actionId)) issues.push(actionPath + '.actionId must be a full Operation Action ID');
    if (action.scope !== location.actionMode) issues.push(actionPath + '.scope must match Location actionMode');
    if (!safeCount(action.playerCost, 0, Number.MAX_SAFE_INTEGER)) issues.push(actionPath + '.playerCost must be a non-negative safe integer');
    if (action.performerPolicy !== undefined && action.performerPolicy !== 'selected-student' && action.performerPolicy !== 'none' && action.performerPolicy !== 'optional-student') issues.push(actionPath + '.performerPolicy is unsupported');
    if (action.selectionPolicy !== undefined && action.selectionPolicy !== 'required' && action.selectionPolicy !== 'fixed') issues.push(actionPath + '.selectionPolicy is unsupported');
    if ((action.performerPolicy === 'none' || action.performerPolicy === 'optional-student') && action.scope !== 'global') issues.push(actionPath + ' actorless-capable SceneAction requires global scope');
    if (action.title !== undefined && (typeof action.title !== 'string' || action.title.trim() === '')) issues.push(actionPath + '.title must be non-empty when supplied');
    if (action.description !== undefined && typeof action.description !== 'string') issues.push(actionPath + '.description must be a string');
  });

  checkSceneActionChoiceShape(location.sceneActionChoice, location.sceneActions, location.actionMode, path + '.sceneActionChoice', issues);
  checkPurchaseOffersShape(location.purchaseOffers, path + '.purchaseOffers', location.actionMode, location.sceneActionBatches, issues);

  if (location.scenes !== undefined) {
    if (!Array.isArray(location.scenes) || location.scenes.length < 1 || location.scenes.length > MAX_OPERATION_SCENES) {
      issues.push(path + '.scenes must contain 1 to ' + MAX_OPERATION_SCENES + ' ordered Scene definitions');
      return;
    }
    if (location.actionMode !== undefined || location.sceneActions !== undefined || location.sceneActionBatches !== undefined
      || location.sceneActionChoice !== undefined || location.purchaseOffers !== undefined) {
      issues.push(path + ' must put SceneAction batch controls and PurchaseOffers inside scenes when an explicit Scene list is declared');
    }
    const sceneIds = new Set<string>();
    for (const [sceneIndex, scene] of location.scenes.entries()) {
      const scenePath = path + '.scenes[' + sceneIndex + ']';
      if (!isRecord(scene)) {
        issues.push(scenePath + ' must be a Scene object');
        continue;
      }
      const sceneValue = scene as unknown as OperationSceneDef;
      if (!localId(sceneValue.id)) issues.push(scenePath + '.id must be a Location-local ID');
      else if (sceneIds.has(sceneValue.id)) issues.push(path + '.scenes contains duplicate Scene ID: ' + sceneValue.id);
      else sceneIds.add(sceneValue.id);
      if (typeof sceneValue.title !== 'string' || sceneValue.title.trim() === '') issues.push(scenePath + '.title must be non-empty');
      if (sceneValue.description !== undefined && typeof sceneValue.description !== 'string') issues.push(scenePath + '.description must be a string');
      if (sceneValue.enabledActionIds !== undefined) readIds(sceneValue.enabledActionIds, scenePath + '.enabledActionIds', issues);
      if (sceneValue.autoCharacterActions !== undefined && typeof sceneValue.autoCharacterActions !== 'boolean') {
        issues.push(scenePath + '.autoCharacterActions must be boolean');
      }
      if (sceneValue.autoCharacterActions === true && location.stage !== 'scene') {
        issues.push(scenePath + '.autoCharacterActions is only supported for Scene-stage Locations');
      }
      if (sceneValue.completion === undefined) issues.push(scenePath + '.completion is required for an explicit Scene');
      if (sceneValue.actionMode !== undefined && sceneValue.actionMode !== 'individual' && sceneValue.actionMode !== 'global') {
        issues.push(scenePath + '.actionMode must be individual or global');
      }
      if (sceneValue.sceneActionBatches !== undefined && !safeCount(sceneValue.sceneActionBatches, 1, MAX_SCENE_BATCHES)) {
        issues.push(scenePath + '.sceneActionBatches must be between 1 and ' + MAX_SCENE_BATCHES);
      }
      if (sceneValue.sceneActions !== undefined && !Array.isArray(sceneValue.sceneActions)) {
        issues.push(scenePath + '.sceneActions must be an array');
      }
      if (sceneValue.sceneActions?.length && sceneValue.actionMode === undefined) {
        issues.push(scenePath + '.actionMode is required when sceneActions are declared');
      }
      if (sceneValue.actionMode !== undefined && (!Array.isArray(sceneValue.sceneActions) || sceneValue.sceneActions.length === 0)
        && !Array.isArray(sceneValue.purchaseOffers) && sceneValue.autoCharacterActions !== true) {
        issues.push(scenePath + '.sceneActions must contain at least one action when actionMode is declared');
      }
      if (location.stage === 'scene' && sceneValue.autoCharacterActions !== true
        && (sceneValue.actionMode !== 'individual' && sceneValue.actionMode !== 'global'
          || (!Array.isArray(sceneValue.sceneActions) || sceneValue.sceneActions.length === 0)
            && (!Array.isArray(sceneValue.purchaseOffers) || sceneValue.purchaseOffers.length === 0))) {
        issues.push(scenePath + ' has no SceneAction or PurchaseOffer batch progress source');
      }
      const sceneActionIds = new Set<string>();
      (sceneValue.sceneActions ?? []).forEach((action, actionIndex) => {
        const actionPath = scenePath + '.sceneActions[' + actionIndex + ']';
        if (!isRecord(action) || !localId(action.id)) issues.push(actionPath + '.id must be a Scene-local ID');
        else if (sceneActionIds.has(action.id)) issues.push(scenePath + '.sceneActions contains duplicate ID: ' + action.id);
        else sceneActionIds.add(action.id);
        if (!nonEmpty(action.actionId)) issues.push(actionPath + '.actionId must be a full Operation Action ID');
        if (action.scope !== sceneValue.actionMode) issues.push(actionPath + '.scope must match Scene actionMode');
        if (!safeCount(action.playerCost, 0, Number.MAX_SAFE_INTEGER)) issues.push(actionPath + '.playerCost must be a non-negative safe integer');
        if (action.performerPolicy !== undefined && !['selected-student', 'none', 'optional-student'].includes(action.performerPolicy)) {
          issues.push(actionPath + '.performerPolicy is unsupported');
        }
        if (action.selectionPolicy !== undefined && !['required', 'fixed'].includes(action.selectionPolicy)) {
          issues.push(actionPath + '.selectionPolicy is unsupported');
        }
        if ((action.performerPolicy === 'none' || action.performerPolicy === 'optional-student') && action.scope !== 'global') {
          issues.push(actionPath + ' actorless-capable SceneAction requires global scope');
        }
        if (action.title !== undefined && (typeof action.title !== 'string' || action.title.trim() === '')) issues.push(actionPath + '.title must be non-empty when supplied');
        if (action.description !== undefined && typeof action.description !== 'string') issues.push(actionPath + '.description must be a string');
      });
      checkSceneActionChoiceShape(sceneValue.sceneActionChoice, sceneValue.sceneActions, sceneValue.actionMode, scenePath + '.sceneActionChoice', issues);
      checkPurchaseOffersShape(sceneValue.purchaseOffers, scenePath + '.purchaseOffers', sceneValue.actionMode, sceneValue.sceneActionBatches, issues);
    }
  }
}

function checkEvent(
  event: OperationEventContentDef,
  path: string,
  context: OperationContentValidationContext,
  locations: ReadonlyMap<string, OperationLocationDef>,
  actions: ReadonlyMap<string, OperationActionDef>,
  profiles: ReadonlyMap<string, StudentOperationProfileDef>,
  strategyProfiles: ReadonlyMap<string, OperationStrategyProfileDef>,
  cardPools: ReadonlyMap<string, OperationCardPoolDef>,
  characters: ReadonlySet<string>,
  issues: string[],
): void {
  const prefix = path + ' "' + event.id + '"';
  if (event.title !== undefined && (typeof event.title !== 'string' || event.title.trim() === '')) issues.push(prefix + '.title must be non-empty when supplied');
  if (event.description !== undefined && (typeof event.description !== 'string' || event.description.trim() === '')) issues.push(prefix + '.description must be non-empty when supplied');
  if (!nonEmpty(event.initId) || !context.initIds?.has(event.initId)) issues.push(prefix + '.initId references an unknown Init: ' + String(event.initId));
  if (!safeCount(event.resumeVersion, 1, Number.MAX_SAFE_INTEGER)) issues.push(prefix + '.resumeVersion must be a positive safe integer');
  const locationIds = readIds(event.locationIds, prefix + '.locationIds', issues);
  if (locationIds.size < 1 || locationIds.size > MAX_EVENT_LOCATIONS) issues.push(prefix + '.locationIds must contain 1 to ' + MAX_EVENT_LOCATIONS + ' Locations');
  if (!locationIds.has(event.initialLocationId)) issues.push(prefix + '.initialLocationId must reference one of locationIds');
  if (!safeCount(event.maxLocationVisits, 1, MAX_EVENT_VISITS)) issues.push(prefix + '.maxLocationVisits must be between 1 and ' + MAX_EVENT_VISITS);
  if (event.characterHandSize !== undefined && !safeCount(event.characterHandSize, 1, MAX_CHARACTER_HAND_SIZE)) {
    issues.push(prefix + '.characterHandSize must be between 1 and ' + MAX_CHARACTER_HAND_SIZE);
  }
  const eventCardPoolIds = readIds(event.cardPoolIds ?? [], prefix + '.cardPoolIds', issues);
  for (const poolId of eventCardPoolIds) if (!cardPools.has(poolId)) issues.push(prefix + '.cardPoolIds references an unknown OperationCardPool: ' + poolId);

  const trackIds = new Set<string>();
  (event.tracks ?? []).forEach((track, index) => {
    if (!nonEmpty(track.id) || trackIds.has(track.id)) issues.push(prefix + '.tracks[' + index + '].id is missing or duplicated');
    else trackIds.add(track.id);
    if (![track.initial, track.min, track.max].every(finite) || track.min > track.initial || track.initial > track.max) {
      issues.push(prefix + '.tracks[' + index + '] must have finite min/initial/max with min <= initial <= max');
    }
  });
  const facts = readIds(event.factIds, prefix + '.factIds', issues);
  const knownFacts = readIds(event.knownFactIds, prefix + '.knownFactIds', issues);
  for (const factId of knownFacts) if (!facts.has(factId)) issues.push(prefix + '.knownFactIds references an undeclared fact: ' + factId);
  const purchaseFactIds = new Set<string>();
  const purchaseOfferReferences: { readonly offer: OperationScenePurchaseOfferDef; readonly path: string }[] = [];
  const items = readIds(event.itemIds, prefix + '.itemIds', issues);
  const heldItems = readIds(event.heldItemIds, prefix + '.heldItemIds', issues);
  for (const itemId of heldItems) if (!items.has(itemId)) issues.push(prefix + '.heldItemIds references an undeclared item: ' + itemId);
  if (!safeCount(event.playerRouteState?.playerCost, 0, Number.MAX_SAFE_INTEGER)) {
    issues.push(prefix + '.playerRouteState.playerCost must be a non-negative safe integer');
  }

  if (event.rewards !== undefined) {
    const allowedRewardKeys = new Set(['success', 'partialSuccess']);
    for (const key of Object.keys(event.rewards as Record<string, unknown>)) {
      if (!allowedRewardKeys.has(key)) issues.push(prefix + '.rewards contains unsupported outcome: ' + key);
    }
    const allowedResourceIds = new Set(['base:resource:credit', 'base:resource:pyroxene']);
    for (const outcome of ['success', 'partialSuccess'] as const) {
      const reward = event.rewards[outcome];
      if (reward === undefined) continue;
      const rewardPath = prefix + '.rewards.' + outcome;
      if (!isRecord(reward) || reward.kind !== 'resource' || !allowedResourceIds.has(reward.resourceId)
        || !safeCount(reward.amount, 1, Number.MAX_SAFE_INTEGER)) {
        issues.push(rewardPath + ' must award a positive safe amount of a whitelisted AC resource');
      }
    }
  }

  const actorIds = new Set((event.actors ?? []).map(actor => actor.id));
  for (const [index, actor] of (event.actors ?? []).entries()) {
    const actorPath = prefix + '.actors[' + index + ']';
    if (actor.displayName !== undefined && (typeof actor.displayName !== 'string' || actor.displayName.trim() === '')) {
      issues.push(actorPath + '.displayName must be a non-empty string');
    }
    if (actor.avatarRef !== undefined && typeof actor.avatarRef !== 'string') issues.push(actorPath + '.avatarRef must be a string');
    if (actor.description !== undefined && typeof actor.description !== 'string') issues.push(actorPath + '.description must be a string');
    if (actor.positionId !== undefined && !nonEmpty(actor.positionId)) issues.push(actorPath + '.positionId must be a non-empty Operation position ID');
    if (actor.weaponId !== undefined && !nonEmpty(actor.weaponId)) issues.push(actorPath + '.weaponId must be a non-empty Operation weapon ID');
  }
  const participants = new Map<string, (typeof event.participants)[number]>();
  const studentProfiles: StudentOperationProfileDef[] = [];
  for (const [index, participant] of (event.participants ?? []).entries()) {
    const participantPath = prefix + '.participants[' + index + ']';
    if (!nonEmpty(participant.actorId) || participants.has(participant.actorId)) {
      issues.push(participantPath + '.actorId is missing or duplicated');
      continue;
    }
    participants.set(participant.actorId, participant);
    if (!actorIds.has(participant.actorId)) issues.push(participantPath + '.actorId references an undeclared Actor: ' + participant.actorId);
    if (participant.kind === 'student') {
      if (participant.profileId !== undefined) {
        const profile = profiles.get(participant.profileId);
        if (!profile) issues.push(participantPath + '.profileId references an unknown StudentOperationProfile: ' + participant.profileId);
        else studentProfiles.push(profile);
      } else {
        studentProfiles.push(...profiles.values());
      }
    } else if (participant.kind === 'opponent' || participant.kind === 'environment') {
      for (const actionId of readIds(participant.candidateActionIds, participantPath + '.candidateActionIds', issues)) {
        const action = actions.get(actionId);
        if (!action) issues.push(participantPath + '.candidateActionIds references an unknown OperationAction: ' + actionId);
        else if (!action.allowedParticipantKinds.includes(participant.kind)) {
          issues.push(participantPath + '.candidateActionIds references an Action that disallows ' + participant.kind + ': ' + actionId);
        }
      }
    } else {
      issues.push(participantPath + '.kind is unsupported');
    }
  }
  for (const actorId of actorIds) if (!participants.has(actorId)) issues.push(prefix + '.participants is missing Actor: ' + actorId);

  for (const locationId of locationIds) {
    const location = locations.get(locationId);
    if (!location) {
      issues.push(prefix + '.locationIds references an unknown OperationLocation: ' + locationId);
      continue;
    }
    const locationPoolIds = readIds(location.cardPoolIds ?? [], prefix + '.locations[' + locationId + '].cardPoolIds', issues);
    for (const poolId of locationPoolIds) if (!cardPools.has(poolId)) issues.push(prefix + '.locations[' + locationId + '].cardPoolIds references an unknown OperationCardPool: ' + poolId);
    for (const edge of location.routeEdges ?? []) {
      if (!locationIds.has(edge.targetLocationId)) issues.push(prefix + '.locations[' + locationId + '].routeEdges[' + edge.id + '].targetLocationId references a Location outside this Event: ' + edge.targetLocationId);
      if (edge.requiredHeldItemId && !items.has(edge.requiredHeldItemId)) {
        issues.push(prefix + '.locations[' + locationId + '].routeEdges[' + edge.id + '].requiredHeldItemId references an undeclared Event item: ' + edge.requiredHeldItemId);
      }
      if (Array.isArray(edge.anyOfHeldItemIds)) {
        for (const itemId of edge.anyOfHeldItemIds) {
          if (typeof itemId === 'string' && !items.has(itemId)) {
            issues.push(prefix + '.locations[' + locationId + '].routeEdges[' + edge.id + '].anyOfHeldItemIds references an undeclared Event item: ' + itemId);
          }
        }
      }
    }
    for (const actionId of location.enabledActionIds ?? []) {
      if (!actions.has(actionId)) issues.push(prefix + '.locations[' + locationId + '].enabledActionIds references an unknown OperationAction: ' + actionId);
    }
    for (const sceneAction of location.sceneActions ?? []) {
      const action = actions.get(sceneAction.actionId);
      if (!action) issues.push(prefix + '.locations[' + locationId + '].sceneActions[' + sceneAction.id + '].actionId references an unknown OperationAction: ' + sceneAction.actionId);
      else if (sceneAction.performerPolicy !== 'none' && !action.allowedParticipantKinds.includes('student')) issues.push(prefix + '.locations[' + locationId + '].sceneActions[' + sceneAction.id + '] requires an Action that allows student execution');
      else if (sceneAction.performerPolicy === 'none' && sceneAction.scope !== 'global') issues.push(prefix + '.locations[' + locationId + '].sceneActions[' + sceneAction.id + '] actorless performer requires global scope');
    }
    const appendPurchaseOffers = (offers: readonly OperationScenePurchaseOfferDef[] | undefined, path: string): void => {
      for (const [offerIndex, offer] of (offers ?? []).entries()) {
        const offerPath = path + '[' + offerIndex + ']';
        purchaseOfferReferences.push({ offer, path: offerPath });
        if (!facts.has(offer.purchaseFactId)) issues.push(offerPath + '.purchaseFactId references an undeclared Event fact: ' + offer.purchaseFactId);
        if (knownFacts.has(offer.purchaseFactId)) issues.push(offerPath + '.purchaseFactId must not be initially known: ' + offer.purchaseFactId);
        if (purchaseFactIds.has(offer.purchaseFactId)) issues.push(offerPath + '.purchaseFactId is already used by another PurchaseOffer: ' + offer.purchaseFactId);
        purchaseFactIds.add(offer.purchaseFactId);
      }
    };
    appendPurchaseOffers(location.purchaseOffers, prefix + '.locations[' + locationId + '].purchaseOffers');
    for (const scene of location.scenes ?? []) {
      appendPurchaseOffers(scene.purchaseOffers, prefix + '.locations[' + locationId + '].scenes[' + scene.id + '].purchaseOffers');
    }
    checkConditionList(location.objectives, prefix + '.locations[' + locationId + '].objectives', trackIds, facts, issues, true);
    checkConditionList(location.partialOutcomes, prefix + '.locations[' + locationId + '].partialOutcomes', trackIds, facts, issues);
    checkConditionList(location.failureConditions, prefix + '.locations[' + locationId + '].failureConditions', trackIds, facts, issues);

    const hasLocationOutcome = (location.objectives?.some(objective => objective.kind === 'primary') ?? false)
      || (location.partialOutcomes?.length ?? 0) > 0
      || (location.failureConditions?.length ?? 0) > 0;
    const hasEventHardFailure = (event.hardFailureConditions?.length ?? 0) > 0;
    const hasSceneBatchSource = (location.actionMode === 'individual' || location.actionMode === 'global')
      && ((location.sceneActions?.length ?? 0) > 0 || (location.purchaseOffers?.length ?? 0) > 0);
    if (location.stage === 'scene' && location.scenes !== undefined
      && !hasLocationOutcome && !hasEventHardFailure) {
      issues.push(prefix + '.locations[' + locationId + '] has an explicit Scene sequence but no Location completion/failure condition or Event hard failure exit');
    }
    if (location.stage === 'scene' && location.scenes === undefined
      && !hasSceneBatchSource && !hasLocationOutcome && !hasEventHardFailure) {
      issues.push(prefix + '.locations[' + locationId + '] has no SceneAction/PurchaseOffer or outcome-based progress source');
    }
    if (location.stage === 'combat' && location.maxBeats === undefined && !hasLocationOutcome && !hasEventHardFailure) {
      const enabledActionIds = new Set([
        ...(location.enabledActionIds ?? []),
        ...(location.scenes ?? []).flatMap(scene => scene.enabledActionIds ?? location.enabledActionIds ?? []),
      ]);
      const hasEnabledOpponent = [...participants.values()].some(participant => participant.kind === 'opponent'
        && participant.candidateActionIds.some(actionId => enabledActionIds.has(actionId)));
      if (!hasEnabledOpponent) {
        issues.push(prefix + '.locations[' + locationId + '] has no maxBeats, Location outcome, Event hard failure, or enabled opponent defeat exit');
      }
    }

    const hasUnboundedSceneBatch = location.scenes !== undefined
      ? location.scenes.some(scene => scene.actionMode !== undefined && scene.sceneActionBatches === undefined)
      : location.actionMode !== undefined && location.sceneActionBatches === undefined;
    if (location.stage === 'scene' && hasUnboundedSceneBatch && !hasLocationOutcome && !hasEventHardFailure) {
      issues.push(prefix + '.locations[' + locationId + '] has an unbounded SceneAction batch but no Location outcome or Event hard failure exit');
    }
  }

  for (const locationId of locationIds) {
    const location = locations.get(locationId);
    for (const [ruleIndex, rule] of (location?.combinationRules ?? []).entries()) {
      for (const [effectIndex, effect] of rule.effects.entries()) {
        if (effect.kind === 'eventFact' && purchaseFactIds.has(effect.factId)) {
          issues.push(prefix + '.locations[' + locationId + '].combinationRules[' + ruleIndex + '].effects[' + effectIndex + '] must not modify a reserved PurchaseOffer marker fact');
        }
      }
    }
  }

  checkConditionList(event.objectives, prefix + '.objectives', trackIds, facts, issues, true);
  checkConditionList(event.partialOutcomes, prefix + '.partialOutcomes', trackIds, facts, issues);
  checkConditionList(event.hardFailureConditions, prefix + '.hardFailureConditions', trackIds, facts, issues);

  const checkAction = (actionId: string, actionPath: string, studentOnly = false): OperationActionDef | undefined => {
    const action = actions.get(actionId);
    if (!action) {
      issues.push(actionPath + ' references an unknown OperationAction: ' + actionId);
      return undefined;
    }
    if (action.effects.some(effect => effect.kind === 'eventFact' && purchaseFactIds.has(effect.factId))) {
      issues.push(actionPath + ' must not modify a reserved PurchaseOffer marker fact');
    }
    if (studentOnly && !action.allowedParticipantKinds.includes('student')) issues.push(actionPath + ' requires an Action that allows students');
    checkActionEffects(action.effects, 'OperationAction "' + actionId + '".effects', trackIds, facts, items, issues);
    return action;
  };

  for (const { offer, path: offerPath } of purchaseOfferReferences) {
    const action = actions.get(offer.actionId);
    if (!action) {
      issues.push(offerPath + '.actionId references an unknown OperationAction: ' + offer.actionId);
      continue;
    }
    checkAction(offer.actionId, offerPath + '.actionId');
    if (action.target.kind !== 'none' || action.cost !== undefined || action.effects.length === 0
      || action.effects.some(effect => effect.kind !== 'eventTrackDelta' && effect.kind !== 'eventFact' && effect.kind !== 'heldItem')) {
      issues.push(offerPath + '.actionId must reference a targetless Action with no Action cost and at least one Event Track, Fact, or held-item reward effect');
    }
  }

  for (const profile of studentProfiles) {
    checkProfile(profile, 'StudentOperationProfile "' + profile.id + '"', characters, actions, strategyProfiles, cardPools, issues);
    for (const actionId of profile.candidateActionIds) {
      checkAction(actionId, 'StudentOperationProfile "' + profile.id + '".candidateActionIds', true);
    }
    if (profile.randomSkillRuleId && !(event.studentSkillRules ?? []).some(rule => rule.id === profile.randomSkillRuleId)) {
      issues.push(prefix + ' profile ' + profile.id + ' references a missing Event skill rule: ' + profile.randomSkillRuleId);
    }
  }

  const referencedPoolIds = new Set(eventCardPoolIds);
  for (const locationId of locationIds) for (const poolId of locations.get(locationId)?.cardPoolIds ?? []) referencedPoolIds.add(poolId);
  for (const profile of studentProfiles) for (const poolId of profile.cardPoolIds ?? []) referencedPoolIds.add(poolId);
  for (const poolId of referencedPoolIds) {
    const pool = cardPools.get(poolId);
    if (!pool) continue;
    checkCardConditionFacts(pool.selector, 'OperationCardPool "' + pool.id + '".selector', facts, issues);
    for (const entry of pool.entries) {
      const action = actions.get(entry.actionId);
      if (!action) issues.push(prefix + '.cardPool[' + pool.id + '] references an unknown OperationAction: ' + entry.actionId);
      else if (!action.allowedParticipantKinds.includes('student')) issues.push(prefix + '.cardPool[' + pool.id + '] Action does not allow student participants: ' + entry.actionId);
      checkCardConditionFacts(action?.cardCondition, 'OperationAction "' + entry.actionId + '".cardCondition', facts, issues);
    }
  }
  for (const locationId of locationIds) {
    const location = locations.get(locationId);
    for (const actionId of location?.enabledActionIds ?? []) checkAction(actionId, prefix + '.locations[' + locationId + '].enabledActionIds');
    for (const sceneAction of location?.sceneActions ?? []) checkAction(sceneAction.actionId, prefix + '.locations[' + locationId + '].sceneActions[' + sceneAction.id + '].actionId', sceneAction.performerPolicy !== 'none');
    for (const scene of location?.scenes ?? []) {
      for (const actionId of scene.enabledActionIds ?? []) {
        checkAction(actionId, prefix + '.locations[' + locationId + '].scenes[' + scene.id + '].enabledActionIds');
      }
      for (const sceneAction of scene.sceneActions ?? []) {
        checkAction(sceneAction.actionId, prefix + '.locations[' + locationId + '].scenes[' + scene.id + '].sceneActions[' + sceneAction.id + '].actionId', sceneAction.performerPolicy !== 'none');
      }
      if (scene.completion !== undefined) {
        checkPredicate(scene.completion, prefix + '.locations[' + locationId + '].scenes[' + scene.id + '].completion', trackIds, facts, issues);
      }
    }
  }
  for (const participant of participants.values()) {
    if (participant.kind !== 'opponent' && participant.kind !== 'environment') continue;
    for (const actionId of participant.candidateActionIds) checkAction(actionId, prefix + '.participants[' + participant.actorId + '].candidateActionIds');
  }

  const deck = event.playerSceneDeck;
  if (deck !== undefined) {
    let copies = 0;
    const cardIds = new Set<string>();
    for (const [index, card] of (deck.cards ?? []).entries()) {
      const cardPath = prefix + '.playerSceneDeck.cards[' + index + ']';
      if (!localId(card.id) || cardIds.has(card.id)) issues.push(cardPath + '.id is invalid or duplicated');
      cardIds.add(card.id);
      if (!safeCount(card.playerCost, 0, Number.MAX_SAFE_INTEGER)) issues.push(cardPath + '.playerCost must be a non-negative safe integer');
      if (card.timing !== 'scene') issues.push(cardPath + '.timing must be scene');
      if (card.performerPolicy !== undefined && card.performerPolicy !== 'selected-student' && card.performerPolicy !== 'none' && card.performerPolicy !== 'optional-student') issues.push(cardPath + '.performerPolicy is unsupported');
      if (card.selectionPolicy !== undefined && card.selectionPolicy !== 'required' && card.selectionPolicy !== 'fixed') issues.push(cardPath + '.selectionPolicy is unsupported');
      if (card.title !== undefined && (typeof card.title !== 'string' || card.title.trim() === '')) issues.push(cardPath + '.title must be non-empty when supplied');
      if (card.description !== undefined && typeof card.description !== 'string') issues.push(cardPath + '.description must be a string');
      if (!Number.isSafeInteger(card.copies) || card.copies <= 0) issues.push(cardPath + '.copies must be positive');
      else copies += card.copies;
      checkAction(card.actionId, cardPath + '.actionId', card.performerPolicy !== 'none');
    }
    if (copies < 1 || copies > MAX_CARD_COPIES) issues.push(prefix + '.playerSceneDeck total copies must be between 1 and ' + MAX_CARD_COPIES);
    if (!safeCount(deck.initialDraw, 0, MAX_CARD_COPIES)) issues.push(prefix + '.playerSceneDeck.initialDraw is out of range');
    if (!safeCount(deck.locationEntryDraw, 0, MAX_CARD_COPIES)) issues.push(prefix + '.playerSceneDeck.locationEntryDraw is out of range');
    if (!safeCount(deck.maxHandSize, 1, MAX_HAND_SIZE)) issues.push(prefix + '.playerSceneDeck.maxHandSize must be between 1 and ' + MAX_HAND_SIZE);
  }

  const skillRuleIds = new Set<string>();
  for (const [index, rule] of (event.studentSkillRules ?? []).entries()) {
    const rulePath = prefix + '.studentSkillRules[' + index + ']';
    if (!localId(rule.id)) issues.push(rulePath + '.id must be a local ID');
    else if (skillRuleIds.has(rule.id)) issues.push(prefix + '.studentSkillRules contains duplicate ID: ' + rule.id);
    else skillRuleIds.add(rule.id);
    for (const actionId of readIds(rule.triggerActionIds, rulePath + '.triggerActionIds', issues)) checkAction(actionId, rulePath + '.triggerActionIds', true);
    checkActionEffects(rule.effects, rulePath + '.effects', trackIds, facts, items, issues);
    for (const [effectIndex, effect] of rule.effects.entries()) {
      if (effect.kind === 'eventFact' && purchaseFactIds.has(effect.factId)) {
        issues.push(rulePath + '.effects[' + effectIndex + '] must not modify a reserved PurchaseOffer marker fact');
      }
    }
    if (!safeCount(rule.chanceBps, 0, 10000)) issues.push(rulePath + '.chanceBps must be between 0 and 10000');
  }
}

/** Run static ID/reference checks before Registry tables are mutated. */
export function validateOperationDatapackContent(
  datapack: Datapack,
  context: OperationContentValidationContext,
): readonly string[] {
  const issues: string[] = [];
  const locations = mergeById(context.locations, datapack.operationLocations);
  const actions = mergeById(context.actions, datapack.operationActions);
  const profiles = mergeById(context.profiles, datapack.studentOperationProfiles);
  const strategyProfiles = mergeById(context.strategyProfiles, datapack.operationStrategyProfiles);
  const cardPools = mergeById(context.cardPools, datapack.operationCardPools);
  const characters = new Set([...context.characterIds ?? [], ...(datapack.characters ?? []).map(character => character.id)]);

  for (const [index, profile] of (datapack.studentOperationProfiles ?? []).entries()) {
    checkProfile(profile, 'studentOperationProfiles[' + index + ']', characters, actions, strategyProfiles, cardPools, issues);
  }
  for (const [index, profile] of (datapack.operationStrategyProfiles ?? []).entries()) {
    checkStrategyProfileShape(profile, 'operationStrategyProfiles[' + index + '] "' + profile.id + '"', issues);
  }
  for (const [index, pool] of (datapack.operationCardPools ?? []).entries()) {
    checkCardPoolShape(pool, 'operationCardPools[' + index + '] "' + pool.id + '"', issues);
  }
  for (const [index, location] of (datapack.operationLocations ?? []).entries()) {
    checkLocationShape(location, 'operationLocations[' + index + '] "' + location.id + '"', issues);
  }
  for (const [index, action] of (datapack.operationActions ?? []).entries()) {
    checkActionShape(action, 'operationActions[' + index + '] "' + action.id + '"', issues);
  }
  for (const [index, event] of (datapack.operationEvents ?? []).entries()) {
    checkEvent(event, 'operationEvents[' + index + ']', {
      ...context,
      initIds: new Set([...context.initIds ?? [], ...(datapack.inits ?? []).map(init => init.id)]),
    }, locations, actions, profiles, strategyProfiles, cardPools, characters, issues);
  }
  return issues;
}
