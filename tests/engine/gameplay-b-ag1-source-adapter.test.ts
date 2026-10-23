import { describe, expect, test } from 'vitest';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import type { MapRunCardInstance } from '../../src/arona-clicker/contracts/map/map-cards';
import type { MapRunEncounterSourcePreview } from '../../src/arona-clicker/contracts/map/map-run';
import type { GameplayBActionPreview } from '../../src/arona-clicker/services/map/gameplay-b-action-preview-resolver';
import { buildGameplayBAg1ExecutionSources } from '../../src/arona-clicker/services/map/gameplay-b-ag1-source-adapter';

const scope = { runId: 'run-1', mapId: 'test:map:ag1', nodeId: 'battle', activityId: null, round: 3 } as const;
const map: GameplayMapDef = {
  id: scope.mapId,
  name: 'AG-1 fixture',
  resumeVersion: 1,
  executionContractId: 'AG-1',
  startNodeId: scope.nodeId,
  exitNodeIds: [],
  partyCharacterIds: ['p1', 'p2'],
  partyAgility: [{ characterId: 'p1', agility: 3 }],
  initialPartyHp: [{ characterId: 'p1', initialHp: 10, maxHp: 10 }, { characterId: 'p2', initialHp: 10, maxHp: 10 }],
  initialPlayerCost: 4,
  actions: [
    { id: 'a', name: 'A', eligibleCharacterIds: ['p1', 'p2'], agility: { base: 2, max: 7 }, target: { kind: 'none' } },
    { id: 'b', name: 'B', eligibleCharacterIds: ['p1', 'p2'], agility: { base: 5, max: Number.MAX_SAFE_INTEGER }, target: { kind: 'none' } },
    { id: 'ability', name: 'Ability', eligibleCharacterIds: [], agility: { base: 3, max: 4 }, target: { kind: 'partyCharacter' } },
    { id: 'item-action', name: 'Item', eligibleCharacterIds: [], target: { kind: 'enemy' } },
    { id: 'enemy-action', name: 'Enemy Action', eligibleCharacterIds: [], agility: { base: 1, max: 3 }, target: { kind: 'partyCharacter' } },
  ],
  nodes: [{ id: scope.nodeId, title: 'Battle', encounter: {
    title: 'Battle',
    enemies: [{ id: 'e1', initialHp: 10, maxHp: 10 }],
    abilityActionIds: ['ability'],
    itemActions: [{ itemId: 'potion', actionId: 'item-action' }],
    participants: [],
  } }],
  edges: [],
};

function card(ownerKind: 'partyCharacter' | 'enemy', ownerId: string, actionId: string, zone: 'hand' | 'playerCommand', logicalIndex: number): MapRunCardInstance {
  return {
    ref: { kind: 'card', id: JSON.stringify([zone, ownerKind, ownerId, actionId]), scope },
    owner: { kind: ownerKind, id: ownerId }, zone, actionId, logicalIndex, prepared: true,
    controllable: ownerKind === 'partyCharacter',
  };
}

