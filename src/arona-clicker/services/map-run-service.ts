import type {
  MapRun,
  MapRunRestoreFailureReason,
  MapRunRestoreResult,
  MapRunPartyMember,
  MapRunPartyHp,
  MapRunEnemyHp,
  MapRunSuccessResult,
  MapRunFailureResult,
  MapRunSaveSnapshot,
  MapRunActorResourceBalance,
  MapRunTeamResourceBalance,
  MapRunEncounterSnapshot,
  MapRunHandRandomState,
  MapRunActionOverride,
  MapRunEncounterTargetSelection,
  MapRunEncounterDraftToken,
  MapRunEncounterCommitCommand,
  MapRunEncounterCommitPreview,
  MapRunEncounterCommitReceipt,
  MapRunEncounterActionSettlement,
  MapRunEncounterSettlementResourceChange,
  MapRunEncounterHpChange,
  MapRunEncounterAbilityDraft,
  MapRunEncounterItemDraft,
  MapRunEncounterSourceTarget,
  MapRunEncounterSourceSettlement,
  MapRunEncounterItemSettlement,
  MapRunActiveActivity,
  MapRunShopDraftToken,
  MapRunShopPurchaseReceipt,
} from '../contracts/map-run';
import { GAMEPLAY_B_HAND_RNG_ALGORITHM } from '../contracts/map-run';
import type { MapRunCardInstance, MapRunCardRef } from '../contracts/map-cards';
import { catalogMapRunCards, mapRunCardKey, parseMapRunCardRef } from './map-card-catalog';
import { mapScostCost, resolveMapCardEffects, type MapCardActionChoice } from './map-card-effects';
import type {
  GameplayEncounterDef,
  GameplayMapActionDef,
  GameplayMapActivityDef,
  GameplayMapEdgeConditionDef,
  GameplayMapNodeDef,
  GameplayShopOfferDef,
} from '../../data-services/contracts/gameplay-map';
import type { MapContentResolver } from '../contracts/map-content-resolver';
import { drawGameplayBHands } from './gameplay-b-hand-resolver';
import {
  resolveGameplayBActionPreview,
  type GameplayBActionPreview,
} from './gameplay-b-action-preview-resolver';

type ResolvedMap = NonNullable<ReturnType<MapContentResolver['resolve']>>;
type ResolveCharacterIdForVariant = (variantId: string) => string | null | undefined;

interface MutableMapRun {
  runId: string;
  mapId: string;
  party: MapRunPartyMember[];
  partyHp: MapRunPartyHp[];
  lastEncounterCommit: MapRunEncounterCommitReceipt | null;
  playerCost: number;
  commitVersion: number;
  actorResources: MapRunActorResourceBalance[];
  teamResources: MapRunTeamResourceBalance[];
  status: MapRun['status'];
  currentNodeId: string;
  visitedNodeIds: string[];
  completedEncounterNodeIds: string[];
  completedActivityIds: string[];
  activeActivity: MapRunActiveActivity | null;
  activeEncounter: MapRunEncounterSnapshot | null;
}

interface MapRunSlot {
  readonly definition: ResolvedMap;
  readonly run: MutableMapRun;
}

interface TerminalMapRunCommitReplay {
  readonly command: MapRunEncounterCommitCommand;
  readonly snapshot: MapRun;
}

interface MapRunEncounterCommitPlan {
  readonly settlements: readonly MapRunEncounterActionSettlement[];
  readonly ability: MapRunEncounterSourceSettlement | null;
  readonly item: MapRunEncounterItemSettlement | null;
  readonly playerCostRequired: number;
  readonly actorBalancesAfter: ReadonlyMap<string, number>;
  readonly teamBalancesAfter: ReadonlyMap<string, number>;
  readonly partyHpAfter: ReadonlyMap<string, number>;
  readonly enemyHpAfter: ReadonlyMap<string, number>;
  readonly terminal: 'none' | 'victory' | 'failure';
  readonly enemyAttacks: readonly { readonly enemyId: string; readonly targetCharacterId: string; readonly damage: number; readonly actualDelta: number }[];
}

/** Opaque detached result of preparing one Encounter Commit. */
export interface PreparedMapRunEncounterCommit {
  readonly snapshot: MapRun;
  readonly replayed: boolean;
  readonly itemId: string | null;
}

interface PreparedMapRunEncounterCommitState {
  readonly snapshot: MapRun;
  readonly itemId: string | null;
  readonly baseSlot: MapRunSlot | null;
  readonly nextSlot: MapRunSlot | null;
  readonly result: MapRunSuccessResult | null;
  readonly failureResult: MapRunFailureResult | null;
  readonly terminalCommitReplay: TerminalMapRunCommitReplay | null;
  readonly replayed: boolean;
  installed: boolean;
}

let nextMapRunSequence = 0;

function snapshotOf(run: MutableMapRun): MapRun {
  const cloneReceipt = (receipt: MapRunEncounterCommitReceipt | null) => receipt === null ? null : Object.freeze({
    ...receipt,
    ...(receipt.enemyAttacks ? { enemyAttacks: Object.freeze(receipt.enemyAttacks.map(attack => Object.freeze({ ...attack }))) } : {}),
    ...(receipt.ability ? { ability: Object.freeze({
      ...receipt.ability,
      target: cloneSourceTarget(receipt.ability.target)!,
      resourceChanges: Object.freeze(receipt.ability.resourceChanges.map(change => Object.freeze({ ...change }))),
      hpChanges: Object.freeze(receipt.ability.hpChanges.map(change => Object.freeze({ ...change }))),
    }) } : {}),
    ...(receipt.item ? { item: Object.freeze({
      ...receipt.item,
      target: cloneSourceTarget(receipt.item.target)!,
      resourceChanges: Object.freeze(receipt.item.resourceChanges.map(change => Object.freeze({ ...change }))),
      hpChanges: Object.freeze(receipt.item.hpChanges.map(change => Object.freeze({ ...change }))),
    }) } : {}),
    settlements: Object.freeze(receipt.settlements.map(settlement => Object.freeze({
      ...settlement,
      ...(settlement.targetCard ? { targetCard: parseMapRunCardRef(settlement.targetCard)! } : {}),
      ...(settlement.scostCost ? { scostCost: Object.freeze({ ...settlement.scostCost }) } : {}),
      ...(settlement.hpChanges ? { hpChanges: Object.freeze(settlement.hpChanges.map(change => Object.freeze({ ...change }))) } : {}),
      resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
    }))),
  });
  const lastCommit = cloneReceipt(run.activeEncounter?.lastCommit ?? null);
  const activeEncounter = run.activeEncounter === null ? null : Object.freeze({
    ...run.activeEncounter,
    hands: Object.freeze(run.activeEncounter.hands.map(hand => Object.freeze({
      characterId: hand.characterId,
      actionIds: Object.freeze([...hand.actionIds]),
    }))),
    overrides: Object.freeze(run.activeEncounter.overrides.map(override => Object.freeze({ ...override }))),
    targetSelections: Object.freeze(run.activeEncounter.targetSelections.map(selection => Object.freeze({ ...selection,
      ...(selection.targetCard ? { targetCard: parseMapRunCardRef(selection.targetCard)! } : {}),
    }))),
    ...(run.activeEncounter.abilityDraft == null ? {} : {
      abilityDraft: Object.freeze({ ...run.activeEncounter.abilityDraft, target: cloneSourceTarget(run.activeEncounter.abilityDraft.target) }),
    }),
    ...(run.activeEncounter.itemDraft == null ? {} : {
      itemDraft: Object.freeze({ ...run.activeEncounter.itemDraft, target: cloneSourceTarget(run.activeEncounter.itemDraft.target) }),
    }),
    enemies: Object.freeze(run.activeEncounter.enemies.map(enemy => Object.freeze({ ...enemy }))),
    randomState: Object.freeze({ ...run.activeEncounter.randomState }),
    lastCommit,
  });
  const snapshot = {
    ...run,
    party: Object.freeze(run.party.map(member => Object.freeze({ ...member }))),
    partyHp: Object.freeze(run.partyHp.map(row => Object.freeze({ ...row }))),
    lastEncounterCommit: cloneReceipt(run.lastEncounterCommit),
    actorResources: Object.freeze(run.actorResources.map(balance => Object.freeze({ ...balance }))),
    teamResources: Object.freeze(run.teamResources.map(balance => Object.freeze({ ...balance }))),
    visitedNodeIds: Object.freeze([...run.visitedNodeIds]),
    completedEncounterNodeIds: Object.freeze([...run.completedEncounterNodeIds]),
    completedActivityIds: Object.freeze([...run.completedActivityIds]),
    activeActivity: freezeActiveActivity(run.activeActivity),
    activeEncounter,
  };
  Object.defineProperty(snapshot, 'activeEncounterNodeId', {
    enumerable: false,
    configurable: false,
    get: () => snapshot.activeEncounter?.nodeId ?? null,
  });
  return Object.freeze(snapshot) as MapRun;
}

function cloneSourceTarget(target: MapRunEncounterSourceTarget | null): MapRunEncounterSourceTarget | null {
  return target === null ? null : Object.freeze({ ...target });
}

function freezeActiveActivity(activity: MapRunActiveActivity | null): MapRunActiveActivity | null {
  if (activity === null) return null;
  return Object.freeze({
    ...activity,
    lastPurchase: activity.lastPurchase === null ? null : Object.freeze({
      ...activity.lastPurchase,
      costs: Object.freeze(activity.lastPurchase.costs.map(row => Object.freeze({ ...row }))),
      effects: Object.freeze(activity.lastPurchase.effects.map(row => Object.freeze({ ...row }))),
      heal: activity.lastPurchase.heal === null ? null : Object.freeze({ ...activity.lastPurchase.heal }),
    }),
  });
}

/** Ordered activities declared by a Node; an empty list means legacy single-Encounter content. */
function nodeActivities(node: GameplayMapNodeDef): readonly GameplayMapActivityDef[] {
  return Array.isArray(node.activities) ? node.activities : [];
}

function encounterRounds(encounter: GameplayEncounterDef): number | undefined {
  return Number.isSafeInteger(encounter.rounds) ? encounter.rounds as number : undefined;
}

function activityKind(activity: GameplayMapActivityDef): MapRunActiveActivity['kind'] {
  if (activity.shop !== undefined) return 'shop';
  const encounter = activity.encounter;
  if (!encounter) return 'encounter';
  if ((encounter.enemies?.length ?? 0) > 0) return 'battle';
  return encounterRounds(encounter) === undefined ? 'encounter' : 'rest';
}

function activityCompletedKey(nodeId: string, activityId: string): string {
  return `${nodeId}/${activityId}`;
}

/**
 * Resolves the Encounter definition for a Node or one of its activities.
 * `activityId` is undefined only for a legacy single-Encounter Node.
 */
function resolveNodeEncounter(
  node: GameplayMapNodeDef | undefined,
  activityId?: string,
): GameplayEncounterDef | null {
  if (!node) return null;
  const activities = nodeActivities(node);
  if (activities.length === 0) {
    return activityId === undefined ? node.encounter ?? null : null;
  }
  if (activityId === undefined) return null;
  const activity = activities.find(candidate => candidate.id === activityId);
  return activity?.encounter ?? null;
}

/** Resolves the Shop definition for a Node activity, or null for a non-shop activity. */
function resolveNodeShop(node: GameplayMapNodeDef | undefined, activityId?: string) {
  if (!node || activityId === undefined) return null;
  return nodeActivities(node).find(candidate => candidate.id === activityId)?.shop ?? null;
}

function nextUnfinishedActivityIndex(
  activities: readonly GameplayMapActivityDef[],
  completedActivityIds: readonly string[],
  nodeId: string,
  fromIndex: number,
): number {
  const completed = new Set(completedActivityIds);
  for (let index = fromIndex; index < activities.length; index += 1) {
    if (!completed.has(activityCompletedKey(nodeId, activities[index].id))) return index;
  }
  return -1;
}

/** Reads a non-consuming MapRun-local Edge gate; never mutates team resources. */
function edgeConditionSatisfied(
  condition: GameplayMapEdgeConditionDef,
  run: Pick<MutableMapRun, 'teamResources'>,
): boolean {
  if (condition.kind !== 'teamResourceAtLeast') return false;
  const balance = run.teamResources.find(row => row.resourceId === condition.resourceId)?.value ?? 0;
  return balance >= condition.amount;
}

function freezeShopCosts(offer: GameplayShopOfferDef): readonly { readonly resourceId: string; readonly amount: number }[] {
  const rows: unknown = offer.costs ?? [];
  if (!Array.isArray(rows)) throw new MapRunError([`Shop offer "${offer.id}" costs must be an array`]);
  const seen = new Set<string>();
  const result: { resourceId: string; amount: number }[] = [];
  for (const row of rows) {
    if (!isRecord(row) || !isNonEmptyId(row.resourceId)
      || !Number.isSafeInteger(row.amount) || (row.amount as number) <= 0) {
      throw new MapRunError([`Shop offer "${offer.id}" has an invalid cost`]);
    }
    if (seen.has(row.resourceId)) throw new MapRunError([`Shop offer "${offer.id}" has a duplicate cost`]);
    seen.add(row.resourceId);
    result.push({ resourceId: row.resourceId, amount: row.amount as number });
  }
  return Object.freeze(result.map(row => Object.freeze({ ...row })));
}

function freezeShopEffects(offer: GameplayShopOfferDef): readonly { readonly resourceId: string; readonly amount: number }[] {
  const rows: unknown = offer.effects ?? [];
  if (!Array.isArray(rows)) throw new MapRunError([`Shop offer "${offer.id}" effects must be an array`]);
  const seen = new Set<string>();
  const result: { resourceId: string; amount: number }[] = [];
  for (const row of rows) {
    if (!isRecord(row) || !isNonEmptyId(row.resourceId)
      || !Number.isSafeInteger(row.amount) || (row.amount as number) === 0) {
      throw new MapRunError([`Shop offer "${offer.id}" has an invalid effect`]);
    }
    if (seen.has(row.resourceId)) throw new MapRunError([`Shop offer "${offer.id}" has a duplicate effect`]);
    seen.add(row.resourceId);
    result.push({ resourceId: row.resourceId, amount: row.amount as number });
  }
  return Object.freeze(result.map(row => Object.freeze({ ...row })));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUniqueIdArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every(isNonEmptyId)
    && new Set(value).size === value.length;
}

function isPartySnapshot(
  value: unknown,
  expectedCharacterIds: readonly string[],
  resolveCharacterIdForVariant?: ResolveCharacterIdForVariant,
): value is MapRunPartyMember[] {
  if (!Array.isArray(value)
    || expectedCharacterIds.length === 0
    || value.length !== expectedCharacterIds.length
    || expectedCharacterIds.some(characterId => !isNonEmptyId(characterId))
    || new Set(expectedCharacterIds).size !== expectedCharacterIds.length) return false;

  const seenVariantIds = new Set<string>();
  for (const [index, member] of value.entries()) {
    if (!isRecord(member)
      || !isNonEmptyId(member.characterId)
      || member.characterId !== expectedCharacterIds[index]
      || !isNonEmptyId(member.variantId)
      || seenVariantIds.has(member.variantId)) return false;
    if (resolveCharacterIdForVariant) {
      let resolvedCharacterId: string | null | undefined;
      try {
        resolvedCharacterId = resolveCharacterIdForVariant(member.variantId);
      } catch {
        return false;
      }
      if (resolvedCharacterId !== member.characterId) return false;
    }
    seenVariantIds.add(member.variantId);
  }
  return true;
}

function projectPartySnapshot(party: readonly MapRunPartyMember[]): MapRunPartyMember[] {
  return party.map(({ characterId, variantId }) => ({ characterId, variantId }));
}

function rejectRestore(
  mapId: string | null,
  reason: MapRunRestoreFailureReason,
  diagnostic: string,
): MapRunRestoreResult {
  return { status: 'rejected', mapId, reason, diagnostics: Object.freeze([diagnostic]) };
}

