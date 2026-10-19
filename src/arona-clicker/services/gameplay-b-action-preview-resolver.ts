import type {
  GameplayMapActionDef,
  GameplayMapDef,
} from '../../data-services/contracts/gameplay-map';
import type {
  MapRunActionOverride,
  MapRunActorResourceBalance,
  MapRunEncounterSnapshot,
  MapRunPartyMember,
  MapRunPartyHp,
  MapRunTeamResourceBalance,
} from '../contracts/map-run';
import type { MapRunCardRef } from '../contracts/map-cards';
import { catalogMapRunCards, mapRunCardKey, parseMapRunCardRef } from './map-card-catalog';

export interface GameplayBActionPreviewInput {
  /** Required when resolving round-local card identities. */
  readonly runId?: string;
  readonly definition: GameplayMapDef;
  readonly encounter: MapRunEncounterSnapshot;
  readonly party: readonly MapRunPartyMember[];
  readonly partyHp?: readonly MapRunPartyHp[];
  readonly playerCost: number;
  readonly actorResources: readonly MapRunActorResourceBalance[];
  readonly teamResources: readonly MapRunTeamResourceBalance[];
}

export interface GameplayBPreparedActionPreview {
  readonly characterId: string;
  readonly handActionIds: readonly string[];
  /** First Hand item before applying the shared override, or null for Wait. */
  readonly naturalActionId: string | null;
  /** Effective action after applying the shared override, or null for Wait. */
  readonly preparedActionId: string | null;
  /** Player-facing title copied into this detached read model; null means Wait. */
  readonly actionName: string | null;
  /** Optional player-facing explanation copied into this detached read model. */
  readonly actionDescription: string | null;
  readonly targetKind: 'none' | 'self' | 'partyCharacter' | 'enemy' | 'card' | null;
  readonly legalTargetCharacterIds: readonly string[];
  /** Present for Enemy-target Actions; IDs are local to this Encounter. */
  readonly legalTargetEnemyIds?: readonly string[];
  /** Null means no actor target, or a required multi-target choice is pending. */
  readonly targetCharacterId: string | null;
  /** Present for Enemy-target Actions. */
  readonly targetEnemyId?: string | null;
  readonly targetSelectionRequired: boolean;
  readonly legalTargetCards?: readonly MapRunCardRef[];
  readonly targetCard?: MapRunCardRef | null;
  readonly overrideKind: MapRunActionOverride['kind'] | null;
  /** PlayerCommand reserves exactly one PlayerCost at Commit; Swap reserves zero. */
  readonly playerCost: 0 | 1;
}

export interface GameplayBPlayerCommandOptionPreview {
  readonly characterId: string;
  readonly actionId: string;
  readonly actionName: string;
  readonly actionDescription: string | null;
  readonly playerCost: 1;
  readonly canPayPlayerCost: boolean;
  readonly canPayActionCosts: boolean;
}

/** Detached action and target view derived from the current Encounter snapshot. */
export interface GameplayBActionPreview {
  readonly nodeId: string;
  readonly round: number;
  readonly draftVersion: number;
  readonly overrides: readonly MapRunActionOverride[];
  readonly preparedActions: readonly GameplayBPreparedActionPreview[];
  /** Hand-out Encounter candidates that may be selected by PlayerCommand. */
  readonly playerCommandOptions: readonly GameplayBPlayerCommandOptionPreview[];
}

type TargetSelectionRef =
  | { readonly kind: 'partyCharacter'; readonly id: string }
  | { readonly kind: 'enemy'; readonly id: string }
  | { readonly kind: 'card'; readonly ref: MapRunCardRef };

export class GameplayBActionPreviewError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'GameplayBActionPreviewError';
  }
}

