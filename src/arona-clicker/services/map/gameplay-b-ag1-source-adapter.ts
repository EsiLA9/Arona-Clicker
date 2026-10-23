import type { GameplayMapDef, GameplayEncounterDef } from '../../../data-services/contracts/gameplay-map';
import type { MapRunEncounterSourcePreview } from '../../contracts/map/map-run';
import type { MapRunCardInstance, MapRunCardRef } from '../../contracts/map/map-cards';
import type {
  GameplayBActionPreview,
  GameplayBPreparedActionPreview,
  GameplayBPreparedEnemyActionPreview,
} from './gameplay-b-action-preview-resolver';
import { mapRunCardKey, parseMapRunCardRef } from './map-card-catalog';
import { resolveGameplayBAg1SourceOrder, type GameplayBAg1SourceOrderCandidate } from './gameplay-b-ag1-scheduler';

export interface GameplayBAg1SourceAdapterScope {
  readonly runId: string;
  readonly mapId: string;
  readonly nodeId: string;
  readonly activityId: string | null;
  readonly round: number;
}

export interface GameplayBAg1SourceAdapterInput {
  readonly scope: GameplayBAg1SourceAdapterScope;
  readonly definition: GameplayMapDef;
  /** The admitted Party and Encounter Enemy identities in their fixed domain order. */
  readonly partyIds: readonly string[];
  readonly enemyIds: readonly string[];
  /** Complete U03 snapshots, in the same order as partyIds/enemyIds. */
  readonly partyAgility: readonly { readonly characterId: string; readonly agility: number }[];
  readonly enemyAgility: readonly { readonly enemyId: string; readonly agility: number }[];
  readonly actionPreview: GameplayBActionPreview;
  readonly sourcePreview: MapRunEncounterSourcePreview;
  /** Current detached output of catalogMapRunCards for this scope and preview. */
  readonly cards: readonly MapRunCardInstance[];
}

export type GameplayBAg1ExecutionSourceKind = 'partyAction' | 'enemyAction' | 'ability' | 'item';

export type GameplayBAg1ExecutionTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'actor'; readonly actorKind: 'partyCharacter' | 'enemy'; readonly actorId: string | null }
  | { readonly kind: 'card'; readonly cardRef: MapRunCardRef | null };

/** One actual selected source, detached from the preview and paired with its U02 ordering input. */
export interface GameplayBAg1ExecutionSource {
  readonly sourceKey: string;
  readonly sourceKind: GameplayBAg1ExecutionSourceKind;
  readonly owner: { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string } | null;
  readonly actionId: string;
  /** Actual source card for Party/Enemy actions; actorless sources deliberately have none. */
  readonly cardRef: MapRunCardRef | null;
  readonly target: GameplayBAg1ExecutionTarget;
  readonly skipReason: 'noLegalTarget' | null;
  readonly baseAgility: number;
  readonly actorAgility: number;
  readonly finalAgility: number;
  readonly orderCandidate: GameplayBAg1SourceOrderCandidate;
}