function advanceRunSequence(runId: string): void {
  const match = /^map-run-(\d+)$/.exec(runId);
  if (!match) return;
  const sequence = Number(match[1]);
  if (Number.isSafeInteger(sequence)) nextMapRunSequence = Math.max(nextMapRunSequence, sequence);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function actorResourceKey(characterId: string, resourceId: string): string {
  return JSON.stringify([characterId, resourceId]);
}

function sameCommitRequest(left: MapRunEncounterCommitCommand, right: MapRunEncounterCommitCommand): boolean {
  return left.runId === right.runId
    && left.requestId === right.requestId
    && left.expectedCommitVersion === right.expectedCommitVersion
    && left.draft.nodeId === right.draft.nodeId
    && (left.draft.activityId ?? null) === (right.draft.activityId ?? null)
    && left.draft.round === right.draft.round
    && left.draft.draftVersion === right.draft.draftVersion;
}

function invalidMapResourceDefinition(message: string): never {
  throw new MapRunError([message]);
}

function initialResourceBalances(
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): { actorResources: MapRunActorResourceBalance[]; teamResources: MapRunTeamResourceBalance[] } {
  const actorResourceIds = new Set<string>();
  const teamResourceIds = new Set<string>();
  const initialActorValues = new Map<string, number>();
  const initialTeamValues = new Map<string, number>();
  const partyIds = new Set(party.map(member => member.characterId));

  if (definition.actions !== undefined && !Array.isArray(definition.actions)) {
    invalidMapResourceDefinition(`Map "${definition.id}" has invalid Action definitions`);
  }
  for (const action of definition.actions ?? []) {
    if (!isRecord(action)) invalidMapResourceDefinition(`Map "${definition.id}" has an invalid Action`);
    for (const field of ['costs', 'effects'] as const) {
      const rows: unknown = action[field];
      if (rows === undefined) continue;
      if (!Array.isArray(rows)) {
        invalidMapResourceDefinition(`Map Action "${action.id}" has invalid ${field}`);
      }
      for (const row of rows) {
        if (!isRecord(row) || (row.scope !== 'actor' && row.scope !== 'team') || !isNonEmptyId(row.resourceId)) {
          invalidMapResourceDefinition(`Map Action "${action.id}" has an invalid ${field} resource`);
        }
        (row.scope === 'actor' ? actorResourceIds : teamResourceIds).add(row.resourceId);
      }
    }
  }

  const actorInitials: unknown = definition.initialActorResources;
  if (actorInitials !== undefined && !Array.isArray(actorInitials)) {
    invalidMapResourceDefinition(`Map "${definition.id}" has invalid initial Actor resources`);
  }
  for (const row of (actorInitials ?? []) as unknown[]) {
    if (!isRecord(row) || !isNonEmptyId(row.characterId) || !partyIds.has(row.characterId)
      || !isNonEmptyId(row.resourceId) || !Number.isSafeInteger(row.value) || (row.value as number) < 0) {
      invalidMapResourceDefinition(`Map "${definition.id}" has an invalid initial Actor resource`);
    }
    const key = actorResourceKey(row.characterId, row.resourceId);
    if (initialActorValues.has(key)) {
      invalidMapResourceDefinition(`Map "${definition.id}" has a duplicate initial Actor resource`);
    }
    actorResourceIds.add(row.resourceId);
    initialActorValues.set(key, row.value as number);
  }

  const teamInitials: unknown = definition.initialTeamResources;
  if (teamInitials !== undefined && !Array.isArray(teamInitials)) {
    invalidMapResourceDefinition(`Map "${definition.id}" has invalid initial Team resources`);
  }
  for (const row of (teamInitials ?? []) as unknown[]) {
    if (!isRecord(row) || !isNonEmptyId(row.resourceId)
      || !Number.isSafeInteger(row.value) || (row.value as number) < 0) {
      invalidMapResourceDefinition(`Map "${definition.id}" has an invalid initial Team resource`);
    }
    if (initialTeamValues.has(row.resourceId)) {
      invalidMapResourceDefinition(`Map "${definition.id}" has a duplicate initial Team resource`);
    }
    teamResourceIds.add(row.resourceId);
    initialTeamValues.set(row.resourceId, row.value as number);
  }

  const orderedActorResourceIds = [...actorResourceIds].sort(compareIds);
  const orderedTeamResourceIds = [...teamResourceIds].sort(compareIds);
  return {
    actorResources: party.flatMap(member => orderedActorResourceIds.map(resourceId => ({
      characterId: member.characterId,
      resourceId,
      value: initialActorValues.get(actorResourceKey(member.characterId, resourceId)) ?? 0,
    }))),
    teamResources: orderedTeamResourceIds.map(resourceId => ({
      resourceId,
      value: initialTeamValues.get(resourceId) ?? 0,
    })),
  };
}

function initialPartyHp(definition: ResolvedMap, party: readonly MapRunPartyMember[]): MapRunPartyHp[] {
  const rows: unknown = definition.initialPartyHp;
  if (!Array.isArray(rows) || rows.length !== party.length) {
    invalidMapResourceDefinition(`Map "${definition.id}" must declare starting HP for every fixed party member`);
  }
  return party.map((member, index) => {
    const row: unknown = rows[index];
    if (!isRecord(row) || row.characterId !== member.characterId
      || !Number.isSafeInteger(row.initialHp) || !Number.isSafeInteger(row.maxHp)
      || (row.maxHp as number) < 1 || (row.initialHp as number) < 1
      || (row.initialHp as number) > (row.maxHp as number)) {
      invalidMapResourceDefinition(`Map "${definition.id}" has invalid starting HP for "${member.characterId}"`);
    }
    return { characterId: member.characterId, currentHp: row.initialHp as number };
  });
}

function partyHpCaps(definition: ResolvedMap, party: readonly MapRunPartyMember[]): ReadonlyMap<string, number> {
  const rows: unknown = definition.initialPartyHp;
  if (!Array.isArray(rows) || rows.length !== party.length) return new Map();
  const caps = new Map<string, number>();
  for (const [index, member] of party.entries()) {
    const row = rows[index];
    if (!isRecord(row) || row.characterId !== member.characterId
      || !Number.isSafeInteger(row.maxHp) || (row.maxHp as number) < 1) return new Map();
    caps.set(member.characterId, row.maxHp as number);
  }
  return caps;
}

function restoreActorResourceBalances(
  value: unknown,
  expected: readonly MapRunActorResourceBalance[],
): MapRunActorResourceBalance[] | null {
  if (!Array.isArray(value) || value.length !== expected.length) return null;
  const result: MapRunActorResourceBalance[] = [];
  for (const [index, row] of value.entries()) {
    const identity = expected[index];
    if (!identity || !isRecord(row)
      || row.characterId !== identity.characterId
      || row.resourceId !== identity.resourceId
      || !Number.isSafeInteger(row.value)
      || (row.value as number) < 0) return null;
    result.push({ characterId: identity.characterId, resourceId: identity.resourceId, value: row.value as number });
  }
  return result;
}

function restoreTeamResourceBalances(
  value: unknown,
  expected: readonly MapRunTeamResourceBalance[],
): MapRunTeamResourceBalance[] | null {
  if (!Array.isArray(value) || value.length !== expected.length) return null;
  const result: MapRunTeamResourceBalance[] = [];
  for (const [index, row] of value.entries()) {
    const identity = expected[index];
    if (!identity || !isRecord(row)
      || row.resourceId !== identity.resourceId
      || !Number.isSafeInteger(row.value)
      || (row.value as number) < 0) return null;
    result.push({ resourceId: identity.resourceId, value: row.value as number });
  }
  return result;
}

function restorePartyHp(
  value: unknown,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunPartyHp[] | null {
  const caps = partyHpCaps(definition, party);
  if (caps.size !== party.length || !Array.isArray(value) || value.length !== party.length) return null;
  const result: MapRunPartyHp[] = [];
  for (const [index, rawRow] of value.entries()) {
    const member = party[index];
    if (!member || !isRecord(rawRow) || Object.keys(rawRow).length !== 2
      || Object.keys(rawRow).some(key => !['characterId', 'currentHp'].includes(key))
      || rawRow.characterId !== member.characterId
      || !Number.isSafeInteger(rawRow.currentHp) || (rawRow.currentHp as number) < 0
      || (rawRow.currentHp as number) > (caps.get(member.characterId) ?? -1)) return null;
    result.push({ characterId: member.characterId, currentHp: rawRow.currentHp as number });
  }
  return result;
}

function initializeEncounterSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

function createEncounterSnapshot(
  definition: ResolvedMap,
  nodeId: string,
  encounter: GameplayEncounterDef,
  party: readonly MapRunPartyMember[],
  actorResources: readonly MapRunActorResourceBalance[],
  teamResources: readonly MapRunTeamResourceBalance[],
  partyHp: readonly MapRunPartyHp[],
  round = 1,
  randomState?: MapRunHandRandomState,
  retainedEnemies?: readonly MapRunEnemyHp[],
  activityId?: string,
): MapRunEncounterSnapshot {
  const enemyDefinitions: unknown = encounter.enemies ?? [];
  if (!Array.isArray(enemyDefinitions)) throw new MapRunError([`Encounter "${nodeId}" has an invalid Enemy roster`]);
  const enemyIds = new Set<string>();
  for (const enemy of enemyDefinitions) {
    if (!isRecord(enemy) || !isNonEmptyId(enemy.id) || enemyIds.has(enemy.id)
      || !Number.isSafeInteger(enemy.maxHp) || (enemy.maxHp as number) < 1
      || !Number.isSafeInteger(enemy.initialHp) || (enemy.initialHp as number) < 1
      || (enemy.initialHp as number) > (enemy.maxHp as number)
      || !Number.isSafeInteger(enemy.damage) || (enemy.damage as number) < 1) {
      throw new MapRunError([`Encounter "${nodeId}" has an invalid Enemy definition`]);
    }
    enemyIds.add(enemy.id);
  }
  const startingState: MapRunHandRandomState = randomState ?? {
    algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
    seed: initializeEncounterSeed(),
    cursor: 0,
  };
  try {
    const draw = drawGameplayBHands({
      partyCharacterIds: party.map(member => member.characterId),
      participants: encounter.participants,
      actions: definition.actions,
      actorResources,
      teamResources,
      livingPartyCharacterIds: partyHp.filter(row => row.currentHp > 0).map(row => row.characterId),
      randomState: startingState,
    });
    const enemies: MapRunEnemyHp[] = retainedEnemies === undefined
      ? (encounter.enemies ?? []).map(enemy => ({ enemyId: enemy.id, currentHp: enemy.initialHp }))
      : retainedEnemies.map(enemy => ({ ...enemy }));
    return {
      nodeId,
      ...(activityId === undefined ? {} : { activityId }),
      round,
      hands: draw.hands,
      overrides: [],
      targetSelections: [],
      enemies,
      draftVersion: 0,
      drawCursorStart: startingState.cursor,
      randomState: draw.randomState,
      lastCommit: null,
    };
  } catch (error) {
    throw new MapRunError([error instanceof Error ? error.message : String(error)]);
  }
}

interface EnteredNodeState {
  readonly activeActivity: MapRunActiveActivity | null;
  readonly activeEncounter: MapRunEncounterSnapshot | null;
}

/**
 * Opens the first unfinished activity of an ordered Node, or the legacy single
 * Encounter. Returns both active fields so callers never desynchronize them.
 */
function openNodeContent(
  definition: ResolvedMap,
  node: GameplayMapNodeDef,
  party: readonly MapRunPartyMember[],
  actorResources: readonly MapRunActorResourceBalance[],
  teamResources: readonly MapRunTeamResourceBalance[],
  partyHp: readonly MapRunPartyHp[],
  completedActivityIds: readonly string[],
  fromIndex = 0,
): EnteredNodeState {
  const activities = nodeActivities(node);
  if (activities.length === 0) {
    return {
      activeActivity: null,
      activeEncounter: node.encounter
        ? createEncounterSnapshot(definition, node.id, node.encounter, party, actorResources, teamResources, partyHp)
        : null,
    };
  }
  const index = nextUnfinishedActivityIndex(activities, completedActivityIds, node.id, fromIndex);
  if (index < 0) return { activeActivity: null, activeEncounter: null };
  const activity = activities[index];
  const kind = activityKind(activity);
  const activeActivity: MapRunActiveActivity = {
    nodeId: node.id,
    activityId: activity.id,
    index,
    kind,
    shopDraftVersion: 0,
    lastPurchase: null,
  };
  if (kind === 'shop') return { activeActivity, activeEncounter: null };
  if (!activity.encounter) throw new MapRunError([`Node "${node.id}" Activity "${activity.id}" declares no content`]);
  return {
    activeActivity,
    activeEncounter: createEncounterSnapshot(
      definition,
      node.id,
      activity.encounter,
      party,
      actorResources,
      teamResources,
      partyHp,
      1,
      undefined,
      undefined,
      activity.id,
    ),
  };
}

interface ActivityAdvanceResult {
  readonly run: MutableMapRun;
  readonly success: boolean;
  readonly nodeCompleted: boolean;
}

/**
 * Marks the current activity complete and opens the next fixed activity, or
 * completes the Node when nothing remains. Never re-applies the prior effect.
 */
function advanceCompletedActivity(
  definition: ResolvedMap,
  run: MutableMapRun,
  encounterNodeId: string,
  encounterActivityId: string | undefined,
): ActivityAdvanceResult {
  const node = definition.nodes.find(candidate => candidate.id === encounterNodeId);
  const activities = node ? nodeActivities(node) : [];
  if (!node || activities.length === 0 || encounterActivityId === undefined) {
    const completedEncounterNodeIds = run.completedEncounterNodeIds.includes(encounterNodeId)
      ? [...run.completedEncounterNodeIds]
      : [...run.completedEncounterNodeIds, encounterNodeId];
    return {
      run: { ...run, completedEncounterNodeIds, activeActivity: null, activeEncounter: null },
      success: definition.exitNodeIds.includes(encounterNodeId),
      nodeCompleted: true,
    };
  }

  const completedActivityIds = run.completedActivityIds.includes(activityCompletedKey(encounterNodeId, encounterActivityId))
    ? [...run.completedActivityIds]
    : [...run.completedActivityIds, activityCompletedKey(encounterNodeId, encounterActivityId)];
  const currentIndex = activities.findIndex(activity => activity.id === encounterActivityId);
  const next = openNodeContent(
    definition,
    node,
    run.party,
    run.actorResources,
    run.teamResources,
    run.partyHp,
    completedActivityIds,
    currentIndex + 1,
  );
  if (next.activeActivity !== null) {
    return {
      run: { ...run, completedActivityIds, activeActivity: next.activeActivity, activeEncounter: next.activeEncounter },
      success: false,
      nodeCompleted: false,
    };
  }
  const completedEncounterNodeIds = run.completedEncounterNodeIds.includes(encounterNodeId)
    ? [...run.completedEncounterNodeIds]
    : [...run.completedEncounterNodeIds, encounterNodeId];
  return {
    run: { ...run, completedActivityIds, completedEncounterNodeIds, activeActivity: null, activeEncounter: null },
    success: definition.exitNodeIds.includes(encounterNodeId),
    nodeCompleted: true,
  };
}

function settlementChangesFor(
  action: GameplayMapActionDef,
  actorCharacterId: string,
  targetCharacterId: string | null,
  scostDiscount = 0n,
): MapRunEncounterSettlementResourceChange[] {
  const changes: MapRunEncounterSettlementResourceChange[] = [];
  const rawCosts: unknown = action.costs ?? [];
  if (!Array.isArray(rawCosts)) throw new MapRunError([`Action "${action.id}" costs must be an array`]);
  for (const rawCost of rawCosts) {
    if (!isRecord(rawCost) || (rawCost.scope !== 'actor' && rawCost.scope !== 'team')
      || !isNonEmptyId(rawCost.resourceId) || !Number.isSafeInteger(rawCost.amount)
      || (rawCost.amount as number) <= 0) {
      throw new MapRunError([`Action "${action.id}" has an invalid resource cost`]);
    }
    let cost = BigInt(rawCost.amount as number);
    if (rawCost.scope === 'actor' && rawCost.resourceId === 'sCost') {
      const reduction = scostDiscount < cost ? scostDiscount : cost;
      cost -= reduction;
      scostDiscount -= reduction;
    }
    changes.push({
      kind: 'cost',
      scope: rawCost.scope,
      ...(rawCost.scope === 'actor' ? { characterId: actorCharacterId } : {}),
      resourceId: rawCost.resourceId,
      delta: cost === 0n ? 0 : -Number(cost),
    });
  }

  const rawEffects: unknown = action.effects ?? [];
  if (!Array.isArray(rawEffects)) throw new MapRunError([`Action "${action.id}" effects must be an array`]);
  for (const rawEffect of rawEffects) {
    if (!isRecord(rawEffect) || (rawEffect.scope !== 'actor' && rawEffect.scope !== 'team')
      || !isNonEmptyId(rawEffect.resourceId) || !Number.isSafeInteger(rawEffect.amount)
      || (rawEffect.amount as number) === 0) {
      throw new MapRunError([`Action "${action.id}" has an invalid resource effect`]);
    }
    if (rawEffect.scope === 'team') {
      if (rawEffect.recipient !== undefined) {
        throw new MapRunError([`Team resource effect on Action "${action.id}" cannot name an Actor recipient`]);
      }
      changes.push({ kind: 'effect', scope: 'team', resourceId: rawEffect.resourceId, delta: rawEffect.amount as number });
      continue;
    }
    if (rawEffect.recipient !== undefined && rawEffect.recipient !== 'actor' && rawEffect.recipient !== 'target') {
      throw new MapRunError([`Action "${action.id}" has an invalid Actor effect recipient`]);
    }
    const characterId = rawEffect.recipient === 'target' ? targetCharacterId : actorCharacterId;
    if (characterId === null) {
      throw new MapRunError([`Action "${action.id}" requires a resolved target for its Actor effect`]);
    }
    changes.push({
      kind: 'effect',
      scope: 'actor',
      characterId,
      resourceId: rawEffect.resourceId,
      delta: rawEffect.amount as number,
    });
  }
  return changes;
}

function freezeCommitSettlements(
  settlements: readonly MapRunEncounterActionSettlement[],
): readonly MapRunEncounterActionSettlement[] {
  return Object.freeze(settlements.map(settlement => Object.freeze({
    ...settlement,
    ...(settlement.targetCard ? { targetCard: parseMapRunCardRef(settlement.targetCard)! } : {}),
    ...(settlement.scostCost ? { scostCost: Object.freeze({ ...settlement.scostCost }) } : {}),
    ...(settlement.hpChanges ? { hpChanges: Object.freeze(settlement.hpChanges.map(change => Object.freeze({ ...change }))) } : {}),
    resourceChanges: Object.freeze(settlement.resourceChanges.map(change => Object.freeze({ ...change }))),
  })));
}

function isActorlessSourceAction(action: GameplayMapActionDef | undefined): action is GameplayMapActionDef {
  return !!action
    && action.eligibleCharacterIds.length === 0
    && (action.target.kind === 'enemy' || action.target.kind === 'partyCharacter')
    && (action.costs?.length ?? 0) === 0
    && !(action.effects ?? []).some(effect => effect.scope === 'actor');
}

function actorlessSourceAction(slot: MapRunSlot, actionId: string, label: string): GameplayMapActionDef {
  const action = (slot.definition.actions ?? []).find(candidate => candidate.id === actionId);
  if (!isActorlessSourceAction(action)) {
    throw new MapRunError([`${label} Action "${actionId}" is not a legal actorless source`]);
  }
  return action;
}

function parseSourceTarget(value: unknown): MapRunEncounterSourceTarget | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (value.kind === 'partyCharacter' && keys.length === 2
    && keys.every(key => ['kind', 'characterId'].includes(key)) && isNonEmptyId(value.characterId)) {
    return { kind: 'partyCharacter', characterId: value.characterId };
  }
  if (value.kind === 'enemy' && keys.length === 2
    && keys.every(key => ['kind', 'enemyId'].includes(key)) && isNonEmptyId(value.enemyId)) {
    return { kind: 'enemy', enemyId: value.enemyId };
  }
  return undefined;
}

function validateSourceTarget(
  target: MapRunEncounterSourceTarget | null,
  action: GameplayMapActionDef,
  slot: MapRunSlot,
  label: string,
): asserts target is MapRunEncounterSourceTarget {
  const encounter = slot.run.activeEncounter;
  if (!target || action.target.kind !== target.kind) {
    throw new MapRunError([`${label} Action "${action.id}" has an invalid or missing target`]);
  }
  if (target.kind === 'partyCharacter') {
    if (!slot.run.party.some(member => member.characterId === target.characterId)
      || (slot.run.partyHp.find(row => row.characterId === target.characterId)?.currentHp ?? 0) <= 0) {
      throw new MapRunError([`${label} Action "${action.id}" targets a downed or unknown party member`]);
    }
  } else if (!encounter?.enemies.some(enemy => enemy.enemyId === target.enemyId && enemy.currentHp > 0)) {
    throw new MapRunError([`${label} Action "${action.id}" targets a defeated or unknown Enemy`]);
  }
}

/** Purely validates and stages one full Encounter round from its starting balances. */
function resolveEncounterCommitPlan(slot: MapRunSlot): MapRunEncounterCommitPlan {
  const encounter = slot.run.activeEncounter;
  if (!encounter) throw new MapRunError(['there is no active Encounter to commit']);
  const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
  const encounterDef = resolveNodeEncounter(node, encounter.activityId);
  if (!encounterDef) throw new MapRunError([`Encounter "${encounter.nodeId}" is not declared by the current Map`]);

  let preview: GameplayBActionPreview;
  try {
    preview = resolveGameplayBActionPreview({
      runId: slot.run.runId,
      definition: slot.definition,
      encounter,
      party: slot.run.party,
      partyHp: slot.run.partyHp,
      playerCost: slot.run.playerCost,
      actorResources: slot.run.actorResources,
      teamResources: slot.run.teamResources,
    });
  } catch (error) {
    throw new MapRunError([error instanceof Error ? error.message : String(error)]);
  }
  if (encounter.round >= Number.MAX_SAFE_INTEGER) {
    throw new MapRunError(['the Encounter round is exhausted']);
  }
  for (const prepared of preview.preparedActions) {
    if (prepared.targetSelectionRequired) throw new MapRunError([`Character "${prepared.characterId}" still requires a target selection`]);
  }
  let cardPlan: ReturnType<typeof resolveMapCardEffects>;
  try {
    cardPlan = resolveMapCardEffects(slot.definition, { runId: slot.run.runId, mapId: slot.run.mapId,
      nodeId: encounter.nodeId, activityId: encounter.activityId ?? null, round: encounter.round },
    preview.preparedActions.map(row => ({ characterId: row.characterId, actionId: row.preparedActionId,
      overrideKind: row.overrideKind, targetCard: row.targetCard })));
  } catch (error) { throw new MapRunError([error instanceof Error ? error.message : String(error)]); }

  const actorBalances = new Map(slot.run.actorResources.map(balance => [
    actorResourceKey(balance.characterId, balance.resourceId), balance.value,
  ]));
  const teamBalances = new Map(slot.run.teamResources.map(balance => [balance.resourceId, balance.value]));
  const settlements: MapRunEncounterActionSettlement[] = [];
  const pendingHpActions: {
    readonly settlement: { readonly kind: 'character'; readonly index: number } | { readonly kind: 'ability' } | { readonly kind: 'item' };
    readonly action: GameplayMapActionDef;
    readonly targetCharacterId: string | null;
    readonly targetEnemyId: string | null;
  }[] = [];
  const requiredCosts = new Map<string, {
    readonly scope: 'actor' | 'team';
    readonly characterId?: string;
    readonly resourceId: string;
    amount: bigint;
  }>();
  let playerCostRequired = 0;
  let ability: MapRunEncounterSourceSettlement | null = null;
  let item: MapRunEncounterItemSettlement | null = null;
  const actionById = new Map((slot.definition.actions ?? []).map(action => [action.id, action]));

  const addRequiredCosts = (resourceChanges: readonly MapRunEncounterSettlementResourceChange[]) => {
    for (const change of resourceChanges) {
      if (change.kind !== 'cost') continue;
      const key = JSON.stringify([change.scope, change.characterId ?? null, change.resourceId]);
      const existing = requiredCosts.get(key);
      requiredCosts.set(key, {
        scope: change.scope,
        ...(change.characterId === undefined ? {} : { characterId: change.characterId }),
        resourceId: change.resourceId,
        amount: (existing?.amount ?? 0n) + BigInt(-change.delta),
      });
    }
  };

  for (const prepared of preview.preparedActions) {
    if (prepared.targetSelectionRequired) {
      throw new MapRunError([`Character "${prepared.characterId}" still requires a target selection`]);
    }
    const actionId = prepared.preparedActionId;
    if (actionId === null) {
      if (prepared.targetCharacterId !== null || prepared.overrideKind !== null || prepared.playerCost !== 0) {
        throw new MapRunError([`Character "${prepared.characterId}" has an invalid Wait preparation`]);
      }
      settlements.push({
        characterId: prepared.characterId,
        actionId: null,
        targetCharacterId: null,
        overrideKind: null,
        playerCostSpent: 0,
        resourceChanges: [],
      });
      continue;
    }
    const action = actionById.get(actionId);
    if (!action || !action.eligibleCharacterIds.includes(prepared.characterId)) {
      throw new MapRunError([`Prepared Action "${actionId}" is no longer valid for "${prepared.characterId}"`]);
    }
    const targetCharacterId = prepared.targetCharacterId;
    const targetEnemyId = prepared.targetEnemyId ?? null;
    if ((action.target.kind === 'none' && targetCharacterId !== null)
      || (action.target.kind === 'self' && targetCharacterId !== prepared.characterId)
      || (action.target.kind === 'partyCharacter'
        && (!targetCharacterId || !slot.run.party.some(member => member.characterId === targetCharacterId)))
      || (action.target.kind === 'enemy' && (!targetEnemyId || !encounter.enemies.some(enemy => enemy.enemyId === targetEnemyId)))) {
      throw new MapRunError([`Prepared Action "${actionId}" has an invalid resolved target`]);
    }

    const playerCostSpent = prepared.playerCost;
    playerCostRequired += playerCostSpent;
    const reduction = cardPlan.reductions.get(prepared.characterId) ?? 0n;
    const scostCost = mapScostCost(action, reduction);
    const resourceChanges = settlementChangesFor(action, prepared.characterId, targetCharacterId, reduction);
    addRequiredCosts(resourceChanges);
    const settlement: MapRunEncounterActionSettlement = {
      characterId: prepared.characterId,
      actionId,
      targetCharacterId,
      ...(cardPlan.targets.has(prepared.characterId) ? { targetCard: cardPlan.targets.get(prepared.characterId)! } : {}),
      ...(scostCost ? { scostCost } : {}),
      ...(targetEnemyId === null ? {} : { targetEnemyId }),
      overrideKind: prepared.overrideKind,
      playerCostSpent,
      resourceChanges,
    };
    settlements.push(settlement);
    pendingHpActions.push({
      settlement: { kind: 'character', index: settlements.length - 1 },
      action,
      targetCharacterId,
      targetEnemyId,
    });
  }

  const sourceTargetIds = (target: MapRunEncounterSourceTarget) => ({
    targetCharacterId: target.kind === 'partyCharacter' ? target.characterId : null,
    targetEnemyId: target.kind === 'enemy' ? target.enemyId : null,
  });
  const abilityDraft: MapRunEncounterAbilityDraft | null = encounter.abilityDraft ?? null;
  if (abilityDraft !== null) {
    const exposed = encounterDef.abilityActionIds ?? [];
    if (!exposed.includes(abilityDraft.actionId)) {
      throw new MapRunError([`Ability Action "${abilityDraft.actionId}" is not exposed by this Encounter`]);
    }
    const action = actorlessSourceAction(slot, abilityDraft.actionId, 'Ability');
    validateSourceTarget(abilityDraft.target, action, slot, 'Ability');
    playerCostRequired += 1;
    const { targetCharacterId, targetEnemyId } = sourceTargetIds(abilityDraft.target);
    const resourceChanges = settlementChangesFor(action, '', targetCharacterId);
    addRequiredCosts(resourceChanges);
    ability = {
      actionId: action.id,
      target: abilityDraft.target,
      playerCostSpent: 1,
      resourceChanges,
      hpChanges: [],
    };
    pendingHpActions.push({
      settlement: { kind: 'ability' }, action, targetCharacterId, targetEnemyId,
    });
  }

  const itemDraft: MapRunEncounterItemDraft | null = encounter.itemDraft ?? null;
  if (itemDraft !== null) {
    const mappings = encounterDef.itemActions ?? [];
    const mapping = mappings.find(candidate => candidate.itemId === itemDraft.itemId);
    if (!mapping || mapping.actionId !== itemDraft.actionId) {
      throw new MapRunError([`Item "${itemDraft.itemId}" is not mapped to this Encounter Action`]);
    }
    const action = actorlessSourceAction(slot, itemDraft.actionId, 'Item');
    validateSourceTarget(itemDraft.target, action, slot, 'Item');
    const { targetCharacterId, targetEnemyId } = sourceTargetIds(itemDraft.target);
    const resourceChanges = settlementChangesFor(action, '', targetCharacterId);
    addRequiredCosts(resourceChanges);
    item = {
      itemId: itemDraft.itemId,
      actionId: action.id,
      target: itemDraft.target,
      consumedCount: 1,
      resourceChanges,
      hpChanges: [],
    };
    pendingHpActions.push({
      settlement: { kind: 'item' }, action, targetCharacterId, targetEnemyId,
    });
  }

  if (!Number.isSafeInteger(playerCostRequired) || playerCostRequired > slot.run.playerCost) {
    throw new MapRunError(['the Encounter round cannot pay its combined PlayerCost costs']);
  }
  for (const required of requiredCosts.values()) {
    const key = required.scope === 'actor' && required.characterId !== undefined
      ? actorResourceKey(required.characterId, required.resourceId)
      : required.resourceId;
    const startingBalance = required.scope === 'actor'
      ? actorBalances.get(key)
      : teamBalances.get(key);
    if (startingBalance === undefined) {
      throw new MapRunError([`Action costs reference a resource without a MapRun balance: "${required.resourceId}"`]);
    }
    if (required.amount > BigInt(startingBalance)) {
      throw new MapRunError([`the fixed-party round cannot afford resource cost "${required.resourceId}"`]);
    }
  }
  for (const required of requiredCosts.values()) {
    const key = required.scope === 'actor' && required.characterId !== undefined
      ? actorResourceKey(required.characterId, required.resourceId)
      : required.resourceId;
    const balance = required.scope === 'actor' ? actorBalances.get(key)! : teamBalances.get(key)!;
    const afterCosts = balance - Number(required.amount);
    if (!Number.isSafeInteger(afterCosts) || afterCosts < 0) {
      throw new MapRunError([`the fixed-party round produced an invalid post-cost balance for "${required.resourceId}"`]);
    }
    if (required.scope === 'actor') actorBalances.set(key, afterCosts);
    else teamBalances.set(key, afterCosts);
  }

  const resourceSettlements = [
    ...settlements.map(settlement => ({ actionId: settlement.actionId, resourceChanges: settlement.resourceChanges })),
    ...(ability ? [{ actionId: ability.actionId, resourceChanges: ability.resourceChanges }] : []),
    ...(item ? [{ actionId: item.actionId, resourceChanges: item.resourceChanges }] : []),
  ];
  for (const settlement of resourceSettlements) {
    for (const change of settlement.resourceChanges) {
      if (change.kind !== 'effect') continue;
      const key = change.scope === 'actor' && change.characterId !== undefined
        ? actorResourceKey(change.characterId, change.resourceId)
        : change.resourceId;
      const currentBalance = change.scope === 'actor' ? actorBalances.get(key) : teamBalances.get(key);
      if (currentBalance === undefined) {
        throw new MapRunError([`Action "${settlement.actionId}" effect references a resource without a MapRun balance`]);
      }
      const afterEffect = currentBalance + change.delta;
      if (!Number.isSafeInteger(afterEffect) || afterEffect < 0) {
        throw new MapRunError([`Action "${settlement.actionId}" effect would leave an invalid balance for "${change.resourceId}"`]);
      }
      if (change.scope === 'actor') actorBalances.set(key, afterEffect);
      else teamBalances.set(key, afterEffect);
    }
  }

  const partyHpAfter = new Map(slot.run.partyHp.map(row => [row.characterId, row.currentHp]));
  const enemyHpAfter = new Map(encounter.enemies.map(row => [row.enemyId, row.currentHp]));
  const partyCaps = partyHpCaps(slot.definition, slot.run.party);
  const enemyDefinitions = encounterDef.enemies ?? [];
  const enemyCaps = new Map(enemyDefinitions.map(enemy => [enemy.id, enemy.maxHp]));
  const hpEffectsToApply: { settlement: (typeof pendingHpActions)[number]['settlement']; changes: MapRunEncounterHpChange[] }[] = [];

  for (const pending of pendingHpActions) {
    const rawEffects: unknown = pending.action.hpEffects ?? [];
    if (!Array.isArray(rawEffects)) throw new MapRunError([`Action "${pending.action.id}" hpEffects must be an array`]);
    const changes: MapRunEncounterHpChange[] = [];
    for (const rawEffect of rawEffects) {
      if (!isRecord(rawEffect) || !Number.isSafeInteger(rawEffect.amount) || (rawEffect.amount as number) === 0) {
        throw new MapRunError([`Action "${pending.action.id}" has an invalid HP effect`]);
      }
      const amount = rawEffect.amount as number;
      if (pending.targetEnemyId !== null) {
        const current = enemyHpAfter.get(pending.targetEnemyId);
        const cap = enemyCaps.get(pending.targetEnemyId);
        if (current === undefined || cap === undefined) throw new MapRunError([`Action "${pending.action.id}" targets an unknown Enemy`]);
        const proposed = BigInt(current) + BigInt(amount);
        const next = current === 0 ? 0 : Number(proposed <= 0n ? 0n : proposed >= BigInt(cap) ? BigInt(cap) : proposed);
        const delta = next - current;
        enemyHpAfter.set(pending.targetEnemyId, next);
        changes.push({ scope: 'enemy', enemyId: pending.targetEnemyId, delta });
      } else if (pending.targetCharacterId !== null) {
        const current = partyHpAfter.get(pending.targetCharacterId);
        const cap = partyCaps.get(pending.targetCharacterId);
        if (current === undefined || cap === undefined) throw new MapRunError([`Action "${pending.action.id}" targets an unknown party member`]);
        const proposed = BigInt(current) + BigInt(amount);
        const next = current === 0 ? 0 : Number(proposed <= 0n ? 0n : proposed >= BigInt(cap) ? BigInt(cap) : proposed);
        const delta = next - current;
        partyHpAfter.set(pending.targetCharacterId, next);
        changes.push({ scope: 'party', characterId: pending.targetCharacterId, delta });
      } else {
        throw new MapRunError([`Action "${pending.action.id}" declares an HP effect without a selected target`]);
      }
    }
    if (changes.length > 0) hpEffectsToApply.push({ settlement: pending.settlement, changes });
  }

  let terminal: MapRunEncounterCommitPlan['terminal'] = 'none';
  const isDefeated = () => slot.run.party.every(member => (partyHpAfter.get(member.characterId) ?? 0) === 0);
  const hasBattle = enemyDefinitions.length > 0;
  const rounds = encounterRounds(encounterDef);
  if (isDefeated()) {
    terminal = 'failure';
  } else if (hasBattle && enemyDefinitions.every(enemy => (enemyHpAfter.get(enemy.id) ?? 0) === 0)) {
    terminal = 'victory';
  } else if (!hasBattle && rounds !== undefined && encounter.round >= rounds) {
    // A Rest ends on its declared finite round count, never on an empty Enemy roster.
    terminal = 'victory';
  }

  const enemyAttacks: { enemyId: string; targetCharacterId: string; damage: number; actualDelta: number }[] = [];
  if (terminal === 'none' && hasBattle) {
    for (const enemy of enemyDefinitions) {
      if ((enemyHpAfter.get(enemy.id) ?? 0) === 0) continue;
      const livingTargets = slot.run.party.flatMap(member => {
        const currentHp = partyHpAfter.get(member.characterId) ?? 0;
        return currentHp > 0 ? [{ characterId: member.characterId, currentHp }] : [];
      });
      if (livingTargets.length === 0) {
        terminal = 'failure';
        break;
      }
      const target = livingTargets.reduce((best, candidate) => candidate.currentHp < best.currentHp ? candidate : best);
      const nextHp = Math.max(0, target.currentHp - enemy.damage);
      partyHpAfter.set(target.characterId, nextHp);
      enemyAttacks.push({ enemyId: enemy.id, targetCharacterId: target.characterId, damage: enemy.damage, actualDelta: nextHp - target.currentHp });
      if (isDefeated()) {
        terminal = 'failure';
        break;
      }
    }
  }
  for (const applied of hpEffectsToApply) {
    if (applied.settlement.kind === 'character') {
      const settlement = settlements[applied.settlement.index];
      if (settlement) settlements[applied.settlement.index] = { ...settlement, hpChanges: applied.changes };
    } else if (applied.settlement.kind === 'ability' && ability) {
      ability = { ...ability, hpChanges: applied.changes };
    } else if (applied.settlement.kind === 'item' && item) {
      item = { ...item, hpChanges: applied.changes };
    }
  }

  return {
    settlements,
    ability,
    item,
    playerCostRequired,
    actorBalancesAfter: actorBalances,
    teamBalancesAfter: teamBalances,
    partyHpAfter,
    enemyHpAfter,
    terminal,
    enemyAttacks,
  };
}

function restoreActorlessSourceSettlement(
  value: unknown,
  kind: 'ability',
  encounter: NonNullable<ResolvedMap['nodes'][number]['encounter']>,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunEncounterSourceSettlement | null;
function restoreActorlessSourceSettlement(
  value: unknown,
  kind: 'item',
  encounter: NonNullable<ResolvedMap['nodes'][number]['encounter']>,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunEncounterItemSettlement | null;
function restoreActorlessSourceSettlement(
  value: unknown,
  kind: 'ability' | 'item',
  encounter: NonNullable<ResolvedMap['nodes'][number]['encounter']>,
  definition: ResolvedMap,
  party: readonly MapRunPartyMember[],
): MapRunEncounterSourceSettlement | MapRunEncounterItemSettlement | null {
  if (!isRecord(value)) return null;
  const expectedKeys = kind === 'ability'
    ? ['actionId', 'target', 'playerCostSpent', 'resourceChanges', 'hpChanges']
    : ['itemId', 'actionId', 'target', 'consumedCount', 'resourceChanges', 'hpChanges'];
  if (Object.keys(value).length !== expectedKeys.length || Object.keys(value).some(key => !expectedKeys.includes(key))
    || !isNonEmptyId(value.actionId) || !Array.isArray(value.resourceChanges) || !Array.isArray(value.hpChanges)) return null;
  const action = (definition.actions ?? []).find(candidate => candidate.id === value.actionId);
  if (!isActorlessSourceAction(action)) return null;
  const target = parseSourceTarget(value.target);
  if (!target || target.kind !== action.target.kind) return null;
  if (target.kind === 'partyCharacter' && !party.some(member => member.characterId === target.characterId)) return null;
  const enemyIds = new Set((encounter.enemies ?? []).map(enemy => enemy.id));
  if (target.kind === 'enemy' && !enemyIds.has(target.enemyId)) return null;
  if (kind === 'ability') {
    if (!encounter.abilityActionIds?.includes(value.actionId) || value.playerCostSpent !== 1) return null;
  } else {
    if (!isNonEmptyId(value.itemId) || value.consumedCount !== 1
      || !encounter.itemActions?.some(mapping => mapping.itemId === value.itemId && mapping.actionId === value.actionId)) return null;
  }
  let expectedChanges: MapRunEncounterSettlementResourceChange[];
  try {
    expectedChanges = settlementChangesFor(action, '', target.kind === 'partyCharacter' ? target.characterId : null);
  } catch {
    return null;
  }
  if (expectedChanges.length !== value.resourceChanges.length) return null;
  for (const [index, raw] of value.resourceChanges.entries()) {
    const expected = expectedChanges[index];
    if (!expected || !isRecord(raw)) return null;
    const expectedKeysForChange = expected.characterId === undefined
      ? ['kind', 'scope', 'resourceId', 'delta']
      : ['kind', 'scope', 'characterId', 'resourceId', 'delta'];
    if (Object.keys(raw).length !== expectedKeysForChange.length
      || Object.keys(raw).some(key => !expectedKeysForChange.includes(key))
      || raw.kind !== expected.kind || raw.scope !== expected.scope
      || raw.characterId !== expected.characterId || raw.resourceId !== expected.resourceId
      || raw.delta !== expected.delta) return null;
  }
  const rawHpEffects: unknown = action.hpEffects ?? [];
  if (!Array.isArray(rawHpEffects) || rawHpEffects.length !== value.hpChanges.length) return null;
  const hpChanges: MapRunEncounterHpChange[] = [];
  for (const [index, raw] of value.hpChanges.entries()) {
    const effect = rawHpEffects[index];
    if (!isRecord(raw) || !isRecord(effect)
      || !Number.isSafeInteger(effect.amount) || (effect.amount as number) === 0
      || !Number.isSafeInteger(raw.delta)) return null;
    const expectedScope = target.kind === 'enemy' ? 'enemy' : 'party';
    const expectedId = target.kind === 'enemy' ? target.enemyId : target.characterId;
    const expectedHpKeys = expectedScope === 'enemy' ? ['scope', 'enemyId', 'delta'] : ['scope', 'characterId', 'delta'];
    if (Object.keys(raw).length !== expectedHpKeys.length || Object.keys(raw).some(key => !expectedHpKeys.includes(key))
      || raw.scope !== expectedScope
      || (expectedScope === 'enemy' ? raw.enemyId !== expectedId : raw.characterId !== expectedId)
      || Math.abs(raw.delta as number) > Math.abs(effect.amount as number)
      || ((effect.amount as number) < 0 && (raw.delta as number) > 0)
      || ((effect.amount as number) > 0 && (raw.delta as number) < 0)) return null;
    hpChanges.push(expectedScope === 'enemy'
      ? { scope: 'enemy', enemyId: expectedId, delta: raw.delta as number }
      : { scope: 'party', characterId: expectedId, delta: raw.delta as number });
  }
  return kind === 'ability'
    ? {
      actionId: value.actionId,
      target,
      playerCostSpent: 1,
      resourceChanges: expectedChanges,
      hpChanges,
    }
    : {
      itemId: value.itemId as string,
      actionId: value.actionId,
      target,
      consumedCount: 1,
      resourceChanges: expectedChanges,
      hpChanges,
    };
}

function restoreEncounterCommitReceipt(
  value: unknown,
  definition: ResolvedMap,
  expectedNodeId: string | null,
  party: readonly MapRunPartyMember[],
  encounterRound: number | null,
  commitVersion: number,
  runId: string,
  activityId?: string,
): MapRunEncounterCommitReceipt | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  const receiptNodeId = typeof value.nodeId === 'string' ? value.nodeId : null;
  const hasEnemyAttacks = Object.prototype.hasOwnProperty.call(value, 'enemyAttacks');
  const hasAbility = Object.prototype.hasOwnProperty.call(value, 'ability');
  const hasItem = Object.prototype.hasOwnProperty.call(value, 'item');
  const hasActivityId = Object.prototype.hasOwnProperty.call(value, 'activityId');
  if (keys.length < 7 || keys.length > 11 || keys.some(key => ![
    'requestId', 'commandVersion', 'resultingCommitVersion', 'nodeId', 'activityId', 'round', 'draftVersion', 'settlements', 'enemyAttacks', 'ability', 'item',
  ].includes(key))
    || !isNonEmptyId(value.requestId)
    || !Number.isSafeInteger(value.commandVersion) || (value.commandVersion as number) < 0
    || !Number.isSafeInteger(value.resultingCommitVersion)
    || value.resultingCommitVersion !== (value.commandVersion as number) + 1
    || value.resultingCommitVersion !== commitVersion
    || !isNonEmptyId(receiptNodeId)
    || (expectedNodeId !== null && receiptNodeId !== expectedNodeId)
    || hasActivityId !== (activityId !== undefined)
    || (hasActivityId && value.activityId !== activityId)
    || !Number.isSafeInteger(value.round) || (value.round as number) < 1
    || (encounterRound !== null && value.round !== encounterRound - 1)
    || !Number.isSafeInteger(value.draftVersion) || (value.draftVersion as number) < 0
    || !Array.isArray(value.settlements) || value.settlements.length !== party.length
    || (hasEnemyAttacks && !Array.isArray(value.enemyAttacks))) return null;

  const node = definition.nodes.find(candidate => candidate.id === receiptNodeId);
  const encounterDef = resolveNodeEncounter(node, activityId);
  if (!node || !encounterDef) return null;
  const abilitySettlement = hasAbility
    ? restoreActorlessSourceSettlement(value.ability, 'ability', encounterDef, definition, party)
    : null;
  const itemSettlement = hasItem
    ? restoreActorlessSourceSettlement(value.item, 'item', encounterDef, definition, party)
    : null;
  if ((hasAbility && !abilitySettlement) || (hasItem && !itemSettlement)) return null;
  const candidatesByCharacter = new Map<string, Set<string>>();
  for (const participant of encounterDef.participants ?? []) {
    candidatesByCharacter.set(participant.characterId, new Set(participant.actions.map(candidate => candidate.actionId)));
  }
  const restoredSettlements: MapRunEncounterActionSettlement[] = [];
  const actionById = new Map((definition.actions ?? []).map(action => [action.id, action]));
  let cardPlan: ReturnType<typeof resolveMapCardEffects>;
  try {
    cardPlan = resolveMapCardEffects(definition, { runId, mapId: definition.id, nodeId: receiptNodeId!,
      activityId: activityId ?? null, round: value.round as number }, value.settlements as unknown as readonly MapCardActionChoice[]);
  } catch { return null; }
  let playerCostSpentTotal = abilitySettlement ? 1 : 0;
  // Each Character may spend at most one PlayerCost per round; Ability spends one more.
  const maxPlayerCostSpent = party.length + (abilitySettlement ? 1 : 0);
  for (const [index, rawSettlement] of value.settlements.entries()) {
    const member = party[index];
    if (!member || !isRecord(rawSettlement)) return null;
    const settlementKeys = Object.keys(rawSettlement);
    const hasEnemyTarget = Object.prototype.hasOwnProperty.call(rawSettlement, 'targetEnemyId');
    const hasHpChanges = Object.prototype.hasOwnProperty.call(rawSettlement, 'hpChanges');
    const hasCardTarget = Object.prototype.hasOwnProperty.call(rawSettlement, 'targetCard');
    const hasScostCost = Object.prototype.hasOwnProperty.call(rawSettlement, 'scostCost');
    const allowedSettlementKeys = [
      'characterId', 'actionId', 'targetCharacterId', 'targetEnemyId', 'overrideKind', 'playerCostSpent', 'resourceChanges', 'hpChanges', 'targetCard', 'scostCost',
    ];
    if (settlementKeys.some(key => !allowedSettlementKeys.includes(key))
      || settlementKeys.length !== 6 + Number(hasEnemyTarget) + Number(hasHpChanges) + Number(hasCardTarget) + Number(hasScostCost)
      || rawSettlement.characterId !== member.characterId
      || !(rawSettlement.actionId === null || isNonEmptyId(rawSettlement.actionId))
      || !(rawSettlement.targetCharacterId === null || isNonEmptyId(rawSettlement.targetCharacterId))
      || (hasEnemyTarget && !isNonEmptyId(rawSettlement.targetEnemyId))
      || !(rawSettlement.overrideKind === null || rawSettlement.overrideKind === 'swap' || rawSettlement.overrideKind === 'playerCommand')
      || !Number.isSafeInteger(rawSettlement.playerCostSpent)
      || (rawSettlement.playerCostSpent !== 0 && rawSettlement.playerCostSpent !== 1)
      || !Array.isArray(rawSettlement.resourceChanges)) return null;

    const actionId = rawSettlement.actionId as string | null;
    const targetCharacterId = rawSettlement.targetCharacterId as string | null;
    const targetEnemyId = hasEnemyTarget ? rawSettlement.targetEnemyId as string : null;
    const overrideKind = rawSettlement.overrideKind as MapRunActionOverride['kind'] | null;
    playerCostSpentTotal += rawSettlement.playerCostSpent as number;
    if (playerCostSpentTotal > maxPlayerCostSpent) return null;
    if (actionId === null) {
      if (targetCharacterId !== null || targetEnemyId !== null || hasHpChanges || hasCardTarget || hasScostCost || overrideKind !== null || rawSettlement.playerCostSpent !== 0
        || rawSettlement.resourceChanges.length !== 0) return null;
      restoredSettlements.push({
        characterId: member.characterId, actionId: null, targetCharacterId: null,
        overrideKind: null, playerCostSpent: 0, resourceChanges: [],
      });
      continue;
    }
    const action = actionById.get(actionId);
    if (!action || !action.eligibleCharacterIds.includes(member.characterId)
      || !candidatesByCharacter.get(member.characterId)?.has(actionId)
      || (rawSettlement.playerCostSpent === 1) !== (overrideKind === 'playerCommand')
      || (overrideKind === 'swap' && rawSettlement.playerCostSpent !== 0)) return null;
    if (hasCardTarget !== cardPlan.targets.has(member.characterId)
      || (action.target.kind === 'card' && (targetCharacterId !== null || targetEnemyId !== null || !hasCardTarget))) return null;
    if ((action.target.kind === 'none' && (targetCharacterId !== null || targetEnemyId !== null))
      || (action.target.kind === 'self' && (targetCharacterId !== member.characterId || targetEnemyId !== null))
      || (action.target.kind === 'partyCharacter'
        && (!targetCharacterId || targetEnemyId !== null || !party.some(candidate => candidate.characterId === targetCharacterId)))
      || (action.target.kind === 'enemy'
        && (targetCharacterId !== null || !targetEnemyId || !(encounterDef.enemies ?? []).some(enemy => enemy.id === targetEnemyId)))) return null;

    let expectedChanges: MapRunEncounterSettlementResourceChange[];
    let expectedScost: ReturnType<typeof mapScostCost>;
    try {
      const reduction = cardPlan.reductions.get(member.characterId) ?? 0n;
      expectedChanges = settlementChangesFor(action, member.characterId, targetCharacterId, reduction);
      expectedScost = mapScostCost(action, reduction);
    } catch {
      return null;
    }
    if (hasScostCost !== (expectedScost !== null)) return null;
    if (expectedScost && (!isRecord(rawSettlement.scostCost) || Object.keys(rawSettlement.scostCost).length !== 3
      || Object.keys(expectedScost).some(key => (rawSettlement.scostCost as Record<string, unknown>)[key]
        !== expectedScost![key as keyof typeof expectedScost]))) return null;
    if (expectedChanges.length !== rawSettlement.resourceChanges.length) return null;
    for (const [changeIndex, rawChange] of rawSettlement.resourceChanges.entries()) {
      const expected = expectedChanges[changeIndex];
      if (!expected || !isRecord(rawChange)) return null;
      const expectedKeys = expected.characterId === undefined
        ? ['kind', 'scope', 'resourceId', 'delta']
        : ['kind', 'scope', 'characterId', 'resourceId', 'delta'];
      const changeKeys = Object.keys(rawChange);
      if (changeKeys.length !== expectedKeys.length || changeKeys.some(key => !expectedKeys.includes(key))
        || rawChange.kind !== expected.kind || rawChange.scope !== expected.scope
        || rawChange.characterId !== expected.characterId || rawChange.resourceId !== expected.resourceId
        || rawChange.delta !== expected.delta) return null;
    }
    let restoredHpChanges: MapRunEncounterHpChange[] | undefined;
    const rawHpEffects: unknown = action.hpEffects ?? [];
    if (!Array.isArray(rawHpEffects)) return null;
    if (rawHpEffects.length > 0) {
      if (!hasHpChanges || !Array.isArray(rawSettlement.hpChanges)
        || rawSettlement.hpChanges.length !== rawHpEffects.length) return null;
      restoredHpChanges = [];
      for (const [hpIndex, rawHpChange] of rawSettlement.hpChanges.entries()) {
        const rawEffect = rawHpEffects[hpIndex];
        if (!isRecord(rawEffect) || !isRecord(rawHpChange)
          || !Number.isSafeInteger(rawEffect.amount) || (rawEffect.amount as number) === 0
          || !Number.isSafeInteger(rawHpChange.delta)) return null;
        const expectedScope = targetEnemyId !== null ? 'enemy' : 'party';
        const expectedIdentity = targetEnemyId ?? targetCharacterId;
        const expectedHpKeys = expectedScope === 'enemy' ? ['scope', 'enemyId', 'delta'] : ['scope', 'characterId', 'delta'];
        if (rawHpChange.scope !== expectedScope
          || Object.keys(rawHpChange).length !== expectedHpKeys.length
          || Object.keys(rawHpChange).some(key => !expectedHpKeys.includes(key))
          || (expectedScope === 'enemy' ? rawHpChange.enemyId !== expectedIdentity : rawHpChange.characterId !== expectedIdentity)
          || Math.abs(rawHpChange.delta as number) > Math.abs(rawEffect.amount as number)
          || ((rawEffect.amount as number) < 0 && (rawHpChange.delta as number) > 0)
          || ((rawEffect.amount as number) > 0 && (rawHpChange.delta as number) < 0)) return null;
        restoredHpChanges.push(expectedScope === 'enemy'
          ? { scope: 'enemy', enemyId: expectedIdentity!, delta: rawHpChange.delta as number }
          : { scope: 'party', characterId: expectedIdentity!, delta: rawHpChange.delta as number });
      }
    } else if (hasHpChanges) {
      return null;
    }
    restoredSettlements.push({
      characterId: member.characterId,
      actionId,
      targetCharacterId,
      ...(targetEnemyId === null ? {} : { targetEnemyId }),
      ...(cardPlan.targets.has(member.characterId) ? { targetCard: cardPlan.targets.get(member.characterId)! } : {}),
      ...(expectedScost ? { scostCost: expectedScost } : {}),
      overrideKind,
      playerCostSpent: rawSettlement.playerCostSpent as 0 | 1,
      resourceChanges: expectedChanges,
      ...(restoredHpChanges ? { hpChanges: restoredHpChanges } : {}),
    });
  }

  const enemyAttacks: NonNullable<MapRunEncounterCommitReceipt['enemyAttacks']>[number][] = [];
  if (hasEnemyAttacks) {
    const roster = encounterDef.enemies ?? [];
    const rosterOrder = new Map(roster.map((enemy, index) => [enemy.id, index]));
    let previousEnemyIndex = -1;
    const seenAttackers = new Set<string>();
    for (const rawAttack of value.enemyAttacks as unknown[]) {
      if (!isRecord(rawAttack) || !isNonEmptyId(rawAttack.enemyId)
        || Object.keys(rawAttack).length !== 4
        || Object.keys(rawAttack).some(key => !['enemyId', 'targetCharacterId', 'damage', 'actualDelta'].includes(key))
        || !isNonEmptyId(rawAttack.targetCharacterId)
        || !party.some(member => member.characterId === rawAttack.targetCharacterId)
        || !Number.isSafeInteger(rawAttack.damage) || !Number.isSafeInteger(rawAttack.actualDelta)
        || (rawAttack.actualDelta as number) >= 0) return null;
      const enemy = roster.find(row => row.id === rawAttack.enemyId);
      const enemyIndex = rosterOrder.get(rawAttack.enemyId);
      if (!enemy || enemyIndex === undefined || enemyIndex <= previousEnemyIndex
        || seenAttackers.has(rawAttack.enemyId) || rawAttack.damage !== enemy.damage
        || Math.abs(rawAttack.actualDelta as number) > enemy.damage) return null;
      previousEnemyIndex = enemyIndex;
      seenAttackers.add(rawAttack.enemyId);
      enemyAttacks.push({
        enemyId: rawAttack.enemyId,
        targetCharacterId: rawAttack.targetCharacterId,
        damage: enemy.damage,
        actualDelta: rawAttack.actualDelta as number,
      });
    }
    if (enemyAttacks.length > 0 && roster.length === 0) return null;
  }

  return {
    requestId: value.requestId,
    commandVersion: value.commandVersion as number,
    resultingCommitVersion: value.resultingCommitVersion as number,
    nodeId: receiptNodeId!,
    ...(activityId === undefined ? {} : { activityId }),
    round: value.round as number,
    draftVersion: value.draftVersion as number,
    settlements: restoredSettlements,
    ...(abilitySettlement ? { ability: abilitySettlement } : {}),
    ...(itemSettlement ? { item: itemSettlement } : {}),
    ...(hasEnemyAttacks ? { enemyAttacks } : {}),
  };
}

function restoreEncounterSnapshot(
  value: unknown,
  definition: ResolvedMap,
  expectedNodeId: string,
  party: readonly MapRunPartyMember[],
  partyHp: readonly MapRunPartyHp[],
  actorResources: readonly MapRunActorResourceBalance[],
  teamResources: readonly MapRunTeamResourceBalance[],
  playerCost: number,
  commitVersion: number,
  runId: string,
  activityId?: string,
): MapRunEncounterSnapshot | null {
  if (!isRecord(value)) return null;
  const hasOverrides = Object.prototype.hasOwnProperty.call(value, 'overrides');
  const hasLegacyOverride = Object.prototype.hasOwnProperty.call(value, 'override');
  const hasTargetSelections = Object.prototype.hasOwnProperty.call(value, 'targetSelections');
  const hasDraftVersion = Object.prototype.hasOwnProperty.call(value, 'draftVersion');
  const abilityDraftSnapshot: unknown = Object.prototype.hasOwnProperty.call(value, 'abilityDraft') ? value.abilityDraft : null;
  const itemDraftSnapshot: unknown = Object.prototype.hasOwnProperty.call(value, 'itemDraft') ? value.itemDraft : null;
  const isLegacyDraftSnapshot = !hasOverrides && !hasLegacyOverride && !hasTargetSelections && !hasDraftVersion;
  // Snapshots written before multiple overrides used one nullable `override`; migrate it into the list form.
  const overridesSnapshot: unknown = isLegacyDraftSnapshot
    ? []
    : hasOverrides
      ? value.overrides
      : hasLegacyOverride
        ? (value.override === null || value.override === undefined ? [] : [value.override])
        : [];
  const targetSelectionsSnapshot: unknown = isLegacyDraftSnapshot ? [] : value.targetSelections;
  const draftVersionSnapshot: unknown = isLegacyDraftSnapshot ? 0 : value.draftVersion;
  const lastCommitSnapshot: unknown = Object.prototype.hasOwnProperty.call(value, 'lastCommit') ? value.lastCommit : null;

  if (value.nodeId !== expectedNodeId
    || (value.activityId ?? null) !== (activityId ?? null)
    || (activityId !== undefined && !isNonEmptyId(value.activityId))
    || !Number.isSafeInteger(value.round) || (value.round as number) < 1
    || !Number.isSafeInteger(draftVersionSnapshot) || (draftVersionSnapshot as number) < 0
    || !Number.isSafeInteger(value.drawCursorStart) || (value.drawCursorStart as number) < 0
    || !isRecord(value.randomState)
    || value.randomState.algorithm !== GAMEPLAY_B_HAND_RNG_ALGORITHM
    || !Number.isSafeInteger(value.randomState.seed)
    || !Number.isSafeInteger(value.randomState.cursor) || (value.randomState.cursor as number) < 0
    || (value.drawCursorStart as number) > (value.randomState.cursor as number)
    || (value.round === 1 && value.drawCursorStart !== 0)
    || !Array.isArray(overridesSnapshot)
    || !(lastCommitSnapshot === null || isRecord(lastCommitSnapshot))
    || !Array.isArray(targetSelectionsSnapshot)
    || !Array.isArray(value.hands)
    || value.hands.length !== party.length
    || !Array.isArray(value.enemies)) return null;

  const savedHands: { characterId: string; actionIds: string[] }[] = [];
  for (const [index, row] of value.hands.entries()) {
    const partyMember = party[index];
    if (!partyMember || !isRecord(row)
      || row.characterId !== partyMember.characterId
      || !isUniqueIdArray(row.actionIds)
      || row.actionIds.length > 3) return null;
    savedHands.push({ characterId: partyMember.characterId, actionIds: [...row.actionIds] });
  }

  const targetSelections: MapRunEncounterTargetSelection[] = [];
  const selectedCharacters = new Set<string>();
  let previousPartyIndex = -1;
  for (const rawSelection of targetSelectionsSnapshot) {
    if (!isRecord(rawSelection)) return null;
    const keys = Object.keys(rawSelection);
    const partyIndex = party.findIndex(member => member.characterId === rawSelection.characterId);
    const partyTarget = keys.length === 2 && keys.every(key => ['characterId', 'targetCharacterId'].includes(key))
      && isNonEmptyId(rawSelection.targetCharacterId);
    const enemyTarget = keys.length === 2 && keys.every(key => ['characterId', 'targetEnemyId'].includes(key))
      && isNonEmptyId(rawSelection.targetEnemyId);
    const targetCard = keys.length === 2 && keys.every(key => ['characterId', 'targetCard'].includes(key))
      ? parseMapRunCardRef(rawSelection.targetCard) : null;
    if ((!partyTarget && !enemyTarget && !targetCard)
      || !isNonEmptyId(rawSelection.characterId) || partyIndex < 0
      || partyIndex <= previousPartyIndex || selectedCharacters.has(rawSelection.characterId)) return null;
    previousPartyIndex = partyIndex;
    selectedCharacters.add(rawSelection.characterId);
    targetSelections.push(targetCard ? { characterId: rawSelection.characterId, targetCard } : partyTarget
      ? { characterId: rawSelection.characterId, targetCharacterId: rawSelection.targetCharacterId as string }
      : { characterId: rawSelection.characterId, targetEnemyId: rawSelection.targetEnemyId as string });
  }

  const node = definition.nodes.find(candidate => candidate.id === expectedNodeId);
  const encounterDef = resolveNodeEncounter(node, activityId);
  if (!node || !encounterDef) return null;
  const expectedEnemyDefinitions = encounterDef.enemies ?? [];
  if (value.enemies.length !== expectedEnemyDefinitions.length) return null;
  const enemies: MapRunEnemyHp[] = [];
  for (const [index, rawEnemy] of value.enemies.entries()) {
    const expectedEnemy = expectedEnemyDefinitions[index];
    if (!expectedEnemy || !isRecord(rawEnemy) || Object.keys(rawEnemy).length !== 2
      || Object.keys(rawEnemy).some(key => !['enemyId', 'currentHp'].includes(key))
      || rawEnemy.enemyId !== expectedEnemy.id
      || !Number.isSafeInteger(rawEnemy.currentHp) || (rawEnemy.currentHp as number) < 0
      || (rawEnemy.currentHp as number) > expectedEnemy.maxHp) return null;
    enemies.push({ enemyId: expectedEnemy.id, currentHp: rawEnemy.currentHp as number });
  }
  if (expectedEnemyDefinitions.length > 0 && enemies.every(enemy => enemy.currentHp === 0)) return null;

  const actionById = new Map((definition.actions ?? []).map(action => [action.id, action]));
  const abilityActionIds = encounterDef.abilityActionIds ?? [];
  let abilityDraft: MapRunEncounterAbilityDraft | null = null;
  if (abilityDraftSnapshot !== null) {
    if (!isRecord(abilityDraftSnapshot)
      || Object.keys(abilityDraftSnapshot).length !== 2
      || Object.keys(abilityDraftSnapshot).some(key => !['actionId', 'target'].includes(key))
      || !isNonEmptyId(abilityDraftSnapshot.actionId)
      || !abilityActionIds.includes(abilityDraftSnapshot.actionId)) return null;
    const action = actionById.get(abilityDraftSnapshot.actionId);
    const target = parseSourceTarget(abilityDraftSnapshot.target);
    if (!isActorlessSourceAction(action) || target === undefined
      || (target !== null && target.kind !== action.target.kind)) return null;
    if (target?.kind === 'partyCharacter'
      && (!party.some(member => member.characterId === target.characterId)
        || (partyHp.find(row => row.characterId === target.characterId)?.currentHp ?? 0) <= 0)) return null;
    if (target?.kind === 'enemy' && !enemies.some(enemy => enemy.enemyId === target.enemyId && enemy.currentHp > 0)) return null;
    abilityDraft = { actionId: abilityDraftSnapshot.actionId, target };
  }

  const itemMappings = encounterDef.itemActions ?? [];
  let itemDraft: MapRunEncounterItemDraft | null = null;
  if (itemDraftSnapshot !== null) {
    if (!isRecord(itemDraftSnapshot)
      || Object.keys(itemDraftSnapshot).length !== 3
      || Object.keys(itemDraftSnapshot).some(key => !['itemId', 'actionId', 'target'].includes(key))
      || !isNonEmptyId(itemDraftSnapshot.itemId)
      || !isNonEmptyId(itemDraftSnapshot.actionId)) return null;
    const mapping = itemMappings.find(candidate => candidate.itemId === itemDraftSnapshot.itemId);
    const action = actionById.get(itemDraftSnapshot.actionId);
    const target = parseSourceTarget(itemDraftSnapshot.target);
    if (!mapping || mapping.actionId !== itemDraftSnapshot.actionId
      || !isActorlessSourceAction(action) || target === undefined
      || (target !== null && target.kind !== action.target.kind)) return null;
    if (target?.kind === 'partyCharacter'
      && (!party.some(member => member.characterId === target.characterId)
        || (partyHp.find(row => row.characterId === target.characterId)?.currentHp ?? 0) <= 0)) return null;
    if (target?.kind === 'enemy' && !enemies.some(enemy => enemy.enemyId === target.enemyId && enemy.currentHp > 0)) return null;
    itemDraft = { itemId: itemDraftSnapshot.itemId, actionId: itemDraftSnapshot.actionId, target };
  }

  const handsByCharacter = new Map(savedHands.map(hand => [hand.characterId, hand.actionIds]));
  const overrides: MapRunActionOverride[] = [];
  const overrideCharacters = new Set<string>();
  let previousOverridePartyIndex = -1;
  for (const rawOverride of overridesSnapshot) {
    if (!isRecord(rawOverride)) return null;
    const keys = Object.keys(rawOverride);
    if (keys.length !== 3 || keys.some(key => !['kind', 'characterId', 'actionId'].includes(key))
      || (rawOverride.kind !== 'swap' && rawOverride.kind !== 'playerCommand')
      || !isNonEmptyId(rawOverride.characterId) || !isNonEmptyId(rawOverride.actionId)) return null;
    const partyIndex = party.findIndex(member => member.characterId === rawOverride.characterId);
    const hand = handsByCharacter.get(rawOverride.characterId) ?? [];
    const action = actionById.get(rawOverride.actionId);
    if (partyIndex < 0 || partyIndex <= previousOverridePartyIndex || overrideCharacters.has(rawOverride.characterId)
      || !action || !action.eligibleCharacterIds.includes(rawOverride.characterId)) return null;
    if (rawOverride.kind === 'swap') {
      if (!hand.includes(rawOverride.actionId) || rawOverride.actionId === hand[0]) return null;
    } else if (hand.includes(rawOverride.actionId)) return null;
    previousOverridePartyIndex = partyIndex;
    overrideCharacters.add(rawOverride.characterId);
    overrides.push({
      kind: rawOverride.kind,
      characterId: rawOverride.characterId,
      actionId: rawOverride.actionId,
    });
  }
  const drawCursorStart = value.drawCursorStart as number;
  let expectedDraw: ReturnType<typeof drawGameplayBHands>;
  try {
    expectedDraw = drawGameplayBHands({
      partyCharacterIds: party.map(member => member.characterId),
      livingPartyCharacterIds: partyHp.filter(row => row.currentHp > 0).map(row => row.characterId),
      participants: encounterDef.participants,
      actions: definition.actions,
      actorResources,
      teamResources,
      randomState: {
        algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
        seed: value.randomState.seed as number,
        cursor: drawCursorStart,
      },
    });
  } catch {
    return null;
  }
  if (expectedDraw.randomState.cursor !== value.randomState.cursor
    || expectedDraw.hands.some((hand, index) => hand.characterId !== savedHands[index]?.characterId
      || hand.actionIds.length !== savedHands[index]?.actionIds.length
      || hand.actionIds.some((actionId, actionIndex) => actionId !== savedHands[index]?.actionIds[actionIndex]))) return null;

  const restored: MapRunEncounterSnapshot = {
    nodeId: expectedNodeId,
    ...(activityId === undefined ? {} : { activityId }),
    round: value.round as number,
    hands: savedHands,
    overrides,
    targetSelections,
    ...(abilityDraft === null ? {} : { abilityDraft }),
    ...(itemDraft === null ? {} : { itemDraft }),
    enemies,
    draftVersion: draftVersionSnapshot as number,
    drawCursorStart,
    randomState: {
      algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
      seed: value.randomState.seed as number,
      cursor: value.randomState.cursor as number,
    },
    lastCommit: lastCommitSnapshot === null
      ? null
      : restoreEncounterCommitReceipt(lastCommitSnapshot, definition, expectedNodeId, party, value.round as number, commitVersion, runId, activityId),
  };
  if (lastCommitSnapshot !== null && restored.lastCommit === null) return null;
  try {
    resolveGameplayBActionPreview({
      runId,
      definition,
      encounter: restored,
      party,
      partyHp,
      playerCost,
      actorResources,
      teamResources,
    });
  } catch {
    return null;
  }
  return restored;
}

function hasInvalidActiveEncounterNodeAlias(value: Record<string, unknown>, expectedNodeId: string | null): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(value, 'activeEncounterNodeId');
  if (!descriptor) return false;
  if (descriptor.enumerable) return true;
  try {
    return value.activeEncounterNodeId !== expectedNodeId;
  } catch {
    return true;
  }
}

function sameShopRows(
  value: readonly unknown[],
  expected: readonly { readonly resourceId: string; readonly amount: number }[],
): boolean {
  if (value.length !== expected.length) return false;
  for (const [index, row] of value.entries()) {
    const target = expected[index];
    if (!target || !isRecord(row) || Object.keys(row).length !== 2
      || row.resourceId !== target.resourceId || row.amount !== target.amount) return false;
  }
  return true;
}

function restoreShopPurchaseReceipt(
  value: unknown,
  nodeId: string,
  activity: GameplayMapActivityDef,
  activityId: string,
  draftVersion: number,
): MapRunShopPurchaseReceipt | null {
  const shop = activity.shop;
  if (!shop || !isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 8 || keys.some(key => ![
    'requestId', 'offerId', 'nodeId', 'activityId', 'resultingDraftVersion', 'costs', 'effects', 'heal',
  ].includes(key))
    || !isNonEmptyId(value.requestId) || !isNonEmptyId(value.offerId)
    || value.nodeId !== nodeId || value.activityId !== activityId
    || !Number.isSafeInteger(value.resultingDraftVersion) || (value.resultingDraftVersion as number) !== draftVersion
    || !Array.isArray(value.costs) || !Array.isArray(value.effects)) return null;
  const offer = shop.offers.find(candidate => candidate.id === value.offerId);
  if (!offer) return null;
  let expectedCosts: readonly { resourceId: string; amount: number }[];
  let expectedEffects: readonly { resourceId: string; amount: number }[];
  try {
    expectedCosts = freezeShopCosts(offer);
    expectedEffects = freezeShopEffects(offer);
  } catch {
    return null;
  }
  if (!sameShopRows(value.costs, expectedCosts) || !sameShopRows(value.effects, expectedEffects)) return null;
  let heal: MapRunShopPurchaseReceipt['heal'] = null;
  if (offer.heal === undefined) {
    if (value.heal !== null) return null;
  } else {
    if (!isRecord(value.heal) || Object.keys(value.heal).length !== 3
      || Object.keys(value.heal).some(key => !['characterId', 'amount', 'restored'].includes(key))
      || value.heal.characterId !== offer.heal.characterId
      || value.heal.amount !== offer.heal.amount
      || !Number.isSafeInteger(value.heal.restored) || (value.heal.restored as number) < 0
      || (value.heal.restored as number) > offer.heal.amount) return null;
    heal = { characterId: offer.heal.characterId, amount: offer.heal.amount, restored: value.heal.restored as number };
  }
  return {
    requestId: value.requestId,
    offerId: value.offerId,
    nodeId,
    activityId,
    resultingDraftVersion: draftVersion,
    costs: expectedCosts,
    effects: expectedEffects,
    heal,
  };
}

function restoreRunState(
  value: unknown,
  definition: ResolvedMap,
  mapId: string,
  resolveCharacterIdForVariant?: ResolveCharacterIdForVariant,
): MutableMapRun | null {
  const commitVersionSnapshot: unknown = isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'commitVersion')
    ? value.commitVersion
    : 0;
  if (!isRecord(value)
    || !isNonEmptyId(value.runId)
    || value.mapId !== mapId
    || value.status !== 'inProgress'
    || !isPartySnapshot(value.party, definition.partyCharacterIds, resolveCharacterIdForVariant)
    || !Object.prototype.hasOwnProperty.call(value, 'partyHp')
    || !Object.prototype.hasOwnProperty.call(value, 'lastEncounterCommit')
    || !Number.isSafeInteger(value.playerCost)
    || (value.playerCost as number) < 0
    || !Number.isSafeInteger(commitVersionSnapshot) || (commitVersionSnapshot as number) < 0
    || !isNonEmptyId(value.currentNodeId)
    || !isUniqueIdArray(value.visitedNodeIds)
    || !isUniqueIdArray(value.completedEncounterNodeIds)
    || !(value.activeEncounter === null || isRecord(value.activeEncounter))) return null;

  const nodesById = new Map(definition.nodes.map(node => [node.id, node]));
  const knownNodeIds = new Set(nodesById.keys());
  const contentNodeIds = new Set(definition.nodes
    .filter(node => node.encounter !== undefined || nodeActivities(node).length > 0)
    .map(node => node.id));
  const visitedNodeIds = value.visitedNodeIds;
  const completedEncounterNodeIds = value.completedEncounterNodeIds;
  const currentNodeId = value.currentNodeId;
  const currentNode = nodesById.get(currentNodeId);

  if (!currentNode
    || visitedNodeIds[0] !== definition.startNodeId
    || !visitedNodeIds.includes(currentNodeId)
    || visitedNodeIds.some(nodeId => !knownNodeIds.has(nodeId))
    || completedEncounterNodeIds.some(nodeId => !contentNodeIds.has(nodeId) || !visitedNodeIds.includes(nodeId))) return null;

  const completedActivityIdsSnapshot: unknown = value.completedActivityIds === undefined
    ? []
    : value.completedActivityIds;
  if (!isUniqueIdArray(completedActivityIdsSnapshot)) return null;
  for (const key of completedActivityIdsSnapshot) {
    const separator = key.indexOf('/');
    const nodeId = separator < 0 ? '' : key.slice(0, separator);
    const activityId = separator < 0 ? '' : key.slice(separator + 1);
    const owner = nodesById.get(nodeId);
    if (!owner || !visitedNodeIds.includes(nodeId)
      || !nodeActivities(owner).some(activity => activity.id === activityId)) return null;
  }

  const expectedResources = initialResourceBalances(definition, value.party);
  const partyHp = restorePartyHp(value.partyHp, definition, value.party);
  const actorResources = restoreActorResourceBalances(value.actorResources, expectedResources.actorResources);
  const teamResources = restoreTeamResourceBalances(value.teamResources, expectedResources.teamResources);
  if (!partyHp || !actorResources || !teamResources) return null;
  const lastEncounterCommitSnapshot: unknown = value.lastEncounterCommit;
  if (!(lastEncounterCommitSnapshot === null || isRecord(lastEncounterCommitSnapshot))) return null;
  if (((commitVersionSnapshot as number) === 0) !== (lastEncounterCommitSnapshot === null)) return null;
  const lastReceiptActivityId = isRecord(lastEncounterCommitSnapshot)
    && isNonEmptyId(lastEncounterCommitSnapshot.activityId)
    ? lastEncounterCommitSnapshot.activityId
    : undefined;
  const lastEncounterCommit = lastEncounterCommitSnapshot === null
    ? null
    : restoreEncounterCommitReceipt(
      lastEncounterCommitSnapshot,
      definition,
      null,
      value.party,
      null,
      commitVersionSnapshot as number,
      value.runId as string,
      lastReceiptActivityId,
    );
  if (lastEncounterCommitSnapshot !== null && lastEncounterCommit === null) return null;
  if (lastEncounterCommit && !visitedNodeIds.includes(lastEncounterCommit.nodeId)) return null;

  const currentActivities = nodeActivities(currentNode);
  const currentNodeCompleted = completedEncounterNodeIds.includes(currentNode.id);
  const rawActiveActivity: unknown = value.activeActivity === undefined ? null : value.activeActivity;
  if (!(rawActiveActivity === null || isRecord(rawActiveActivity))) return null;

  let activeActivity: MapRunActiveActivity | null = null;
  let activeActivityRequiresEncounter = false;
  if (rawActiveActivity !== null) {
    if (currentActivities.length === 0 || currentNodeCompleted) return null;
    const keys = Object.keys(rawActiveActivity);
    if (keys.length !== 6 || keys.some(key => ![
      'nodeId', 'activityId', 'index', 'kind', 'shopDraftVersion', 'lastPurchase',
    ].includes(key))
      || rawActiveActivity.nodeId !== currentNode.id
      || !isNonEmptyId(rawActiveActivity.activityId)
      || !Number.isSafeInteger(rawActiveActivity.index) || (rawActiveActivity.index as number) < 0
      || !Number.isSafeInteger(rawActiveActivity.shopDraftVersion)
      || (rawActiveActivity.shopDraftVersion as number) < 0) return null;
    const index = rawActiveActivity.index as number;
    const activity = currentActivities[index];
    if (!activity || activity.id !== rawActiveActivity.activityId) return null;
    const kind = activityKind(activity);
    if (rawActiveActivity.kind !== kind) return null;
    const rawLastPurchase = rawActiveActivity.lastPurchase;
    if (!(rawLastPurchase === null || isRecord(rawLastPurchase))) return null;
    if (kind === 'shop') {
      const lastPurchase = rawLastPurchase === null
        ? null
        : restoreShopPurchaseReceipt(
          rawLastPurchase,
          currentNode.id,
          activity,
          activity.id,
          rawActiveActivity.shopDraftVersion as number,
        );
      if (rawLastPurchase !== null && lastPurchase === null) return null;
      activeActivity = {
        nodeId: currentNode.id,
        activityId: activity.id,
        index,
        kind,
        shopDraftVersion: rawActiveActivity.shopDraftVersion as number,
        lastPurchase,
      };
    } else {
      if (rawActiveActivity.shopDraftVersion !== 0 || rawLastPurchase !== null) return null;
      activeActivityRequiresEncounter = true;
      activeActivity = {
        nodeId: currentNode.id,
        activityId: activity.id,
        index,
        kind,
        shopDraftVersion: 0,
        lastPurchase: null,
      };
    }
    const completed = new Set(completedActivityIdsSnapshot);
    for (const [activityIndex, candidate] of currentActivities.entries()) {
      const done = completed.has(activityCompletedKey(currentNode.id, candidate.id));
      if (activityIndex < index && !done) return null;
      if (activityIndex >= index && done) return null;
    }
  }
  if (currentActivities.length > 0 && !currentNodeCompleted && activeActivity === null) return null;
  if (currentNodeCompleted && activeActivity !== null) return null;
  if (currentNodeCompleted) {
    const completed = new Set(completedActivityIdsSnapshot);
    if (!currentActivities.every(activity => completed.has(activityCompletedKey(currentNode.id, activity.id)))) return null;
  }

  const requiresEncounter = currentActivities.length > 0
    ? activeActivityRequiresEncounter
    : currentNode.encounter !== undefined && !currentNodeCompleted;
  const activeEncounter = value.activeEncounter === null
    ? null
    : restoreEncounterSnapshot(
      value.activeEncounter,
      definition,
      currentNode.id,
      value.party,
      partyHp,
      actorResources,
      teamResources,
      value.playerCost as number,
      commitVersionSnapshot as number,
      value.runId as string,
      activeActivity?.activityId,
    );
  if (value.activeEncounter !== null && activeEncounter === null) return null;
  if (requiresEncounter !== (activeEncounter !== null)) return null;
  if (activeEncounter && (!contentNodeIds.has(activeEncounter.nodeId)
    || activeEncounter.nodeId !== currentNode.id
    || completedEncounterNodeIds.includes(activeEncounter.nodeId))) return null;
  if (activeEncounter?.lastCommit) {
    if (!lastEncounterCommit
      || JSON.stringify(activeEncounter.lastCommit) !== JSON.stringify(lastEncounterCommit)) return null;
  }
  if (lastEncounterCommit && activeEncounter
    && lastEncounterCommit.nodeId === activeEncounter.nodeId
    && lastEncounterCommit.activityId === activeEncounter.activityId
    && activeEncounter.round > 1 && !activeEncounter.lastCommit) return null;
  if (hasInvalidActiveEncounterNodeAlias(value, activeEncounter?.nodeId ?? null)) return null;
  if (definition.exitNodeIds.includes(currentNode.id) && activeEncounter === null && activeActivity === null) return null;

  return {
    runId: value.runId,
    mapId,
    party: projectPartySnapshot(value.party),
    partyHp,
    lastEncounterCommit,
    playerCost: value.playerCost as number,
    commitVersion: commitVersionSnapshot as number,
    actorResources,
    teamResources,
    status: 'inProgress',
    currentNodeId,
    visitedNodeIds: [...visitedNodeIds],
    completedEncounterNodeIds: [...completedEncounterNodeIds],
    completedActivityIds: [...completedActivityIdsSnapshot],
    activeActivity,
    activeEncounter,
  };
}