function input(options: {
  p1Action?: string | null;
  p1Override?: 'swap' | 'playerCommand' | null;
  p1Hand?: readonly string[];
  enemyAction?: string | null;
  ability?: boolean;
  item?: boolean;
  cardRows?: readonly MapRunCardInstance[];
} = {}) {
  const p1Action = options.p1Action === undefined ? 'a' : options.p1Action;
  const actionPreview = {
    nodeId: scope.nodeId, round: scope.round, draftVersion: 9, overrides: [],
    preparedActions: [
      { characterId: 'p1', handActionIds: options.p1Hand ?? ['a', 'b'], naturalActionId: 'a', preparedActionId: p1Action,
        actionName: p1Action, actionDescription: null, targetKind: 'none', legalTargetCharacterIds: [], targetCharacterId: null,
        targetSelectionRequired: false, skipReason: p1Action === 'b' ? 'noLegalTarget' : undefined,
        overrideKind: options.p1Override ?? null, playerCost: options.p1Override === 'playerCommand' ? 1 : 0 },
      { characterId: 'p2', handActionIds: [], naturalActionId: null, preparedActionId: null, actionName: null,
        actionDescription: null, targetKind: null, legalTargetCharacterIds: [], targetCharacterId: null,
        targetSelectionRequired: false, overrideKind: null, playerCost: 0 },
    ],
    preparedEnemyActions: [{ enemyId: 'e1', handActionIds: options.enemyAction ? [options.enemyAction] : [],
      naturalActionId: options.enemyAction ?? null, actionName: options.enemyAction, actionDescription: null,
      targetKind: options.enemyAction ? 'partyCharacter' : null, legalTargetCharacterIds: options.enemyAction ? ['p1'] : [],
      legalTargetEnemyIds: [], targetCharacterId: options.enemyAction ? 'p1' : null, targetEnemyId: null, targetSelectionRequired: false }],
    playerCommandOptions: [],
  } as unknown as GameplayBActionPreview;
  const sourcePreview = {
    nodeId: scope.nodeId, round: scope.round, draftVersion: 9,
    selectedAbilityActionId: options.ability ? 'ability' : null,
    selectedAbilityTarget: options.ability ? { kind: 'partyCharacter', characterId: 'p2' } : null,
    selectedItemId: options.item ? 'potion' : null,
    selectedItemTarget: options.item ? { kind: 'enemy', enemyId: 'e1' } : null,
    abilityOptions: options.ability ? [{ actionId: 'ability', name: 'Ability', description: null,
      targetKind: 'partyCharacter', legalTargetCharacterIds: ['p2'], legalTargetEnemyIds: [],
      canPayPlayerCost: true, selected: true }] : [],
    itemOptions: options.item ? [{ itemId: 'potion', actionId: 'item-action', name: 'Item', description: null,
      targetKind: 'enemy', legalTargetCharacterIds: [], legalTargetEnemyIds: ['e1'], itemName: 'Potion',
      itemDescription: null, inventoryCount: 1, useConditionSatisfied: true, canUse: true, selected: true }] : [],
  } as unknown as MapRunEncounterSourcePreview;
  const rows = options.cardRows ?? [
    ...(p1Action === null ? [] : [card('partyCharacter', 'p1', p1Action,
      options.p1Override === 'playerCommand' ? 'playerCommand' : 'hand',
      options.p1Override === 'playerCommand' ? (options.p1Hand ?? ['a', 'b']).length : (options.p1Hand ?? ['a', 'b']).indexOf(p1Action))]),
    ...(options.enemyAction ? [card('enemy', 'e1', options.enemyAction, 'hand', 0)] : []),
  ];
  return {
    scope, definition: map, partyIds: ['p1', 'p2'], enemyIds: ['e1'],
    partyAgility: [{ characterId: 'p1', agility: 3 }, { characterId: 'p2', agility: 0 }],
    enemyAgility: [{ enemyId: 'e1', agility: 0 }], actionPreview, sourcePreview, cards: rows,
  };
}