function fail(message: string): never {
  throw new GameplayBActionPreviewError([message]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resourceKey(characterId: string, resourceId: string): string {
  return JSON.stringify([characterId, resourceId]);
}

function indexResources(input: GameplayBActionPreviewInput): {
  readonly actor: ReadonlyMap<string, number>;
  readonly team: ReadonlyMap<string, number>;
} {
  const partyIds = new Set(input.party.map(member => member.characterId));
  const actor = new Map<string, number>();
  for (const row of input.actorResources) {
    if (!isNonEmptyId(row.characterId) || !partyIds.has(row.characterId)
      || !isNonEmptyId(row.resourceId) || !Number.isSafeInteger(row.value) || row.value < 0) {
      fail('MapRun contains an invalid Actor resource balance');
    }
    const key = resourceKey(row.characterId, row.resourceId);
    if (actor.has(key)) fail('MapRun contains a duplicate Actor resource balance');
    actor.set(key, row.value);
  }

  const team = new Map<string, number>();
  for (const row of input.teamResources) {
    if (!isNonEmptyId(row.resourceId) || !Number.isSafeInteger(row.value) || row.value < 0) {
      fail('MapRun contains an invalid Team resource balance');
    }
    if (team.has(row.resourceId)) fail('MapRun contains a duplicate Team resource balance');
    team.set(row.resourceId, row.value);
  }
  return { actor, team };
}

function actionCostsArePayable(
  action: GameplayMapActionDef,
  characterId: string,
  actorResources: ReadonlyMap<string, number>,
  teamResources: ReadonlyMap<string, number>,
): boolean {
  const rawCosts: unknown = action.costs;
  if (rawCosts === undefined) return true;
  if (!Array.isArray(rawCosts)) fail(`Map Action "${action.id}" costs must be an array`);

  const required = new Map<string, { balance: number; amount: bigint }>();
  for (const rawCost of rawCosts) {
    if (!isRecord(rawCost)
      || (rawCost.scope !== 'actor' && rawCost.scope !== 'team')
      || !isNonEmptyId(rawCost.resourceId)
      || !Number.isSafeInteger(rawCost.amount)
      || (rawCost.amount as number) <= 0) {
      fail(`Map Action "${action.id}" has an invalid resource cost`);
    }
    const key = JSON.stringify([rawCost.scope, rawCost.resourceId]);
    const balance = rawCost.scope === 'actor'
      ? actorResources.get(resourceKey(characterId, rawCost.resourceId)) ?? 0
      : teamResources.get(rawCost.resourceId) ?? 0;
    const previous = required.get(key);
    required.set(key, {
      balance,
      amount: (previous?.amount ?? 0n) + BigInt(rawCost.amount as number),
    });
  }
  return [...required.values()].every(row => row.amount <= BigInt(row.balance));
}

function immutableOverrides(value: readonly MapRunActionOverride[]): readonly MapRunActionOverride[] {
  return Object.freeze(value.map(override => Object.freeze({ ...override })));
}

/**
 * Resolves natural Prepared Actions, explicit overrides, legal targets, and
 * PlayerCommand options without changing the MapRun, resources, round, or RNG.
 */
export function resolveGameplayBActionPreview(input: GameplayBActionPreviewInput): GameplayBActionPreview {
  const { definition, encounter, party } = input;
  if (!Array.isArray(party) || party.length === 0
    || party.some(member => !isRecord(member) || !isNonEmptyId(member.characterId))
    || new Set(party.map(member => member.characterId)).size !== party.length) {
    fail('Action preview requires a non-empty unique MapRun party');
  }
  if (!Number.isSafeInteger(input.playerCost) || input.playerCost < 0) {
    fail('Action preview requires a non-negative PlayerCost balance');
  }
  if (!isRecord(encounter)
    || !isNonEmptyId(encounter.nodeId)
    || !Number.isSafeInteger(encounter.round) || encounter.round < 1
    || !Number.isSafeInteger(encounter.draftVersion) || encounter.draftVersion < 0
    || !Array.isArray(encounter.hands) || encounter.hands.length !== party.length
    || !Array.isArray(encounter.targetSelections)) {
    fail('Action preview requires a valid active Encounter snapshot');
  }

  const node = definition.nodes.find(candidate => candidate.id === encounter.nodeId);
  const nodeActivities = node?.activities ?? [];
  const encounterDef = nodeActivities.length > 0
    ? (encounter.activityId === undefined
      ? undefined
      : nodeActivities.find(activity => activity.id === encounter.activityId)?.encounter)
    : (encounter.activityId === undefined ? node?.encounter : undefined);
  if (!node || !encounterDef) fail(`Map Node "${encounter.nodeId}" has no active Encounter`);

  const partyIds = new Set(party.map(member => member.characterId));
  const partyHpDefinitions: unknown = definition.initialPartyHp;
  if (!Array.isArray(partyHpDefinitions) || partyHpDefinitions.length !== party.length) {
    fail('Action preview requires fixed-party HP caps from the Map definition');
  }
  const partyHpCaps = new Map<string, number>();
  for (const [index, member] of party.entries()) {
    const hpDefinition = partyHpDefinitions[index];
    if (!isRecord(hpDefinition) || hpDefinition.characterId !== member.characterId
      || !Number.isSafeInteger(hpDefinition.initialHp) || !Number.isSafeInteger(hpDefinition.maxHp)
      || (hpDefinition.initialHp as number) < 1 || (hpDefinition.maxHp as number) < (hpDefinition.initialHp as number)) {
      fail(`Map definition has invalid HP bounds for "${member.characterId}"`);
    }
    partyHpCaps.set(member.characterId, hpDefinition.maxHp as number);
  }
  const hpRows = input.partyHp ?? party.map(member => ({ characterId: member.characterId, currentHp: 1 }));
  if (!Array.isArray(hpRows) || hpRows.length !== party.length
    || hpRows.some((row, index) => !isRecord(row) || row.characterId !== party[index]?.characterId
      || !Number.isSafeInteger(row.currentHp) || (row.currentHp as number) < 0
      || (row.currentHp as number) > (partyHpCaps.get(party[index]?.characterId ?? '') ?? -1))) {
    fail('Action preview requires MapRun HP for the fixed party');
  }
  const partyHp = new Map(hpRows.map(row => [row.characterId, row.currentHp]));
  const livingPartyIds = new Set(party.filter(member => (partyHp.get(member.characterId) ?? 0) > 0)
    .map(member => member.characterId));
  const rawEnemies: unknown = encounter.enemies ?? [];
  if (!Array.isArray(rawEnemies)) fail('Action preview requires an Encounter Enemy roster');
  const enemyDefinitions: unknown = encounterDef.enemies ?? [];
  if (!Array.isArray(enemyDefinitions) || rawEnemies.length !== enemyDefinitions.length) {
    fail('Action preview received an Enemy roster that does not match the Map content');
  }
  const enemyIds = new Set<string>();
  const livingEnemyIds: string[] = [];
  for (const [index, rawEnemy] of rawEnemies.entries()) {
    const expectedEnemy = enemyDefinitions[index];
    if (!isRecord(rawEnemy) || !isNonEmptyId(rawEnemy.enemyId)
      || !Number.isSafeInteger(rawEnemy.currentHp) || (rawEnemy.currentHp as number) < 0
      || !isRecord(expectedEnemy) || rawEnemy.enemyId !== expectedEnemy.id
      || !Number.isSafeInteger(expectedEnemy.maxHp) || (expectedEnemy.maxHp as number) < 1
      || (rawEnemy.currentHp as number) > (expectedEnemy.maxHp as number)
      || enemyIds.has(rawEnemy.enemyId)) fail('Action preview received an invalid Enemy HP snapshot');
    enemyIds.add(rawEnemy.enemyId);
    if ((rawEnemy.currentHp as number) > 0) livingEnemyIds.push(rawEnemy.enemyId);
  }
  const actionRows: unknown = definition.actions ?? [];
  if (!Array.isArray(actionRows)) fail(`Map "${definition.id}" actions must be an array`);
  const actionsById = new Map<string, GameplayMapActionDef>();
  for (const rawAction of actionRows) {
    if (!isRecord(rawAction) || !isNonEmptyId(rawAction.id)) {
      fail(`Map "${definition.id}" contains an Action with an invalid ID`);
    }
    if (actionsById.has(rawAction.id)) fail(`Map "${definition.id}" contains duplicate Action "${rawAction.id}"`);
    if (!Array.isArray(rawAction.eligibleCharacterIds)
      || !rawAction.eligibleCharacterIds.every(isNonEmptyId)
      || !isNonEmptyId(rawAction.name)
      || (rawAction.description !== undefined && typeof rawAction.description !== 'string')
      || typeof rawAction.target !== 'object' || rawAction.target === null
      || !isRecord(rawAction.target)
      || !['none', 'self', 'partyCharacter', 'enemy', 'card'].includes(String(rawAction.target.kind))) {
      fail(`Map Action "${rawAction.id}" has invalid eligibility or target rules`);
    }
    actionsById.set(rawAction.id, rawAction as unknown as GameplayMapActionDef);
  }

  const participants: unknown = encounterDef.participants ?? [];
  if (!Array.isArray(participants)) fail(`Map Node "${node.id}" participants must be an array`);
  const participantActions = new Map<string, Set<string>>();
  for (const rawParticipant of participants) {
    if (!isRecord(rawParticipant) || !isNonEmptyId(rawParticipant.characterId)
      || !partyIds.has(rawParticipant.characterId) || !Array.isArray(rawParticipant.actions)) {
      fail(`Map Node "${node.id}" has an invalid Encounter participant`);
    }
    if (participantActions.has(rawParticipant.characterId)) {
      fail(`Map Node "${node.id}" has a duplicate Encounter participant`);
    }
    const candidateIds = new Set<string>();
    for (const rawCandidate of rawParticipant.actions) {
      if (!isRecord(rawCandidate) || !isNonEmptyId(rawCandidate.actionId)
        || !Number.isSafeInteger(rawCandidate.tendencyWeight) || (rawCandidate.tendencyWeight as number) <= 0) {
        fail(`Map Node "${node.id}" has an invalid Encounter Action candidate`);
      }
      const action = actionsById.get(rawCandidate.actionId);
      if (!action || !action.eligibleCharacterIds.includes(rawParticipant.characterId)) {
        fail(`Map Node "${node.id}" references an unavailable Action "${rawCandidate.actionId}"`);
      }
      if (candidateIds.has(rawCandidate.actionId)) fail(`Map Node "${node.id}" has a duplicate Action candidate`);
      candidateIds.add(rawCandidate.actionId);
    }
    participantActions.set(rawParticipant.characterId, candidateIds);
  }

  const balances = indexResources(input);
  const handsByCharacter = new Map<string, readonly string[]>();
  for (const [index, rawHand] of encounter.hands.entries()) {
    const member = party[index];
    if (!member || !isRecord(rawHand) || rawHand.characterId !== member.characterId
      || !Array.isArray(rawHand.actionIds) || rawHand.actionIds.length > 3
      || !rawHand.actionIds.every(isNonEmptyId)
      || new Set(rawHand.actionIds).size !== rawHand.actionIds.length) {
      fail('Action preview received a malformed Hand snapshot');
    }
    const candidates = participantActions.get(member.characterId) ?? new Set<string>();
    for (const actionId of rawHand.actionIds) {
      const action = actionsById.get(actionId);
      if (!action || !candidates.has(actionId) || !action.eligibleCharacterIds.includes(member.characterId)
        || !actionCostsArePayable(action, member.characterId, balances.actor, balances.team)) {
        fail(`Action preview found an invalid Hand Action "${actionId}" for "${member.characterId}"`);
      }
    }
    handsByCharacter.set(member.characterId, rawHand.actionIds as string[]);
  }

  const rawTargetSelections: readonly unknown[] = encounter.targetSelections;
  const targetSelections = new Map<string, TargetSelectionRef>();
  for (const rawSelection of rawTargetSelections) {
    if (!isRecord(rawSelection)) fail('Action preview received an invalid target selection');
    const keys = Object.keys(rawSelection);
    const partyTarget = keys.length === 2 && keys.every(key => ['characterId', 'targetCharacterId'].includes(key))
      && isNonEmptyId(rawSelection.targetCharacterId);
    const enemyTarget = keys.length === 2 && keys.every(key => ['characterId', 'targetEnemyId'].includes(key))
      && isNonEmptyId(rawSelection.targetEnemyId);
    const card = keys.length === 2 && keys.every(key => ['characterId', 'targetCard'].includes(key))
      ? parseMapRunCardRef(rawSelection.targetCard) : null;
    if (!isNonEmptyId(rawSelection.characterId) || !partyIds.has(rawSelection.characterId)
      || (!partyTarget && !enemyTarget && !card)) {
      fail('Action preview received an invalid target selection');
    }
    if (targetSelections.has(rawSelection.characterId)) fail('Action preview received duplicate target selections');
    targetSelections.set(rawSelection.characterId, card ? { kind: 'card', ref: card } : isNonEmptyId(rawSelection.targetCharacterId)
      ? { kind: 'partyCharacter', id: rawSelection.targetCharacterId }
      : { kind: 'enemy', id: rawSelection.targetEnemyId as string });
  }

  const rawOverrides: unknown = encounter.overrides ?? [];
  if (!Array.isArray(rawOverrides) || rawOverrides.length > party.length) {
    fail('Action preview received an invalid Encounter override list');
  }
  const overrides: MapRunActionOverride[] = [];
  const overrideByCharacter = new Map<string, MapRunActionOverride>();
  let previousOverridePartyIndex = -1;
  for (const rawOverride of rawOverrides) {
    if (!isRecord(rawOverride)) fail('Action preview received an invalid Encounter override');
    const keys = Object.keys(rawOverride);
    if (keys.length !== 3 || keys.some(key => !['kind', 'characterId', 'actionId'].includes(key))
      || (rawOverride.kind !== 'swap' && rawOverride.kind !== 'playerCommand')
      || !isNonEmptyId(rawOverride.characterId) || !partyIds.has(rawOverride.characterId)
      || !livingPartyIds.has(rawOverride.characterId)
      || !isNonEmptyId(rawOverride.actionId)) {
      fail('Action preview received an invalid Encounter override');
    }
    const actorId = rawOverride.characterId;
    const partyIndex = party.findIndex(member => member.characterId === actorId);
    if (partyIndex <= previousOverridePartyIndex || overrideByCharacter.has(actorId)) {
      fail('Action preview requires unique, party-ordered Encounter overrides');
    }
    previousOverridePartyIndex = partyIndex;
    const hand = handsByCharacter.get(actorId) ?? [];
    const candidates = participantActions.get(actorId) ?? new Set<string>();
    const action = actionsById.get(rawOverride.actionId);
    if (!action || !candidates.has(rawOverride.actionId)
      || !action.eligibleCharacterIds.includes(actorId)) {
      fail(`Action preview override references an unavailable Action "${rawOverride.actionId}"`);
    }
    if (rawOverride.kind === 'swap') {
      if (!hand.includes(rawOverride.actionId) || rawOverride.actionId === hand[0]) {
        fail('Swap override must select another Action in the same Character Hand');
      }
    } else if (hand.includes(rawOverride.actionId)) {
      fail('PlayerCommand override must select an Action outside the current Hand');
    } else if (input.playerCost < 1) {
      fail('PlayerCommand requires 1 PlayerCost');
    } else if (!actionCostsArePayable(action, actorId, balances.actor, balances.team)) {
      fail('PlayerCommand Action costs are not payable');
    }
    const override: MapRunActionOverride = {
      kind: rawOverride.kind,
      characterId: actorId,
      actionId: rawOverride.actionId,
    };
    overrides.push(override);
    overrideByCharacter.set(actorId, override);
  }
  const commandOverrideCount = overrides.filter(override => override.kind === 'playerCommand').length;
  const abilityPlayerCost = encounter.abilityDraft ? 1 : 0;

  const preparedActions: GameplayBPreparedActionPreview[] = [];
  const commandOptions: GameplayBPlayerCommandOptionPreview[] = [];
  for (const member of party) {
    const isLiving = livingPartyIds.has(member.characterId);
    const handActionIds = handsByCharacter.get(member.characterId) ?? [];
    if (!isLiving && handActionIds.length > 0) fail(`Downed Character "${member.characterId}" has a non-empty Hand`);
    const naturalActionId = handActionIds[0] ?? null;
    const actionOverride = overrideByCharacter.get(member.characterId) ?? null;
    const preparedActionId = isLiving ? (actionOverride?.actionId ?? naturalActionId) : null;
    if (isLiving && actionOverride !== null && preparedActionId === naturalActionId) {
      fail(`Override for "${member.characterId}" must change the Prepared Action`);
    }
    const action = preparedActionId === null ? null : actionsById.get(preparedActionId) ?? null;
    if (preparedActionId !== null && !action) fail(`Prepared Action "${preparedActionId}" is missing from the Map`);

    let targetKind: GameplayBPreparedActionPreview['targetKind'] = null;
    let legalTargetCharacterIds: string[] = [];
    let targetCharacterId: string | null = null;
    let targetEnemyId: string | null | undefined;
    let targetSelectionRequired = false;
    if (action) {
      targetKind = action.target.kind;
      if (action.target.kind === 'self') {
        if (targetSelections.has(member.characterId)) {
          fail(`Action "${action.id}" does not accept an explicit target selection`);
        }
        legalTargetCharacterIds = [member.characterId];
        targetCharacterId = member.characterId;
      } else if (action.target.kind === 'partyCharacter') {
        legalTargetCharacterIds = party.map(partyMember => partyMember.characterId).filter(id => livingPartyIds.has(id));
        const selected = targetSelections.get(member.characterId);
        if (selected !== undefined) {
          if (selected.kind !== 'partyCharacter' || legalTargetCharacterIds.length <= 1
            || !legalTargetCharacterIds.includes(selected.id)) {
            fail(`Target selection is not a valid unresolved party target for "${member.characterId}"`);
          }
          targetCharacterId = selected.id;
        } else if (legalTargetCharacterIds.length === 1) {
          targetCharacterId = legalTargetCharacterIds[0];
        } else {
          targetSelectionRequired = true;
        }
      } else if (action.target.kind === 'enemy') {
        if (livingEnemyIds.length === 0) fail(`Enemy-target Action "${action.id}" has no living Enemy target`);
        targetEnemyId = null;
        const selected = targetSelections.get(member.characterId);
        // The reused / natural card is stateless: a target choice carried over from a
        // previous round is honored only while it still maps to a living Enemy. Once it
        // is stale (the Enemy fell), it is dropped and the target is decided anew for
        // this round instead of failing, so a Character never silently loses its target.
        if (selected !== undefined && selected.kind === 'enemy' && enemyIds.has(selected.id) && livingEnemyIds.includes(selected.id)) {
          targetEnemyId = selected.id;
        } else if (livingEnemyIds.length === 1) {
          targetEnemyId = livingEnemyIds[0];
        } else {
          targetSelectionRequired = true;
        }
      } else if (action.target.kind === 'card') {
        targetSelectionRequired = true; // Resolve against all real cards after every preparation is known.
      } else if (targetSelections.has(member.characterId)) {
        fail(`Action "${action.id}" does not accept a target selection`);
      }
    } else if (targetSelections.has(member.characterId)) {
      fail(`Wait cannot have a target selection for "${member.characterId}"`);
    }

    preparedActions.push(Object.freeze({
      characterId: member.characterId,
      handActionIds: Object.freeze([...handActionIds]),
      naturalActionId,
      preparedActionId,
      actionName: action?.name ?? null,
      actionDescription: action?.description ?? null,
      targetKind,
      legalTargetCharacterIds: Object.freeze(legalTargetCharacterIds),
      ...(action?.target.kind === 'enemy' ? { legalTargetEnemyIds: Object.freeze([...livingEnemyIds]), targetEnemyId } : {}),
      targetCharacterId,
      targetSelectionRequired,
      overrideKind: actionOverride?.kind ?? null,
      playerCost: actionOverride?.kind === 'playerCommand' ? 1 : 0,
    }));

    const candidates = participantActions.get(member.characterId) ?? new Set<string>();
    if (!isLiving) continue;
    for (const actionId of candidates) {
      if (handActionIds.includes(actionId)) continue;
      const commandAction = actionsById.get(actionId)!;
      commandOptions.push(Object.freeze({
        characterId: member.characterId,
        actionId,
        actionName: commandAction.name,
        actionDescription: commandAction.description ?? null,
        playerCost: 1,
        canPayPlayerCost: input.playerCost >= abilityPlayerCost + commandOverrideCount
          - (actionOverride?.kind === 'playerCommand' ? 1 : 0) + 1,
        canPayActionCosts: actionCostsArePayable(commandAction, member.characterId, balances.actor, balances.team),
      }));
    }
  }

  let resolvedPrepared = preparedActions;
  if (preparedActions.some(row => row.targetKind === 'card')) {
    if (!isNonEmptyId(input.runId)) fail('Card target preview requires its MapRun identity');
    const catalog = catalogMapRunCards({ runId: input.runId, mapId: definition.id, activeEncounter: encounter, status: 'inProgress' }, { preparedActions });
    resolvedPrepared = preparedActions.map(row => {
      if (row.targetKind !== 'card') return row;
      const action = actionsById.get(row.preparedActionId!)!;
      if (action.target.kind !== 'card' || !['self', 'ally', 'opponent', 'any'].includes(action.target.side)
        || !action.cardEffects?.length || action.cardEffects.some(effect => effect.kind !== 'scostDiscount'
          || !Number.isSafeInteger(effect.amount) || effect.amount <= 0)) fail(`Action "${action.id}" has invalid card effects`);
      const side = action.target.side;
      const legalTargetCards = Object.freeze(catalog.filter(card => {
        const own = card.owner.kind === 'partyCharacter' && card.owner.id === row.characterId;
        const allied = card.owner.kind === 'partyCharacter';
        if ((side === 'self' && !own) || (side === 'ally' && !allied) || (side === 'opponent' && allied)) return false;
        const targetAction = card.actionId === null ? null : actionsById.get(card.actionId);
        return (targetAction?.costs ?? []).some(cost => cost.scope === 'actor' && cost.resourceId === 'sCost' && cost.amount > 0);
      }).map(card => card.ref));
      const selected = targetSelections.get(row.characterId);
      if (selected && (selected.kind !== 'card' || !legalTargetCards.some(ref => mapRunCardKey(ref) === mapRunCardKey(selected.ref)))) {
        fail(`Card target selection is not legal for "${row.characterId}"`);
      }
      const targetCard = selected?.kind === 'card' ? selected.ref : legalTargetCards.length === 1 ? legalTargetCards[0] : null;
      return Object.freeze({ ...row, legalTargetCards, targetCard, targetSelectionRequired: targetCard === null });
    });
  }

  return Object.freeze({
    nodeId: encounter.nodeId,
    round: encounter.round,
    draftVersion: encounter.draftVersion,
    overrides: immutableOverrides(overrides),
    preparedActions: Object.freeze(resolvedPrepared),
    playerCommandOptions: Object.freeze(commandOptions),
  });
}