export class MapRunError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'MapRunError';
  }
}

/** Owns at most one active MapRun and never writes Persistent PlayerState. */
export class MapRunService {
  private slot: MapRunSlot | null = null;
  private result: MapRunSuccessResult | null = null;
  private failureResult: MapRunFailureResult | null = null;
  private terminalCommitReplay: TerminalMapRunCommitReplay | null = null;
  private readonly preparedEncounterCommits = new WeakMap<object, PreparedMapRunEncounterCommitState>();

  constructor(
    private readonly resolver: MapContentResolver,
    private readonly resolveCharacterIdForVariant?: ResolveCharacterIdForVariant,
  ) {}

  start(mapId: string, admittedParty: readonly MapRunPartyMember[]): MapRun {
    if (this.slot?.run.status === 'inProgress') {
      throw new MapRunError(['a MapRun is already in progress']);
    }
    const definition = this.resolver.resolve(mapId);
    if (!definition) throw new MapRunError([`unknown Map ID "${mapId}"`]);
    if (!Number.isSafeInteger(definition.resumeVersion) || definition.resumeVersion < 1) {
      throw new MapRunError([`Map "${mapId}" has an invalid resumeVersion; a MapRun cannot be started`]);
    }
    if (!Number.isSafeInteger(definition.initialPlayerCost) || definition.initialPlayerCost < 0) {
      throw new MapRunError([`Map "${mapId}" has an invalid initialPlayerCost; a MapRun cannot be started`]);
    }
    if (!isPartySnapshot(admittedParty, definition.partyCharacterIds, this.resolveCharacterIdForVariant)) {
      throw new MapRunError([`Map "${mapId}" did not receive a complete admitted party snapshot`]);
    }

    const startNode = definition.nodes.find(node => node.id === definition.startNodeId);
    if (!startNode) throw new MapRunError([`Map "${mapId}" has no start Node "${definition.startNodeId}"`]);

    const party = projectPartySnapshot(admittedParty);
    const partyHp = initialPartyHp(definition, party);
    const resources = initialResourceBalances(definition, party);
    const runId = `map-run-${++nextMapRunSequence}`;
    const entered = openNodeContent(
      definition,
      startNode,
      party,
      resources.actorResources,
      resources.teamResources,
      partyHp,
      [],
    );
    const run: MutableMapRun = {
      runId,
      mapId,
      party,
      partyHp,
      lastEncounterCommit: null,
      playerCost: definition.initialPlayerCost,
      commitVersion: 0,
      actorResources: resources.actorResources,
      teamResources: resources.teamResources,
      status: 'inProgress',
      currentNodeId: startNode.id,
      visitedNodeIds: [startNode.id],
      completedEncounterNodeIds: [],
      completedActivityIds: [],
      activeActivity: entered.activeActivity,
      activeEncounter: entered.activeEncounter,
    };
    if (!run.activeEncounter && !run.activeActivity && definition.exitNodeIds.includes(startNode.id)) {
      run.status = 'success';
    }

    if (run.status === 'success') {
      this.failureResult = null;
      this.terminalCommitReplay = null;
      return this.finishSuccess(definition, run);
    }
    this.result = null;
    this.failureResult = null;
    this.terminalCommitReplay = null;
    this.slot = { definition, run };
    return snapshotOf(run);
  }