function fail(message: string): never { throw new TypeError(`AG-1 source adapter: ${message}`); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function safeId(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function safeAgility(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${label} must be a non-negative safe integer`);
  return value as number;
}
function uniqueRoster(ids: readonly string[], label: string): void {
  if (!Array.isArray(ids) || ids.some(id => !safeId(id)) || new Set(ids).size !== ids.length) fail(`${label} must be an ordered unique identity list`);
}
function validateAgilitySnapshot<T extends { readonly agility: number }>(
  rows: readonly T[], ids: readonly string[], idField: 'characterId' | 'enemyId', label: string,
): ReadonlyMap<string, number> {
  if (!Array.isArray(rows) || rows.length !== ids.length) fail(`${label} must cover its roster exactly`);
  const values = new Map<string, number>();
  rows.forEach((row, index) => {
    if (!isClosedDataRow(row, [idField, 'agility']) || row[idField] !== ids[index] || values.has(ids[index])) {
      fail(`${label} identity/order or fields do not match its roster`);
    }
    values.set(ids[index], safeAgility(row.agility, `${label}[${index}].agility`));
  });
  return values;
}
function isClosedDataRow(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && ownKeys.every(key => typeof key === 'string' && keys.includes(key)
    && Object.getOwnPropertyDescriptor(value, key) !== undefined
    && 'value' in Object.getOwnPropertyDescriptor(value, key)!);
}
function encounterFor(definition: GameplayMapDef, scope: GameplayBAg1SourceAdapterScope): GameplayEncounterDef {
  const node = definition.nodes.find(row => row.id === scope.nodeId);
  if (!node) fail('scope node is not declared by the Map');
  if ((node.activities?.length ?? 0) > 0) {
    if (scope.activityId === null) fail('activity scope is required for an activity Node');
    const activity = node.activities!.find(row => row.id === scope.activityId);
    if (!activity?.encounter) fail('scope activity does not declare an Encounter');
    return activity.encounter;
  }
  if (scope.activityId !== null || !node.encounter) fail('scope does not match a single-Encounter Node');
  return node.encounter;
}
function cloneTarget(target: GameplayBAg1ExecutionTarget): GameplayBAg1ExecutionTarget {
  if (target.kind === 'actor') return Object.freeze({ ...target });
  if (target.kind === 'card') {
    const ref = target.cardRef ? parseMapRunCardRef(target.cardRef) : null;
    return Object.freeze({ kind: 'card', cardRef: ref ? Object.freeze({ kind: 'card', id: ref.id,
      scope: Object.freeze({ ...ref.scope }) }) : null });
  }
  return Object.freeze({ kind: 'none' });
}
function actionTarget(row: GameplayBPreparedActionPreview | GameplayBPreparedEnemyActionPreview,
  ownerKind: 'partyCharacter' | 'enemy', ownerId: string): GameplayBAg1ExecutionTarget {
  if (row.targetKind === 'card') return { kind: 'card', cardRef: row.targetCard ? parseMapRunCardRef(row.targetCard) : null };
  if (row.targetKind === 'partyCharacter') return { kind: 'actor', actorKind: 'partyCharacter', actorId: row.targetCharacterId };
  if (row.targetKind === 'enemy') return { kind: 'actor', actorKind: 'enemy', actorId: row.targetEnemyId ?? null };
  if (row.targetKind === 'self') return { kind: 'actor', actorKind: ownerKind, actorId: ownerId };
  return { kind: 'none' };
}
function canonicalSourceKey(scope: GameplayBAg1SourceAdapterScope, sourceKind: GameplayBAg1ExecutionSourceKind,
  ownerOrSourceId: string | null, actionId: string): string {
  return JSON.stringify([scope.runId, scope.mapId, scope.nodeId, scope.activityId, scope.round,
    sourceKind, ownerOrSourceId, actionId]);
}

function findSourceCard(input: GameplayBAg1SourceAdapterInput, ownerKind: 'partyCharacter' | 'enemy', ownerId: string,
  actionId: string, zone: 'hand' | 'playerCommand', logicalIndex: number): MapRunCardRef {
  const expectedId = JSON.stringify([zone, ownerKind, ownerId, actionId]);
  const candidates = input.cards.filter(card => isRecord(card) && isRecord(card.owner)
    && card.owner.kind === ownerKind && card.owner.id === ownerId && card.actionId === actionId
    && card.zone === zone && card.prepared === true);
  if (candidates.length !== 1) fail(`${ownerKind} ${ownerId} Action ${actionId} has ${candidates.length} matching prepared Catalog cards`);
  const card = candidates[0];
  const ref = parseMapRunCardRef(card.ref);
  if (!ref || card.logicalIndex !== logicalIndex || ref.id !== expectedId
    || ref.scope.runId !== input.scope.runId || ref.scope.mapId !== input.scope.mapId
    || ref.scope.nodeId !== input.scope.nodeId || ref.scope.activityId !== input.scope.activityId
    || ref.scope.round !== input.scope.round || card.controllable !== (ownerKind === 'partyCharacter')) {
    fail(`${ownerKind} ${ownerId} Action ${actionId} does not map to its canonical current-scope Catalog CardRef`);
  }
  const sameRef = input.cards.filter(row => {
    const parsed = isRecord(row) ? parseMapRunCardRef(row.ref) : null;
    return parsed !== null && mapRunCardKey(parsed) === mapRunCardKey(ref);
  });
  if (sameRef.length !== 1) fail(`Catalog CardRef for ${ownerKind} ${ownerId} Action ${actionId} is ambiguous`);
  return Object.freeze({ kind: 'card', id: ref.id, scope: Object.freeze({ ...ref.scope }) });
}

/** Build the actual selected AG-1 sources from detached previews and the current real card catalog. */
export function buildGameplayBAg1ExecutionSources(input: GameplayBAg1SourceAdapterInput): readonly GameplayBAg1ExecutionSource[] {
  if (!isRecord(input) || !isRecord(input.scope) || !isRecord(input.definition)) fail('input and scope must be objects');
  const { scope, definition } = input;
  if (definition.executionContractId !== 'AG-1') fail('Map does not select the AG-1 execution contract');
  if (!safeId(scope.runId) || !safeId(scope.mapId) || scope.mapId !== definition.id || !safeId(scope.nodeId)
    || !(scope.activityId === null || safeId(scope.activityId)) || !Number.isSafeInteger(scope.round) || scope.round < 1) {
    fail('scope must be a valid current MapRun scope');
  }
  uniqueRoster(input.partyIds, 'Party roster');
  uniqueRoster(input.enemyIds, 'Enemy roster');
  if (input.partyIds.length === 0 || input.partyIds.length !== definition.partyCharacterIds.length
    || input.partyIds.some((id, index) => id !== definition.partyCharacterIds[index])) fail('Party roster differs from the fixed Map Party');
  const partyAgility = validateAgilitySnapshot(input.partyAgility, input.partyIds, 'characterId', 'Party agility snapshot');
  const enemyAgility = validateAgilitySnapshot(input.enemyAgility, input.enemyIds, 'enemyId', 'Enemy agility snapshot');
  const encounter = encounterFor(definition, scope);
  const declaredEnemyIds = (encounter.enemies ?? []).map(row => row.id);
  if (declaredEnemyIds.length !== input.enemyIds.length || declaredEnemyIds.some((id, index) => id !== input.enemyIds[index])) {
    fail('Enemy roster differs from the current Encounter definition');
  }
  const declaredPartyAgility = new Map<string, number>();
  for (const [index, row] of (definition.partyAgility ?? []).entries()) {
    if (!isClosedDataRow(row, ['characterId', 'agility']) || !input.partyIds.includes(row.characterId as string)
      || declaredPartyAgility.has(row.characterId as string)) fail(`Map partyAgility[${index}] is invalid for the fixed Party`);
    declaredPartyAgility.set(row.characterId as string,
      safeAgility(row.agility, `Map partyAgility[${index}].agility`));
  }
  for (const characterId of input.partyIds) {
    if (partyAgility.get(characterId) !== (declaredPartyAgility.get(characterId) ?? 0)) {
      fail(`Party agility snapshot for ${characterId} differs from the current Map author value`);
    }
  }
  for (const enemy of encounter.enemies ?? []) {
    if (enemyAgility.get(enemy.id) !== safeAgility(enemy.agility ?? 0, `Enemy ${enemy.id} author agility`)) {
      fail(`Enemy agility snapshot for ${enemy.id} differs from the current Encounter author value`);
    }
  }
  const preview = input.actionPreview;
  const sourcePreview = input.sourcePreview;
  if (!isRecord(preview) || !isRecord(sourcePreview) || preview.nodeId !== scope.nodeId
    || sourcePreview.nodeId !== scope.nodeId || preview.round !== scope.round || sourcePreview.round !== scope.round
    || preview.draftVersion !== sourcePreview.draftVersion) fail('Action and source previews must describe the same current draft');
  if (!Array.isArray(preview.preparedActions) || preview.preparedActions.length !== input.partyIds.length
    || preview.preparedActions.some((row, index) => row.characterId !== input.partyIds[index])) fail('Prepared Party rows must match fixed Party order');
  if (!Array.isArray(preview.preparedEnemyActions) || preview.preparedEnemyActions.length !== input.enemyIds.length
    || preview.preparedEnemyActions.some((row, index) => row.enemyId !== input.enemyIds[index])) fail('Prepared Enemy rows must match Encounter order');
  const actionById = new Map((definition.actions ?? []).map(action => [action.id, action]));
  if (actionById.size !== (definition.actions ?? []).length) fail('Map Action IDs must be unique');
  const cards = input.cards;
  if (!Array.isArray(cards)) fail('current Catalog cards must be an array');
  for (const card of cards) {
    const ref = isRecord(card) ? parseMapRunCardRef(card.ref) : null;
    if (!ref || ref.scope.runId !== scope.runId || ref.scope.mapId !== scope.mapId || ref.scope.nodeId !== scope.nodeId
      || ref.scope.activityId !== scope.activityId || ref.scope.round !== scope.round) fail('Catalog contains a malformed or out-of-scope CardRef');
  }

  const rows: GameplayBAg1ExecutionSource[] = [];
  const candidateByKey = new Map<string, GameplayBAg1SourceOrderCandidate>();
  const append = (sourceKind: GameplayBAg1ExecutionSourceKind, owner: GameplayBAg1ExecutionSource['owner'], actionId: string,
    cardRef: MapRunCardRef | null, target: GameplayBAg1ExecutionTarget, skipReason: 'noLegalTarget' | null,
    actorAgility: number, sideRank: 0 | 1, sourceRank: 0 | 1 | 2, ownerDeclarationIndex: number, logicalIndex: number,
    ownerOrSourceId: string | null) => {
    const action = actionById.get(actionId);
    if (!action) fail(`selected Action ${actionId} is not declared by this Map`);
    if (target.kind === 'actor' && target.actorId !== null
      && !(target.actorKind === 'partyCharacter' ? input.partyIds : input.enemyIds).includes(target.actorId)) {
      fail(`selected target ${target.actorId} is outside the current roster`);
    }
    if (target.kind === 'card' && target.cardRef) {
      const targetRef = parseMapRunCardRef(target.cardRef);
      if (!targetRef || targetRef.scope.runId !== scope.runId || targetRef.scope.mapId !== scope.mapId
        || targetRef.scope.nodeId !== scope.nodeId || targetRef.scope.activityId !== scope.activityId
        || targetRef.scope.round !== scope.round) fail('selected target CardRef is malformed or outside the current scope');
    }
    const baseAgility = safeAgility(action.agility?.base ?? 0, `Action ${actionId} base agility`);
    const maxAgility = safeAgility(action.agility?.max ?? 0, `Action ${actionId} max agility`);
    if (maxAgility < baseAgility) fail(`Action ${actionId} max agility is below base agility`);
    const finalAgility = actorAgility >= maxAgility - baseAgility ? maxAgility : baseAgility + actorAgility;
    const sourceKey = canonicalSourceKey(scope, sourceKind, ownerOrSourceId, actionId);
    const orderCandidate = Object.freeze({ sourceKey, finalAgility, baseAgility, sideRank, sourceRank, ownerDeclarationIndex, logicalIndex });
    if (candidateByKey.has(sourceKey)) fail(`duplicate source identity ${sourceKey}`);
    candidateByKey.set(sourceKey, orderCandidate);
    rows.push(Object.freeze({ sourceKey, sourceKind, owner: owner ? Object.freeze({ ...owner }) : null, actionId,
      cardRef, target: cloneTarget(target), skipReason, baseAgility, actorAgility, finalAgility, orderCandidate }));
  };

  input.partyIds.forEach((characterId, ownerDeclarationIndex) => {
    const row = preview.preparedActions[ownerDeclarationIndex];
    if (row.preparedActionId === null) return;
    if (!safeId(row.preparedActionId)) fail(`Prepared Party row ${characterId} has an invalid Action ID`);
    const zone = row.overrideKind === 'playerCommand' ? 'playerCommand' : 'hand';
    const logicalIndex = zone === 'playerCommand' ? row.handActionIds.length : row.handActionIds.indexOf(row.preparedActionId);
    if (logicalIndex < 0) fail(`Prepared Party row ${characterId} has no real Hand position`);
    const cardRef = findSourceCard(input, 'partyCharacter', characterId, row.preparedActionId, zone, logicalIndex);
    append('partyAction', { kind: 'partyCharacter', id: characterId }, row.preparedActionId, cardRef, actionTarget(row, 'partyCharacter', characterId),
      row.skipReason ?? null, partyAgility.get(characterId)!, 0, 0, ownerDeclarationIndex, logicalIndex, characterId);
  });
  input.enemyIds.forEach((enemyId, ownerDeclarationIndex) => {
    const row = preview.preparedEnemyActions[ownerDeclarationIndex];
    if (row.naturalActionId === null) return;
    if (!safeId(row.naturalActionId)) fail(`Prepared Enemy row ${enemyId} has an invalid Action ID`);
    const logicalIndex = row.handActionIds.indexOf(row.naturalActionId);
    if (logicalIndex < 0) fail(`Prepared Enemy row ${enemyId} has no real Hand position`);
    const cardRef = findSourceCard(input, 'enemy', enemyId, row.naturalActionId, 'hand', logicalIndex);
    append('enemyAction', { kind: 'enemy', id: enemyId }, row.naturalActionId, cardRef, actionTarget(row, 'enemy', enemyId),
      row.skipReason ?? null, enemyAgility.get(enemyId)!, 1, 0, ownerDeclarationIndex, logicalIndex, enemyId);
  });

  const selectedAbilityId = sourcePreview.selectedAbilityActionId;
  if (!Array.isArray(sourcePreview.abilityOptions)
    || sourcePreview.abilityOptions.filter(option => option.selected).length !== (selectedAbilityId === null ? 0 : 1)) {
    fail('Ability option selection does not match the selected Ability identity');
  }
  if (selectedAbilityId !== null) {
    if (!encounter.abilityActionIds?.includes(selectedAbilityId)) fail('selected Ability is not declared by the current Encounter');
    const optionRows = sourcePreview.abilityOptions.filter(option => option.actionId === selectedAbilityId && option.selected);
    if (optionRows.length !== 1) fail('selected Ability must have exactly one matching selected source option');
    const selectedTarget = sourcePreview.selectedAbilityTarget;
    if (!selectedTarget) fail('selected Ability must carry its selected target');
    append('ability', null, selectedAbilityId, null,
      { kind: 'actor', actorKind: selectedTarget.kind === 'partyCharacter' ? 'partyCharacter' : 'enemy',
        actorId: selectedTarget.kind === 'partyCharacter' ? selectedTarget.characterId : selectedTarget.enemyId },
      null, 0, 0, 1, 0, 0, null);
  } else if (sourcePreview.selectedAbilityTarget !== null) fail('unselected Ability cannot carry a target');

  const selectedItemId = sourcePreview.selectedItemId;
  if (!Array.isArray(sourcePreview.itemOptions)
    || sourcePreview.itemOptions.filter(option => option.selected).length !== (selectedItemId === null ? 0 : 1)) {
    fail('Item option selection does not match the selected Item identity');
  }
  if (selectedItemId !== null) {
    const mapping = encounter.itemActions?.find(row => row.itemId === selectedItemId);
    if (!mapping) fail('selected Item is not declared by the current Encounter');
    const optionRows = sourcePreview.itemOptions.filter(option => option.itemId === selectedItemId && option.actionId === mapping.actionId && option.selected);
    if (optionRows.length !== 1) fail('selected Item must have exactly one matching selected source option');
    const selectedTarget = sourcePreview.selectedItemTarget;
    if (!selectedTarget) fail('selected Item must carry its selected target');
    append('item', null, mapping.actionId, null,
      { kind: 'actor', actorKind: selectedTarget.kind === 'partyCharacter' ? 'partyCharacter' : 'enemy',
        actorId: selectedTarget.kind === 'partyCharacter' ? selectedTarget.characterId : selectedTarget.enemyId },
      null, 0, 0, 2, 0, 0, selectedItemId);
  } else if (sourcePreview.selectedItemTarget !== null) fail('unselected Item cannot carry a target');

  const orderedCandidates = resolveGameplayBAg1SourceOrder(rows.map(row => row.orderCandidate));
  const byKey = new Map(rows.map(row => [row.sourceKey, row]));
  return Object.freeze(orderedCandidates.map(candidate => {
    const row = byKey.get(candidate.sourceKey);
    if (!row) fail('sorted source identity has no source metadata');
    return row;
  }));
}