describe('AG-1 actual source adapter', () => {
  test('uses only the final selected Party source and computes capped agility without overflowing', () => {
    const candidate = input({ p1Action: 'b', p1Override: 'swap' });
    candidate.partyAgility[0].agility = Number.MAX_SAFE_INTEGER;
    candidate.definition = { ...map, partyAgility: [{ characterId: 'p1', agility: Number.MAX_SAFE_INTEGER }] };
    const result = buildGameplayBAg1ExecutionSources(candidate);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sourceKind: 'partyAction', actionId: 'b', skipReason: 'noLegalTarget',
      baseAgility: 5, actorAgility: Number.MAX_SAFE_INTEGER, finalAgility: Number.MAX_SAFE_INTEGER, orderCandidate: {
        sideRank: 0, sourceRank: 0, ownerDeclarationIndex: 0, logicalIndex: 1,
      } });
    expect(result[0].cardRef?.id).toBe(JSON.stringify(['hand', 'partyCharacter', 'p1', 'b']));
  });

  test('uses the real PlayerCommand zone and index, and ignores unused Hand candidates', () => {
    const result = buildGameplayBAg1ExecutionSources(input({ p1Action: 'b', p1Override: 'playerCommand' }));
    expect(result).toHaveLength(1);
    expect(result[0].cardRef).toMatchObject({ id: JSON.stringify(['playerCommand', 'partyCharacter', 'p1', 'b']) });
    expect(result[0].orderCandidate.logicalIndex).toBe(2);
  });

  test('keeps one natural Party source and the actual Enemy Hand selection', () => {
    const result = buildGameplayBAg1ExecutionSources(input({ enemyAction: 'enemy-action' }));
    expect(result.map(row => [row.sourceKind, row.owner?.id, row.actionId])).toEqual([
      ['partyAction', 'p1', 'a'], ['enemyAction', 'e1', 'enemy-action'],
    ]);
    expect(result[1].cardRef?.id).toBe(JSON.stringify(['hand', 'enemy', 'e1', 'enemy-action']));
    expect(result[1].orderCandidate).toMatchObject({ sideRank: 1, sourceRank: 0, ownerDeclarationIndex: 0, logicalIndex: 0 });
  });

  test('adds selected Ability and Item as actorless sources without fabricated CardRefs', () => {
    const result = buildGameplayBAg1ExecutionSources(input({ p1Action: null, ability: true, item: true }));
    expect(result.map(row => row.sourceKind)).toEqual(['ability', 'item']);
    expect(result.map(row => row.cardRef)).toEqual([null, null]);
    expect(result.map(row => row.orderCandidate.sourceRank)).toEqual([1, 2]);
    expect(result.map(row => row.finalAgility)).toEqual([3, 0]);
    expect(result[0].sourceKey).toBe(JSON.stringify(['run-1', scope.mapId, scope.nodeId, null, 3, 'ability', null, 'ability']));
  });

  test('rejects fake, mismatched-scope, and ambiguous CardRefs', () => {
    const fake = card('partyCharacter', 'p1', 'a', 'hand', 0);
    expect(() => buildGameplayBAg1ExecutionSources(input({ cardRows: [{ ...fake, ref: { ...fake.ref, id: 'fake-card' } }] }))).toThrow(/canonical current-scope/);
    expect(() => buildGameplayBAg1ExecutionSources(input({ cardRows: [{ ...fake, ref: { ...fake.ref, scope: { ...scope, round: 2 } } }] }))).toThrow(/out-of-scope/);
    expect(() => buildGameplayBAg1ExecutionSources(input({ cardRows: [fake, fake] }))).toThrow(/matching prepared Catalog cards/);
  });

  test('compares U03 agility snapshots with sparse Map and Enemy author values', () => {
    const defaults = input({ p1Action: null });
    expect(buildGameplayBAg1ExecutionSources(defaults)).toEqual([]);

    const partyDrift = input({ p1Action: null });
    partyDrift.definition = { ...map, partyAgility: [{ characterId: 'p1', agility: 4 }] };
    expect(() => buildGameplayBAg1ExecutionSources(partyDrift)).toThrow(/Party agility snapshot for p1 differs/);

    const enemyDrift = input({ p1Action: null });
    enemyDrift.definition = { ...map, nodes: [{ id: scope.nodeId, title: 'Battle', encounter: {
      ...map.nodes[0].encounter!, enemies: [{ id: 'e1', initialHp: 10, maxHp: 10, agility: 2 }],
    } }] };
    expect(() => buildGameplayBAg1ExecutionSources(enemyDrift)).toThrow(/Enemy agility snapshot for e1 differs/);

    const matching = input({ p1Action: null });
    matching.definition = { ...map, partyAgility: [{ characterId: 'p1', agility: 3 }] };
    matching.enemyAgility[0].agility = 0;
    expect(buildGameplayBAg1ExecutionSources(matching)).toEqual([]);
  });

  test('rejects agility snapshot rows with extra fields or accessors', () => {
    const withExtra = input({ p1Action: null });
    withExtra.partyAgility[0] = { characterId: 'p1', agility: 3, injected: true } as never;
    expect(() => buildGameplayBAg1ExecutionSources(withExtra)).toThrow(/Party agility snapshot identity\/order or fields/);

    const withGetter = input({ p1Action: null });
    const getterRow = Object.defineProperty({ characterId: 'p1' }, 'agility', { enumerable: true, get: () => 3 });
    withGetter.partyAgility[0] = getterRow as never;
    expect(() => buildGameplayBAg1ExecutionSources(withGetter)).toThrow(/Party agility snapshot identity\/order or fields/);
  });
});