  getSnapshot(expectedRunId?: string): MapRun | null {
    const run = this.slot?.run;
    if (!run || (expectedRunId !== undefined && expectedRunId !== run.runId)) return null;
    return snapshotOf(run);
  }

  /** Enumerates current domain cards, never visual copies or unselected command offers. */
  getCards(expectedRunId?: string): readonly MapRunCardInstance[] {
    const slot = this.slot;
    if (!slot || !slot.run.activeEncounter || (expectedRunId !== undefined && expectedRunId !== slot.run.runId)) return Object.freeze([]);
    return catalogMapRunCards(snapshotOf(slot.run), this.resolveActionPreview(slot));
  }

  /** A stale scene / round / removed command card is not a current domain object. */
  resolveCardReference(ref: MapRunCardRef): MapRunCardInstance | null {
    const parsed = parseMapRunCardRef(ref);
    if (!parsed) return null;
    const key = mapRunCardKey(parsed);
    return this.getCards(parsed.scope.runId).find(card => mapRunCardKey(card.ref) === key) ?? null;
  }

  /** Returns a detached success-only summary for the matching completed Run. */
  getResult(expectedRunId: string): MapRunSuccessResult | null {
    if (!this.result || this.result.runId !== expectedRunId) return null;
    return Object.freeze({ ...this.result });
  }

