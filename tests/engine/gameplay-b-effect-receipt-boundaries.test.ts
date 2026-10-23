import { afterEach, describe, expect, test } from 'vitest';
import type { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import {
  validateMapEffectCommitReceipt,
  type MapEffectReceiptBalances,
} from '../../src/arona-clicker/services/map/map-effect-receipt-validator';
import {
  createLegacyGoldenOwner,
  commitCommand,
  draftToken,
  legacyGoldenMap,
} from './gameplay-b-effect-test-fixtures';

type OwnerReceipt = {
  readonly receipt: any;
  readonly runId: string;
  readonly current: any | null;
  readonly currentBalances: MapEffectReceiptBalances;
  readonly playerCost: number;
};

const games: GameInstance[] = [];

function createOwner(definition: GameplayMapDef) {
  const owner = createLegacyGoldenOwner(definition);
  games.push(owner.game);
  return owner;
}

function withEncounterLocals(definition: GameplayMapDef, locals: any): GameplayMapDef {
  return {
    ...definition,
    nodes: definition.nodes.map(node => node.encounter
      ? { ...node, encounter: { ...node.encounter, locals } }
      : node),
  };
}

function commitOwner(game: GameInstance, runId: string, requestId: string): OwnerReceipt {
  const snapshot = game.commitMapEncounterRound(commitCommand(game, runId, requestId));
  if (!snapshot.lastEncounterCommit) throw new Error('Expected a real Owner-generated E1 Receipt');
  const current = snapshot.activeEncounter
    ? { ...snapshot.activeEncounter, partyHp: snapshot.partyHp }
    : null;
  return {
    receipt: snapshot.lastEncounterCommit,
    runId,
    current,
    playerCost: snapshot.playerCost,
    currentBalances: {
      partyActor: snapshot.actorResources,
      partyTeam: snapshot.teamResources,
      enemyActor: snapshot.activeEncounter?.enemyActorResources,
      enemyTeam: snapshot.activeEncounter?.enemyTeamResources,
    },
  };
}

function validateOwnerReceipt(
  definition: GameplayMapDef,
  result: OwnerReceipt,
  receipt = result.receipt,
  current = result.current,
  currentBalances = result.currentBalances,
) {
  const node = definition.nodes.find(row => row.id === receipt.nodeId);
  const encounter = receipt.activityId
    ? node?.activities?.find(activity => activity.id === receipt.activityId)?.encounter
    : node?.encounter;
  if (!encounter) throw new Error('Receipt did not resolve to an Encounter in its Map');
  return validateMapEffectCommitReceipt(receipt, {
    runId: result.runId,
    map: definition,
    encounter,
    currentEncounter: current,
    currentBalances,
  });
}

function expectNoEnemyVisits(receipt: any, enemyId: string) {
  expect(receipt.programVisits.filter((visit: any) => visit.source?.kind === 'enemy' && visit.source.id === enemyId)).toEqual([]);
  expect(receipt.effectTrace.filter((entry: any) => entry.source?.kind === 'enemy' && entry.source.id === enemyId)).toEqual([]);
}

afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

describe('Gameplay B E1 receipt boundary validation', () => {
  test('combines program prepare sources on a real PlayerCommand CardRef, caps sCost, and preserves PlayerCost', () => {
    const programTargetIds = ['program-target-1', 'program-target-2', 'program-target-3', 'program-target-4'];
    const definition = legacyGoldenMap({
      id: 'test:map:receipt-prepare-boundary',
      playerCost: 4,
      actorResources: [{ characterId: 'serika', resourceId: 'sCost', value: 3 }],
      actions: [
        ...programTargetIds.map(id => ({ id, name: 'Prepared Target', eligibleCharacterIds: ['serika'],
          target: { kind: 'card' as const, side: 'ally' as const },
          costs: [{ scope: 'actor' as const, resourceId: 'sCost', amount: 3 }],
          effectProgram: { prepare: [{ op: 'discountSCost' as const, amount: 2 }], resolve: [] } })),
        { id: 'program-prepare', name: 'Program Prepare', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'card', side: 'ally' }, effectProgram: { prepare: [{ op: 'discountSCost', amount: 2 }] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'program-prepare', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: programTargetIds.map(actionId => ({ actionId, tendencyWeight: 1 })) },
      ],
      enemies: [{ id: 'robot', initialHp: 10, maxHp: 10, actions: [] }],
    });
    const { game, runId } = createOwner(definition);
    const workspace = game.mapRun.getWorkspaceView(runId);
    if (workspace?.kind !== 'active' || !workspace.actionPreview) throw new Error('Expected an active action preview');
    const commandOption = workspace.actionPreview.playerCommandOptions.find(row => row.characterId === 'serika'
      && programTargetIds.includes(row.action.actionId));
    if (!commandOption) throw new Error('Expected an unselected E1 action as a PlayerCommand candidate');
    game.issueMapPlayerCommand(runId, 'serika', commandOption.action.actionId, draftToken(game, runId));
    const commandCard = game.mapRun.getCards(runId).find(card => card.zone === 'playerCommand'
      && card.owner.kind === 'partyCharacter' && card.owner.id === 'serika'
      && card.actionId === commandOption.action.actionId)?.ref;
    if (!commandCard) throw new Error('Expected an Owner-generated PlayerCommand CardRef');
    game.setMapPreparedCardTarget(runId, 'shiroko', commandCard, draftToken(game, runId));
    game.setMapPreparedCardTarget(runId, 'serika', commandCard, draftToken(game, runId));

    const result = commitOwner(game, runId, 'receipt-prepare-boundary');
    const targetSettlement = result.receipt.settlements.find((row: any) => row.characterId === 'serika');
    const prepare = result.receipt.effectTrace.find((entry: any) => entry.op === 'discountSCost');
    expect(targetSettlement).toMatchObject({
      actionId: commandOption.action.actionId, overrideKind: 'playerCommand', playerCostSpent: 1,
      scostCost: { original: 3, discount: 3, paid: 0 },
    });
    expect(result.playerCost).toBe(3);
    expect(JSON.parse(prepare.targetCard.id)).toEqual([
      'playerCommand', 'partyCharacter', 'serika', commandOption.action.actionId,
    ]);
    expect(prepare).toMatchObject({ amount: 2, receiver: { kind: 'partyCharacter', id: 'serika' } });
    expect(validateOwnerReceipt(definition, result)).toEqual({ ok: true, errors: [] });

    const changedCost = structuredClone(result.receipt) as any;
    changedCost.settlements.find((row: any) => row.characterId === 'serika').scostCost = { original: 3, discount: 2, paid: 1 };
    expect(validateOwnerReceipt(definition, result, changedCost).ok).toBe(false);
    const changedReceiver = structuredClone(result.receipt) as any;
    changedReceiver.effectTrace.find((entry: any) => entry.op === 'discountSCost').receiver = null;
    expect(validateOwnerReceipt(definition, result, changedReceiver).ok).toBe(false);
  });

  test('accepts skipped Enemy programs without visits and rejects fabricated prepare access', () => {
    const enemyProgram = {
      id: 'enemy-program', name: 'Enemy Program', eligibleCharacterIds: [],
      target: { kind: 'card' as const, side: 'opponent' as const },
      effectProgram: {
        prepare: [{ op: 'discountSCost' as const, amount: 1 }],
        resolve: [{ op: 'flagSet' as const, flagId: 'visited', value: true }],
      },
    };
    const idle = { id: 'wait', name: 'Wait', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' as const } };
    const cases: {
      readonly skipReason: string;
      readonly enemyId?: string;
      readonly definition: GameplayMapDef;
      readonly beforeCommit?: (game: GameInstance, runId: string) => void;
    }[] = [
      {
        skipReason: 'defeated',
        definition: withEncounterLocals(legacyGoldenMap({
          id: 'test:map:receipt-enemy-defeated',
          actions: [
            { id: 'party-hit', name: 'Party Hit', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
              effectProgram: { resolve: [{ op: 'hpChange', target: 'primary', delta: -5 }] } },
            idle, enemyProgram,
          ],
          participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'party-hit', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
          ],
          enemies: [{ id: 'robot', initialHp: 1, maxHp: 1, actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] }],
        }), { flags: [{ id: 'visited', initial: false }] }),
        beforeCommit: (game, runId) => game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot', draftToken(game, runId)),
      },
      {
        skipReason: 'noLegalTarget',
        definition: withEncounterLocals(legacyGoldenMap({
          id: 'test:map:receipt-enemy-no-target',
          actions: [idle, enemyProgram],
          participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
          ],
          enemies: [{ id: 'robot', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] }],
        }), { flags: [{ id: 'visited', initial: false }] }),
      },
      {
        skipReason: 'unaffordable',
        enemyId: 'robot-2',
        definition: withEncounterLocals(legacyGoldenMap({
          id: 'test:map:receipt-enemy-unaffordable',
          actorResources: [{ characterId: 'serika', resourceId: 'sCost', value: 1 }],
          enemyTeamResources: [{ resourceId: 'charge', value: 2 }],
          actions: [
            { id: 'target', name: 'Target Card', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
              costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
            idle,
            { ...enemyProgram,
              costs: [{ scope: 'team', resourceId: 'charge', amount: 1 }],
              effectProgram: { ...enemyProgram.effectProgram, resolve: [
                { op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'charge', delta: -1 },
                { op: 'flagSet' as const, flagId: 'visited', value: true },
              ] },
            },
          ],
          participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [{ actionId: 'target', tendencyWeight: 1 }] },
          ],
          enemies: [
            { id: 'robot', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] },
            { id: 'robot-2', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] },
          ],
        }), { flags: [{ id: 'visited', initial: false }] }),
      },
      {
        skipReason: 'roundEnded',
        definition: withEncounterLocals(legacyGoldenMap({
          id: 'test:map:receipt-enemy-round-ended',
          actions: [
            { id: 'suicide', name: 'Suicide', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' },
              effectProgram: { resolve: [{ op: 'hpChange', target: 'source', delta: -10 }] } },
            enemyProgram,
          ],
          participants: [
            { characterId: 'shiroko', actions: [{ actionId: 'suicide', tendencyWeight: 1 }] },
            { characterId: 'serika', actions: [{ actionId: 'suicide', tendencyWeight: 1 }] },
          ],
          enemies: [{ id: 'robot', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] }],
        }), { flags: [{ id: 'visited', initial: false }] }),
      },
    ];

    for (const [index, scenario] of cases.entries()) {
      const { game, runId } = createOwner(scenario.definition);
      scenario.beforeCommit?.(game, runId);
      const result = commitOwner(game, runId, `receipt-enemy-skip-${index}`);
      const enemyId = scenario.enemyId ?? 'robot';
      const enemy = result.receipt.enemyActions.find((row: any) => row.enemyId === enemyId);
      expect(enemy?.skipReason, `Expected ${scenario.skipReason}; received ${JSON.stringify(enemy)}`).toBe(scenario.skipReason);
      expectNoEnemyVisits(result.receipt, enemyId);
      expect(validateOwnerReceipt(scenario.definition, result)).toEqual({ ok: true, errors: [] });

      const forged = structuredClone(result.receipt) as any;
      forged.programVisits.push({
        sourceKey: JSON.stringify(['enemy', enemyId]),
        source: { kind: 'enemy', id: enemyId },
        actionId: 'enemy-program',
        path: 'actions.enemy-program.effectProgram.prepare[0]',
        kind: 'prepare', mode: 'program',
      });
      forged.programVisitCount = forged.programVisits.length;
      expect(validateOwnerReceipt(scenario.definition, result, forged).ok).toBe(false);
    }
  });

  test('closes an Enemy resource chain across an intervening cost and validates a declared Program projection', () => {
    const mixed = legacyGoldenMap({
      id: 'test:map:receipt-enemy-resource-interleave',
      enemyTeamResources: [{ resourceId: 'charge', value: 2 }],
      actions: [
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' } },
        { id: 'gain-first', name: 'Gain First', eligibleCharacterIds: [], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'charge', delta: 2 }] } },
        { id: 'pay-between', name: 'Pay Between', eligibleCharacterIds: [], target: { kind: 'none' },
          costs: [{ scope: 'team', resourceId: 'charge', amount: 1 }] },
        { id: 'gain-last', name: 'Gain Last', eligibleCharacterIds: [], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'charge', delta: 1 }] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
      enemies: [
        { id: 'e1', initialHp: 10, maxHp: 10, actions: [{ actionId: 'gain-first', tendencyWeight: 1 }] },
        { id: 'e2', initialHp: 10, maxHp: 10, actions: [{ actionId: 'pay-between', tendencyWeight: 1 }] },
        { id: 'e3', initialHp: 10, maxHp: 10, actions: [{ actionId: 'gain-last', tendencyWeight: 1 }] },
      ],
    });
    const { game, runId } = createOwner(mixed);
    const result = commitOwner(game, runId, 'receipt-enemy-resource-interleave');
    const events = result.receipt.effectTrace.filter((entry: any) => entry.op === 'resourceSettlement');
    expect(events.map((entry: any) => [entry.source.id, entry.before, entry.after, entry.delta])).toEqual([
      ['e1', 2, 4, 2], ['e3', 3, 4, 1],
    ]);
    expect(result.receipt.enemyActions[1].resourceChanges).toContainEqual(expect.objectContaining({
      kind: 'cost', resourceId: 'charge', delta: -1, teamSide: 'enemy',
    }));
    expect(validateOwnerReceipt(mixed, result)).toEqual({ ok: true, errors: [] });

    const shifted = structuredClone(result.receipt) as any;
    const secondEvent = shifted.effectTrace.filter((entry: any) => entry.op === 'resourceSettlement')[1];
    secondEvent.before += 1;
    secondEvent.after += 1;
    expect(validateOwnerReceipt(mixed, result, shifted).ok).toBe(false);

    const program = legacyGoldenMap({
      id: 'test:map:receipt-program-resource-projection',
      teamResources: [{ resourceId: 'supplies', value: 3 }],
      actions: [
        { id: 'program-resource', name: 'Program Resource', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 2 }] } },
        { id: 'program-noop', name: 'Program Noop', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [] } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'program-resource', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      abilityActionIds: ['program-noop'],
      enemies: [{ id: 'robot', initialHp: 10, maxHp: 10, actions: [] }],
    });
    const programOwner = createOwner(program);
    programOwner.game.setMapAbilityDraft(programOwner.runId, 'program-noop',
      { kind: 'partyCharacter', characterId: 'shiroko' }, draftToken(programOwner.game, programOwner.runId));
    const programResult = commitOwner(programOwner.game, programOwner.runId, 'receipt-program-resource-projection');
    expect(programResult.receipt.effectTrace.filter((entry: any) => entry.op === 'resourceSettlement')).toMatchObject([
      { op: 'resourceSettlement', source: { kind: 'partyCharacter', id: 'shiroko' }, resourceId: 'supplies', intentDelta: 2, before: 3, after: 5, delta: 2 },
    ]);
    expect(validateOwnerReceipt(program, programResult)).toEqual({ ok: true, errors: [] });
    const changedProgramEnd = structuredClone(programResult.receipt) as any;
    changedProgramEnd.settlements.find((row: any) => row.characterId === 'shiroko').resourceChanges
      .find((change: any) => change.kind === 'effect').delta += 1;
    expect(validateOwnerReceipt(program, programResult, changedProgramEnd).ok).toBe(false);
  });

  test('accepts ratio guards, clamp-to-zero, zero-delta HP paths, and rejects independent damage', () => {
    const definition = withEncounterLocals(legacyGoldenMap({
      id: 'test:map:receipt-hp-ratio-zero-delta',
      actions: [
        { id: 'ratio-shot', name: 'Ratio Shot', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
          effectProgram: { resolve: [{
            op: 'when',
            condition: { kind: 'hpRatioAtMost', target: 'primary', numerator: 1, denominator: 2 },
            then: [
              { op: 'hpChange', target: 'primary', delta: -5 },
              { op: 'when', condition: { kind: 'hpAtMost', target: 'primary', value: 0 },
                then: [{ op: 'hpChange', target: 'primary', delta: -2 }],
                else: [{ op: 'hpChange', target: 'primary', delta: 1 }] },
            ],
            else: [{ op: 'flagSet', flagId: 'ratioMiss', value: true }],
          }] } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'ratio-shot', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
      enemies: [
        { id: 'robot:alpha', initialHp: 3, maxHp: 10, actions: [] },
        { id: 'robot-beta', initialHp: 10, maxHp: 10, actions: [] },
      ],
    }), { flags: [{ id: 'ratioMiss', initial: false }] });
    const { game, runId } = createOwner(definition);
    game.setMapPreparedEnemyTarget(runId, 'shiroko', 'robot:alpha', draftToken(game, runId));
    const result = commitOwner(game, runId, 'receipt-hp-ratio-zero-delta');
    const hpEvents = result.receipt.effectTrace.filter((entry: any) => entry.op === 'hpChange');
    expect(hpEvents.map((entry: any) => [entry.before, entry.after, entry.delta])).toEqual([[3, 0, -3], [0, 0, 0]]);
    expect(result.receipt.settlements.find((row: any) => row.characterId === 'shiroko').hpChanges).toEqual([
      { scope: 'enemy', enemyId: 'robot:alpha', delta: -3 },
      { scope: 'enemy', enemyId: 'robot:alpha', delta: 0 },
    ]);
    expect(result.receipt.programVisits.some((visit: any) => visit.path.endsWith('.then[1].then[0]'))).toBe(true);
    expect(validateOwnerReceipt(definition, result)).toEqual({ ok: true, errors: [] });

    const badRatio = structuredClone(result.receipt) as any;
    badRatio.effectTrace.find((entry: any) => entry.op === 'when').reads[0].cap += 1;
    expect(validateOwnerReceipt(definition, result, badRatio).ok).toBe(false);
    const badPath = structuredClone(result.receipt) as any;
    const nestedPath = 'actions.ratio-shot.effectProgram.resolve[0].then[1].then[0]';
    const alternatePath = 'actions.ratio-shot.effectProgram.resolve[0].then[1].else[0]';
    badPath.programVisits.find((visit: any) => visit.path === nestedPath).path = alternatePath;
    badPath.effectTrace.find((entry: any) => entry.op === 'hpChange' && entry.path === nestedPath).path = alternatePath;
    expect(validateOwnerReceipt(definition, result, badPath).ok).toBe(false);
    const badDelta = structuredClone(result.receipt) as any;
    badDelta.effectTrace.find((entry: any) => entry.op === 'hpChange' && entry.delta === 0).delta = -1;
    badDelta.settlements.find((row: any) => row.characterId === 'shiroko').hpChanges[1].delta = -1;
    expect(validateOwnerReceipt(definition, result, badDelta).ok).toBe(false);
    const changedCurrent = structuredClone(result.current) as any;
    changedCurrent.enemies.find((enemy: any) => enemy.enemyId === 'robot:alpha').currentHp = 1;
    expect(validateOwnerReceipt(definition, result, result.receipt, changedCurrent).ok).toBe(false);
  });

  test('revalidates maximum safe Damage / Heal amounts and preserves the zero-delta downed trace', () => {
    const definition = legacyGoldenMap({
      id: 'test:map:receipt-damage-heal-boundary',
      actions: [{ id: 'extreme-hit', name: 'Extreme Hit', eligibleCharacterIds: ['shiroko'], target: { kind: 'enemy' },
        effectProgram: { resolve: [
          { op: 'damage' as const, target: 'primary' as const, amount: Number.MAX_SAFE_INTEGER },
          { op: 'heal' as const, target: 'primary' as const, amount: Number.MAX_SAFE_INTEGER },
        ] } }],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'extreme-hit', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [] },
      ],
      enemies: [{ id: 'robot', initialHp: 5, maxHp: 10 }],
    });
    const { game, runId } = createOwner(definition);
    const result = commitOwner(game, runId, 'receipt-damage-heal-boundary');
    const events = result.receipt.effectTrace.filter((entry: any) => entry.op === 'damage' || entry.op === 'heal');
    expect(events.map((entry: any) => [entry.op, entry.amount, entry.before, entry.after, entry.delta])).toEqual([
      ['damage', Number.MAX_SAFE_INTEGER, 5, 0, -5],
      ['heal', Number.MAX_SAFE_INTEGER, 0, 0, 0],
    ]);
    expect(validateOwnerReceipt(definition, result)).toEqual({ ok: true, errors: [] });

    const badAmount = structuredClone(result.receipt) as any;
    badAmount.effectTrace.find((entry: any) => entry.op === 'heal').amount = Number.MAX_SAFE_INTEGER + 1;
    expect(validateOwnerReceipt(definition, result, badAmount).ok).toBe(false);
    const badIdentity = structuredClone(result.receipt) as any;
    badIdentity.effectTrace.find((entry: any) => entry.op === 'damage').identity.id = 'robot-other';
    expect(validateOwnerReceipt(definition, result, badIdentity).ok).toBe(false);
    const badPath = structuredClone(result.receipt) as any;
    badPath.effectTrace.find((entry: any) => entry.op === 'damage').path += '.else[0]';
    expect(validateOwnerReceipt(definition, result, badPath).ok).toBe(false);
  });
});
