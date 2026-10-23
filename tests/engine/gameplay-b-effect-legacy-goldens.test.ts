import { afterEach, describe, expect, test } from 'vitest';
import type { GameplayMapActionDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import type { GameplayMapEffectStatementDef } from '../../src/data-services/contracts/gameplay-map-effects';
import {
  commitCommand,
  createLegacyGoldenOwner,
  createLegacyGoldenRuntime,
  draftToken,
  LEGACY_GOLDEN_ITEM_ID,
  legacyGoldenMap,
} from './gameplay-b-effect-test-fixtures';

const games: ReturnType<typeof createLegacyGoldenRuntime>[] = [];

const damage = (amount: number): GameplayMapEffectStatementDef => ({ op: 'damage', target: 'primary', amount });
const heal = (amount: number): GameplayMapEffectStatementDef => ({ op: 'heal', target: 'primary', amount });
const teamResourceChange = (resourceId: string, delta: number): GameplayMapEffectStatementDef => ({
  op: 'resourceChange', account: 'sourceTeam', resourceId, delta,
});

function owner(map: GameplayMapDef, itemCount = 0) {
  const created = createLegacyGoldenOwner(map, itemCount);
  games.push(created.game);
  return created;
}

function currentView(game: ReturnType<typeof createLegacyGoldenRuntime>, runId: string) {
  const view = game.mapRun.getWorkspaceView(runId);
  if (view?.kind !== 'active' || !view.actionPreview) throw new Error('Expected an active MapRun preview');
  return view;
}

afterEach(() => {
  for (const game of games.splice(0)) game.dispose();
});

describe('Gameplay B migrated effect Program goldens', () => {
  test('OLD01: Owner Hand, pure Previews, ordered Program, receipt, Save/Load, and replay', () => {
    const map = legacyGoldenMap({
      id: 'test:map:legacy-old01',
      playerCost: 2,
      teamResources: [{ resourceId: 'ammo', value: 1 }],
      actions: [
        { id: 'shot', name: 'Shot', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
          costs: [{ scope: 'team', resourceId: 'ammo', amount: 1 }], effectProgram: { resolve: [damage(3)] } },
        { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter', preference: 'stableOrder' },
          effectProgram: { resolve: [damage(1)] } },
      ],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'shot', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] }],
      enemies: [
        { id: 'e1', initialHp: 5, maxHp: 10 },
        { id: 'e2', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
      ],
    });
    const { game, runId } = owner(map);
    const entered = game.mapRun.getSnapshot()!;
    expect(entered.activeEncounter?.randomState).toMatchObject({ seed: 0x08000000, cursor: 2 });
    expect(entered.activeEncounter?.hands.find(row => row.characterId === 'shiroko')?.actionIds).toEqual(['shot']);

    const before = game.mapRun.getSnapshot();
    const firstPreview = currentView(game, runId).actionPreview!;
    const secondPreview = currentView(game, runId).actionPreview!;
    expect(game.mapRun.getSnapshot()).toEqual(before);
    expect(secondPreview).toEqual(firstPreview);
    expect(firstPreview.preparedActions[0]).toMatchObject({
      naturalAction: { actionId: 'shot' }, preparedAction: { actionId: 'shot' }, targetEnemyId: 'e1',
    });
    expect(firstPreview.commitPreview).toMatchObject({ canCommit: true, playerCostRequired: 0 });
    const command = commitCommand(game, runId, 'old01-commit');
    const committed = game.commitMapEncounterRound(command);
    expect(committed).toMatchObject({
      playerCost: 2,
      teamResources: [{ resourceId: 'ammo', value: 0 }],
      activeEncounter: { enemies: [{ enemyId: 'e1', currentHp: 2 }, { enemyId: 'e2', currentHp: 10 }] },
    });
    expect(committed.lastEncounterCommit).toMatchObject({
      settlements: [
        { characterId: 'shiroko', actionId: 'shot', targetEnemyId: 'e1', playerCostSpent: 0,
          resourceChanges: [{ kind: 'cost', scope: 'team', resourceId: 'ammo', delta: -1 }],
          hpChanges: [{ scope: 'enemy', enemyId: 'e1', delta: -3 }] },
        { characterId: 'serika', actionId: null, playerCostSpent: 0, resourceChanges: [] },
      ],
      enemyActions: [
        { enemyId: 'e1', actionId: null, resourceChanges: [] },
        { enemyId: 'e2', actionId: 'enemy-hit', targetCharacterId: 'shiroko',
          hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -1 }] },
      ],
    });

    const save = game.save();
    const restored = createLegacyGoldenRuntime(map);
    games.push(restored);
    restored.load(save);
    expect(restored.mapRun.getSnapshot()).toEqual(committed);
    expect(restored.commitMapEncounterRound(command)).toEqual(committed);
  });

  test('EQ02: old prepare discounts add and cap at the selected CardRef original sCost', () => {
    const party = ['shiroko', 'serika', 'hoshino'];
    const actions: GameplayMapActionDef[] = [
      { id: 'shot', name: 'Shot', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
        costs: [{ scope: 'actor', resourceId: 'sCost', amount: 2 }], effectProgram: { resolve: [damage(2)] } },
      ...['serika', 'hoshino'].map((characterId, index) => ({
        id: `discount-${index + 1}`, name: 'Discount', eligibleCharacterIds: [characterId],
        target: { kind: 'card' as const, side: 'ally' as const },
        effectProgram: { prepare: [{ op: 'discountSCost' as const, amount: index + 1 }] },
      })),
      { id: 'ability-hit', name: 'Ability Hit', eligibleCharacterIds: [], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(1)] } },
      { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter', preference: 'stableOrder' }, effectProgram: { resolve: [damage(2)] } },
    ];
    const map = legacyGoldenMap({
      id: 'test:map:legacy-eq02', partyCharacterIds: party, partyHp: { serika: 2 }, playerCost: 4,
      actorResources: [{ characterId: 'shiroko', resourceId: 'sCost', value: 2 }],
      actions,
      participants: party.map((characterId, index) => ({ characterId,
        actions: [{ actionId: index === 0 ? 'shot' : `discount-${index}`, tendencyWeight: 1 }] })),
      enemies: [
        { id: 'e1', initialHp: 20, maxHp: 20, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
        { id: 'e2', initialHp: 20, maxHp: 20 },
      ],
      abilityActionIds: ['ability-hit'],
    });
    const { game, runId } = owner(map);
    game.setMapAbilityDraft(runId, 'ability-hit', { kind: 'enemy', enemyId: 'e1' }, draftToken(game, runId));
    const preview = currentView(game, runId).actionPreview!;
    const discounts = preview.preparedActions.filter(row => row.characterId !== 'shiroko');
    expect(discounts).toHaveLength(2);
    const shotCard = currentView(game, runId).cards.find(card => card.owner.kind === 'partyCharacter'
      && card.owner.id === 'shiroko' && card.actionId === 'shot')?.ref;
    expect(shotCard).toBeDefined();
    expect(discounts.map(row => row.targetCard)).toEqual([shotCard, shotCard]);
    expect(preview.commitPreview).toMatchObject({ canCommit: true, playerCostRequired: 1 });
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'eq02-commit'));
    expect(committed.playerCost).toBe(3);
    expect(committed.lastEncounterCommit?.settlements[0]?.scostCost).toEqual({ original: 2, discount: 2, paid: 0 });
    expect(committed.actorResources).toContainEqual({ characterId: 'shiroko', resourceId: 'sCost', value: 2 });
    expect(committed.lastEncounterCommit?.settlements.slice(1).map(row => row.actionId)).toEqual(['discount-1', 'discount-2']);
    expect(committed.lastEncounterCommit?.ability).toMatchObject({ actionId: 'ability-hit', playerCostSpent: 1 });
    expect(committed.lastEncounterCommit?.enemyActions).toContainEqual(expect.objectContaining({
      enemyId: 'e1', actionId: 'enemy-hit', targetCharacterId: 'shiroko',
      hpChanges: [{ scope: 'party', characterId: 'shiroko', delta: -2 }],
    }));
  });

  test.each([
    { label: 'locked target keeps the defeated identity and records zero HP delta', lock: true, expectedEnemy: 'e1', expectedDelta: 0 },
    { label: 'automatic target falls back to the next living Enemy', lock: false, expectedEnemy: 'e2', expectedDelta: -3 },
  ])('EQ03: $label', ({ lock, expectedEnemy, expectedDelta }) => {
    const map = legacyGoldenMap({
      id: `test:map:legacy-eq03-${lock ? 'locked' : 'auto'}`,
      actorResources: ['shiroko', 'serika'].map(characterId => ({ characterId, resourceId: 'ammo', value: 1 })),
      actions: [
        { id: 'kill', name: 'Kill', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
          costs: [{ scope: 'actor', resourceId: 'ammo', amount: 1 }], effectProgram: { resolve: [damage(3)] } },
        { id: 'follow', name: 'Follow', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' },
          costs: [{ scope: 'actor', resourceId: 'ammo', amount: 1 }], effectProgram: { resolve: [damage(3)] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'kill', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'follow', tendencyWeight: 1 }] },
      ],
      enemies: [{ id: 'e1', initialHp: 3, maxHp: 10 }, { id: 'e2', initialHp: 5, maxHp: 10 }],
    });
    const { game, runId } = owner(map);
    if (lock) game.setMapPreparedEnemyTarget(runId, 'serika', 'e1', draftToken(game, runId));
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, `eq03-${lock}`));
    expect(committed.activeEncounter?.enemies).toEqual([
      { enemyId: 'e1', currentHp: 0 },
      { enemyId: 'e2', currentHp: expectedDelta === 0 ? 5 : 2 },
    ]);
    expect(committed.lastEncounterCommit?.settlements[1]).toMatchObject({
      targetEnemyId: expectedEnemy,
      resourceChanges: [{ kind: 'cost', scope: 'actor', characterId: 'serika', resourceId: 'ammo', delta: -1 }],
      hpChanges: [{ scope: 'enemy', enemyId: expectedEnemy, delta: expectedDelta }],
    });
  });

  test('EQ04: natural noLegalTarget skip waives Action cost and ordered Program effects', () => {
    const map = legacyGoldenMap({
      id: 'test:map:legacy-eq04-natural', teamResources: [{ resourceId: 'supplies', value: 1 }],
      actions: [
        { id: 'kill', name: 'Kill', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(3)] } },
        { id: 'miss', name: 'Miss', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' },
          costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
          effectProgram: { resolve: [damage(1), teamResourceChange('supplies', 1)] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'kill', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'miss', tendencyWeight: 1 }] },
      ],
      enemies: [{ id: 'e1', initialHp: 3, maxHp: 3 }],
    });
    const { game, runId } = owner(map);
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'eq04-natural'));
    expect(committed.lastEncounterCommit?.settlements[1]).toMatchObject({
      actionId: 'miss', skipReason: 'noLegalTarget', playerCostSpent: 0, resourceChanges: [],
    });
    expect(committed.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
  });

  test('EQ04: selected PlayerCommand skip keeps its separate PlayerCost but waives Action costs', () => {
    const commandActions = ['command-a', 'command-b', 'command-c'];
    const map = legacyGoldenMap({
      id: 'test:map:legacy-eq04-command', playerCost: 1,
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      actions: [
        { id: 'kill', name: 'Kill', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(3)] } },
        { id: 'natural', name: 'Natural', eligibleCharacterIds: ['serika'], target: { kind: 'enemy' },
          costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }] },
        ...commandActions.map(id => ({ id, name: id, eligibleCharacterIds: ['serika'], target: { kind: 'enemy' as const },
          costs: [{ scope: 'team' as const, resourceId: 'supplies', amount: 1 }], effectProgram: { resolve: [damage(1)] } })),
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'kill', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'natural', tendencyWeight: 1 }, ...commandActions.map(actionId => ({ actionId, tendencyWeight: 1 }))] },
      ],
      enemies: [{ id: 'e1', initialHp: 3, maxHp: 3 }],
    });
    const { game, runId } = owner(map);
    const preview = currentView(game, runId).actionPreview!;
    const commandOption = preview.playerCommandOptions.find(option => option.characterId === 'serika' && option.canPayActionCosts);
    if (!commandOption) throw new Error('Owner preview did not expose a payable PlayerCommand candidate');
    game.issueMapPlayerCommand(runId, 'serika', commandOption.action.actionId, draftToken(game, runId));
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'eq04-command'));
    expect(committed.lastEncounterCommit?.settlements[1]).toMatchObject({
      actionId: commandOption.action.actionId, overrideKind: 'playerCommand', playerCostSpent: 1,
      resourceChanges: [], skipReason: 'noLegalTarget',
    });
    expect(committed.playerCost).toBe(0);
    expect(committed.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
  });

  test.each([
    { skip: 'unaffordable', id: 'e2', initialFuel: 1, drain: true },
    { skip: 'defeated', id: 'e1', initialFuel: 1, drain: false },
  ] as const)('EQ04: Enemy $skip is an independent free source skip', ({ skip, id, initialFuel, drain }) => {
    const actions: GameplayMapActionDef[] = [
      { id: 'party-kill', name: 'Party Kill', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(5)] } },
      { id: 'enemy-cost', name: 'Enemy Cost', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
        costs: [{ scope: 'team', resourceId: 'fuel', amount: 1 }] },
      ...(!drain ? [{ id: 'enemy-free', name: 'Enemy Free', eligibleCharacterIds: [], target: { kind: 'partyCharacter' as const } }] : []),
      ...(drain ? [{ id: 'enemy-drain', name: 'Enemy Drain', eligibleCharacterIds: [], target: { kind: 'none' as const },
        effectProgram: { resolve: [teamResourceChange('fuel', -1)] } }] : []),
    ];
    const map = legacyGoldenMap({
      id: `test:map:legacy-eq04-enemy-${skip}`, teamResources: [{ resourceId: 'unused', value: 0 }],
      actions, participants: [{ characterId: 'shiroko', actions: [{ actionId: 'party-kill', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] }],
      enemyTeamResources: [{ resourceId: 'fuel', value: initialFuel }],
      enemies: drain
        ? [
          { id: 'e1', initialHp: 20, maxHp: 20, actions: [{ actionId: 'enemy-drain', tendencyWeight: 1 }] },
          { id: 'e2', initialHp: 20, maxHp: 20, actions: [{ actionId: 'enemy-cost', tendencyWeight: 1 }] },
        ]
        : [
          { id: 'e1', initialHp: 5, maxHp: 5, actions: [{ actionId: 'enemy-cost', tendencyWeight: 1 }] },
          { id: 'e2', initialHp: 20, maxHp: 20, actions: [{ actionId: 'enemy-free', tendencyWeight: 1 }] },
        ],
    });
    const { game, runId } = owner(map);
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, `eq04-enemy-${skip}`));
    const enemyActions = committed.lastEncounterCommit?.enemyActions ?? [];
    expect(enemyActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ enemyId: id, actionId: 'enemy-cost', skipReason: skip, resourceChanges: [] }),
    ]));
    if (skip === 'unaffordable') {
      expect(enemyActions[0]).toMatchObject({ enemyId: 'e1', actionId: 'enemy-drain' });
      expect(enemyActions[1]).toMatchObject({ enemyId: 'e2', actionId: 'enemy-cost', skipReason: 'unaffordable', resourceChanges: [] });
      expect(committed.activeEncounter?.enemyTeamResources).toEqual([{ resourceId: 'fuel', value: 0 }]);
      expect(enemyActions[1]).not.toHaveProperty('hpChanges');
    } else {
      expect(enemyActions[0]).toMatchObject({ enemyId: 'e1', actionId: 'enemy-cost', skipReason: 'defeated', resourceChanges: [] });
      expect(enemyActions[0]).not.toHaveProperty('hpChanges');
      expect(enemyActions[1]).toMatchObject({ enemyId: 'e2', actionId: 'enemy-free' });
      expect(committed.activeEncounter?.enemyTeamResources).toEqual([{ resourceId: 'fuel', value: 1 }]);
    }
  });

  test('EQ04: roundEnded belongs to a live Enemy after an earlier source defeats the full Party', () => {
    const map = legacyGoldenMap({
      id: 'test:map:legacy-eq04-round-ended', partyCharacterIds: ['shiroko'], partyHp: { shiroko: 1 },
      actions: [{ id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
        costs: [{ scope: 'team', resourceId: 'fuel', amount: 1 }], effectProgram: { resolve: [damage(2)] } }],
      participants: [{ characterId: 'shiroko', actions: [] }],
      enemyTeamResources: [{ resourceId: 'fuel', value: 2 }],
      enemies: [
        { id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
        { id: 'e2', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
      ],
    });
    const { game, runId } = owner(map);
    const failed = game.commitMapEncounterRound(commitCommand(game, runId, 'eq04-round-ended'));
    expect(failed.status).toBe('failure');
    expect(failed.lastEncounterCommit?.enemyActions).toMatchObject([
      { enemyId: 'e1', actionId: 'enemy-hit', targetCharacterId: 'shiroko',
        resourceChanges: [{ kind: 'cost', resourceId: 'fuel', delta: -1 }], hpChanges: [{ delta: -1 }] },
      { enemyId: 'e2', actionId: 'enemy-hit', skipReason: 'roundEnded', resourceChanges: [] },
    ]);
    const enemyActions = failed.lastEncounterCommit?.enemyActions ?? [];
    expect(enemyActions[1]).not.toHaveProperty('hpChanges');
    expect(failed.lastEncounterCommit?.enemyActions?.[0]?.resourceChanges).toHaveLength(1);
  });

  test('EQ04 Skip补全: Enemy card target with no legal CardRef skips before its payable cost', () => {
    const map = legacyGoldenMap({
      id: 'test:map:legacy-enemy-no-card-target',
      actions: [
        { id: 'enemy-card', name: 'Enemy Card', eligibleCharacterIds: [], target: { kind: 'card', side: 'self' },
          costs: [{ scope: 'team', resourceId: 'fuel', amount: 1 }],
          effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }] } },
      ],
      participants: [{ characterId: 'shiroko', actions: [] }, { characterId: 'serika', actions: [] }],
      enemyTeamResources: [{ resourceId: 'fuel', value: 1 }],
      enemies: [{ id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-card', tendencyWeight: 1 }] },
        { id: 'e2', initialHp: 10, maxHp: 10 }],
    });
    const { game, runId } = owner(map);
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'eq04-no-card-target'));
    const enemyActions = committed.lastEncounterCommit?.enemyActions ?? [];
    expect(enemyActions[0]).toMatchObject({
      enemyId: 'e1', actionId: 'enemy-card', skipReason: 'noLegalTarget', resourceChanges: [],
    });
    expect(committed.activeEncounter?.enemyTeamResources).toEqual([{ resourceId: 'fuel', value: 1 }]);
  });

  test('Program source order: Ability and Item still charge after a party kill; Item debit and request replay are atomic', () => {
    const map = legacyGoldenMap({
      id: 'test:map:legacy-source-order', playerCost: 1,
      actions: [
        { id: 'kill', name: 'Kill', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(5)] } },
        { id: 'ability-hit', name: 'Ability Hit', eligibleCharacterIds: [], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(1)] } },
        { id: 'item-hit', name: 'Item Hit', eligibleCharacterIds: [], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(1)] } },
        { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, effectProgram: { resolve: [damage(1)] } },
      ],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'kill', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] }],
      enemies: [
        { id: 'e1', initialHp: 5, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] },
      ],
      abilityActionIds: ['ability-hit'],
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-hit' }],
      itemCount: 1,
    });
    const { game, runId } = owner(map, 1);
    game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
    game.setMapAbilityDraft(runId, 'ability-hit', { kind: 'enemy', enemyId: 'e1' }, draftToken(game, runId));
    game.setMapItemDraft(runId, LEGACY_GOLDEN_ITEM_ID, { kind: 'enemy', enemyId: 'e1' }, draftToken(game, runId));
    const command = commitCommand(game, runId, 'source-order-commit');
    const committed = game.commitMapEncounterRound(command);
    expect(committed.lastEncounterCommit?.settlements[0]?.hpChanges).toEqual([{ scope: 'enemy', enemyId: 'e1', delta: -5 }]);
    expect(committed.lastEncounterCommit?.ability).toMatchObject({
      actionId: 'ability-hit', playerCostSpent: 1, hpChanges: [{ scope: 'enemy', enemyId: 'e1', delta: 0 }],
    });
    expect(committed.lastEncounterCommit?.item).toMatchObject({
      itemId: LEGACY_GOLDEN_ITEM_ID, consumedCount: 1, hpChanges: [{ scope: 'enemy', enemyId: 'e1', delta: 0 }],
    });
    expect(committed.lastEncounterCommit?.enemyActions).toEqual([
      { enemyId: 'e1', actionId: 'enemy-hit', skipReason: 'defeated', resourceChanges: [] },
    ]);
    expect(game.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBeUndefined();

    const save = game.save();
    const restored = createLegacyGoldenRuntime(map, 1);
    games.push(restored);
    restored.load(save);
    expect(restored.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBeUndefined();
    expect(restored.commitMapEncounterRound(command)).toEqual(committed);
    expect(restored.state.inventory[LEGACY_GOLDEN_ITEM_ID]).toBeUndefined();
  });

  test('Program sources resolve Party Action, Ability, Item, then Enemy with clamped HP deltas', () => {
    const map = legacyGoldenMap({
      id: 'test:map:legacy-source-phases', playerCost: 1,
      actions: [
        { id: 'party-hit-self', name: 'Party Hit Self', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'partyCharacter', preference: 'stableOrder' }, effectProgram: { resolve: [damage(1)] } },
        { id: 'ability-heal', name: 'Ability Heal', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter' }, effectProgram: { resolve: [heal(3)] } },
        { id: 'item-hit', name: 'Item Hit', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter' }, effectProgram: { resolve: [damage(2)] } },
        { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [],
          target: { kind: 'partyCharacter' }, effectProgram: { resolve: [damage(1)] } },
      ],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'party-hit-self', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] }],
      enemies: [{ id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] }],
      abilityActionIds: ['ability-heal'],
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'item-hit' }],
    });
    const { game, runId } = owner(map, 1);
    game.mutations.addItem(LEGACY_GOLDEN_ITEM_ID, 1, 3);
    game.setMapAbilityDraft(runId, 'ability-heal', { kind: 'partyCharacter', characterId: 'shiroko' }, draftToken(game, runId));
    game.setMapItemDraft(runId, LEGACY_GOLDEN_ITEM_ID, { kind: 'partyCharacter', characterId: 'shiroko' }, draftToken(game, runId));
    const committed = game.commitMapEncounterRound(commitCommand(game, runId, 'source-phases'));
    expect(committed.partyHp).toContainEqual({ characterId: 'shiroko', currentHp: 7 });
    expect(committed.lastEncounterCommit?.settlements[0]?.hpChanges).toEqual([
      { scope: 'party', characterId: 'shiroko', delta: -1 },
    ]);
    expect(committed.lastEncounterCommit?.ability?.hpChanges).toEqual([
      { scope: 'party', characterId: 'shiroko', delta: 1 },
    ]);
    expect(committed.lastEncounterCommit?.item?.hpChanges).toEqual([
      { scope: 'party', characterId: 'shiroko', delta: -2 },
    ]);
    expect(committed.lastEncounterCommit?.enemyActions?.[0]?.hpChanges).toEqual([
      { scope: 'party', characterId: 'shiroko', delta: -1 },
    ]);
  });

  test('Program save continuation: a restored active MapRun can Commit the next real Owner round', () => {
    const map = legacyGoldenMap({
      id: 'test:map:legacy-save-continue',
      actions: [
        { id: 'wait-hit', name: 'Wait Hit', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' }, effectProgram: { resolve: [damage(1)] } },
        { id: 'enemy-hit', name: 'Enemy Hit', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, effectProgram: { resolve: [damage(1)] } },
      ],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'wait-hit', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] }],
      enemies: [{ id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-hit', tendencyWeight: 1 }] }],
    });
    const { game, runId } = owner(map);
    const first = game.commitMapEncounterRound(commitCommand(game, runId, 'save-continue-first'));
    expect(first.activeEncounter?.round).toBe(2);
    const restored = createLegacyGoldenRuntime(map);
    games.push(restored);
    restored.load(game.save());
    expect(restored.mapRun.getSnapshot()?.activeEncounter?.round).toBe(2);
    const second = restored.commitMapEncounterRound(commitCommand(restored, runId, 'save-continue-second'));
    expect(second.activeEncounter?.round).toBe(3);
    expect(second.lastEncounterCommit?.requestId).toBe('save-continue-second');
  });
});