  /** Returns the runtime-only failure summary for the most recent failed Run. */
  getFailureResult(expectedRunId: string): MapRunFailureResult | null {
    if (!this.failureResult || this.failureResult.runId !== expectedRunId) return null;
    return Object.freeze({ ...this.failureResult });
  }

  /** Returns a detached Prepared Action / Target preview without mutating the Run. */
  previewActions(expectedRunId?: string): GameplayBActionPreview | null {
    const slot = this.slot;
    if (!slot || (expectedRunId !== undefined && expectedRunId !== slot.run.runId)
      || slot.run.activeEncounter === null) return null;
    return this.resolveActionPreview(slot);
  }

  /** Validates a hypothetical replacement without installing it or consuming randomness. */
  previewActionReplacement(runId: string, characterId: string, actionId: string, draft: MapRunEncounterDraftToken): GameplayBActionPreview {
    const slot = this.requireEncounterDraft(runId, draft);
    const encounter = slot.run.activeEncounter!;
    const current = this.resolveActionPreview(slot);
    const prepared = current.preparedActions.find(row => row.characterId === characterId);
    if (!prepared || prepared.preparedActionId === null) throw new MapRunError(['Replacement source is not an active Character']);
    if (actionId === prepared.preparedActionId) throw new MapRunError(['Replacement must choose a different prepared Action']);
    const inHand = prepared.handActionIds.includes(actionId);
    if (!inHand) {
      const option = current.playerCommandOptions.find(row => row.characterId === characterId && row.actionId === actionId);
      if (!option || !option.canPayPlayerCost || !option.canPayActionCosts) throw new MapRunError(['Replacement is not a payable PlayerCommand candidate']);
    }
    const overrides = encounter.overrides.filter(row => row.characterId !== characterId);
    if (actionId !== prepared.naturalActionId) overrides.push({ kind: inHand ? 'swap' : 'playerCommand', characterId, actionId });
    const order = new Map(slot.run.party.map((member, index) => [member.characterId, index]));
    overrides.sort((left, right) => order.get(left.characterId)! - order.get(right.characterId)!);
    return this.resolveActionPreview(slot, this.pruneRemovedCardTargets(slot, {
      ...encounter, overrides,
      targetSelections: encounter.targetSelections.filter(row => row.characterId !== characterId),
    }));
  }

