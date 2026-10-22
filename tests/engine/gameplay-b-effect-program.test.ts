import { afterEach, describe, expect, test, vi } from 'vitest';
import type { MapRunEncounterDraftToken } from '../../src/arona-clicker/contracts/map-run';
import type { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { MapRunService } from '../../src/arona-clicker/services/map-run-service';
import type { GameplayMapActionDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import {
  createLegacyGoldenOwner,
  LEGACY_GOLDEN_ITEM_ID,
  legacyGoldenMap,
} from './gameplay-b-effect-test-fixtures';

const games: GameInstance[] = [];

function withLocals(map: GameplayMapDef, locals: NonNullable<NonNullable<GameplayMapDef['nodes'][number]['encounter']>['locals']>): GameplayMapDef {
  return {
    ...map,
    nodes: map.nodes.map(node => node.id === 'battle' && node.encounter
      ? { ...node, encounter: { ...node.encounter, locals } }
      : node),
  };
}

function owner(map: GameplayMapDef, itemCount = 0, resolvedMap: GameplayMapDef = map) {
  const fixture = createLegacyGoldenOwner(map, itemCount);
  games.push(fixture.game);
  const admittedParty = fixture.game.mapRun.getSnapshot()?.party;
  if (!admittedParty) throw new Error('Registry Owner did not admit a fixed party');
  const service = new MapRunService(
    { resolve: mapId => mapId === resolvedMap.id ? resolvedMap : null },
    variantId => fixture.game.rosterSystem.getAllVariants().find(variant => variant.id === variantId)?.proto ?? null,
  );
  const seed = vi.spyOn(Math, 'random').mockReturnValue(0.03125);
  try {
    const started = service.start(resolvedMap.id, admittedParty);
    const edge = resolvedMap.edges.find(row => row.fromNodeId === started.currentNodeId
      && resolvedMap.nodes.find(node => node.id === row.toNodeId)?.encounter);
    if (!edge) throw new Error('Expected a reachable Encounter');
    const entered = service.move(started.runId, edge.toNodeId);
    expect(entered.activeEncounter?.randomState.seed).toBe(0x08000000);
    return { service, runId: started.runId };
  } finally {
    seed.mockRestore();
  }
}

function draft(service: MapRunService): MapRunEncounterDraftToken {
  const encounter = service.getSnapshot()?.activeEncounter;
  if (!encounter) throw new Error('Expected an active Encounter');
  return { nodeId: encounter.nodeId, ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
    round: encounter.round, draftVersion: encounter.draftVersion };
}

function preview(service: MapRunService, runId: string) {
  return service.previewEncounterCommit(runId);
}

afterEach(() => { games.splice(0).forEach(game => game.dispose()); });

describe('Gameplay B authoritative effect program planning', () => {
  test('HP guards observe current source HP and Preview traces actual C3 resource balances', () => {
    const map = withLocals(legacyGoldenMap({
      id: 'test:map:program-order',
      partyHp: { shiroko: 4 },
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      actions: [
        {
          id: 'party-program', name: 'Party Program', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          effectProgram: { resolve: [
            { op: 'hpChange', target: 'source', delta: 1 },
            {
              op: 'when', condition: { kind: 'hpAtLeast', target: 'source', value: 5 },
              then: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }],
              else: [{ op: 'counterAdd', counterId: 'seen', delta: 1 }],
            },
          ] },
        },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'party-program', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
    }), { counters: [{ id: 'seen', initial: 0, min: 0, max: 4 }] });
    const { service, runId } = owner(map);
    const before = service.getSnapshot();
    const result = preview(service, runId);
    expect(result).toMatchObject({
      canCommit: true,
      diagnostics: [],
      programReceiptVersion: 1,
      executionContractId: 'E1-COMPAT-1',
      programVisitCount: 4,
      effectScope: { runId, mapId: map.id, nodeId: 'battle', activityId: null, round: 1 },
      plannedLocals: { counters: { seen: { value: 0, min: 0, max: 4 } }, flags: {} },
    });
    expect(result?.effectTrace?.find(row => row.op === 'when')).toMatchObject({
      result: true,
      reads: [{ op: 'hpAtLeast', current: 5, value: 5, result: true }],
    });
    expect(result?.effectTrace?.filter(row => row.op === 'resourceSettlement')).toMatchObject([
      { account: 'sourceTeam', resourceId: 'supplies', intentDelta: 1, before: 1, after: 2, delta: 1 },
    ]);
    expect(result?.programVisits).toHaveLength(4);
    expect(preview(service, runId)).toEqual(result);
    expect(service.getSnapshot()).toEqual(before);
    expect(Object.isFrozen(result?.programVisits)).toBe(true);
    expect(Object.isFrozen(result?.programVisits?.[0]?.source)).toBe(true);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('Ability and Item using one Action remain separate sources and share sequential locals', () => {
    const shared: GameplayMapActionDef = {
      id: 'shared-source', name: 'Shared Source', eligibleCharacterIds: [], target: { kind: 'enemy' },
      effectProgram: { resolve: [
        { op: 'counterAdd', counterId: 'count', delta: 1 },
        { op: 'when', condition: { kind: 'counter', counterId: 'count', comparison: 'eq', value: 2 },
          then: [{ op: 'flagSet', flagId: 'ready', value: true }] },
      ] },
    };
    const map = withLocals(legacyGoldenMap({
      id: 'test:map:program-new02',
      actions: [
        shared,
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' } },
      ],
      participants: ['shiroko', 'serika'].map(characterId => ({
        characterId, actions: [{ actionId: 'wait', tendencyWeight: 1 }],
      })),
      enemies: [{ id: 'robot', initialHp: 10, maxHp: 10 }],
      abilityActionIds: ['shared-source'],
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'shared-source' }],
      itemCount: 1,
    }), { counters: [{ id: 'count', initial: 0, min: 0, max: 5 }], flags: [{ id: 'ready', initial: false }] });
    const { service, runId } = owner(map, 1);
    service.setAbilityDraft(runId, 'shared-source', { kind: 'enemy', enemyId: 'robot' }, draft(service));
    service.setItemDraft(runId, LEGACY_GOLDEN_ITEM_ID, { kind: 'enemy', enemyId: 'robot' }, draft(service));
    const result = preview(service, runId);
    const visits = result?.programVisits?.filter(row => row.actionId === 'shared-source') ?? [];
    const sources = [...new Set(visits.map(row => row.sourceKey))];
    expect(sources).toHaveLength(2);
    expect(visits.filter(row => row.kind === 'statement').map(row => row.source.kind)).toEqual(['ability', 'ability', 'item', 'item', 'item']);
    expect(result?.plannedLocals).toMatchObject({
      counters: { count: { value: 2 } }, flags: { ready: true },
    });
    expect(result?.effectTrace?.filter(row => row.op === 'when').map(row => row.op === 'when' && row.reads[0])).toEqual([
      expect.objectContaining({ op: 'counter', current: 1, result: false }),
      expect.objectContaining({ op: 'counter', current: 2, result: true }),
    ]);
    expect(result?.programVisits?.map(row => row.source.kind)).toEqual([
      'ability', 'ability', 'ability', 'item', 'item', 'item', 'item',
    ]);
  });

  test('aggregate costs preflight against starting balances before a program resource gain', () => {
    const map = legacyGoldenMap({
      id: 'test:map:program-late-cost-preflight',
      teamResources: [{ resourceId: 'supplies', value: 1 }],
      actions: [
        { id: 'first-cost', name: 'First Cost', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }] },
        {
          id: 'late-effect', name: 'Late Effect', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
          costs: [{ scope: 'team', resourceId: 'supplies', amount: 1 }],
          effectProgram: { resolve: [{ op: 'resourceChange', account: 'sourceTeam', resourceId: 'supplies', delta: 1 }] },
        },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'first-cost', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'late-effect', tendencyWeight: 1 }] },
      ],
    });
    const { service, runId } = owner(map);
    const initial = service.getSnapshot()!;
    service.issuePlayerCommand(runId, 'serika', 'late-effect', draft(service));
    const before = service.getSnapshot();
    expect(preview(service, runId)).toMatchObject({
      canCommit: false,
      diagnostics: [expect.stringContaining('cannot afford resource cost "supplies"')],
      settlements: null,
    });
    expect(service.getSnapshot()).toEqual(before);
    expect(service.getSnapshot()?.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
    expect(initial.teamResources).toEqual([{ resourceId: 'supplies', value: 1 }]);
  });

  test('Enemy prepare uses its own CardRef and skipped shared-cost sources emit no visits', () => {
    const map = withLocals(legacyGoldenMap({
      id: 'test:map:program-enemy-unaffordable',
      actorResources: [{ characterId: 'shiroko', resourceId: 'sCost', value: 2 }],
      enemyTeamResources: [{ resourceId: 'charge', value: 2 }],
      actions: [
        { id: 'shot', name: 'Shot', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' },
          costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
        {
          id: 'enemy-program', name: 'Enemy Program', eligibleCharacterIds: [], target: { kind: 'card', side: 'opponent' },
          costs: [{ scope: 'team', resourceId: 'charge', amount: 1 }],
          effectProgram: {
            prepare: [{ op: 'discountSCost', amount: 1 }],
            resolve: [
              { op: 'resourceChange', account: 'sourceTeam', resourceId: 'charge', delta: -1 },
              { op: 'counterAdd', counterId: 'seen', delta: 1 },
            ],
          },
        },
      ],
      participants: [{ characterId: 'shiroko', actions: [{ actionId: 'shot', tendencyWeight: 1 }] }, { characterId: 'serika', actions: [] }],
      enemies: [
        { id: 'robot', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] },
        { id: 'robot-2', initialHp: 10, maxHp: 10, actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }] },
      ],
    }), {});
    const declared = withLocals(map, { counters: [{ id: 'seen', initial: 0, min: 0, max: 4 }] });
    const { service, runId } = owner(declared);
    const result = preview(service, runId);
    const enemyCard = result?.effectTrace?.find(entry => entry.op === 'discountSCost'
      && entry.source?.kind === 'enemy' && entry.source.id === 'robot');
    expect(result?.programVisits?.find(row => row.source.kind === 'enemy' && row.source.id === 'robot' && row.kind === 'prepare')).toMatchObject({
      sourceKey: JSON.stringify(['enemy', 'robot']),
      actionId: 'enemy-program',
      path: 'actions.enemy-program.effectProgram.prepare[0]',
    });
    expect(enemyCard).toMatchObject({
      mode: 'program',
      targetCard: { kind: 'card', scope: { runId, mapId: declared.id, nodeId: 'battle', round: 1 } },
      receiver: { kind: 'partyCharacter', id: 'shiroko' },
    });
    expect(result?.plannedLocals?.counters.seen?.value).toBe(1);
    expect(result?.effectTrace?.find(entry => entry.op === 'resourceSettlement'
      && entry.source?.kind === 'enemy')).toMatchObject({
      source: { kind: 'enemy', id: 'robot' },
      account: 'sourceTeam', resourceId: 'charge', intentDelta: -1, before: 1, after: 0, delta: -1,
    });

    expect(result?.enemyActions).toContainEqual(expect.objectContaining({
      enemyId: 'robot-2', actionId: 'enemy-program', skipReason: 'unaffordable',
    }));
    expect(result?.programVisits).not.toContainEqual(expect.objectContaining({
      source: { kind: 'enemy', id: 'robot-2' },
      kind: 'prepare',
    }));
    expect(result?.programVisits).not.toContainEqual(expect.objectContaining({
      source: { kind: 'enemy', id: 'robot-2' },
      kind: 'statement',
    }));
  });

  test('legacy Ability healing stays after a new Item guard in the established phase', () => {
    const map = withLocals(legacyGoldenMap({
      id: 'test:map:program-new04',
      partyHp: { shiroko: 4 },
      actions: [
        { id: 'legacy-heal', name: 'Legacy Heal', eligibleCharacterIds: [], target: { kind: 'partyCharacter' }, hpEffects: [{ amount: 3 }] },
        {
          id: 'program-item', name: 'Program Item', eligibleCharacterIds: [], target: { kind: 'partyCharacter' },
          effectProgram: { resolve: [{
            op: 'when', condition: { kind: 'hpAtLeast', target: 'primary', value: 7 },
            then: [{ op: 'flagSet', flagId: 'ready', value: true }],
            else: [{ op: 'flagSet', flagId: 'ready', value: false }],
          }] },
        },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['shiroko', 'serika'], target: { kind: 'none' } },
      ],
      participants: ['shiroko', 'serika'].map(characterId => ({
        characterId, actions: [{ actionId: 'wait', tendencyWeight: 1 }],
      })),
      enemies: [{ id: 'robot', initialHp: 10, maxHp: 10 }],
      abilityActionIds: ['legacy-heal'],
      itemActions: [{ itemId: LEGACY_GOLDEN_ITEM_ID, actionId: 'program-item' }],
      itemCount: 1,
    }), { flags: [{ id: 'ready', initial: false }] });
    const { service, runId } = owner(map, 1);
    service.setAbilityDraft(runId, 'legacy-heal', { kind: 'partyCharacter', characterId: 'shiroko' }, draft(service));
    service.setItemDraft(runId, LEGACY_GOLDEN_ITEM_ID, { kind: 'partyCharacter', characterId: 'shiroko' }, draft(service));
    const result = preview(service, runId);
    expect(result?.plannedLocals?.flags.ready).toBe(false);
    expect(result?.effectTrace?.find(row => row.op === 'when')).toMatchObject({
      result: false,
      reads: [{ op: 'hpAtLeast', current: 4, value: 7, result: false }],
    });
    expect(result?.settlements?.find(row => row.characterId === 'shiroko')?.hpChanges).toBeUndefined();
    expect(result?.settlements).toHaveLength(2);
  });

  test('one round-local visit budget admits 4096 accesses with prepare included and rejects the 4097th', () => {
    const createStatements = (count: number) => Array.from({ length: count }, (_, index) => ({
      op: 'flagSet' as const, flagId: 'tick', value: index % 2 === 0,
    }));
    const createBudgetMap = (id: string, partyPrepare: boolean, partyResolveCount: number, enemyResolveCount: number): GameplayMapDef => {
      const actions: GameplayMapActionDef[] = [
        { id: 'shot', name: 'Shot', eligibleCharacterIds: ['serika'], target: { kind: 'none' },
          costs: [{ scope: 'actor', resourceId: 'sCost', amount: 1 }] },
        { id: 'enemy-program', name: 'Enemy Program', eligibleCharacterIds: [], target: { kind: 'none' },
          effectProgram: { resolve: createStatements(enemyResolveCount) } },
        ...(partyPrepare ? [{
          id: 'party-prepare', name: 'Party Prepare', eligibleCharacterIds: ['shiroko'],
          target: { kind: 'card', side: 'ally' },
          effectProgram: { prepare: [{ op: 'discountSCost', amount: 1 }], resolve: createStatements(partyResolveCount) },
        } as GameplayMapActionDef] : []),
        ...(!partyPrepare ? [{ id: 'wait', name: 'Wait', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' } } as GameplayMapActionDef] : []),
      ];
      return withLocals(legacyGoldenMap({
        id,
        actorResources: [{ characterId: 'serika', resourceId: 'sCost', value: 1 }],
        actions,
        participants: [
          { characterId: 'shiroko', actions: [{ actionId: partyPrepare ? 'party-prepare' : 'wait', tendencyWeight: 1 }] },
          { characterId: 'serika', actions: [{ actionId: 'shot', tendencyWeight: 1 }] },
        ],
        enemies: Array.from({ length: 64 }, (_, index) => ({
          id: 'enemy-' + (index + 1), initialHp: 10, maxHp: 10,
          actions: [{ actionId: 'enemy-program', tendencyWeight: 1 }],
        })),
      }), { flags: [{ id: 'tick', initial: false }] });
    };
    const exact = createBudgetMap('test:map:program-budget-exact', true, 63, 63);
    const exactOwner = owner(exact);
    const admitted = preview(exactOwner.service, exactOwner.runId);
    expect(admitted).toMatchObject({ canCommit: true, diagnostics: [], programReceiptVersion: 1, programVisitCount: 4096 });
    expect(admitted?.programVisits).toHaveLength(4096);
    expect(preview(exactOwner.service, exactOwner.runId)).toEqual(admitted);

    const overflow = createBudgetMap('test:map:program-budget-overflow', true, 0, 64);
    const overflowOwner = owner(overflow);
    const targetCard = overflowOwner.service.getCards(overflowOwner.runId)
      .find(card => card.owner.kind === 'partyCharacter' && card.owner.id === 'serika' && card.actionId === 'shot')?.ref;
    if (!targetCard) throw new Error('Overflow fixture has no Owner-generated target CardRef');
    overflowOwner.service.setPreparedCardTarget(overflowOwner.runId, 'shiroko', targetCard, draft(overflowOwner.service));
    const rejected = preview(overflowOwner.service, overflowOwner.runId);
    expect(rejected).toMatchObject({
      canCommit: false,
      diagnostics: [expect.stringContaining('visit budget exceeds 4096')],
    });
    expect(preview(overflowOwner.service, overflowOwner.runId)).toEqual(rejected);
  });

  test('the Encounter planner revalidates a custom resolver result against map context', () => {
    const registered = legacyGoldenMap({
      id: 'test:map:program-custom-resolver-context',
      actions: [
        { id: 'source', name: 'Source', eligibleCharacterIds: ['shiroko'], target: { kind: 'none' } },
        { id: 'wait', name: 'Wait', eligibleCharacterIds: ['serika'], target: { kind: 'none' } },
      ],
      participants: [
        { characterId: 'shiroko', actions: [{ actionId: 'source', tendencyWeight: 1 }] },
        { characterId: 'serika', actions: [{ actionId: 'wait', tendencyWeight: 1 }] },
      ],
    });
    const custom = {
      ...registered,
      actions: registered.actions?.map(action => action.id === 'source' ? {
        ...action,
        effectProgram: { resolve: [{ op: 'resourceChange' as const, account: 'sourceTeam' as const, resourceId: 'undeclared', delta: 1 }] },
      } : action),
    };
    const { service, runId } = owner(registered, 0, custom);
    expect(preview(service, runId)).toMatchObject({
      canCommit: false,
      diagnostics: [expect.stringContaining('undeclared')],
      settlements: null,
    });
  });

});