  /** Reports full-round affordability from the same pure settlement plan as Commit. */
  previewEncounterCommit(expectedRunId?: string): MapRunEncounterCommitPreview | null {
    const slot = this.slot;
    const encounter = slot?.run.activeEncounter;
    if (!slot || !encounter || (expectedRunId !== undefined && expectedRunId !== slot.run.runId)) return null;
    const identity = {
      nodeId: encounter.nodeId,
      ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
      round: encounter.round,
      draftVersion: encounter.draftVersion,
    };
    try {
      if (!Number.isSafeInteger(slot.run.commitVersion) || slot.run.commitVersion >= Number.MAX_SAFE_INTEGER) {
        throw new MapRunError(['the MapRun Commit version is exhausted']);
      }
      const plan = resolveEncounterCommitPlan(slot);
      return Object.freeze({
        ...identity,
        canCommit: true,
        playerCostRequired: plan.playerCostRequired,
        diagnostics: Object.freeze([]),
        settlements: freezeCommitSettlements(plan.settlements),
      });
    } catch (error) {
      const diagnostics = error instanceof MapRunError
        ? error.diagnostics
        : [error instanceof Error ? error.message : String(error)];
      return Object.freeze({
        ...identity,
        canCommit: false,
        playerCostRequired: null,
        diagnostics: Object.freeze([...diagnostics]),
        settlements: null,
      });
    }
  }

  /** Atomically settles a full fixed-party round, advances Hand/RNG, and records a retry receipt. */
  commitEncounterRound(command: MapRunEncounterCommitCommand): MapRun {
    const prepared = this.prepareEncounterRoundCommit(command);
    if (prepared.itemId !== null) {
      throw new MapRunError(['an Item Encounter Commit requires the GameInstance cross-owner coordinator']);
    }
    if (!this.canInstallPreparedEncounterCommit(prepared)) {
      throw new MapRunError(['the prepared Encounter Commit is stale']);
    }
    this.installPreparedEncounterCommit(prepared);
    return prepared.snapshot;
  }

  /** Builds a detached full-round plan without changing any MapRun-owned state. */
  prepareEncounterRoundCommit(command: MapRunEncounterCommitCommand): PreparedMapRunEncounterCommit {
    if (!isRecord(command)
      || Object.keys(command).length !== 4
      || Object.keys(command).some(key => !['runId', 'requestId', 'expectedCommitVersion', 'draft'].includes(key))
      || !isNonEmptyId(command.runId)
      || !isNonEmptyId(command.requestId)
      || !Number.isSafeInteger(command.expectedCommitVersion) || (command.expectedCommitVersion as number) < 0
      || !isRecord(command.draft)
      || Object.keys(command.draft).length !== (command.draft.activityId === undefined ? 3 : 4)
      || Object.keys(command.draft).some(key => !['nodeId', 'activityId', 'round', 'draftVersion'].includes(key))
      || !isNonEmptyId(command.draft.nodeId)
      || (command.draft.activityId !== undefined && !isNonEmptyId(command.draft.activityId))
      || !Number.isSafeInteger(command.draft.round) || (command.draft.round as number) < 1
      || !Number.isSafeInteger(command.draft.draftVersion) || (command.draft.draftVersion as number) < 0) {
      throw new MapRunError(['the Encounter Commit request is malformed']);
    }
    const terminalReplay = this.terminalCommitReplay;
    if (terminalReplay?.command.requestId === command.requestId) {
      if (!sameCommitRequest(terminalReplay.command, command)) {
        throw new MapRunError(['the Encounter Commit request ID was already used with different input']);
      }
      return this.makePreparedEncounterCommit({
        snapshot: terminalReplay.snapshot,
        itemId: null,
        baseSlot: this.slot,
        nextSlot: this.slot,
        result: this.result,
        failureResult: this.failureResult,
        terminalCommitReplay: this.terminalCommitReplay,
        replayed: true,
      });
    }
    const slot = this.requireActiveRun(command.runId);
    const encounter = slot.run.activeEncounter;
    const previousReceipt = slot.run.lastEncounterCommit;
    if (previousReceipt?.requestId === command.requestId) {
      if (command.expectedCommitVersion !== previousReceipt.commandVersion
        || !isRecord(command.draft)
        || command.draft.nodeId !== previousReceipt.nodeId
        || (command.draft.activityId ?? null) !== (previousReceipt.activityId ?? null)
        || command.draft.round !== previousReceipt.round
        || command.draft.draftVersion !== previousReceipt.draftVersion) {
        throw new MapRunError(['the Encounter Commit request ID was already used with different input']);
      }
      return this.makePreparedEncounterCommit({
        snapshot: snapshotOf(slot.run),
        itemId: null,
        baseSlot: slot,
        nextSlot: slot,
        result: this.result,
        failureResult: this.failureResult,
        terminalCommitReplay: this.terminalCommitReplay,
        replayed: true,
      });
    }
    if (!Number.isSafeInteger(slot.run.commitVersion) || slot.run.commitVersion >= Number.MAX_SAFE_INTEGER) {
      throw new MapRunError(['the MapRun Commit version is exhausted']);
    }
    if (command.expectedCommitVersion !== slot.run.commitVersion) {
      throw new MapRunError(['the MapRun Commit version is stale']);
    }
    const currentSlot = this.requireEncounterDraft(command.runId, command.draft);
    const currentEncounter = currentSlot.run.activeEncounter!;
    const plan = resolveEncounterCommitPlan(currentSlot);
    const nextPlayerCost = currentSlot.run.playerCost - plan.playerCostRequired;

    const commitVersion = currentSlot.run.commitVersion + 1;
    if (!Number.isSafeInteger(commitVersion)) throw new MapRunError(['the MapRun Commit version is exhausted']);
    const nextActorResources = currentSlot.run.actorResources.map(balance => ({
      ...balance,
      value: plan.actorBalancesAfter.get(actorResourceKey(balance.characterId, balance.resourceId)) ?? balance.value,
    }));
    const nextTeamResources = currentSlot.run.teamResources.map(balance => ({
      ...balance,
      value: plan.teamBalancesAfter.get(balance.resourceId) ?? balance.value,
    }));
    const commitNode = currentSlot.definition.nodes.find(candidate => candidate.id === currentEncounter.nodeId);
    const commitEncounterDef = resolveNodeEncounter(commitNode, currentEncounter.activityId);
    if (!commitEncounterDef) {
      throw new MapRunError([`Encounter "${currentEncounter.nodeId}" is not declared by the current Map`]);
    }
    const receipt: MapRunEncounterCommitReceipt = {
      requestId: command.requestId,
      commandVersion: command.expectedCommitVersion,
      resultingCommitVersion: commitVersion,
      nodeId: currentEncounter.nodeId,
      ...(currentEncounter.activityId === undefined ? {} : { activityId: currentEncounter.activityId }),
      round: currentEncounter.round,
      draftVersion: currentEncounter.draftVersion,
      settlements: plan.settlements,
      ...(plan.ability === null ? {} : { ability: plan.ability }),
      ...(plan.item === null ? {} : { item: plan.item }),
      ...(plan.enemyAttacks.length > 0 ? { enemyAttacks: plan.enemyAttacks } : {}),
    };
    const nextPartyHp = currentSlot.run.party.map(member => ({
      characterId: member.characterId,
      currentHp: plan.partyHpAfter.get(member.characterId) ?? 0,
    }));
    const nextEnemyHp = currentEncounter.enemies.map(enemy => ({
      enemyId: enemy.enemyId,
      currentHp: plan.enemyHpAfter.get(enemy.enemyId) ?? enemy.currentHp,
    }));
    const baseRun: MutableMapRun = {
      ...currentSlot.run,
      playerCost: nextPlayerCost,
      commitVersion,
      partyHp: nextPartyHp,
      lastEncounterCommit: receipt,
      actorResources: nextActorResources,
      teamResources: nextTeamResources,
    };
    let nextRun: MutableMapRun;
    let successAtExit = false;
    if (plan.terminal === 'failure') {
      nextRun = { ...baseRun, activeEncounter: null, activeActivity: null, status: 'failure' };
    } else if (plan.terminal === 'victory') {
      const advanced = advanceCompletedActivity(
        currentSlot.definition,
        baseRun,
        currentEncounter.nodeId,
        currentEncounter.activityId,
      );
      successAtExit = advanced.success;
      nextRun = { ...advanced.run, status: advanced.success ? 'success' : 'inProgress' };
    } else {
      const drawnEncounter = createEncounterSnapshot(
        currentSlot.definition,
        currentEncounter.nodeId,
        commitEncounterDef,
        currentSlot.run.party,
        nextActorResources,
        nextTeamResources,
        nextPartyHp,
        currentEncounter.round + 1,
        currentEncounter.randomState,
        nextEnemyHp,
        currentEncounter.activityId,
      );
      nextRun = { ...baseRun, activeEncounter: { ...drawnEncounter, lastCommit: receipt } };
    }
    const snapshot = snapshotOf(nextRun);
    let nextSlot: MapRunSlot | null = { ...currentSlot, run: nextRun };
    let nextResult: MapRunSuccessResult | null = null;
    let nextFailureResult: MapRunFailureResult | null = null;
    let nextTerminalCommitReplay = this.terminalCommitReplay;
    if (plan.terminal === 'failure') {
      nextFailureResult = Object.freeze({
        runId: nextRun.runId,
        mapId: nextRun.mapId,
        outcome: 'failure',
        failedNodeId: currentEncounter.nodeId,
        reason: 'partyDefeated',
      });
      nextSlot = null;
      nextTerminalCommitReplay = { command: { ...command, draft: { ...command.draft } }, snapshot };
    }
    if (successAtExit) {
      nextResult = this.successResultFor(slot.definition, nextRun);
      nextSlot = null;
      nextTerminalCommitReplay = { command: { ...command, draft: { ...command.draft } }, snapshot };
    }
    return this.makePreparedEncounterCommit({
      snapshot,
      itemId: plan.item?.itemId ?? null,
      baseSlot: currentSlot,
      nextSlot,
      result: nextResult,
      failureResult: nextFailureResult,
      terminalCommitReplay: nextTerminalCommitReplay,
      replayed: false,
    });
  }

  /** Pure installability preflight for a previously prepared Commit. */
  canInstallPreparedEncounterCommit(prepared: PreparedMapRunEncounterCommit): boolean {
    const state = this.preparedEncounterCommits.get(prepared as object);
    return !!state && !state.installed && this.slot === state.baseSlot;
  }

  /** Installs a precomputed MapRun state with no parsing, planning, events, or callbacks. */
  installPreparedEncounterCommit(prepared: PreparedMapRunEncounterCommit): void {
    const state = this.preparedEncounterCommits.get(prepared as object)!;
    if (state.installed) return;
    if (state.replayed) {
      state.installed = true;
      return;
    }
    this.slot = state.nextSlot;
    this.result = state.result;
    this.failureResult = state.failureResult;
    this.terminalCommitReplay = state.terminalCommitReplay;
    state.installed = true;
  }

  private makePreparedEncounterCommit(input: Omit<PreparedMapRunEncounterCommitState, 'installed'>): PreparedMapRunEncounterCommit {
    const token = Object.freeze({ snapshot: input.snapshot, replayed: input.replayed, itemId: input.itemId });
    this.preparedEncounterCommits.set(token, { ...input, installed: false });
    return token;
  }

  /** Replaces one character's natural Hand-first Prepared Action with a free Hand item. */
  swapPreparedAction(
    runId: string,
    characterId: string,
    actionId: string,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.setActionOverride(runId, characterId, actionId, 'swap', expectedDraft);
  }

  /** Drafts a Hand-out Encounter candidate for exactly 1 PlayerCost at Commit. */
  issuePlayerCommand(
    runId: string,
    characterId: string,
    actionId: string,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    return this.setActionOverride(runId, characterId, actionId, 'playerCommand', expectedDraft);
  }

  /** Drafts or clears one explicitly exposed Ability and its Encounter-local target. */
  setAbilityDraft(
    runId: string,
    actionId: string | null,
    target: MapRunEncounterSourceTarget | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    let abilityDraft: MapRunEncounterAbilityDraft | null = null;
    if (actionId === null) {
      if (target !== null) throw new MapRunError(['a cleared Ability draft cannot retain a target']);
    } else {
      const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
      const exposed = resolveNodeEncounter(node, encounter.activityId)?.abilityActionIds ?? [];
      if (!exposed.includes(actionId)) throw new MapRunError([`Ability Action "${actionId}" is not exposed by this Encounter`]);
      const action = actorlessSourceAction(slot, actionId, 'Ability');
      if (target !== null) validateSourceTarget(target, action, slot, 'Ability');
      abilityDraft = { actionId, target: target === null ? null : { ...target } };
    }
    const current = encounter.abilityDraft ?? null;
    if (JSON.stringify(current) === JSON.stringify(abilityDraft)) return snapshotOf(slot.run);
    const { abilityDraft: _oldAbilityDraft, ...withoutAbilityDraft } = encounter;
    const nextEncounter = this.withDraftVersion({
      ...withoutAbilityDraft,
      ...(abilityDraft === null ? {} : { abilityDraft }),
    });
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Drafts or clears one Encounter-mapped Item and its Encounter-local target. */
  setItemDraft(
    runId: string,
    itemId: string | null,
    target: MapRunEncounterSourceTarget | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    let itemDraft: MapRunEncounterItemDraft | null = null;
    if (itemId === null) {
      if (target !== null) throw new MapRunError(['a cleared Item draft cannot retain a target']);
    } else {
      const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
      const mappings = resolveNodeEncounter(node, encounter.activityId)?.itemActions ?? [];
      const mapping = mappings.find(candidate => candidate.itemId === itemId);
      if (!mapping) throw new MapRunError([`Item "${itemId}" is not mapped by this Encounter`]);
      const action = actorlessSourceAction(slot, mapping.actionId, 'Item');
      if (target !== null) validateSourceTarget(target, action, slot, 'Item');
      itemDraft = { itemId, actionId: mapping.actionId, target: target === null ? null : { ...target } };
    }
    const current = encounter.itemDraft ?? null;
    if (JSON.stringify(current) === JSON.stringify(itemDraft)) return snapshotOf(slot.run);
    const { itemDraft: _oldItemDraft, ...withoutItemDraft } = encounter;
    const nextEncounter = this.withDraftVersion({
      ...withoutItemDraft,
      ...(itemDraft === null ? {} : { itemDraft }),
    });
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Sets or clears one target choice without changing costs, Hand, round, or RNG. */
  setPreparedTarget(
    runId: string,
    characterId: string,
    targetCharacterId: string | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const preview = this.resolveActionPreview(slot);
    const prepared = preview.preparedActions.find(row => row.characterId === characterId);
    if (!prepared) throw new MapRunError([`Character "${characterId}" is not in the fixed party`]);
    if (targetCharacterId !== null && !prepared.legalTargetCharacterIds.includes(targetCharacterId)) {
      throw new MapRunError([`Target "${targetCharacterId}" is not legal for the Prepared Action of "${characterId}"`]);
    }

    const currentSelection = encounter.targetSelections.find(row => row.characterId === characterId);
    const needsStoredSelection = targetCharacterId !== null
      && prepared.targetKind === 'partyCharacter'
      && prepared.legalTargetCharacterIds.length > 1;
    const nextTargetSelections = encounter.targetSelections
      .filter(row => row.characterId !== characterId);
    if (needsStoredSelection) nextTargetSelections.push({ characterId, targetCharacterId: targetCharacterId! });
    nextTargetSelections.sort((left, right) =>
      slot.run.party.findIndex(member => member.characterId === left.characterId)
      - slot.run.party.findIndex(member => member.characterId === right.characterId),
    );

    const unchanged = currentSelection?.targetCharacterId === targetCharacterId
      || (currentSelection === undefined && !needsStoredSelection
        && (targetCharacterId === null || targetCharacterId === prepared.targetCharacterId));
    if (unchanged) return snapshotOf(slot.run);

    const nextEncounter = this.withDraftVersion({
      ...encounter,
      targetSelections: nextTargetSelections,
    });
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Sets or clears an Enemy target without exposing a GameCommands/UI command yet. */
  setPreparedEnemyTarget(
    runId: string,
    characterId: string,
    targetEnemyId: string | null,
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const prepared = this.resolveActionPreview(slot).preparedActions.find(row => row.characterId === characterId);
    if (!prepared) throw new MapRunError([`Character "${characterId}" is not in the fixed party`]);
    const legalEnemyIds = prepared.legalTargetEnemyIds ?? [];
    if (prepared.targetKind !== 'enemy') throw new MapRunError([`Prepared Action for "${characterId}" does not target an Enemy`]);
    if (targetEnemyId !== null && !legalEnemyIds.includes(targetEnemyId)) {
      throw new MapRunError([`Enemy target "${targetEnemyId}" is not legal for the Prepared Action of "${characterId}"`]);
    }
    const currentSelection = encounter.targetSelections.find(row => row.characterId === characterId);
    const needsStoredSelection = targetEnemyId !== null && legalEnemyIds.length > 1;
    const nextTargetSelections = encounter.targetSelections.filter(row => row.characterId !== characterId);
    if (needsStoredSelection) nextTargetSelections.push({ characterId, targetEnemyId: targetEnemyId! });
    nextTargetSelections.sort((left, right) =>
      slot.run.party.findIndex(member => member.characterId === left.characterId)
      - slot.run.party.findIndex(member => member.characterId === right.characterId),
    );
    const unchanged = currentSelection?.targetEnemyId === targetEnemyId
      || (currentSelection === undefined && !needsStoredSelection
        && (targetEnemyId === null || targetEnemyId === prepared.targetEnemyId));
    if (unchanged) return snapshotOf(slot.run);

    const nextEncounter = this.withDraftVersion({ ...encounter, targetSelections: nextTargetSelections });
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Confirms one real card target through the same optimistic draft boundary as unit targets. */
  setPreparedCardTarget(runId: string, characterId: string, target: MapRunCardRef | null,
    expectedDraft: MapRunEncounterDraftToken): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const prepared = this.resolveActionPreview(slot).preparedActions.find(row => row.characterId === characterId);
    if (!prepared || prepared.targetKind !== 'card') throw new MapRunError(['Prepared Action does not accept a card target']);
    const parsed = target === null ? null : parseMapRunCardRef(target);
    const candidates = prepared.legalTargetCards ?? [];
    if (target !== null && (!parsed || !candidates.some(ref => mapRunCardKey(ref) === mapRunCardKey(parsed)))) {
      throw new MapRunError(['Card target is not a current legal candidate']);
    }
    const stored = encounter.targetSelections.find(row => row.characterId === characterId)?.targetCard;
    const needsSelection = parsed !== null && candidates.length > 1;
    if ((!stored && !needsSelection) || (stored && parsed && mapRunCardKey(stored) === mapRunCardKey(parsed))) return snapshotOf(slot.run);
    const selections = encounter.targetSelections.filter(row => row.characterId !== characterId);
    if (needsSelection) selections.push({ characterId, targetCard: parsed });
    selections.sort((a, b) => slot.run.party.findIndex(row => row.characterId === a.characterId)
      - slot.run.party.findIndex(row => row.characterId === b.characterId));
    const nextEncounter = this.withDraftVersion({ ...encounter, targetSelections: selections });
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Drops incoming references only when the domain card is gone, not when its DOM disappears. */
  private pruneRemovedCardTargets(slot: MapRunSlot, encounter: MapRunEncounterSnapshot): MapRunEncounterSnapshot {
    if (!encounter.targetSelections.some(row => row.targetCard)) return encounter;
    const withoutCardChoices = { ...encounter, targetSelections: encounter.targetSelections.filter(row => !row.targetCard) };
    const preview = this.resolveActionPreview(slot, withoutCardChoices);
    const cards = catalogMapRunCards({ ...slot.run, activeEncounter: encounter }, preview);
    const live = new Set(cards.map(card => mapRunCardKey(card.ref)));
    return { ...encounter, targetSelections: encounter.targetSelections.filter(row => !row.targetCard || live.has(mapRunCardKey(row.targetCard))) };
  }

  /** Clears one Character's Swap / PlayerCommand override and restores Hand-first preparation. */
  clearActionOverride(runId: string, characterId: string, expectedDraft: MapRunEncounterDraftToken): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    return this.clearActionOverrideForSlot(slot, characterId);
  }

  private clearActionOverrideForSlot(slot: MapRunSlot, characterId: string): MapRun {
    const encounter = slot.run.activeEncounter!;
    if (!encounter.overrides.some(override => override.characterId === characterId)) return snapshotOf(slot.run);

    const nextEncounter = this.pruneRemovedCardTargets(slot, this.withDraftVersion({
      ...encounter,
      overrides: encounter.overrides.filter(override => override.characterId !== characterId),
      targetSelections: encounter.targetSelections.filter(selection => selection.characterId !== characterId),
    }));
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  private setActionOverride(
    runId: string,
    characterId: string,
    actionId: string,
    kind: MapRunActionOverride['kind'],
    expectedDraft: MapRunEncounterDraftToken,
  ): MapRun {
    const slot = this.requireEncounterDraft(runId, expectedDraft);
    const encounter = slot.run.activeEncounter!;
    const preview = this.resolveActionPreview(slot);
    const prepared = preview.preparedActions.find(row => row.characterId === characterId);
    if (!prepared) throw new MapRunError([`Character "${characterId}" is not in the fixed party`]);

    if (kind === 'swap') {
      // Selecting the natural Action is observationally identical to having no override at all.
      if (actionId === prepared.naturalActionId) return this.clearActionOverrideForSlot(slot, characterId);
      if (!prepared.handActionIds.includes(actionId)) {
        throw new MapRunError(['Swap must choose another Action in the same Character Hand']);
      }
    } else {
      const option = preview.playerCommandOptions.find(row =>
        row.characterId === characterId && row.actionId === actionId,
      );
      if (!option) throw new MapRunError(['PlayerCommand must choose an Encounter candidate outside the current Hand']);
      if (!option.canPayPlayerCost) throw new MapRunError(['PlayerCommand requires 1 PlayerCost']);
      if (!option.canPayActionCosts) throw new MapRunError(['PlayerCommand Action resource costs are not payable']);
    }

    const existing = encounter.overrides.find(override => override.characterId === characterId);
    if (existing?.kind === kind && existing.actionId === actionId) return snapshotOf(slot.run);

    const partyOrder = new Map(slot.run.party.map((member, index) => [member.characterId, index]));
    const overrides = [
      ...encounter.overrides.filter(override => override.characterId !== characterId),
      { kind, characterId, actionId },
    ].sort((left, right) =>
      (partyOrder.get(left.characterId) ?? 0) - (partyOrder.get(right.characterId) ?? 0));

    const nextEncounter = this.pruneRemovedCardTargets(slot, this.withDraftVersion({
      ...encounter,
      overrides,
      targetSelections: encounter.targetSelections.filter(selection => selection.characterId !== characterId),
    }));
    this.resolveActionPreview(slot, nextEncounter);
    const nextRun: MutableMapRun = { ...slot.run, activeEncounter: nextEncounter };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  private resolveActionPreview(
    slot: MapRunSlot,
    encounter: MapRunEncounterSnapshot = slot.run.activeEncounter!,
  ): GameplayBActionPreview {
    try {
      return resolveGameplayBActionPreview({
        runId: slot.run.runId,
        definition: slot.definition,
        encounter,
        party: slot.run.party,
      partyHp: slot.run.partyHp,
        playerCost: slot.run.playerCost,
        actorResources: slot.run.actorResources,
        teamResources: slot.run.teamResources,
      });
    } catch (error) {
      throw new MapRunError(error instanceof Error ? [error.message] : [String(error)]);
    }
  }

  private requireEncounterDraft(runId: string, expectedDraft: MapRunEncounterDraftToken): MapRunSlot {
    const slot = this.requireActiveRun(runId);
    const encounter = slot.run.activeEncounter;
    if (encounter === null) throw new MapRunError(['there is no active Encounter to prepare']);
    if (!isRecord(expectedDraft)
      || expectedDraft.nodeId !== encounter.nodeId
      || (expectedDraft.activityId ?? null) !== (encounter.activityId ?? null)
      || expectedDraft.round !== encounter.round
      || !Number.isSafeInteger(expectedDraft.draftVersion)
      || expectedDraft.draftVersion !== encounter.draftVersion) {
      throw new MapRunError(['the Encounter action draft is stale']);
    }
    return slot;
  }

  private withDraftVersion(encounter: MapRunEncounterSnapshot): MapRunEncounterSnapshot {
    if (!Number.isSafeInteger(encounter.draftVersion) || encounter.draftVersion >= Number.MAX_SAFE_INTEGER) {
      throw new MapRunError(['the Encounter action draft version is exhausted']);
    }
    return { ...encounter, draftVersion: encounter.draftVersion + 1 };
  }

  private finishSuccess(definition: ResolvedMap, run: MutableMapRun): MapRun {
    this.result = this.successResultFor(definition, run);
    this.slot = null;
    return snapshotOf(run);
  }

  private successResultFor(definition: ResolvedMap, run: MutableMapRun): MapRunSuccessResult {
    const exitNode = definition.nodes.find(node => node.id === run.currentNodeId);
    if (!exitNode || !definition.exitNodeIds.includes(exitNode.id)) {
      throw new MapRunError(['a successful MapRun must finish on a declared exit Node']);
    }
    return Object.freeze({
      runId: run.runId,
      mapId: run.mapId,
      outcome: 'success',
      exitNodeId: exitNode.id,
      mapName: definition.name,
      exitNodeTitle: exitNode.title,
    });
  }

  /** Creates a detached checkpoint without changing the active Run. */
  createSaveSnapshot(): MapRunSaveSnapshot | null {
    const slot = this.slot;
    const resumeVersion = slot?.definition.resumeVersion;
    if (!slot || slot.run.status !== 'inProgress') return null;
    if (!Number.isSafeInteger(resumeVersion) || resumeVersion! < 1) {
      throw new MapRunError(['the active Map has an invalid resumeVersion and cannot be checkpointed']);
    }
    return Object.freeze({
      mapId: slot.run.mapId,
      resumeVersion: resumeVersion!,
      run: snapshotOf(slot.run),
    });
  }

  /** Validates current Map content, then installs the saved private slot without replaying commands. */
  restoreSaveSnapshot(value: unknown): MapRunRestoreResult {
    if (value === null || value === undefined) return { status: 'none' };
    const candidateMapId = isRecord(value) && isNonEmptyId(value.mapId) ? value.mapId : null;
    if (!isRecord(value) || candidateMapId === null
      || !Number.isSafeInteger(value.resumeVersion) || (value.resumeVersion as number) < 1
      || !isRecord(value.run)) {
      return rejectRestore(candidateMapId, 'invalid-snapshot', 'MapRun checkpoint has an invalid header or run state');
    }
    if (this.slot) {
      return rejectRestore(candidateMapId, 'owner-not-empty', 'clear the current MapRun before restoring a checkpoint');
    }
    if (!this.resolveCharacterIdForVariant) {
      return rejectRestore(candidateMapId, 'invalid-run', 'MapRun checkpoint cannot be verified without a Registry Variant lookup');
    }

    let definition: ResolvedMap | null;
    try {
      definition = this.resolver.resolve(candidateMapId);
    } catch (error) {
      return rejectRestore(candidateMapId, 'invalid-content', 'Map content could not be resolved: '
        + (error instanceof Error ? error.message : String(error)));
    }
    if (!definition) {
      return rejectRestore(candidateMapId, 'unknown-map', 'Map is not available in the current Registry: ' + candidateMapId);
    }
    if (definition.id !== candidateMapId || !Number.isSafeInteger(definition.resumeVersion) || definition.resumeVersion < 1) {
      return rejectRestore(candidateMapId, 'invalid-content', 'resolved Map content has an invalid identity or resumeVersion');
    }
    if (definition.resumeVersion !== value.resumeVersion) {
      return rejectRestore(candidateMapId, 'content-version-mismatch', 'Map resumeVersion changed from '
        + String(value.resumeVersion) + ' to ' + String(definition.resumeVersion));
    }

    let run: MutableMapRun | null;
    try {
      run = restoreRunState(value.run, definition, candidateMapId, this.resolveCharacterIdForVariant);
    } catch {
      run = null;
    }
    if (!run) {
      return rejectRestore(candidateMapId, 'invalid-run', 'MapRun checkpoint state does not match the current Map');
    }
    advanceRunSequence(run.runId);
    if (run.partyHp.every(row => row.currentHp === 0)) {
      this.result = null;
      this.failureResult = Object.freeze({
        runId: run.runId,
        mapId: run.mapId,
        outcome: 'failure',
        failedNodeId: run.currentNodeId,
        reason: 'partyDefeated',
      });
      this.terminalCommitReplay = null;
      return { status: 'failed', mapId: candidateMapId, runId: run.runId, reason: 'partyDefeated' };
    }
    this.slot = { definition, run };
    this.result = null;
    this.failureResult = null;
    this.terminalCommitReplay = null;
    return { status: 'restored', mapId: candidateMapId, runId: run.runId };
  }

  move(runId: string, targetNodeId: string): MapRun {
    const slot = this.requireActiveRun(runId);
    const { run } = slot;
    if (run.activeEncounter !== null) {
      throw new MapRunError(['Map movement is unavailable while an Encounter is active']);
    }
    if (run.activeActivity !== null) {
      throw new MapRunError(['Map movement is unavailable while a Node activity is in progress']);
    }
    const node = slot.definition.nodes.find(candidate => candidate.id === targetNodeId);
    if (!node) throw new MapRunError([`unknown target Node "${targetNodeId}"`]);
    const edge = slot.definition.edges.find(candidate =>
      candidate.fromNodeId === run.currentNodeId && candidate.toNodeId === targetNodeId,
    );
    if (!edge) {
      throw new MapRunError([`Node "${targetNodeId}" is not reachable from current Node "${run.currentNodeId}"`]);
    }
    if (edge.condition !== undefined && !edgeConditionSatisfied(edge.condition, run)) {
      throw new MapRunError([`Edge to Node "${targetNodeId}" requires an unsatisfied MapRun condition`]);
    }

    const alreadyVisited = run.visitedNodeIds.includes(targetNodeId);
    const alreadyCompleted = run.completedEncounterNodeIds.includes(targetNodeId);
    const entered: EnteredNodeState = alreadyCompleted
      ? { activeActivity: null, activeEncounter: null }
      : openNodeContent(
        slot.definition,
        node,
        run.party,
        run.actorResources,
        run.teamResources,
        run.partyHp,
        run.completedActivityIds,
      );
    const blocked = entered.activeActivity !== null || entered.activeEncounter !== null;
    const next: MutableMapRun = {
      ...run,
      currentNodeId: targetNodeId,
      visitedNodeIds: alreadyVisited ? [...run.visitedNodeIds] : [...run.visitedNodeIds, targetNodeId],
      completedEncounterNodeIds: [...run.completedEncounterNodeIds],
      activeActivity: entered.activeActivity,
      activeEncounter: entered.activeEncounter,
      status: !blocked && slot.definition.exitNodeIds.includes(targetNodeId) ? 'success' : 'inProgress',
    };
    if (next.status === 'success') return this.finishSuccess(slot.definition, next);
    this.slot = { ...slot, run: next };
    return snapshotOf(next);
  }

  completeEncounter(runId: string): MapRun {
    const slot = this.requireActiveRun(runId);
    const { run } = slot;
    const encounter = run.activeEncounter;
    if (!encounter) throw new MapRunError(['there is no active Encounter to complete']);
    if (encounter.nodeId !== run.currentNodeId) {
      throw new MapRunError(['active Encounter does not match the current Node']);
    }
    const node = slot.definition.nodes.find(candidate => candidate.id === encounter.nodeId);
    const encounterDef = resolveNodeEncounter(node, encounter.activityId);
    if (!node || !encounterDef) {
      throw new MapRunError(['active Encounter does not match the current Node']);
    }
    if ((encounterDef.enemies?.length ?? 0) > 0) {
      throw new MapRunError(['Battle Encounters cannot be completed manually']);
    }
    if (encounterDef.rounds !== undefined) {
      throw new MapRunError(['finite-round Encounter ends through its own round count, not manual completion']);
    }
    if (encounterDef.completion?.kind !== 'manual') {
      throw new MapRunError(['the active Encounter does not declare a manual completion action']);
    }

    const advanced = advanceCompletedActivity(slot.definition, run, encounter.nodeId, encounter.activityId);
    const next: MutableMapRun = {
      ...advanced.run,
      status: advanced.success ? 'success' : 'inProgress',
    };
    if (next.status === 'success') return this.finishSuccess(slot.definition, next);
    this.slot = { ...slot, run: next };
    return snapshotOf(next);
  }

  /** Atomically charges shared Team costs and applies one Shop offer's effects. */
  purchaseShopOffer(
    runId: string,
    offerId: string,
    requestId: string,
    expectedDraft: MapRunShopDraftToken,
  ): MapRun {
    if (!isNonEmptyId(offerId) || !isNonEmptyId(requestId)) {
      throw new MapRunError(['the Shop purchase request is malformed']);
    }
    const slot = this.requireActiveRun(runId);
    const currentActivity = slot.run.activeActivity;
    if (!currentActivity || currentActivity.kind !== 'shop') {
      throw new MapRunError(['there is no active Shop activity to interact with']);
    }
    // A retry of the same request stays idempotent even though the draft advanced.
    const previous = currentActivity.lastPurchase;
    if (previous?.requestId === requestId) {
      if (previous.offerId !== offerId
        || !isRecord(expectedDraft)
        || expectedDraft.nodeId !== currentActivity.nodeId
        || expectedDraft.activityId !== currentActivity.activityId) {
        throw new MapRunError(['the Shop purchase request ID was already used with different input']);
      }
      return snapshotOf(slot.run);
    }
    const activity = this.requireShopDraft(slot, expectedDraft);
    const shop = resolveNodeShop(
      slot.definition.nodes.find(candidate => candidate.id === activity.nodeId),
      activity.activityId,
    );
    const offer = shop?.offers.find(candidate => candidate.id === offerId);
    if (!offer) throw new MapRunError([`Shop offer "${offerId}" is not available in this activity`]);
    if (previous !== null && previous.resultingDraftVersion !== activity.shopDraftVersion) {
      throw new MapRunError(['the Shop purchase receipt does not match the current draft']);
    }

    const costs = freezeShopCosts(offer);
    const effects = freezeShopEffects(offer);
    const teamBalances = new Map(slot.run.teamResources.map(row => [row.resourceId, row.value]));
    for (const cost of costs) {
      const balance = teamBalances.get(cost.resourceId);
      if (balance === undefined) throw new MapRunError([`Shop offer "${offerId}" costs an undeclared Team resource`]);
      if (balance < cost.amount) throw new MapRunError([`Shop offer "${offerId}" cannot be paid from "${cost.resourceId}"`]);
      teamBalances.set(cost.resourceId, balance - cost.amount);
    }
    for (const effect of effects) {
      const balance = teamBalances.get(effect.resourceId);
      if (balance === undefined) throw new MapRunError([`Shop offer "${offerId}" grants an undeclared Team resource`]);
      const after = balance + effect.amount;
      if (!Number.isSafeInteger(after) || after < 0) {
        throw new MapRunError([`Shop offer "${offerId}" would leave an invalid balance for "${effect.resourceId}"`]);
      }
      teamBalances.set(effect.resourceId, after);
    }

    let heal: MapRunShopPurchaseReceipt['heal'] = null;
    let partyHp = slot.run.partyHp;
    if (offer.heal !== undefined) {
      const cap = partyHpCaps(slot.definition, slot.run.party).get(offer.heal.characterId);
      const row = partyHp.find(candidate => candidate.characterId === offer.heal!.characterId);
      if (cap === undefined || !row) throw new MapRunError([`Shop offer "${offerId}" heals an unknown party member`]);
      if (row.currentHp <= 0) throw new MapRunError([`Shop offer "${offerId}" cannot revive a downed party member`]);
      const restored = Math.max(0, Math.min(offer.heal.amount, cap - row.currentHp));
      partyHp = partyHp.map(candidate => candidate.characterId === row.characterId
        ? { ...candidate, currentHp: candidate.currentHp + restored }
        : candidate);
      heal = { characterId: offer.heal.characterId, amount: offer.heal.amount, restored };
    }
    if (activity.shopDraftVersion >= Number.MAX_SAFE_INTEGER) {
      throw new MapRunError(['the Shop draft version is exhausted']);
    }

    const receipt: MapRunShopPurchaseReceipt = {
      requestId,
      offerId,
      nodeId: activity.nodeId,
      activityId: activity.activityId,
      resultingDraftVersion: activity.shopDraftVersion + 1,
      costs,
      effects,
      heal,
    };
    const nextRun: MutableMapRun = {
      ...slot.run,
      partyHp,
      teamResources: slot.run.teamResources.map(row => ({
        ...row,
        value: teamBalances.get(row.resourceId) ?? row.value,
      })),
      activeActivity: {
        ...activity,
        shopDraftVersion: activity.shopDraftVersion + 1,
        lastPurchase: receipt,
      },
    };
    this.slot = { ...slot, run: nextRun };
    return snapshotOf(nextRun);
  }

  /** Ends the active Shop activity and advances the Node's fixed activity order. */
  leaveShop(runId: string, expectedDraft: MapRunShopDraftToken): MapRun {
    const slot = this.requireActiveRun(runId);
    const activity = this.requireShopDraft(slot, expectedDraft);
    const advanced = advanceCompletedActivity(slot.definition, slot.run, activity.nodeId, activity.activityId);
    const next: MutableMapRun = {
      ...advanced.run,
      status: advanced.success ? 'success' : 'inProgress',
    };
    if (next.status === 'success') return this.finishSuccess(slot.definition, next);
    this.slot = { ...slot, run: next };
    return snapshotOf(next);
  }

  private requireShopDraft(slot: MapRunSlot, expectedDraft: MapRunShopDraftToken): MapRunActiveActivity {
    const activity = slot.run.activeActivity;
    if (!activity || activity.kind !== 'shop') {
      throw new MapRunError(['there is no active Shop activity to interact with']);
    }
    if (!isRecord(expectedDraft)
      || Object.keys(expectedDraft).length !== 3
      || Object.keys(expectedDraft).some(key => !['nodeId', 'activityId', 'draftVersion'].includes(key))
      || expectedDraft.nodeId !== activity.nodeId
      || expectedDraft.activityId !== activity.activityId
      || !Number.isSafeInteger(expectedDraft.draftVersion)
      || (expectedDraft.draftVersion as number) !== activity.shopDraftVersion) {
      throw new MapRunError(['the Shop draft is stale']);
    }
    return activity;
  }

  private requireActiveRun(runId: string): MapRunSlot {
    const slot = this.slot;
    if (!slot || slot.run.runId !== runId) throw new MapRunError([`unknown MapRun ID "${runId}"`]);
    if (slot.run.status !== 'inProgress') throw new MapRunError(['the MapRun is already complete']);
    return slot;
  }
}
